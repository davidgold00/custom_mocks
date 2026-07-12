import { Card, CardBody, CardHeader, Button, Input, Select } from '@/components/Card'
import { PosBadge, InjuryBadge, POS_SOLID } from '@/components/PosBadge'
import { useUI } from '@/store'
import { useEffect, useMemo, useRef, useState } from 'react'
import { applyPick, pickForBot, mulberry32 } from '@/lib/draftEngine'
import { RankedPlayer, BotProfile } from '@/types'
import { usePlayerMap, useBoard } from '@/lib/rankings'
import { loadMock, saveMock, debounce } from '@/lib/api'
import { api, trySync } from '@/lib/userApi'
import { useAuth } from '@/lib/authStore'

type Panel = 'ROSTER' | 'LOG'
const POS = ['ALL','QB','RB','WR','TE','K','DST'] as const

// visible rows and cell sizing
const VISIBLE_ROUNDS = 5
const ROW_PX = 72   // compact row height

// ---- NEW: helpers for room id and snapshot I/O ----
function getRoomId(): string | null {
  try {
    const u = new URL(window.location.href)
    return u.searchParams.get('room')
  } catch {
    return null
  }
}

type DraftRoomSnapshot = {
  // minimal MVP snapshot focused on what's editable from this component
  draftState: any
  round: number
  overall: number
  log: string[]
  humanIndex: number | null
}

export default function DraftRoom() {
  const {
    settings,
    bots,
    draft,
    initDraft,
    humanIndex,
    setHumanIndex,
    setHuman,             // to flip seat ownership when claiming
    pickTimer,
    globalBot
  } = useUI()

  // draft engine state
  const [state, setState] = useState(draft)
  const [round, setRound] = useState(1)
  const [overall, setOverall] = useState(1)
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [panel, setPanel] = useState<Panel>('ROSTER')
  // which team's roster is shown; null = follow the user's seat
  const [viewTeam, setViewTeam] = useState<number | null>(null)

  // human turn timer
  const [timeLeft, setTimeLeft] = useState<number>(pickTimer)

  // search/filter
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState<(typeof POS)[number]>('ALL')

  // ---- NEW: room sync refs ----
  const roomIdRef = useRef<string | null>(null)
  const lastLoadedHash = useRef<string>('') // avoid re-saving what we just loaded

  // hydrate from store
  useEffect(() => setState(draft ?? null), [draft])

  // Ensure a draft exists with team count; otherwise re-init
  useEffect(() => {
    if (!state || (state.rosters?.length ?? 0) !== settings.teams) {
      initDraft()
      setState(prev => draft ?? prev)
      setRound(1)
      setOverall(1)
      setRunning(false)
      setLog([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.teams])

  // ---- NEW: Load snapshot on mount if ?room=... ----
  useEffect(() => {
    const roomId = getRoomId()
    roomIdRef.current = roomId
    if (!roomId) return

    let cancelled = false
    ;(async () => {
      const snap = await loadMock(roomId)
      if (cancelled || !snap) return
      try {
        const s = snap as DraftRoomSnapshot
        if (s.draftState) setState(s.draftState)
        if (typeof s.round === 'number') setRound(s.round)
        if (typeof s.overall === 'number') setOverall(s.overall)
        if (Array.isArray(s.log)) setLog(s.log)
        if (typeof s.humanIndex === 'number' || s.humanIndex === null) setHumanIndex(s.humanIndex ?? null)
        lastLoadedHash.current = JSON.stringify(snap)
      } catch {
        // ignore malformed snapshots
      }
    })()

    return () => { cancelled = true }
  }, [setHumanIndex])

  // ---- NEW: Poll every 3s to keep multiple viewers roughly in sync ----
  useEffect(() => {
    const roomId = roomIdRef.current
    if (!roomId) return

    let alive = true
    const tick = async () => {
      const remote = await loadMock(roomId)
      if (!alive || !remote) return
      const remoteHash = JSON.stringify(remote)
      if (remoteHash === lastLoadedHash.current) return

      try {
        const s = remote as DraftRoomSnapshot
        if (s.draftState) setState(s.draftState)
        if (typeof s.round === 'number') setRound(s.round)
        if (typeof s.overall === 'number') setOverall(s.overall)
        if (Array.isArray(s.log)) setLog(s.log)
        if (typeof s.humanIndex === 'number' || s.humanIndex === null) setHumanIndex(s.humanIndex ?? null)
        lastLoadedHash.current = remoteHash
      } catch {
        // ignore
      }
    }

    const id = window.setInterval(tick, 3000)
    return () => { alive = false; window.clearInterval(id) }
  }, [setHumanIndex])

  // ---- NEW: Save snapshot when things change (debounced) ----
  const saveNow = async () => {
    const roomId = roomIdRef.current
    if (!roomId) return
    const snapshot: DraftRoomSnapshot = {
      draftState: state,
      round,
      overall,
      log,
      humanIndex
    }
    const hash = JSON.stringify(snapshot)
    if (hash === lastLoadedHash.current) return // skip if nothing changed vs last load
    await saveMock(roomId, snapshot)
  }
  const saveDebounced = useRef(debounce(saveNow, 600)).current

  useEffect(() => { saveDebounced() }, [state, round, overall, log, humanIndex])

  const board = useBoard()

  /* ---------- derived ---------- */
  const available = useMemo(() => {
    const taken = state?.taken ?? new Set<string>()
    return board.filter(p => !taken.has(p.id)) // board is already in rank order
  }, [board, state])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return available.filter(p =>
      (pos === 'ALL' || p.pos === pos) &&
      (!s || p.name.toLowerCase().includes(s))
    )
  }, [available, pos, search])

  const started = (state?.picks.length ?? 0) > 0
  const totalPicks = settings.rounds * settings.teams
  const complete = state && state.picks.length >= totalPicks

  // save the finished draft to the user's account, once per completion
  const savedDraftRef = useRef(false)
  useEffect(() => {
    if (!complete || savedDraftRef.current || !state) return
    savedDraftRef.current = true
    trySync(
      api
        .saveDraft({
          name: `${settings.teams}-team draft, ${new Date().toLocaleDateString()}`,
          settings,
          teams: bots.map((b, i) => ({ name: b.name || `Team ${i + 1}`, isHuman: humanIndex === i })),
          picks: state.picks,
        })
        .then((d) => useAuth.getState().addDraftMeta({ ...d, createdAt: new Date().toISOString() })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete])
  useEffect(() => { if (!started) savedDraftRef.current = false }, [started])

  // whose turn
  const pickIdxInRound = (overall - 1) % settings.teams
  const reverse = round % 2 === 0
  const currentTeam = reverse ? settings.teams - 1 - pickIdxInRound : pickIdxInRound
  const currentSeat = bots[currentTeam]

  // Single source of truth: it's the human's turn if user claimed this seat
  const isHumanTurn = humanIndex === currentTeam

  /* ---------- helpers ---------- */
  function effectiveProfile(seat: BotProfile): BotProfile {
    if (!seat.inheritGlobal) return seat
    const { name, isHuman, inheritGlobal, preset, favorites } = seat
    return { ...globalBot, name, isHuman, inheritGlobal, preset, favorites }
  }

  function makePick(teamIndex: number, player: RankedPlayer, rd: number, ov: number, who: string) {
    if (!state) return
    applyPick(state, teamIndex, player, rd, ov) // mutates
    setState({ ...state, picks: [...state.picks] })
    setLog((l) => [`Pick ${ov}: Team ${teamIndex + 1} (${who}) → ${player.name} (${player.pos})`, ...l])

    const nextOverall = ov + 1
    const nextRound = Math.ceil(nextOverall / settings.teams)
    setOverall(nextOverall)
    setRound(nextRound)
    setTimeLeft(pickTimer)
  }

  function nextPickOnce() {
    if (!state) return
    if (state.picks.length >= totalPicks) {
      setRunning(false)
      return
    }
    // Stop the loop if it's the user's seat
    if (humanIndex === currentTeam) return

    // bot pick — off the user's board, seeded per pick so drafts are replayable
    const profile = effectiveProfile(currentSeat)
    const rng = mulberry32(((state.seed ?? 1) ^ Math.imul(overall, 0x9e3779b1)) >>> 0)
    const choice =
      pickForBot({ pool: available, settings, state, profile, round, teamIndex: currentTeam, rng }) ??
      available[0]
    if (!choice) return
    makePick(currentTeam, choice, round, overall, currentSeat.name)
  }

  // run loop
  const intervalRef = useRef<number | null>(null)
  useEffect(() => {
    if (!running) return
    intervalRef.current = window.setInterval(nextPickOnce, 350)
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, overall, round, state, bots, settings, humanIndex])

  // human countdown (only while running)
  useEffect(() => {
    // don't count down unless it's YOUR turn AND the draft is running
    if (!isHumanTurn || !running) return;

    if (timeLeft <= 0) {
      const auto = filtered[0] ?? available[0]
      if (auto) makePick(currentTeam, auto, round, overall, 'You (Auto)')
      return
    }

    const t = window.setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => window.clearTimeout(t)
    // include `running` so pausing immediately cancels the tick
  }, [isHumanTurn, running, timeLeft, filtered, available, currentTeam, round, overall])

  // controls
  function startDraft() {
    if (!state) {
      initDraft()
      return
    }
    setRunning(true)
  }
  function togglePause() {
    setRunning((r) => !r)
  }
  function stopAndReset() {
    if (!window.confirm('Are you sure? This will reset the draft.')) return
    setRunning(false)
    setLog([])
    setRound(1)
    setOverall(1)
    setTimeLeft(pickTimer)
    initDraft()
  }

  const canClaim = !started && !running

  // Dynamic height: show at most 5 rows; if rounds < 5, shrink so no blank area.
  const rowsVisible = Math.min(settings.rounds || 1, VISIBLE_ROUNDS)
  const boardHeight = rowsVisible * ROW_PX + 24 // small headroom

  // Claim behavior: flip previous human seat back to bot; set new seat to human
  function claimSeat(i: number) {
    if (!canClaim) return
    const prev = humanIndex
    if (prev !== null && prev !== i) setHuman(prev, false)
    setHuman(i, true)
    setHumanIndex(i)
  }

  return (
    <div className="grid grid-rows-[auto_minmax(120px,auto)_minmax(260px,1fr)] gap-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Draft Board — Round {round}</div>
        <div className="flex items-center gap-2">
          {!started && !running && (
            <Button onClick={startDraft} variant="primary">Start</Button>
          )}
          {(started || running) && (
            <>
              <Button onClick={togglePause} variant="outline">{running ? 'Pause' : 'Resume'}</Button>
              <Button onClick={stopAndReset} variant="ghost">Stop Draft</Button>
            </>
          )}

          {/* NEW green pill shown any time it's the user's turn */}
          {isHumanTurn && (
            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold">
              Your turn to draft!
            </span>
          )}

          {isHumanTurn && (
            <span className="text-sm text-slate-600">Your Pick — <b>{timeLeft}s</b></span>
          )}
        </div>
      </div>

      {/* Board */}
      <Card className="overflow-hidden">
        <CardBody className="p-0">
          <div className="overflow-auto" style={{ height: boardHeight }}>
            <Board
              state={state}
              teams={settings.teams}
              rounds={settings.rounds}
              humanIndex={humanIndex}
              canClaim={canClaim}
              onClaim={claimSeat}
            />
          </div>
        </CardBody>
      </Card>

      {/* Bottom: Players left + right panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Player List */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Available Players"
            action={
              <div className="flex items-center gap-3">
                {/* Overall pick pill */}
                <span
                  className="hidden md:inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-medium"
                  title="Current overall pick"
                >
                  Pick #{overall}
                </span>

                {/* Search */}
                <div className="hidden md:block">
                  <Input
                    placeholder="Search player…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>

                {/* Position filter */}
                <Select value={pos} onChange={e => setPos(e.target.value as any)}>
                  {POS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </Select>
              </div>
            }
          />
          <CardBody className="p-0">
            <PlayersTable
              rows={filtered}
              disabled={!isHumanTurn}
              onPick={(p) => makePick(currentTeam, p, round, overall, 'You')}
            />
          </CardBody>
        </Card>

        {/* Team roster / Event Log */}
        <Card>
          <CardHeader
            title={
              panel === 'ROSTER' ? (
                <Select
                  value={viewTeam ?? humanIndex ?? 0}
                  onChange={(e) => setViewTeam(Number(e.target.value))}
                  className="font-semibold"
                >
                  {bots.map((b, i) => (
                    <option key={i} value={i}>
                      {b.name || `Team ${i + 1}`}{humanIndex === i ? ' (You)' : ''}
                    </option>
                  ))}
                </Select>
              ) : 'Event Log'
            }
            action={
              <div className="flex gap-2">
                <Button variant={panel === 'ROSTER' ? 'primary' : 'outline'} onClick={() => setPanel('ROSTER')}>Roster</Button>
                <Button variant={panel === 'LOG' ? 'primary' : 'outline'} onClick={() => setPanel('LOG')}>Log</Button>
              </div>
            }
          />
          <CardBody>
            {panel === 'LOG' ? (
              <>
                <div className="text-xs text-slate-500 mb-3">{state?.picks.length ?? 0} picks</div>
                <ul className="text-xs space-y-2 max-h-[420px] overflow-auto">
                  {log.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
                {complete && <div className="pt-3"><a href="/results" className="text-indigo-600 underline">View Results</a></div>}
              </>
            ) : (
              <RosterView state={state} teamIndex={viewTeam ?? humanIndex ?? 0} />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

/* ===================== Board ===================== */
function Board({
  state, teams, rounds, humanIndex, canClaim, onClaim
}:{
  state:any, teams:number, rounds:number, humanIndex:number|null,
  canClaim:boolean,
  onClaim:(i:number)=>void
}) {
  const grid = Array.from({ length: rounds }, (_, r) =>
    Array.from({ length: teams }, (_, c) => ({ r: r + 1, c }))
  )
  return (
    <div className="min-w-[880px]">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${teams + 1}, minmax(0, 1fr))` }}>
        <div></div>
        {Array.from({ length: teams }, (_, i) => (
          <div key={i} className="px-2 py-1 text-xs font-semibold text-center">
            {canClaim ? (
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  className={`px-3 py-1 rounded-full font-semibold text-white ${humanIndex === i ? 'bg-indigo-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                  onClick={() => onClaim(i)}
                  title={humanIndex === i ? 'Your seat' : 'Claim this draft spot'}
                >
                  {humanIndex === i ? 'You' : 'Claim'}
                </button>
                <span className="text-[10px] text-slate-500">1.{i+1}</span>
              </div>
            ) : (
              <div className={`${humanIndex===i?'bg-indigo-600 text-white rounded':''} inline-block px-2 py-1`}>Team {i + 1} {humanIndex === i && '(You)'}</div>
            )}
          </div>
        ))}

        {grid.map((row, i) => (
          <div key={`row-${i}`} className="contents">
            <div className="px-2 py-1 text-xs font-semibold text-right">R{i + 1}</div>
            {row.map(cell => {
              const pick = state?.picks.find((p: any) => p.round === cell.r && p.teamIndex === cell.c)
              const playerId = pick?.playerId
              return (
                <div key={`${cell.r}-${cell.c}`} className="border border-slate-200 h-12 rounded-md m-1 px-2 py-[2px] text-xs bg-white">
                  {playerId ? <Picked playerId={playerId} /> : <span className="text-slate-400">—</span>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function Picked({ playerId }: { playerId: string }) {
  const data = usePlayerMap()[playerId]
  if (!data) return null
  return (
    <div className={`truncate border-l-2 pl-1.5 ${POS_SOLID[data.pos].replace('bg-', 'border-')}`}>
      <div className="font-medium truncate">{data.name}</div>
      <div className="text-[10px] text-slate-500">{data.pos} · {data.team}</div>
    </div>
  )
}

/* ===================== Players Table ===================== */
function PlayersTable({
  rows,
  disabled,
  onPick
}:{
  rows: RankedPlayer[]
  disabled: boolean
  onPick: (p: RankedPlayer) => void
}) {
  return (
    <div className="overflow-auto max-h-[420px]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 z-10">
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2 w-12">Rank</th>
            <th className="px-3 py-2">Player</th>
            <th className="px-3 py-2 w-14">Pos</th>
            <th className="px-3 py-2 w-14">Bye</th>
            <th className="px-3 py-2 w-16">ADP</th>
            <th className="px-3 py-2 w-24 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/70">
              <td className="px-3 py-2 font-semibold text-slate-600">{p.rank}</td>
              <td className="px-3 py-2">
                <span className="font-medium">{p.name}</span>
                <InjuryBadge status={p.injuryStatus} />
                <span className="ml-2 text-xs text-slate-400">{p.team}</span>
              </td>
              <td className="px-3 py-2"><PosBadge pos={p.pos} /></td>
              <td className="px-3 py-2 text-slate-500">{p.bye ?? '—'}</td>
              <td className="px-3 py-2 text-slate-500">{p.adp ?? '—'}</td>
              <td className="px-3 py-2 text-right">
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() => onPick(p)}
                >
                  {disabled ? 'Waiting…' : 'Draft'}
                </Button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-slate-500">No players match your filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ===================== Roster panel (any team, Sleeper-style) ===================== */
function RosterView({ state, teamIndex }: { state: any, teamIndex: number }) {
  const { settings } = useUI()
  const playerMap = usePlayerMap()
  if (!state) return null
  const req = settings.roster

  type Slot = { key:string; label:string; filled?: { name:string; pos:string; team:string; round:number; overall:number } }
  const slots: Slot[] = []
  const add = (k: keyof typeof req, label?:string) => {
    for (let i = 0; i < (req as any)[k]; i++) slots.push({ key: k, label: label ?? k })
  }
  add('QB'); add('RB'); add('WR'); add('TE'); add('FLEX'); add('K'); add('DST'); add('BENCH','BN')

  const teamPicks = (state.picks as any[])
    .filter((p) => p.teamIndex === teamIndex)
    .sort((a,b) => a.overall - b.overall)
    .map(p => {
      const pl = playerMap[p.playerId]
      return pl ? { ...pl, round: p.round, overall: p.overall } : null
    })
    .filter(Boolean) as NonNullable<Slot['filled']>[]

  const takeFirstEmpty = (k:string) => slots.find(s => s.key === k && !s.filled)
  const isFlexEligible = (pos:string) => pos==='RB' || pos==='WR' || pos==='TE'
  for (const pl of teamPicks) {
    const primary = takeFirstEmpty(pl.pos)
    if (primary) { primary.filled = pl; continue }
    if (isFlexEligible(pl.pos)) {
      const flex = takeFirstEmpty('FLEX')
      if (flex) { flex.filled = pl; continue }
    }
    const bench = takeFirstEmpty('BENCH')
    if (bench) bench.filled = pl
  }

  const colorFor = (k:string) =>
    k==='QB' ? 'bg-sky-500' :
    k==='RB' ? 'bg-emerald-500' :
    k==='WR' ? 'bg-indigo-500' :
    k==='TE' ? 'bg-amber-500' :
    k==='K'  ? 'bg-fuchsia-500' :
    k==='DST'? 'bg-slate-600' :
    'bg-slate-400'

  return (
    <div className="space-y-1.5 max-h-[440px] overflow-auto pr-0.5">
      {slots.map((s, idx) => (
        <div
          key={idx}
          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 border ${
            s.filled ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50/60'
          }`}
        >
          <span className={`w-9 shrink-0 text-center text-[10px] font-bold text-white rounded py-0.5 ${colorFor(s.key)} ${!s.filled && 'opacity-40'}`}>
            {s.label}
          </span>
          {s.filled ? (
            <>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{s.filled.name}</div>
                <div className="text-[10px] text-slate-400">{s.filled.pos} · {s.filled.team}</div>
              </div>
              <span className="ml-auto shrink-0 text-[10px] text-slate-400 tabular-nums">
                {s.filled.round}.{String(s.filled.overall - (s.filled.round - 1) * settings.teams).padStart(2, '0')}
              </span>
            </>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </div>
      ))}
    </div>
  )
}

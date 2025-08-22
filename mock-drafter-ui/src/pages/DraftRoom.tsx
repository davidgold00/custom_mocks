import { Card, CardBody, CardHeader, Button, Input, Select } from '@/components/Card'
import { useUI } from '@/store'
import { useEffect, useMemo, useRef, useState } from 'react'
import { applyPick, pickForBot } from '@/lib/draftEngine'
import { Player, BotProfile } from '@/types'
import playersData from '@/data/players.json'
import { loadMock, saveMock, debounce } from '@/lib/api' // <-- NEW

type Panel = 'LOG' | 'ROSTER'
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
  const [panel, setPanel] = useState<Panel>('LOG')

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

  const players = playersData as Player[]

  /* ---------- derived ---------- */
  const available = useMemo(() => {
    const taken = state?.taken ?? new Set<string>()
    return players
      .filter(p => !taken.has(p.id))
      .sort((a, b) => a.adp - b.adp)
  }, [players, state])

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

  function makePick(teamIndex: number, player: Player, rd: number, ov: number, who: string) {
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

    // bot pick
    const profile = effectiveProfile(currentSeat)
    const choice = pickForBot(settings, state, profile, round, currentTeam) ?? available[0]
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

        {/* Event Log / Roster */}
        <Card>
          <CardHeader
            title={panel === 'LOG' ? 'Event Log' : 'Roster'}
            action={
              <div className="flex gap-2">
                <Button variant={panel === 'LOG' ? 'primary' : 'outline'} onClick={() => setPanel('LOG')}>Event Log</Button>
                <Button variant={panel === 'ROSTER' ? 'primary' : 'outline'} onClick={() => setPanel('ROSTER')}>Roster</Button>
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
              <RosterView state={state} humanIndex={humanIndex} />
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
  const data = (playersData as Player[]).find(p => p.id === playerId)
  if (!data) return null
  return (
    <div className="truncate">
      <div className="font-medium">{data.name}</div>
      <div className="text-[10px] text-slate-500">{data.pos}</div>
    </div>
  )
}

/* ===================== Players Table ===================== */
function PlayersTable({
  rows,
  disabled,
  onPick
}:{
  rows: Player[]
  disabled: boolean
  onPick: (p: Player) => void
}) {
  return (
    <div className="overflow-auto max-h-[420px]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 z-10">
          <tr className="text-left">
            <th className="px-3 py-2 w-10">RK</th>
            <th className="px-3 py-2">Player</th>
            <th className="px-3 py-2 w-16">Pos</th>
            <th className="px-3 py-2 w-16">ADP</th>
            <th className="px-3 py-2 w-24 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.id} className="border-b border-slate-100">
              <td className="px-3 py-2 text-slate-500">{i + 1}</td>
              <td className="px-3 py-2">{p.name}</td>
              <td className="px-3 py-2">{p.pos}</td>
              <td className="px-3 py-2">{p.adp}</td>
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
              <td colSpan={5} className="px-3 py-6 text-center text-slate-500">No players match your filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ===================== Roster panel (human) ===================== */
function RosterView({ state, humanIndex }: { state: any, humanIndex: number | null }) {
  const { settings } = useUI()
  if (humanIndex == null) return <div className="text-sm text-slate-600">Claim a seat to see your roster.</div>
  if (!state) return null
  const req = settings.roster

  type Slot = { key:string; label:string; filled?: Player }
  const slots: Slot[] = []
  const add = (k: keyof typeof req, label?:string) => {
    for (let i = 0; i < (req as any)[k]; i++) slots.push({ key: k, label: label ?? k })
  }
  add('QB'); add('RB'); add('WR'); add('TE'); add('FLEX'); add('K'); add('DST'); add('BENCH','Bench')

  const teamPicks = (state.picks as any[])
    .filter((p) => p.teamIndex === humanIndex)
    .sort((a,b) => a.overall - b.overall)
    .map(p => (playersData as Player[]).find(pp => pp.id === p.playerId))
    .filter(Boolean) as Player[]

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
    <div className="space-y-3 max-h-[420px] overflow-auto">
      {slots.map((s, idx) => (
        <div key={idx} className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2">
          <div className="flex items-center gap-3">
            <span className={`w-10 text-center text-xs font-semibold text-white rounded ${colorFor(s.key)}`}>{s.label}</span>
            {s.filled ? (
              <div>
                <div className="text-sm font-medium">{s.filled.name}</div>
                <div className="text-[11px] text-slate-500">{s.filled.pos}</div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">Empty</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

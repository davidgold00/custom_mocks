import { Card, CardBody, CardHeader, Button } from '@/components/Card'
import { useUI } from '@/store'
import { useEffect, useMemo, useRef, useState } from 'react'
import { applyPick, pickForBot } from '@/lib/draftEngine'
import { Player, BotProfile } from '@/types'
import players from '@/data/players.json'
import Modal from '@/components/Modal'

type Panel = 'LOG' | 'ROSTER'

export default function DraftRoom() {
  const { settings, bots, draft, initDraft, humanIndex, setHumanIndex, pickTimer, globalBot } = useUI()

  const [running, setRunning] = useState(false)
  const [round, setRound] = useState(1)
  const [overall, setOverall] = useState(1)
  const [log, setLog] = useState<string[]>([])
  const [state, setState] = useState(draft)
  const [panel, setPanel] = useState<Panel>('LOG')

  // human pick modal state
  const [waitingForHuman, setWaitingForHuman] =
    useState<null | { teamIndex: number; round: number; overall: number }>(null)
  const [timeLeft, setTimeLeft] = useState<number>(pickTimer)
  const [resumeAfterHuman, setResumeAfterHuman] = useState(false)

  // modal search/filter
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST'>('ALL')

  // keep state in sync with store draft
  useEffect(() => {
    setState(draft ?? null)
  }, [draft])

  // If team count/rounds changed vs current draft, re-init on load
  useEffect(() => {
    if (!state || (state.rosters?.length ?? 0) !== settings.teams) {
      initDraft()
      setRound(1)
      setOverall(1)
      setRunning(false)
      setWaitingForHuman(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.teams, settings.rounds])

  // available player pool (sorted by ADP)
  const pool = useMemo(
    () => (players as Player[]).filter(p => !state?.taken.has(p.id)).sort((a, b) => a.adp - b.adp),
    [state]
  )

  const filteredPool = useMemo(() => {
    const s = search.toLowerCase()
    return pool.filter(p => (filter === 'ALL' || p.pos === filter) && (!s || p.name.toLowerCase().includes(s)))
  }, [pool, search, filter])

  const intervalRef = useRef<number | null>(null)

  function guardReady(): boolean {
    if ((state?.picks.length ?? 0) === 0 && humanIndex == null) {
      alert('Select your draft spot first: click a Claim button to choose your seat.')
      return false
    }
    if (!state) {
      initDraft()
      return false
    }
    return true
  }

  // merge seat with global defaults if inheritGlobal = true
  function effectiveProfile(seat: BotProfile): BotProfile {
    if (!seat.inheritGlobal) return seat
    const { name, isHuman, inheritGlobal, preset, favorites } = seat
    return { ...globalBot, name, isHuman, inheritGlobal, preset, favorites }
  }

  function nextPickOnce() {
    if (!state) return
    const pickIdxInRound = (overall - 1) % settings.teams
    const reverse = round % 2 === 0
    const teamIndex = reverse ? settings.teams - 1 - pickIdxInRound : pickIdxInRound
    const seat = bots[teamIndex]

    if (seat.isHuman) {
      // pause and open modal
      setResumeAfterHuman(running)
      setRunning(false)
      setWaitingForHuman({ teamIndex, round, overall })
      setTimeLeft(pickTimer)
      setSearch('')
      setFilter('ALL')
      return
    }

    const profile = effectiveProfile(seat)
    const chosen = pickForBot(settings, state, profile, round, teamIndex) ?? pool[0]
    if (!chosen) return
    makePick(teamIndex, chosen, round, overall, seat.name)
  }

  function makePick(teamIndex: number, player: Player, rd: number, ov: number, who: string) {
    if (!state) return
    applyPick(state, teamIndex, player, rd, ov) // mutates in place
    setState({ ...state, picks: [...state.picks] }) // force re-render
    setLog(l => [`Pick ${ov}: Team ${teamIndex + 1} (${who}) → ${player.name} (${player.pos})`, ...l])

    const nextOverall = ov + 1
    const nextRound = Math.ceil(nextOverall / settings.teams)
    setOverall(nextOverall)
    setRound(nextRound)
  }

  // loop while running
  useEffect(() => {
    if (!running) return
    intervalRef.current = window.setInterval(() => {
      nextPickOnce()
    }, 400)
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, state, overall, round, bots, settings])

  // human timer + autopick
  useEffect(() => {
    if (!waitingForHuman) return
    if (timeLeft <= 0) {
      const chosen = filteredPool[0] ?? pool[0]
      if (chosen) {
        makePick(waitingForHuman.teamIndex, chosen, waitingForHuman.round, waitingForHuman.overall, 'You (Auto)')
      }
      setWaitingForHuman(null)
      if (resumeAfterHuman) {
        setResumeAfterHuman(false)
        setRunning(true)
      }
      return
    }
    const t = window.setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => window.clearTimeout(t)
  }, [timeLeft, waitingForHuman, filteredPool, pool, resumeAfterHuman])

  // controls
  function handleStart() {
    if (!guardReady()) return
    setRunning(true)
  }
  function handleStep() {
    if (!guardReady()) return
    nextPickOnce()
  }
  function handlePause() {
    setRunning(false)
  }
  function handleStopReset() {
    if (!window.confirm('Are you sure? This will reset the draft.')) return
    // reset without changing your claimed seat
    setLog([])
    setOverall(1)
    setRound(1)
    initDraft()
    setWaitingForHuman(null)
    setResumeAfterHuman(false)
    setRunning(false)
  }

  // Close modal should pause and clear countdown
  function closeHumanModal() {
    setWaitingForHuman(null)
    setRunning(false)
    setResumeAfterHuman(false)
    setTimeLeft(pickTimer)
  }

  const complete = state && state.picks.length >= settings.rounds * settings.teams

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader
          title={`Draft Board — Round ${round}`}
          action={
            <div className="flex gap-2">
              <Button onClick={handleStart} variant="primary">{running ? 'Running…' : 'Start'}</Button>
              <Button onClick={handleStep} variant="outline">Step</Button>
              <Button onClick={handlePause} variant="ghost">Pause</Button>
              <Button onClick={handleStopReset} variant="ghost">Stop Draft</Button>
            </div>
          }
        />
        <CardBody>
          <Board
            state={state}
            teams={settings.teams}
            rounds={settings.rounds}
            humanIndex={humanIndex}
            running={running}
            setHumanIndex={(i: number) => setHumanIndex(i)}
          />
          {(!state?.picks.length && humanIndex == null) && (
            <div className="mt-3 text-xs text-slate-600">
              Tip: Click a <b>Claim</b> button above to choose your draft spot, then press <b>Start</b>.
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={panel === 'LOG' ? 'Event Log' : 'Roster'}
          action={
            <div className="flex gap-2">
              <Button variant={panel === 'LOG' ? 'primary' : 'outline'} onClick={()=>setPanel('LOG')}>Event Log</Button>
              <Button variant={panel === 'ROSTER' ? 'primary' : 'outline'} onClick={()=>setPanel('ROSTER')}>Roster</Button>
            </div>
          }
        />
        <CardBody>
          {panel === 'LOG' ? (
            <>
              <div className="text-xs text-slate-500 mb-3">{state?.picks.length ?? 0} picks</div>
              <ul className="text-xs space-y-2 max-h-[520px] overflow-auto">
                {log.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
              {complete && <div className="pt-3">
                <a href="/results" className="text-indigo-600 underline">View Results</a>
              </div>}
            </>
          ) : (
            <RosterView state={state} humanIndex={humanIndex} />
          )}
        </CardBody>
      </Card>

      {/* Modal: no Stop button inside */}
      <Modal open={!!waitingForHuman} title={`Your Pick — ${timeLeft}s left`} onClose={closeHumanModal}>
        <div className="mb-2 flex gap-2">
          <input
            className="border rounded px-2 py-1 text-sm w-full"
            placeholder="Search player…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filter}
            onChange={e => setFilter(e.target.value as any)}
          >
            <option value="ALL">All</option>
            <option value="QB">QB</option>
            <option value="RB">RB</option>
            <option value="WR">WR</option>
            <option value="TE">TE</option>
            <option value="K">K</option>
            <option value="DST">DST</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 max-h-[420px] overflow-auto">
          {filteredPool.map(p => (
            <Button
              key={p.id}
              variant="outline"
              onClick={() => {
                if (!waitingForHuman) return
                makePick(waitingForHuman.teamIndex, p, waitingForHuman.round, waitingForHuman.overall, 'You')
                setWaitingForHuman(null)
                if (resumeAfterHuman) {
                  setResumeAfterHuman(false)
                  setRunning(true)
                }
              }}
            >
              {p.name} <span className="text-xs text-slate-500">({p.pos})</span>
            </Button>
          ))}
          {filteredPool.length === 0 && (
            <div className="text-xs text-slate-500 col-span-2">No players match your filters.</div>
          )}
        </div>
      </Modal>
    </div>
  )
}

/** ===== Board with “Claim” buttons (switchable until draft starts) ===== */
function Board({
  state, teams, rounds, humanIndex, running, setHumanIndex
}:{
  state:any, teams:number, rounds:number, humanIndex:number|null, running:boolean, setHumanIndex:(i:number)=>void
}) {
  const grid = Array.from({ length: rounds }, (_, r) =>
    Array.from({ length: teams }, (_, c) => ({ r: r + 1, c }))
  )

  // show Claim while NOT running and no picks made (can switch freely)
  const noPicks = (state?.picks.length ?? 0) === 0
  const showClaim = !running && noPicks

  return (
    <div className="overflow-auto">
      <div className="min-w-[720px]">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${teams + 1}, minmax(0, 1fr))` }}>
          <div></div>
          {Array.from({ length: teams }, (_, i) => (
            <div key={i} className="px-2 py-1 text-xs font-semibold text-center">
              {showClaim ? (
                <div className="flex flex-col items-center gap-1">
                  <button
                    className={`px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition ${humanIndex===i ? 'ring-2 ring-emerald-300' : ''}`}
                    onClick={() => setHumanIndex(i)}
                    title="Claim this draft spot"
                  >
                    Claim
                  </button>
                  <span className="text-[10px] text-slate-500">1.{i + 1}</span>
                </div>
              ) : (
                <div className={`${humanIndex===i?'bg-indigo-600 text-white rounded':''}`}>
                  Team {i + 1} {humanIndex === i && '(You)'}
                </div>
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
                  <div key={`${cell.r}-${cell.c}`} className="border border-slate-200 h-14 rounded-md m-1 px-2 py-1 text-xs">
                    {playerId ? <Picked playerId={playerId} /> : <span className="text-slate-400">—</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** ===== Roster panel (human team) ===== */
function RosterView({ state, humanIndex }:{ state:any, humanIndex:number|null }) {
  const { settings } = useUI()
  if (humanIndex == null) {
    return <div className="text-sm text-slate-600">Claim a seat to see your roster.</div>
  }
  if (!state) return null

  // Build required slots from league settings
  const req = settings.roster
  type Slot = { key:string; label:string; filled?: Player }
  const slots: Slot[] = []
  const add = (k: keyof typeof req, label?:string) => {
    for (let i = 0; i < (req as any)[k]; i++) slots.push({ key: k, label: label ?? k })
  }
  add('QB'); add('RB'); add('WR'); add('TE'); add('FLEX'); add('K'); add('DST'); add('BENCH','Bench')

  // Players picked by human (in pick order)
  const teamPicks = (state.picks as any[])
    .filter(p => p.teamIndex === humanIndex)
    .sort((a,b) => a.overall - b.overall)
    .map(p => (players as Player[]).find(pp => pp.id === p.playerId))
    .filter(Boolean) as Player[]

  // Greedy assignment to primary -> FLEX (RB/WR/TE) -> BENCH
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
    <div className="space-y-3 max-h-[520px] overflow-auto">
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

function Picked({ playerId }: { playerId: string }) {
  const data = (players as Player[]).find(p => p.id === playerId)
  if (!data) return null
  return (
    <div className="truncate">
      <div className="font-medium">{data.name}</div>
      <div className="text-[10px] text-slate-500">NA • {data.pos}</div>
    </div>
  )
}

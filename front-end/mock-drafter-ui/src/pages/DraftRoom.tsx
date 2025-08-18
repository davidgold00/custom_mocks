import { Card, CardBody, CardHeader, Button } from '@/components/Card'
import { useUI } from '@/store'
import { useEffect, useMemo, useRef, useState } from 'react'
import { applyPick, pickForBot } from '@/lib/draftEngine'
import { Player } from '@/types'
import players from '@/data/players.json'

export default function DraftRoom() {
  const { settings, bots, draft, initDraft } = useUI()
  const [running, setRunning] = useState(false)
  const [round, setRound] = useState(1)
  const [overall, setOverall] = useState(1)
  const [log, setLog] = useState<string[]>([])

  const [state, setState] = useState(draft)
  const pool = useMemo(() => (players as Player[]).filter(p => !state?.taken.has(p.id)), [state])

  useEffect(() => {
    if (!draft) {
      initDraft()
    } else {
      setState(draft)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const timer = useRef<number | null>(null)

  function nextPickOnce() {
    if (!state) return
    const pickIdxInRound = (overall-1) % settings.teams
    const reverse = (round % 2 === 0)
    const teamIndex = reverse ? (settings.teams - 1 - pickIdxInRound) : pickIdxInRound
    const bot = bots[teamIndex]

    let chosen: Player | null = null
    if (bot.isHuman) {
      // For MVP: humans auto-pick best available (you can pause and change bot/human on Bots page)
      chosen = pool[0]
    } else {
      const profile = bot.inheritGlobal ? { ...bot, ...({}) } : bot
      chosen = pickForBot(settings, state, profile, round, teamIndex) ?? pool[0]
    }
    if (!chosen) return

    applyPick(state, teamIndex, chosen, round, overall)
    setState({ ...state, picks: [...state.picks] })
    setLog(l => [`Pick ${overall}: Team ${teamIndex+1} → ${chosen.name} (${chosen.pos})`, ...l])

    const nextOverall = overall + 1
    const nextRound = Math.ceil(nextOverall / settings.teams)
    setOverall(nextOverall)
    setRound(nextRound)
  }

  useEffect(() => {
    if (!running) return
    timer.current = window.setInterval(() => {
      nextPickOnce()
    }, 250)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, state, overall, round, bots, settings])

  function reset() {
    setLog([])
    setOverall(1)
    setRound(1)
    initDraft()
  }

  const complete = state && state.picks.length >= settings.rounds * settings.teams

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader title={`Draft Board — Round ${round}`} action={
          <div className="flex gap-2">
            <Button onClick={()=>setRunning(!running)} variant="primary">{running ? 'Pause' : 'Start'}</Button>
            <Button onClick={()=>nextPickOnce()} variant="outline">Step</Button>
            <Button onClick={reset} variant="ghost">Reset</Button>
          </div>
        } />
        <CardBody>
          <Board state={state} teams={settings.teams} rounds={settings.rounds} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Event Log" action={<span className="text-xs text-slate-500">{state?.picks.length ?? 0} picks</span>} />
        <CardBody>
          <ul className="text-xs space-y-2 max-h-[520px] overflow-auto">
            {log.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
          {complete && <div className="pt-3">
            <a href="/results" className="text-indigo-600 underline">View Results</a>
          </div>}
        </CardBody>
      </Card>
    </div>
  )
}

function Board({ state, teams, rounds }:{ state: any, teams: number, rounds: number }) {
  const grid = Array.from({length: rounds}, (_, r) =>
    Array.from({length: teams}, (_, c) => ({ r: r+1, c }))
  )
  return (
    <div className="overflow-auto">
      <div className="min-w-[720px]">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${teams+1}, minmax(0, 1fr))` }}>
          <div></div>
          {Array.from({length: teams}, (_, i) => (
            <div key={i} className="px-2 py-1 text-xs font-semibold text-center">Team {i+1}</div>
          ))}
          {grid.map((row, i) => (
            <>
              <div key={`r${i}`} className="px-2 py-1 text-xs font-semibold text-right">R{i+1}</div>
              {row.map(cell => {
                const pick = state?.picks.find((p: any) => p.round === cell.r && ((p.overall-1)%teams) === cell.c && (cell.r % 2 === 1 || (cell.r % 2 === 0 && (teams - 1 - ((p.overall-1)%teams)) === cell.c)))
                const playerId = pick?.playerId
                return <div key={`${cell.r}-${cell.c}`} className="border border-slate-200 h-14 rounded-md m-1 px-2 py-1 text-xs">
                  {playerId ? <Picked playerId={playerId} /> : <span className="text-slate-400">—</span>}
                </div>
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  )
}

function Picked({ playerId }: { playerId: string }) {
  const data = (players as Player[]).find(p => p.id === playerId)
  if (!data) return null
  return <div className="truncate">
    <div className="font-medium">{data.name}</div>
    <div className="text-[10px] text-slate-500">{data.team} • {data.pos}</div>
  </div>
}

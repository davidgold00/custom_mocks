import { Card, CardBody, CardHeader, Button } from '@/components/Card'
import { useUI } from '@/store'
import players from '@/data/players.json'
import { Player } from '@/types'
import { useMemo } from 'react'

export default function Results() {
  const { draft, settings, bots } = useUI()
  const rosters = draft?.rosters ?? []
  const playerMap = useMemo(() => Object.fromEntries((players as Player[]).map(p => [p.id, p])), [])

  function exportJson() {
    const out = rosters.map((r, i) => ({
      team: i+1,
      manager: bots[i].isHuman ? 'Human' : bots[i].name,
      players: r.picks.map(pid => playerMap[pid]?.name ?? pid)
    }))
    const blob = new Blob([JSON.stringify({ settings, teams: out }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mock-results.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Team Rosters" action={<Button variant="primary" onClick={exportJson}>Export JSON</Button>} />
        <CardBody>
          <div className="grid md:grid-cols-2 gap-4">
            {rosters.map((r, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="font-semibold mb-2">Team {i+1} <span className="text-xs text-slate-500">({bots[i].isHuman ? 'Human' : 'Bot'})</span></div>
                <ul className="text-sm space-y-1">
                  {r.picks.map(pid => <li key={pid}>{playerMap[pid]?.name} <span className="text-xs text-slate-500">({playerMap[pid]?.pos})</span></li>)}
                </ul>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

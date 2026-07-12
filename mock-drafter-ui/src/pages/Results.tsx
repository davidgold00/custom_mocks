import { Card, CardBody, CardHeader, Button } from '@/components/Card'
import { PosBadge } from '@/components/PosBadge'
import { useUI } from '@/store'
import { usePlayerMap } from '@/lib/rankings'
import { Download } from 'lucide-react'

export default function Results() {
  const { draft, settings, bots } = useUI()
  const PLAYER_MAP = usePlayerMap()
  const rosters = draft?.rosters ?? []

  function exportJson() {
    const out = rosters.map((r, i) => ({
      team: i + 1,
      manager: bots[i]?.isHuman ? 'Human' : bots[i]?.name ?? `Team ${i + 1}`,
      players: r.picks.map((pid) => {
        const p = PLAYER_MAP[pid]
        return p ? { name: p.name, pos: p.pos, team: p.team, bye: p.bye } : { name: pid }
      }),
    }))
    const blob = new Blob([JSON.stringify({ settings, teams: out }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'boardroom-results.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (rosters.length === 0 || rosters.every((r) => r.picks.length === 0)) {
    return (
      <Card>
        <CardBody className="py-16 text-center text-slate-500">
          No draft results yet — run a mock from the Draft Room first.
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Draft Results</h2>
        <Button variant="primary" onClick={exportJson}>
          <Download className="w-4 h-4 mr-2" /> Export JSON
        </Button>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rosters.map((r, i) => (
          <Card key={i}>
            <CardHeader
              title={
                <span className="text-sm">
                  {bots[i]?.name ?? `Team ${i + 1}`}
                  {bots[i]?.isHuman && (
                    <span className="ml-2 rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[11px] font-semibold">You</span>
                  )}
                </span>
              }
            />
            <CardBody className="p-0">
              <ul className="divide-y divide-slate-100">
                {r.picks.map((pid, j) => {
                  const p = PLAYER_MAP[pid]
                  if (!p) return null
                  return (
                    <li key={pid} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <span className="w-5 text-xs text-slate-400 text-right">{j + 1}</span>
                      <PosBadge pos={p.pos} />
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-auto text-xs text-slate-400">{p.team}</span>
                    </li>
                  )
                })}
              </ul>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}

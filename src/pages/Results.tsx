import { useState } from 'react'
import { Card, CardBody, CardHeader, Button } from '@/components/Card'
import { PosBadge } from '@/components/PosBadge'
import { useUI } from '@/store'
import { usePlayerMap } from '@/lib/rankings'
import { useAuth } from '@/lib/authStore'
import { api, trySync, type FullDraft } from '@/lib/userApi'
import { Download, History, Trash2, X } from 'lucide-react'

export default function Results() {
  const { draft, settings, bots } = useUI()
  const PLAYER_MAP = usePlayerMap()
  const { drafts, removeDraftMeta } = useAuth()
  const [viewing, setViewing] = useState<FullDraft | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // what's on screen: a loaded past draft, or the current one
  const shown = viewing
    ? {
        title: viewing.name,
        teams: viewing.teams.map((t) => ({ name: t.name, isHuman: t.isHuman })),
        rosters: viewing.teams.map((_, i) =>
          viewing.picks.filter((p) => p.teamIndex === i).sort((a, b) => a.overall - b.overall).map((p) => p.playerId),
        ),
        settings: viewing.settings,
      }
    : {
        title: 'Draft Results',
        teams: bots.map((b, i) => ({ name: b.name || `Team ${i + 1}`, isHuman: b.isHuman })),
        rosters: (draft?.rosters ?? []).map((r) => r.picks),
        settings,
      }

  const hasContent = shown.rosters.some((r) => r.length > 0)

  function exportJson() {
    const out = shown.rosters.map((picks, i) => ({
      team: i + 1,
      manager: shown.teams[i]?.name ?? `Team ${i + 1}`,
      players: picks.map((pid) => {
        const p = PLAYER_MAP[pid]
        return p ? { name: p.name, pos: p.pos, team: p.team, bye: p.bye } : { name: pid }
      }),
    }))
    const blob = new Blob([JSON.stringify({ settings: shown.settings, teams: out }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'boardroom-results.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function view(id: string) {
    setLoadingId(id)
    try {
      setViewing(await api.getDraft(id))
    } catch {
      /* toast-worthy; keep quiet for now */
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight inline-flex items-center gap-3">
          {shown.title}
          {viewing && (
            <button
              type="button"
              onClick={() => setViewing(null)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              <X className="w-3.5 h-3.5" /> back to current
            </button>
          )}
        </h2>
        {hasContent && (
          <Button variant="primary" onClick={exportJson}>
            <Download className="w-4 h-4 mr-2" /> Export JSON
          </Button>
        )}
      </div>

      {hasContent ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.rosters.map((picks, i) => (
            <Card key={i}>
              <CardHeader
                title={
                  <span className="text-sm">
                    {shown.teams[i]?.name ?? `Team ${i + 1}`}
                    {shown.teams[i]?.isHuman && (
                      <span className="ml-2 rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[11px] font-semibold">You</span>
                    )}
                  </span>
                }
              />
              <CardBody className="p-0">
                <ul className="divide-y divide-slate-100">
                  {picks.map((pid, j) => {
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
      ) : (
        <Card>
          <CardBody className="py-12 text-center text-slate-500">
            No draft results yet. Run a mock from the Draft Room first.
          </CardBody>
        </Card>
      )}

      {/* past drafts */}
      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><History className="w-4 h-4 text-slate-400" /> Past drafts</span>} />
        <CardBody className="p-0">
          {drafts.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">
              Completed drafts are saved to your account automatically and will show up here.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {drafts.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(d.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="outline" onClick={() => void view(d.id)} disabled={loadingId === d.id}>
                      {loadingId === d.id ? 'Loading…' : 'View'}
                    </Button>
                    <button
                      type="button"
                      title="Delete draft"
                      className="p-1.5 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50"
                      onClick={() => {
                        if (!window.confirm(`Delete "${d.name}"?`)) return
                        removeDraftMeta(d.id)
                        if (viewing?.id === d.id) setViewing(null)
                        trySync(api.deleteDraft(d.id))
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

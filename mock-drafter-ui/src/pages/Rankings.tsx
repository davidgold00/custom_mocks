import { useMemo, useRef, useState } from 'react'
import { Card, CardBody, CardHeader, Button, Input, Select } from '@/components/Card'
import { PosBadge, InjuryBadge } from '@/components/PosBadge'
import { useUI } from '@/store'
import { buildBoard, useBoard, SOURCES, SEASON, DATA_UPDATED } from '@/lib/rankings'
import type { Position, RankedPlayer } from '@/types'
import { ArrowDown, ArrowUp, CheckCircle2, GripVertical, RotateCcw, Database } from 'lucide-react'

const POS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'] as const

export default function Rankings() {
  const { rankings, setBaseSource, setCustomOrder, resetCustomOrder } = useUI()
  const board = useBoard()

  const [search, setSearch] = useState('')
  const [pos, setPos] = useState<(typeof POS)[number]>('ALL')
  const dragFrom = useRef<number | null>(null)

  // where each player sits in the untouched base source (for showing your edits)
  const sourceRank = useMemo(() => {
    const m = new Map<string, number>()
    buildBoard(rankings.baseSourceId, null).forEach((p) => m.set(p.id, p.rank))
    return m
  }, [rankings.baseSourceId])

  const edited = rankings.customOrder !== null
  const editedCount = useMemo(
    () => (edited ? board.filter((p) => sourceRank.get(p.id) !== p.rank).length : 0),
    [board, sourceRank, edited],
  )

  const filtering = search.trim() !== '' || pos !== 'ALL'
  const visible = useMemo(() => {
    const s = search.trim().toLowerCase()
    return board.filter(
      (p) => (pos === 'ALL' || p.pos === pos) && (!s || p.name.toLowerCase().includes(s)),
    )
  }, [board, search, pos])

  /* ---------- reorder operations (always on the full board) ---------- */

  function commit(order: string[]) {
    setCustomOrder(order)
  }

  function moveTo(playerId: string, targetRank: number) {
    const order = board.map((p) => p.id)
    const from = order.indexOf(playerId)
    if (from < 0) return
    const to = Math.min(Math.max(targetRank - 1, 0), order.length - 1)
    if (to === from) return
    order.splice(from, 1)
    order.splice(to, 0, playerId)
    commit(order)
  }

  function nudge(playerId: string, dir: -1 | 1) {
    const rank = board.find((p) => p.id === playerId)?.rank
    if (rank) moveTo(playerId, rank + dir)
  }

  function switchSource(id: string) {
    if (id === rankings.baseSourceId) return
    if (edited && !window.confirm('Switching the base source discards your edits. Continue?')) return
    setBaseSource(id)
  }

  function reset() {
    if (edited && !window.confirm('Discard all your ranking edits?')) return
    resetCustomOrder()
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{SEASON} Player Rankings</h2>
          <p className="text-sm text-slate-500 mt-1">
            Pick a public ranking as your base, then drag players to build your own board.
            Bots draft off this board.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 text-xs font-medium">
          <Database className="w-3.5 h-3.5" />
          Live {SEASON} data · updated {DATA_UPDATED.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      {/* source picker */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SOURCES.map((s) => {
          const active = s.id === rankings.baseSourceId
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => switchSource(s.id)}
              className={`text-left rounded-2xl border p-4 transition ${
                active
                  ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {s.kind}
                </span>
                {active && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
              </div>
              <div className="font-semibold text-sm mt-1">{s.label}</div>
              <div className="text-xs text-slate-500 mt-1">{s.detail}</div>
              <div className="text-[11px] text-slate-400 mt-2">
                {s.provider} · {s.coverage} players ranked
              </div>
            </button>
          )
        })}
      </div>

      {/* board */}
      <Card>
        <CardHeader
          title={
            <span>
              Your Board
              {edited && (
                <span className="ml-2 text-xs font-medium text-indigo-600">
                  {editedCount} player{editedCount === 1 ? '' : 's'} moved
                </span>
              )}
            </span>
          }
          action={
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search player…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-44"
              />
              <Select value={pos} onChange={(e) => setPos(e.target.value as any)}>
                {POS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
              <Button variant="outline" onClick={reset} disabled={!edited}>
                <RotateCcw className="w-4 h-4 mr-1.5" /> Reset
              </Button>
            </div>
          }
        />
        <CardBody className="p-0">
          {filtering && (
            <div className="px-4 py-2 text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
              Drag-to-reorder is disabled while filtering — use the arrows or edit the rank number.
            </div>
          )}
          <div className="overflow-auto max-h-[62vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 z-10 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 w-16">Rank</th>
                  <th className="px-2 py-2.5 w-8"></th>
                  <th className="px-3 py-2.5">Player</th>
                  <th className="px-3 py-2.5 w-14">Pos</th>
                  <th className="px-3 py-2.5 w-16">Bye</th>
                  <th className="px-3 py-2.5 w-20">ADP</th>
                  <th className="px-3 py-2.5 w-24">Your move</th>
                  <th className="px-3 py-2.5 w-24 text-right">Reorder</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <Row
                    key={p.id}
                    p={p}
                    baseRank={sourceRank.get(p.id)}
                    draggable={!filtering}
                    onDragStart={() => { dragFrom.current = p.rank }}
                    onDrop={() => {
                      if (dragFrom.current != null && dragFrom.current !== p.rank) {
                        const id = board[dragFrom.current - 1]?.id
                        if (id) moveTo(id, p.rank)
                      }
                      dragFrom.current = null
                    }}
                    onMoveTo={(r) => moveTo(p.id, r)}
                    onNudge={(d) => nudge(p.id, d)}
                  />
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                      No players match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

function Row({
  p, baseRank, draggable, onDragStart, onDrop, onMoveTo, onNudge,
}: {
  p: RankedPlayer
  baseRank?: number
  draggable: boolean
  onDragStart: () => void
  onDrop: () => void
  onMoveTo: (rank: number) => void
  onNudge: (dir: -1 | 1) => void
}) {
  const delta = baseRank != null ? baseRank - p.rank : 0
  return (
    <tr
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="border-b border-slate-100 hover:bg-slate-50/70 bg-white"
    >
      <td className="px-3 py-1.5">
        <RankInput rank={p.rank} onCommit={onMoveTo} />
      </td>
      <td className="px-2 py-1.5 text-slate-300">
        {draggable && <GripVertical className="w-4 h-4 cursor-grab" />}
      </td>
      <td className="px-3 py-1.5">
        <span className="font-medium">{p.name}</span>
        <InjuryBadge status={p.injuryStatus} />
        <span className="ml-2 text-xs text-slate-400">{p.team}</span>
      </td>
      <td className="px-3 py-1.5"><PosBadge pos={p.pos} /></td>
      <td className="px-3 py-1.5 text-slate-500">{p.bye ?? '—'}</td>
      <td className="px-3 py-1.5 text-slate-500">{p.adp ?? '—'}</td>
      <td className="px-3 py-1.5">
        {delta !== 0 && (
          <span className={`text-xs font-semibold ${delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {delta > 0 ? `▲ ${delta}` : `▼ ${-delta}`}
          </span>
        )}
      </td>
      <td className="px-3 py-1.5">
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => onNudge(-1)}
            className="p-1 rounded hover:bg-slate-200 text-slate-500"
            title="Move up"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onNudge(1)}
            className="p-1 rounded hover:bg-slate-200 text-slate-500"
            title="Move down"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

/** Click the rank to type a new one — fastest way to make big moves */
function RankInput({ rank, onCommit }: { rank: number; onCommit: (r: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(rank))

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setVal(String(rank)); setEditing(true) }}
        className="w-10 text-left font-semibold text-slate-600 hover:text-indigo-600"
        title="Click to set a new rank"
      >
        {rank}
      </button>
    )
  }
  const commit = () => {
    setEditing(false)
    const n = parseInt(val, 10)
    if (!Number.isNaN(n) && n !== rank) onCommit(n)
  }
  return (
    <input
      autoFocus
      value={val}
      onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setEditing(false)
      }}
      className="w-12 rounded border border-indigo-300 px-1 py-0.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
    />
  )
}

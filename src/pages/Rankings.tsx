import { useMemo, useRef, useState } from 'react'
import { Card, CardBody, CardHeader, Button, Input } from '@/components/Card'
import { PosBadge, InjuryBadge, RookieBadge } from '@/components/PosBadge'
import { ImportRankingsModal } from '@/components/ImportRankings'
import { useUI } from '@/store'
import { buildBoard, useBoard, useDataset, useSources, USER_SOURCE_PREFIX } from '@/lib/rankings'
import { useData } from '@/lib/dataStore'
import type { Position, RankedPlayer, SourceFormat } from '@/types'
import {
  ArrowDown, ArrowUp, CheckCircle2, GripVertical, RotateCcw,
  RefreshCw, Upload, Trash2, FileSpreadsheet,
} from 'lucide-react'

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DST']
const FORMATS: { id: SourceFormat | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'PPR', label: 'PPR' },
  { id: 'HALF', label: 'Half PPR' },
  { id: 'STD', label: 'Standard' },
  { id: 'SF', label: 'Superflex' },
]

export default function Rankings() {
  const { rankings, setBaseSource, setCustomOrder, resetCustomOrder, library, deleteRanking } = useUI()
  const dataset = useDataset()
  const sources = useSources()
  const board = useBoard()
  const { refreshing, refreshError, refresh } = useData()

  const [format, setFormat] = useState<SourceFormat | 'ALL'>('ALL')
  const [rookiesOnly, setRookiesOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [posSel, setPosSel] = useState<Set<Position>>(new Set())
  const [importing, setImporting] = useState(false)
  const dragFrom = useRef<number | null>(null)

  const visibleSources = useMemo(
    () => sources.filter((s) => format === 'ALL' || s.format === format || s.format === 'ANY'),
    [sources, format],
  )

  // where each player sits in the untouched base (for showing your edits)
  const sourceRank = useMemo(() => {
    const m = new Map<string, number>()
    buildBoard(dataset, library.rankings, rankings.baseSourceId, null).forEach((p) => m.set(p.id, p.rank))
    return m
  }, [dataset, library.rankings, rankings.baseSourceId])

  const edited = rankings.customOrder !== null
  const editedCount = useMemo(
    () => (edited ? board.filter((p) => sourceRank.get(p.id) !== p.rank).length : 0),
    [board, sourceRank, edited],
  )

  const filtering = search.trim() !== '' || posSel.size > 0 || rookiesOnly
  const visible = useMemo(() => {
    const s = search.trim().toLowerCase()
    return board.filter(
      (p) =>
        (!rookiesOnly || p.rookie) &&
        (posSel.size === 0 || posSel.has(p.pos)) &&
        (!s || p.name.toLowerCase().includes(s)),
    )
  }, [board, search, posSel, rookiesOnly])

  function togglePos(p: Position) {
    setPosSel((prev) => {
      const next = new Set(prev)
      next.has(p) ? next.delete(p) : next.add(p)
      return next
    })
  }

  /* ---------- reorder operations (always on the full board) ---------- */

  function moveTo(playerId: string, targetRank: number) {
    const order = board.map((p) => p.id)
    const from = order.indexOf(playerId)
    if (from < 0) return
    const to = Math.min(Math.max(targetRank - 1, 0), order.length - 1)
    if (to === from) return
    order.splice(from, 1)
    order.splice(to, 0, playerId)
    setCustomOrder(order)
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

  const updated = new Date(dataset.fetchedAt)

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{dataset.season} Player Rankings</h2>
          <p className="text-sm text-slate-500 mt-1">
            Pick a base, reshape it, or import your own. Bots draft off this board.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            Updated {updated.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
            {updated.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </span>
          <Button variant="outline" onClick={() => refresh(true)} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh data'}
          </Button>
          <Button variant="primary" onClick={() => setImporting(true)}>
            <Upload className="w-4 h-4 mr-1.5" /> Import
          </Button>
        </div>
      </div>

      {refreshError && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2">
          Refresh failed: {refreshError} — showing the last good data instead.
        </div>
      )}

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFormat(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              format === f.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={() => setRookiesOnly((v) => !v)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
            rookiesOnly ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          Rookies only
        </button>
      </div>

      {/* source picker */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {visibleSources.map((s) => {
          const active = s.id === rankings.baseSourceId
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => switchSource(s.id)}
              className={`text-left rounded-xl border p-3 transition ${
                active
                  ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 truncate">
                  {s.kind}{s.dynasty && ' · Dynasty'}
                </span>
                {active && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />}
              </div>
              <div className="font-semibold text-[13px] mt-0.5 leading-tight">{s.label}</div>
              <div className="text-[11px] text-slate-500 mt-1 truncate" title={s.detail}>{s.detail}</div>
              <div className="text-[10px] text-slate-400 mt-1">
                {s.provider} · {s.coverage} players · data{' '}
                {new Date(s.asOf ?? dataset.fetchedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
            </button>
          )
        })}

        {/* user imports */}
        {library.rankings.map((r) => {
          const id = USER_SOURCE_PREFIX + r.id
          const active = id === rankings.baseSourceId
          return (
            <div
              key={id}
              className={`relative text-left rounded-xl border p-3 transition cursor-pointer ${
                active
                  ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
              onClick={() => switchSource(id)}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500 inline-flex items-center gap-1">
                  <FileSpreadsheet className="w-3 h-3" /> Your import
                </span>
                {active && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />}
              </div>
              <div className="font-semibold text-[13px] mt-0.5 leading-tight">{r.name}</div>
              <div className="text-[10px] text-slate-400 mt-1">
                {r.order.length} players · {new Date(r.createdAt).toLocaleDateString()}
              </div>
              <button
                type="button"
                title="Delete import"
                className="absolute bottom-2 right-2 p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50"
                onClick={(e) => {
                  e.stopPropagation()
                  if (window.confirm(`Delete "${r.name}"?`)) deleteRanking(r.id)
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
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
                className="w-40"
              />
              <div className="flex items-center gap-1">
                {POSITIONS.map((p) => {
                  const on = posSel.has(p)
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePos(p)}
                      title={on ? `Hide ${p}` : `Show only selected positions`}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold transition ${
                        on
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
                {posSel.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setPosSel(new Set())}
                    className="px-1.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600"
                    title="Clear position filter"
                  >
                    ✕
                  </button>
                )}
              </div>
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

      {importing && <ImportRankingsModal onClose={() => setImporting(false)} />}
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
        <RookieBadge rookie={p.rookie} />
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
          <button type="button" onClick={() => onNudge(-1)} className="p-1 rounded hover:bg-slate-200 text-slate-500" title="Move up">
            <ArrowUp className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => onNudge(1)} className="p-1 rounded hover:bg-slate-200 text-slate-500" title="Move down">
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

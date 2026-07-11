import type { Position } from '@/types'

export const POS_COLORS: Record<Position, string> = {
  QB: 'bg-sky-100 text-sky-700',
  RB: 'bg-emerald-100 text-emerald-700',
  WR: 'bg-indigo-100 text-indigo-700',
  TE: 'bg-amber-100 text-amber-700',
  K: 'bg-fuchsia-100 text-fuchsia-700',
  DST: 'bg-slate-200 text-slate-700',
}

export const POS_SOLID: Record<Position, string> = {
  QB: 'bg-sky-500',
  RB: 'bg-emerald-500',
  WR: 'bg-indigo-500',
  TE: 'bg-amber-500',
  K: 'bg-fuchsia-500',
  DST: 'bg-slate-600',
}

export function PosBadge({ pos }: { pos: Position }) {
  return (
    <span className={`inline-flex w-11 justify-center rounded-md px-1.5 py-0.5 text-[11px] font-bold ${POS_COLORS[pos]}`}>
      {pos}
    </span>
  )
}

export function InjuryBadge({ status }: { status?: string | null }) {
  if (!status || status === 'ACTIVE') return null
  const short =
    status === 'QUESTIONABLE' ? 'Q' :
    status === 'DOUBTFUL' ? 'D' :
    status === 'OUT' ? 'O' :
    status === 'INJURY_RESERVE' ? 'IR' :
    status === 'SUSPENSION' ? 'SUS' : status.slice(0, 3)
  return (
    <span
      title={status}
      className="ml-1.5 inline-flex items-center rounded px-1 py-px text-[10px] font-bold bg-rose-100 text-rose-700"
    >
      {short}
    </span>
  )
}

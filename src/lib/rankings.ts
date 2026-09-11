import { useMemo } from 'react'
import type { Player, RankedPlayer, RankingSourceMeta, SavedRanking } from '@/types'
import { useUI } from '@/store'
import { useData, type RankingsDataset } from '@/lib/dataStore'

export const USER_SOURCE_PREFIX = 'user:'

export function useDataset(): RankingsDataset {
  return useData((s) => s.dataset)
}

export function usePlayerMap(): Record<string, Player> {
  return useData((s) => s.dataset.players)
}

export function useSources(): RankingSourceMeta[] {
  const dataset = useDataset()
  return useMemo(() => dataset.sources.map(({ ranks: _r, ...meta }) => meta), [dataset])
}

/** Resolve the base ordering for a source id (public source or saved user import). */
function baseOrder(
  dataset: RankingsDataset,
  savedRankings: SavedRanking[],
  sourceId: string,
): { ids: string[]; adpById: Map<string, { adp: number | null; stdev?: number }> } {
  const adpById = new Map<string, { adp: number | null; stdev?: number }>()

  if (sourceId.startsWith(USER_SOURCE_PREFIX)) {
    const saved = savedRankings.find((r) => USER_SOURCE_PREFIX + r.id === sourceId)
    if (saved) {
      // reference ADP for context comes from the first market-ADP source
      const ref = dataset.sources.find((s) => s.kind === 'Market ADP') ?? dataset.sources[0]
      for (const r of ref?.ranks ?? []) adpById.set(r.id, { adp: r.adp })
      return { ids: saved.order.filter((id) => dataset.players[id]), adpById }
    }
  }
  const src = dataset.sources.find((s) => s.id === sourceId) ?? dataset.sources[0]
  for (const r of src.ranks) adpById.set(r.id, { adp: r.adp, stdev: r.stdev })
  return { ids: src.ranks.map((r) => r.id), adpById }
}

/** Build a full board: base source order + user's custom re-ordering + fallback padding. */
export function buildBoard(
  dataset: RankingsDataset,
  savedRankings: SavedRanking[],
  sourceId: string,
  customOrder: string[] | null,
): RankedPlayer[] {
  const { ids: srcIds, adpById } = baseOrder(dataset, savedRankings, sourceId)

  const seen = new Set<string>()
  const ordered: string[] = []
  const push = (id: string) => {
    if (!seen.has(id) && dataset.players[id]) { seen.add(id); ordered.push(id) }
  }
  if (customOrder?.length) customOrder.forEach(push)
  srcIds.forEach(push)
  dataset.fallbackOrder.forEach(push) // full pool so drafts never run dry

  return ordered.map((id, i) => {
    const r = adpById.get(id)
    return { ...dataset.players[id], rank: i + 1, adp: r?.adp ?? null, stdev: r?.stdev ?? null }
  })
}

/** The user's active board, derived from persisted prefs + live dataset. */
export function useBoard(): RankedPlayer[] {
  const dataset = useDataset()
  const rankings = useUI((s) => s.rankings)
  const savedRankings = useUI((s) => s.library.rankings)
  return useMemo(
    () => buildBoard(dataset, savedRankings, rankings.baseSourceId, rankings.customOrder),
    [dataset, savedRankings, rankings],
  )
}

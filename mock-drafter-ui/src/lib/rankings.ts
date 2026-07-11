import { useMemo } from 'react'
import dataset from '@/data/rankings-2026.json'
import type { Player, RankedPlayer, RankingSourceMeta } from '@/types'
import { useUI } from '@/store'

interface SourceRank {
  id: string
  adp: number | null
  stdev?: number
  padded?: boolean
}

interface RankingsDataset {
  season: number
  fetchedAt: string
  playerCount: number
  players: Record<string, Player>
  sources: (RankingSourceMeta & { ranks: SourceRank[] })[]
}

export const DATA = dataset as unknown as RankingsDataset

export const SEASON = DATA.season
export const DATA_UPDATED = new Date(DATA.fetchedAt)
export const PLAYER_MAP: Record<string, Player> = DATA.players

export const SOURCES: RankingSourceMeta[] = DATA.sources.map(
  ({ ranks: _ranks, ...meta }) => meta,
)

export const DEFAULT_SOURCE_ID = DATA.sources[0]?.id ?? 'ffc-ppr'

function getSource(sourceId: string) {
  return DATA.sources.find((s) => s.id === sourceId) ?? DATA.sources[0]
}

/**
 * Build the active draft board: the chosen public source's order, with the
 * user's custom re-ordering applied on top when present. Always returns the
 * full player pool so drafts never run dry.
 */
export function buildBoard(baseSourceId: string, customOrder: string[] | null): RankedPlayer[] {
  const source = getSource(baseSourceId)
  const rankById = new Map(source.ranks.map((r) => [r.id, r]))

  let orderedIds: string[]
  if (customOrder && customOrder.length > 0) {
    const seen = new Set<string>()
    orderedIds = customOrder.filter((id) => {
      if (seen.has(id) || !PLAYER_MAP[id]) return false
      seen.add(id)
      return true
    })
    // players added by a newer data refresh keep their source position at the end
    for (const r of source.ranks) if (!seen.has(r.id)) orderedIds.push(r.id)
  } else {
    orderedIds = source.ranks.map((r) => r.id)
  }

  return orderedIds.map((id, i) => {
    const p = PLAYER_MAP[id]
    const r = rankById.get(id)
    return {
      ...p,
      rank: i + 1,
      adp: r?.adp ?? null,
      stdev: r?.stdev ?? null,
    }
  })
}

/** The user's active board, derived from persisted rankings prefs. */
export function useBoard(): RankedPlayer[] {
  const rankings = useUI((s) => s.rankings)
  return useMemo(
    () => buildBoard(rankings.baseSourceId, rankings.customOrder),
    [rankings],
  )
}

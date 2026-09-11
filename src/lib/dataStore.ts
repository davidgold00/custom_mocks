import { create } from 'zustand'
import bundled from '@/data/rankings-2026.json'
import type { Player, RankingSourceMeta } from '@/types'

export interface SourceRank { id: string; adp: number | null; stdev?: number }
export interface RankingsDataset {
  season: number
  fetchedAt: string
  playerCount: number
  players: Record<string, Player>
  fallbackOrder: string[]
  sources: (RankingSourceMeta & { ranks: SourceRank[] })[]
}

const CACHE_KEY = 'md-dataset-v2'
const AUTO_REFRESH_MS = 20 * 60 * 60 * 1000 // refresh when a day old (rankings move with news)

function loadCached(): RankingsDataset | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as RankingsDataset
    return d?.sources?.length ? d : null
  } catch {
    return null
  }
}

function newest(a: RankingsDataset, b: RankingsDataset | null): RankingsDataset {
  if (!b) return a
  return new Date(a.fetchedAt) >= new Date(b.fetchedAt) ? a : b
}

type DataState = {
  dataset: RankingsDataset
  refreshing: boolean
  refreshError: string | null
  /** fetch latest from /api/rankings; force bypasses the server cache */
  refresh: (force?: boolean) => Promise<void>
  /** called once on app mount: kicks off a quiet daily refresh if stale */
  autoRefresh: () => void
}

export const useData = create<DataState>((set, get) => ({
  dataset: newest(bundled as unknown as RankingsDataset, loadCached()),
  refreshing: false,
  refreshError: null,

  refresh: async (force = false) => {
    if (get().refreshing) return
    set({ refreshing: true, refreshError: null })
    try {
      const res = await fetch(`/api/rankings${force ? '?force=1' : ''}`)
      const data = (await res.json()) as RankingsDataset & { error?: string }
      if (!res.ok || data.error || !data.sources?.length) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* quota exceeded, skip cache */ }
      set({ dataset: data, refreshing: false })
    } catch (e) {
      set({
        refreshing: false,
        refreshError: e instanceof Error ? e.message : 'Refresh failed',
      })
    }
  },

  autoRefresh: () => {
    const age = Date.now() - new Date(get().dataset.fetchedAt).getTime()
    if (age > AUTO_REFRESH_MS) void get().refresh()
  },
}))

import type { BotProfile, LeagueSettings, Pick, RankingsPrefs, SavedBotConfig, SavedRanking } from '@/types'

/** Thin client for the /api/me endpoints. Cookies ride along automatically. */

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

export interface UserPrefs {
  settings: LeagueSettings
  rankings: RankingsPrefs
  bots: BotProfile[]
  globalBot: BotProfile
}

export interface DraftMeta { id: string; name: string; createdAt: string }
export interface FullDraft extends DraftMeta {
  settings: LeagueSettings
  teams: { name: string; isHuman: boolean }[]
  picks: Pick[]
}

export interface LibraryPayload {
  prefs: UserPrefs | null
  botConfigs: SavedBotConfig[]
  rankings: SavedRanking[]
  drafts: DraftMeta[]
}

export const api = {
  library: () => req<LibraryPayload>('/api/me/library'),
  putPrefs: (prefs: UserPrefs) => req('/api/me/prefs', { method: 'PUT', body: JSON.stringify(prefs) }),

  saveBotConfig: (c: SavedBotConfig) =>
    req('/api/me/bot-configs', { method: 'POST', body: JSON.stringify(c) }),
  deleteBotConfig: (id: string) => req(`/api/me/bot-configs?id=${id}`, { method: 'DELETE' }),

  saveRanking: (r: SavedRanking) => req('/api/me/rankings', { method: 'POST', body: JSON.stringify(r) }),
  deleteRanking: (id: string) => req(`/api/me/rankings?id=${id}`, { method: 'DELETE' }),

  saveDraft: (d: { name: string; settings: LeagueSettings; teams: { name: string; isHuman: boolean }[]; picks: Pick[] }) =>
    req<{ id: string; name: string }>('/api/me/drafts', { method: 'POST', body: JSON.stringify(d) }),
  getDraft: (id: string) => req<FullDraft>(`/api/me/drafts?id=${id}`),
  deleteDraft: (id: string) => req(`/api/me/drafts?id=${id}`, { method: 'DELETE' }),
}

/** fire-and-forget wrapper for background sync writes */
export const trySync = (p: Promise<unknown>) =>
  void p.catch((e) => console.warn('[sync]', e instanceof Error ? e.message : e))

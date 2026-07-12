import { create } from 'zustand'
import { useUI } from '@/store'
import { api, trySync, type DraftMeta, type UserPrefs } from '@/lib/userApi'

type AuthStatus = 'loading' | 'authed' | 'anon'
export interface AuthUser { id: string; username: string }

type AuthState = {
  status: AuthStatus
  user: AuthUser | null
  error: string | null
  drafts: DraftMeta[]
  init: () => Promise<void>
  signup: (username: string, password: string) => Promise<boolean>
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  addDraftMeta: (d: DraftMeta) => void
  removeDraftMeta: (id: string) => void
}

async function authReq(path: string, body: object): Promise<{ user?: AuthUser; error?: string }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json().catch(() => ({ error: 'Server unreachable.' })) as Promise<{ user?: AuthUser; error?: string }>
}

/**
 * After sign-in: server data wins; a fresh account inherits whatever was on
 * this device (one-time migration of pre-account local state).
 */
async function hydrateFromServer(set: (p: Partial<AuthState>) => void) {
  const lib = await api.library()
  const ui = useUI.getState()

  if (lib.prefs) {
    useUI.setState({
      settings: lib.prefs.settings,
      rankings: lib.prefs.rankings,
      bots: lib.prefs.bots,
      globalBot: lib.prefs.globalBot,
    })
  } else {
    trySync(api.putPrefs(currentPrefs()))
  }

  if (lib.rankings.length || lib.botConfigs.length) {
    useUI.setState({ library: { rankings: lib.rankings, botConfigs: lib.botConfigs } })
  } else {
    for (const r of ui.library.rankings) trySync(api.saveRanking(r))
    for (const c of ui.library.botConfigs) trySync(api.saveBotConfig(c))
  }

  set({ drafts: lib.drafts })
  startPrefsSync()
}

const currentPrefs = (): UserPrefs => {
  const s = useUI.getState()
  return { settings: s.settings, rankings: s.rankings, bots: s.bots, globalBot: s.globalBot }
}

/* debounced push of working state (settings, board prefs, bot sliders) */
let unsubPrefs: (() => void) | null = null
let prefsTimer: number | undefined
function startPrefsSync() {
  if (unsubPrefs) return
  unsubPrefs = useUI.subscribe(() => {
    window.clearTimeout(prefsTimer)
    prefsTimer = window.setTimeout(() => {
      if (useAuth.getState().status === 'authed') trySync(api.putPrefs(currentPrefs()))
    }, 1500)
  })
}
function stopPrefsSync() {
  unsubPrefs?.()
  unsubPrefs = null
  window.clearTimeout(prefsTimer)
}

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  error: null,
  drafts: [],

  init: async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) throw new Error()
      const { user } = (await res.json()) as { user: AuthUser }
      set({ status: 'authed', user })
      await hydrateFromServer(set)
    } catch {
      set({ status: 'anon', user: null })
    }
  },

  signup: async (username, password) => {
    set({ error: null })
    const data = await authReq('/api/auth/signup', { username, password })
    if (!data.user) {
      set({ error: data.error ?? 'Sign up failed.' })
      return false
    }
    set({ status: 'authed', user: data.user })
    await hydrateFromServer(set)
    return true
  },

  login: async (username, password) => {
    set({ error: null })
    const data = await authReq('/api/auth/login', { username, password })
    if (!data.user) {
      set({ error: data.error ?? 'Login failed.' })
      return false
    }
    set({ status: 'authed', user: data.user })
    await hydrateFromServer(set)
    return true
  },

  logout: async () => {
    stopPrefsSync()
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    set({ status: 'anon', user: null, drafts: [] })
  },

  addDraftMeta: (d) => set((s) => ({ drafts: [d, ...s.drafts] })),
  removeDraftMeta: (id) => set((s) => ({ drafts: s.drafts.filter((x) => x.id !== id) })),
}))

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  BotProfile,
  DraftState,
  LeagueSettings,
  Position,
  Preset,
  RankingsPrefs,
  RosterRequirements,
  SavedBotConfig,
  SavedRanking,
} from '@/types'
import { PRESET_VALUES } from '@/lib/presets'
import { api, trySync } from '@/lib/userApi'

/* ---------------------- defaults ---------------------- */

const DEFAULT_ROSTER: RosterRequirements = {
  QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, K: 1, DST: 1, BENCH: 5,
}

// keep rounds simple; you can recompute elsewhere if you like
const DEFAULT_SETTINGS: LeagueSettings = {
  teams: 10,        // <— requested: default to 10
  rounds: 15,
  roster: DEFAULT_ROSTER,
  snake: true,
}

const makeEmptyByPos = (): Record<Position, number> =>
  ({ QB:0, RB:0, WR:0, TE:0, K:0, DST:0 })

const makeBot = (name: string): BotProfile => ({
  name,
  isHuman: false,
  inheritGlobal: true,
  preset: 'Balanced',

  // NEW fields fully defaulted
  qbMode: 'PRIORITY',
  qbEarliestRound: 6,

  qbPriority: 50,
  rbEmphasis: 0,
  wrEmphasis: 0,
  teEmphasis: 0,
  teamNeedsSensitivity: 60,
  riskTolerance: 40,
  randomness: 10,
  avoidKdUntil: 12,
  favorites: [],
})

const DEFAULT_GLOBAL_BOT: BotProfile = {
  name: 'Global Defaults',
  isHuman: false,
  inheritGlobal: false,
  preset: 'Balanced',
  qbMode: 'PRIORITY',
  qbEarliestRound: 6,
  qbPriority: 50,
  rbEmphasis: 0,
  wrEmphasis: 0,
  teEmphasis: 0,
  teamNeedsSensitivity: 60,
  riskTolerance: 40,
  randomness: 10,
  avoidKdUntil: 12,
  favorites: [],
}

/* ---------------------- helpers ---------------------- */

const migrateBot = (b: Partial<BotProfile>): BotProfile => ({
  name: b.name ?? 'Team',
  isHuman: b.isHuman ?? false,
  inheritGlobal: b.inheritGlobal ?? true,
  preset: b.preset ?? 'Balanced',
  qbMode: (b as any).qbMode ?? 'PRIORITY',
  qbEarliestRound: (b as any).qbEarliestRound ?? 6,
  qbPriority: b.qbPriority ?? 50,
  rbEmphasis: b.rbEmphasis ?? 0,
  wrEmphasis: b.wrEmphasis ?? 0,
  teEmphasis: b.teEmphasis ?? 0,
  teamNeedsSensitivity: b.teamNeedsSensitivity ?? 60,
  riskTolerance: b.riskTolerance ?? 40,
  randomness: b.randomness ?? 10,
  avoidKdUntil: b.avoidKdUntil ?? 12,
  favorites: b.favorites ?? [],
})

const makeDraft = (settings: LeagueSettings): DraftState => {
  const teams = settings.teams
  const order = Array.from({ length: teams }, (_, i) => i)
  return {
    order,
    currentPickIndex: 0,
    picks: [],
    taken: new Set<string>(),
    rosters: Array.from({ length: teams }, () => ({
      picks: [],
      byPos: makeEmptyByPos(),
    })),
    seed: (Math.random() * 0x7fffffff) | 0,
  }
}

const DEFAULT_RANKINGS: RankingsPrefs = {
  baseSourceId: 'ffc-ppr',
  customOrder: null,
  updatedAt: null,
}

type Library = { rankings: SavedRanking[]; botConfigs: SavedBotConfig[] }
const EMPTY_LIBRARY: Library = { rankings: [], botConfigs: [] }
const genId = () => Math.random().toString(36).slice(2, 10)

/* ---------------------- store ---------------------- */

type UIState = {
  settings: LeagueSettings
  bots: BotProfile[]
  globalBot: BotProfile
  draft: DraftState | null
  humanIndex: number | null
  pickTimer: number
  rankings: RankingsPrefs
  library: Library

  // rankings management
  setBaseSource: (id: string) => void
  setCustomOrder: (order: string[]) => void
  resetCustomOrder: () => void

  // library (saved imports + bot setups)
  saveRanking: (name: string, order: string[], note?: string) => SavedRanking
  deleteRanking: (id: string) => void
  saveBotConfig: (name: string) => void
  applyBotConfig: (id: string) => void
  deleteBotConfig: (id: string) => void

  // settings management
  setSettings: (p: Partial<LeagueSettings>) => void

  // bot mgmt
  setGlobalBot: (p: Partial<BotProfile>) => void
  setBot: (i: number, p: Partial<BotProfile>) => void
  setHuman: (i: number, isHuman: boolean) => void
  applyPreset: (i: number, preset: Preset) => void

  // draft mgmt
  initDraft: () => void
  setHumanIndex: (i: number | null) => void
}

export const useUI = create<UIState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      bots: Array.from({ length: DEFAULT_SETTINGS.teams }, (_, i) => makeBot(`Team ${i + 1}`)),
      globalBot: DEFAULT_GLOBAL_BOT,
      draft: null,
      humanIndex: null,
      pickTimer: 60,
      rankings: DEFAULT_RANKINGS,
      library: EMPTY_LIBRARY,

      setBaseSource: (id) =>
        set({ rankings: { baseSourceId: id, customOrder: null, updatedAt: null } }),

      setCustomOrder: (order) =>
        set((s) => ({
          rankings: { ...s.rankings, customOrder: order, updatedAt: new Date().toISOString() },
        })),

      resetCustomOrder: () =>
        set((s) => ({
          rankings: { ...s.rankings, customOrder: null, updatedAt: null },
        })),

      saveRanking: (name, order, note) => {
        const saved: SavedRanking = { id: genId(), name, order, note, createdAt: new Date().toISOString() }
        set((s) => ({ library: { ...s.library, rankings: [...s.library.rankings, saved] } }))
        trySync(api.saveRanking(saved))
        return saved
      },

      deleteRanking: (id) => {
        set((s) => {
          const library = { ...s.library, rankings: s.library.rankings.filter((r) => r.id !== id) }
          // if the deleted import was the active base, fall back to the default source
          const rankings = s.rankings.baseSourceId === `user:${id}` ? DEFAULT_RANKINGS : s.rankings
          return { library, rankings }
        })
        trySync(api.deleteRanking(id))
      },

      saveBotConfig: (name) =>
        set((s) => {
          const saved = {
            id: genId(), name, createdAt: new Date().toISOString(),
            teams: s.settings.teams, bots: s.bots, globalBot: s.globalBot,
          }
          trySync(api.saveBotConfig(saved))
          return { library: { ...s.library, botConfigs: [...s.library.botConfigs, saved] } }
        }),

      applyBotConfig: (id) =>
        set((s) => {
          const c = s.library.botConfigs.find((b) => b.id === id)
          if (!c) return {}
          return {
            settings: { ...s.settings, teams: c.teams },
            bots: c.bots.map((b) => migrateBot(b)),
            globalBot: migrateBot(c.globalBot),
          }
        }),

      deleteBotConfig: (id) => {
        set((s) => ({
          library: { ...s.library, botConfigs: s.library.botConfigs.filter((b) => b.id !== id) },
        }))
        trySync(api.deleteBotConfig(id))
      },

      setSettings: (p) => {
        const prev = get().settings
        const next = { ...prev, ...p }
        // if teams changed, resize bots
        if (p.teams && p.teams !== prev.teams) {
          const bots = [...get().bots]
          if (p.teams > bots.length) {
            for (let i = bots.length; i < p.teams; i++) bots.push(makeBot(`Team ${i + 1}`))
          } else {
            bots.length = p.teams
          }
          set({ settings: next, bots })
        } else {
          set({ settings: next })
        }
      },

      setGlobalBot: (patch) => {
        set({ globalBot: { ...get().globalBot, ...patch } })
      },

      setBot: (i, patch) => {
        set((s) => {
          const bots = [...s.bots]
          bots[i] = migrateBot({ ...bots[i], ...patch })
          return { bots }
        })
      },

      setHuman: (i, isHuman) => {
        set((s) => {
          const bots = [...s.bots]
          bots[i] = { ...bots[i], isHuman }
          return { bots }
        })
      },

      applyPreset: (i, preset) => {
        set((s) => {
          const bots = [...s.bots]
          // presets materialize real slider values so they actually change behavior
          bots[i] = migrateBot({ ...bots[i], preset, ...PRESET_VALUES[preset] })
          return { bots }
        })
      },

      initDraft: () => {
        const d = makeDraft(get().settings)
        set({ draft: d })
      },

      setHumanIndex: (i) => set({ humanIndex: i }),
    }),
    {
      // legacy storage key — changing it would wipe users' saved bots/rankings
      name: 'mockdrafter-ui',
      version: 3,
      migrate: (state: any) => {
        if (!state) return state
        if (state.bots) state.bots = state.bots.map((b: any) => migrateBot(b))
        if (state.globalBot) state.globalBot = migrateBot(state.globalBot)
        if (!state.rankings) state.rankings = DEFAULT_RANKINGS
        if (!state.library) state.library = EMPTY_LIBRARY
        return state
      },
      partialize: (s) => ({
        settings: s.settings,
        bots: s.bots,
        globalBot: s.globalBot,
        rankings: s.rankings,
        library: s.library,
      }),
    }
  )
)

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  BotProfile,
  DraftState,
  LeagueSettings,
  Position,
  Preset,
  RosterRequirements,
} from '@/types'

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
  }
}

/* ---------------------- store ---------------------- */

type UIState = {
  settings: LeagueSettings
  bots: BotProfile[]
  globalBot: BotProfile
  draft: DraftState | null
  humanIndex: number | null
  pickTimer: number

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
          bots[i] = { ...bots[i], preset }
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
      name: 'mockdrafter-ui',
      version: 2,
      // migrate old saves to include qb fields + new team default respected on fresh loads
      migrate: (state: any) => {
        if (!state) return state
        if (state.bots) state.bots = state.bots.map((b: any) => migrateBot(b))
        if (state.globalBot) state.globalBot = migrateBot(state.globalBot)
        return state
      },
      partialize: (s) => ({
        settings: s.settings,
        bots: s.bots,
        globalBot: s.globalBot,
      }),
    }
  )
)

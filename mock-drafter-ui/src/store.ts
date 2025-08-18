import { create } from 'zustand'
import { BotProfile, DraftState, LeagueSettings, Preset } from '@/types'
import { initDraftState } from '@/lib/draftEngine'

function defaultRoster() {
  return { QB:1, RB:2, WR:3, TE:1, FLEX:1, K:1, DST:1, BENCH:5 }
}

export interface UIState {
  settings: LeagueSettings
  globalBot: BotProfile
  bots: BotProfile[]
  draft: DraftState | null
  humanIndex: number | null
  pickTimer: number
  setSettings: (p: Partial<LeagueSettings>) => void
  setGlobalBot: (p: Partial<BotProfile>) => void
  setBot: (i: number, p: Partial<BotProfile>) => void
  setHuman: (i: number, isHuman: boolean) => void
  applyPreset: (i: number, preset: Preset) => void
  initDraft: () => void
  resetDraft: () => void
  setHumanIndex: (i: number | null) => void
  setPickTimer: (s: number) => void
}

function makeBot(name: string): BotProfile {
  return {
    name,
    isHuman: false,
    inheritGlobal: true,
    preset: 'Balanced',
    qbPriority: 50,
    rbEmphasis: 0,
    wrEmphasis: 0,
    teEmphasis: 0,
    teamNeedsSensitivity: 60,
    riskTolerance: 40,
    randomness: 10,
    avoidKdUntil: 14,
    favorites: [],
  }
}

function presetToProfile(preset: Preset, base: BotProfile): BotProfile {
  const b = { ...base, preset }
  switch (preset) {
    case 'Balanced':
      return { ...b, qbPriority: 50, rbEmphasis: 0, wrEmphasis: 0, teEmphasis: 0, teamNeedsSensitivity: 60, riskTolerance: 40, randomness: 8, avoidKdUntil: 14 }
    case 'EarlyQB':
      return { ...b, qbPriority: 95, rbEmphasis: 5, wrEmphasis: 0, teEmphasis: 0, teamNeedsSensitivity: 60, riskTolerance: 45, randomness: 8, avoidKdUntil: 14 }
    case 'LateQB':
      return { ...b, qbPriority: 5, rbEmphasis: 10, wrEmphasis: 0, teEmphasis: 0, teamNeedsSensitivity: 70, riskTolerance: 35, randomness: 8, avoidKdUntil: 14 }
    case 'RBHeavy':
      return { ...b, qbPriority: 35, rbEmphasis: 30, wrEmphasis: -10, teEmphasis: 0, teamNeedsSensitivity: 70, riskTolerance: 40, randomness: 8, avoidKdUntil: 14 }
    case 'ZeroRB':
      return { ...b, qbPriority: 45, rbEmphasis: -30, wrEmphasis: 20, teEmphasis: 10, teamNeedsSensitivity: 55, riskTolerance: 50, randomness: 10, avoidKdUntil: 14 }
    case 'ZeroWR':
      return { ...b, qbPriority: 40, rbEmphasis: 25, wrEmphasis: -25, teEmphasis: 10, teamNeedsSensitivity: 65, riskTolerance: 40, randomness: 8, avoidKdUntil: 14 }
    case 'Chaotic':
      return { ...b, qbPriority: 60, rbEmphasis: 10, wrEmphasis: 10, teEmphasis: 0, teamNeedsSensitivity: 30, riskTolerance: 80, randomness: 30, avoidKdUntil: 15 }
    case 'AutoBPA':
      return { ...b, qbPriority: 45, rbEmphasis: 0, wrEmphasis: 0, teEmphasis: 0, teamNeedsSensitivity: 40, riskTolerance: 10, randomness: 0, avoidKdUntil: 14 }
    default:
      return b
  }
}

export const useUI = create<UIState>((set, get) => ({
  settings: {
    teams: 8,
    rounds: 14,
    roster: defaultRoster(),
    snake: true,
  },
  globalBot: makeBot('Global Default'),
  bots: Array.from({ length: 8 }, (_, i) => makeBot(`Team ${i + 1}`)),
  draft: null,
  humanIndex: null,
  pickTimer: 20, // seconds

  setSettings: (p) =>
    set((state) => {
      const next = { ...state.settings, ...p }
      // resize bots to match teams
      let bots = [...state.bots]
      if (p.teams && p.teams !== state.bots.length) {
        if (p.teams > state.bots.length) {
          for (let i = state.bots.length; i < p.teams; i++) bots.push(makeBot(`Team ${i + 1}`))
        } else {
          bots = bots.slice(0, p.teams)
        }
      }
      // reset humanIndex if out of range
      const humanIndex = state.humanIndex != null && p.teams && state.humanIndex >= p.teams ? null : state.humanIndex
      return { settings: next, bots, humanIndex }
    }),

  setGlobalBot: (p) => set((state) => ({ globalBot: { ...state.globalBot, ...p } })),

  setBot: (i, p) =>
    set((state) => {
      const bots = [...state.bots]
      bots[i] = { ...bots[i], ...p }
      return { bots }
    }),

  setHuman: (i, isHuman) =>
    set((state) => {
      const bots = [...state.bots]
      bots[i] = { ...bots[i], isHuman }
      return { bots }
    }),

  applyPreset: (i, preset) =>
    set((state) => {
      const bots = [...state.bots]
      bots[i] = presetToProfile(preset, bots[i])
      return { bots }
    }),

  initDraft: () =>
    set((state) => ({
      draft: initDraftState(state.settings),
    })),

  resetDraft: () => set({ draft: null }),

  setHumanIndex: (i) =>
    set((state) => {
      const bots = [...state.bots]
      bots.forEach((b, j) => {
        b.isHuman = i != null && j === i
      })
      return { humanIndex: i, bots }
    }),

  setPickTimer: (s) => set({ pickTimer: s }),
}))

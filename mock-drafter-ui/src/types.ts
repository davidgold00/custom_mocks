export type Position = 'QB'|'RB'|'WR'|'TE'|'K'|'DST'

/** Canonical player record from the bundled 2026 data snapshot */
export interface Player {
  id: string
  name: string
  team: string
  pos: Position
  bye: number | null
  injuryStatus?: string | null
}

/** A player placed on a ranking board (user's or a source's) */
export interface RankedPlayer extends Player {
  rank: number
  adp: number | null
  stdev?: number | null
}

export interface RankingSourceMeta {
  id: string
  label: string
  provider: string
  kind: string
  detail: string
  coverage: number
}

/** User's active board: which public source it's based on + their edits */
export interface RankingsPrefs {
  baseSourceId: string
  /** full player-id ordering once the user edits; null = follow source as-is */
  customOrder: string[] | null
  updatedAt: string | null
}

export interface RosterRequirements {
  QB: number
  RB: number
  WR: number
  TE: number
  FLEX: number
  K: number
  DST: number
  BENCH: number
}

export interface LeagueSettings {
  teams: number
  rounds: number
  roster: RosterRequirements
  snake: boolean
}

export type Preset =
  | 'Balanced'
  | 'EarlyQB'
  | 'LateQB'
  | 'RBHeavy'
  | 'ZeroRB'
  | 'ZeroWR'
  | 'Chaotic'
  | 'AutoBPA'

export interface BotProfile {
  name: string
  isHuman: boolean
  inheritGlobal: boolean
  preset: Preset

  /** QB strategy */
  qbMode: 'PRIORITY' | 'EARLIEST_ROUND'
  /** used when qbMode === 'PRIORITY' (0 = very late, 100 = very early) */
  qbPriority: number
  /** used when qbMode === 'EARLIEST_ROUND' (1..20) */
  qbEarliestRound: number

  /** Position emphasis (–50..+50) */
  rbEmphasis: number
  wrEmphasis: number
  teEmphasis: number

  /** Other knobs (0..100) */
  teamNeedsSensitivity: number
  riskTolerance: number
  randomness: number

  /** Earliest round to consider K/DST */
  avoidKdUntil: number

  favorites: string[]
}

export interface Pick {
  round: number
  overall: number
  teamIndex: number
  playerId: string
}

export interface TeamRoster {
  picks: string[] // player ids
  byPos: Record<Position, number>
}

export interface DraftState {
  order: number[] // team indices per pick within a round
  currentPickIndex: number
  picks: Pick[]
  taken: Set<string>
  rosters: TeamRoster[]
  /** RNG seed so a draft is replayable; every sim gets a fresh one */
  seed: number
}

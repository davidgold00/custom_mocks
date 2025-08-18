export type Position = 'QB'|'RB'|'WR'|'TE'|'K'|'DST'

export interface Player {
  id: string
  name: string
  team: string
  pos: Position
  adp: number
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
  qbPriority: number         // 0 (very late) -> 100 (very early)
  rbEmphasis: number         // -50 (de-emphasize) -> +50 (emphasize)
  wrEmphasis: number
  teEmphasis: number
  teamNeedsSensitivity: number  // 0 -> 100
  riskTolerance: number         // 0 -> 100
  randomness: number            // 0 -> 100
  avoidKdUntil: number          // earliest round to consider K/DST
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
}

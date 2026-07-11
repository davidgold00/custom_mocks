import type { BotProfile, Preset } from '@/types'

/**
 * Slider values each preset materializes into a bot profile.
 * Applying a preset overwrites these knobs; anything omitted is untouched.
 */
export const PRESET_VALUES: Record<Preset, Partial<BotProfile>> = {
  Balanced: {
    qbMode: 'PRIORITY', qbPriority: 50,
    rbEmphasis: 0, wrEmphasis: 0, teEmphasis: 0,
    teamNeedsSensitivity: 60, riskTolerance: 40, randomness: 15, avoidKdUntil: 12,
  },
  EarlyQB: { qbMode: 'PRIORITY', qbPriority: 90 },
  LateQB: { qbMode: 'EARLIEST_ROUND', qbEarliestRound: 10 },
  RBHeavy: { rbEmphasis: 30, wrEmphasis: -10 },
  ZeroRB: { rbEmphasis: -40, wrEmphasis: 25 },
  ZeroWR: { wrEmphasis: -40, rbEmphasis: 25 },
  Chaotic: { randomness: 85, riskTolerance: 85 },
  AutoBPA: { teamNeedsSensitivity: 10, randomness: 0, rbEmphasis: 0, wrEmphasis: 0, teEmphasis: 0 },
}

export const PRESET_DESCRIPTIONS: Record<Preset, string> = {
  Balanced: 'Follows the board with mild team-need awareness',
  EarlyQB: 'Grabs a top quarterback early',
  LateQB: 'Waits on QB until round 10+',
  RBHeavy: 'Hammers running backs in the early rounds',
  ZeroRB: 'Fades RBs early, loads up on WRs',
  ZeroWR: 'Fades WRs early, loads up on RBs',
  Chaotic: 'Unpredictable — reaches, sniping, chaos',
  AutoBPA: 'Strict best-player-available off the board',
}

import { BotProfile, DraftState, LeagueSettings, Player, Position, TeamRoster } from '@/types'
import rawPlayers from '@/data/players.json'

const ALL_PLAYERS: Player[] = (rawPlayers as Player[]).sort((a,b)=>a.adp-b.adp)

export function makeDefaultRoster(): TeamRoster {
  return { picks: [], byPos: { QB:0, RB:0, WR:0, TE:0, K:0, DST:0 } as any }
}

export function computeSnakeOrder(teams: number): number[] {
  // order for a single round: 0..teams-1, next round reverses
  return Array.from({length: teams}, (_, i) => i)
}

export function initDraftState(settings: LeagueSettings): DraftState {
  const rosters: TeamRoster[] = Array.from({length: settings.teams}, () => makeDefaultRoster())
  return {
    order: computeSnakeOrder(settings.teams),
    currentPickIndex: 0,
    picks: [],
    taken: new Set(),
    rosters,
  }
}

export function availablePlayers(taken: Set<string>): Player[] {
  return ALL_PLAYERS.filter(p => !taken.has(p.id))
}

type NeedMap = Record<Position, number>

function teamNeeds(settings: LeagueSettings, team: TeamRoster): NeedMap {
  const req = settings.roster
  const needs: NeedMap = { QB:0, RB:0, WR:0, TE:0, K:0, DST:0 }
  ;(['QB','RB','WR','TE','K','DST'] as Position[]).forEach(pos => {
    // starters needed minus already drafted at that position
    const required = (req as any)[pos] ?? 0
    needs[pos] = Math.max(0, required - (team.byPos as any)[pos])
  })
  // Flex handled loosely: if FLEX slots exist, add fractional needs to RB/WR/TE
  const flex = req.FLEX ?? 0
  if (flex > 0) {
    const minFlexTargets: Position[] = ['RB','WR','TE']
    minFlexTargets.forEach(pos => { needs[pos] += flex / 3 })
  }
  return needs
}

function earliestRoundAllowed(pos: Position, round: number, avoidKdUntil: number) {
  if ((pos === 'K' || pos === 'DST') && round < avoidKdUntil) return false
  return true
}

function posWeight(profile: BotProfile, pos: Position): number {
  switch (pos) {
    case 'RB': return 1 + profile.rbEmphasis/100
    case 'WR': return 1 + profile.wrEmphasis/100
    case 'TE': return 1 + profile.teEmphasis/100
    case 'QB': {
      // map qbPriority (0-100) into an early-round boost that fades later (handled in score calc)
      return 1 + (profile.qbPriority - 50) / 200 // small base tilt here
    }
    default: return 1
  }
}

function withinFavorites(profile: BotProfile, player: Player): boolean {
  return profile.favorites.some(f => f.toLowerCase() === player.name.toLowerCase())
}

function scoreCandidate(
  player: Player,
  settings: LeagueSettings,
  profile: BotProfile,
  round: number,
  needs: NeedMap,
  team: TeamRoster,
): number {
  // Base: inverse of ADP (lower ADP = higher score)
  let score = 1000 - player.adp

  // Deprioritize K/DST until allowed
  if (!earliestRoundAllowed(player.pos, round, profile.avoidKdUntil)) {
    score -= 10000
  }

  // Positional emphasis
  score *= posWeight(profile, player.pos)

  // Team needs urgency
  const need = (needs as any)[player.pos] ?? 0
  score += need * (profile.teamNeedsSensitivity / 10) // up to +10 per unmet slot

  // QB timing: if early priority and no QB yet, add boost in early rounds
  if (player.pos === 'QB' && team.byPos.QB === 0) {
    const earlyFactor = (profile.qbPriority / 100) // 0..1
    // Boost is bigger in rounds 1-4, fades later
    const roundBoost = Math.max(0, 6 - round) * 12
    score += earlyFactor * roundBoost
  }
  // Risk tolerance: allow reaching beyond top list
  score += (profile.riskTolerance - 50) // small nudge for aggressive bots

  // Favorites: strong bump within ~2 rounds of typical ADP
  if (withinFavorites(profile, player)) {
    const reachWindow = 24 // ~2 rounds in 12-team
    const delta = Math.max(0, reachWindow - Math.abs(player.adp - (round*12)))
    score += 40 + delta/3
  }

  // Tiny randomness
  const epsilon = (profile.randomness/100) * (Math.random()*10)
  score += epsilon

  return score
}

export function pickForBot(
  settings: LeagueSettings,
  state: DraftState,
  profile: BotProfile,
  round: number,
  teamIndex: number,
): Player | null {
  const pool = availablePlayers(state.taken)
  const team = state.rosters[teamIndex]
  const needs = teamNeeds(settings, team)

  // Consider top N + some reach window depending on risk
  const window = Math.min(pool.length, 40 + Math.floor(profile.riskTolerance/2))
  const candidates = pool.slice(0, window)

  let best: Player | null = null
  let bestScore = -1e9

  for (const p of candidates) {
    const s = scoreCandidate(p, settings, profile, round, needs, team)
    if (s > bestScore) {
      best = p
      bestScore = s
    }
  }
  return best
}

export function applyPick(state: DraftState, teamIndex: number, player: Player, round: number, overall: number) {
  state.taken.add(player.id)
  state.picks.push({ round, overall, teamIndex, playerId: player.id })
  const roster = state.rosters[teamIndex]
  roster.picks.push(player.id)
  ;(roster.byPos as any)[player.pos] = ((roster.byPos as any)[player.pos] ?? 0) + 1
}

export const SAMPLE_PLAYERS = ALL_PLAYERS

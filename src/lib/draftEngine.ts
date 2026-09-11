import type {
  RankedPlayer,
  BotProfile,
  LeagueSettings,
  DraftState,
  Position,
} from '@/types'

/** Deterministic RNG so a draft can be replayed from its seed */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Mutates the draft state in-place for a new pick */
export function applyPick(
  state: DraftState,
  teamIndex: number,
  player: RankedPlayer,
  round: number,
  overall: number
) {
  state.picks.push({
    round,
    overall,
    teamIndex,
    playerId: player.id,
  })

  if (!state.taken) (state as any).taken = new Set<string>()
  state.taken.add(player.id)

  if (state.rosters && state.rosters[teamIndex]) {
    const r = state.rosters[teamIndex]
    r.picks.push(player.id)
    r.byPos[player.pos] = (r.byPos[player.pos] ?? 0) + 1
  }
}

const EMPTY_COUNTS: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 }

function teamCounts(state: DraftState, teamIndex: number): Record<Position, number> {
  return state.rosters?.[teamIndex]?.byPos ?? { ...EMPTY_COUNTS }
}

const FLEX_ELIGIBLE = new Set<Position>(['RB', 'WR', 'TE'])

/** Unfilled starting slots (incl. FLEX), used to force-fill late in drafts */
function unfilledStarters(
  settings: LeagueSettings,
  counts: Record<Position, number>
): { total: number; needs: Set<Position>; flexOpen: boolean } {
  const { roster } = settings
  const needs = new Set<Position>()
  let total = 0
  for (const pos of ['QB', 'RB', 'WR', 'TE', 'K', 'DST'] as Position[]) {
    const n = Math.max(0, roster[pos] - counts[pos])
    if (n > 0) needs.add(pos)
    total += n
  }
  // flex consumes RB/WR/TE surplus beyond primary slots
  const surplus =
    Math.max(0, counts.RB - roster.RB) +
    Math.max(0, counts.WR - roster.WR) +
    Math.max(0, counts.TE - roster.TE)
  const flexNeed = Math.max(0, roster.FLEX - surplus)
  total += flexNeed
  return { total, needs, flexOpen: flexNeed > 0 }
}

function isAllowedThisRound(profile: BotProfile, round: number, p: RankedPlayer): boolean {
  const avoidKdUntil = profile.avoidKdUntil ?? 12
  if ((p.pos === 'K' || p.pos === 'DST') && round < avoidKdUntil) return false

  if (profile.qbMode === 'EARLIEST_ROUND') {
    const gate = typeof profile.qbEarliestRound === 'number' ? profile.qbEarliestRound : 99
    if (p.pos === 'QB' && round < gate) return false
  }
  return true
}

/**
 * How far below the best available player a bot may realistically reach,
 * in board spots. Grows slowly with the round; scaled by the randomness
 * slider (0–100). Round 1 is nearly locked, only randomness 100 can
 * produce a pick from outside the projected first round.
 */
export function reachWindow(round: number, randomness: number): number {
  const r = Math.max(0, Math.min(100, randomness))
  if (round === 1) return r >= 100 ? 12 : Math.round(1 + r / 25) // 0→1 · 40→3 · 80→4 · 100→12
  if (round <= 4) return Math.round(2 + r / 12) //                  0→2 · 40→5 · 100→10
  if (round <= 8) return Math.round(3 + r / 8) //                   0→3 · 40→8 · 100→16
  return Math.round(4 + r / 5) //                                   0→4 · 40→12 · 100→24
}

/**
 * Scores a candidate for a bot (deterministic, no noise here; variance comes
 * from the bounded sampling in pickForBot). Units are roughly "spots on the
 * user's board": a +10 term makes the bot treat the player as ranked 10 spots higher.
 */
function scorePlayer(
  p: RankedPlayer,
  profile: BotProfile,
  settings: LeagueSettings,
  counts: Record<Position, number>
): number {
  let score = -p.rank

  // positional emphasis (–50..+50 → ±25 board spots)
  if (p.pos === 'RB') score += (profile.rbEmphasis ?? 0) * 0.5
  if (p.pos === 'WR') score += (profile.wrEmphasis ?? 0) * 0.5
  if (p.pos === 'TE') score += (profile.teEmphasis ?? 0) * 0.5
  if (p.pos === 'QB' && profile.qbMode === 'PRIORITY') {
    score += ((profile.qbPriority ?? 50) - 50) * 0.5
  }

  // team needs, scaled by sensitivity (default 60 ≈ 1.0×)
  const needScale = (profile.teamNeedsSensitivity ?? 60) / 60
  const primaryNeed = Math.max(0, settings.roster[p.pos] - counts[p.pos])
  const surplus =
    Math.max(0, counts.RB - settings.roster.RB) +
    Math.max(0, counts.WR - settings.roster.WR) +
    Math.max(0, counts.TE - settings.roster.TE)
  const flexNeed = FLEX_ELIGIBLE.has(p.pos) && settings.roster.FLEX - surplus > 0
  if (primaryNeed > 0) score += 12 * needScale
  else if (flexNeed) score += 5 * needScale
  else score -= 8 * needScale // already stacked at this position

  // favorites: modest reach for named guys
  if (profile.favorites?.some((f) => f && p.name.toLowerCase().includes(f.toLowerCase()))) {
    score += 20
  }

  // risk appetite: high-variance players (wide ADP spread) attract risk-takers
  const risk = ((profile.riskTolerance ?? 40) - 50) / 50
  score += risk * (p.stdev ?? 2) * 2.5

  return score
}

/**
 * Chooses a player for a bot seat off the user's board (`pool` must be the
 * AVAILABLE players sorted by board rank).
 */
export function pickForBot(opts: {
  pool: RankedPlayer[]
  settings: LeagueSettings
  state: DraftState
  profile: BotProfile
  round: number
  teamIndex: number
  rng?: () => number
}): RankedPlayer | null {
  const { pool, settings, state, profile, round, teamIndex } = opts
  const rng = opts.rng ?? Math.random
  if (pool.length === 0) return null

  const counts = teamCounts(state, teamIndex)
  const roundsLeft = settings.rounds - round + 1
  const starters = unfilledStarters(settings, counts)

  let candidates: RankedPlayer[]
  let forceFill = false
  if (starters.total >= roundsLeft) {
    // must fill starting lineup, restrict to needed positions, ignore gates
    forceFill = true
    candidates = pool.filter(
      (p) => starters.needs.has(p.pos) || (starters.flexOpen && FLEX_ELIGIBLE.has(p.pos))
    )
    if (candidates.length === 0) candidates = pool
  } else {
    candidates = pool.filter((p) => isAllowedThisRound(profile, round, p))
    if (candidates.length === 0) candidates = pool
  }

  // hard realism cap: only players within reach of the best available are
  // draftable at all (force-fill picks are exempt: grabbing your K late
  // isn't a "reach", it's filling the lineup)
  const randomness = profile.randomness ?? 10
  if (!forceFill) {
    const bestRank = candidates[0].rank // pool is rank-sorted
    const window = reachWindow(round, randomness)
    candidates = candidates.filter((p) => p.rank - bestRank <= window)
  }
  candidates = candidates.slice(0, 30)

  // deterministic preference order (strategy, needs, favorites, risk)…
  const scored = candidates
    .map((p) => ({ p, s: scorePlayer(p, profile, settings, counts) }))
    .sort((a, b) => b.s - a.s)

  if (randomness <= 0 || scored.length === 1) return scored[0]?.p ?? null

  // …then sample with a steep geometric taper: the top choice dominates,
  // lower choices fade fast. Later rounds + higher randomness flatten it a bit.
  const q = Math.min(0.7, 0.42 + randomness * 0.0015 + (round - 1) * 0.012)
  let u = rng()
  for (const { p } of scored) {
    const w = 1 - q // P(take this one) at each step
    if (u < w) return p
    u = (u - w) / q // renormalize and move to the next choice
  }
  return scored[scored.length - 1].p
}

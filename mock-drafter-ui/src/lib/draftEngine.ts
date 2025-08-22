import playersData from '@/data/players.json'
import type {
  Player,
  BotProfile,
  LeagueSettings,
  DraftState,
  Position,
} from '@/types'

/** Mutates the draft state in-place for a new pick */
export function applyPick(
  state: DraftState,
  teamIndex: number,
  player: Player,
  round: number,
  overall: number
) {
  // picks array
  state.picks.push({
    round,
    overall,
    teamIndex,
    playerId: player.id,
  })

  // taken set
  if (!state.taken) (state as any).taken = new Set<string>()
  state.taken.add(player.id)

  // roster bookkeeping if present
  if (state.rosters && state.rosters[teamIndex]) {
    const r = state.rosters[teamIndex]
    r.picks.push(player.id)
    // TS: byPos is Record<Position, number>
    ;(r.byPos as any)[player.pos] = ((r.byPos as any)[player.pos] ?? 0) + 1
  }
}

/** Basic helper: count team picks by position (from state.picks) */
function countTeamPos(state: DraftState, teamIndex: number) {
  const acc: Record<Position, number> = {
    QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0
  }
  for (const p of state.picks) {
    if (p.teamIndex !== teamIndex) continue
    // we only have playerId here; resolve once per call
    const pl = (playersData as Player[]).find(pp => pp.id === p.playerId)
    if (pl) acc[pl.pos]++
  }
  return acc
}

function flexRemaining(
  settings: LeagueSettings,
  teamCounts: Record<Position, number>
) {
  // FLEX consumes RB/WR/TE overflow; count primary needs first
  const { roster } = settings
  // How many primaries left for those three?
  const needRB = Math.max(0, roster.RB - teamCounts.RB)
  const needWR = Math.max(0, roster.WR - teamCounts.WR)
  const needTE = Math.max(0, roster.TE - teamCounts.TE)
  // Flex slots left
  const flexLeft = Math.max(0, roster.FLEX)
  // Flex that is still free after primary needs (rough heuristic)
  return Math.max(
    0,
    flexLeft - (needRB > 0 ? 0 : 0) - (needWR > 0 ? 0 : 0) - (needTE > 0 ? 0 : 0)
  )
}

/** Returns true if a player is **allowed** to be picked this round for the given profile */
function isAllowedThisRound(
  profile: BotProfile,
  round: number,
  p: Player
): boolean {
  // K/DST lockout
  const avoidKdUntil = profile.avoidKdUntil ?? 12
  if ((p.pos === 'K' || p.pos === 'DST') && round < avoidKdUntil) return false

  // QB earliest-round mode
  const qbMode = (profile as any).qbMode as ('PRIORITY'|'EARLIEST_ROUND'|undefined)
  const qbEarliest = (profile as any).qbEarliestRound as (number|undefined)

  if (qbMode === 'EARLIEST_ROUND') {
    // default to very late if not specified (defensive)
    const gate = typeof qbEarliest === 'number' ? qbEarliest : 99
    if (p.pos === 'QB' && round < gate) return false
  }

  return true
}

/** Very lightweight scorer with position biases + team needs + ADP */
function scorePlayer(
  p: Player,
  profile: BotProfile,
  settings: LeagueSettings,
  teamCounts: Record<Position, number>
): number {
  // Base on inverse ADP (lower ADP is better)
  let score = -p.adp

  // Position biases (wr/rb/te emphasis are -50..+50)
  const rbBias = (profile.rbEmphasis ?? 0)
  const wrBias = (profile.wrEmphasis ?? 0)
  const teBias = (profile.teEmphasis ?? 0)

  // QB priority slider (0..100) -> -50..+50
  const qbMode = (profile as any).qbMode as ('PRIORITY'|'EARLIEST_ROUND'|undefined)
  const qbPriority = (profile.qbPriority ?? 50) - 50
  const qbBias = qbMode === 'PRIORITY' ? qbPriority : 0

  // Apply position bias
  if (p.pos === 'RB') score += rbBias
  if (p.pos === 'WR') score += wrBias
  if (p.pos === 'TE') score += teBias
  if (p.pos === 'QB') score += qbBias

  // Team needs bonus: prefer filling starting slots first
  const need = (want: number, have: number) => Math.max(0, want - have)
  const want = settings.roster

  const primaryNeed: Record<Position, number> = {
    QB: need(want.QB, teamCounts.QB),
    RB: need(want.RB, teamCounts.RB),
    WR: need(want.WR, teamCounts.WR),
    TE: need(want.TE, teamCounts.TE),
    K:  need(want.K,  teamCounts.K),
    DST: need(want.DST, teamCounts.DST),
  }

  // FLEX handling
  const flexLeft = want.FLEX // we just treat FLEX as a milder bonus
  const flexEligible = (p.pos === 'RB' || p.pos === 'WR' || p.pos === 'TE')

  // Primary slots get a strong boost, FLEX a mild boost, otherwise small
  if (primaryNeed[p.pos] > 0) score += 40
  else if (flexEligible && flexLeft > 0) score += 10
  else score += 2 // bench depth

  return score
}

/**
 * pickForBot — the engine that chooses a player for a bot seat.
 * Enforces:
 *  - K/DST earliest round (avoidKdUntil)
 *  - QB earliest round when qbMode === 'EARLIEST_ROUND'
 */
export function pickForBot(
  settings: LeagueSettings,
  state: DraftState,
  profile: BotProfile,
  round: number,
  teamIndex: number
): Player | null {
  const taken = state.taken ?? new Set<string>()
  let avail = (playersData as Player[]).filter(p => !taken.has(p.id))

  // Hard filters for this round based on profile
  let pool = avail.filter(p => isAllowedThisRound(profile, round, p))
  if (pool.length === 0) pool = avail // never stall the draft; fall back

  // Score candidates
  const counts = countTeamPos(state, teamIndex)

  let best: Player | null = null
  let bestScore = -Infinity

  for (const p of pool) {
    const s = scorePlayer(p, profile, settings, counts)
    if (s > bestScore) {
      bestScore = s
      best = p
    }
  }
  return best
}

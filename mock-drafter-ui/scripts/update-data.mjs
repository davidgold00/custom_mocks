/**
 * Fetches live 2026 fantasy football rankings/ADP from public sources and
 * writes a bundled snapshot to src/data/rankings-2026.json.
 *
 * Sources:
 *  - Fantasy Football Calculator ADP (PPR / Half PPR / Standard / 2QB) — real mock draft market data
 *  - ESPN Fantasy live ADP + staff draft ranks
 *
 * Run: npm run update-data
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SEASON = 2026
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', `rankings-${SEASON}.json`)

/* ---------------- team + position normalization ---------------- */

const TEAM_FIX = { WSH: 'WAS', JAC: 'JAX', OAK: 'LV', SD: 'LAC', STL: 'LAR', LA: 'LAR' }
const fixTeam = (t) => TEAM_FIX[t] ?? t

// ESPN proTeamId -> abbreviation
const ESPN_TEAMS = {
  0: 'FA', 1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN',
  8: 'DET', 9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA',
  16: 'MIN', 17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT',
  24: 'LAC', 25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WAS', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU',
}
const ESPN_POS = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DST' }
const FFC_POS = { PK: 'K', DEF: 'DST' }

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])
function nameKey(name) {
  const tokens = name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
  while (tokens.length > 1 && SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop()
  return tokens.join(' ')
}

function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// canonical match key: DSTs match by team, everyone else by normalized name + pos
const matchKey = (p) => (p.pos === 'DST' ? `dst|${p.team}` : `${nameKey(p.name)}|${p.pos}`)

/* ---------------- fetch helpers ---------------- */

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.json()
}

async function fetchFFC(format) {
  const data = await getJson(`https://fantasyfootballcalculator.com/api/v1/adp/${format}?teams=12&year=${SEASON}`)
  if (data.status !== 'Success') throw new Error(`FFC ${format}: status ${data.status}`)
  return data
}

async function fetchESPN() {
  const filter = {
    players: {
      limit: 500,
      sortPercOwned: { sortAsc: false, sortPriority: 1 },
    },
  }
  return getJson(
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}/segments/0/leaguedefaults/3?view=kona_player_info`,
    { 'X-Fantasy-Filter': JSON.stringify(filter) },
  )
}

/* ---------------- main ---------------- */

async function main() {
  console.log(`Fetching live ${SEASON} data...`)
  const [ppr, half, std, twoQb, espn] = await Promise.all([
    fetchFFC('ppr'), fetchFFC('half-ppr'), fetchFFC('standard'), fetchFFC('2qb'), fetchESPN(),
  ])

  // master player registry
  const byKey = new Map() // matchKey -> player record
  const ensurePlayer = (name, pos, team, bye) => {
    const rec = { name, pos, team, bye: bye ?? null }
    const key = matchKey(rec)
    let existing = byKey.get(key)
    if (!existing) {
      existing = {
        id: pos === 'DST' ? `${team.toLowerCase()}-dst` : `${slugify(name)}-${pos.toLowerCase()}`,
        name, pos, team, bye: bye ?? null, injuryStatus: null,
      }
      byKey.set(key, existing)
    } else if (bye != null && existing.bye == null) {
      existing.bye = bye
    }
    return existing
  }

  const teamBye = {}

  // --- FFC sources ---
  const ffcSources = []
  for (const [id, label, data] of [
    ['ffc-ppr', 'FFC Market ADP — PPR', ppr],
    ['ffc-half', 'FFC Market ADP — Half PPR', half],
    ['ffc-std', 'FFC Market ADP — Standard', std],
    ['ffc-2qb', 'FFC Market ADP — Superflex / 2QB', twoQb],
  ]) {
    const ranks = []
    for (const raw of data.players) {
      const pos = FFC_POS[raw.position] ?? raw.position
      const team = fixTeam(raw.team)
      const name = pos === 'DST' ? `${team} D/ST` : raw.name
      const p = ensurePlayer(name, pos, team, raw.bye)
      if (raw.bye != null) teamBye[team] = raw.bye
      ranks.push({ id: p.id, adp: raw.adp, stdev: raw.stdev, high: raw.high, low: raw.low })
    }
    ffcSources.push({
      id, label,
      provider: 'Fantasy Football Calculator',
      kind: 'Market ADP',
      detail: `${data.meta.total_drafts.toLocaleString()} real mock drafts, ${data.meta.start_date} → ${data.meta.end_date}`,
      coverage: ranks.length,
      ranks,
    })
  }

  // --- ESPN sources ---
  const espnAdp = []
  const espnRank = []
  for (const item of espn.players ?? []) {
    const pl = item.player
    const pos = ESPN_POS[pl.defaultPositionId]
    const team = ESPN_TEAMS[pl.proTeamId]
    if (!pos || !team || team === 'FA') continue
    const name = pos === 'DST' ? `${team} D/ST` : pl.fullName
    const p = ensurePlayer(name, pos, team, teamBye[team] ?? null)
    if (pl.injuryStatus && pl.injuryStatus !== 'ACTIVE') p.injuryStatus = pl.injuryStatus
    const adp = pl.ownership?.averageDraftPosition
    if (adp && adp > 0) espnAdp.push({ id: p.id, adp: Math.round(adp * 10) / 10 })
    const rank = pl.draftRanksByRankType?.PPR?.rank
    if (rank && rank > 0) espnRank.push({ id: p.id, rank })
  }
  espnAdp.sort((a, b) => a.adp - b.adp)
  espnRank.sort((a, b) => a.rank - b.rank)

  const espnDate = espn.players?.[0]?.player?.ownership?.date
  const espnSources = [
    {
      id: 'espn-adp', label: 'ESPN Live ADP',
      provider: 'ESPN Fantasy', kind: 'Market ADP',
      detail: `Live draft position across ESPN leagues${espnDate ? `, as of ${new Date(espnDate).toISOString().slice(0, 10)}` : ''}`,
      coverage: espnAdp.length,
      ranks: espnAdp,
    },
    {
      id: 'espn-rank', label: 'ESPN Staff Rankings (PPR)',
      provider: 'ESPN Fantasy', kind: 'Expert ranks',
      detail: 'ESPN fantasy staff consensus draft ranks',
      coverage: espnRank.length,
      ranks: espnRank.map(({ id, rank }) => ({ id, adp: null, rank })),
    },
  ]

  // fill missing byes now that teamBye is complete
  for (const p of byKey.values()) if (p.bye == null) p.bye = teamBye[p.team] ?? null

  const players = {}
  for (const p of byKey.values()) {
    if (players[p.id]) throw new Error(`duplicate player id: ${p.id}`)
    players[p.id] = p
  }
  const allIds = Object.keys(players)

  // composite fallback order (best ADP/rank seen anywhere) used to pad every
  // source to the full pool so drafts never run out of ranked players
  const bestSeen = {}
  const note = (id, v) => { if (v != null && (bestSeen[id] == null || v < bestSeen[id])) bestSeen[id] = v }
  for (const s of [...ffcSources, ...espnSources]) s.ranks.forEach((r, i) => note(r.id, r.adp ?? r.rank ?? i + 1))
  const fallbackOrder = [...allIds].sort((a, b) => (bestSeen[a] ?? 9999) - (bestSeen[b] ?? 9999))

  const sources = [...ffcSources, ...espnSources].map((s) => {
    const seen = new Set(s.ranks.map((r) => r.id))
    const padded = [...s.ranks]
    for (const id of fallbackOrder) if (!seen.has(id)) padded.push({ id, adp: null, padded: true })
    return { ...s, ranks: padded }
  })

  const out = {
    season: SEASON,
    fetchedAt: new Date().toISOString(),
    playerCount: allIds.length,
    players,
    sources,
  }

  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(out))
  console.log(`Wrote ${OUT}`)
  console.log(`  season: ${SEASON}, players: ${allIds.length}`)
  for (const s of sources) console.log(`  ${s.id}: ${s.coverage} ranked (${s.detail})`)
}

main().catch((e) => { console.error(e); process.exit(1) })

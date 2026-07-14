/**
 * Shared data layer: fetches + merges all public ranking sources into one dataset.
 * Pure ESM using only global fetch — runs in Node (scripts, vite dev middleware)
 * and Cloudflare Workers (Pages Functions) unchanged.
 *
 * Dataset shape:
 *   { season, fetchedAt, playerCount, players: {id -> player},
 *     fallbackOrder: [ids by best rank seen anywhere],
 *     sources: [{ id, label, provider, kind, format, dynasty, detail, coverage, ranks: [{id, adp?, stdev?}] }] }
 *
 * Sources contain only real entries; clients pad boards using fallbackOrder.
 */

export const SEASON = 2026

/* ---------------- normalization ---------------- */

const TEAM_FIX = {
  WSH: 'WAS', JAC: 'JAX', OAK: 'LV', SD: 'LAC', STL: 'LAR', LA: 'LAR',
  GBP: 'GB', KCC: 'KC', NEP: 'NE', NOS: 'NO', SFO: 'SF', TBB: 'TB', LVR: 'LV',
  HST: 'HOU', BLT: 'BAL', CLV: 'CLE', ARZ: 'ARI',
}
const fixTeam = (t) => (t ? TEAM_FIX[t] ?? t : 'FA')

const ESPN_TEAMS = {
  0: 'FA', 1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN',
  8: 'DET', 9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA',
  16: 'MIN', 17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT',
  24: 'LAC', 25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WAS', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU',
}
const ESPN_POS = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DST' }
const POS_FIX = { PK: 'K', DEF: 'DST', 'D/ST': 'DST' }
const VALID_POS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DST'])
const fixPos = (p) => {
  const up = String(p ?? '').toUpperCase()
  return POS_FIX[up] ?? up
}

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])
export function nameKey(name) {
  const tokens = String(name)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
  while (tokens.length > 1 && SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop()
  return tokens.join(' ')
}

export function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/* ---------------- fetch helpers ---------------- */

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${res.status} for ${url}`)
  return res.json()
}
async function getText(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} for ${url}`)
  return res.text()
}

/** minimal CSV parser with quote handling */
export function parseCsv(text) {
  const rows = []
  let row = [], cur = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else inQ = false }
      else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') {
      if (cur !== '' || row.length) { row.push(cur); rows.push(row); row = []; cur = '' }
      if (c === '\r' && text[i + 1] === '\n') i++
    } else cur += c
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row) }
  return rows
}

/* ---------------- dataset builder ---------------- */

class Registry {
  constructor() { this.byKey = new Map() }
  key(name, pos, team) { return pos === 'DST' ? `dst|${team}` : `${nameKey(name)}|${pos}` }
  /** get-or-create canonical player */
  player(name, pos, team, extra = {}) {
    pos = fixPos(pos)
    team = fixTeam(team)
    if (!VALID_POS.has(pos)) return null
    const k = this.key(name, pos, team)
    let p = this.byKey.get(k)
    if (!p) {
      p = {
        id: pos === 'DST' ? `${team.toLowerCase()}-dst` : `${slugify(name)}-${pos.toLowerCase()}`,
        name: pos === 'DST' ? `${team} D/ST` : String(name).trim(),
        pos, team, bye: null, injuryStatus: null, rookie: false,
      }
      this.byKey.set(k, p)
    }
    if (extra.bye != null && p.bye == null) p.bye = extra.bye
    if (extra.injuryStatus && !p.injuryStatus) p.injuryStatus = extra.injuryStatus
    if (extra.rookie) p.rookie = true
    return p
  }
  /** find without creating (for sources that shouldn't invent players) */
  find(name, pos, team) {
    return this.byKey.get(this.key(name, fixPos(pos), fixTeam(team))) ?? null
  }
}

const F = { PPR: 'PPR', HALF: 'HALF', STD: 'STD', SF: 'SF', ANY: 'ANY' }

export async function buildDataset() {
  const reg = new Registry()
  const sources = []
  const errors = []
  const teamBye = {}

  const jobs = [
    /* ---- Fantasy Football Calculator: real mock-draft market ADP ---- */
    ...[
      ['ffc-ppr', 'FFC ADP · PPR', 'ppr', 12, F.PPR],
      ['ffc-half', 'FFC ADP · Half PPR', 'half-ppr', 12, F.HALF],
      ['ffc-std', 'FFC ADP · Standard', 'standard', 12, F.STD],
      ['ffc-2qb', 'FFC ADP · Superflex', '2qb', 12, F.SF],
      ['ffc-ppr10', 'FFC ADP · PPR 10-team', 'ppr', 10, F.PPR],
      ['ffc-ppr14', 'FFC ADP · PPR 14-team', 'ppr', 14, F.PPR],
    ].map(([id, label, fmt, teams, format]) => async () => {
      const d = await getJson(`https://fantasyfootballcalculator.com/api/v1/adp/${fmt}?teams=${teams}&year=${SEASON}`)
      if (d.status !== 'Success' || !d.players?.length) throw new Error('no data')
      const ranks = []
      for (const raw of d.players) {
        const p = reg.player(raw.name, raw.position, raw.team, { bye: raw.bye })
        if (!p) continue
        if (raw.bye != null) teamBye[p.team] = raw.bye
        ranks.push({ id: p.id, adp: raw.adp, stdev: raw.stdev })
      }
      return {
        id, label, provider: 'Fantasy Football Calculator', kind: 'Market ADP', format, dynasty: false,
        detail: `${Number(d.meta.total_drafts).toLocaleString()} mock drafts · ${teams}-team`,
        asOf: d.meta.end_date,
        ranks,
      }
    }),

    /* ---- ESPN: live ADP, staff ranks (PPR + Standard), projections ---- */
    async () => {
      const filter = { players: { limit: 500, sortPercOwned: { sortAsc: false, sortPriority: 1 } } }
      const d = await getJson(
        `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}/segments/0/leaguedefaults/3?view=kona_player_info`,
        { 'X-Fantasy-Filter': JSON.stringify(filter) },
      )
      const adp = [], rankPpr = [], rankStd = [], proj = []
      for (const item of d.players ?? []) {
        const pl = item.player
        const pos = ESPN_POS[pl.defaultPositionId]
        const team = ESPN_TEAMS[pl.proTeamId]
        if (!pos || !team || team === 'FA') continue
        const p = reg.player(pl.fullName, pos, team, {
          injuryStatus: pl.injuryStatus && pl.injuryStatus !== 'ACTIVE' ? pl.injuryStatus : null,
        })
        if (!p) continue
        const a = pl.ownership?.averageDraftPosition
        if (a > 0) adp.push({ id: p.id, adp: Math.round(a * 10) / 10 })
        const rp = pl.draftRanksByRankType?.PPR?.rank
        const rs = pl.draftRanksByRankType?.STANDARD?.rank
        if (rp > 0) rankPpr.push({ id: p.id, v: rp })
        if (rs > 0) rankStd.push({ id: p.id, v: rs })
        const st = (pl.stats ?? []).find(s => s.statSourceId === 1 && s.scoringPeriodId === 0 && s.seasonId === SEASON)
        if (st?.appliedTotal > 5) proj.push({ id: p.id, v: st.appliedTotal })
      }
      adp.sort((x, y) => x.adp - y.adp)
      rankPpr.sort((x, y) => x.v - y.v)
      rankStd.sort((x, y) => x.v - y.v)
      proj.sort((x, y) => y.v - x.v)
      const ownDate = d.players?.[0]?.player?.ownership?.date
      const base = {
        provider: 'ESPN Fantasy', dynasty: false,
        asOf: ownDate ? new Date(ownDate).toISOString() : undefined,
      }
      return [
        { ...base, id: 'espn-adp', label: 'ESPN Live ADP', kind: 'Market ADP', format: F.PPR, detail: 'Live ADP across ESPN leagues', ranks: adp },
        { ...base, id: 'espn-rank-ppr', label: 'ESPN Staff Ranks · PPR', kind: 'Expert ranks', format: F.PPR, detail: 'ESPN staff consensus, PPR', ranks: rankPpr.map(r => ({ id: r.id, adp: null })) },
        { ...base, id: 'espn-rank-std', label: 'ESPN Staff Ranks · Standard', kind: 'Expert ranks', format: F.STD, detail: 'ESPN staff consensus, non-PPR', ranks: rankStd.map(r => ({ id: r.id, adp: null })) },
        { ...base, id: 'espn-proj', label: 'ESPN Projected Points', kind: 'Projections', format: F.PPR, detail: `${SEASON} season projections, PPR`, ranks: proj.map(r => ({ id: r.id, adp: null })) },
      ]
    },

    /* ---- Sleeper: player rank; also rookie/injury metadata for the whole pool ---- */
    async () => {
      const players = await getJson('https://api.sleeper.app/v1/players/nfl')
      const ranked = []
      for (const [sid, pl] of Object.entries(players)) {
        const pos = fixPos(pl.position)
        if (!VALID_POS.has(pos) || !pl.active) continue
        const name = pos === 'DST' ? sid : pl.full_name
        if (!name) continue
        const p = reg.player(name, pos, pos === 'DST' ? sid : pl.team, {
          injuryStatus: pl.injury_status ? String(pl.injury_status).toUpperCase() : null,
          rookie: pl.years_exp === 0,
        })
        if (!p) continue
        if (pl.search_rank && pl.search_rank < 9999999) ranked.push({ id: p.id, v: pl.search_rank })
      }
      ranked.sort((x, y) => x.v - y.v)
      return [
        {
          id: 'sleeper-rank', label: 'Sleeper Player Rank', provider: 'Sleeper', kind: 'Platform rank',
          format: F.ANY, dynasty: false, detail: 'Sleeper overall player ranking',
          ranks: ranked.slice(0, 400).map(r => ({ id: r.id, adp: null })),
        },
      ]
    },

    /* ---- FantasyCalc: crowdsourced values from real trades ---- */
    ...[
      ['fc-redraft-ppr', 'FantasyCalc Redraft · PPR', 'isDynasty=false&numQbs=1&ppr=1', F.PPR, false],
      ['fc-redraft-std', 'FantasyCalc Redraft · Standard', 'isDynasty=false&numQbs=1&ppr=0', F.STD, false],
      ['fc-redraft-sf', 'FantasyCalc Redraft · Superflex', 'isDynasty=false&numQbs=2&ppr=1', F.SF, false],
      ['fc-dynasty-1qb', 'FantasyCalc Dynasty · 1QB', 'isDynasty=true&numQbs=1&ppr=1', F.PPR, true],
      ['fc-dynasty-sf', 'FantasyCalc Dynasty · Superflex', 'isDynasty=true&numQbs=2&ppr=1', F.SF, true],
    ].map(([id, label, qs, format, dynasty]) => async () => {
      const d = await getJson(`https://api.fantasycalc.com/values/current?${qs}&numTeams=12`)
      const ranks = []
      for (const row of d) {
        const pl = row.player
        const p = reg.player(pl.name, pl.position, pl.maybeTeam, { rookie: pl.maybeYoe === 0 })
        if (p) ranks.push({ id: p.id, adp: null })
      }
      return {
        id, label, provider: 'FantasyCalc', kind: 'Trade values', format, dynasty,
        detail: `Crowdsourced values from real ${dynasty ? 'dynasty' : 'redraft'} trades`,
        ranks: ranks.slice(0, 400),
      }
    }),

    /* ---- DynastyProcess: FantasyPros-derived dynasty ECR/values ---- */
    async () => {
      const csv = parseCsv(await getText('https://raw.githubusercontent.com/dynastyprocess/data/master/files/values-players.csv'))
      const head = csv[0].map(h => h.toLowerCase())
      const col = (n) => head.indexOf(n)
      const iName = col('player'), iPos = col('pos'), iTeam = col('team'),
        iV1 = col('value_1qb'), iV2 = col('value_2qb'), iDraftYear = col('draft_year'), iDate = col('scrape_date')
      const one = [], two = []
      for (const r of csv.slice(1)) {
        const p = reg.player(r[iName], r[iPos], r[iTeam], { rookie: Number(r[iDraftYear]) === SEASON })
        if (!p) continue
        const v1 = Number(r[iV1]), v2 = Number(r[iV2])
        if (v1 > 0) one.push({ id: p.id, v: v1 })
        if (v2 > 0) two.push({ id: p.id, v: v2 })
      }
      one.sort((x, y) => y.v - x.v)
      two.sort((x, y) => y.v - x.v)
      const base = {
        provider: 'DynastyProcess', kind: 'Dynasty values', dynasty: true,
        detail: 'Expert-consensus dynasty values',
        asOf: csv[1]?.[iDate] || undefined,
      }
      return [
        { ...base, id: 'dp-dynasty-1qb', label: 'DynastyProcess · 1QB', format: F.PPR, ranks: one.slice(0, 400).map(r => ({ id: r.id, adp: null })) },
        { ...base, id: 'dp-dynasty-sf', label: 'DynastyProcess · Superflex', format: F.SF, ranks: two.slice(0, 400).map(r => ({ id: r.id, adp: null })) },
      ]
    },

    /* ---- MyFantasyLeague: ADP (PPR/Std) + auction values ---- */
    async () => {
      const [pdb, adpPpr, adpStd, aav] = await Promise.all([
        getJson(`https://api.myfantasyleague.com/${SEASON}/export?TYPE=players&DETAILS=0&JSON=1`),
        getJson(`https://api.myfantasyleague.com/${SEASON}/export?TYPE=adp&PERIOD=RECENT&FCOUNT=12&IS_PPR=1&IS_KEEPER=N&IS_MOCK=-1&JSON=1`),
        getJson(`https://api.myfantasyleague.com/${SEASON}/export?TYPE=adp&PERIOD=RECENT&FCOUNT=12&IS_PPR=0&IS_KEEPER=N&IS_MOCK=-1&JSON=1`),
        getJson(`https://api.myfantasyleague.com/${SEASON}/export?TYPE=aav&PERIOD=RECENT&JSON=1`),
      ])
      const meta = {}
      for (const pl of pdb.players?.player ?? []) {
        const pos = fixPos(pl.position)
        if (!VALID_POS.has(pos)) continue
        // MFL names are "Last, First"
        const name = pos === 'DST' ? pl.team : String(pl.name).split(', ').reverse().join(' ')
        meta[pl.id] = { name, pos, team: pl.team }
      }
      const toRanks = (list, field) => {
        const out = []
        for (const row of list ?? []) {
          const m = meta[row.id]
          if (!m) continue
          const p = reg.find(m.name, m.pos, m.team) ?? reg.player(m.name, m.pos, m.team)
          if (!p) continue
          out.push({ id: p.id, adp: field === 'averagePick' ? Math.round(Number(row[field]) * 10) / 10 : null })
        }
        return out.slice(0, 400)
      }
      const base = {
        provider: 'MyFantasyLeague', dynasty: false,
        asOf: adpPpr.adp?.timestamp ? new Date(Number(adpPpr.adp.timestamp) * 1000).toISOString() : undefined,
      }
      return [
        { ...base, id: 'mfl-adp-ppr', label: 'MFL ADP · PPR', kind: 'Market ADP', format: F.PPR, detail: `${adpPpr.adp?.totalDrafts ?? '?'} recent MFL drafts, PPR`, ranks: toRanks(adpPpr.adp?.player, 'averagePick') },
        { ...base, id: 'mfl-adp-std', label: 'MFL ADP · Standard', kind: 'Market ADP', format: F.STD, detail: `${adpStd.adp?.totalDrafts ?? '?'} recent MFL drafts, non-PPR`, ranks: toRanks(adpStd.adp?.player, 'averagePick') },
        { ...base, id: 'mfl-aav', label: 'MFL Auction Values', kind: 'Auction values', format: F.ANY, detail: 'Average auction price, recent MFL auctions', ranks: toRanks(aav.aav?.player, 'averageValue') },
      ]
    },
  ]

  const settled = await Promise.allSettled(jobs.map(j => j()))
  for (const r of settled) {
    if (r.status === 'fulfilled') sources.push(...(Array.isArray(r.value) ? r.value : [r.value]))
    else errors.push(String(r.reason?.message ?? r.reason))
  }

  // drop empty sources, fill byes, compute fallback order
  const live = sources.filter(s => s.ranks.length >= 20)
  const players = {}
  for (const p of reg.byKey.values()) {
    if (p.bye == null) p.bye = teamBye[p.team] ?? null
    players[p.id] = p
  }
  const bestSeen = {}
  for (const s of live) s.ranks.forEach((r, i) => {
    const v = r.adp ?? i + 1
    if (bestSeen[r.id] == null || v < bestSeen[r.id]) bestSeen[r.id] = v
  })
  // only pool players that appear in at least one source
  const pooled = Object.keys(bestSeen)
  pooled.sort((a, b) => bestSeen[a] - bestSeen[b])
  const pooledPlayers = {}
  for (const id of pooled) pooledPlayers[id] = players[id]

  const fetchedAt = new Date().toISOString()
  return {
    season: SEASON,
    fetchedAt,
    playerCount: pooled.length,
    players: pooledPlayers,
    fallbackOrder: pooled,
    // asOf = the source's own data date where it reports one, else our fetch time
    sources: live.map(s => ({ ...s, coverage: s.ranks.length, asOf: s.asOf ?? fetchedAt })),
    errors,
  }
}

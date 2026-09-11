import type { Player } from '@/types'

export interface ImportReport {
  order: string[]
  matched: number
  total: number
  unmatched: { row: number; name: string; reason: string }[]
  duplicates: string[]
  rankColumn: string | null
  nameColumn: string
}

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])
function nameKey(name: string) {
  const tokens = name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
  while (tokens.length > 1 && SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop()
  return tokens.join(' ')
}

const POS_FIX: Record<string, string> = { PK: 'K', DEF: 'DST', 'D/ST': 'DST', DS: 'DST' }
function fixPos(p: string): string {
  const up = p.toUpperCase().replace(/[0-9]+$/, '') // "WR12" → "WR"
  return POS_FIX[up] ?? up
}

const NAME_HEADERS = ['player', 'name', 'player name', 'full name']
const RANK_HEADERS = ['rank', 'rk', 'overall', 'ovr', 'ecr', 'adp', 'overall rank', 'expert rank', 'avg']
const POS_HEADERS = ['pos', 'position']

function findColumn(headers: string[], wanted: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim())
  for (const w of wanted) {
    const i = lower.indexOf(w)
    if (i >= 0) return i
  }
  // partial match (e.g. "Player Name (Team)")
  for (const w of wanted) {
    const i = lower.findIndex((h) => h.includes(w))
    if (i >= 0) return i
  }
  return -1
}

/**
 * Parse an uploaded/linked rankings sheet and match rows to the canonical
 * player pool. Throws Error with a human-readable message when unusable.
 */
export async function parseRankingsSheet(
  data: ArrayBuffer | string,
  players: Record<string, Player>,
): Promise<ImportReport> {
  // Spreadsheet parsing is only needed when the import modal is used. Keeping
  // it dynamic removes the large parser from the initial application bundle.
  const XLSX = await import('xlsx')
  let wb: import('xlsx').WorkBook
  try {
    wb = typeof data === 'string'
      ? XLSX.read(data, { type: 'string' })
      : XLSX.read(data, { type: 'array' })
  } catch {
    throw new Error('Could not read that file. It doesn’t look like a valid spreadsheet or CSV.')
  }
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) throw new Error('The file has no sheets.')
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, raw: false, defval: '' })
    .map((r) => r.map((c) => String(c ?? '').trim()))
    .filter((r) => r.some((c) => c !== ''))
  if (rows.length < 2) throw new Error('The sheet is empty (or has a header but no player rows).')

  // find the header row within the first 5 rows
  let headerIdx = -1, nameCol = -1
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const c = findColumn(rows[i], NAME_HEADERS)
    if (c >= 0) { headerIdx = i; nameCol = c; break }
  }
  if (headerIdx < 0) {
    throw new Error('No player-name column found. The sheet needs a header row with a column called "Player" or "Name".')
  }
  const headers = rows[headerIdx]
  const rankCol = findColumn(headers, RANK_HEADERS)
  const posCol = findColumn(headers, POS_HEADERS)

  // index the pool by normalized name (+pos) for matching
  const byNamePos = new Map<string, Player>()
  const byName = new Map<string, Player[]>()
  for (const p of Object.values(players)) {
    const k = nameKey(p.name)
    byNamePos.set(`${k}|${p.pos}`, p)
    const arr = byName.get(k) ?? []
    arr.push(p)
    byName.set(k, arr)
  }

  type Entry = { id: string; rank: number; row: number }
  const entries: Entry[] = []
  const unmatched: ImportReport['unmatched'] = []
  const duplicates: string[] = []
  const seen = new Set<string>()

  rows.slice(headerIdx + 1).forEach((row, i) => {
    const rowNum = headerIdx + i + 2 // 1-based, matching what users see in Excel
    const rawName = row[nameCol]
    if (!rawName) return
    const key = nameKey(rawName)
    if (!key) return

    let match: Player | undefined
    if (posCol >= 0 && row[posCol]) {
      match = byNamePos.get(`${key}|${fixPos(row[posCol])}`)
    }
    if (!match) {
      const cands = byName.get(key) ?? []
      if (cands.length === 1) match = cands[0]
      else if (cands.length > 1) {
        unmatched.push({ row: rowNum, name: rawName, reason: `Ambiguous: multiple ${cands.map(c => c.pos).join('/')} players share this name. Add a Position column.` })
        return
      }
    }
    if (!match) {
      unmatched.push({ row: rowNum, name: rawName, reason: 'Not found in the 2026 player pool (check spelling; retired/practice-squad players aren’t listed).' })
      return
    }
    if (seen.has(match.id)) {
      duplicates.push(match.name)
      return
    }
    seen.add(match.id)
    const rank = rankCol >= 0 ? parseFloat(String(row[rankCol]).replace(/[^0-9.]/g, '')) : NaN
    entries.push({ id: match.id, rank: Number.isFinite(rank) ? rank : entries.length + 1, row: rowNum })
  })

  if (entries.length === 0) {
    throw new Error('No rows matched any 2026 players. Is this a fantasy football rankings sheet?')
  }
  entries.sort((a, b) => a.rank - b.rank || a.row - b.row)

  return {
    order: entries.map((e) => e.id),
    matched: entries.length,
    total: entries.length + unmatched.length,
    unmatched,
    duplicates,
    rankColumn: rankCol >= 0 ? String(headers[rankCol]) : null,
    nameColumn: String(headers[nameCol]),
  }
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

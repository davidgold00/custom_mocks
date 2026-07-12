/** Shared URL-import helpers: validation, Google Sheets rewriting, content sniffing. */

export const MAX_BYTES = 8 * 1024 * 1024

/** Validate + normalize a user-pasted rankings link. Returns {url} or {error}. */
export function normalizeImportUrl(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return { error: 'Paste a link first.' }
  let u
  try {
    u = new URL(s)
  } catch {
    return { error: 'That isn’t a valid URL — it should start with https://' }
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return { error: 'Only http(s) links are supported.' }
  }
  // Google Sheets share links → CSV export of the first sheet
  const m = u.href.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/)
  if (m) {
    const gid = u.hash.match(/gid=(\d+)/)?.[1] ?? u.searchParams.get('gid') ?? '0'
    return { url: `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}` }
  }
  return { url: u.href }
}

/** Classify fetched bytes: 'csv' | 'xlsx' | 'html' | 'unknown' */
export function classifyContent(contentType, url, buf) {
  const ct = contentType.toLowerCase()
  const bytes = new Uint8Array(buf.slice(0, 512))
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes).trimStart().toLowerCase()

  // xlsx/xls magic: PK zip header or OLE compound file
  if ((bytes[0] === 0x50 && bytes[1] === 0x4b) || (bytes[0] === 0xd0 && bytes[1] === 0xcf)) return 'xlsx'
  if (ct.includes('spreadsheetml') || ct.includes('ms-excel')) return 'xlsx'
  if (head.startsWith('<!doctype html') || head.startsWith('<html') || ct.includes('text/html')) return 'html'
  if (ct.includes('csv') || ct.includes('tab-separated') || /\.(csv|tsv)(\?|$)/.test(url)) return 'csv'
  // plain text that looks tabular (has commas/tabs in first lines) counts as csv
  if (ct.includes('text/plain') || ct === '') {
    const firstLines = head.split('\n').slice(0, 3)
    if (firstLines.some(l => l.includes(',') || l.includes('\t'))) return 'csv'
  }
  return 'unknown'
}

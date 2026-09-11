/** Shared URL-import helpers: validation, Google Sheets rewriting, content sniffing. */

// Vercel Function responses are capped at 4.5 MB. XLSX bytes are base64
// encoded in JSON, so 3 MB keeps the encoded response safely under that cap.
export const MAX_BYTES = 3 * 1024 * 1024

function isPrivateHostname(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true
  }
  // URL normalizes unusual IPv4 spellings (integer, octal, hex) before this.
  const parts = host.split('.').map(Number)
  if (parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = parts
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
  }
  // Literal IPv6 URLs are unnecessary for this feature and are difficult to
  // validate safely without DNS/network access in every supported runtime.
  return host.includes(':')
}

/** Validate + normalize a user-pasted rankings link. Returns {url} or {error}. */
export function normalizeImportUrl(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return { error: 'Paste a link first.' }
  let u
  try {
    u = new URL(s)
  } catch {
    return { error: 'That isn’t a valid URL. It should start with https://' }
  }
  if (u.protocol !== 'https:') {
    return { error: 'Only secure https:// links are supported.' }
  }
  if (u.username || u.password || isPrivateHostname(u.hostname)) {
    return { error: 'That address is not a supported public link.' }
  }
  // Google Sheets share links → CSV export of the first sheet
  const m = u.hostname === 'docs.google.com' && u.pathname.match(/^\/spreadsheets\/d\/([\w-]+)/)
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

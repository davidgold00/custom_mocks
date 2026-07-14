/**
 * POST /api/import-url  { url }
 * Fetches a user-supplied rankings link server-side (browsers are blocked by CORS)
 * and returns the raw content for client-side parsing:
 *   { ok: true, kind: 'csv' | 'xlsx', name, text? , base64? }
 *   { ok: false, error: '<human-readable reason>' }
 */
import { normalizeImportUrl, classifyContent, MAX_BYTES } from '../shared/importUrl.mjs'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

async function fetchPublicUrl(initialUrl: string): Promise<Response> {
  let url = initialUrl
  for (let redirects = 0; redirects <= 5; redirects++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'BoardRoom/1.0' }, redirect: 'manual' })
    if (![301, 302, 303, 307, 308].includes(res.status)) return res
    const location = res.headers.get('location')
    if (!location) return res
    const next = normalizeImportUrl(new URL(location, url).href)
    if ('error' in next) throw new Error(next.error)
    url = next.url
  }
  throw new Error('That link redirects too many times.')
}

async function readLimited(res: Response): Promise<ArrayBuffer> {
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared > MAX_BYTES) throw new Error('File is too large (over 3 MB).')
  if (!res.body) return new ArrayBuffer(0)

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) {
      await reader.cancel()
      throw new Error('File is too large (over 3 MB).')
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes.buffer
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  let url: string
  try {
    url = String(((await request.json()) as { url?: string })?.url ?? '')
  } catch {
    return json({ ok: false, error: 'Bad request body.' }, 400)
  }

  const norm = normalizeImportUrl(url)
  if ('error' in norm) return json({ ok: false, error: norm.error })

  let res: Response
  try {
    res = await fetchPublicUrl(norm.url)
  } catch (e) {
    return json({
      ok: false,
      error: e instanceof Error ? e.message : 'That link could not be reached. Check it works in your browser.',
    })
  }
  if (!res.ok) {
    return json({
      ok: false,
      error: res.status === 401 || res.status === 403
        ? 'That page requires a login, so rankings can’t be read from it. Export the rankings as CSV/Excel and upload the file instead.'
        : `The link returned HTTP ${res.status}. Check the URL is public and correct.`,
    })
  }

  let buf: ArrayBuffer
  try {
    buf = await readLimited(res)
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'Could not read that file.' }, 413)
  }

  const kind = classifyContent(res.headers.get('content-type') ?? '', norm.url, buf)
  if (kind === 'html') {
    return json({
      ok: false,
      error: 'That link is a web page, not a rankings file. Look for a CSV/Excel export or download button on the site, or copy the table into a spreadsheet and upload it.',
    })
  }
  if (kind === 'unknown') {
    return json({ ok: false, error: 'Unsupported file type. Only CSV, TSV, or Excel (.xlsx/.xls) links work.' })
  }

  const name = norm.url.split('/').pop()?.split('?')[0] || 'imported-rankings'
  if (kind === 'csv') return json({ ok: true, kind, name, text: new TextDecoder().decode(buf) })
  // xlsx: binary -> base64
  let bin = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return json({ ok: true, kind, name, base64: btoa(bin) })
}

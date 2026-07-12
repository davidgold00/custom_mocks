/// <reference types="@cloudflare/workers-types/latest" />

/**
 * POST /api/import-url  { url }
 * Fetches a user-supplied rankings link server-side (browsers are blocked by CORS)
 * and returns the raw content for client-side parsing:
 *   { ok: true, kind: 'csv' | 'xlsx', name, text? , base64? }
 *   { ok: false, error: '<human-readable reason>' }
 */
import { normalizeImportUrl, classifyContent, MAX_BYTES } from '../../shared/importUrl.mjs'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export const onRequestPost: PagesFunction = async ({ request }) => {
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
    res = await fetch(norm.url, { headers: { 'User-Agent': 'BoardRoom/1.0' }, redirect: 'follow' })
  } catch {
    return json({ ok: false, error: 'That link could not be reached — check it works in your browser.' })
  }
  if (!res.ok) {
    return json({
      ok: false,
      error: res.status === 401 || res.status === 403
        ? 'That page requires a login, so rankings can’t be read from it. Export the rankings as CSV/Excel and upload the file instead.'
        : `The link returned HTTP ${res.status}. Check the URL is public and correct.`,
    })
  }

  const buf = await res.arrayBuffer()
  if (buf.byteLength > MAX_BYTES) return json({ ok: false, error: 'File is too large (over 8 MB).' })

  const kind = classifyContent(res.headers.get('content-type') ?? '', norm.url, buf)
  if (kind === 'html') {
    return json({
      ok: false,
      error: 'That link is a web page, not a rankings file. Look for a CSV/Excel export or download button on the site, or copy the table into a spreadsheet and upload it.',
    })
  }
  if (kind === 'unknown') {
    return json({ ok: false, error: 'Unsupported file type — only CSV, TSV, or Excel (.xlsx/.xls) links work.' })
  }

  const name = norm.url.split('/').pop()?.split('?')[0] || 'imported-rankings'
  if (kind === 'csv') return json({ ok: true, kind, name, text: new TextDecoder().decode(buf) })
  // xlsx: binary → base64
  let bin = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return json({ ok: true, kind, name, base64: btoa(bin) })
}

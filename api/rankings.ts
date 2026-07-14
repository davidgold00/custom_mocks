/**
 * GET /api/rankings         -> dataset (KV-cached, rebuilt when older than 6h)
 * GET /api/rankings?force=1 -> rebuild now (the UI "Refresh data" button)
 * Falls back to stale cache if the live rebuild fails.
 *
 * Cache: Vercel KV, read from KV_REST_API_URL/KV_REST_API_TOKEN, which Vercel
 * injects automatically once KV storage is connected to the project.
 */
import { kv } from '@vercel/kv'
// @ts-ignore: plain ESM module shared with Node scripts
import { buildDataset } from '../shared/sources.mjs'

export const config = { runtime: 'edge' }

const KEY = 'dataset:v2'
const MAX_AGE_MS = 6 * 60 * 60 * 1000

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405)

  const force = new URL(request.url).searchParams.get('force') === '1'
  const cached = await kv.get<{ fetchedAt: string }>(KEY)

  if (cached && !force) {
    const age = Date.now() - new Date(cached.fetchedAt).getTime()
    if (age < MAX_AGE_MS) return json(cached)
  }

  try {
    const data = await buildDataset()
    await kv.set(KEY, data)
    return json(data)
  } catch (e) {
    if (cached) return json(cached) // stale beats nothing
    return json({ error: `Could not fetch live data: ${e instanceof Error ? e.message : e}` }, 502)
  }
}

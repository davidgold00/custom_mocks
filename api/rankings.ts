/**
 * GET /api/rankings         -> dataset (Redis-cached, rebuilt when older than 6h)
 * GET /api/rankings?force=1 -> rebuild now (the UI "Refresh data" button)
 * Falls back to stale cache if the live rebuild fails.
 *
 * Cache: Upstash Redis. The Vercel Marketplace integration injects
 * UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN when it is connected.
 */
import { redis } from './_lib/redis'
// @ts-ignore: plain ESM module shared with Node scripts
import { buildDataset } from '../shared/sources.mjs'

const KEY = 'dataset:v2'
const MAX_AGE_MS = 6 * 60 * 60 * 1000

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405)

  const force = new URL(request.url).searchParams.get('force') === '1'
  let cached: { fetchedAt: string } | null = null
  try {
    cached = await redis.get<{ fetchedAt: string }>(KEY)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Redis unavailable.' }, 503)
  }

  if (cached && !force) {
    const age = Date.now() - new Date(cached.fetchedAt).getTime()
    if (age < MAX_AGE_MS) return json(cached)
  }

  try {
    const data = await buildDataset()
    await redis.set(KEY, data)
    return json(data)
  } catch (e) {
    if (cached) return json(cached) // stale beats nothing
    return json({ error: `Could not fetch live data: ${e instanceof Error ? e.message : e}` }, 502)
  }
}

export default { fetch: handler }

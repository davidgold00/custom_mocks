/// <reference types="@cloudflare/workers-types/latest" />

/**
 * GET /api/rankings        → dataset (KV-cached, rebuilt when older than 6h)
 * GET /api/rankings?force=1 → rebuild now (the UI "Refresh data" button)
 * Falls back to stale cache if the live rebuild fails.
 */
// @ts-ignore — plain ESM module shared with Node scripts
import { buildDataset } from '../../shared/sources.mjs'

type Env = { MOCKS_KV: KVNamespace }

const KEY = 'dataset:v2'
const MAX_AGE_MS = 6 * 60 * 60 * 1000

const json = (data: unknown, status = 200) =>
  new Response(typeof data === 'string' ? data : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const force = new URL(request.url).searchParams.get('force') === '1'
  const cached = await env.MOCKS_KV.get(KEY)

  if (cached && !force) {
    try {
      const age = Date.now() - new Date(JSON.parse(cached).fetchedAt).getTime()
      if (age < MAX_AGE_MS) return json(cached)
    } catch { /* rebuild below */ }
  }

  try {
    const data = await buildDataset()
    await env.MOCKS_KV.put(KEY, JSON.stringify(data))
    return json(data)
  } catch (e) {
    if (cached) return json(cached) // stale beats nothing
    return json({ error: `Could not fetch live data: ${e instanceof Error ? e.message : e}` }, 502)
  }
}

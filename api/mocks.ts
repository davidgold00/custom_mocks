/**
 * Shareable draft-room snapshots (GET to load, POST to save), used by the
 * Draft Room's ?room= link sync. Storage: Vercel KV.
 */
import { kv } from '@vercel/kv'

export const config = { runtime: 'edge' }

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'GET') {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return json({ error: 'missing id' }, 400)
    const data = await kv.get(`mock:${id}`)
    return json(data ?? {})
  }

  if (request.method === 'POST') {
    try {
      const body = (await request.json()) as { id?: string; data?: unknown }
      if (!body?.id || typeof body.data === 'undefined') return json({ error: 'missing id or data' }, 400)
      await kv.set(`mock:${body.id}`, body.data)
      return json({ ok: true })
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'bad request' }, 400)
    }
  }

  return json({ error: 'Method not allowed.' }, 405)
}

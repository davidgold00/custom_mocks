import { json, now, randomId, requireUser } from '../../_lib/auth'

const MAX_BYTES = 256 * 1024
const MAX_ROWS = 50

/** POST /api/me/rankings — save an imported ranking list */
export const onRequestPost = requireUser(async ({ request, env }, user) => {
  let body: { name?: string; note?: string; order?: unknown; id?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Bad request.' }, 400)
  }
  const name = String(body.name ?? '').trim().slice(0, 60)
  if (!name || !Array.isArray(body.order) || body.order.length === 0) {
    return json({ error: 'Missing name or player order.' }, 400)
  }
  const order = JSON.stringify(body.order.map(String))
  if (order.length > MAX_BYTES) return json({ error: 'Ranking list too large.' }, 413)

  const count = await env.DB.prepare('SELECT COUNT(*) n FROM imported_rankings WHERE user_id = ?').bind(user.id).first<{ n: number }>()
  if ((count?.n ?? 0) >= MAX_ROWS) return json({ error: `Limit of ${MAX_ROWS} imports reached.` }, 409)

  // client may supply the id it generated so local + server stay in sync
  const id = /^[a-z0-9]{4,32}$/.test(String(body.id)) ? String(body.id) : randomId()
  await env.DB
    .prepare('INSERT OR REPLACE INTO imported_rankings (id, user_id, name, note, order_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, name, body.note ?? null, order, now())
    .run()
  return json({ id }, 201)
})

/** DELETE /api/me/rankings?id=… */
export const onRequestDelete = requireUser(async ({ request, env }, user) => {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return json({ error: 'Missing id.' }, 400)
  await env.DB.prepare('DELETE FROM imported_rankings WHERE id = ? AND user_id = ?').bind(id, user.id).run()
  return json({ ok: true })
})

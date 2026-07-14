import { sql } from '../_lib/db'
import { json, now, randomId, requireUser } from '../_lib/auth'

const MAX_BYTES = 256 * 1024
const MAX_ROWS = 50

const handler = requireUser(async (request, user) => {
  if (request.method === 'POST') {
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

    const { rows } = await sql`SELECT COUNT(*)::int AS n FROM imported_rankings WHERE user_id = ${user.id}`
    if ((rows[0]?.n ?? 0) >= MAX_ROWS) return json({ error: `Limit of ${MAX_ROWS} imports reached.` }, 409)

    // client may supply the id it generated so local + server stay in sync
    const id = /^[a-z0-9]{4,32}$/.test(String(body.id)) ? String(body.id) : randomId()
    await sql`
      INSERT INTO imported_rankings (id, user_id, name, note, order_json, created_at)
      VALUES (${id}, ${user.id}, ${name}, ${body.note ?? null}, ${order}, ${now()})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, note = EXCLUDED.note,
        order_json = EXCLUDED.order_json, created_at = EXCLUDED.created_at
    `
    return json({ id }, 201)
  }

  if (request.method === 'DELETE') {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return json({ error: 'Missing id.' }, 400)
    await sql`DELETE FROM imported_rankings WHERE id = ${id} AND user_id = ${user.id}`
    return json({ ok: true })
  }

  return json({ error: 'Method not allowed.' }, 405)
})

export default { fetch: handler }

import { sql } from '@vercel/postgres'
import { json, now, randomId, requireUser } from '../_lib/auth'

export const config = { runtime: 'edge' }

const MAX_BYTES = 512 * 1024
const MAX_ROWS = 200

export default requireUser(async (request, user) => {
  if (request.method === 'GET') {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return json({ error: 'Missing id.' }, 400)
    const { rows } = await sql`
      SELECT id, name, settings_json, teams_json, picks_json, created_at
      FROM drafts WHERE id = ${id} AND user_id = ${user.id}
    `
    const row = rows[0]
    if (!row) return json({ error: 'Not found.' }, 404)
    return json({
      id: row.id, name: row.name, createdAt: row.created_at,
      settings: JSON.parse(row.settings_json),
      teams: JSON.parse(row.teams_json),
      picks: JSON.parse(row.picks_json),
    })
  }

  if (request.method === 'POST') {
    let body: { name?: string; settings?: unknown; teams?: unknown; picks?: unknown }
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Bad request.' }, 400)
    }
    if (!body.settings || !Array.isArray(body.teams) || !Array.isArray(body.picks) || body.picks.length === 0) {
      return json({ error: 'Missing draft data.' }, 400)
    }
    const payload = [JSON.stringify(body.settings), JSON.stringify(body.teams), JSON.stringify(body.picks)]
    if (payload.join('').length > MAX_BYTES) return json({ error: 'Draft too large.' }, 413)

    const { rows } = await sql`SELECT COUNT(*)::int AS n FROM drafts WHERE user_id = ${user.id}`
    if ((rows[0]?.n ?? 0) >= MAX_ROWS) {
      // keep the newest; drop the oldest to stay under the cap
      await sql`
        DELETE FROM drafts WHERE user_id = ${user.id} AND id IN (
          SELECT id FROM drafts WHERE user_id = ${user.id} ORDER BY created_at ASC LIMIT 1
        )
      `
    }

    const id = randomId()
    const name = String(body.name ?? '').trim().slice(0, 80) || `Draft ${new Date().toLocaleDateString()}`
    await sql`
      INSERT INTO drafts (id, user_id, name, settings_json, teams_json, picks_json, created_at)
      VALUES (${id}, ${user.id}, ${name}, ${payload[0]}, ${payload[1]}, ${payload[2]}, ${now()})
    `
    return json({ id, name }, 201)
  }

  if (request.method === 'DELETE') {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return json({ error: 'Missing id.' }, 400)
    await sql`DELETE FROM drafts WHERE id = ${id} AND user_id = ${user.id}`
    return json({ ok: true })
  }

  return json({ error: 'Method not allowed.' }, 405)
})

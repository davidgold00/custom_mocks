import { sql } from '@vercel/postgres'
import { json, now, randomId, requireUser } from '../_lib/auth'

export const config = { runtime: 'edge' }

const MAX_BYTES = 256 * 1024
const MAX_ROWS = 50

export default requireUser(async (request, user) => {
  if (request.method === 'POST') {
    let body: { id?: string; name?: string; teams?: number; bots?: unknown; globalBot?: unknown }
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Bad request.' }, 400)
    }
    const name = String(body.name ?? '').trim().slice(0, 60)
    if (!name || !Array.isArray(body.bots) || !body.globalBot) return json({ error: 'Missing name or config.' }, 400)
    const cfg = JSON.stringify({ bots: body.bots, globalBot: body.globalBot })
    if (cfg.length > MAX_BYTES) return json({ error: 'Config too large.' }, 413)

    const { rows } = await sql`SELECT COUNT(*)::int AS n FROM bot_configs WHERE user_id = ${user.id}`
    if ((rows[0]?.n ?? 0) >= MAX_ROWS) return json({ error: `Limit of ${MAX_ROWS} saved setups reached.` }, 409)

    // client may supply the id it generated so local + server stay in sync
    const id = /^[a-z0-9]{4,32}$/.test(String(body.id)) ? String(body.id) : randomId()
    await sql`
      INSERT INTO bot_configs (id, user_id, name, teams, config_json, created_at)
      VALUES (${id}, ${user.id}, ${name}, ${Number(body.teams) || 10}, ${cfg}, ${now()})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, teams = EXCLUDED.teams,
        config_json = EXCLUDED.config_json, created_at = EXCLUDED.created_at
    `
    return json({ id }, 201)
  }

  if (request.method === 'DELETE') {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return json({ error: 'Missing id.' }, 400)
    await sql`DELETE FROM bot_configs WHERE id = ${id} AND user_id = ${user.id}`
    return json({ ok: true })
  }

  return json({ error: 'Method not allowed.' }, 405)
})

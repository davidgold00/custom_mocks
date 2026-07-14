import { json, now, randomId, requireUser } from '../../_lib/auth'

const MAX_BYTES = 256 * 1024
const MAX_ROWS = 50

/** POST /api/me/bot-configs — save a bot setup */
export const onRequestPost = requireUser(async ({ request, env }, user) => {
  let body: { id?: string; name?: string; teams?: number; bots?: unknown; globalBot?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Bad request.' }, 400)
  }
  const name = String(body.name ?? '').trim().slice(0, 60)
  if (!name || !Array.isArray(body.bots) || !body.globalBot) return json({ error: 'Missing name or config.' }, 400)
  const config = JSON.stringify({ bots: body.bots, globalBot: body.globalBot })
  if (config.length > MAX_BYTES) return json({ error: 'Config too large.' }, 413)

  const count = await env.DB.prepare('SELECT COUNT(*) n FROM bot_configs WHERE user_id = ?').bind(user.id).first<{ n: number }>()
  if ((count?.n ?? 0) >= MAX_ROWS) return json({ error: `Limit of ${MAX_ROWS} saved setups reached.` }, 409)

  // client may supply the id it generated so local + server stay in sync
  const id = /^[a-z0-9]{4,32}$/.test(String(body.id)) ? String(body.id) : randomId()
  await env.DB
    .prepare('INSERT OR REPLACE INTO bot_configs (id, user_id, name, teams, config_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, name, Number(body.teams) || 10, config, now())
    .run()
  return json({ id }, 201)
})

/** DELETE /api/me/bot-configs?id=… */
export const onRequestDelete = requireUser(async ({ request, env }, user) => {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return json({ error: 'Missing id.' }, 400)
  await env.DB.prepare('DELETE FROM bot_configs WHERE id = ? AND user_id = ?').bind(id, user.id).run()
  return json({ ok: true })
})

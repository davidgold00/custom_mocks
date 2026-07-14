import { json, now, randomId, requireUser } from '../../_lib/auth'

const MAX_BYTES = 512 * 1024
const MAX_ROWS = 200

/** GET /api/me/drafts?id=… — full saved draft */
export const onRequestGet = requireUser(async ({ request, env }, user) => {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return json({ error: 'Missing id.' }, 400)
  const row = await env.DB
    .prepare('SELECT id, name, settings_json, teams_json, picks_json, created_at FROM drafts WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first<any>()
  if (!row) return json({ error: 'Not found.' }, 404)
  return json({
    id: row.id, name: row.name, createdAt: row.created_at,
    settings: JSON.parse(row.settings_json),
    teams: JSON.parse(row.teams_json),
    picks: JSON.parse(row.picks_json),
  })
})

/** POST /api/me/drafts — save a completed draft */
export const onRequestPost = requireUser(async ({ request, env }, user) => {
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

  const count = await env.DB.prepare('SELECT COUNT(*) n FROM drafts WHERE user_id = ?').bind(user.id).first<{ n: number }>()
  if ((count?.n ?? 0) >= MAX_ROWS) {
    // keep the newest; drop the oldest to stay under the cap
    await env.DB.prepare(
      'DELETE FROM drafts WHERE user_id = ? AND id IN (SELECT id FROM drafts WHERE user_id = ? ORDER BY created_at ASC LIMIT 1)',
    ).bind(user.id, user.id).run()
  }

  const id = randomId()
  const name = String(body.name ?? '').trim().slice(0, 80) || `Draft ${new Date().toLocaleDateString()}`
  await env.DB
    .prepare('INSERT INTO drafts (id, user_id, name, settings_json, teams_json, picks_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, name, payload[0], payload[1], payload[2], now())
    .run()
  return json({ id, name }, 201)
})

/** DELETE /api/me/drafts?id=… */
export const onRequestDelete = requireUser(async ({ request, env }, user) => {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return json({ error: 'Missing id.' }, 400)
  await env.DB.prepare('DELETE FROM drafts WHERE id = ? AND user_id = ?').bind(id, user.id).run()
  return json({ ok: true })
})

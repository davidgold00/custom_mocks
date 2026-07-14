import { json, now, requireUser } from '../../_lib/auth'

const MAX_BYTES = 64 * 1024

/** PUT /api/me/prefs — upsert the user's app preferences blob */
export const onRequestPut = requireUser(async ({ request, env }, user) => {
  const body = await request.text()
  if (body.length > MAX_BYTES) return json({ error: 'Prefs too large.' }, 413)
  try {
    JSON.parse(body)
  } catch {
    return json({ error: 'Invalid JSON.' }, 400)
  }
  await env.DB
    .prepare(
      `INSERT INTO user_prefs (user_id, prefs_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET prefs_json = excluded.prefs_json, updated_at = excluded.updated_at`,
    )
    .bind(user.id, body, now())
    .run()
  return json({ ok: true })
})

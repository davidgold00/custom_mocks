import { sql } from '@vercel/postgres'
import { json, now, requireUser } from '../_lib/auth'

export const config = { runtime: 'edge' }

const MAX_BYTES = 64 * 1024

/** PUT /api/me/prefs: upsert the user's app preferences blob */
export default requireUser(async (request, user) => {
  if (request.method !== 'PUT') return json({ error: 'Method not allowed.' }, 405)

  const body = await request.text()
  if (body.length > MAX_BYTES) return json({ error: 'Prefs too large.' }, 413)
  try {
    JSON.parse(body)
  } catch {
    return json({ error: 'Invalid JSON.' }, 400)
  }

  await sql`
    INSERT INTO user_prefs (user_id, prefs_json, updated_at) VALUES (${user.id}, ${body}, ${now()})
    ON CONFLICT (user_id) DO UPDATE SET prefs_json = EXCLUDED.prefs_json, updated_at = EXCLUDED.updated_at
  `
  return json({ ok: true })
})

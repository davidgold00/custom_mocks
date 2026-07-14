import { sql } from '../_lib/db'
import { isRateLimited } from '../_lib/rateLimit'
import {
  json, now, hashPassword, safeEqual, createSession, sessionCookie, dbErrorResponse,
} from '../_lib/auth'

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  if (await isRateLimited(request, 'login', 12, 15 * 60)) {
    return json({ error: 'Too many login attempts. Please try again in a few minutes.' }, 429)
  }

  let body: { username?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Bad request.' }, 400)
  }
  const username = String(body.username ?? '').trim()
  const password = String(body.password ?? '')
  const fail = () => json({ error: 'Wrong username or password.' }, 401)
  if (!username || !password) return fail()

  try {
    const { rows } = await sql<{ id: string; username: string; pass_hash: string; pass_salt: string; pass_iters: number }>`
      SELECT id, username, pass_hash, pass_salt, pass_iters FROM users WHERE lower(username) = lower(${username})
    `
    const row = rows[0]
    if (!row) {
      await hashPassword(password) // burn the same time whether or not the user exists
      return fail()
    }

    const { hash } = await hashPassword(password, row.pass_salt, row.pass_iters)
    if (!safeEqual(hash, row.pass_hash)) return fail()

    await sql`UPDATE users SET last_login_at = ${now()} WHERE id = ${row.id}`
    const { token, expires } = await createSession(row.id)
    return json({ user: { id: row.id, username: row.username } }, 200, { 'Set-Cookie': sessionCookie(request, token, expires) })
  } catch (e) {
    return dbErrorResponse(e)
  }
}

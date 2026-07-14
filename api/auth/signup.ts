import { sql } from '../_lib/db'
import { isRateLimited } from '../_lib/rateLimit'
import {
  json, randomId, now, hashPassword, createSession, sessionCookie, validateCredentials, dbErrorResponse,
} from '../_lib/auth'

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  if (await isRateLimited(request, 'signup', 5, 60 * 60)) {
    return json({ error: 'Too many signup attempts. Please try again later.' }, 429)
  }

  let body: { username?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Bad request.' }, 400)
  }

  const invalid = validateCredentials(body.username, body.password)
  if (invalid) return json({ error: invalid }, 400)
  const username = body.username!.trim()

  try {
    const { rows: existing } = await sql`SELECT id FROM users WHERE lower(username) = lower(${username})`
    if (existing.length) return json({ error: 'That username is taken.' }, 409)

    const { hash, salt, iters } = await hashPassword(body.password!)
    const id = randomId()
    try {
      await sql`
        INSERT INTO users (id, username, pass_hash, pass_salt, pass_iters, created_at, last_login_at)
        VALUES (${id}, ${username}, ${hash}, ${salt}, ${iters}, ${now()}, ${now()})
      `
    } catch {
      return json({ error: 'That username is taken.' }, 409) // unique-race fallback
    }

    const { token, expires } = await createSession(id)
    return json({ user: { id, username } }, 201, { 'Set-Cookie': sessionCookie(request, token, expires) })
  } catch (e) {
    return dbErrorResponse(e)
  }
}

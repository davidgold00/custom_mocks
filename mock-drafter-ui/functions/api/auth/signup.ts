import {
  type Env, json, randomId, now, hashPassword, createSession, sessionCookie, validateCredentials,
} from '../../_lib/auth'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { username?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Bad request.' }, 400)
  }

  const invalid = validateCredentials(body.username, body.password)
  if (invalid) return json({ error: invalid }, 400)
  const username = body.username!.trim()

  const exists = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
  if (exists) return json({ error: 'That username is taken.' }, 409)

  const { hash, salt, iters } = await hashPassword(body.password!)
  const id = randomId()
  try {
    await env.DB
      .prepare('INSERT INTO users (id, username, pass_hash, pass_salt, pass_iters, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, username, hash, salt, iters, now(), now())
      .run()
  } catch {
    return json({ error: 'That username is taken.' }, 409) // unique-race fallback
  }

  const { token, expires } = await createSession(env.DB, id)
  return json({ user: { id, username } }, 201, { 'Set-Cookie': sessionCookie(token, expires) })
}

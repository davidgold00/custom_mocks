import {
  type Env, json, now, hashPassword, safeEqual, createSession, sessionCookie, dbErrorResponse,
} from '../../_lib/auth'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
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
    const row = await env.DB
      .prepare('SELECT id, username, pass_hash, pass_salt, pass_iters FROM users WHERE username = ?')
      .bind(username)
      .first<{ id: string; username: string; pass_hash: string; pass_salt: string; pass_iters: number }>()
    if (!row) {
      await hashPassword(password) // burn the same time whether or not the user exists
      return fail()
    }

    const { hash } = await hashPassword(password, row.pass_salt, row.pass_iters)
    if (!safeEqual(hash, row.pass_hash)) return fail()

    await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(now(), row.id).run()
    const { token, expires } = await createSession(env.DB, row.id)
    return json({ user: { id: row.id, username: row.username } }, 200, { 'Set-Cookie': sessionCookie(request, token, expires) })
  } catch (e) {
    return dbErrorResponse(e)
  }
}

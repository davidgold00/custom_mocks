import { type Env, json, destroySession, clearSessionCookie } from '../../_lib/auth'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  await destroySession(request, env.DB).catch(() => {})
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(request) })
}

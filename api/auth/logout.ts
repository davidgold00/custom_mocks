import { json, destroySession, clearSessionCookie } from '../_lib/auth'

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  await destroySession(request).catch(() => {})
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(request) })
}

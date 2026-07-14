import { json, getUser, unauthorized, dbErrorResponse } from '../_lib/auth'

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405)
  try {
    const user = await getUser(request)
    return user ? json({ user }) : unauthorized()
  } catch (e) {
    return dbErrorResponse(e)
  }
}

export default { fetch: handler }

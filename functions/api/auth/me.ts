import { type Env, json, getUser, unauthorized, dbErrorResponse } from '../../_lib/auth'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getUser(request, env.DB)
    return user ? json({ user }) : unauthorized()
  } catch (e) {
    return dbErrorResponse(e)
  }
}

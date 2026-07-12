import { type Env, json, getUser, unauthorized } from '../../_lib/auth'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getUser(request, env.DB)
  return user ? json({ user }) : unauthorized()
}

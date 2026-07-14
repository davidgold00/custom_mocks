import { sql } from '@vercel/postgres'
import { json, requireUser } from '../_lib/auth'

export const config = { runtime: 'edge' }

/** GET /api/me/library: everything the client needs to hydrate after login */
export default requireUser(async (request, user) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405)

  const [prefs, botConfigs, rankings, drafts] = await Promise.all([
    sql`SELECT prefs_json FROM user_prefs WHERE user_id = ${user.id}`,
    sql`SELECT id, name, teams, config_json, created_at FROM bot_configs WHERE user_id = ${user.id} ORDER BY created_at`,
    sql`SELECT id, name, note, order_json, created_at FROM imported_rankings WHERE user_id = ${user.id} ORDER BY created_at`,
    sql`SELECT id, name, created_at FROM drafts WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 100`,
  ])

  return json({
    prefs: prefs.rows[0] ? JSON.parse(prefs.rows[0].prefs_json) : null,
    botConfigs: botConfigs.rows.map((r: any) => ({
      id: r.id, name: r.name, teams: r.teams, createdAt: r.created_at, ...JSON.parse(r.config_json),
    })),
    rankings: rankings.rows.map((r: any) => ({
      id: r.id, name: r.name, note: r.note ?? undefined, createdAt: r.created_at, order: JSON.parse(r.order_json),
    })),
    drafts: drafts.rows.map((r: any) => ({ id: r.id, name: r.name, createdAt: r.created_at })),
  })
})

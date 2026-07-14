import { json, requireUser } from '../../_lib/auth'

/** GET /api/me/library: everything the client needs to hydrate after login */
export const onRequestGet = requireUser(async ({ env }, user) => {
  const [prefs, botConfigs, rankings, drafts] = await Promise.all([
    env.DB.prepare('SELECT prefs_json FROM user_prefs WHERE user_id = ?').bind(user.id).first<{ prefs_json: string }>(),
    env.DB.prepare('SELECT id, name, teams, config_json, created_at FROM bot_configs WHERE user_id = ? ORDER BY created_at').bind(user.id).all(),
    env.DB.prepare('SELECT id, name, note, order_json, created_at FROM imported_rankings WHERE user_id = ? ORDER BY created_at').bind(user.id).all(),
    env.DB.prepare('SELECT id, name, created_at FROM drafts WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').bind(user.id).all(),
  ])
  return json({
    prefs: prefs ? JSON.parse(prefs.prefs_json) : null,
    botConfigs: (botConfigs.results ?? []).map((r: any) => ({
      id: r.id, name: r.name, teams: r.teams, createdAt: r.created_at, ...JSON.parse(r.config_json),
    })),
    rankings: (rankings.results ?? []).map((r: any) => ({
      id: r.id, name: r.name, note: r.note ?? undefined, createdAt: r.created_at, order: JSON.parse(r.order_json),
    })),
    drafts: (drafts.results ?? []).map((r: any) => ({ id: r.id, name: r.name, createdAt: r.created_at })),
  })
})

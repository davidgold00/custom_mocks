/**
 * Applies migrations/0001_init.sql to whichever Postgres database
 * DATABASE_URL points at. Run with env vars loaded, e.g.:
 *
 *   vercel env pull .env.local
 *   npm run db:migrate
 *
 * Safe to re-run: every statement is CREATE ... IF NOT EXISTS.
 */
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations', '0001_init.sql')
const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
if (!connectionString) {
  throw new Error('Missing DATABASE_URL. Pull the connected Vercel project environment before running migrations.')
}
const sql = neon(connectionString)

const statements = readFileSync(file, 'utf8')
  .split(/;\s*(?:\n|$)/)
  .map((s) => s.trim())
  .filter(Boolean)

for (const stmt of statements) {
  await sql.query(stmt)
  console.log('ok:', stmt.split('\n')[0].slice(0, 70))
}
console.log(`\nApplied ${statements.length} statements.`)

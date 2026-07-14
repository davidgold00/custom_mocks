/**
 * Writes a bundled snapshot of the live dataset to src/data/rankings-2026.json.
 * The app uses this as its offline/first-load fallback; at runtime it refreshes
 * itself from /api/rankings. Run: npm run update-data
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDataset, SEASON } from '../shared/sources.mjs'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', `rankings-${SEASON}.json`)

const data = await buildDataset()
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(data))

console.log(`Wrote ${OUT}`)
console.log(`  season ${data.season} · ${data.playerCount} players · ${data.sources.length} sources`)
for (const s of data.sources) console.log(`  ${s.id.padEnd(16)} ${String(s.coverage).padStart(3)} ranked · ${s.label}`)
if (data.errors.length) console.log('  errors:', data.errors)

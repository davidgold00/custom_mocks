# BoardRoom — 2026 Fantasy Football Draft Simulator

A customizable mock draft simulator built around **your rankings**. Pick a live public
ranking (real-market ADP or expert ranks) as a base, reshape it into your own board, and
practice against bots that draft off that board — reaching, sniping, and panicking like
real league mates, so you can rehearse the worst case before draft night.

## Player data (2026 season)

**21 live ranking sources from 6 independent providers**, fetched from public APIs and
merged into one dataset (`shared/sources.mjs`):

- **Fantasy Football Calculator** — market ADP from real mock drafts (PPR ×3 league
  sizes, Half PPR, Standard, Superflex)
- **ESPN Fantasy** — live ADP, staff ranks (PPR + Standard), season projections,
  injury status
- **Sleeper** — platform player rank, 24-hour trending adds (news movers), rookie flags
- **FantasyCalc** — crowdsourced values from real trades (redraft/dynasty × 1QB/SF)
- **DynastyProcess** — expert-consensus dynasty values (1QB + Superflex)
- **MyFantasyLeague** — ADP and auction values from recent MFL drafts

The app keeps itself fresh three ways:

1. **Automatic** — on open, if the data is more than ~20h old it refreshes itself
   (`/api/rankings`, KV-cached in production, live-fetching in dev).
2. **Manual** — the "Refresh data" button on the Rankings page forces a re-fetch.
3. **Bundled fallback** — `npm run update-data` re-snapshots `src/data/rankings-2026.json`
   for first-load/offline use.

A source that fails or returns thin data is dropped for that refresh instead of breaking
the rest — the merge is resilient by design.

## Bring your own rankings

- **Upload Excel/CSV** (Rankings → Import): needs a "Player" column; "Rank" and "Pos"
  columns improve matching. You get a match report (matched / unmatched with reasons /
  duplicates) before saving.
- **Paste a link**: direct CSV/Excel links and public Google Sheets work; anything else
  gets a clear explanation of why not.
- Imports are saved to your local library and can be set as the bots' draft board.
- Bot/league setups can also be saved and reloaded (Bots → Saved setups).

## Quick start

```bash
npm i
npm run db:migrate   # one-time: create the local user database (D1/SQLite)
npm run dev:full     # full app with accounts at http://localhost:8788
npm run dev          # UI-only (vite HMR, http://localhost:5173) — sign-in won't work here
```

## User accounts

BoardRoom requires an account (username + password; email/phone deliberately not
collected yet). All data is stored in **Cloudflare D1** (`migrations/0001_init.sql`):

- `users` — PBKDF2-SHA256 password hashes (150k iterations, per-user salt, stored
  iteration count so cost can be raised later)
- `sessions` — 30-day sessions; the DB stores only a SHA-256 of the token, the browser
  holds it in an httpOnly/Secure/SameSite cookie
- `bot_configs`, `imported_rankings`, `drafts`, `user_prefs` — all foreign-keyed to
  users with cascade delete, indexed on every lookup path, JSON payloads size-capped
  and row-capped per user

Completed drafts save to the account automatically and are browsable on the Results
page. On first sign-in, any pre-account data on the device (imports, bot setups) is
migrated up to the account; after that the server is the source of truth and working
state syncs in the background.

### Deploying the database

```bash
npx wrangler d1 create boardroom-db   # once; paste database_id into wrangler.toml
npm run db:migrate:prod               # apply migrations to production
```

## How it works

1. **Rankings** — choose a base source, then drag players (or click a rank number to
   type a new one) to build your board. Edits persist locally.
2. **League settings** — teams, rounds, roster slots.
3. **Bots** — per-seat personalities (QB timing, positional emphasis, risk, chaos,
   favorites). Presets like Zero-RB or Chaotic materialize real slider values.
4. **Draft room** — claim a seat and draft. Bots pick off *your* board with seeded
   randomness: every sim plays out differently, but the same seed replays identically.

## Where the logic lives

- `scripts/update-data.mjs` — fetches + merges the public sources into the snapshot
- `src/lib/rankings.ts` — loads the snapshot, builds the active board (base + your edits)
- `src/lib/draftEngine.ts` — bot pick logic (needs, gates, personality, seeded noise)
- `src/store.ts` — persisted settings, bots, and ranking preferences (Zustand)

## Deploy

Built for Cloudflare Pages (`wrangler.toml`); `functions/api/mocks.ts` provides optional
KV-backed draft-room sharing.

## License

Internal MVP. ADP/rankings data comes from public endpoints — verify licensing before any
commercial release.

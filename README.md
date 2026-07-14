# BoardRoom

Mock draft simulator for fantasy football. The pitch in one sentence: practice
against the league you actually play in, not against twelve copies of the same
ADP list.

Every mock draft tool I've used has the same problem. The computer teams pick
straight off a ranking, so after two or three runs you know exactly what's going
to happen. Nobody reaches, nobody panics, nobody takes a QB in the second round
because "he won them their title in 2023." Real drafts are messy in ways that
matter for your prep, and if the sim can't reproduce the mess, it can't tell you
anything useful about your plan.

So the whole design here revolves around two things: the draft board is *yours*
(start from live data, reshape it however you want, or upload a spreadsheet),
and every opponent seat is a configurable personality that drafts off that
board with realistic amounts of chaos.

## Running it

First time only, one-time setup with Vercel (details in the deployment section
below):

```
npm i -g vercel
vercel login
vercel link
vercel env pull .env.local
```

Then day to day:

```
npm i
npm run dev
```

That's it, then open the local URL `vercel dev` prints (usually
http://localhost:3000). The dev command runs the Vite app and every function
under `api/` together on one port, using whatever Postgres/KV database is
connected to the linked Vercel project.

Other commands you'll actually use:

```
npm run dev:open       # skip the login screen while debugging (see below)
npm run update-data    # re-snapshot the bundled player data from live sources
npm run db:migrate     # apply DB migrations to whatever POSTGRES_URL points at
npm run build          # typecheck + production build
```

`dev:open` exists because logging in every time you restart the app during
debugging gets old fast. It fakes a signed-in user, skips all account sync, and
puts an amber "no auth" badge in the header so you can't forget which mode
you're in. The bypass is compiled out of production builds entirely, since it
hinges on `import.meta.env.DEV`, which is statically false there, so there's no
way to ship it by accident. Because it doesn't touch the API at all, plain
`npm run dev:open` (just vite, no `vercel dev` needed) is also the fastest way
to poke at the UI.

## Where the player data comes from

This was the part I cared about most. Stale data makes a draft sim worthless:
rankings move every week in the summer, and by August an outdated ADP list is
actively misleading.

The app pulls from about 20 live public sources across six providers:

- **Fantasy Football Calculator**: ADP from real mock drafts. PPR, half PPR,
  standard, superflex, and a couple of league sizes.
- **ESPN**: their live ADP, staff ranks (PPR and standard), season projections,
  and injury designations.
- **Sleeper**: overall player rank, plus rookie flags and injury status for the
  whole pool.
- **FantasyCalc**: values computed from actual trades in redraft and dynasty
  leagues, 1QB and superflex.
- **DynastyProcess**: dynasty ECR-based values, 1QB and superflex.
- **MyFantasyLeague**: ADP and auction values from recent MFL drafts.

All the fetching and merging lives in `shared/sources.mjs`. Players get matched
across providers by normalized name + position (suffixes like Jr/III are
stripped; team defenses match by team), and each source card in the UI shows
the date its data is actually from. FFC reports its draft window, MFL reports
a timestamp, and so on. If a source is down or comes back thin, it just gets
dropped from that refresh instead of taking everything down with it. Rankings
refresh themselves when the app is opened after ~20 hours, and there's a
manual refresh button on the Rankings page.

One honest limitation: some paid rankings (Fantasy Flock, purchased draft kits,
etc.) sit behind logins and can't be pulled automatically. That's what the
import feature is for. Upload the Excel/CSV export, or paste a public Google
Sheets link, and it becomes a source card like any other. The importer shows
you a match report first (what matched, what didn't, and why) so a misspelled
name never silently disappears.

## How the bots decide

Each seat has personality settings: how early they want a QB, how hard they
lean RB/WR/TE, how much they care about roster needs vs. best-available, risk
appetite, an unpredictability dial, and a list of favorite players they'll
reach a little early for. Presets (Zero RB, RB heavy, late QB, chaotic, strict
BPA) fill in the sliders for you.

The unpredictability model took some iteration to get right. Adding random
noise to pick scores, the obvious approach, produces garbage: every so often
the noise spikes and someone takes a 40th-ranked player first overall, which no
human has ever done. The current model works differently. There's a hard cap on
how far below the best available player a bot may reach, and the cap scales
with the round: in round one it's a handful of spots at most, growing slowly to
maybe ten spots in the middle rounds and a bit more late, when real drafters
genuinely do go off the board. Inside that window, picks follow a steep taper,
where the top choice wins most of the time, the second choice sometimes, and so
on. Grabbing a kicker in round 14 is exempt from the cap, because that's not a
reach, that's just filling your lineup.

Simulated over 300 drafts at the default settings, the first overall pick is
always one of the top few players on the board, round 2-4 reaches max out
around five spots, and every draft still plays out differently. Each draft
runs from a seed, so any weird result can be replayed exactly.

## Accounts

Accounts are username + password only for now (email will come later).
Everything is stored in Postgres, schema in `migrations/0001_init.sql`.
Passwords are hashed with PBKDF2-SHA256 at 150k iterations with per-user salts,
and the iteration count is stored per user so the cost can be raised later
without breaking old logins. Sessions last 30 days; the browser holds the token
in an httpOnly cookie and the database only ever stores a hash of it.

Saved to the account: completed drafts (automatic, they show up on the Results
page), bot setups, imported rankings, and your working preferences. First
sign-in migrates whatever was on the device up to the account; after that the
server wins.

Before opening signups to strangers, put a rate limit on the login endpoint
(Vercel's firewall rules, or a small check against a KV counter, both work).

## Deploying to Vercel

The app is one Vercel project: the React build serves as static files, and
everything under `api/` runs as Edge Functions. Two pieces of storage plug into
that project from the dashboard, no separate accounts needed.

**One-time setup, in the Vercel dashboard:**

1. Import this repo as a new Vercel project (New Project -> pick the repo). The
   Vite framework preset is detected automatically; the build command and
   output directory are already set in `vercel.json`.
2. Open the project's **Storage** tab -> **Create Database** -> add a
   **Postgres** database -> connect it to the project. This injects
   `POSTGRES_URL` and friends into the project's environment automatically.
3. Storage tab again -> add a **KV** (Redis) store -> connect it to the same
   project. This injects `KV_REST_API_URL` / `KV_REST_API_TOKEN` the same way.
   KV holds the cached player-rankings dataset and shareable draft-room links;
   nothing sensitive lives in it.
4. Run the schema once, either way is fine:
   - **Dashboard**: open the Postgres database's Query tab and paste the
     contents of `migrations/0001_init.sql`, then run it.
   - **CLI**: from your machine, `vercel link` the project, then
     `vercel env pull .env.production.local --environment=production` and
     `node --env-file=.env.production.local scripts/migrate.mjs`.
5. Push to the branch Vercel is watching (or click Deploy). Done.

**What I actually need from you** to help with any of this: not much, and
nothing secret. I don't need your Vercel password, an API token, or a database
connection string pasted into chat, since the code reads everything from
environment variables Vercel injects on its own once storage is connected.
What's useful to know is:

- The project name/slug once it exists, so I can double check anything
  project-specific.
- Confirmation that Postgres and KV storage are both added and connected (step
  2/3 above) before we debug anything data-related, since most "it's broken"
  reports at this stage are just a missing storage connection.
- Whether you want to run the CLI steps yourself (`vercel login` is an
  interactive browser flow I can't do on your behalf) or handle migrations
  through the dashboard Query tab instead.

## Layout

```
src/            React app (vite + TS + Tailwind + zustand)
  lib/          draft engine, rankings/board logic, auth + data stores
  pages/        Dashboard, Rankings, Draft Room, Results, Bots, About, Auth
api/            Vercel Edge Functions (the API)
  auth/         signup, login, logout, me
  me/           library, prefs, bot-configs, rankings, drafts
  rankings.ts   live dataset, KV-cached
  import-url.ts server-side fetch for pasted rankings links
  mocks.ts      shareable draft-room snapshots (KV)
shared/         data-source adapters, used by the API, the dev server,
                and the snapshot script, so there's one implementation
scripts/        update-data.mjs (dataset snapshot), migrate.mjs (DB schema)
migrations/     Postgres schema
```

The one structural rule worth knowing: the data-fetching code is written once
in `shared/` as plain ESM and runs unchanged in Node and on Vercel's Edge
runtime. When the rankings logic changes, dev and production can't drift apart.

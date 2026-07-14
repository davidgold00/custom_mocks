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

```
npm i
npm run dev
```

That's it, then open http://localhost:5173. The dev command starts three things
at once: the vite dev server, the API (Cloudflare Pages Functions running
locally through wrangler), and a local SQLite database for accounts. Migrations
get applied automatically on startup, so a fresh clone works without any setup
ritual.

Other commands you'll actually use:

```
npm run dev:open       # skip the login screen while debugging (see below)
npm run dev:full       # serve the production build + API on :8788
npm run update-data    # re-snapshot the bundled player data from live sources
npm run db:migrate     # apply DB migrations locally (dev does this for you)
npm run build          # typecheck + production build
```

`dev:open` exists because logging in every time you restart the app during
debugging gets old fast. It fakes a signed-in user, skips all account sync, and
puts an amber "no auth" badge in the header so you can't forget which mode
you're in. The bypass is compiled out of production builds entirely, since it
hinges on `import.meta.env.DEV`, which is statically false there, so there's no
way to ship it by accident.

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

Accounts are username + password only for now (email will come with deployment).
Everything is stored in Cloudflare D1, schema in `migrations/0001_init.sql`.
Passwords are hashed with PBKDF2-SHA256 at 150k iterations with per-user salts,
and the iteration count is stored per user so the cost can be raised later
without breaking old logins. Sessions last 30 days; the browser holds the token
in an httpOnly cookie and the database only ever stores a hash of it.

Saved to the account: completed drafts (automatic, they show up on the Results
page), bot setups, imported rankings, and your working preferences. First
sign-in migrates whatever was on the device up to the account; after that the
server wins.

Deploying the database is two commands:

```
npx wrangler d1 create boardroom-db     # once, then paste the id into wrangler.toml
npm run db:migrate:prod
```

Before opening signups to strangers, put a rate limit on the login endpoint
(a Cloudflare WAF rule is the easy version).

## Layout

```
src/            React app (vite + TS + Tailwind + zustand)
  lib/          draft engine, rankings/board logic, auth + data stores
  pages/        Dashboard, Rankings, Draft Room, Results, Bots, About, Auth
functions/      Cloudflare Pages Functions (the API)
  api/auth/     signup, login, logout, me
  api/me/       library, prefs, bot-configs, rankings, drafts
shared/         data-source adapters, used by the API, the dev server,
                and the snapshot script, so there's one implementation
scripts/        update-data.mjs (writes src/data/rankings-2026.json)
migrations/     D1 schema
```

The one structural rule worth knowing: the data-fetching code is written once
in `shared/` as plain ESM and runs unchanged in Node and in Workers. When the
rankings logic changes, dev and production can't drift apart.

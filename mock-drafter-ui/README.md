# Mock Drafter — 2026 Fantasy Football Draft Simulator

A customizable mock draft simulator built around **your rankings**. Pick a live public
ranking (real-market ADP or expert ranks) as a base, reshape it into your own board, and
practice against bots that draft off that board — reaching, sniping, and panicking like
real league mates, so you can rehearse the worst case before draft night.

## Player data (2026 season)

Player data is **fetched live from public sources** and bundled as a snapshot at
`src/data/rankings-2026.json`:

- **Fantasy Football Calculator** — market ADP from real mock drafts (PPR, Half PPR,
  Standard, Superflex/2QB)
- **ESPN Fantasy** — live ADP across ESPN leagues + staff PPR ranks, injury status

Refresh anytime (takes ~5 seconds):

```bash
npm run update-data
```

The snapshot records when it was fetched; the UI shows the freshness date in the header,
Dashboard, and Rankings page. Re-run before your draft for the latest ADP.

## Quick start

```bash
npm i
npm run dev        # http://localhost:5173
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

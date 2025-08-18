# Mock Drafter — Front-End MVP

This is a **front-end only** React + TypeScript + Tailwind UI for a customizable fantasy football mock draft simulator. It includes:

- League setup (teams, rounds, roster requirements)
- Bot configuration (presets + sliders for QB timing, positional emphasis, team-needs sensitivity, risk, randomness, K/DST timing, favorites)
- Draft room with a **client-side rule-based** engine (for demo)
- Results page with **Export JSON**

> Notes
> - Sample players are bundled at `src/data/players.json` (small list). Replace with your own ADP/rankings later.
> - This is a local simulation for demo purposes. No backend or real Sleeper integration yet.

## Quick Start

```bash
# inside this folder
npm i
npm run dev
```

Open http://localhost:5173

## Integrating Real Data

1. Replace `src/data/players.json` with a larger list:
   ```ts
   interface Player { id: string; name: string; team: string; pos: 'QB'|'RB'|'WR'|'TE'|'K'|'DST'; adp: number }
   ```
2. Keep it sorted by ascending ADP for best results.

## Where the Logic Lives

- `src/lib/draftEngine.ts` — rule-based pick logic (K/DST delay, team needs, positional emphasis, QB timing, risk, favorites, randomness).
- `src/store.ts` — Zustand store for settings, bots, and draft state.

## Roadmap Hooks (left as TODOs for back-end integration)

- Wire league & player data loaders
- WebSocket draft updates
- Export CSV, shareable links
- Per-pick explanations (why the bot picked a player)
- Draft recap charts (requires real data volume)

## License

For internal MVP/demo purposes only. Replace data sources with licensed feeds before any public release.

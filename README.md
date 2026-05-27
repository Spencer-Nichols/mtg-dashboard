# MTG Dashboard

A personal collection tracker for Commander players. Track your binder's value over time, manage a wishlist with live price tracking, and brew new decks using keyword-based card search powered by Scryfall and EDHREC.

## Features

- **Binder** — Track cards you own with daily price snapshots, value sparklines, and gain/loss breakdowns
- **Wishlist** — Monitor cards you're targeting with live price deltas and one-click move to binder
- **Brew** — Find cards by function (ramp, draw, removal, etc.), filtered by color identity, card type, CMC, and budget. Results sorted by EDHREC popularity
- **Card Search** — Look up any card with oracle text, pricing, and synergy suggestions via EDHREC
- **Card of the Hour** — Hourly highlight from your binder

## Stack

- [Next.js 14](https://nextjs.org) (App Router)
- [Tailwind CSS](https://tailwindcss.com)
- [Scryfall API](https://scryfall.com/docs/api) — card data and prices
- [EDHREC](https://edhrec.com) — synergy and popularity data
- Data stored locally in JSON / markdown files

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

### Data files

The app expects two files outside the project directory:

| File | Purpose |
|---|---|
| `~/Projects/scryfall/binder.json` | Your card collection |
| `~/.claude/projects/.../mtg_decks_wishlist.md` | Wishlist (markdown format) |

### Seeding price history (dev)

To generate fake price history for testing the binder chart:

```bash
npm run seed:history   # adds 60 days of fake history
npm run reset:history  # removes seeded entries only
```

## Roadmap

- [ ] Migrate to Supabase + Vercel KV for hosting
- [ ] Auth (required before public hosting)
- [ ] Mobile brew layout improvements
- [ ] Vercel Cron for background price refresh

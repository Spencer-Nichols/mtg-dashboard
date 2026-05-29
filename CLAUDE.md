@AGENTS.md

# TapNTrack — MTG Collection Tracker

Next.js App Router, Supabase (auth + DB), Tailwind CSS. Spencer's personal MTG card price tracker.

## Pages
- `/` — home: card of the hour, binder value chart, top gainers/wishlist drops sidebar
- `/binder` — main collection view: gainers/losers/unchanged tables, sparkline chart, add/bulk-add cards
- `/wishlist` — cards to acquire, price tracking
- `/search` — Scryfall card search
- `/admin/requests` — admin only

## Key patterns

**Row identity**: `makeRowKey(displayName, setCode, foil)` → `"Name||set||0|1"`. Used as Map keys for results and as delete targets. Always use this — never match on displayName alone.

**Price %**: Always recalculate `pct` on the frontend from `purchasePrice` (not the cached stream value). `costBasis = purchasePrice ?? snapshotPrice`. If `purchasePrice === 0`, show dollar gain instead of %.

**Caching**: localStorage stale-while-revalidate. `CACHE_VERSION = '2'` — bump this to bust all caches. Keys: `tnk:binder:entries`, `tnk:binder:results`, `tnk:binder:history`, `tnk:highlights`, `tnk:history`.

**Binder stream**: SSE at `/api/binder/stream`. Emits `{type:'total'}`, `{type:'card', displayName, setCode, foil, currentPrice, ...}`, `{type:'done'}`. On `done`, saves to localStorage and POSTs to `/api/binder/history`.

**Add card flow**: After successful add, set `postAddRow` state → opens `EditModal` for condition/foil/purchasePrice/note. Same `EditModal` used for editing existing cards.

**Foil gradient**: Applied via `style` prop on `<tr>` or `<div>`:
```
linear-gradient(110deg, #1c1917 15%, rgba(167,139,250,0.10) 35%, rgba(96,165,250,0.10) 52%, rgba(52,211,153,0.08) 68%, #1c1917 85%)
```
Slightly stronger (0.12/0.11/0.10) on expanded row / CompactCardGrid.

**Pending cards**: Cards with `pct === null` are included in the `flat` (unchanged) array — they were previously missing because only `Math.abs(pct) <= 0.05` was checked.

## Components (all in `src/app/binder/page.tsx`)
- `Sparkline` — reused for both inline row sparklines (small) and full-width labeled chart. `fullWidth` + `showLabels` + `dates` + `counts` props for the labeled version. `labelsOnMobile` prop removes the `hidden sm:block` on y/x labels and bumps count marker font size to `"14"` (vs `"7"` on desktop). Mobile binder chart uses `height={180}` + `labelsOnMobile`; desktop uses `height={120}`. All label font sizes are `"7"` (binder, wider container) vs `"9"` y/x and `"11"` count markers (home page, narrower due to sidebar) — same viewBox but different container widths cause the visual size difference.
- `EditModal` — condition, foil toggle, purchase price, note, printing selector. Triggered by edit button OR post-add via `postAddRow`.
- `CompactCardGrid` — unchanged cards, single column on mobile (`grid-cols-1 sm:grid-cols-2`).
- `CardRow` / `CardTable` — gainers and losers.

## Mobile rules
- All text inputs: `text-base sm:text-sm` to prevent iOS auto-zoom (must be ≥ 16px on mobile).
- After selecting a card from the add-card dropdown, call `addInputRef.current?.blur()` to dismiss the keyboard before the printing dropdown appears.
- EditModal width: `max-w-lg md:max-w-3xl` — avoids horizontal scroll on mobile.
- Printing cards in EditModal grid: button needs `w-full` or truncation won't work.

## API routes
| Route | Method | Purpose |
|---|---|---|
| `/api/binder` | GET | List entries |
| `/api/binder/stream` | GET (SSE) | Price stream |
| `/api/binder/add` | POST | Add single card |
| `/api/binder/edit` | PATCH | Edit card (displayName, scryfallId, setCode, foil, purchasePrice, condition, note) |
| `/api/binder/note` | PATCH | Quick note update |
| `/api/binder/remove` | POST | Remove card |
| `/api/binder/history` | GET/POST | Collection value history |
| `/api/binder/bulk` | POST | Bulk import (streaming) |
| `/api/card` | GET | Scryfall search — `?q=&candidates=true` or `?q=&prints=true` |
| `/api/highlights` | GET | Top gainers + wishlist drops for home page |

## DB tables (Supabase)
- `binder_entries` — displayName, baseName, setCode, scryfallId, foil, count, snapshotPrice, purchasePrice, condition, note, dateAdded
- `binder_history` — date, total, card_count
- `wishlist` — cards to acquire
- `admins` — user_id, checked via service client in layout

## Marketplace
Use **Manapool** links for card lookups. Never TCGPlayer. Manapool URL pattern: `manapool.com/card/<kebab-case-name>` (strip set/variant suffixes like "showcase", "extended art", etc.).

#!/usr/bin/env node
// Seeds binder_card_history from snapshot_price at date_added for all binder cards.
// Run after a fresh CSV import: node scripts/seed-card-history.mjs
// Dry run (no writes):          node scripts/seed-card-history.mjs --dry-run

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')

const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^"|"$/g, '')]
    })
)

const BASE = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const HEADERS = { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const dryRun = process.argv.includes('--dry-run')

const cardsRes = await fetch(`${BASE}/rest/v1/binder_cards?select=user_id,display_name,snapshot_price,date_added`, { headers: HEADERS })
if (!cardsRes.ok) { console.error('Failed to fetch binder_cards:', await cardsRes.text()); process.exit(1) }
const cards = await cardsRes.json()

if (!cards || cards.length === 0) { console.log('No cards found in binder.'); process.exit(0) }

const rows = cards
  .filter(c => c.snapshot_price != null && c.date_added != null)
  .map(c => ({
    user_id: c.user_id,
    display_name: c.display_name,
    date: c.date_added,
    price: c.snapshot_price,
  }))

console.log(`Found ${cards.length} cards, seeding ${rows.length} history entries...`)

if (dryRun) {
  console.log('Dry run — sample rows:')
  rows.slice(0, 5).forEach(r => console.log(`  ${r.display_name} | ${r.date} | $${r.price}`))
  console.log('No writes performed.')
  process.exit(0)
}

const insertRes = await fetch(`${BASE}/rest/v1/binder_card_history?on_conflict=user_id,display_name,date`, {
  method: 'POST',
  headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates' },
  body: JSON.stringify(rows),
})

if (!insertRes.ok) { console.error('Failed to seed history:', await insertRes.text()); process.exit(1) }

console.log(`Done — seeded ${rows.length} entries into binder_card_history.`)

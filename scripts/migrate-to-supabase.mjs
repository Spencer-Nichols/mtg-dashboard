#!/usr/bin/env node
// One-time migration: imports local JSON files into Supabase.
// Run: node scripts/migrate-to-supabase.mjs

// Supabase checks for native WebSocket on Node 20 — stub it since we don't use realtime
if (typeof WebSocket === 'undefined') {
  global.WebSocket = class WebSocket {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    close() {}
  }
}

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOME = process.env.HOME || ''

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const env = {}
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) env[match[1].trim()] = match[2].trim()
  }
  return env
}

const env = loadEnv()
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

async function getUserId() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  if (error) throw error
  if (users.length === 0) throw new Error('No users found in Supabase')
  if (users.length > 1) {
    console.warn(`Warning: ${users.length} users found — using first (${users[0].email})`)
  }
  console.log(`Migrating as user: ${users[0].email} (${users[0].id})`)
  return users[0].id
}

async function hasRows(table) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
  return (count ?? 0) > 0
}

async function migrateBinder(userId) {
  if (await hasRows('binder_cards')) { console.log('⚠ binder_cards already populated, skipping'); return }

  const binder = JSON.parse(
    fs.readFileSync(path.join(HOME, 'Projects/scryfall/binder.json'), 'utf-8')
  )

  const rows = binder.map(card => ({
    user_id: userId,
    display_name: card.displayName,
    base_name: card.baseName,
    set_code: card.setCode ?? null,
    scryfall_id: card.scryfallId ?? null,
    foil: card.foil ?? false,
    count: card.count ?? 1,
    snapshot_price: card.snapshotPrice ?? null,
    note: card.note ?? null,
    date_added: card.dateAdded ?? null,
  }))

  const { error } = await supabase.from('binder_cards').insert(rows)
  if (error) throw new Error(`binder_cards: ${error.message}`)
  console.log(`✓ Migrated ${rows.length} binder cards`)
}

async function migrateHistory(userId) {
  if (await hasRows('binder_history')) { console.log('⚠ binder_history already populated, skipping'); return }

  const history = JSON.parse(
    fs.readFileSync(path.join(HOME, 'Projects/scryfall/binder_history.json'), 'utf-8')
  )

  const rows = history.map(h => ({
    user_id: userId,
    date: h.date,
    total: parseFloat(h.total.toFixed(2)),
  }))

  const { error } = await supabase.from('binder_history').insert(rows)
  if (error) throw new Error(`binder_history: ${error.message}`)
  console.log(`✓ Migrated ${rows.length} history entries`)
}

function parseWishlistSingles(content) {
  const singlesMatch = content.match(/## Singles Wishlist[\s\S]*?```([\s\S]*?)```/)
  if (!singlesMatch) throw new Error('Could not find Singles Wishlist section')

  const singles = []
  for (const line of singlesMatch[1].split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//')) continue

    const [cardPart, ...noteParts] = trimmed.split('//')
    const parts = cardPart.trim().split(' ')
    if (parts.length < 2 || !/^\d+$/.test(parts[0])) continue

    let name = parts.slice(1).join(' ').trim()
    const setCodeMatch = name.match(/\[([a-z0-9]+)(?::([0-9a-f-]+))?\]$/)
    const setCode = setCodeMatch ? setCodeMatch[1] : null
    const scryfallId = setCodeMatch?.[2] ?? null
    if (setCode) name = name.slice(0, name.lastIndexOf('[')).trim()

    singles.push({
      name,
      note: noteParts.length ? noteParts.join('//').trim() : null,
      set_code: setCode,
      scryfall_id: scryfallId,
    })
  }
  return singles
}

async function migrateWishlist(userId) {
  if (await hasRows('wishlist_singles')) { console.log('⚠ wishlist_singles already populated, skipping'); return }

  const wishlistFile = path.join(
    HOME,
    '.claude/projects/-Users-spencer-Projects/memory/mtg_decks_wishlist.md'
  )
  const pricesFile = path.join(HOME, 'Projects/scryfall/wishlist_prices.json')

  const content = fs.readFileSync(wishlistFile, 'utf-8')
  const prices = (() => {
    try { return JSON.parse(fs.readFileSync(pricesFile, 'utf-8')) } catch { return {} }
  })()

  const singles = parseWishlistSingles(content)

  const rows = singles.map(s => {
    const priceData = prices[s.name]
    return {
      user_id: userId,
      name: s.name,
      note: s.note,
      set_code: s.set_code,
      scryfall_id: s.scryfall_id,
      snapshot_price: priceData?.price ?? null,
      snapshot_added_at: priceData?.addedAt ? new Date(priceData.addedAt).toISOString() : null,
    }
  })

  const { error } = await supabase.from('wishlist_singles').insert(rows)
  if (error) throw new Error(`wishlist_singles: ${error.message}`)
  console.log(`✓ Migrated ${rows.length} wishlist singles`)
}

async function migrateWishlistHistory(userId) {
  if (await hasRows('wishlist_card_history')) { console.log('⚠ wishlist_card_history already populated, skipping'); return }

  const historyFile = path.join(HOME, 'Projects/scryfall/wishlist_history.json')
  let history
  try {
    history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'))
  } catch {
    console.log('⚠ No wishlist_history.json found, skipping')
    return
  }

  const rows = []
  for (const [cardName, entries] of Object.entries(history)) {
    for (const entry of entries) {
      rows.push({
        user_id: userId,
        card_name: cardName,
        date: entry.date,
        price: parseFloat(entry.price.toFixed(2)),
      })
    }
  }

  if (rows.length === 0) {
    console.log('⚠ No wishlist history entries found, skipping')
    return
  }

  const { error } = await supabase.from('wishlist_card_history').insert(rows)
  if (error) throw new Error(`wishlist_card_history: ${error.message}`)
  console.log(`✓ Migrated ${rows.length} wishlist history entries`)
}

async function main() {
  console.log('Starting migration...\n')
  const userId = await getUserId()
  await migrateBinder(userId)
  await migrateHistory(userId)
  await migrateWishlist(userId)
  await migrateWishlistHistory(userId)
  console.log('\n✓ Migration complete!')
}

main().catch(err => {
  console.error('\n✗ Migration failed:', err.message)
  process.exit(1)
})

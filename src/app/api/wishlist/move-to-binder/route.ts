import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { fetchByName, getPrice, frameSuffix } from '@/lib/scryfall'
import { readBinder, writeBinder, BinderEntry } from '@/lib/binder'

const WISHLIST_FILE = path.join(
  process.env.HOME || '',
  '.claude/projects/-Users-spencer-Projects/memory/mtg_decks_wishlist.md'
)
const PRICES_FILE = path.join(process.env.HOME || '', 'Projects/scryfall/wishlist_prices.json')

export async function POST(req: NextRequest) {
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Missing card name' }, { status: 400 })

  // Check not already in binder
  const entries = readBinder()
  if (entries.find(e => e.baseName.toLowerCase() === name.trim().toLowerCase())) {
    return NextResponse.json({ error: `${name} is already in the binder` }, { status: 409 })
  }

  // Fetch card from Scryfall
  const card = await fetchByName(name.trim())
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  const price = getPrice(card)
  if (!price) return NextResponse.json({ error: 'No price data available' }, { status: 404 })

  // Add to binder
  const newEntry: BinderEntry = {
    displayName: card.name + frameSuffix(card),
    baseName: card.name,
    setCode: card.set ?? '',
    scryfallId: card.id ?? null,
    foil: false,
    count: 1,
    snapshotPrice: price,
    note: null,
    dateAdded: new Date().toISOString().slice(0, 10),
  }
  writeBinder([...entries, newEntry])

  // Remove from wishlist markdown
  const content = fs.readFileSync(WISHLIST_FILE, 'utf-8')
  const filtered = content.split('\n').filter(line => {
    const trimmed = line.trim()
    if (!trimmed.match(/^\d+\s+/)) return true
    const cardName = trimmed.replace(/^\d+\s+/, '').split('//')[0].replace(/\s*\[[a-z0-9:_-]+\]$/i, '').trim()
    return cardName.toLowerCase() !== name.trim().toLowerCase()
  })
  fs.writeFileSync(WISHLIST_FILE, filtered.join('\n'))

  // Remove wishlist snapshot price
  try {
    const prices = JSON.parse(fs.readFileSync(PRICES_FILE, 'utf-8'))
    delete prices[name.trim()]
    fs.writeFileSync(PRICES_FILE, JSON.stringify(prices, null, 2))
  } catch { /* no prices file */ }

  return NextResponse.json({ ok: true, name: newEntry.displayName, price })
}

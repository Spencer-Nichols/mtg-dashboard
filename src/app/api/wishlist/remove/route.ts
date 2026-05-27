import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const WISHLIST_FILE = path.join(
  process.env.HOME || '',
  '.claude/projects/-Users-spencer-Projects/memory/mtg_decks_wishlist.md'
)
const PRICES_FILE = path.join(process.env.HOME || '', 'Projects/scryfall/wishlist_prices.json')

export async function POST(req: NextRequest) {
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Missing card name' }, { status: 400 })

  const content = fs.readFileSync(WISHLIST_FILE, 'utf-8')
  const lines = content.split('\n')
  const filtered = lines.filter(line => {
    const trimmed = line.trim()
    if (!trimmed.match(/^\d+\s+/)) return true
    const cardName = trimmed.replace(/^\d+\s+/, '').split('//')[0].replace(/\s*\[[a-z0-9:_-]+\]$/i, '').trim()
    return cardName.toLowerCase() !== name.trim().toLowerCase()
  })

  if (filtered.length === lines.length) {
    return NextResponse.json({ error: 'Card not found in wishlist' }, { status: 404 })
  }

  fs.writeFileSync(WISHLIST_FILE, filtered.join('\n'))

  // Remove snapshot price
  try {
    const prices = JSON.parse(fs.readFileSync(PRICES_FILE, 'utf-8'))
    delete prices[name.trim()]
    fs.writeFileSync(PRICES_FILE, JSON.stringify(prices, null, 2))
  } catch { /* no prices file yet */ }

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { fetchByName, fetchById, searchCards, getPrice, frameSuffix } from '@/lib/scryfall'
import { loadWishlist } from '@/lib/wishlist'

const WISHLIST_FILE = path.join(
  process.env.HOME || '',
  '.claude/projects/-Users-spencer-Projects/memory/mtg_decks_wishlist.md'
)
const PRICES_FILE = path.join(process.env.HOME || '', 'Projects/scryfall/wishlist_prices.json')

function loadPrices() {
  try { return JSON.parse(fs.readFileSync(PRICES_FILE, 'utf-8')) } catch { return {} }
}

export async function POST(req: NextRequest) {
  const { name, setCode, scryfallId, note } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Missing card name' }, { status: 400 })

  const { singles } = loadWishlist()
  if (singles.find(s => s.name.toLowerCase() === name.trim().toLowerCase())) {
    return NextResponse.json({ error: `${name} is already on the wishlist` }, { status: 409 })
  }

  // Use Scryfall ID if available — unambiguously fetches the exact printing selected
  const card = scryfallId ? await fetchById(scryfallId) : await fetchByName(name.trim(), setCode || undefined)
  if (!card) {
    const candidates = await searchCards(name.trim())
    if (candidates.length === 0) return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    if (candidates.length > 1) {
      return NextResponse.json({
        candidates: candidates.map(c => ({
          name: c.name, setCode: c.set, setName: c.set_name,
          price: getPrice(c), type_line: c.type_line,
        }))
      })
    }
  }

  const resolved = card ?? null
  if (!resolved) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  const price = getPrice(resolved)
  const cardName = resolved.name + frameSuffix(resolved)
  const idSuffix = resolved.id ? `:${resolved.id}` : ''
  const setCodePart = resolved.set ? ` [${resolved.set}${idSuffix}]` : ''
  const notePart = note?.trim() ? ` // ${note.trim()}` : ''
  const newLine = `1 ${cardName}${setCodePart}${notePart}`

  // Append to the Singles Wishlist code block
  const content = fs.readFileSync(WISHLIST_FILE, 'utf-8')
  const updated = content.replace(
    /(## Singles Wishlist[\s\S]*?```[\s\S]*?)(```)/,
    (_, block, closing) => `${block}${newLine}\n${closing}`
  )
  fs.writeFileSync(WISHLIST_FILE, updated)

  // Store snapshot price
  const prices = loadPrices()
  prices[cardName] = { price: price ?? 0, addedAt: new Date().toISOString().split('T')[0] }
  fs.writeFileSync(PRICES_FILE, JSON.stringify(prices, null, 2))

  const imageUrl = resolved.image_uris?.normal ?? resolved.card_faces?.[0]?.image_uris?.normal ?? null
  return NextResponse.json({ name: cardName, price, setCode: resolved.set, imageUrl })
}

import { NextResponse } from 'next/server'
import { readBinder } from '@/lib/binder'
import { loadWishlist } from '@/lib/wishlist'
import { getCached, cacheKey } from '@/lib/cache'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const PRICES_FILE = path.join(process.env.HOME || '', 'Projects/scryfall/wishlist_prices.json')

function loadWishlistPrices(): Record<string, { price: number; addedAt: string }> {
  try { return JSON.parse(fs.readFileSync(PRICES_FILE, 'utf-8')) } catch { return {} }
}

export interface HighlightCard {
  displayName: string
  snapshotPrice: number
  currentPrice: number
  pct: number
  imageUrl: string | null
}

export async function GET() {
  // --- Binder gainers ---
  const entries = readBinder()
  const binderGainers: HighlightCard[] = []

  for (const entry of entries) {
    const key = cacheKey(entry.baseName, entry.scryfallId ?? entry.setCode)
    const cached = getCached(key)
    if (!cached) continue
    const currentPrice = entry.foil ? (cached.foilPrice ?? cached.price) : cached.price
    if (currentPrice == null || entry.snapshotPrice <= 0) continue
    const pct = ((currentPrice - entry.snapshotPrice) / entry.snapshotPrice) * 100
    if (pct > 0) {
      binderGainers.push({
        displayName: entry.displayName,
        snapshotPrice: entry.snapshotPrice,
        currentPrice,
        pct,
        imageUrl: cached.imageUrl ?? null,
      })
    }
  }

  binderGainers.sort((a, b) => b.pct - a.pct)
  const topGainers = binderGainers.slice(0, 5)

  // --- Wishlist drops ---
  const { singles } = loadWishlist()
  const wishlistPrices = loadWishlistPrices()
  const wishlistDrops: HighlightCard[] = []

  for (const single of singles) {
    const key = cacheKey(single.name, single.scryfallId ?? single.setCode ?? '')
    const cached = getCached(key)
    const snapshotEntry = wishlistPrices[single.name]
    if (!cached || !snapshotEntry) continue
    const currentPrice = cached.price
    if (currentPrice == null || snapshotEntry.price <= 0) continue
    const pct = ((currentPrice - snapshotEntry.price) / snapshotEntry.price) * 100
    if (pct < 0) {
      wishlistDrops.push({
        displayName: single.name,
        snapshotPrice: snapshotEntry.price,
        currentPrice,
        pct,
        imageUrl: cached.imageUrl ?? null,
      })
    }
  }

  wishlistDrops.sort((a, b) => a.pct - b.pct)

  return NextResponse.json({ topGainers, wishlistDrops })
}

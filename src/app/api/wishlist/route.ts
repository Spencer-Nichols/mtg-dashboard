import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { loadWishlist } from '@/lib/wishlist'

const PRICES_FILE = path.join(process.env.HOME || '', 'Projects/scryfall/wishlist_prices.json')

function loadPrices(): Record<string, { price: number; addedAt: string }> {
  try { return JSON.parse(fs.readFileSync(PRICES_FILE, 'utf-8')) } catch { return {} }
}

export async function GET() {
  try {
    const { singles } = loadWishlist()
    const prices = loadPrices()
    return NextResponse.json(singles.map(s => ({
      ...s,
      snapshotPrice: prices[s.name]?.price ?? null,
      addedAt: prices[s.name]?.addedAt ?? null,
    })))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

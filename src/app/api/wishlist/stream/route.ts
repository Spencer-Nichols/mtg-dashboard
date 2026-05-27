import { NextRequest } from 'next/server'
import { loadWishlist } from '@/lib/wishlist'
import { fetchByName, fetchById, getPrice, sleep } from '@/lib/scryfall'
import { getCached, setCached, cacheKey } from '@/lib/cache'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const PRICES_FILE = path.join(process.env.HOME || '', 'Projects/scryfall/wishlist_prices.json')

function loadPrices(): Record<string, { price: number; addedAt: string }> {
  try { return JSON.parse(fs.readFileSync(PRICES_FILE, 'utf-8')) } catch { return {} }
}

export async function GET(req: NextRequest) {
  const bust = req.nextUrl.searchParams.get('bust') === 'true'
  const { singles } = loadWishlist()
  const snapshots = loadPrices()

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (data: object) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))

      send({ type: 'total', count: singles.length })

      for (let i = 0; i < singles.length; i++) {
        const { name, note, setCode, scryfallId } = singles[i]
        const key = cacheKey(name, scryfallId ?? setCode ?? '')
        let currentPrice: number | null = null
        let imageUrl: string | null = null

        let setName: string | null = null
        let cardSetCode: string | null = null
        let rarity: string | null = null
        let typeLine: string | null = null

        const cached = bust ? null : getCached(key)
        // Treat as miss if metadata fields are absent (old cache entries)
        if (cached && cached.setName !== undefined) {
          currentPrice = cached.price
          imageUrl = cached.imageUrl ?? null
          setName = cached.setName ?? null
          cardSetCode = cached.setCode ?? null
          rarity = cached.rarity ?? null
          typeLine = cached.typeLine ?? null
        } else {
          if (i > 0) await sleep(1100)
          const card = scryfallId
            ? await fetchById(scryfallId)
            : await fetchByName(name, setCode ?? undefined)
          if (card) {
            const price = getPrice(card, false)
            const foilPrice = getPrice(card, true)
            imageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null
            setName = card.set_name ?? null
            cardSetCode = card.set ?? null
            rarity = card.rarity ?? null
            typeLine = card.type_line ?? null
            setCached(key, price, foilPrice, imageUrl, { setName: setName ?? undefined, setCode: cardSetCode ?? undefined, rarity: rarity ?? undefined, typeLine: typeLine ?? undefined })
            currentPrice = price
          }
        }

        const snapshotPrice = snapshots[name]?.price ?? null
        const pct = currentPrice != null && snapshotPrice != null
          ? ((currentPrice - snapshotPrice) / snapshotPrice) * 100
          : null

        send({ type: 'card', index: i, name, note, snapshotPrice, currentPrice, pct, imageUrl, setName, setCode: cardSetCode, rarity, typeLine })
      }

      send({ type: 'done' })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}

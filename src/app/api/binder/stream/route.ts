import { NextRequest } from 'next/server'
import { readBinder } from '@/lib/binder'
import { fetchByName, fetchById, getPrice, sleep } from '@/lib/scryfall'
import { getCached, setCached, cacheKey } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const bust = req.nextUrl.searchParams.get('bust') === 'true'
  const entries = readBinder()

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()

      const send = (data: object) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      send({ type: 'total', count: entries.length })

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const key = cacheKey(entry.baseName, entry.scryfallId ?? entry.setCode)
        let currentPrice: number | null = null
        let imageUrl: string | null = null

        const cached = bust ? null : getCached(key)
        if (cached) {
          currentPrice = entry.foil ? (cached.foilPrice ?? cached.price) : cached.price
          imageUrl = cached.imageUrl ?? null
        } else {
          if (i > 0) await sleep(1100)
          const card = entry.scryfallId
            ? await fetchById(entry.scryfallId)
            : await fetchByName(entry.baseName, entry.setCode || undefined)
          if (card) {
            const price = getPrice(card, false)
            const foilPrice = getPrice(card, true)
            imageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null
            setCached(key, price, foilPrice, imageUrl)
            currentPrice = entry.foil ? (foilPrice ?? price) : price
          }
        }

        const pct = currentPrice != null
          ? ((currentPrice - entry.snapshotPrice) / entry.snapshotPrice) * 100
          : null

        send({
          type: 'card',
          index: i,
          displayName: entry.displayName,
          snapshotPrice: entry.snapshotPrice,
          currentPrice,
          pct,
          imageUrl,
          fromCache: !!cached,
        })
      }

      send({ type: 'done' })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

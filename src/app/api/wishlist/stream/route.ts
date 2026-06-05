import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchByName, fetchCollection, getPrice, sleep } from '@/lib/scryfall'
import { getCached, setCached, cacheKey, setCronTimestamp } from '@/lib/cache'
import { fetchManapoolSinglePrices } from '@/lib/manapool'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const bust = req.nextUrl.searchParams.get('bust') === 'true'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

const { data, error } = await supabase
    .from('wishlist_singles')
    .select('name, note, set_code, scryfall_id, snapshot_price')
    .eq('user_id', user.id)
    .order('created_at')

  const singles = error ? [] : (data ?? [])

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (data: object) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))

      send({ type: 'total', count: singles.length })

      // --- Pre-fetch phase ---

      // Check cache for all singles
      const cacheMap = new Map<string, Awaited<ReturnType<typeof getCached>>>()
      for (const s of singles) {
        if (bust) continue
        const key = cacheKey(s.name, s.scryfall_id ?? s.set_code ?? '')
        const cached = await getCached(key)
        if (cached) cacheMap.set(key, cached)
      }

      // Scryfall_ids split: all (for Manapool) vs cache misses (for Scryfall batch)
      const missIds = singles
        .filter(s => s.scryfall_id && !cacheMap.has(cacheKey(s.name, s.scryfall_id as string)))
        .map(s => s.scryfall_id as string)

      // Cards missing Manapool price in cache need a live fetch
      const manapoolMissIds = singles
        .filter(s => s.scryfall_id && !(cacheMap.get(cacheKey(s.name, s.scryfall_id as string))?.manapoolPrice != null))
        .map(s => s.scryfall_id as string)

      // Fetch Manapool (misses only) and Scryfall batch (misses only) in parallel
      const [manapoolPrices, scryfallBatch] = await Promise.all([
        manapoolMissIds.length > 0 || bust ? fetchManapoolSinglePrices(
          bust ? singles.filter(s => s.scryfall_id).map(s => s.scryfall_id as string) : manapoolMissIds
        ) : Promise.resolve(new Map()),
        fetchCollection(missIds),
      ])

      // Update cache for Scryfall batch results
      for (const s of singles) {
        if (!s.scryfall_id) continue
        const card = scryfallBatch.get(s.scryfall_id)
        if (!card) continue
        const key = cacheKey(s.name, s.scryfall_id)
        const price = getPrice(card, false)
        const foilPrice = getPrice(card, true)
        const imageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null
        await setCached(key, price, foilPrice, imageUrl, {
          setName: card.set_name ?? undefined,
          setCode: card.set ?? undefined,
          rarity: card.rarity ?? undefined,
          typeLine: card.type_line ?? undefined,
        })
        cacheMap.set(key, {
          price,
          foilPrice,
          etchedPrice: null,
          imageUrl,
          timestamp: Date.now(),
          setName: card.set_name,
          setCode: card.set,
          rarity: card.rarity,
          typeLine: card.type_line,
        })
      }

      // --- Stream phase ---
      let nameOnlyIndex = 0
      for (const s of singles) {
        const key = cacheKey(s.name, s.scryfall_id ?? s.set_code ?? '')
        let cached = cacheMap.get(key) ?? null

        // Cards without scryfall_id: fall back to sequential name fetch
        if (!s.scryfall_id && !cached) {
          if (nameOnlyIndex > 0) await sleep(600)
          const card = await fetchByName(s.name, s.set_code ?? undefined)
          if (card) {
            const price = getPrice(card, false)
            const foilPrice = getPrice(card, true)
            const imageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null
            await setCached(key, price, foilPrice, imageUrl, {
              setName: card.set_name ?? undefined,
              setCode: card.set ?? undefined,
              rarity: card.rarity ?? undefined,
              typeLine: card.type_line ?? undefined,
            })
            cached = { price, foilPrice, etchedPrice: null, imageUrl, timestamp: Date.now() }
          }
          nameOnlyIndex++
        }

        const scryfallPrice = cached?.price ?? null
        const mp = s.scryfall_id ? manapoolPrices.get(s.scryfall_id) ?? null : null
        const manapoolPrice = mp?.price ?? cached?.manapoolPrice ?? null
        const manapoolUrl = mp?.url ?? cached?.manapoolUrl ?? null

        let currentPrice: number | null = null
        let priceSource: 'manapool' | 'scryfall' | null = null

        if (scryfallPrice != null && manapoolPrice != null) {
          if (manapoolPrice < scryfallPrice) {
            currentPrice = manapoolPrice
            priceSource = 'manapool'
          } else {
            currentPrice = scryfallPrice
            priceSource = 'scryfall'
          }
        } else if (manapoolPrice != null) {
          currentPrice = manapoolPrice
          priceSource = 'manapool'
        } else if (scryfallPrice != null) {
          currentPrice = scryfallPrice
          priceSource = 'scryfall'
        }

        const snapshotPrice = s.snapshot_price ?? null
        const pct = currentPrice != null && snapshotPrice != null && snapshotPrice > 0
          ? ((currentPrice - snapshotPrice) / snapshotPrice) * 100
          : null

        send({
          type: 'card',
          name: s.name,
          note: s.note,
          snapshotPrice,
          currentPrice,
          pct,
          imageUrl: cached?.imageUrl ?? null,
          setName: cached?.setName ?? null,
          setCode: cached?.setCode ?? null,
          rarity: cached?.rarity ?? null,
          typeLine: cached?.typeLine ?? null,
          priceSource,
          manapoolUrl,
        })
      }

      if (bust) await setCronTimestamp()
      send({ type: 'done' })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}

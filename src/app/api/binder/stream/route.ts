import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchByName, fetchCollection, getPrice, getPriceByFoilType, sleep } from '@/lib/scryfall'
import { getCached, setCached, getCachedPriceByFoilType, cacheKey, setCronTimestamp } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const bust = req.nextUrl.searchParams.get('bust') === 'true'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  supabase.from('user_profiles').upsert({ user_id: user.id, last_seen: new Date().toISOString(), last_seen_page: 'binder' }, { onConflict: 'user_id' }).then(() => {})

  const { data, error } = await supabase
    .from('binder_cards')
    .select('display_name, base_name, set_code, scryfall_id, foil_type, snapshot_price, purchase_price, condition')
    .eq('user_id', user.id)
    .order('created_at')

  const entries = error ? [] : (data ?? [])

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()

      const send = (data: object) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      send({ type: 'total', count: entries.length })

      // --- Pre-fetch phase ---

      // Check cache for all entries
      const cacheMap = new Map<string, Awaited<ReturnType<typeof getCached>>>()
      for (const e of entries) {
        if (bust) continue
        const key = cacheKey(e.base_name, e.scryfall_id ?? e.set_code ?? '')
        const cached = await getCached(key)
        if (cached) cacheMap.set(key, cached)
      }

      // Batch-fetch Scryfall for cache misses that have a scryfall_id
      const missIds = entries
        .filter(e => e.scryfall_id && !cacheMap.has(cacheKey(e.base_name, e.scryfall_id)))
        .map(e => e.scryfall_id as string)

      const scryfallBatch = await fetchCollection(missIds)

      // Populate cache from batch results
      for (const e of entries) {
        if (!e.scryfall_id) continue
        const card = scryfallBatch.get(e.scryfall_id)
        if (!card) continue
        const key = cacheKey(e.base_name, e.scryfall_id)
        const price = getPrice(card, false)
        const foilPrice = getPrice(card, true)
        const etchedPrice = getPriceByFoilType(card, 'etched')
        const imageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null
        const backImageUrl = card.card_faces?.[1]?.image_uris?.normal ?? null
        await setCached(key, price, foilPrice, imageUrl, { backImageUrl, etchedPrice })
        cacheMap.set(key, {
          price,
          foilPrice,
          etchedPrice,
          imageUrl,
          backImageUrl,
          timestamp: Date.now(),
        })
      }

      // --- Stream phase ---
      let nameOnlyIndex = 0
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const key = cacheKey(entry.base_name, entry.scryfall_id ?? entry.set_code ?? '')
        let cached = cacheMap.get(key) ?? null

        // Fall back to sequential name fetch for cards without scryfall_id
        if (!entry.scryfall_id && !cached) {
          if (nameOnlyIndex > 0) await sleep(600)
          const card = await fetchByName(entry.base_name, entry.set_code || undefined)
          if (card) {
            const price = getPrice(card, false)
            const foilPrice = getPrice(card, true)
            const etchedPrice = getPriceByFoilType(card, 'etched')
            const imageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null
            const backImageUrl = card.card_faces?.[1]?.image_uris?.normal ?? null
            await setCached(key, price, foilPrice, imageUrl, { backImageUrl, etchedPrice })
            cached = { price, foilPrice, etchedPrice, imageUrl, backImageUrl, timestamp: Date.now() }
          }
          nameOnlyIndex++
        }

        const foilType = entry.foil_type ?? 'none'
        const currentPrice = cached ? getCachedPriceByFoilType(cached, foilType) : null
        const costBasis = entry.purchase_price ?? entry.snapshot_price ?? 0
        const pct = currentPrice != null && costBasis > 0
          ? ((currentPrice - costBasis) / costBasis) * 100
          : null

        send({
          type: 'card',
          index: i,
          displayName: entry.display_name,
          setCode: entry.set_code,
          foilType,
          snapshotPrice: entry.snapshot_price ?? 0,
          purchasePrice: entry.purchase_price ?? null,
          condition: entry.condition ?? null,
          currentPrice,
          pct,
          imageUrl: cached?.imageUrl ?? null,
          backImageUrl: cached?.backImageUrl ?? null,
          fromCache: !!cacheMap.get(key),
        })
      }

      if (bust) await setCronTimestamp()
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

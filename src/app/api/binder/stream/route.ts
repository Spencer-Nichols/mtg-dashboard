import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchByName, fetchById, getPrice, getPriceByFoilType, sleep } from '@/lib/scryfall'
import { getCached, setCached, getCachedPriceByFoilType, cacheKey, setCronTimestamp } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const bust = req.nextUrl.searchParams.get('bust') === 'true'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  supabase.from('user_profiles').upsert({ user_id: user.id, last_seen: new Date().toISOString() }, { onConflict: 'user_id' }).then(() => {})

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

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const key = cacheKey(entry.base_name, entry.scryfall_id ?? entry.set_code ?? '')
        let currentPrice: number | null = null
        let imageUrl: string | null = null
        let backImageUrl: string | null = null

        const foilType = entry.foil_type ?? 'none'
        const cached = bust ? null : await getCached(key)
        if (cached) {
          currentPrice = getCachedPriceByFoilType(cached, foilType)
          imageUrl = cached.imageUrl ?? null
          backImageUrl = cached.backImageUrl ?? null
        } else {
          if (i > 0) await sleep(entry.scryfall_id ? 150 : 600)
          const card = entry.scryfall_id
            ? await fetchById(entry.scryfall_id)
            : await fetchByName(entry.base_name, entry.set_code || undefined)
          if (card) {
            const price = getPrice(card, false)
            const foilPrice = getPrice(card, true)
            const etchedPrice = getPriceByFoilType(card, 'etched')
            imageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null
            backImageUrl = card.card_faces?.[1]?.image_uris?.normal ?? null
            await setCached(key, price, foilPrice, imageUrl, { backImageUrl, etchedPrice })
            currentPrice = getPriceByFoilType(card, foilType)
          }
        }

        const costBasis = entry.purchase_price ?? entry.snapshot_price ?? 0
        const pct = currentPrice != null && costBasis > 0
          ? ((currentPrice - costBasis) / costBasis) * 100
          : null

        send({
          type: 'card',
          index: i,
          displayName: entry.display_name,
          setCode: entry.set_code,
          foilType: foilType,
          snapshotPrice: entry.snapshot_price ?? 0,
          purchasePrice: entry.purchase_price ?? null,
          condition: entry.condition ?? null,
          currentPrice,
          pct,
          imageUrl,
          backImageUrl,
          fromCache: !!cached,
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

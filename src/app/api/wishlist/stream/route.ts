import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchByName, fetchById, getPrice, sleep } from '@/lib/scryfall'
import { getCached, setCached, cacheKey, setCronTimestamp } from '@/lib/cache'

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

      for (let i = 0; i < singles.length; i++) {
        const { name, note, set_code, scryfall_id, snapshot_price } = singles[i]
        const key = cacheKey(name, scryfall_id ?? set_code ?? '')
        let currentPrice: number | null = null
        let imageUrl: string | null = null
        let setName: string | null = null
        let cardSetCode: string | null = null
        let rarity: string | null = null
        let typeLine: string | null = null

        const cached = bust ? null : await getCached(key)
        if (cached && cached.setName !== undefined) {
          currentPrice = cached.price
          imageUrl = cached.imageUrl ?? null
          setName = cached.setName ?? null
          cardSetCode = cached.setCode ?? null
          rarity = cached.rarity ?? null
          typeLine = cached.typeLine ?? null
        } else {
          if (i > 0) await sleep(scryfall_id ? 150 : 600)
          const card = scryfall_id
            ? await fetchById(scryfall_id)
            : await fetchByName(name, set_code ?? undefined)
          if (card) {
            const price = getPrice(card, false)
            const foilPrice = getPrice(card, true)
            imageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null
            setName = card.set_name ?? null
            cardSetCode = card.set ?? null
            rarity = card.rarity ?? null
            typeLine = card.type_line ?? null
            await setCached(key, price, foilPrice, imageUrl, {
              setName: setName ?? undefined,
              setCode: cardSetCode ?? undefined,
              rarity: rarity ?? undefined,
              typeLine: typeLine ?? undefined,
            })
            currentPrice = price
          }
        }

        const snapshotPrice = snapshot_price ?? null
        const pct = currentPrice != null && snapshotPrice != null
          ? ((currentPrice - snapshotPrice) / snapshotPrice) * 100
          : null

        send({ type: 'card', index: i, name, note, snapshotPrice, currentPrice, pct, imageUrl, setName, setCode: cardSetCode, rarity, typeLine })
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

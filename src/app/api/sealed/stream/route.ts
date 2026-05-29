import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchGroupPrices } from '@/lib/tcgcsv'
import { getSealedPrice, setSealedPrice } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const bust = req.nextUrl.searchParams.get('bust') === 'true'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data, error } = await supabase
    .from('sealed_wishlist')
    .select('id, tcg_product_id, tcg_group_id, product_name, set_name, snapshot_price, image_url')
    .eq('user_id', user.id)
    .order('created_at')

  const items = error ? [] : (data ?? [])

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (data: object) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))

      send({ type: 'total', count: items.length })

      // Group by tcg_group_id to batch TCGCSV fetches (one request per set)
      const byGroup = new Map<number, typeof items>()
      for (const item of items) {
        const g = byGroup.get(item.tcg_group_id) ?? []
        g.push(item)
        byGroup.set(item.tcg_group_id, g)
      }

      for (const [groupId, groupItems] of byGroup) {
        const cachedPrices = new Map<number, number | null>()
        const needsFetch: number[] = []

        if (!bust) {
          for (const item of groupItems) {
            const cached = await getSealedPrice(item.tcg_product_id)
            if (cached !== 'miss') {
              cachedPrices.set(item.tcg_product_id, cached)
            } else {
              needsFetch.push(item.tcg_product_id)
            }
          }
        } else {
          needsFetch.push(...groupItems.map(i => i.tcg_product_id))
        }

        let livePrices = new Map<number, number | null>()
        if (needsFetch.length > 0) {
          livePrices = await fetchGroupPrices(groupId)
          for (const productId of needsFetch) {
            const price = livePrices.get(productId) ?? null
            await setSealedPrice(productId, price)
          }
        }

        for (const item of groupItems) {
          const currentPrice = cachedPrices.has(item.tcg_product_id)
            ? cachedPrices.get(item.tcg_product_id) ?? null
            : livePrices.get(item.tcg_product_id) ?? null

          const costBasis = item.snapshot_price ?? 0
          const pct = currentPrice != null && costBasis > 0
            ? ((currentPrice - costBasis) / costBasis) * 100
            : null

          send({
            type: 'product',
            id: item.id,
            productId: item.tcg_product_id,
            productName: item.product_name,
            setName: item.set_name,
            snapshotPrice: item.snapshot_price ?? 0,
            currentPrice,
            pct,
            imageUrl: item.image_url,
            fromCache: cachedPrices.has(item.tcg_product_id),
          })
        }
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

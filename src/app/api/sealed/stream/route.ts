import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data, error } = await supabase
    .from('sealed_wishlist')
    .select('id, tcg_product_id, product_name, set_name, snapshot_price, image_url, manapool_url')
    .eq('user_id', user.id)
    .order('created_at')

  const items = error ? [] : (data ?? [])

  // Fetch latest price per product from history (written by cron via TCGPlayer API)
  const productIds = items.map(i => i.tcg_product_id)
  const latestPrices = new Map<number, number | null>()
  const latestSources = new Map<number, string>()

  if (productIds.length > 0) {
    const service = createServiceClient()
    const { data: history } = await service
      .from('sealed_wishlist_history')
      .select('tcg_product_id, price, price_source')
      .in('tcg_product_id', productIds)
      .order('recorded_at', { ascending: false })

    for (const row of history ?? []) {
      if (!latestPrices.has(row.tcg_product_id)) {
        latestPrices.set(row.tcg_product_id, row.price)
        latestSources.set(row.tcg_product_id, row.price_source ?? 'tcgplayer')
      }
    }
  }

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      const send = (data: object) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))

      send({ type: 'total', count: items.length })

      for (const item of items) {
        const currentPrice = latestPrices.get(item.tcg_product_id) ?? null
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
          priceSource: latestSources.get(item.tcg_product_id) ?? null,
          manapoolUrl: item.manapool_url ?? null,
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

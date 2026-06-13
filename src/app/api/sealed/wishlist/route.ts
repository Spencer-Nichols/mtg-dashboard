import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const { data, error } = await supabase
    .from('sealed_wishlist')
    .select('id, tcg_product_id, tcg_group_id, product_name, set_name, snapshot_price, image_url, target_price')
    .eq('user_id', user.id)
    .order('created_at')

  if (error) return NextResponse.json([], { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const { tcgProductId, tcgGroupId, productName, setName, snapshotPrice, imageUrl, targetPrice } = await req.json()
  if (!tcgProductId || !tcgGroupId || !productName || !setName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { count } = await supabase
    .from('sealed_wishlist')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if ((count ?? 0) >= 50) {
    return NextResponse.json({ error: 'Wishlist limit reached (50 items)' }, { status: 403 })
  }

  const { error } = await supabase.from('sealed_wishlist').insert({
    user_id: user.id,
    tcg_product_id: tcgProductId,
    tcg_group_id: tcgGroupId,
    product_name: productName,
    set_name: setName,
    snapshot_price: snapshotPrice ?? null,
    image_url: imageUrl ?? null,
    target_price: targetPrice ?? null,
  })

  if (error?.code === '23505') return NextResponse.json({ error: 'Already on wishlist' }, { status: 409 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (snapshotPrice != null) {
    const service = createServiceClient()
    await service.from('sealed_wishlist_history').insert({
      tcg_product_id: tcgProductId,
      recorded_at: new Date().toISOString(),
      price: parseFloat(snapshotPrice.toFixed(2)),
    })
  }

  return NextResponse.json({ ok: true })
}

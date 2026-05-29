import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchSealedProducts, fetchGroupPrices } from '@/lib/tcgcsv'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const groupId = Number(req.nextUrl.searchParams.get('groupId'))
  const groupName = req.nextUrl.searchParams.get('groupName')
  if (!groupId || !groupName) return NextResponse.json([], { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const [products, prices] = await Promise.all([
    fetchSealedProducts(groupId, groupName),
    fetchGroupPrices(groupId),
  ])

  const result = products.map(p => ({
    productId: p.productId,
    name: p.name,
    imageUrl: p.imageUrl ?? null,
    price: prices.get(p.productId) ?? null,
  }))

  return NextResponse.json(result)
}

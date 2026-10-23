import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchCollection } from '@/lib/scryfall'

export const dynamic = 'force-dynamic'

const MAX_IDS = 10

export async function POST(req: NextRequest) {
  const { ids } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'Missing ids' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cards = await fetchCollection([...new Set(ids as string[])].slice(0, MAX_IDS))
  return NextResponse.json([...cards.values()].map(c => ({
    scryfallId: c.id,
    setCode: c.set,
    setName: c.set_name,
    collectorNumber: c.collector_number,
    imageUrls: c.image_uris?.normal
      ? [c.image_uris.normal]
      : (c.card_faces ?? []).map(f => f.image_uris?.normal).filter(Boolean),
    scryfallUri: c.scryfall_uri ?? null,
    prices: {
      none: c.prices.usd ? parseFloat(c.prices.usd) : null,
      foil: c.prices.usd_foil ? parseFloat(c.prices.usd_foil) : null,
      etched: c.prices.usd_etched ? parseFloat(c.prices.usd_etched) : null,
    },
  })))
}

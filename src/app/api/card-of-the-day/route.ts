import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchByName, fetchById } from '@/lib/scryfall'
import { getCollectionStatus } from '@/lib/collection'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: entries, error } = await supabase
    .from('binder_cards')
    .select('display_name, base_name, set_code, scryfall_id')
    .order('created_at')

  if (error || !entries?.length) return NextResponse.json({ error: 'No binder entries' }, { status: 404 })

  const seedParam = req.nextUrl.searchParams.get('seed')
  const seed = seedParam ? parseInt(seedParam, 10) : (() => { const now = new Date(); return now.getFullYear() + now.getMonth() + now.getDate() + now.getHours() })()
  const index = Math.abs(seed) % entries.length
  const entry = entries[index]

  const card = entry.scryfall_id
    ? await fetchById(entry.scryfall_id)
    : await fetchByName(entry.base_name, entry.set_code || undefined)

  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  const status = getCollectionStatus(card.name)
  return NextResponse.json({ card, status, displayName: entry.display_name })
}

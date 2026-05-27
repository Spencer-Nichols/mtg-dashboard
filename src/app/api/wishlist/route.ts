import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('wishlist_singles')
      .select('*')
      .order('created_at')

    if (error) throw error

    return NextResponse.json((data ?? []).map(row => ({
      name: row.name,
      note: row.note,
      setCode: row.set_code,
      scryfallId: row.scryfall_id,
      snapshotPrice: row.snapshot_price,
      addedAt: row.snapshot_added_at,
    })))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

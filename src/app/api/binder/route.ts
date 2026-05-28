import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('binder_cards')
      .select('*')
      .order('created_at')

    if (error) throw error

    const entries = (data ?? []).map(row => ({
      displayName: row.display_name,
      baseName: row.base_name,
      setCode: row.set_code ?? '',
      scryfallId: row.scryfall_id,
      foil: row.foil,
      count: row.count,
      snapshotPrice: row.snapshot_price ?? 0,
      purchasePrice: row.purchase_price ?? null,
      condition: row.condition ?? null,
      note: row.note,
      dateAdded: row.date_added,
    }))

    return NextResponse.json({ entries })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type CardHistoryRow = { display_name: string; date: string; price: number }

// binder_card_history can easily exceed Supabase's per-request row cap (10k) once a
// binder's been tracked for a few months — page through it so recent data never gets
// silently truncated (this bit us once before with the sparkline chart).
async function fetchAllCardHistory(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<CardHistoryRow[]> {
  const PAGE_SIZE = 5000
  const rows: CardHistoryRow[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('binder_card_history')
      .select('display_name, date, price')
      .eq('user_id', userId)
      .order('date')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  let cards, history
  try {
    const [cardsRes, historyRows] = await Promise.all([
      supabase
        .from('binder_cards')
        .select('display_name, purchase_price, snapshot_price, added_price, date_added')
        .eq('user_id', user.id),
      fetchAllCardHistory(supabase, user.id),
    ])
    if (cardsRes.error) throw cardsRes.error
    cards = cardsRes.data
    history = historyRows
  } catch {
    return NextResponse.json([], { status: 500 })
  }

  // One price series per card, deduped to the last write per calendar day
  const seriesByCard = new Map<string, Array<{ date: string; price: number }>>()
  for (const row of history ?? []) {
    const day = row.date.split('T')[0]
    const series = seriesByCard.get(row.display_name)
    if (!series) {
      seriesByCard.set(row.display_name, [{ date: day, price: row.price }])
    } else if (series[series.length - 1].date === day) {
      series[series.length - 1].price = row.price
    } else {
      series.push({ date: day, price: row.price })
    }
  }

  const allDates = [...new Set((history ?? []).map(row => row.date.split('T')[0]))].sort()

  // Forward-fill each currently-owned card's price across the shared date axis,
  // summing (price - cost basis) starting from the date it was added.
  const cursors = new Map<string, number>()
  const points = allDates.map(date => {
    let gain = 0
    for (const card of cards ?? []) {
      if (card.date_added && card.date_added > date) continue
      const series = seriesByCard.get(card.display_name)
      if (!series) continue
      let i = cursors.get(card.display_name) ?? 0
      while (i + 1 < series.length && series[i + 1].date <= date) i++
      cursors.set(card.display_name, i)
      if (series[i].date > date) continue
      const costBasis = card.purchase_price ?? card.added_price ?? card.snapshot_price ?? 0
      gain += series[i].price - costBasis
    }
    return { date, total: parseFloat(gain.toFixed(2)) }
  })

  return NextResponse.json(points)
}

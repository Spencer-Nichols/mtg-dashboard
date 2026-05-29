import { NextRequest } from 'next/server'
import { fetchByName, getPrice, sleep, frameSuffix } from '@/lib/scryfall'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const parseRow = (line: string): string[] => {
    const fields: string[] = []
    let inQuotes = false
    let current = ''
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { fields.push(current); current = '' }
      else { current += ch }
    }
    fields.push(current)
    return fields
  }

  const headers = parseRow(lines[0])
  return lines.slice(1).map(line => {
    const values = parseRow(line)
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const minPrice: number = typeof body.minPrice === 'number' ? body.minPrice : 2.0
  const csvText: string = typeof body.csvText === 'string' ? body.csvText : ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('data: ' + JSON.stringify({ type: 'error', message: 'Unauthorized' }) + '\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  if (!csvText) {
    return new Response('data: ' + JSON.stringify({ type: 'error', message: 'No CSV data provided' }) + '\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const rows = parseCSV(csvText)
  const candidates = rows.filter(row => {
    const isProxy = row['Proxy']?.toLowerCase() === 'true'
    const isPlaytest = row['Tags']?.toLowerCase().includes('playtest')
    return !isProxy && !isPlaytest && row['Name']?.trim()
  })

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (data: object) => controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))

      send({ type: 'total', count: candidates.length })

      let added = 0
      for (let i = 0; i < candidates.length; i++) {
        const row = candidates[i]
        const name = row['Name'].trim()
        const setCode = row['Edition']?.trim().toLowerCase() || undefined
        const foil = row['Foil']?.toLowerCase() === 'foil'
        const count = parseInt(row['Count'] || '1') || 1
        const purchasePriceRaw = row['Purchase Price']?.trim()
        const purchasePrice = purchasePriceRaw ? parseFloat(purchasePriceRaw) : null
        const condition = row['Condition']?.trim() || null

        const { data: existing } = await supabase
          .from('binder_cards')
          .select('base_name')
          .eq('user_id', user.id)
          .ilike('base_name', name)
          .maybeSingle()
        if (existing) {
          send({ type: 'result', name, status: 'skipped', message: 'Already in binder' })
          continue
        }

        if (i > 0) await sleep(150)

        const card = await fetchByName(name, setCode)
        if (!card) {
          send({ type: 'result', name, status: 'error', message: 'Not found on Scryfall' })
          continue
        }

        const price = getPrice(card, foil)
        if (!price || price < minPrice) {
          send({ type: 'result', name, status: 'skipped', message: price ? `$${price.toFixed(2)} below minimum` : 'No price data' })
          continue
        }

        const newRow = {
          user_id: user.id,
          display_name: card.name + frameSuffix(card),
          base_name: card.name,
          set_code: card.set ?? null,
          scryfall_id: card.id ?? null,
          foil,
          count,
          snapshot_price: price,
          purchase_price: purchasePrice,
          condition,
          note: null,
          date_added: new Date().toISOString().slice(0, 10),
        }

        const { error } = await supabase.from('binder_cards').insert(newRow)
        if (error) {
          send({ type: 'result', name, status: 'error', message: error.message })
          continue
        }

        added++
        send({ type: 'result', name: newRow.display_name, status: 'added', price, setCode: newRow.set_code })
      }

      send({ type: 'done', added })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}

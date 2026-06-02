import { NextRequest } from 'next/server'
import { getPriceByFoilType, sleep, frameSuffix, FoilType, ScryfallCard } from '@/lib/scryfall'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const BATCH_SIZE = 75
const BATCH_DELAY = 150

const CONDITION_MAP: Record<string, string> = {
  'near mint': 'NM', 'lightly played': 'LP', 'good (lightly played)': 'LP',
  'moderately played': 'MP', 'played': 'MP', 'heavily played': 'HP', 'damaged': 'Damaged',
}
function normalizeCondition(raw: string | undefined): string | null {
  if (!raw?.trim()) return null
  return CONDITION_MAP[raw.trim().toLowerCase()] ?? raw.trim()
}

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

type Identifier = { set: string; collector_number: string } | { name: string }

async function fetchCollection(identifiers: Identifier[]): Promise<{ data: ScryfallCard[]; not_found: Identifier[] }> {
  const res = await fetch('https://api.scryfall.com/cards/collection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'SpencerMTGDashboard/1.0' },
    body: JSON.stringify({ identifiers }),
  })
  if (!res.ok) return { data: [], not_found: identifiers }
  return res.json()
}

function identKey(ident: Identifier): string {
  if ('set' in ident) return `${ident.set}:${ident.collector_number}`
  return `name:${ident.name.toLowerCase()}`
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
  const candidates = rows
    .filter(row => {
      const isProxy = row['Proxy']?.toLowerCase() === 'true'
      const isPlaytest = row['Tags']?.toLowerCase().includes('playtest')
      return !isProxy && !isPlaytest && row['Name']?.trim()
    })
    .map(row => {
      const foilRaw = row['Foil']?.toLowerCase().trim()
      return {
        name: row['Name'].trim(),
        setCode: row['Edition']?.trim().toLowerCase() || '',
        collectorNumber: row['Collector Number']?.trim() || '',
        foilType: (foilRaw === 'etched' ? 'etched' : foilRaw === 'foil' ? 'foil' : 'none') as FoilType,
        count: parseInt(row['Count'] || '1') || 1,
        purchasePrice: row['Purchase Price']?.trim() ? parseFloat(row['Purchase Price'].trim()) : null,
        condition: normalizeCondition(row['Condition']),
      }
    })

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (data: object) => controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))

      send({ type: 'total', count: candidates.length })

      // Bulk check existing cards
      const { data: existingCards } = await supabase
        .from('binder_cards')
        .select('base_name')
        .eq('user_id', user.id)
      const existingNames = new Set((existingCards ?? []).map(c => (c.base_name as string).toLowerCase()))

      const seenNames = new Set<string>()
      const toFetch = candidates.filter(c => {
        if (existingNames.has(c.name.toLowerCase()) || seenNames.has(c.name.toLowerCase())) return false
        seenNames.add(c.name.toLowerCase())
        return true
      })
      const alreadyIn = candidates.filter(c => !toFetch.includes(c))

      for (const c of alreadyIn) {
        send({ type: 'result', name: c.name, status: 'skipped', message: 'Already in binder' })
      }

      // Build identifier list and lookup map
      const identifiers: Identifier[] = []
      const candidateMap = new Map<string, typeof toFetch[0]>()
      for (const c of toFetch) {
        const ident: Identifier = c.setCode && c.collectorNumber
          ? { set: c.setCode, collector_number: c.collectorNumber }
          : { name: c.name }
        identifiers.push(ident)
        candidateMap.set(identKey(ident), c)
      }

      let added = 0
      for (let i = 0; i < identifiers.length; i += BATCH_SIZE) {
        if (i > 0) await sleep(BATCH_DELAY)
        const batch = identifiers.slice(i, i + BATCH_SIZE)
        const { data: cards, not_found } = await fetchCollection(batch)

        for (const card of cards) {
          const key = card.set && card.collector_number
            ? `${card.set}:${card.collector_number}`
            : `name:${card.name.toLowerCase()}`
          const candidate = candidateMap.get(key)
          if (!candidate) continue

          const price = getPriceByFoilType(card, candidate.foilType) ?? getPriceByFoilType(card, 'none')
          if (!price || price < minPrice) {
            send({ type: 'result', name: candidate.name, status: 'skipped', message: price ? `$${price.toFixed(2)} below minimum` : 'No price data' })
            continue
          }

          const newRow = {
            user_id: user.id,
            display_name: card.name + frameSuffix(card),
            base_name: card.name,
            set_code: card.set ?? null,
            scryfall_id: card.id ?? null,
            foil_type: candidate.foilType,
            count: candidate.count,
            snapshot_price: price,
            purchase_price: candidate.purchasePrice,
            condition: candidate.condition,
            note: null,
            date_added: new Date().toISOString().slice(0, 10),
          }

          const { error } = await supabase.from('binder_cards').insert(newRow)
          if (error) {
            send({ type: 'result', name: candidate.name, status: 'error', message: error.message })
            continue
          }

          added++
          send({ type: 'result', name: newRow.display_name, status: 'added', price, setCode: newRow.set_code })
        }

        for (const ident of not_found) {
          const candidate = candidateMap.get(identKey(ident))
          send({ type: 'result', name: candidate?.name ?? JSON.stringify(ident), status: 'error', message: 'Not found on Scryfall' })
        }
      }

      send({ type: 'done', added })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}

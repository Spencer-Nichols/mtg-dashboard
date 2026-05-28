import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchByName, fetchBySetAndNumber, getPrice, sleep, frameSuffix } from '@/lib/scryfall'

export const dynamic = 'force-dynamic'

function parseLine(raw: string): { name: string; setCode?: string; collectorNumber?: string; note?: string } | null {
  let line = raw.trim()
  if (!line || line.startsWith('//') || line.startsWith('#')) return null

  line = line.replace(/^\d+x?\s+/i, '').trim()

  let note: string | undefined
  let setCode: string | undefined
  let collectorNumber: string | undefined

  // Strip " // foil" from the end first (export format for foil cards)
  const foilTail = line.match(/\s+\/\/\s+foil\s*$/i)
  if (foilTail) {
    note = 'foil'
    line = line.slice(0, foilTail.index!).trim()
  }

  // Try set code (+ optional collector number) at end of line — handles regular cards
  // and DFCs like "Front // Back (set) 107" without losing set code to the // separator
  const setMatchEnd = line.match(/\s+\(([a-z0-9]{2,5})\)(\s+([\w*]+))?\s*$/i)
  if (setMatchEnd) {
    setCode = setMatchEnd[1].toLowerCase()
    collectorNumber = setMatchEnd[3] || undefined
    line = line.slice(0, setMatchEnd.index!).trim()
  } else if (!note) {
    // No set code at end: fall back to original note-separator logic for user-typed lines
    // like "Card Name (set) // my note" where the set isn't at the very end
    const noteSep = line.indexOf(' // ')
    if (noteSep !== -1) {
      note = line.slice(noteSep + 4).trim() || undefined
      line = line.slice(0, noteSep).trim()
    }
    const setMatchInner = line.match(/\s+\(([a-z0-9]{2,5})\)(\s+([\w*]+))?\s*$/i)
    if (setMatchInner) {
      setCode = setMatchInner[1].toLowerCase()
      collectorNumber = setMatchInner[3] || undefined
      line = line.slice(0, setMatchInner.index!).trim()
    }
  }

  if (!line) return null
  return { name: line, setCode, collectorNumber, note }
}

export async function POST(req: NextRequest) {
  const { lines } = await req.json() as { lines: string[] }
  if (!Array.isArray(lines) || lines.length === 0) {
    return new Response('data: ' + JSON.stringify({ type: 'error', message: 'No lines provided' }) + '\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (data: object) => controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))

      if (!user) {
        send({ type: 'error', message: 'Unauthorized' })
        controller.close()
        return
      }

      const parsed = lines.map(parseLine).filter(Boolean) as { name: string; setCode?: string; collectorNumber?: string; note?: string }[]
      send({ type: 'total', count: parsed.length })

      for (let i = 0; i < parsed.length; i++) {
        const { name, setCode, collectorNumber, note } = parsed[i]

        const { data: existing } = await supabase
          .from('binder_cards')
          .select('base_name')
          .ilike('base_name', name)
          .maybeSingle()

        if (existing) {
          send({ type: 'result', name, status: 'skipped', message: 'Already in binder' })
          continue
        }

        if (i > 0) await sleep(setCode && collectorNumber ? 150 : 600)

        const card = (setCode && collectorNumber)
          ? await fetchBySetAndNumber(setCode, collectorNumber)
          : await fetchByName(name, setCode)
        if (!card) {
          send({ type: 'result', name, status: 'error', message: 'Not found on Scryfall' })
          continue
        }

        const isFoil = note === 'foil'
        const price = getPrice(card, isFoil)
        if (!price) {
          send({ type: 'result', name, status: 'error', message: 'No price data' })
          continue
        }

        const newRow = {
          user_id: user.id,
          display_name: card.name + frameSuffix(card),
          base_name: card.name,
          set_code: card.set ?? null,
          scryfall_id: card.id ?? null,
          foil: isFoil,
          count: 1,
          snapshot_price: price,
          note: isFoil ? null : (note || null),
          date_added: new Date().toISOString().slice(0, 10),
        }

        const { error } = await supabase.from('binder_cards').insert(newRow)
        if (error) {
          send({ type: 'result', name, status: 'error', message: error.message })
          continue
        }

        send({ type: 'result', name: newRow.display_name, status: 'added', price, setCode: newRow.set_code })
      }

      send({ type: 'done' })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}

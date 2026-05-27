import { NextRequest } from 'next/server'
import { fetchByName, getPrice, sleep, frameSuffix } from '@/lib/scryfall'
import { readBinder, writeBinder, BinderEntry } from '@/lib/binder'

export const dynamic = 'force-dynamic'

function parseLine(raw: string): { name: string; setCode?: string; note?: string } | null {
  let line = raw.trim()
  if (!line || line.startsWith('//') || line.startsWith('#')) return null

  line = line.replace(/^\d+x?\s+/i, '').trim()

  let note: string | undefined
  const noteSep = line.indexOf(' // ')
  if (noteSep !== -1) {
    note = line.slice(noteSep + 4).trim() || undefined
    line = line.slice(0, noteSep).trim()
  }

  let setCode: string | undefined
  const setMatch = line.match(/\s+\(([a-z0-9]{2,5})\)(\s+\d+)?$/i)
  if (setMatch) {
    setCode = setMatch[1].toLowerCase()
    line = line.slice(0, setMatch.index).trim()
  }

  if (!line) return null
  return { name: line, setCode, note }
}

export async function POST(req: NextRequest) {
  const { lines } = await req.json() as { lines: string[] }
  if (!Array.isArray(lines) || lines.length === 0) {
    return new Response('data: ' + JSON.stringify({ type: 'error', message: 'No lines provided' }) + '\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (data: object) => controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))

      const parsed = lines.map(parseLine).filter(Boolean) as { name: string; setCode?: string; note?: string }[]
      send({ type: 'total', count: parsed.length })

      for (let i = 0; i < parsed.length; i++) {
        const { name, setCode, note } = parsed[i]

        const entries = readBinder()
        const exists = entries.find(e => e.baseName.toLowerCase() === name.toLowerCase())
        if (exists) {
          send({ type: 'result', name, status: 'skipped', message: 'Already in binder' })
          continue
        }

        if (i > 0) await sleep(150)

        const card = await fetchByName(name, setCode)
        if (!card) {
          send({ type: 'result', name, status: 'error', message: 'Not found on Scryfall' })
          continue
        }

        const price = getPrice(card)
        if (!price) {
          send({ type: 'result', name, status: 'error', message: 'No price data' })
          continue
        }

        const newEntry: BinderEntry = {
          displayName: card.name + frameSuffix(card),
          baseName: card.name,
          setCode: card.set ?? '',
          scryfallId: card.id ?? null,
          foil: false,
          count: 1,
          snapshotPrice: price,
          note: note || null,
          dateAdded: new Date().toISOString().slice(0, 10),
        }

        writeBinder([...readBinder(), newEntry])
        send({ type: 'result', name: newEntry.displayName, status: 'added', price, setCode: newEntry.setCode })
      }

      send({ type: 'done' })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}

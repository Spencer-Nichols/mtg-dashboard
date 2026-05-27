import { NextRequest, NextResponse } from 'next/server'
import { fetchByName, fetchById, searchCards, getPrice, frameSuffix } from '@/lib/scryfall'
import { readBinder, writeBinder, BinderEntry } from '@/lib/binder'

export async function POST(req: NextRequest) {
  const { name, setCode: forcedSet, scryfallId, note } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Missing card name' }, { status: 400 })

  const entries = readBinder()
  const exists = scryfallId
    ? entries.find(e => e.scryfallId === scryfallId)
    : entries.find(e => e.baseName.toLowerCase() === name.trim().toLowerCase() && !e.scryfallId)
  if (exists) return NextResponse.json({ error: `${exists.baseName} is already in the binder` }, { status: 409 })

  const card = scryfallId ? await fetchById(scryfallId) : await fetchByName(name.trim(), forcedSet || undefined)

  if (!card) {
    const candidates = await searchCards(name.trim())
    if (candidates.length === 0) return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    if (candidates.length > 1) {
      return NextResponse.json({
        candidates: candidates.map(c => ({
          name: c.name,
          setCode: c.set,
          setName: c.set_name,
          price: getPrice(c),
          type_line: c.type_line,
        }))
      })
    }
  }

  const resolved = card ?? null
  if (!resolved) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  const price = getPrice(resolved)
  if (!price) return NextResponse.json({ error: 'No price data available' }, { status: 404 })

  const newEntry: BinderEntry = {
    displayName: resolved.name + frameSuffix(resolved),
    baseName: resolved.name,
    setCode: resolved.set ?? '',
    scryfallId: resolved.id ?? null,
    foil: false,
    count: 1,
    snapshotPrice: price,
    note: note?.trim() || null,
    dateAdded: new Date().toISOString().slice(0, 10),
  }

  writeBinder([...entries, newEntry])

  const imageUrl = resolved.image_uris?.normal ?? resolved.card_faces?.[0]?.image_uris?.normal ?? null
  return NextResponse.json({ name: newEntry.displayName, price, setCode: newEntry.setCode, imageUrl })
}

import { NextResponse } from 'next/server'
import { readBinder } from '@/lib/binder'
import { fetchByName, fetchById } from '@/lib/scryfall'
import { getCollectionStatus } from '@/lib/collection'

export const dynamic = 'force-dynamic'

export async function GET() {
  const entries = readBinder()
  if (entries.length === 0) return NextResponse.json({ error: 'No binder entries' }, { status: 404 })

  // Seed by date + hour so it rotates every hour
  const now = new Date()
  const seed = now.getFullYear() + now.getMonth() + now.getDate() + now.getHours()
  const index = seed % entries.length
  const entry = entries[index]

  const card = entry.scryfallId
    ? await fetchById(entry.scryfallId)
    : await fetchByName(entry.baseName, entry.setCode || undefined)

  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  const status = getCollectionStatus(card.name)
  return NextResponse.json({ card, status, displayName: entry.displayName })
}

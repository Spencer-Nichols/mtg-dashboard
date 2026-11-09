import { NextRequest, NextResponse } from 'next/server'
import { proxyUser } from '@/lib/proxy-access'
import { fetchCollection } from '@/lib/scryfall'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_IDS = 300

interface FacedCard {
  image_uris?: { png?: string }
  card_faces?: { image_uris?: { png?: string } }[]
}

// Full-size PNG links for each printing. Double-faced cards have a back face; everything
// else (split, adventure, flip) is one image and gets the proxy back.
export async function POST(req: NextRequest) {
  if (!(await proxyUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { ids } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'Missing ids' }, { status: 400 })

  const unique = [...new Set(ids.filter((id): id is string => typeof id === 'string'))].slice(0, MAX_IDS)
  const cards = await fetchCollection(unique)
  const faces: Record<string, { front: string; back: string | null }> = {}
  for (const [id, raw] of cards) {
    const card = raw as unknown as FacedCard
    const faceImages = (card.card_faces ?? []).map(f => f.image_uris?.png).filter((u): u is string => !!u)
    const front = card.image_uris?.png ?? faceImages[0]
    if (!front) continue
    faces[id] = { front, back: card.image_uris?.png ? null : faceImages[1] ?? null }
  }
  const missing = unique.filter(id => !faces[id])
  if (missing.length) console.warn('Proxy faces missing for', missing.length, 'printings')
  return NextResponse.json({ faces, missing })
}

import { NextRequest, NextResponse } from 'next/server'
import { readBinder } from '@/lib/binder'

const HEADERS = { 'User-Agent': 'SpencerMTGDashboard/1.0' }

export interface SynergyCard {
  name: string
  lift: number
  inclusionRate: number  // 0–1, e.g. 0.74 = 74% of eligible decks
  numDecks: number
  owned: boolean
  imageUrl: string | null
  price: number | null
  typeLine: string | null
  setName: string | null
  rarity: string | null
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('card')
  if (!name) return NextResponse.json({ error: 'Missing card name' }, { status: 400 })

  const slug = toSlug(name)

  try {
    const edhRes = await fetch(`https://json.edhrec.com/pages/cards/${slug}.json`, { headers: HEADERS })
    if (!edhRes.ok) return NextResponse.json({ error: 'Card not found on EDHREC' }, { status: 404 })

    const data = await edhRes.json()
    const cardlists: { header: string; cardviews: { name: string; lift?: number; num_decks?: number; potential_decks?: number }[] }[] =
      data?.container?.json_dict?.cardlists ?? []

    // Prefer "Top Commanders" to show which commanders most commonly run this card
    const skip = ['new cards']
    const synergyList =
      cardlists.find(l => l.header?.toLowerCase() === 'top commanders') ??
      cardlists.find(l => l.header?.toLowerCase() === 'top cards') ??
      cardlists.find(l => l.header?.toLowerCase() === 'game changers') ??
      cardlists.find(l => !skip.some(s => l.header?.toLowerCase().includes(s))) ??
      cardlists[0]

    if (!synergyList) return NextResponse.json({ cards: [] })

    const top = synergyList.cardviews.slice(0, 12)

    // Fetch all card data from Scryfall in one batch request
    const collectionRes = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: top.map(c => ({ name: c.name })) }),
    })

    const collectionData = collectionRes.ok ? await collectionRes.json() : { data: [] }
    const scryfallCards: Record<string, { image_uris?: { normal: string }; card_faces?: { image_uris?: { normal: string } }[]; prices?: { usd?: string | null }; type_line?: string; set_name?: string; rarity?: string }> = {}
    for (const c of collectionData.data ?? []) {
      scryfallCards[c.name.toLowerCase()] = c
    }

    const entries = readBinder()
    const binderNames = new Set(entries.map(e => e.baseName.toLowerCase()))

    const cards: SynergyCard[] = top.map(c => {
      const sc = scryfallCards[c.name.toLowerCase()]
      const numDecks = c.num_decks ?? 0
      const potentialDecks = c.potential_decks ?? 0
      return {
        name: c.name,
        lift: c.lift ?? 1,
        inclusionRate: potentialDecks > 0 ? numDecks / potentialDecks : 0,
        numDecks,
        owned: binderNames.has(c.name.toLowerCase()),
        imageUrl: sc?.image_uris?.normal ?? sc?.card_faces?.[0]?.image_uris?.normal ?? null,
        price: sc?.prices?.usd ? parseFloat(sc.prices.usd) : null,
        typeLine: sc?.type_line ?? null,
        setName: sc?.set_name ?? null,
        rarity: sc?.rarity ?? null,
      }
    }).sort((a, b) => b.lift - a.lift)

    return NextResponse.json({ cards, header: synergyList.header })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch synergy data' }, { status: 500 })
  }
}

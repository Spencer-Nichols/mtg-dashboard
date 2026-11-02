import { NextRequest, NextResponse } from 'next/server'
import { prepareDeck } from '@/lib/deck-ideas'
import { setDecklist } from '@/lib/league/actions'
import { leagueContext, mutateLeague } from '@/lib/league/store'
import { LeagueError, type DeckCardInput } from '@/lib/league/types'
import precons from '@/lib/league/precons.json'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface Precon {
  id: string
  name: string
  commander: string
  moxfieldUrl?: string
  list: string
}

const PRECONS = precons as Precon[]

function fail(err: unknown) {
  if (err instanceof LeagueError) return NextResponse.json({ error: err.message }, { status: err.status })
  console.error('League decklist failed:', err)
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
}

export async function GET() {
  try {
    const { state, viewerId } = await leagueContext()
    return NextResponse.json(PRECONS.map(p => {
      const owner = state.members.find(m => m.id !== viewerId && m.precon === p.name)
      return { id: p.id, name: p.name, commander: p.commander, moxfieldUrl: p.moxfieldUrl ?? null, takenBy: owner?.name ?? null }
    }))
  } catch (err) {
    return fail(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { viewerId } = await leagueContext()
    const { text, preconId, deckName } = await req.json()
    const precon = typeof preconId === 'string' ? PRECONS.find(p => p.id === preconId) : undefined
    const list = precon?.list ?? (typeof text === 'string' ? text : '')
    if (!list.trim()) throw new LeagueError('Paste a decklist or pick a precon')

    const deck = await prepareDeck(list, null)
    if (deck.unresolved.length > 0) {
      throw new LeagueError(`Couldn't find these on Scryfall: ${deck.unresolved.slice(0, 5).join(', ')}${deck.unresolved.length > 5 ? '…' : ''}`)
    }

    const cards: DeckCardInput[] = deck.rows
      .filter(r => r.board !== 'sideboard')
      .map(r => ({
        name: r.name,
        displayName: r.flavorName,
        typeLine: r.type_line ?? '',
        rarity: r.rarity ?? 'common',
        qty: r.qty,
        commander: r.board === 'commander',
        imageUrl: r.image_url,
        colorIdentity: r.colorIdentity,
        printing: r.scryfall_id && r.set_code && r.collector_number ? {
          scryfallId: r.scryfall_id,
          setCode: r.set_code,
          collectorNumber: r.collector_number,
          label: r.frameLabel || 'Regular',
          foil: r.foil_type !== 'none',
        } : null,
      }))

    const name = precon?.name ?? (typeof deckName === 'string' ? deckName : '')
    await mutateLeague(state => {
      const owner = precon && state.members.find(m => m.id !== viewerId && m.precon === precon.name)
      if (owner) throw new LeagueError(`${owner.name} is already playing ${precon.name}`)
      setDecklist(state, viewerId, name, cards)
    })
    return NextResponse.json({ ok: true, count: cards.reduce((n, c) => n + c.qty, 0) })
  } catch (err) {
    return fail(err)
  }
}

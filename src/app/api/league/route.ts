import { after, NextRequest, NextResponse } from 'next/server'
import { callBye, changeCommander, endSeason, scheduleGame, logGame, markAddedToBinder, openPack, proposeTrade, respondTrade, swapIntoDeck, underdogSwap } from '@/lib/league/actions'
import { priceLeagueCards } from '@/lib/league/prices'
import { leagueContext, mutateLeague } from '@/lib/league/store'
import { LeagueError } from '@/lib/league/types'
import { dashboardView } from '@/lib/league/views'
import { notifyLeague, type LeagueEvent } from '@/lib/league/notify'

export const dynamic = 'force-dynamic'

function fail(err: unknown) {
  if (err instanceof LeagueError) return NextResponse.json({ error: err.message }, { status: err.status })
  console.error('League request failed:', err)
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
}

export async function GET() {
  try {
    const { state, viewerId, isAdmin } = await leagueContext()
    const prices = await priceLeagueCards(state)
    return NextResponse.json({ ...dashboardView(state, viewerId, prices, { isAdmin }) })
  } catch (err) {
    return fail(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { viewerId, isAdmin } = await leagueContext()
    const body = await req.json()
    const updated = await mutateLeague(state => {
      switch (body.action) {
        case 'logGame': return logGame(state, viewerId, body)
        case 'callBye': return callBye(state, viewerId)
        case 'openPack': return openPack(state, viewerId, body.kind, Array.isArray(body.pulls) ? body.pulls : [])
        case 'changeCommander': return changeCommander(state, viewerId, body.cardId)
        case 'swapIntoDeck': return swapIntoDeck(state, viewerId, body.inId, body.outId)
        case 'proposeTrade': return proposeTrade(state, viewerId, body.toId, body.giveCardId, body.getCardId)
        case 'respondTrade': return respondTrade(state, viewerId, body.tradeId, body.response)
        case 'endSeason': return endSeason(state, viewerId, isAdmin)
        case 'scheduleGame': return scheduleGame(state, viewerId, isAdmin, typeof body.at === 'string' ? body.at : null, typeof body.note === 'string' ? body.note : null)
        case 'markAddedToBinder': return markAddedToBinder(state, viewerId, Array.isArray(body.cardIds) ? body.cardIds : [])
        case 'underdogSwap': return underdogSwap(state, viewerId, Array.isArray(body.takes) ? body.takes : [])
        default: throw new LeagueError('Unknown action')
      }
    })

    const events: LeagueEvent[] = []
    if (body.action === 'proposeTrade') events.push({ kind: 'tradeOffer', tradeId: updated.trades[updated.trades.length - 1].id })
    if (body.action === 'respondTrade' && body.response !== 'cancel') events.push({ kind: 'tradeResponse', tradeId: body.tradeId })
    if (body.action === 'underdogSwap') events.push({ kind: 'swap', swapId: updated.swaps[updated.swaps.length - 1].id })
    if (body.action === 'endSeason') events.push({ kind: 'seasonEnded' })
    if (body.action === 'scheduleGame' && updated.season.nextGameAt) events.push({ kind: 'gameScheduled', byId: viewerId })
    if (events.length > 0) after(() => notifyLeague(updated, events))

    return NextResponse.json({ ok: true })
  } catch (err) {
    return fail(err)
  }
}

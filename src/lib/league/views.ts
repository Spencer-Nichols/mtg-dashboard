import { computeSeason, firstOut, memberName, packsToOpen, tradesThisWeek, underdogId, type Season } from './rules'
import { canUploadDeck, cardLabel, commanderOptions } from './actions'
import type { PriceMap } from './prices'
import type { LeagueCard, LeagueState, PackKind } from './types'

export interface CardView {
  id: string
  name: string
  realName: string
  typeLine: string
  rarity: string
  origin: LeagueCard['origin']
  zone: LeagueCard['zone']
  commander: boolean
  imageUrl: string | null
  printing: string | null
  source: string
  price: number | null
  addedToBinder: boolean
  binderLine: string
}

const PACK_SOURCE: Record<PackKind, string> = {
  opening: 'Pulled on opening night',
  weekly: 'Pulled from a weekly pack',
  reserve: 'Pulled from a reserve pack',
  prize: 'Pulled from a prize pack',
}

function cardView(c: LeagueCard, state: LeagueState, prices: PriceMap): CardView {
  const pack = c.packId ? state.packs.find(p => p.id === c.packId) : undefined
  const source = c.origin === 'precon' ? 'Original precon card' : pack ? `${PACK_SOURCE[pack.kind]} · week ${pack.week}` : 'Pulled from a pack'
  const special = c.printing && (c.printing.label !== 'Regular' || c.printing.foil)
  const label = c.printing ? c.printing.label.charAt(0).toUpperCase() + c.printing.label.slice(1) : ''
  const printing = special ? `${label} · #${c.printing!.collectorNumber}${c.printing!.foil ? ' · Foil' : ''}` : null
  return {
    id: c.id,
    name: cardLabel(c),
    realName: c.name,
    typeLine: c.typeLine,
    rarity: c.rarity,
    origin: c.origin,
    zone: c.zone,
    commander: c.commander,
    imageUrl: c.imageUrl ?? null,
    printing,
    source,
    price: prices.get(c.id) ?? null,
    addedToBinder: !!c.addedToBinder,
    binderLine: c.printing
      ? `${c.name} (${c.printing.setCode}) ${c.printing.collectorNumber}${c.printing.foil ? ' // foil' : ''}`
      : `${c.name} (${c.origin === 'pull' ? state.settings.packSet ?? 'trk' : 'trc'})`,
  }
}

function total(cards: LeagueCard[], prices: PriceMap) {
  return Math.round(cards.reduce((sum, c) => sum + (prices.get(c.id) ?? 0), 0) * 100) / 100
}

function badges(season: Season, state: LeagueState, memberId: string) {
  const s = season.stats.get(memberId)!
  const list: string[] = []
  if (s.hasBounty) list.push('bounty')
  if (s.hasBoost) list.push('boost')
  if (s.reserveEarned) list.push('reserve')
  if (s.byeUsed) list.push('bye')
  if (underdogId(state, season) === memberId) list.push('underdog')
  return list
}

function gameSummary(state: LeagueState, season: Season, gameId: string) {
  const game = state.games.find(g => g.id === gameId)!
  const winner = game.results.find(r => r.place === 1)
  const blood = firstOut(game).map(r => r.eliminatedBy).find(Boolean)
  const points = season.gamePoints.get(game.id)!
  const bounty = [...points.entries()].filter(([, p]) => p.bounty > 0).map(([id]) => memberName(state, id))
  const parts = [`Game ${game.number}`, winner ? `${memberName(state, winner.memberId)} won` : 'No winner']
  if (blood) parts.push(`First Blood to ${memberName(state, blood)}`)
  if (bounty.length) parts.push(`bounty claimed by ${bounty.join(', ')}`)
  return parts.join(' · ')
}

export interface ViewerAccess {
  isAdmin: boolean
}

export function dashboardView(state: LeagueState, viewerId: string, prices: PriceMap, access: ViewerAccess) {
  const season = computeSeason(state)
  const viewer = state.members.find(m => m.id === viewerId)!
  const viewerStats = season.stats.get(viewerId)!
  const underdog = underdogId(state, season)
  const swapUsed = state.swaps.some(s => s.week === state.week)
  const sideCards = state.cards.filter(c => c.zone === 'side' && c.origin === 'pull')
  const ended = state.season?.status === 'ended'
  const isCommissioner = viewer.role === 'commissioner'
  const allGamesPlayed = state.games.length >= state.settings.totalGames
  const biggestPulls = state.cards
    .filter(c => c.origin === 'pull' && (prices.get(c.id) ?? 0) > 0)
    .sort((a, b) => prices.get(b.id)! - prices.get(a.id)!)
    .slice(0, 5)
    .map(c => {
      const pack = state.packs.find(p => p.id === c.packId)
      return {
        ...cardView(c, state, prices),
        pulledBy: memberName(state, pack?.memberId ?? c.ownerId),
        ownerId: c.ownerId,
        ownerName: memberName(state, c.ownerId),
      }
    })

  const activity = [
    ...state.games.map(g => ({ kind: 'Game', text: gameSummary(state, season, g.id), at: g.loggedAt, week: g.week })),
    ...state.trades.filter(t => t.status === 'accepted').map(t => ({
      kind: 'Trade',
      text: `${memberName(state, t.fromId)} traded ${t.giveName} to ${memberName(state, t.toId)} for ${t.getName}`,
      at: t.resolvedAt!,
      week: t.week,
    })),
    ...state.swaps.map(s => ({
      kind: 'Swap',
      text: `${memberName(state, s.memberId)} took ${s.takes.map(t => `${t.takenName} from ${memberName(state, t.fromId)}`).join(', ')}`,
      at: s.at,
      week: s.week,
    })),
  ].sort((a, b) => b.week - a.week || b.at.localeCompare(a.at)).slice(0, 10)

  const openPacks = (Object.keys(viewerStats.packsOwed) as PackKind[])
    .map(kind => ({ kind, left: Math.max(0, viewerStats.packsOwed[kind] - viewerStats.packsOpened[kind]) }))
    .filter(p => p.left > 0)

  return {
    league: {
      name: state.settings.name,
      week: state.week,
      gamesPlayed: state.games.length,
      totalGames: state.settings.totalGames,
      nextGame: season.nextGame,
      complete: season.complete,
      ended,
      seasonNumber: state.season?.number ?? 1,
      nextGameAt: state.season?.nextGameAt ?? null,
      nextGameNote: state.season?.nextGameNote ?? null,
      timeZone: state.settings.timeZone ?? 'America/Los_Angeles',
      settings: state.settings,
      scoringLocked: state.games.length > 0,
      reserveLeft: season.reserveLeft,
      missedPacks: season.missedPacks,
      packsOpened: state.packs.length,
      finishPoints: state.settings.finishPoints,
      startingLife: state.settings.startingLife,
      boostLife: state.settings.boostLife,
    },
    viewer: {
      id: viewer.id,
      name: viewer.name,
      canLogGame: isCommissioner && !ended && !allGamesPlayed,
      canEditSettings: (isCommissioner || access.isAdmin) && !ended,
      canSchedule: (isCommissioner || access.isAdmin) && !ended && !allGamesPlayed,
      canEndSeason: !ended && (access.isAdmin || (isCommissioner && allGamesPlayed)),
      endsEarly: !allGamesPlayed,
      needsDeck: !state.cards.some(c => c.ownerId === viewerId && c.zone === 'main'),
      byeUsed: viewerStats.byeUsed,
      openPacks,
      isUnderdog: underdog === viewerId && !swapUsed,
    },
    members: state.members.map(m => ({ id: m.id, name: m.name, precon: m.precon })),
    standings: season.standings.map((s, i) => ({
      rank: i + 1,
      memberId: s.memberId,
      name: memberName(state, s.memberId),
      precon: state.members.find(m => m.id === s.memberId)!.precon || 'No deck yet',
      points: s.points,
      firsts: s.firsts,
      seconds: s.seconds,
      firstBloods: s.firstBloods,
      finishes: s.finishes,
      packsToOpen: packsToOpen(s),
      value: total(state.cards.filter(c => c.ownerId === s.memberId), prices),
      badges: badges(season, state, s.memberId),
    })),
    underdog: underdog ? { memberId: underdog, name: memberName(state, underdog), used: swapUsed } : null,
    changes: state.members.map(m => ({
      memberId: m.id,
      name: m.name,
      items: state.changes
        .filter(c => c.memberId === m.id && c.gameNumber === season.nextGame)
        .map(c => ({ added: c.addedName, removed: c.removedName, source: c.source })),
    })),
    offers: state.trades
      .filter(t => t.status === 'pending' && t.week === state.week && (t.toId === viewerId || t.fromId === viewerId))
      .map(t => ({
        id: t.id,
        incoming: t.toId === viewerId,
        otherName: memberName(state, t.toId === viewerId ? t.fromId : t.toId),
        give: t.giveName,
        get: t.getName,
      })),
    activity,
    biggestPulls,
    bulk: state.members.map(m => {
      const mine = sideCards.filter(c => c.ownerId === m.id)
      const count = (r: string) => mine.filter(c => c.rarity === r).length
      return { memberId: m.id, name: m.name, count: mine.length, mythic: count('mythic'), rare: count('rare') }
    }),
  }
}

export function playerView(state: LeagueState, viewerId: string, memberId: string, prices: PriceMap) {
  const member = state.members.find(m => m.id === memberId)
  if (!member) return null
  const season = computeSeason(state)
  const s = season.stats.get(memberId)!
  const rank = season.standings.findIndex(x => x.memberId === memberId) + 1
  const cards = state.cards.filter(c => c.ownerId === memberId)
  return {
    member: { id: member.id, name: member.name, precon: member.precon || 'No deck yet', rank, points: s.points },
    isOwner: viewerId === memberId,
    canUploadDeck: viewerId === memberId && canUploadDeck(state, memberId),
    commanderOptions: viewerId === memberId && state.season?.status !== 'ended'
      ? commanderOptions(state, memberId).map(c => ({ id: c.id, name: cardLabel(c), imageUrl: c.imageUrl ?? null }))
      : [],
    seasonOpen: state.season?.status !== 'ended',
    seasonEnded: state.season?.status === 'ended',
    mainValue: total(cards.filter(c => c.zone === 'main'), prices),
    sideValue: total(cards.filter(c => c.zone === 'side'), prices),
    main: cards.filter(c => c.zone === 'main').map(c => cardView(c, state, prices)),
    side: cards.filter(c => c.zone === 'side').map(c => cardView(c, state, prices)),
    changes: state.changes
      .filter(c => c.memberId === memberId)
      .sort((a, b) => b.at.localeCompare(a.at))
      .map(c => ({ gameNumber: c.gameNumber, added: c.addedName, removed: c.removedName, source: c.source })),
  }
}

export function tradeView(state: LeagueState, viewerId: string, prices: PriceMap) {
  const limit = state.settings.tradesPerPairPerWeek
  const pending = new Set(state.trades.filter(t => t.status === 'pending').flatMap(t => [t.giveCardId, t.getCardId]))
  const tradable = (ownerId: string) => state.cards
    .filter(c => c.ownerId === ownerId && !c.commander && !pending.has(c.id))
    .map(c => cardView(c, state, prices))
  return {
    limit,
    mine: tradable(viewerId),
    partners: state.members.filter(m => m.id !== viewerId).map(m => ({
      id: m.id,
      name: m.name,
      used: tradesThisWeek(state, viewerId, m.id),
      cards: tradable(m.id),
    })),
  }
}

export function swapView(state: LeagueState, viewerId: string, prices: PriceMap) {
  const pending = new Set(state.trades.filter(t => t.status === 'pending').flatMap(t => [t.giveCardId, t.getCardId]))
  const bulk = (ownerId: string) => state.cards
    .filter(c => c.ownerId === ownerId && c.zone === 'side' && c.origin === 'pull' && !pending.has(c.id))
    .map(c => cardView(c, state, prices))
  return {
    mine: bulk(viewerId),
    opponents: state.members.filter(m => m.id !== viewerId).map(m => ({ id: m.id, name: m.name, cards: bulk(m.id) })),
  }
}

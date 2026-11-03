import { computeSeason, findMember, memberName, placesFromOrder, tradesThisWeek, underdogId } from './rules'
import { LeagueError, type DeckCardInput, type LeagueCard, type LeagueSettings, type LeagueState, type PackKind, type PrintingInfo, type PulledCardInput } from './types'

const MAX_PULLS_PER_PACK = 20
const SCRYFALL_IMAGE_HOST = 'https://cards.scryfall.io/'

function nextId(state: LeagueState, prefix: string) {
  state.seq++
  return `${prefix}${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

function now() {
  return new Date().toISOString()
}

const MAX_NAME = 120

export function cardLabel(c: Pick<LeagueCard, 'name' | 'displayName'>) {
  return c.displayName || c.name
}

function requireMember(state: LeagueState, id: string) {
  const m = findMember(state, id)
  if (!m) throw new LeagueError('Not a league member', 403)
  return m
}

function card(state: LeagueState, id: string) {
  const c = state.cards.find(x => x.id === id)
  if (!c) throw new LeagueError('Card not found', 404)
  return c
}

function seasonOpen(state: LeagueState) {
  if (state.season?.status === 'ended') throw new LeagueError('The season has ended')
}

function gamesLeft(state: LeagueState) {
  if (state.games.length >= state.settings.totalGames) throw new LeagueError(`All ${state.settings.totalGames} games are logged`)
}

export interface LogGameInput {
  order: string[]
  tiedWithPrevious: boolean[]
  eliminatedBy: Record<string, string>
  missed: string[]
}

export function logGame(state: LeagueState, actorId: string, input: LogGameInput) {
  const actor = requireMember(state, actorId)
  if (actor.role !== 'commissioner') throw new LeagueError('Only commissioners can log games', 403)
  seasonOpen(state)
  gamesLeft(state)

  const memberIds = state.members.map(m => m.id)
  const missed = new Set(input.missed)
  const order = input.order
  const expected = memberIds.filter(id => !missed.has(id))
  if (order.length < 2) throw new LeagueError('At least 2 players have to play')
  if (order.length !== expected.length || !expected.every(id => order.includes(id))) {
    throw new LeagueError('Every player has to be either in the order or marked as missed')
  }

  const places = placesFromOrder(order, input.tiedWithPrevious ?? [])
  const results = memberIds.map(id => {
    if (missed.has(id)) return { memberId: id, place: null, eliminatedBy: null }
    const idx = order.indexOf(id)
    const isWinner = idx === order.length - 1
    const killer = isWinner ? null : input.eliminatedBy?.[id] ?? null
    if (!isWinner) {
      if (!killer) throw new LeagueError(`Pick who knocked out ${memberName(state, id)}`)
      if (killer === id || !order.includes(killer) || places.get(killer)! >= places.get(id)!) {
        throw new LeagueError(`${memberName(state, id)} has to be knocked out by someone who outlasted them`)
      }
    }
    return { memberId: id, place: places.get(id)!, eliminatedBy: killer }
  })

  state.games.push({ id: nextId(state, 'g'), number: state.games.length + 1, week: state.week, results, loggedBy: actorId, loggedAt: now() })
  state.season = { ...state.season, nextGameAt: null, nextGameNote: null }
  state.week++
}

export function callBye(state: LeagueState, actorId: string) {
  requireMember(state, actorId)
  seasonOpen(state)
  gamesLeft(state)
  if (state.byes.some(b => b.memberId === actorId)) throw new LeagueError('You already used your bye this season')
  state.byes.push({ week: state.week, memberId: actorId })
  state.week++
}

export function openPack(state: LeagueState, actorId: string, kind: PackKind, pulls: PulledCardInput[]) {
  requireMember(state, actorId)
  const season = computeSeason(state)
  const s = season.stats.get(actorId)!
  if (s.packsOpened[kind] >= s.packsOwed[kind]) throw new LeagueError('No pack of that kind left to open')
  if (pulls.length > MAX_PULLS_PER_PACK) throw new LeagueError(`Up to ${MAX_PULLS_PER_PACK} cards per pack`)

  const packId = nextId(state, 'p')
  const cards: LeagueCard[] = pulls.map(p => ({
    id: nextId(state, 'c'),
    name: p.name,
    displayName: typeof p.displayName === 'string' && p.displayName.trim() ? p.displayName.trim().slice(0, MAX_NAME) : undefined,
    typeLine: p.typeLine,
    rarity: p.rarity,
    origin: 'pull',
    ownerId: actorId,
    zone: 'side',
    commander: false,
    packId,
    imageUrl: typeof p.imageUrl === 'string' && p.imageUrl.startsWith(SCRYFALL_IMAGE_HOST) ? p.imageUrl : undefined,
    printing: cleanPrinting(p.printing),
    colorIdentity: Array.isArray(p.colorIdentity) ? p.colorIdentity.filter(c => typeof c === 'string') : undefined,
  }))
  state.cards.push(...cards)
  state.packs.push({ id: packId, memberId: actorId, kind, week: state.week, cardIds: cards.map(c => c.id), openedAt: now() })
}

function cleanPrinting(p: PulledCardInput['printing']): PrintingInfo | undefined {
  if (!p || typeof p.scryfallId !== 'string' || typeof p.collectorNumber !== 'string') return undefined
  return {
    scryfallId: p.scryfallId,
    setCode: String(p.setCode ?? ''),
    collectorNumber: p.collectorNumber,
    label: String(p.label ?? 'Regular').slice(0, 40),
    foil: p.foil === true,
  }
}

export function commanderColors(state: LeagueState, memberId: string) {
  const commanders = state.cards.filter(c => c.ownerId === memberId && c.commander)
  if (commanders.length === 0 || commanders.some(c => !c.colorIdentity)) return null
  return new Set(commanders.flatMap(c => c.colorIdentity!))
}

function assertLegal(state: LeagueState, memberId: string, c: LeagueCard) {
  const colors = commanderColors(state, memberId)
  if (!colors || !c.colorIdentity) return
  const outside = c.colorIdentity.filter(x => !colors.has(x))
  if (outside.length > 0) {
    throw new LeagueError(`${cardLabel(c)} is outside ${memberName(state, memberId)}'s commander colors`)
  }
}

function packLabel(state: LeagueState, c: LeagueCard) {
  const pack = state.packs.find(p => p.id === c.packId)
  if (!pack) return 'From sideboard'
  return {
    opening: 'Pulled on opening night',
    weekly: `Pulled from week ${pack.week} pack`,
    reserve: 'Pulled from reserve pack',
    prize: 'Pulled from prize pack',
  }[pack.kind]
}

export function swapIntoDeck(state: LeagueState, actorId: string, inId: string, outId: string) {
  requireMember(state, actorId)
  seasonOpen(state)
  const cardIn = card(state, inId)
  const cardOut = card(state, outId)
  if (cardIn.ownerId !== actorId || cardOut.ownerId !== actorId) throw new LeagueError('You can only change your own deck', 403)
  if (cardIn.zone !== 'side' || cardOut.zone !== 'main') throw new LeagueError('Pick a sideboard card to bring in and a main deck card to take out')
  if (cardOut.commander) throw new LeagueError("Your commander can't be swapped out")
  assertLegal(state, actorId, cardIn)

  cardIn.zone = 'main'
  cardOut.zone = 'side'
  state.changes.push({
    id: nextId(state, 'd'),
    week: state.week,
    gameNumber: state.games.length + 1,
    memberId: actorId,
    addedName: cardLabel(cardIn),
    removedName: cardLabel(cardOut),
    source: packLabel(state, cardIn),
    at: now(),
  })
}

export function commanderOptions(state: LeagueState, memberId: string) {
  const main = state.cards.filter(c => c.ownerId === memberId && c.zone === 'main')
  const deckColors = new Set(main.flatMap(c => c.colorIdentity ?? []))
  return main.filter(c => {
    const isLegend = c.typeLine.includes('Legendary') && c.typeLine.split(' // ')[0].includes('Creature')
    const coversDeck = !!c.colorIdentity && [...deckColors].every(x => c.colorIdentity!.includes(x))
    return !c.commander && c.origin === 'precon' && isLegend && coversDeck
  })
}

export function changeCommander(state: LeagueState, actorId: string, cardId: string) {
  requireMember(state, actorId)
  seasonOpen(state)
  const next = card(state, cardId)
  if (next.ownerId !== actorId) throw new LeagueError('You can only change your own deck', 403)
  if (!commanderOptions(state, actorId).some(c => c.id === cardId)) {
    throw new LeagueError(`${cardLabel(next)} can't lead this deck. It needs to be a legendary creature from your precon that covers all of the deck's colors.`)
  }
  const previous = state.cards.filter(c => c.ownerId === actorId && c.commander)
  for (const c of previous) c.commander = false
  next.commander = true

  state.changes.push({
    id: nextId(state, 'd'),
    week: state.week,
    gameNumber: state.games.length + 1,
    memberId: actorId,
    addedName: cardLabel(next),
    removedName: previous.map(cardLabel).join(', '),
    source: 'Commander change',
    at: now(),
  })
}

export function proposeTrade(state: LeagueState, actorId: string, toId: string, giveCardId: string, getCardId: string) {
  requireMember(state, actorId)
  requireMember(state, toId)
  seasonOpen(state)
  if (toId === actorId) throw new LeagueError("You can't trade with yourself")
  const give = card(state, giveCardId)
  const get = card(state, getCardId)
  if (give.ownerId !== actorId || get.ownerId !== toId) throw new LeagueError('Those cards changed hands, refresh and try again', 409)
  if (give.commander || get.commander) throw new LeagueError("Commanders can't be traded")
  if (tradesThisWeek(state, actorId, toId) >= state.settings.tradesPerPairPerWeek) {
    throw new LeagueError(`You've hit ${state.settings.tradesPerPairPerWeek} trades with ${memberName(state, toId)} this week`)
  }
  const busy = state.trades.some(t => t.status === 'pending' && [t.giveCardId, t.getCardId].some(id => id === giveCardId || id === getCardId))
  if (busy) throw new LeagueError('One of those cards is already in a pending trade')

  state.trades.push({
    id: nextId(state, 't'),
    week: state.week,
    fromId: actorId,
    toId,
    giveCardId,
    getCardId,
    giveName: cardLabel(give),
    getName: cardLabel(get),
    status: 'pending',
    createdAt: now(),
    resolvedAt: null,
  })
}

export function respondTrade(state: LeagueState, actorId: string, tradeId: string, response: 'accept' | 'decline' | 'cancel') {
  const trade = state.trades.find(t => t.id === tradeId)
  if (!trade || trade.status !== 'pending') throw new LeagueError('That offer is no longer open', 404)
  if (response === 'cancel' ? trade.fromId !== actorId : trade.toId !== actorId) throw new LeagueError('Not your offer to answer', 403)
  if (response === 'accept' && trade.week !== state.week) throw new LeagueError('That offer expired when the week ended')

  trade.resolvedAt = now()
  if (response !== 'accept') {
    trade.status = response === 'cancel' ? 'cancelled' : 'declined'
    return
  }

  const give = card(state, trade.giveCardId)
  const get = card(state, trade.getCardId)
  if (give.ownerId !== trade.fromId || get.ownerId !== trade.toId) {
    throw new LeagueError('One of those cards already moved. Decline this offer and send a new one', 409)
  }

  const giveZone = give.zone
  const getZone = get.zone
  if (giveZone === 'main') assertLegal(state, trade.fromId, get)
  if (getZone === 'main') assertLegal(state, trade.toId, give)
  give.ownerId = trade.toId
  give.zone = getZone
  get.ownerId = trade.fromId
  get.zone = giveZone
  trade.status = 'accepted'

  const gameNumber = state.games.length + 1
  if (giveZone === 'main') {
    state.changes.push({ id: nextId(state, 'd'), week: state.week, gameNumber, memberId: trade.fromId, addedName: cardLabel(get), removedName: cardLabel(give), source: `Trade with ${memberName(state, trade.toId)}`, at: now() })
  }
  if (getZone === 'main') {
    state.changes.push({ id: nextId(state, 'd'), week: state.week, gameNumber, memberId: trade.toId, addedName: cardLabel(give), removedName: cardLabel(get), source: `Trade with ${memberName(state, trade.fromId)}`, at: now() })
  }
}

export interface SwapTakeInput {
  fromId: string
  takeCardId: string
  giveCardId: string
}

export function underdogSwap(state: LeagueState, actorId: string, takes: SwapTakeInput[]) {
  requireMember(state, actorId)
  seasonOpen(state)
  if (underdogId(state, computeSeason(state)) !== actorId) throw new LeagueError('Only the player in last place can use the Underdog Swap', 403)
  if (state.swaps.some(s => s.week === state.week)) throw new LeagueError('The Underdog Swap was already used this week')
  if (takes.length === 0) throw new LeagueError('Pick at least one card to take')
  const opponents = new Set(takes.map(t => t.fromId))
  if (opponents.size !== takes.length || opponents.has(actorId)) throw new LeagueError('Take at most 1 card from each opponent')

  const pendingIds = new Set(state.trades.filter(t => t.status === 'pending').flatMap(t => [t.giveCardId, t.getCardId]))
  const given = new Set<string>()
  const resolved = takes.map(t => {
    const taken = card(state, t.takeCardId)
    const offered = card(state, t.giveCardId)
    if (taken.ownerId !== t.fromId || taken.zone !== 'side' || taken.origin !== 'pull') {
      throw new LeagueError(`${cardLabel(taken)} isn't in ${memberName(state, t.fromId)}'s pulled bulk`)
    }
    if (offered.ownerId !== actorId || offered.zone !== 'side' || offered.origin !== 'pull') {
      throw new LeagueError(`${cardLabel(offered)} has to be one of your pulls outside your deck`)
    }
    if (offered.rarity !== taken.rarity) throw new LeagueError(`Give back a ${taken.rarity} for ${cardLabel(taken)}`)
    if (given.has(offered.id)) throw new LeagueError(`${cardLabel(offered)} can only be given once`)
    if (pendingIds.has(taken.id) || pendingIds.has(offered.id)) throw new LeagueError('One of those cards is in a pending trade')
    given.add(offered.id)
    return { t, taken, offered }
  })

  for (const { t, taken, offered } of resolved) {
    taken.ownerId = actorId
    offered.ownerId = t.fromId
  }
  state.swaps.push({
    id: nextId(state, 's'),
    week: state.week,
    memberId: actorId,
    takes: resolved.map(({ t, taken, offered }) => ({ fromId: t.fromId, takenName: cardLabel(taken), givenName: cardLabel(offered) })),
    at: now(),
  })
}

export function endSeason(state: LeagueState, actorId: string, isAdmin: boolean) {
  const actor = requireMember(state, actorId)
  seasonOpen(state)
  if (!isAdmin) {
    if (actor.role !== 'commissioner') throw new LeagueError('Only commissioners can end the season', 403)
    if (state.games.length < state.settings.totalGames) {
      throw new LeagueError(`Commissioners can end the season after game ${state.settings.totalGames}. An admin can end it early.`, 403)
    }
  }
  const at = now()
  for (const t of state.trades) {
    if (t.status === 'pending') {
      t.status = 'cancelled'
      t.resolvedAt = at
    }
  }
  state.season = { ...state.season, status: 'ended', endedAt: at, endedBy: actorId }
}

export function markAddedToBinder(state: LeagueState, actorId: string, cardIds: string[]) {
  requireMember(state, actorId)
  if (state.season?.status !== 'ended') throw new LeagueError('Cards can be added to your binder once the season ends')
  const ids = new Set(cardIds)
  for (const c of state.cards) if (ids.has(c.id) && c.ownerId === actorId) c.addedToBinder = true
}

const DECK_SIZE = 100

export function canUploadDeck(state: LeagueState, memberId: string) {
  return state.season?.status !== 'ended'
    && state.games.length === 0
    && !state.changes.some(c => c.memberId === memberId)
    && !state.trades.some(t => t.status === 'accepted' && (t.fromId === memberId || t.toId === memberId))
}

export function setDecklist(state: LeagueState, actorId: string, deckName: string, cards: DeckCardInput[]) {
  const member = requireMember(state, actorId)
  if (!canUploadDeck(state, actorId)) throw new LeagueError('Decks lock once game 1 is played or you have made a swap or trade')
  const total = cards.reduce((n, c) => n + c.qty, 0)
  if (total !== DECK_SIZE) throw new LeagueError(`Decks need exactly ${DECK_SIZE} cards including the commander. This list has ${total}.`)
  const commanders = cards.filter(c => c.commander).reduce((n, c) => n + c.qty, 0)
  if (commanders < 1 || commanders > 2) throw new LeagueError('Mark 1 or 2 commanders. Put them in their own block at the top of the list.')

  state.cards = state.cards.filter(c => !(c.ownerId === actorId && c.origin === 'precon'))
  for (const c of state.cards) if (c.ownerId === actorId) c.zone = 'side'
  for (const input of cards) {
    for (let i = 0; i < input.qty; i++) {
      state.cards.push({
        id: nextId(state, 'c'),
        name: input.name,
        displayName: input.displayName ?? undefined,
        typeLine: input.typeLine,
        rarity: input.rarity,
        origin: 'precon',
        ownerId: actorId,
        zone: 'main',
        commander: input.commander,
        packId: null,
        imageUrl: input.imageUrl,
        printing: input.printing ?? undefined,
        colorIdentity: input.colorIdentity,
      })
    }
  }
  member.precon = deckName.trim().slice(0, 60) || member.precon
}

const MAX_NOTE = 120

export function scheduleGame(state: LeagueState, actorId: string, isAdmin: boolean, at: string | null, note: string | null) {
  const actor = requireMember(state, actorId)
  if (actor.role !== 'commissioner' && !isAdmin) throw new LeagueError('Only commissioners can set game dates', 403)
  seasonOpen(state)
  gamesLeft(state)
  if (at != null && Number.isNaN(new Date(at).getTime())) throw new LeagueError('Pick a valid date and time')
  state.season = {
    ...state.season,
    nextGameAt: at ? new Date(at).toISOString() : null,
    nextGameNote: at ? note?.trim().slice(0, MAX_NOTE) || null : null,
  }
}

export const LOCKED_AFTER_FIRST_GAME = ['finishPoints', 'firstBloodBonus', 'bountyBonus', 'missedPoints', 'openingPacks', 'reservePacks'] as const

function int(v: unknown, min: number, max: number, label: string) {
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) throw new LeagueError(`${label} must be a whole number from ${min} to ${max}`)
  return n
}

function ints(v: unknown, length: number, min: number, max: number, label: string) {
  if (!Array.isArray(v) || v.length !== length) throw new LeagueError(`${label} needs ${length} values`)
  return v.map(x => int(x, min, max, label))
}

export function updateSettings(state: LeagueState, actorId: string, isAdmin: boolean, changes: Partial<LeagueSettings>) {
  const actor = requireMember(state, actorId)
  if (actor.role !== 'commissioner' && !isAdmin) throw new LeagueError('Only commissioners can change league settings', 403)
  seasonOpen(state)
  const started = state.games.length > 0
  const next = { ...state.settings }

  for (const key of LOCKED_AFTER_FIRST_GAME) {
    if (changes[key] === undefined) continue
    if (started && JSON.stringify(changes[key]) !== JSON.stringify(state.settings[key])) {
      throw new LeagueError('Scoring and pack rules lock once game 1 is played')
    }
  }
  if (changes.name !== undefined) {
    const name = String(changes.name).trim().slice(0, 60)
    if (!name) throw new LeagueError('The league needs a name')
    next.name = name
  }
  if (changes.totalGames !== undefined) next.totalGames = int(changes.totalGames, Math.max(1, state.games.length), 20, 'Season length')
  if (changes.tradesPerPairPerWeek !== undefined) next.tradesPerPairPerWeek = int(changes.tradesPerPairPerWeek, 0, 10, 'Trade cap')
  if (changes.prizePacks !== undefined) next.prizePacks = ints(changes.prizePacks, state.members.length, 0, 50, 'Prize packs')
  if (!started) {
    if (changes.finishPoints !== undefined) next.finishPoints = ints(changes.finishPoints, state.members.length, 0, 100, 'Finish points')
    if (changes.firstBloodBonus !== undefined) next.firstBloodBonus = int(changes.firstBloodBonus, 0, 20, 'First Blood bonus')
    if (changes.bountyBonus !== undefined) next.bountyBonus = int(changes.bountyBonus, 0, 20, 'Bounty bonus')
    if (changes.missedPoints !== undefined) next.missedPoints = int(changes.missedPoints, 0, 20, 'Missed-week points')
    if (changes.openingPacks !== undefined) next.openingPacks = int(changes.openingPacks, 0, 10, 'Opening night packs')
    if (changes.reservePacks !== undefined) next.reservePacks = int(changes.reservePacks, 0, 10, 'Reserve packs')
  }
  state.settings = next
}

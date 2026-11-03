export type Role = 'player' | 'commissioner'
export type Zone = 'main' | 'side'
export type Origin = 'precon' | 'pull'
export type PackKind = 'opening' | 'weekly' | 'reserve' | 'prize'
export type TradeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'

export interface LeagueSettings {
  name: string
  totalGames: number
  finishPoints: number[]
  firstBloodBonus: number
  bountyBonus: number
  missedPoints: number
  tradesPerPairPerWeek: number
  openingPacks: number
  reservePacks: number
  startingLife: number
  boostLife: number
  prizePacks: number[]
  packSet: string
  timeZone: string
}

export interface Member {
  id: string
  userId?: string | null
  email: string | null
  name: string
  precon: string
  role: Role
}

export interface LeagueCard {
  id: string
  name: string
  displayName?: string
  typeLine: string
  rarity: string
  origin: Origin
  ownerId: string
  zone: Zone
  commander: boolean
  packId: string | null
  imageUrl?: string | null
  printing?: PrintingInfo
  addedToBinder?: boolean
  colorIdentity?: string[]
  manaCost?: string
}

export interface GameResult {
  memberId: string
  place: number | null
  eliminatedBy: string | null
}

export interface Game {
  id: string
  number: number
  week: number
  results: GameResult[]
  loggedBy: string
  loggedAt: string
}

export interface Bye {
  week: number
  memberId: string
}

export interface Pack {
  id: string
  memberId: string
  kind: PackKind
  week: number
  cardIds: string[]
  openedAt: string
}

export interface Trade {
  id: string
  week: number
  fromId: string
  toId: string
  giveCardId: string
  getCardId: string
  giveName: string
  getName: string
  status: TradeStatus
  createdAt: string
  resolvedAt: string | null
}

export interface UnderdogSwap {
  id: string
  week: number
  memberId: string
  takes: { fromId: string; takenName: string; givenName: string }[]
  at: string
}

export interface DeckChange {
  id: string
  week: number
  gameNumber: number
  memberId: string
  addedName: string
  removedName: string
  source: string
  at: string
}

export interface Season {
  id?: string
  leagueId?: string
  version?: number
  number: number
  status: 'active' | 'ended'
  endedAt: string | null
  endedBy: string | null
  nextGameAt?: string | null
  nextGameNote?: string | null
}

export interface LeagueState {
  settings: LeagueSettings
  season: Season
  week: number
  members: Member[]
  cards: LeagueCard[]
  games: Game[]
  byes: Bye[]
  packs: Pack[]
  trades: Trade[]
  swaps: UnderdogSwap[]
  changes: DeckChange[]
  seq: number
}

export interface PrintingInfo {
  scryfallId: string
  setCode: string
  collectorNumber: string
  label: string
  foil: boolean
}

export interface PulledCardInput {
  name: string
  displayName?: string
  typeLine: string
  rarity: string
  imageUrl?: string | null
  printing?: PrintingInfo
  colorIdentity?: string[]
}

export interface DeckCardInput {
  name: string
  displayName: string | null
  typeLine: string
  rarity: string
  qty: number
  commander: boolean
  imageUrl: string | null
  colorIdentity: string[]
  printing: PrintingInfo | null
}

export class LeagueError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

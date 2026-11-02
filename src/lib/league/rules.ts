import type { Game, LeagueState, Member, PackKind } from './types'

export interface GamePoints {
  finish: number
  firstBlood: number
  bounty: number
  total: number
}

export interface MemberStats {
  memberId: string
  points: number
  firsts: number
  seconds: number
  firstBloods: number
  finishes: (number | null)[]
  hasBounty: boolean
  hasBoost: boolean
  reserveEarned: boolean
  byeUsed: boolean
  packsOwed: Record<PackKind, number>
  packsOpened: Record<PackKind, number>
}

export interface Season {
  stats: Map<string, MemberStats>
  standings: MemberStats[]
  gamePoints: Map<string, Map<string, GamePoints>>
  reserveLeft: number
  missedPacks: number
  complete: boolean
  nextGame: number
}

function emptyPacks(): Record<PackKind, number> {
  return { opening: 0, weekly: 0, reserve: 0, prize: 0 }
}

export function playerCount(game: Game) {
  return game.results.filter(r => r.place != null).length
}

export function firstOut(game: Game) {
  const played = game.results.filter(r => r.place != null)
  const worst = Math.max(...played.map(r => r.place!))
  return played.filter(r => r.place === worst)
}

// Places for an elimination order (first out → winner). A tied player shares the higher place of their group.
export function placesFromOrder(order: string[], tiedWithPrevious: boolean[]) {
  const places = new Map<string, number>()
  let i = 0
  while (i < order.length) {
    let j = i
    while (j + 1 < order.length - 1 && tiedWithPrevious[j + 1]) j++
    const place = order.length - j
    for (let k = i; k <= j; k++) places.set(order[k], place)
    i = j + 1
  }
  return places
}

function scoreGame(game: Game, state: LeagueState, bountyHolders: Set<string>) {
  const { settings } = state
  const points = new Map<string, GamePoints>()
  for (const r of game.results) {
    const finish = r.place == null ? settings.missedPoints : settings.finishPoints[r.place - 1] ?? 0
    points.set(r.memberId, { finish, firstBlood: 0, bounty: 0, total: 0 })
  }
  const bloodBy = firstOut(game).map(r => r.eliminatedBy).find(Boolean)
  if (bloodBy && points.has(bloodBy)) points.get(bloodBy)!.firstBlood = settings.firstBloodBonus
  for (const r of game.results) {
    if (r.place == null || !r.eliminatedBy || !bountyHolders.has(r.memberId)) continue
    const killer = points.get(r.eliminatedBy)
    if (killer) killer.bounty += settings.bountyBonus
  }
  for (const p of points.values()) p.total = p.finish + p.firstBlood + p.bounty
  return points
}

function headToHead(state: LeagueState, a: string, b: string) {
  let score = 0
  for (const g of state.games) {
    const ra = g.results.find(r => r.memberId === a)?.place
    const rb = g.results.find(r => r.memberId === b)?.place
    if (ra == null || rb == null || ra === rb) continue
    score += ra < rb ? 1 : -1
  }
  return score
}

export function computeSeason(state: LeagueState): Season {
  const { settings } = state
  const stats = new Map<string, MemberStats>()
  for (const m of state.members) {
    stats.set(m.id, {
      memberId: m.id,
      points: 0,
      firsts: 0,
      seconds: 0,
      firstBloods: 0,
      finishes: [],
      hasBounty: false,
      hasBoost: false,
      reserveEarned: false,
      byeUsed: state.byes.some(b => b.memberId === m.id),
      packsOwed: { ...emptyPacks(), opening: settings.openingPacks },
      packsOpened: emptyPacks(),
    })
  }

  const winStreak = new Map<string, number>()
  const lastStreak = new Map<string, number>()
  const gamePoints = new Map<string, Map<string, GamePoints>>()
  let reserveLeft = settings.reservePacks
  let missedPacks = 0

  for (const game of [...state.games].sort((a, b) => a.number - b.number)) {
    const bountyHolders = new Set(state.members.filter(m => (winStreak.get(m.id) ?? 0) >= 2).map(m => m.id))
    const points = scoreGame(game, state, bountyHolders)
    gamePoints.set(game.id, points)
    const players = playerCount(game)

    for (const r of game.results) {
      const s = stats.get(r.memberId)
      if (!s) continue
      const p = points.get(r.memberId)!
      s.points += p.total
      if (p.firstBlood) s.firstBloods++
      s.finishes.push(r.place)
      if (r.place == null) {
        missedPacks++
        winStreak.set(r.memberId, 0)
        continue
      }
      s.packsOwed.weekly++
      if (r.place === 1) s.firsts++
      if (r.place === 2) s.seconds++
      winStreak.set(r.memberId, r.place === 1 ? (winStreak.get(r.memberId) ?? 0) + 1 : 0)
      const last = r.place === players ? (lastStreak.get(r.memberId) ?? 0) + 1 : 0
      lastStreak.set(r.memberId, last)
      if (last >= 2 && !s.reserveEarned && reserveLeft > 0) {
        s.reserveEarned = true
        s.packsOwed.reserve = 1
        reserveLeft--
      }
    }
  }

  for (const s of stats.values()) {
    s.hasBounty = (winStreak.get(s.memberId) ?? 0) >= 2
    s.hasBoost = (lastStreak.get(s.memberId) ?? 0) >= 3
  }
  for (const pack of state.packs) {
    const s = stats.get(pack.memberId)
    if (s) s.packsOpened[pack.kind]++
  }

  const standings = [...stats.values()].sort((a, b) =>
    b.points - a.points
    || b.firsts - a.firsts
    || b.seconds - a.seconds
    || headToHead(state, b.memberId, a.memberId)
    || memberName(state, a.memberId).localeCompare(memberName(state, b.memberId))
  )

  const complete = state.games.length >= settings.totalGames || state.season?.status === 'ended'
  if (complete) {
    standings.forEach((s, i) => { s.packsOwed.prize = settings.prizePacks[i] ?? 0 })
  }

  return { stats, standings, gamePoints, reserveLeft, missedPacks, complete, nextGame: state.games.length + 1 }
}

export function memberName(state: LeagueState, id: string) {
  return state.members.find(m => m.id === id)?.name ?? 'Unknown'
}

export function findMember(state: LeagueState, id: string): Member | undefined {
  return state.members.find(m => m.id === id)
}

export function underdogId(state: LeagueState, season: Season) {
  if (state.games.length === 0 || season.complete) return null
  return season.standings[season.standings.length - 1]?.memberId ?? null
}

export function tradesThisWeek(state: LeagueState, a: string, b: string) {
  return state.trades.filter(t =>
    t.week === state.week
    && (t.status === 'pending' || t.status === 'accepted')
    && ((t.fromId === a && t.toId === b) || (t.fromId === b && t.toId === a))
  ).length
}

export function packsToOpen(s: MemberStats) {
  return (Object.keys(s.packsOwed) as PackKind[]).reduce((n, k) => n + Math.max(0, s.packsOwed[k] - s.packsOpened[k]), 0)
}

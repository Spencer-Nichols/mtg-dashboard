import { callBye, logGame, openPack, proposeTrade, respondTrade, swapIntoDeck } from './actions'
import type { LeagueCard, LeagueSettings, LeagueState, Member, PulledCardInput } from './types'

export const DEFAULT_SETTINGS: LeagueSettings = {
  name: 'The Arcane Circuit',
  totalGames: 8,
  finishPoints: [10, 7, 5, 3],
  firstBloodBonus: 1,
  bountyBonus: 1,
  missedPoints: 1,
  tradesPerPairPerWeek: 2,
  openingPacks: 2,
  reservePacks: 2,
  startingLife: 40,
  boostLife: 45,
  prizePacks: [10, 8, 6, 6],
  packSet: 'trk',
  timeZone: 'America/Los_Angeles',
}

const MEMBERS: Member[] = [
  { id: 'm1', email: null, name: 'Spencer', precon: 'Mock Precon A', role: 'commissioner' },
  { id: 'm2', email: null, name: 'Elija', precon: 'Mock Precon B', role: 'player' },
  { id: 'm3', email: null, name: 'Brian', precon: 'Mock Precon C', role: 'player' },
  { id: 'm4', email: null, name: 'Jacob', precon: 'Mock Precon D', role: 'player' },
]

type Seed = [name: string, typeLine: string, rarity: string]

const COMMANDERS: Record<string, Seed> = {
  m1: ['Mock Commander A', 'Legendary Creature — Human Soldier', 'mythic'],
  m2: ['Mock Commander B', 'Legendary Creature — Elf Druid', 'mythic'],
  m3: ['Mock Commander C', 'Legendary Creature — Vulcan Scientist', 'mythic'],
  m4: ['Mock Commander D', 'Legendary Creature — Android Wizard', 'mythic'],
}

const NONLANDS: Record<string, Seed[]> = {
  m1: [
    ['Sol Ring', 'Artifact', 'uncommon'], ['Mind Stone', 'Artifact', 'uncommon'], ['Thought Vessel', 'Artifact', 'common'],
    ['Divine Verdict', 'Instant', 'common'], ['Wrath of God', 'Sorcery', 'rare'], ['Wall of Omens', 'Creature — Wall', 'uncommon'],
    ['Sun Titan', 'Creature — Giant', 'mythic'], ['Smothering Tithe', 'Enchantment', 'rare'], ['Swiftfoot Boots', 'Artifact — Equipment', 'uncommon'],
    ['Cancel', 'Instant', 'common'], ['Mulldrifter', 'Creature — Elemental', 'uncommon'], ['Solemn Simulacrum', 'Artifact Creature — Golem', 'rare'],
  ],
  m2: [
    ['Sol Ring', 'Artifact', 'uncommon'], ['Llanowar Elves', 'Creature — Elf Druid', 'common'], ['Elvish Mystic', 'Creature — Elf Druid', 'common'],
    ['Kodama\'s Reach', 'Sorcery — Arcane', 'common'], ['Beast Within', 'Instant', 'uncommon'], ['Eternal Witness', 'Creature — Human Shaman', 'uncommon'],
    ['Lightning Greaves', 'Artifact — Equipment', 'uncommon'], ['Reclamation Sage', 'Creature — Elf Shaman', 'uncommon'], ['Acidic Slime', 'Creature — Ooze', 'uncommon'],
    ['Harmonize', 'Sorcery', 'uncommon'], ['Craterhoof Behemoth', 'Creature — Beast', 'mythic'], ['Fellwar Stone', 'Artifact', 'uncommon'],
  ],
  m3: [
    ['Sol Ring', 'Artifact', 'uncommon'], ['Arcane Signet', 'Artifact', 'common'], ['Counterspell', 'Instant', 'uncommon'],
    ['Rhystic Study', 'Enchantment', 'common'], ['Coiling Oracle', 'Creature — Snake Elf Druid', 'common'], ['Ponder', 'Sorcery', 'common'],
    ['Cultivate', 'Sorcery', 'common'], ['Commander\'s Sphere', 'Artifact', 'common'], ['Mystic Snake', 'Creature — Snake', 'rare'],
    ['Growth Spiral', 'Instant', 'common'], ['Kenrith\'s Transformation', 'Enchantment — Aura', 'uncommon'], ['Simic Signet', 'Artifact', 'uncommon'],
  ],
  m4: [
    ['Sol Ring', 'Artifact', 'uncommon'], ['Arcane Signet', 'Artifact', 'common'], ['Cancel', 'Instant', 'common'],
    ['Thrummingbird', 'Artifact Creature — Bird Horror', 'uncommon'], ['Chief Engineer', 'Creature — Vedalken Artificer', 'rare'], ['Sai, Master Thopterist', 'Legendary Creature — Human Artificer', 'rare'],
    ['Thopter Spy Network', 'Enchantment', 'rare'], ['Whir of Invention', 'Instant', 'rare'], ['Swan Song', 'Instant', 'rare'],
    ['Talisman of Dominance', 'Artifact', 'uncommon'], ['Thoughtcast', 'Sorcery', 'common'], ['Etherium Sculptor', 'Artifact Creature — Vedalken Artificer', 'common'],
  ],
}

const UTILITY_LANDS: Seed[] = [['Command Tower', 'Land', 'common'], ['Evolving Wilds', 'Land', 'common'], ['Reliquary Tower', 'Land', 'uncommon']]
const BASICS: Record<string, string> = { m1: 'Plains', m2: 'Forest', m3: 'Island', m4: 'Island' }

const PULLS: Seed[] = [
  ['Swords to Plowshares', 'Instant', 'uncommon'], ['Counterbalance', 'Enchantment', 'uncommon'], ['Opt', 'Instant', 'common'],
  ['Rampant Growth', 'Sorcery', 'common'], ['Path to Exile', 'Instant', 'uncommon'], ['Brainstorm', 'Instant', 'common'],
  ['Fierce Guardianship', 'Instant', 'rare'], ['Teferi\'s Protection', 'Instant', 'rare'], ['Mock Starship Rare', 'Artifact — Vehicle', 'rare'],
  ['Mock Captain Mythic', 'Legendary Creature — Human Soldier', 'mythic'], ['Mock Away Team', 'Creature — Human Scientist', 'common'], ['Mock Phaser Volley', 'Instant', 'uncommon'],
  ['Mock Warp Jump', 'Sorcery', 'common'], ['Mock Holodeck', 'Enchantment', 'rare'], ['Cultivate', 'Sorcery', 'common'],
  ['Ponder', 'Sorcery', 'common'], ['Beast Within', 'Instant', 'uncommon'], ['Mock Tribble Swarm', 'Creature — Tribble', 'uncommon'],
]

function deck(memberId: string, startSeq: number): LeagueCard[] {
  let seq = startSeq
  const make = ([name, typeLine, rarity]: Seed, commander = false): LeagueCard => ({
    id: `c${++seq}`, name, typeLine, rarity, origin: 'precon', ownerId: memberId, zone: 'main', commander, packId: null,
  })
  const cards = [make(COMMANDERS[memberId], true), ...NONLANDS[memberId].map(s => make(s)), ...UTILITY_LANDS.map(s => make(s))]
  while (cards.length < 100) cards.push(make([BASICS[memberId], `Basic Land — ${BASICS[memberId]}`, 'common']))
  return cards
}

function pulls(offset: number, count: number): PulledCardInput[] {
  return Array.from({ length: count }, (_, i) => {
    const [name, typeLine, rarity] = PULLS[(offset + i * 5) % PULLS.length]
    return { name, typeLine, rarity }
  })
}

function cardId(state: LeagueState, ownerId: string, name: string) {
  const c = state.cards.find(x => x.ownerId === ownerId && x.name === name)
  if (!c) throw new Error(`Seed card missing: ${name}`)
  return c.id
}

function seed(): LeagueState {
  const state: LeagueState = {
    settings: structuredClone(DEFAULT_SETTINGS),
    season: { number: 1, status: 'active', endedAt: null, endedBy: null },
    week: 1,
    members: MEMBERS.map(m => ({ ...m })),
    cards: [],
    games: [],
    byes: [],
    packs: [],
    trades: [],
    swaps: [],
    changes: [],
    seq: 0,
  }
  for (const m of state.members) {
    state.cards.push(...deck(m.id, state.seq))
    state.seq += 100
  }
  const ids = state.members.map(m => m.id)

  ids.forEach((id, i) => {
    openPack(state, id, 'opening', pulls(i * 3, 3))
    openPack(state, id, 'opening', pulls(i * 3 + 1, 3))
  })
  logGame(state, 'm1', { order: ['m4', 'm3', 'm2', 'm1'], tiedWithPrevious: [], eliminatedBy: { m4: 'm1', m3: 'm2', m2: 'm1' }, missed: [] })
  ids.forEach((id, i) => openPack(state, id, 'weekly', pulls(i + 7, 2)))
  swapIntoDeck(state, 'm4', cardId(state, 'm4', 'Opt'), cardId(state, 'm4', 'Thoughtcast'))

  logGame(state, 'm1', { order: ['m4', 'm2', 'm3', 'm1'], tiedWithPrevious: [], eliminatedBy: { m4: 'm3', m2: 'm1', m3: 'm1' }, missed: [] })
  ids.forEach((id, i) => openPack(state, id, 'weekly', pulls(i + 11, 2)))
  callBye(state, 'm3')

  logGame(state, 'm1', { order: ['m3', 'm4', 'm1', 'm2'], tiedWithPrevious: [], eliminatedBy: { m3: 'm4', m4: 'm2', m1: 'm2' }, missed: [] })
  ids.forEach((id, i) => { if (id !== 'm1' && id !== 'm2') openPack(state, id, 'weekly', pulls(i + 2, 2)) })
  openPack(state, 'm4', 'reserve', pulls(5, 3))

  swapIntoDeck(state, 'm1', cardId(state, 'm1', 'Swords to Plowshares'), cardId(state, 'm1', 'Divine Verdict'))
  proposeTrade(state, 'm1', 'm3', cardId(state, 'm1', 'Mind Stone'), cardId(state, 'm3', 'Arcane Signet'))
  respondTrade(state, 'm3', state.trades[state.trades.length - 1].id, 'accept')
  proposeTrade(state, 'm2', 'm1', cardId(state, 'm2', 'Fellwar Stone'), cardId(state, 'm1', 'Thought Vessel'))
  return state
}

function emptySeason(): LeagueState {
  return {
    settings: structuredClone(DEFAULT_SETTINGS),
    season: { number: 1, status: 'active', endedAt: null, endedBy: null },
    week: 1,
    members: MEMBERS.map(m => ({ ...m, precon: '' })),
    cards: [],
    games: [],
    byes: [],
    packs: [],
    trades: [],
    swaps: [],
    changes: [],
    seq: 0,
  }
}

export function seedLeague(emails: Record<string, string | null>, empty = false) {
  const state = empty ? emptySeason() : seed()
  for (const m of state.members) m.email = emails[m.id] ?? null
  return state
}

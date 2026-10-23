import type { SupabaseClient } from '@supabase/supabase-js'
import { type ScryfallCard, type FoilType, ScryfallRateLimitError, fetchCollection, getPriceByFoilType, sleep } from '@/lib/scryfall'
import { type Board, type ParsedLine, parseDecklist } from '@/lib/deck-idea-parse'
import { createServiceClient } from '@/lib/supabase/service'

const BASE = 'https://api.scryfall.com'
const HEADERS = { 'User-Agent': 'SpencerMTGDashboard/1.0', Accept: 'application/json' }
const BATCH_SIZE = 75
const REQUEST_DELAY = 120
const MAX_SEARCH_PAGES = 4

export const MAX_DECK_IDEAS = 3

export interface DeckScryfallCard extends ScryfallCard {
  oracle_id?: string
  color_identity?: string[]
  digital?: boolean
  oversized?: boolean
  games?: string[]
  finishes?: string[]
}

export interface DeckCardRow {
  board: Board
  qty: number
  name: string
  set_code: string | null
  collector_number: string | null
  foil_type: FoilType
  scryfall_id: string | null
  type_line: string | null
  image_url: string | null
  exact_price: number | null
}

export interface ResolvedDeckCard extends DeckCardRow {
  commanderEligible: boolean
  colorIdentity: string[]
  oracleId: string | null
  resolved: boolean
}

type Identifier = { set: string; collector_number: string } | { name: string }

async function postCollection(identifiers: Identifier[]): Promise<DeckScryfallCard[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${BASE}/cards/collection`, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers }),
    })
    if (res.status === 429) {
      await sleep(1000)
      continue
    }
    if (!res.ok) return []
    const data = await res.json()
    return data?.data ?? []
  }
  throw new ScryfallRateLimitError()
}

async function collectInBatches(identifiers: Identifier[]): Promise<DeckScryfallCard[]> {
  const out: DeckScryfallCard[] = []
  for (let i = 0; i < identifiers.length; i += BATCH_SIZE) {
    if (i > 0) await sleep(REQUEST_DELAY)
    out.push(...await postCollection(identifiers.slice(i, i + BATCH_SIZE)))
  }
  return out
}

const printingKey = (set: string, num: string) => `${set.toLowerCase()}|${num.toLowerCase()}`
const nameKeys = (card: DeckScryfallCard) => {
  const full = card.name.toLowerCase()
  return [full, full.split(' // ')[0]]
}

export async function resolveLines(lines: ParsedLine[]): Promise<(DeckScryfallCard | null)[]> {
  const byPrinting = new Map<string, DeckScryfallCard>()
  const byName = new Map<string, DeckScryfallCard>()

  const printingIds: Identifier[] = lines
    .filter(l => l.setCode && l.collectorNumber)
    .map(l => ({ set: l.setCode!, collector_number: l.collectorNumber! }))
  for (const card of await collectInBatches(printingIds)) {
    byPrinting.set(printingKey(card.set, card.collector_number), card)
  }

  const findPrinting = (l: ParsedLine) =>
    l.setCode && l.collectorNumber ? byPrinting.get(printingKey(l.setCode, l.collectorNumber)) ?? null : null

  const nameLookups = [...new Set(lines.filter(l => !findPrinting(l)).map(l => l.name))]
  if (nameLookups.length > 0) {
    if (printingIds.length > 0) await sleep(REQUEST_DELAY)
    for (const card of await collectInBatches(nameLookups.map(name => ({ name })))) {
      for (const key of nameKeys(card)) if (!byName.has(key)) byName.set(key, card)
    }
  }

  return lines.map(l => findPrinting(l) ?? byName.get(l.name.toLowerCase()) ?? null)
}

export function cardImageUrl(card: ScryfallCard): string | null {
  return card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null
}

export function artCropUrl(imageUrl: string | null): string | null {
  return imageUrl ? imageUrl.replace('/normal/', '/art_crop/') : null
}

function isCommanderEligible(card: DeckScryfallCard): boolean {
  const frontType = card.type_line.split(' // ')[0]
  if (frontType.includes('Legendary') && frontType.includes('Creature')) return true
  const text = [card.oracle_text, ...(card.card_faces ?? []).map(f => f.oracle_text)].join('\n')
  return text.includes('can be your commander')
}

export function exactPrice(card: DeckScryfallCard, foilType: FoilType): number | null {
  const price = getPriceByFoilType(card, foilType)
  if (price != null || foilType !== 'none' || card.finishes?.includes('nonfoil')) return price
  return getPriceByFoilType(card, 'foil') ?? getPriceByFoilType(card, 'etched')
}

export function buildCardRows(lines: ParsedLine[], resolved: (DeckScryfallCard | null)[]): ResolvedDeckCard[] {
  const merged = new Map<string, ResolvedDeckCard>()
  lines.forEach((line, i) => {
    const card = resolved[i]
    const row: ResolvedDeckCard = card
      ? {
          board: line.board,
          qty: line.qty,
          name: card.name,
          set_code: card.set,
          collector_number: card.collector_number,
          foil_type: line.foilType,
          scryfall_id: card.id,
          type_line: card.type_line,
          image_url: cardImageUrl(card),
          exact_price: exactPrice(card, line.foilType),
          commanderEligible: isCommanderEligible(card),
          colorIdentity: card.color_identity ?? [],
          oracleId: card.oracle_id ?? null,
          resolved: true,
        }
      : {
          board: line.board,
          qty: line.qty,
          name: line.name,
          set_code: line.setCode,
          collector_number: line.collectorNumber,
          foil_type: line.foilType,
          scryfall_id: null,
          type_line: null,
          image_url: null,
          exact_price: null,
          commanderEligible: false,
          colorIdentity: [],
          oracleId: null,
          resolved: false,
        }
    const key = cardRowKey(row)
    const existing = merged.get(key)
    if (existing) existing.qty += row.qty
    else merged.set(key, row)
  })
  return [...merged.values()]
}

export function cardRowKey(row: Pick<DeckCardRow, 'board' | 'name' | 'set_code' | 'collector_number' | 'foil_type'>): string {
  return [row.board, row.name.toLowerCase(), row.set_code ?? '', row.collector_number ?? '', row.foil_type].join('|')
}

export function guessCommanders(rows: ResolvedDeckCard[]): string[] {
  const guesses: string[] = []
  for (const row of rows.filter(r => r.board === 'main')) {
    if (!row.commanderEligible || guesses.length === 2) break
    guesses.push(row.name)
  }
  return guesses
}

export function applyCommanders(rows: ResolvedDeckCard[], commanderNames: string[]): ResolvedDeckCard[] {
  const selected = new Set(commanderNames.map(n => n.toLowerCase()))
  const moved = rows.map(row => {
    if (row.board === 'sideboard') return row
    const board: Board = selected.has(row.name.toLowerCase()) ? 'commander' : 'main'
    return { ...row, board }
  })
  const merged = new Map<string, ResolvedDeckCard>()
  for (const row of moved) {
    const key = cardRowKey(row)
    const existing = merged.get(key)
    if (existing) existing.qty += row.qty
    else merged.set(key, row)
  }
  return [...merged.values()]
}

const WUBRG = ['W', 'U', 'B', 'R', 'G']

export function colorIdentityOf(rows: ResolvedDeckCard[]): string | null {
  const colors = new Set(rows.filter(r => r.board === 'commander').flatMap(r => r.colorIdentity))
  const ordered = WUBRG.filter(c => colors.has(c)).join('')
  return ordered || null
}

export function toDbRow(row: ResolvedDeckCard, deckId: string) {
  return {
    deck_id: deckId,
    board: row.board,
    qty: row.qty,
    name: row.name,
    set_code: row.set_code,
    collector_number: row.collector_number,
    foil_type: row.foil_type,
    scryfall_id: row.scryfall_id,
    type_line: row.type_line,
    image_url: row.image_url,
    exact_price: row.exact_price,
  }
}

export interface CheapestPrinting {
  cheapest_scryfall_id: string
  cheapest_set_code: string
  cheapest_collector_number: string
  cheapest_foil_type: FoilType
  cheapest_price: number
}

const FINISHES: { foilType: FoilType; field: 'usd' | 'usd_foil' | 'usd_etched' }[] = [
  { foilType: 'none', field: 'usd' },
  { foilType: 'foil', field: 'usd_foil' },
  { foilType: 'etched', field: 'usd_etched' },
]

// Returns null when no paper printing has a price; throws ScryfallRateLimitError if Scryfall keeps refusing
export async function findCheapestPrinting(name: string, oracleId: string | null): Promise<CheapestPrinting | null> {
  const q = oracleId ? `oracleid:${oracleId}` : `!"${name}"`
  let url: string | null = `${BASE}/cards/search?` + new URLSearchParams({ q, unique: 'prints', order: 'usd', dir: 'asc' })
  let best: CheapestPrinting | null = null

  for (let page = 0; url && page < MAX_SEARCH_PAGES; page++) {
    if (page > 0) await sleep(REQUEST_DELAY)
    let res: Response = await fetch(url, { headers: HEADERS })
    if (res.status === 429) {
      await sleep(1000)
      res = await fetch(url, { headers: HEADERS })
      if (res.status === 429) throw new ScryfallRateLimitError()
    }
    if (!res.ok) return best
    const data: { data?: DeckScryfallCard[]; has_more?: boolean; next_page?: string } = await res.json()

    for (const card of data.data ?? []) {
      if (card.digital || card.oversized || card.border_color === 'gold') continue
      if (card.games && !card.games.includes('paper')) continue
      for (const { foilType, field } of FINISHES) {
        const raw = card.prices[field]
        if (!raw) continue
        const price = parseFloat(raw)
        if (!best || price < best.cheapest_price) {
          best = {
            cheapest_scryfall_id: card.id,
            cheapest_set_code: card.set,
            cheapest_collector_number: card.collector_number,
            cheapest_foil_type: foilType,
            cheapest_price: price,
          }
        }
      }
    }
    url = data.has_more ? data.next_page ?? null : null
  }
  return best
}

export interface CheapestCandidate {
  id: string
  name: string
  type_line: string | null
  scryfall_id: string | null
  set_code: string | null
  collector_number: string | null
  foil_type: FoilType
  exact_price: number | null
}

export async function discoverCheapest(
  supabase: SupabaseClient,
  cards: CheapestCandidate[],
  oracleIds: Map<string, string>,
  deadline: number,
): Promise<number> {
  const groups = new Map<string, CheapestCandidate[]>()
  for (const card of cards) {
    const key = card.name.toLowerCase()
    groups.set(key, [...(groups.get(key) ?? []), card])
  }

  let checked = 0
  for (const group of groups.values()) {
    if (Date.now() > deadline) break
    const first = group[0]
    const checkedAt = new Date().toISOString()
    const ids = group.map(c => c.id)

    if (first.type_line?.includes('Basic Land')) {
      for (const card of group) {
        await supabase.from('deck_idea_cards').update({
          cheapest_scryfall_id: card.scryfall_id,
          cheapest_set_code: card.set_code,
          cheapest_collector_number: card.collector_number,
          cheapest_foil_type: card.foil_type,
          cheapest_price: card.exact_price,
          cheapest_checked_at: checkedAt,
        }).eq('id', card.id)
      }
      checked += group.length
      continue
    }

    let cheapest: CheapestPrinting | null
    try {
      const oracleId = first.scryfall_id ? oracleIds.get(first.scryfall_id) ?? null : null
      cheapest = await findCheapestPrinting(first.name, oracleId)
    } catch (err) {
      if (err instanceof ScryfallRateLimitError) break
      throw err
    }
    await supabase.from('deck_idea_cards')
      .update({ ...(cheapest ?? {}), cheapest_checked_at: checkedAt })
      .in('id', ids)
    checked += group.length
    await sleep(REQUEST_DELAY)
  }
  return checked
}

export async function recomputeTotals(supabase: SupabaseClient, deckIds: string[], writeHistory: boolean) {
  if (deckIds.length === 0) return
  const { data: rows } = await supabase
    .from('deck_idea_cards')
    .select('deck_id, qty, exact_price, cheapest_price')
    .in('deck_id', deckIds)

  const totals = new Map(deckIds.map(id => [id, { exact: 0, cheapest: 0, unpriced: 0 }]))
  for (const row of rows ?? []) {
    const t = totals.get(row.deck_id)!
    if (row.exact_price != null) t.exact += row.qty * row.exact_price
    const cheapest = row.cheapest_price ?? row.exact_price
    if (cheapest != null) t.cheapest += row.qty * cheapest
    else t.unpriced += 1
  }

  const pricedAt = new Date().toISOString()
  const today = pricedAt.split('T')[0]
  for (const [deckId, t] of totals) {
    const exact_total = parseFloat(t.exact.toFixed(2))
    const cheapest_total = parseFloat(t.cheapest.toFixed(2))
    await supabase.from('deck_ideas')
      .update({ exact_total, cheapest_total, unpriced_count: t.unpriced, priced_at: pricedAt })
      .eq('id', deckId)
    if (writeHistory) {
      await supabase.from('deck_idea_history')
        .upsert({ deck_id: deckId, date: today, exact_total, cheapest_total }, { onConflict: 'deck_id,date' })
    }
  }
}

export async function discoverCheapestForDeck(deckId: string, oracleIds: Map<string, string>) {
  const supabase = createServiceClient()
  const { data: cards } = await supabase
    .from('deck_idea_cards')
    .select('id, name, type_line, scryfall_id, set_code, collector_number, foil_type, exact_price')
    .eq('deck_id', deckId)
    .is('cheapest_checked_at', null)
  await discoverCheapest(supabase, cards ?? [], oracleIds, Date.now() + 240_000)
  await recomputeTotals(supabase, [deckId], true)
}

export interface DeckIdeaRefreshResult {
  deckIdeas: number
  deckIdeaCards: number
  cheapestChecked: number
}

export async function refreshDeckIdeaPrices(deadline: number): Promise<DeckIdeaRefreshResult> {
  const supabase = createServiceClient()
  const { data: cards } = await supabase.from('deck_idea_cards').select('*')
  if (!cards || cards.length === 0) return { deckIdeas: 0, deckIdeaCards: 0, cheapestChecked: 0 }

  const ids = [...new Set(cards.flatMap(c => [c.scryfall_id, c.cheapest_scryfall_id]).filter(Boolean) as string[])]
  const fetched = await fetchCollection(ids) as Map<string, DeckScryfallCard>

  const oracleIds = new Map<string, string>()
  const updated = cards.map(row => {
    const exact = row.scryfall_id ? fetched.get(row.scryfall_id) : undefined
    const cheapest = row.cheapest_scryfall_id ? fetched.get(row.cheapest_scryfall_id) : undefined
    if (exact?.oracle_id) oracleIds.set(exact.id, exact.oracle_id)
    return {
      ...row,
      exact_price: exact ? exactPrice(exact, row.foil_type) : row.exact_price,
      image_url: exact ? cardImageUrl(exact) ?? row.image_url : row.image_url,
      cheapest_price: cheapest ? getPriceByFoilType(cheapest, row.cheapest_foil_type ?? 'none') : row.cheapest_price,
    }
  })
  await supabase.from('deck_idea_cards').upsert(updated, { onConflict: 'id' })

  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const stale = updated.filter(c => !c.cheapest_checked_at || new Date(c.cheapest_checked_at) < startOfDay)
  const cheapestChecked = await discoverCheapest(supabase, stale, oracleIds, deadline)

  const deckIds = [...new Set(cards.map(c => c.deck_id as string))]
  await recomputeTotals(supabase, deckIds, true)

  return { deckIdeas: deckIds.length, deckIdeaCards: cards.length, cheapestChecked }
}

export interface PreparedDeck {
  rows: ResolvedDeckCard[]
  unparsed: string[]
  unresolved: string[]
  detectedCommanders: string[]
  commanderCandidates: string[]
}

export async function prepareDeck(text: string, commanderNames: string[] | null): Promise<PreparedDeck> {
  const parsed = parseDecklist(text)
  const resolved = await resolveLines(parsed.lines)
  const rows = buildCardRows(parsed.lines, resolved)

  const detectedCommanders = parsed.commandersDetected
    ? rows.filter(r => r.board === 'commander').map(r => r.name)
    : guessCommanders(rows)
  const commanderCandidates = [...new Set(
    rows.filter(r => r.board !== 'sideboard' && (r.commanderEligible || r.board === 'commander')).map(r => r.name)
  )]

  return {
    rows: applyCommanders(rows, (commanderNames ?? detectedCommanders).slice(0, 2)),
    unparsed: parsed.unparsed,
    unresolved: rows.filter(r => !r.resolved).map(r => r.name),
    detectedCommanders,
    commanderCandidates,
  }
}

export function oracleIdMap(rows: ResolvedDeckCard[]): Map<string, string> {
  return new Map(rows.filter(r => r.scryfall_id && r.oracleId).map(r => [r.scryfall_id!, r.oracleId!]))
}

export interface DeckDiff {
  added: { name: string; qty: number }[]
  removed: { name: string; qty: number }[]
  changed: { name: string; from: number; to: number }[]
}

type DiffRow = Pick<DeckCardRow, 'board' | 'name' | 'set_code' | 'collector_number' | 'foil_type' | 'qty'>

export function diffDecks(before: DiffRow[], after: DiffRow[]): DeckDiff {
  const old = new Map(before.map(r => [cardRowKey(r), r]))
  const next = new Map(after.map(r => [cardRowKey(r), r]))
  const diff: DeckDiff = { added: [], removed: [], changed: [] }
  for (const [key, row] of next) {
    const prev = old.get(key)
    if (!prev) diff.added.push({ name: row.name, qty: row.qty })
    else if (prev.qty !== row.qty) diff.changed.push({ name: row.name, from: prev.qty, to: row.qty })
  }
  for (const [key, row] of old) {
    if (!next.has(key)) diff.removed.push({ name: row.name, qty: row.qty })
  }
  return diff
}

export function suggestDeckName(commanders: string[]): string {
  return commanders.map(n => n.split(' // ')[0].split(',')[0].trim()).join(' & ')
}

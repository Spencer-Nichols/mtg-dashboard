import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { LeagueError, type LeagueSettings, type LeagueState } from './types'

type Row = Record<string, unknown>

interface Collection<T> {
  table: string
  keyColumn: string
  key: (item: T) => string
  onConflict: string
  toRow: (item: T) => Row
  fromRow: (row: Row) => T
}

type Collections = {
  [K in 'members' | 'cards' | 'games' | 'byes' | 'packs' | 'trades' | 'swaps' | 'changes']: Collection<LeagueState[K][number]>
}

const COLLECTIONS: Collections = {
  members: {
    table: 'league_members',
    keyColumn: 'id',
    key: m => m.id,
    onConflict: 'season_id,id',
    toRow: m => ({ id: m.id, user_id: m.userId ?? null, name: m.name, precon: m.precon, role: m.role }),
    fromRow: r => ({ id: r.id as string, userId: r.user_id as string | null, email: null, name: r.name as string, precon: r.precon as string, role: r.role as 'player' | 'commissioner' }),
  },
  cards: {
    table: 'league_cards',
    keyColumn: 'id',
    key: c => c.id,
    onConflict: 'season_id,id',
    toRow: c => ({
      id: c.id, owner_id: c.ownerId, name: c.name, display_name: c.displayName ?? null, type_line: c.typeLine, rarity: c.rarity, origin: c.origin, zone: c.zone,
      commander: c.commander, pack_id: c.packId, image_url: c.imageUrl ?? null, image_checked: c.imageUrl !== undefined,
      printing: c.printing ?? null, color_identity: c.colorIdentity ?? null, added_to_binder: !!c.addedToBinder,
      mana_cost: c.manaCost ?? null,
    }),
    fromRow: r => ({
      id: r.id as string, ownerId: r.owner_id as string, name: r.name as string, displayName: (r.display_name as string | null) ?? undefined, typeLine: r.type_line as string,
      rarity: r.rarity as string, origin: r.origin as 'precon' | 'pull', zone: r.zone as 'main' | 'side',
      commander: r.commander as boolean, packId: r.pack_id as string | null,
      imageUrl: r.image_checked ? r.image_url as string | null : undefined,
      printing: (r.printing as LeagueState['cards'][number]['printing']) ?? undefined,
      addedToBinder: r.added_to_binder as boolean,
      colorIdentity: (r.color_identity as string[] | null) ?? undefined,
      manaCost: (r.mana_cost as string | null) ?? undefined,
    }),
  },
  games: {
    table: 'league_games',
    keyColumn: 'id',
    key: g => g.id,
    onConflict: 'season_id,id',
    toRow: g => ({ id: g.id, number: g.number, week: g.week, results: g.results, logged_by: g.loggedBy, logged_at: g.loggedAt }),
    fromRow: r => ({ id: r.id as string, number: r.number as number, week: r.week as number, results: r.results as LeagueState['games'][number]['results'], loggedBy: r.logged_by as string, loggedAt: r.logged_at as string }),
  },
  byes: {
    table: 'league_byes',
    keyColumn: 'member_id',
    key: b => b.memberId,
    onConflict: 'season_id,member_id',
    toRow: b => ({ member_id: b.memberId, week: b.week }),
    fromRow: r => ({ memberId: r.member_id as string, week: r.week as number }),
  },
  packs: {
    table: 'league_packs',
    keyColumn: 'id',
    key: p => p.id,
    onConflict: 'season_id,id',
    toRow: p => ({ id: p.id, member_id: p.memberId, kind: p.kind, week: p.week, card_ids: p.cardIds, opened_at: p.openedAt }),
    fromRow: r => ({ id: r.id as string, memberId: r.member_id as string, kind: r.kind as LeagueState['packs'][number]['kind'], week: r.week as number, cardIds: r.card_ids as string[], openedAt: r.opened_at as string }),
  },
  trades: {
    table: 'league_trades',
    keyColumn: 'id',
    key: t => t.id,
    onConflict: 'season_id,id',
    toRow: t => ({
      id: t.id, week: t.week, from_id: t.fromId, to_id: t.toId, give_card_id: t.giveCardId, get_card_id: t.getCardId,
      give_name: t.giveName, get_name: t.getName, status: t.status, created_at: t.createdAt, resolved_at: t.resolvedAt,
    }),
    fromRow: r => ({
      id: r.id as string, week: r.week as number, fromId: r.from_id as string, toId: r.to_id as string,
      giveCardId: r.give_card_id as string, getCardId: r.get_card_id as string, giveName: r.give_name as string,
      getName: r.get_name as string, status: r.status as LeagueState['trades'][number]['status'],
      createdAt: r.created_at as string, resolvedAt: r.resolved_at as string | null,
    }),
  },
  swaps: {
    table: 'league_swaps',
    keyColumn: 'id',
    key: s => s.id,
    onConflict: 'season_id,id',
    toRow: s => ({ id: s.id, week: s.week, member_id: s.memberId, takes: s.takes, at: s.at }),
    fromRow: r => ({ id: r.id as string, week: r.week as number, memberId: r.member_id as string, takes: r.takes as LeagueState['swaps'][number]['takes'], at: r.at as string }),
  },
  changes: {
    table: 'league_changes',
    keyColumn: 'id',
    key: c => c.id,
    onConflict: 'season_id,id',
    toRow: c => ({ id: c.id, week: c.week, game_number: c.gameNumber, member_id: c.memberId, added_name: c.addedName, removed_name: c.removedName, source: c.source, at: c.at }),
    fromRow: r => ({ id: r.id as string, week: r.week as number, gameNumber: r.game_number as number, memberId: r.member_id as string, addedName: r.added_name as string, removedName: r.removed_name as string, source: r.source as string, at: r.at as string }),
  },
}

const NAMES = Object.keys(COLLECTIONS) as (keyof Collections)[]
const UPSERT_CHUNK = 500

async function latestSeason(db: SupabaseClient) {
  const { data, error } = await db
    .from('league_seasons')
    .select('*, leagues(settings)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function loadLeagueFromDb(): Promise<LeagueState | null> {
  const db = createServiceClient()
  const season = await latestSeason(db)
  if (!season) return null

  const results = await Promise.all(NAMES.map(name => db.from(COLLECTIONS[name].table).select('*').eq('season_id', season.id)))
  const state = {
    settings: { ...(season.leagues as { settings: Partial<LeagueSettings> }).settings } as LeagueSettings,
    season: {
      id: season.id,
      leagueId: season.league_id,
      version: season.version,
      number: season.number,
      status: season.status,
      endedAt: season.ended_at,
      endedBy: season.ended_by,
      nextGameAt: season.next_game_at,
      nextGameNote: season.next_game_note,
    },
    week: season.week,
    seq: 0,
  } as LeagueState
  NAMES.forEach((name, i) => {
    const { data, error } = results[i]
    if (error) throw error
    ;(state as unknown as Record<string, unknown>)[name] = (data ?? []).map(r => COLLECTIONS[name].fromRow(r as Row))
  })
  state.settings.timeZone ??= 'America/Los_Angeles'
  state.cards.sort((a, b) => a.id.localeCompare(b.id))
  state.games.sort((a, b) => a.number - b.number)
  return state
}

export async function saveLeagueToDb(before: LeagueState, after: LeagueState) {
  const db = createServiceClient()
  const seasonId = before.season.id!
  const { data: bumped, error } = await db
    .from('league_seasons')
    .update({
      week: after.week,
      status: after.season.status,
      ended_at: after.season.endedAt,
      ended_by: after.season.endedBy,
      next_game_at: after.season.nextGameAt ?? null,
      next_game_note: after.season.nextGameNote ?? null,
      version: (before.season.version ?? 0) + 1,
    })
    .eq('id', seasonId)
    .eq('version', before.season.version ?? 0)
    .select('id')
  if (error) throw error
  if (!bumped || bumped.length === 0) throw new LeagueError('Someone else just updated the league. Refresh and try again.', 409)

  if (JSON.stringify(before.settings) !== JSON.stringify(after.settings)) {
    const { error: settingsError } = await db.from('leagues').update({ settings: after.settings }).eq('id', before.season.leagueId!)
    if (settingsError) throw settingsError
  }

  for (const name of NAMES) {
    const col = COLLECTIONS[name] as Collection<unknown>
    const prev = new Map((before[name] as unknown[]).map(item => [col.key(item), JSON.stringify(item)]))
    const changed = (after[name] as unknown[]).filter(item => prev.get(col.key(item)) !== JSON.stringify(item))
    for (let i = 0; i < changed.length; i += UPSERT_CHUNK) {
      const rows = changed.slice(i, i + UPSERT_CHUNK).map(item => ({ season_id: seasonId, ...col.toRow(item) }))
      const { error: upsertError } = await db.from(col.table).upsert(rows, { onConflict: col.onConflict })
      if (upsertError) throw upsertError
    }
    const kept = new Set((after[name] as unknown[]).map(item => col.key(item)))
    const removed = [...prev.keys()].filter(k => !kept.has(k))
    for (let i = 0; i < removed.length; i += UPSERT_CHUNK) {
      const { error: deleteError } = await db.from(col.table).delete().eq('season_id', seasonId).in(col.keyColumn, removed.slice(i, i + UPSERT_CHUNK))
      if (deleteError) throw deleteError
    }
  }
}

export async function createSeasonInDb(settings: LeagueSettings, createdBy: string, memberNames: string[]) {
  const db = createServiceClient()
  const existing = await latestSeason(db)
  if (existing?.status === 'active') throw new LeagueError('Finish the current season first')

  let leagueId = existing?.league_id as string | undefined
  if (!leagueId) {
    const { data, error } = await db.from('leagues').insert({ settings, created_by: createdBy }).select('id').single()
    if (error) throw error
    leagueId = data.id
  } else {
    await db.from('leagues').update({ settings }).eq('id', leagueId)
  }

  const { data: season, error } = await db
    .from('league_seasons')
    .insert({ league_id: leagueId, number: (existing?.number ?? 0) + 1 })
    .select('id')
    .single()
  if (error) throw error

  const { error: memberError } = await db.from('league_members').insert(memberNames.map((name, i) => ({
    season_id: season.id,
    id: `m${i + 1}`,
    name,
    role: i === 0 ? 'commissioner' : 'player',
  })))
  if (memberError) throw memberError
}

export async function memberSeatForUser(userId: string) {
  const db = createServiceClient()
  const season = await latestSeason(db)
  if (!season) return null
  const { data } = await db
    .from('league_members')
    .select('id')
    .eq('season_id', season.id)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return null
  const { count } = await db
    .from('league_trades')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', season.id)
    .eq('to_id', data.id)
    .eq('status', 'pending')
    .eq('week', season.week)
  return { memberId: data.id as string, pendingOffers: count ?? 0 }
}

export async function wipeLeagueInDb() {
  const { error } = await createServiceClient().from('leagues').delete().not('id', 'is', null)
  if (error) throw error
}

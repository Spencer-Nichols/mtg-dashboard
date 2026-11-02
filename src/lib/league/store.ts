import fs from 'fs'
import path from 'path'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveLines, cardImageUrl } from '@/lib/deck-ideas'
import { createSeasonInDb, loadLeagueFromDb, memberSeatForUser, saveLeagueToDb, wipeLeagueInDb } from './db'
import { DEFAULT_SETTINGS, seedLeague } from './mock'
import { LeagueError, type LeagueState, type Member, type Role } from './types'

export const VIEW_AS_COOKIE = 'league-mock-as'

const MOCK_FILE = path.join(process.cwd(), '.league-mock.json')
const DEFAULT_SEAT_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4']

export function usingDb() {
  return process.env.LEAGUE_STORE === 'supabase'
}

export function binderImportEnabled() {
  return usingDb() || process.env.LEAGUE_BINDER_IMPORT === '1'
}

export function emailsEnabled() {
  return usingDb() || process.env.LEAGUE_EMAILS === '1'
}

export function leagueEnabled() {
  return usingDb() || process.env.NODE_ENV !== 'production' || process.env.LEAGUE_MOCK === '1'
}

function readMock(): LeagueState | null {
  try {
    const state: LeagueState = JSON.parse(fs.readFileSync(MOCK_FILE, 'utf8'))
    state.season ??= { number: 1, status: 'active', endedAt: null, endedBy: null }
    state.settings.packSet ??= 'trk'
    state.settings.timeZone ??= 'America/Los_Angeles'
    return state
  } catch {
    return null
  }
}

function writeMock(state: LeagueState) {
  fs.writeFileSync(MOCK_FILE, JSON.stringify(state, null, 2))
}

async function loadState(seedEmail: string | null): Promise<LeagueState | null> {
  if (usingDb()) return loadLeagueFromDb()
  const existing = readMock()
  if (existing) return existing
  const state = seedLeague({ m1: seedEmail })
  writeMock(state)
  return state
}

async function saveState(before: LeagueState, after: LeagueState) {
  if (usingDb()) await saveLeagueToDb(before, after)
  else writeMock(after)
}

export async function loadLeagueState() {
  return loadState(null)
}

export async function mutateLeague(fn: (draft: LeagueState) => void) {
  const before = await loadState(null)
  if (!before) throw new LeagueError('No league has been set up yet', 404)
  const draft = structuredClone(before)
  fn(draft)
  await saveState(before, draft)
  return draft
}

async function ensureImages(state: LeagueState) {
  const names = [...new Set(state.cards.filter(c => c.imageUrl === undefined).map(c => c.name))]
  if (names.length === 0) return state
  let resolved
  try {
    resolved = await resolveLines(names.map(name => ({ qty: 1, name, setCode: null, collectorNumber: null, foilType: 'none' as const, board: 'main' as const })))
  } catch (err) {
    console.error('League image lookup failed:', err)
    return state
  }
  const urls = new Map(names.map((name, i) => [name, resolved[i] ? cardImageUrl(resolved[i]!) : null]))
  try {
    return await mutateLeague(draft => {
      for (const c of draft.cards) if (c.imageUrl === undefined && urls.has(c.name)) c.imageUrl = urls.get(c.name)
    })
  } catch (err) {
    console.error('Saving league images failed:', err)
    return state
  }
}

function memberFor(state: LeagueState, user: { id: string; email?: string | null }) {
  const email = user.email?.toLowerCase()
  return state.members.find(m => (m.userId && m.userId === user.id) || (!!email && m.email?.toLowerCase() === email))
}

async function userEmailMap() {
  const { data } = await createServiceClient().auth.admin.listUsers({ perPage: 1000 })
  return new Map((data?.users ?? []).map(u => [u.id, u.email?.toLowerCase() ?? null]))
}

export async function memberEmails(state: LeagueState): Promise<Map<string, string | null>> {
  if (!usingDb()) return new Map(state.members.map(m => [m.id, m.email]))
  const emails = await userEmailMap()
  return new Map(state.members.map(m => [m.id, m.userId ? emails.get(m.userId) ?? null : null]))
}

export async function leagueNavInfo(user: { id: string; email?: string | null }) {
  if (!leagueEnabled()) return null
  if (usingDb()) return memberSeatForUser(user.id)
  const state = await loadState(user.email ?? null)
  const member = state && memberFor(state, user)
  if (!member) return null
  const pendingOffers = state.trades.filter(t => t.status === 'pending' && t.toId === member.id && t.week === state.week).length
  return { memberId: member.id, pendingOffers }
}

export async function leagueContext() {
  if (!leagueEnabled()) throw new LeagueError('Not found', 404)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new LeagueError('Unauthorized', 401)

  const loaded = await loadState(user.email ?? null)
  if (!loaded) throw new LeagueError('No league has been set up yet', 404)
  const state = await ensureImages(loaded)
  const member = memberFor(state, user)
  if (!member) throw new LeagueError("You're not in this league", 403)

  const { data: admin } = await createServiceClient().from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
  const isAdmin = !!admin
  const isCommissioner = member.role === 'commissioner'

  const canSwitchViewer = usingDb() ? isAdmin && process.env.LEAGUE_ACT_AS === '1' : isCommissioner
  let viewerId = member.id
  if (canSwitchViewer) {
    const viewAs = (await cookies()).get(VIEW_AS_COOKIE)?.value
    if (state.members.some(m => m.id === viewAs)) viewerId = viewAs!
  }
  return { state, viewerId, isCommissioner, isAdmin, canSwitchViewer, mockData: !usingDb() }
}

export function resetLeague(empty = false) {
  if (usingDb()) throw new LeagueError('Reset only works with mock data')
  const current = readMock()
  const emails = Object.fromEntries((current?.members ?? []).map(m => [m.id, m.email]))
  writeMock(seedLeague(emails, empty))
}

export async function wipeLeague() {
  if (usingDb()) await wipeLeagueInDb()
  else resetLeague(true)
}

export async function leagueMembersForAdmin() {
  const state = await loadState(null)
  if (!state) return { seasonNumber: null, status: null, seats: [] }
  const emails = await memberEmails(state)
  return {
    seasonNumber: state.season.number,
    status: state.season.status,
    seats: state.members.map(m => ({ id: m.id, name: m.name, email: emails.get(m.id) ?? null, role: m.role })),
  }
}

export async function startSeason(createdBy: string) {
  if (!usingDb()) throw new LeagueError('Seasons are started from the database. Mock data uses Reset instead.')
  await createSeasonInDb(DEFAULT_SETTINGS, createdBy, DEFAULT_SEAT_NAMES)
}

export async function updateLeagueMember(memberId: string, changes: { email?: string | null; role?: Role; name?: string }) {
  let userId: string | null | undefined
  if (changes.email !== undefined && usingDb()) {
    const target = changes.email?.trim().toLowerCase() || null
    if (target) {
      const match = [...(await userEmailMap()).entries()].find(([, e]) => e === target)
      if (!match) throw new LeagueError('No TapNTrack user has that email')
      userId = match[0]
    } else {
      userId = null
    }
  }

  let assigned: Member | null = null
  await mutateLeague(state => {
    const member = state.members.find(m => m.id === memberId)
    if (!member) throw new LeagueError('Seat not found', 404)
    if (changes.email !== undefined) {
      const email = changes.email?.trim().toLowerCase() || null
      const taken = state.members.some(m => m.id !== memberId && (usingDb() ? !!userId && m.userId === userId : !!email && m.email?.toLowerCase() === email))
      if (taken) throw new LeagueError('That user already has a seat')
      const changed = usingDb() ? member.userId !== userId : member.email !== email
      if (usingDb()) member.userId = userId
      else member.email = email
      if (changed && email) assigned = member
    }
    if (changes.name !== undefined && changes.name.trim()) member.name = changes.name.trim().slice(0, 40)
    if (changes.role) {
      if (changes.role === 'player' && !state.members.some(m => m.id !== memberId && m.role === 'commissioner')) {
        throw new LeagueError('The league needs at least one commissioner')
      }
      member.role = changes.role
    }
  })
  return assigned as Member | null
}

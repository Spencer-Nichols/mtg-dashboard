import { sendLeagueEmail, type LeagueEmail } from '@/lib/email'
import { createServiceClient } from '@/lib/supabase/service'
import { computeSeason, memberName } from './rules'
import { emailsEnabled, memberEmails } from './store'
import type { LeagueEmailType } from './email-types'
import type { LeagueState } from './types'


export type LeagueEvent =
  | { kind: 'gameScheduled'; byId: string }
  | { kind: 'tradeOffer'; tradeId: string }
  | { kind: 'tradeResponse'; tradeId: string }
  | { kind: 'swap'; swapId: string }
  | { kind: 'seasonEnded' }
  | { kind: 'addedToLeague'; memberId: string }

interface Outgoing {
  memberId: string
  subject: string
  email: LeagueEmail
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function build(state: LeagueState, event: LeagueEvent): Outgoing[] {
  const name = (id: string) => esc(memberName(state, id))
  const league = esc(state.settings.name)

  switch (event.kind) {
    case 'gameScheduled': {
      const at = state.season.nextGameAt
      if (!at) return []
      const when = new Date(at).toLocaleString('en-US', {
        timeZone: state.settings.timeZone,
        weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
      })
      const note = state.season.nextGameNote
      return state.members.filter(m => m.id !== event.byId).map(m => ({
        memberId: m.id,
        subject: `Game ${state.games.length + 1} is set for ${when}`,
        email: {
          heading: `Game ${state.games.length + 1}: ${esc(when)}`,
          lines: [`${name(event.byId)} set the date for the next ${league} game.`, ...(note ? [esc(note)] : []), 'Trades and deck changes need to be in before the game.'],
          ctaLabel: 'Open the league',
          ctaPath: '/league',
        },
      }))
    }
    case 'tradeOffer': {
      const t = state.trades.find(x => x.id === event.tradeId)
      if (!t) return []
      return [{
        memberId: t.toId,
        subject: `${memberName(state, t.fromId)} sent you a trade offer`,
        email: {
          heading: `${name(t.fromId)} wants to trade`,
          lines: [`They offer <strong>${esc(t.giveName)}</strong> for your <strong>${esc(t.getName)}</strong>.`, 'Offers expire when the week ends.'],
          ctaLabel: 'Answer the offer',
          ctaPath: '/league',
        },
      }]
    }
    case 'tradeResponse': {
      const t = state.trades.find(x => x.id === event.tradeId)
      if (!t || (t.status !== 'accepted' && t.status !== 'declined')) return []
      const accepted = t.status === 'accepted'
      return [{
        memberId: t.fromId,
        subject: `${memberName(state, t.toId)} ${accepted ? 'accepted' : 'declined'} your trade`,
        email: {
          heading: `Trade ${accepted ? 'accepted' : 'declined'}`,
          lines: [accepted
            ? `${name(t.toId)} took your <strong>${esc(t.giveName)}</strong>. <strong>${esc(t.getName)}</strong> is now yours.`
            : `${name(t.toId)} turned down <strong>${esc(t.giveName)}</strong> for <strong>${esc(t.getName)}</strong>.`],
          ctaLabel: accepted ? 'See your deck' : 'Make another offer',
          ctaPath: accepted ? `/league/players/${t.fromId}` : '/league',
        },
      }]
    }
    case 'swap': {
      const s = state.swaps.find(x => x.id === event.swapId)
      if (!s) return []
      return s.takes.map(take => ({
        memberId: take.fromId,
        subject: `${memberName(state, s.memberId)} used the Underdog Swap on you`,
        email: {
          heading: 'Underdog Swap',
          lines: [`${name(s.memberId)} took <strong>${esc(take.takenName)}</strong> from your sideboard and gave you <strong>${esc(take.givenName)}</strong>.`],
          ctaLabel: 'See your sideboard',
          ctaPath: `/league/players/${take.fromId}?tab=side`,
        },
      }))
    }
    case 'seasonEnded': {
      const season = computeSeason(state)
      const table = season.standings
        .map((s, i) => `${i + 1}. ${name(s.memberId)} · ${s.points} pts${state.settings.prizePacks[i] ? ` · ${state.settings.prizePacks[i]} prize packs` : ''}`)
        .join('<br>')
      return state.members.map(m => ({
        memberId: m.id,
        subject: `${state.settings.name} season ${state.season.number} is over`,
        email: {
          heading: `${name(season.standings[0]?.memberId ?? m.id)} wins season ${state.season.number}`,
          lines: [table, 'Open your prize packs, then add your league cards to your binder.'],
          ctaLabel: 'Add my cards to binder',
          ctaPath: `/league/players/${m.id}?binder=1`,
        },
      }))
    }
    case 'addedToLeague':
      return [{
        memberId: event.memberId,
        subject: `You're in ${state.settings.name}`,
        email: {
          heading: `Welcome to ${league}`,
          lines: [`You have a seat as <strong>${name(event.memberId)}</strong>. Standings, decks, trades and packs all live on the league page.`],
          ctaLabel: 'Open the league',
          ctaPath: '/league',
        },
      }]
  }
}

async function prefsByMember(state: LeagueState, memberIds: string[]) {
  const userIds = state.members.filter(m => memberIds.includes(m.id) && m.userId).map(m => m.userId!)
  const prefs = new Map<string, Partial<Record<LeagueEmailType, boolean>>>()
  if (userIds.length === 0) return prefs
  const { data } = await createServiceClient()
    .from('notification_preferences')
    .select('user_id, league_email_prefs')
    .in('user_id', userIds)
  for (const row of data ?? []) {
    const member = state.members.find(m => m.userId === row.user_id)
    if (member) prefs.set(member.id, (row.league_email_prefs ?? {}) as Partial<Record<LeagueEmailType, boolean>>)
  }
  return prefs
}

export async function notifyLeague(state: LeagueState, events: LeagueEvent[]) {
  const outgoing = events.flatMap(e => build(state, e).map(o => ({ ...o, kind: e.kind })))
  if (outgoing.length === 0) return
  try {
    const emails = await memberEmails(state)
    const prefs = await prefsByMember(state, outgoing.map(o => o.memberId))
    for (const o of outgoing) {
      const to = emails.get(o.memberId)
      if (!to || prefs.get(o.memberId)?.[o.kind] === false) continue
      if (!emailsEnabled()) {
        console.log(`[league email skipped in mock mode] to=${to} subject="${o.subject}"`)
        continue
      }
      await sendLeagueEmail(to, o.subject, o.email)
    }
  } catch (err) {
    console.error('League email failed:', err)
  }
}

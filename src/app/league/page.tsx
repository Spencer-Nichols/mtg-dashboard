'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { dashboardView } from '@/lib/league/views'
import LogGameModal from '@/components/league/LogGameModal'
import OpenPackModal from '@/components/league/OpenPackModal'
import TradeModal from '@/components/league/TradeModal'
import UnderdogSwapModal from '@/components/league/UnderdogSwapModal'
import { leagueAction } from '@/components/league/LeagueModal'
import LeagueEmailSettings from '@/components/league/LeagueEmailSettings'
import NextGame from '@/components/league/NextGame'
import LeagueSettingsEditor from '@/components/league/LeagueSettingsEditor'

type Dashboard = ReturnType<typeof dashboardView> & { canSwitchViewer: boolean; mockData: boolean }
type ModalName = 'game' | 'pack' | 'trade' | 'swap' | null

const BADGES: Record<string, { label: string; className: string }> = {
  bounty: { label: 'Bounty +1', className: 'bg-amber-900/50 text-amber-200' },
  boost: { label: '+5 life', className: 'bg-blue-900/50 text-blue-200' },
  reserve: { label: 'Reserve pack', className: 'bg-green-900/50 text-green-200' },
  bye: { label: 'Bye used', className: 'bg-stone-800 text-stone-300' },
  underdog: { label: 'Underdog Swap', className: 'bg-pink-900/40 text-pink-200' },
}

const sectionTitle = 'text-xs text-stone-400 uppercase tracking-widest font-semibold'
const card = 'bg-stone-900 border border-stone-800 rounded-xl'
const actionButton = 'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-950/60 border border-amber-700/50 hover:bg-amber-900/60 text-amber-200 transition-colors'

function CountBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null
  return (
    <span aria-label={label} className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] font-bold inline-flex items-center justify-center">{count}</span>
  )
}

function finishLabel(place: number | null) {
  return place == null ? '–' : String(place)
}

export default function LeaguePage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalName>(null)
  const [confirmBye, setConfirmBye] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [busyOffer, setBusyOffer] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(() => {
    return fetch('/api/league')
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? 'Could not load the league')
        setData(d)
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => { load() }, [load])

  function saved() {
    setModal(null)
    load()
  }

  async function act(body: Record<string, unknown>) {
    setActionError(null)
    try {
      await leagueAction(body)
      await load()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }

  async function respond(tradeId: string, response: 'accept' | 'decline' | 'cancel') {
    setBusyOffer(tradeId)
    await act({ action: 'respondTrade', tradeId, response })
    setBusyOffer(null)
  }

  async function mock(body: Record<string, unknown>) {
    await fetch('/api/league/mock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    load()
  }

  if (error) return <p className="text-red-400 text-sm">{error}</p>
  if (!data) return <p className="text-stone-500 text-sm">Loading league…</p>

  const { league, viewer } = data
  const packsLeft = viewer.openPacks.reduce((n, p) => n + p.left, 0)
  const incomingOffers = data.offers.filter(o => o.incoming).length
  const bulkWithCards = data.bulk.filter(b => b.count > 0)
  const canCallBye = !viewer.byeUsed && !league.complete && !league.ended
  const playersWithChanges = data.changes.filter(c => c.items.length > 0)

  return (
    <div className="flex flex-col gap-6 [&_button:not(:disabled)]:cursor-pointer [&_summary]:cursor-pointer">
      {data.canSwitchViewer && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-yellow-200 bg-yellow-950/30 border border-yellow-900/50 rounded-lg px-3 py-2">
          <span className="font-semibold">{data.mockData ? 'Mock data' : 'Test mode'}</span>
          <label className="flex items-center gap-2">
            Viewing as
            <select
              value={viewer.id}
              onChange={e => mock({ viewAs: e.target.value })}
              className="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-stone-100"
            >
              {data.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          {data.mockData ? (
            <>
              <button onClick={() => mock({ reset: true })} className="underline hover:text-yellow-100">Reset mock data</button>
              <button onClick={() => mock({ reset: true, empty: true })} className="underline hover:text-yellow-100">Start empty season</button>
            </>
          ) : (
            <span className="text-yellow-200/80">Actions save as the player you pick. Turn off with LEAGUE_ACT_AS.</span>
          )}
        </div>
      )}

      <section id="league-header" className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-stone-400 uppercase tracking-widest">
            Season {league.seasonNumber} · {league.ended ? 'Ended' : league.complete ? 'All games played' : `Game ${league.nextGame} of ${league.totalGames}`}
          </p>
          <h1 className="text-2xl font-bold text-stone-100">{league.name}</h1>
          <p id="league-links" className="flex items-center gap-2 text-sm font-semibold">
            <Link href={`/league/players/${viewer.id}`} className="py-1 text-amber-500 hover:text-amber-400 transition-colors">My deck</Link>
            <span aria-hidden className="text-stone-600">·</span>
            <Link href="/league/rules" className="py-1 text-amber-500 hover:text-amber-400 transition-colors">Rules</Link>
          </p>
        </div>
        <div id="league-actions" className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
          <button onClick={() => setModal('pack')} className={`${actionButton} ${league.ended ? 'col-span-2' : ''}`}>
            Open pack
            <CountBadge count={packsLeft} label={`${packsLeft} pack${packsLeft === 1 ? '' : 's'} to open`} />
          </button>
          {!league.ended && (
            <button onClick={() => setModal('trade')} className={actionButton}>Trade</button>
          )}
          {viewer.canLogGame && (
            <button onClick={() => setModal('game')} className={`${actionButton} col-span-2 sm:col-auto`}>Log game</button>
          )}
        </div>
      </section>

      {viewer.needsDeck && !league.ended && (
        <div className="flex flex-wrap items-center gap-3 text-sm bg-amber-950/30 border-2 border-amber-900/50 rounded-xl px-4 py-3">
          <p className="flex-1 min-w-48 text-amber-100">You haven&apos;t uploaded your deck yet. Pick your precon or paste it from Moxfield.</p>
          <Link href={`/league/players/${viewer.id}`} className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-950/60 border-2 border-amber-700/50 text-amber-200">
            Upload my deck
          </Link>
        </div>
      )}

      {league.ended && (
        <div className="flex flex-wrap items-center gap-3 text-sm bg-amber-950/30 border-2 border-amber-900/50 rounded-xl px-4 py-3">
          <p className="flex-1 min-w-48 text-amber-100">
            Season {league.seasonNumber} is over. {data.standings[0]?.name} takes the title. Open your prize packs, then add your league cards to your binder.
          </p>
          <Link href={`/league/players/${viewer.id}?binder=1`} className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-950/60 border-2 border-amber-700/50 text-amber-200">
            Add my cards to binder
          </Link>
        </div>
      )}

      {actionError && <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{actionError}</p>}

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3 [&>*:first-child]:col-span-2 md:[&>*:first-child]:col-span-1">
        {league.complete ? (
          <div className="bg-stone-900 border-2 border-amber-900/40 rounded-xl p-4 flex flex-col gap-2">
            <p className={sectionTitle}>Season over</p>
            <p className="text-stone-100">Prize packs are ready to open</p>
          </div>
        ) : (
          <NextGame
            key={`${league.nextGame}-${league.nextGameAt ?? ''}`}
            gameNumber={league.nextGame}
            at={league.nextGameAt}
            note={league.nextGameNote}
            timeZone={league.timeZone}
            canSchedule={viewer.canSchedule}
            changeCount={data.changes.reduce((n, c) => n + c.items.length, 0)}
            boostNote={data.standings.filter(s => s.badges.includes('boost')).map(s => ` · ${s.name} starts at ${league.boostLife}`).join('')}
            onSave={(at, note) => act({ action: 'scheduleGame', at, note })}
          >
            {canCallBye && (confirmBye ? (
              <span id="league-bye-confirm" className="flex flex-wrap items-center gap-2 mt-1 text-xs text-stone-300">
                Skip this week&apos;s game?
                <button onClick={() => { setConfirmBye(false); act({ action: 'callBye' }) }} className="px-3 py-1.5 rounded-lg font-semibold bg-red-950/50 border border-red-900/60 text-red-200">
                  Call bye
                </button>
                <button onClick={() => setConfirmBye(false)} className="px-2 py-1.5 text-stone-400 hover:text-stone-200">Cancel</button>
              </span>
            ) : (
              <button onClick={() => setConfirmBye(true)} className="self-start text-xs text-stone-500 hover:text-stone-300 transition-colors">
                Call bye week
              </button>
            ))}
          </NextGame>
        )}
        <div className={`${card} p-4 flex flex-col gap-2`}>
          <p className={sectionTitle}>Your packs</p>
          <p className="text-2xl font-bold text-stone-100">{packsLeft} <span className="text-sm font-medium text-stone-400">to open</span></p>
          <p className="text-xs text-stone-400">
            Reserve: {league.reserveLeft} left{league.missedPacks > 0 ? ` · ${league.missedPacks} missed-week pack${league.missedPacks === 1 ? '' : 's'} added to prizes` : ''}
          </p>
        </div>
        <div className={`${card} p-4 flex flex-col gap-2`}>
          <p className={sectionTitle}>Underdog Swap</p>
          {data.underdog ? (
            <>
              <p className="text-stone-100">{data.underdog.name} is in last place</p>
              <p className="text-xs text-stone-400">{data.underdog.used ? 'Used this week' : 'Available once this week'}</p>
              {viewer.isUnderdog && (
                <button onClick={() => setModal('swap')} className="self-start text-sm font-semibold text-amber-400 hover:text-amber-300">Open swap</button>
              )}
            </>
          ) : (
            <p className="text-xs text-stone-400">Opens after the first game</p>
          )}
        </div>
      </section>

      {data.offers.length > 0 && (
        <section id="league-trade-offers" className="flex flex-col gap-2 scroll-mt-4">
          <h2 className={`${sectionTitle} flex items-center gap-2`}>
            Trade offers
            <CountBadge count={incomingOffers} label={`${incomingOffers} waiting for you`} />
          </h2>
          <div className={card}>
            {data.offers.map(o => (
              <div key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-stone-800 last:border-b-0">
                <p className="flex-1 min-w-48 text-sm text-stone-200">
                  {o.incoming
                    ? <>{o.otherName} offers <span className="text-green-300">{o.give}</span> for your <span className="text-red-300">{o.get}</span></>
                    : <>You offered <span className="text-red-300">{o.give}</span> to {o.otherName} for <span className="text-green-300">{o.get}</span></>}
                </p>
                {o.incoming ? (
                  <div className="flex gap-2">
                    <button onClick={() => respond(o.id, 'accept')} disabled={busyOffer === o.id} className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-950/60 border border-amber-700/50 text-amber-200 hover:bg-amber-900/70 hover:border-amber-600 active:scale-95 disabled:opacity-50 transition">
                      {busyOffer === o.id ? 'Saving…' : 'Accept'}
                    </button>
                    <button onClick={() => respond(o.id, 'decline')} disabled={busyOffer === o.id} className="px-4 py-2 rounded-lg text-xs font-semibold border border-stone-700 text-stone-300 hover:border-stone-500 hover:text-stone-100 active:scale-95 disabled:opacity-50 transition">
                      Decline
                    </button>
                  </div>
                ) : (
                  <button onClick={() => respond(o.id, 'cancel')} disabled={busyOffer === o.id} className="px-4 py-2 rounded-lg text-xs font-semibold border border-stone-700 text-stone-300 hover:border-stone-500 hover:text-stone-100 active:scale-95 disabled:opacity-50 transition">
                    {busyOffer === o.id ? 'Saving…' : 'Cancel offer'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={sectionTitle}>Standings</h2>
          <p className="text-xs text-stone-500">Ties go to most 1sts, then most 2nds, then head-to-head</p>
        </div>
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full sm:min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs text-stone-500 uppercase tracking-wider">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-2 py-3 font-semibold">Player</th>
                <th className="px-2 py-3 font-semibold text-right">Points</th>
                <th className="hidden sm:table-cell px-2 py-3 font-semibold text-right">1sts</th>
                <th className="hidden sm:table-cell px-2 py-3 font-semibold text-right">2nds</th>
                <th className="hidden sm:table-cell px-2 py-3 font-semibold text-right">First Blood</th>
                <th className="hidden sm:table-cell px-2 py-3 font-semibold">Finishes</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.standings.map(s => (
                <tr key={s.memberId} className="border-t border-stone-800">
                  <td className="px-4 py-3 font-mono text-stone-500">{s.rank}</td>
                  <td className="px-2 py-3">
                    <Link href={`/league/players/${s.memberId}`} className="font-semibold text-stone-100 hover:text-amber-400">{s.name}</Link>
                    <p className="text-xs text-stone-500">{s.precon}</p>
                  </td>
                  <td className="px-2 py-3 text-right font-mono text-base font-bold text-amber-200">{s.points}</td>
                  <td className="hidden sm:table-cell px-2 py-3 text-right font-mono">{s.firsts}</td>
                  <td className="hidden sm:table-cell px-2 py-3 text-right font-mono">{s.seconds}</td>
                  <td className="hidden sm:table-cell px-2 py-3 text-right font-mono">{s.firstBloods}</td>
                  <td className="hidden sm:table-cell px-2 py-3 font-mono text-stone-300">{s.finishes.map(finishLabel).join(' · ') || '–'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {s.badges.map(b => (
                        <span key={b} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${BADGES[b].className}`}>{BADGES[b].label}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="flex flex-col gap-2">
          <h2 className={sectionTitle}>Deck changes before Game {league.nextGame}</h2>
          <div className={card}>
            {playersWithChanges.length === 0 && <p className="px-4 py-3 text-sm text-stone-500">No changes yet</p>}
            {playersWithChanges.map(c => (
              <details key={c.memberId} className="group border-b border-stone-800 last:border-b-0">
                <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="flex-1 text-sm font-semibold text-stone-100">{c.name}</span>
                  <span className="text-xs text-stone-500">{c.items.length} change{c.items.length === 1 ? '' : 's'}</span>
                  <span aria-hidden="true" className="text-stone-500 transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="px-4 pb-3 flex flex-col gap-1.5">
                  {c.items.map((i, idx) => (
                    <div key={idx} className="bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm">
                      <p><span className="text-green-300">+ {i.added}</span> <span className="text-stone-500">for</span> <span className="text-red-300">− {i.removed}</span></p>
                      <p className="text-xs text-stone-500">{i.source}</p>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={sectionTitle}>Games and trades</h2>
          <div className={card}>
            {data.activity.length === 0 && <p className="px-4 py-3 text-sm text-stone-500">Nothing yet</p>}
            {data.activity.map((a, i) => (
              <div key={i} className="flex items-baseline gap-3 px-4 py-2.5 border-b border-stone-800 last:border-b-0">
                <span className="w-12 shrink-0 text-[11px] text-stone-500 uppercase tracking-wider">{a.kind}</span>
                <span className="flex-1 text-sm text-stone-200">{a.text}</span>
                <span className="text-[11px] text-stone-500 shrink-0">Week {a.week}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {data.biggestPulls.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className={sectionTitle}>Biggest pulls</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {data.biggestPulls.map(p => (
              <Link
                key={p.id}
                href={`/league/players/${p.ownerId}?tab=${p.zone}`}
                className={`${card} overflow-hidden flex flex-col hover:border-stone-600 transition-colors`}
              >
                <div className="aspect-[5/7] bg-stone-800">
                  {p.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="px-3 py-2 flex flex-col">
                  <span className="text-sm font-mono font-bold text-amber-200">${p.price!.toFixed(2)}</span>
                  <span className="text-xs text-stone-400 truncate">{p.pulledBy}{p.ownerName !== p.pulledBy ? ` · now ${p.ownerName}'s` : ''}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {bulkWithCards.length > 0 && <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Up for trade · pulls not in a deck</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {bulkWithCards.map(b => (
            <Link key={b.memberId} href={`/league/players/${b.memberId}?tab=side`} className={`${card} p-4 flex flex-col gap-1 hover:border-stone-600 transition-colors`}>
              <p className="text-sm font-semibold text-stone-100">{b.name} <span className="font-normal text-stone-500">· {b.count} cards</span></p>
              <p className="text-xs text-stone-500">{b.mythic} mythic · {b.rare} rare · {b.count - b.mythic - b.rare} other</p>
            </Link>
          ))}
        </div>
      </section>}

      <details className="group">
        <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center gap-2 text-xs text-stone-400 uppercase tracking-widest font-semibold py-2">
          League settings
          <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="flex flex-col gap-4 pt-2">
          <LeagueEmailSettings />
          {viewer.canEditSettings && (
            <LeagueSettingsEditor
              key={JSON.stringify(league.settings)}
              settings={league.settings}
              scoringLocked={league.scoringLocked}
              onSave={settings => act({ action: 'updateSettings', settings })}
            />
          )}
          {viewer.canEndSeason && (
            <div className="flex flex-wrap items-center gap-3 text-sm bg-stone-900 border border-stone-800 rounded-xl px-4 py-3">
              <p className="flex-1 min-w-48 text-stone-300">
                {viewer.endsEarly
                  ? `Admin only: end the season early, before game ${league.totalGames}. Standings freeze as they are now.`
                  : 'All games are in. Ending the season freezes standings and unlocks adding league cards to binders.'}
              </p>
              {confirmEnd ? (
                <span className="flex items-center gap-2">
                  <button onClick={() => { setConfirmEnd(false); act({ action: 'endSeason' }) }} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-950/50 border-2 border-red-900/60 text-red-200">
                    End season {league.seasonNumber}
                  </button>
                  <button onClick={() => setConfirmEnd(false)} className="px-3 py-2 text-sm text-stone-400 hover:text-stone-200">Cancel</button>
                </span>
              ) : (
                <button onClick={() => setConfirmEnd(true)} className="px-4 py-2 rounded-lg text-sm font-semibold border-2 border-stone-700 text-stone-200 hover:border-stone-500">
                  End season
                </button>
              )}
            </div>
          )}
        </div>
      </details>

      {modal === 'game' && (
        <LogGameModal
          gameNumber={league.nextGame}
          members={data.members}
          finishPoints={league.finishPoints}
          onClose={() => setModal(null)}
          onSaved={saved}
        />
      )}
      {modal === 'pack' && <OpenPackModal openPacks={viewer.openPacks} onClose={() => setModal(null)} onSaved={saved} />}
      {modal === 'trade' && <TradeModal onClose={() => setModal(null)} onSaved={saved} />}
      {modal === 'swap' && <UnderdogSwapModal onClose={() => setModal(null)} onSaved={saved} />}
    </div>
  )
}

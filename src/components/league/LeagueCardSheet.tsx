'use client'

import { useState } from 'react'
import type { CardView } from '@/lib/league/views'
import OracleText from '@/components/OracleText'
import LeagueModal, { leagueAction, PrimaryButton, RARITY_COLOR } from './LeagueModal'

export interface SwapGroup {
  title: string
  sameType: boolean
  cards: { card: CardView; qty: number; blocked: string | null }[]
}

// 'in': this sideboard card goes into the deck, the player picks what comes out.
// 'out': this main deck card leaves, the player picks the sideboard card that replaces it.
export interface SwapSetup {
  direction: 'in' | 'out'
  groups: SwapGroup[]
  blockedReason: string | null
}

interface LeagueCardSheetProps {
  card: CardView
  swap: SwapSetup | null
  tradeLabel: string | null
  onTrade: () => void
  onClose: () => void
  onSwapped: () => void
}

export default function LeagueCardSheet({ card, swap, tradeLabel, onTrade, onClose, onSwapped }: LeagueCardSheetProps) {
  const [picking, setPicking] = useState(false)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const goingIn = swap?.direction === 'in'

  function toggleGroup(title: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

  async function confirmSwap() {
    if (!pickedId) return
    setBusy(true)
    setError(null)
    try {
      const ids = goingIn ? { inId: card.id, outId: pickedId } : { inId: pickedId, outId: card.id }
      await leagueAction({ action: 'swapIntoDeck', ...ids })
      onSwapped()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (picking && swap) {
    const term = filter.trim().toLowerCase()
    const shown = swap.groups
      .map(g => ({ ...g, cards: g.cards.filter(o => !term || o.card.name.toLowerCase().includes(term) || o.card.realName.toLowerCase().includes(term)) }))
      .filter(g => g.cards.length > 0)
    const pickedCard = swap.groups.flatMap(g => g.cards).find(o => o.card.id === pickedId)?.card
    const cardOut = goingIn ? pickedCard : card
    const cardIn = goingIn ? card : pickedCard

    return (
      <LeagueModal title={goingIn ? 'Swap into deck' : 'Swap out of deck'} size="lg" busy={busy} onClose={onClose}>
        <div id="league-swap" className="flex flex-col gap-3">
          <button type="button" onClick={() => { setPicking(false); setError(null) }} className="self-start min-h-9 text-sm text-stone-300 hover:text-stone-100">
            ← Back to card
          </button>
          <div className="flex items-center gap-3 bg-stone-950 border border-stone-700 rounded-xl p-2">
            <div className="w-11 aspect-[5/7] bg-stone-800 rounded-md overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {card.imageUrl && <img src={card.imageUrl} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] text-stone-400 uppercase tracking-wider">{goingIn ? 'Coming in' : 'Going out'}</span>
              <span className="text-sm font-semibold text-stone-100 truncate">{card.name}</span>
              <span className={`text-xs capitalize ${RARITY_COLOR[card.rarity] ?? 'text-stone-400'}`}>{card.rarity}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="swap-filter" className="text-sm font-semibold text-stone-200">{goingIn ? 'Pick a card to take out' : 'Pick a sideboard card to bring in'}</label>
            <div className="relative">
              <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-600 pointer-events-none">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="M13 13l4 4" />
              </svg>
              <input
                id="swap-filter"
                type="search"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Search by name"
                autoComplete="off"
                className="w-full bg-stone-950 border border-amber-700/60 rounded-lg pl-10 pr-4 py-2.5 text-base text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {shown.length === 0 && <p className="text-sm text-stone-400">{swap.groups.length === 0 ? 'Your sideboard is empty.' : 'No cards match.'}</p>}
          {shown.map(g => {
            const open = !!term || !collapsed.has(g.title)
            return (
            <div key={g.title} className={`flex flex-col gap-2 sm:border-0 sm:bg-transparent sm:p-0 ${open ? 'rounded-lg border border-stone-700 bg-stone-800/30 p-2' : ''}`}>
              <h3>
                <button
                  type="button"
                  onClick={() => toggleGroup(g.title)}
                  aria-expanded={open}
                  className={`w-full sm:w-auto min-h-11 sm:min-h-9 sm:px-0 flex items-center justify-between sm:justify-start gap-2 sm:border-0 sm:bg-transparent text-xs text-stone-200 sm:text-stone-300 uppercase tracking-widest hover:text-stone-100 transition-colors ${open ? 'px-1' : 'px-3 rounded-lg border border-stone-700 bg-stone-800/70'}`}
                >
                  <span>{g.title} <span className="text-stone-500">· {g.cards.reduce((n, o) => n + o.qty, 0)}{g.sameType ? ' · same type' : ''}</span></span>
                  <span aria-hidden className={`order-last sm:order-first text-base sm:text-xs text-stone-400 sm:text-stone-500 transition-transform ${open ? '' : '-rotate-90'}`}>▾</span>
                </button>
              </h3>
              {open && <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                {g.cards.map(({ card: c, qty, blocked }) => {
                  const picked = c.id === pickedId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={picked}
                      disabled={!!blocked}
                      onClick={() => setPickedId(picked ? null : c.id)}
                      className={`flex flex-col gap-1 p-1 rounded-lg border-2 text-left disabled:cursor-not-allowed ${picked ? 'border-amber-500' : 'border-transparent enabled:hover:border-stone-600'}`}
                    >
                      <span className={`relative block w-full aspect-[5/7] bg-stone-800 rounded-md overflow-hidden ${blocked ? 'opacity-35' : ''}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {c.imageUrl && <img src={c.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />}
                        {picked && <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-amber-500 text-stone-950 text-sm font-bold flex items-center justify-center">✓</span>}
                      </span>
                      <span className={`text-[11px] truncate ${blocked ? 'text-stone-500' : 'text-stone-200'}`}>{c.name}{qty > 1 ? ` ×${qty}` : ''}</span>
                      {blocked && <span className="text-[10px] leading-tight text-red-400">{blocked}</span>}
                    </button>
                  )
                })}
              </div>}
            </div>
            )
          })}
        </div>

        <div className="sticky -bottom-5 -mx-5 -mb-5 px-5 pt-3 pb-5 bg-stone-900 border-t border-stone-800 flex flex-col gap-2.5">
          {error && <p className="text-xs text-red-400">{error}</p>}
          {cardOut && cardIn && (
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 gap-y-1 items-center text-sm">
              <span className="text-[11px] font-bold tracking-wider text-red-300">OUT</span>
              <span className="truncate text-stone-100">{cardOut.name} <span className="text-stone-400">· to sideboard</span></span>
              <span className="text-[11px] font-bold tracking-wider text-green-300">IN</span>
              <span className="truncate text-stone-100">{cardIn.name} <span className="text-stone-400">· to deck</span></span>
            </div>
          )}
          <PrimaryButton onClick={confirmSwap} disabled={!pickedCard || busy}>
            {busy ? 'Swapping…' : pickedCard ? 'Confirm swap' : goingIn ? 'Pick a card to take out' : 'Pick a card to bring in'}
          </PrimaryButton>
        </div>
      </LeagueModal>
    )
  }

  return (
    <LeagueModal title={card.name} size="lg" busy={busy} onClose={onClose}>
      <div id="league-card-details" className="flex flex-col sm:flex-row gap-4">
        <div className="w-48 sm:w-72 mx-auto sm:mx-0 aspect-[5/7] bg-stone-800 rounded-xl overflow-hidden shrink-0">
          {card.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
          ) : (
            <span className="h-full flex items-center justify-center p-3 text-center text-sm text-stone-400">{card.name}</span>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm sm:text-base content-start">
            <dt className="text-stone-500">Price</dt>
            <dd className="font-mono text-stone-100">{card.price != null ? `$${card.price.toFixed(2)}` : '—'}</dd>
            <dt className="text-stone-500">Type</dt>
            <dd className="text-stone-200">{card.typeLine}</dd>
            <dd className="col-span-2"><OracleText name={card.realName} /></dd>
            <dt className="text-stone-500">Rarity</dt>
            <dd className={`capitalize ${RARITY_COLOR[card.rarity] ?? 'text-stone-200'}`}>{card.rarity}</dd>
            {card.printing && (
              <>
                <dt className="text-stone-500">Printing</dt>
                <dd className="text-stone-200">{card.printing}</dd>
              </>
            )}
            {card.origin === 'pull' && (
              <>
                <dt className="text-stone-500">From</dt>
                <dd className="text-stone-200">{card.source}</dd>
              </>
            )}
            {card.zone === 'side' && (
              <>
                <dt className="text-stone-500">Underdog Swap</dt>
                <dd className="text-stone-200">{card.origin === 'pull' ? 'Can be taken' : 'Protected'}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {swap && (
        <div className="flex flex-col gap-1.5">
          <PrimaryButton onClick={() => setPicking(true)} disabled={!!swap.blockedReason}>
            {goingIn ? 'Swap into deck' : 'Swap out of deck'}
          </PrimaryButton>
          {swap.blockedReason && <p role="alert" className="text-xs text-red-400 text-center">{swap.blockedReason}</p>}
        </div>
      )}

      {tradeLabel && (
        <button
          id="league-card-trade"
          onClick={onTrade}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-950/60 border border-amber-700/50 hover:bg-amber-900/60 text-amber-200 transition-colors"
        >
          {tradeLabel}
        </button>
      )}
    </LeagueModal>
  )
}

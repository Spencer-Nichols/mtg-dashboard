'use client'

import { useEffect, useState } from 'react'
import type { CardView } from '@/lib/league/views'
import LeagueModal, { ModalError, PrimaryButton, useAction } from './LeagueModal'

interface TradeOptions {
  limit: number
  offColorIds: string[]
  mine: CardView[]
  partners: { id: string; name: string; used: number; cards: CardView[] }[]
}

interface TradeModalProps {
  initialPartnerId?: string
  initialGiveId?: string
  initialGetId?: string
  onClose: () => void
  onSaved: () => void
}

const MAX_RESULTS = 5

function money(n: number | null) {
  return n == null ? '—' : `$${n.toFixed(2)}`
}

const PIP_COLOR: Record<string, string> = {
  W: 'bg-amber-100 text-stone-900',
  U: 'bg-sky-500 text-white',
  B: 'bg-black text-stone-100 ring-1 ring-stone-500',
  R: 'bg-red-500 text-white',
  G: 'bg-green-600 text-white',
}

function ManaCost({ cost }: { cost: string | null }) {
  if (!cost) return null
  const symbols = [...cost.matchAll(/\{([^}]+)\}|(\/\/)/g)].map(m => m[1] ?? '//')
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Mana cost ${cost}`}>
      {symbols.map((sym, i) => sym === '//'
        ? <span key={i} className="text-[10px] text-stone-500 px-0.5">{'//'}</span>
        : <span key={i} className={`min-w-4 h-4 px-0.5 rounded-full text-[10px] font-bold leading-4 text-center ${PIP_COLOR[sym] ?? 'bg-stone-400 text-stone-900'}`}>{sym}</span>)}
    </span>
  )
}

function CardMeta({ card, offColor }: { card: CardView; offColor: boolean }) {
  const hasCost = !!card.manaCost
  if (!hasCost && !offColor) return null
  return (
    <span className="flex items-center gap-1.5 text-[11px]">
      <ManaCost cost={card.manaCost} />
      {offColor && <span className="font-semibold text-red-300">Off-color</span>}
    </span>
  )
}

function uniqueCards(cards: CardView[]) {
  const seen = new Set<string>()
  return cards.filter(c => {
    const key = `${c.name}|${c.zone}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function CardPicker({ id, label, cards, offColor, selected, onSelect }: {
  id: string
  label: string
  cards: CardView[]
  offColor: Set<string>
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  const [query, setQuery] = useState('')
  const picked = cards.find(c => c.id === selected)
  const q = query.trim().toLowerCase()
  const matches = q
    ? uniqueCards(cards)
      .filter(c => c.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, MAX_RESULTS)
    : []

  return (
    <div id={`${id}-picker`} className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className="text-xs text-stone-500 uppercase tracking-wider">{label}</label>
      {picked ? (
        <div className="flex items-center gap-2 bg-amber-950/40 border border-amber-800/60 rounded-lg pl-3 pr-1 py-1">
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="truncate text-sm text-amber-100">{picked.name}</span>
            <CardMeta card={picked} offColor={offColor.has(picked.id)} />
          </span>
          <span className="text-xs font-mono text-stone-300 shrink-0">{money(picked.price)}</span>
          <button
            type="button"
            onClick={() => { onSelect(null); setQuery('') }}
            aria-label={`Clear ${picked.name}`}
            className="w-9 h-9 shrink-0 text-stone-400 hover:text-stone-200"
          >✕</button>
        </div>
      ) : (
        <>
          <input
            id={id}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a card name"
            autoComplete="off"
            className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-base text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600"
          />
          {q && (
            <div className="bg-stone-950 border border-stone-800 rounded-lg">
              {matches.length === 0 && <p className="px-3 py-2.5 text-xs text-stone-500">No cards match</p>}
              {matches.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left text-stone-200 hover:bg-stone-900 border-b border-stone-900 last:border-b-0"
                >
                  <span className="min-w-0 flex flex-col">
                    <span className="truncate">{c.name}</span>
                    <CardMeta card={c} offColor={offColor.has(c.id)} />
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-stone-400">{money(c.price)}</span>
                    <span className={`text-xs ${c.zone === 'main' ? 'text-amber-200' : 'text-green-300'}`}>{c.zone === 'main' ? 'Main' : 'Side'}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function TradeModal({ initialPartnerId, initialGiveId, initialGetId, onClose, onSaved }: TradeModalProps) {
  const [options, setOptions] = useState<TradeOptions | null>(null)
  const [partnerId, setPartnerId] = useState<string | null>(initialPartnerId ?? null)
  const [give, setGive] = useState<string | null>(initialGiveId ?? null)
  const [get, setGet] = useState<string | null>(initialGetId ?? null)
  const { busy, error, run } = useAction(onSaved)

  useEffect(() => {
    fetch('/api/league/options?for=trade')
      .then(r => r.ok ? r.json() : null)
      .then((d: TradeOptions | null) => {
        setOptions(d)
        if (!d) return
        const firstOpen = d.partners.find(p => p.used < d.limit)?.id ?? null
        setPartnerId(prev => prev ?? firstOpen)
      })
  }, [])

  const partner = options?.partners.find(p => p.id === partnerId)
  const partnerFull = !!partner && !!options && partner.used >= options.limit
  const giveCard = options?.mine.find(c => c.id === give)
  const getCard = partner?.cards.find(c => c.id === get)
  const initialGiveMissing = !!initialGiveId && give === initialGiveId && !giveCard
  const initialGetMissing = !!initialGetId && get === initialGetId && !getCard
  const unavailable = !!options && (initialGiveMissing || initialGetMissing)
  const offColor = new Set(options?.offColorIds ?? [])
  const getIsOffColor = !!getCard && offColor.has(getCard.id)
  const wouldEnterMainDeck = giveCard?.zone === 'main'

  return (
    <LeagueModal title="New trade" size="lg" busy={busy} onClose={onClose}>
      <ModalError error={error} />
      {!options ? (
        <p className="text-sm text-stone-500">Loading cards…</p>
      ) : (
        <>
          <div id="trade-partners" className="flex flex-col gap-1.5">
            <p className="text-xs text-stone-500 uppercase tracking-wider">Trade with</p>
            <div className="flex flex-wrap gap-2">
              {options.partners.map(p => {
                const full = p.used >= options.limit
                const active = p.id === partnerId
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={full}
                    aria-pressed={active}
                    onClick={() => { setPartnerId(p.id); setGet(null) }}
                    className={`px-3 py-2 rounded-full text-sm font-semibold border transition-colors disabled:opacity-40 ${active ? 'bg-amber-950/70 border-amber-700/70 text-amber-200' : 'border-stone-700 text-stone-300 hover:border-stone-500'}`}
                  >
                    {p.name} <span className="font-normal text-xs text-stone-400">{p.used}/{options.limit}</span>
                  </button>
                )
              })}
            </div>
            {partnerFull && <p className="text-xs text-red-300">You&apos;ve used all {options.limit} trades with {partner.name} this week.</p>}
          </div>

          {unavailable && <p className="text-xs text-yellow-300">That card can&apos;t be traded right now. It may be a commander or already in a pending offer.</p>}

          {partner && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <CardPicker id="trade-give" label="You give" cards={options.mine} offColor={new Set()} selected={giveCard ? give : null} onSelect={setGive} />
              <CardPicker key={partner.id} id="trade-get" label={`${partner.name} gives`} cards={partner.cards} offColor={offColor} selected={getCard ? get : null} onSelect={setGet} />
            </div>
          )}

          {giveCard && getCard && (
            <p id="trade-summary" className="text-sm text-stone-300">
              You: <span className="text-red-300">− {giveCard.name}</span> {money(giveCard.price)} · <span className="text-green-300">+ {getCard.name}</span> {money(getCard.price)}
            </p>
          )}

          {getIsOffColor && (
            <p id="trade-off-color" className="text-xs text-yellow-300 bg-yellow-950/30 border border-yellow-900/50 rounded-lg px-3 py-2">
              {getCard.name} is outside your commander&apos;s colors.
              {giveCard && (wouldEnterMainDeck
                ? ` It would take ${giveCard.name}'s main deck slot, which the rules don't allow, so accepting will fail. Give a sideboard card instead to keep it as bulk.`
                : ' It will go to your sideboard.')}
            </p>
          )}

          <PrimaryButton
            onClick={() => run({ action: 'proposeTrade', toId: partnerId, giveCardId: give, getCardId: get })}
            disabled={busy || !giveCard || !getCard || partnerFull}
          >
            {busy ? 'Sending…' : partner ? `Send offer to ${partner.name}` : 'Send offer'}
          </PrimaryButton>
        </>
      )}
    </LeagueModal>
  )
}

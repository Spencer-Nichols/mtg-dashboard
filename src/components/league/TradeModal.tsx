'use client'

import { useEffect, useState } from 'react'
import type { CardView } from '@/lib/league/views'
import LeagueModal, { ModalError, PrimaryButton, useAction } from './LeagueModal'

interface TradeOptions {
  limit: number
  mine: CardView[]
  partners: { id: string; name: string; used: number; cards: CardView[] }[]
}

interface TradeModalProps {
  initialPartnerId?: string
  onClose: () => void
  onSaved: () => void
}

const MAX_RESULTS = 8

function uniqueCards(cards: CardView[]) {
  const seen = new Set<string>()
  return cards.filter(c => {
    const key = `${c.name}|${c.zone}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function CardPicker({ id, label, cards, selected, onSelect }: {
  id: string
  label: string
  cards: CardView[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const matches = uniqueCards(cards)
    .filter(c => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_RESULTS)
  const picked = cards.find(c => c.id === selected)

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className="text-xs text-stone-500 uppercase tracking-wider">{label}</label>
      <input
        id={id}
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search cards"
        autoComplete="off"
        className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-base text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600"
      />
      <div className="bg-stone-950 border border-stone-800 rounded-lg">
        {matches.length === 0 && <p className="px-3 py-2.5 text-xs text-stone-500">No cards match</p>}
        {matches.map(c => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.id === selected}
            onClick={() => onSelect(c.id)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left border-b border-stone-900 last:border-b-0 ${c.id === selected ? 'bg-amber-950/60 text-amber-100' : 'text-stone-200 hover:bg-stone-900'}`}
          >
            <span className="truncate">{c.name}</span>
            <span className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono text-stone-400">{c.price != null ? `$${c.price.toFixed(2)}` : '—'}</span>
              <span className={`text-xs ${c.zone === 'main' ? 'text-amber-200' : 'text-green-300'}`}>{c.zone === 'main' ? 'Main' : 'Side'}</span>
            </span>
          </button>
        ))}
      </div>
      {picked && <p className="text-xs text-stone-400">Picked: <span className="text-stone-200">{picked.name}</span></p>}
    </div>
  )
}

export default function TradeModal({ initialPartnerId, onClose, onSaved }: TradeModalProps) {
  const [options, setOptions] = useState<TradeOptions | null>(null)
  const [partnerId, setPartnerId] = useState<string | null>(initialPartnerId ?? null)
  const [give, setGive] = useState<string | null>(null)
  const [get, setGet] = useState<string | null>(null)
  const { busy, error, run } = useAction(onSaved)

  useEffect(() => {
    fetch('/api/league/options?for=trade')
      .then(r => r.ok ? r.json() : null)
      .then((d: TradeOptions | null) => {
        setOptions(d)
        if (d) setPartnerId(prev => prev ?? d.partners.find(p => p.used < d.limit)?.id ?? null)
      })
  }, [])

  const partner = options?.partners.find(p => p.id === partnerId)
  const giveCard = options?.mine.find(c => c.id === give)
  const getCard = partner?.cards.find(c => c.id === get)
  const where = (c?: CardView) => c?.zone === 'main' ? 'main deck' : 'sideboard'

  return (
    <LeagueModal title="New trade" wide busy={busy} onClose={onClose}>
      <ModalError error={error} />
      {!options ? (
        <p className="text-sm text-stone-500">Loading cards…</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-stone-500 uppercase tracking-wider">Trade with</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                    className={`text-left px-3 py-2.5 rounded-xl border transition-colors disabled:opacity-40 ${active ? 'bg-amber-950/60 border-amber-700/70' : 'border-stone-700 hover:border-stone-500'}`}
                  >
                    <span className="block text-sm font-semibold text-stone-100">{p.name}</span>
                    <span className="block text-xs text-stone-400">{p.used} of {options.limit} trades with you this week</span>
                  </button>
                )
              })}
            </div>
          </div>

          {partner && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CardPicker id="trade-give" label="You give" cards={options.mine} selected={give} onSelect={setGive} />
              <CardPicker key={partner.id} id="trade-get" label={`${partner.name} gives`} cards={partner.cards} selected={get} onSelect={setGet} />
            </div>
          )}

          {giveCard && getCard && partner && (
            <div className="text-sm bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 flex flex-col gap-1">
              <span><span className="text-stone-500">Your {where(giveCard)}:</span> <span className="text-red-300">− {giveCard.name}</span> · <span className="text-green-300">+ {getCard.name}</span></span>
              <span><span className="text-stone-500">{partner.name}&apos;s {where(getCard)}:</span> <span className="text-red-300">− {getCard.name}</span> · <span className="text-green-300">+ {giveCard.name}</span></span>
              <span className="text-xs text-stone-500">
                Value: you give {giveCard.price != null ? `$${giveCard.price.toFixed(2)}` : '—'}, you get {getCard.price != null ? `$${getCard.price.toFixed(2)}` : '—'}. The card you receive takes the slot of the card you give, so both decks stay at 100.
              </span>
            </div>
          )}

          <PrimaryButton
            onClick={() => run({ action: 'proposeTrade', toId: partnerId, giveCardId: give, getCardId: get })}
            disabled={busy || !giveCard || !getCard}
          >
            {busy ? 'Sending…' : partner ? `Send offer · ${partner.name} has to accept` : 'Send offer'}
          </PrimaryButton>
        </>
      )}
    </LeagueModal>
  )
}

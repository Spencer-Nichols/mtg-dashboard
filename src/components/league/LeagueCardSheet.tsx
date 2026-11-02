'use client'

import { useState } from 'react'
import type { CardView } from '@/lib/league/views'
import OracleText from '@/components/OracleText'
import LeagueModal, { leagueAction, RARITY_COLOR } from './LeagueModal'

interface LeagueCardSheetProps {
  card: CardView
  swapOptions: { id: string; name: string; qty: number }[] | null
  tradeLabel: string | null
  onTrade: () => void
  onClose: () => void
  onSwapped: () => void
}

export default function LeagueCardSheet({ card, swapOptions, tradeLabel, onTrade, onClose, onSwapped }: LeagueCardSheetProps) {
  const [outId, setOutId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function swap() {
    setBusy(true)
    setError(null)
    try {
      await leagueAction({ action: 'swapIntoDeck', inId: card.id, outId })
      onSwapped()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
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

      {tradeLabel && (
        <button
          id="league-card-trade"
          onClick={onTrade}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-950/60 border border-amber-700/50 hover:bg-amber-900/60 text-amber-200 transition-colors"
        >
          {tradeLabel}
        </button>
      )}

      {swapOptions && (
        <div id="league-card-swap" className="flex flex-col gap-2 bg-stone-950 border border-stone-800 rounded-xl p-3">
          <label htmlFor="swap-out" className="text-xs text-stone-500 uppercase tracking-wider">Swap into deck · takes out</label>
          <select
            id="swap-out"
            value={outId}
            onChange={e => setOutId(e.target.value)}
            className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-base text-stone-100"
          >
            <option value="">Pick a main deck card</option>
            {swapOptions.map(o => <option key={o.id} value={o.id}>{o.name}{o.qty > 1 ? ` (${o.qty})` : ''}</option>)}
          </select>
          <p className="text-xs text-stone-500">The card you take out moves to your sideboard. Your deck stays at 100.</p>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={swap}
            disabled={!outId || busy}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-amber-950/60 border border-amber-700/50 text-amber-200 disabled:opacity-50"
          >
            {busy ? 'Swapping…' : 'Confirm swap'}
          </button>
        </div>
      )}
    </LeagueModal>
  )
}

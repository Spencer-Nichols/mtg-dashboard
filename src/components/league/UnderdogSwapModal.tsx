'use client'

import { useEffect, useState } from 'react'
import type { CardView } from '@/lib/league/views'
import LeagueModal, { ModalError, PrimaryButton, RARITY_COLOR, useAction } from './LeagueModal'

interface SwapOptions {
  mine: CardView[]
  opponents: { id: string; name: string; cards: CardView[] }[]
}

interface UnderdogSwapModalProps {
  onClose: () => void
  onSaved: () => void
}

type Picks = Record<string, { take: string | null; give: string | null }>

export default function UnderdogSwapModal({ onClose, onSaved }: UnderdogSwapModalProps) {
  const [options, setOptions] = useState<SwapOptions | null>(null)
  const [picks, setPicks] = useState<Picks>({})
  const { busy, error, run } = useAction(onSaved)

  useEffect(() => {
    fetch('/api/league/options?for=swap').then(r => r.ok ? r.json() : null).then(setOptions)
  }, [])

  const givenElsewhere = (opponentId: string) =>
    new Set(Object.entries(picks).filter(([id]) => id !== opponentId).map(([, p]) => p.give).filter(Boolean))

  const takes = Object.entries(picks)
    .filter(([, p]) => p.take && p.give)
    .map(([fromId, p]) => ({ fromId, takeCardId: p.take, giveCardId: p.give }))

  return (
    <LeagueModal title="Underdog Swap" wide busy={busy} onClose={onClose}>
      <p className="text-xs text-stone-400">
        Last place, once this week. Take 1 pulled card from any opponent&apos;s sideboard and give back one of the same rarity from your own pulls. Opponents can&apos;t refuse, and it doesn&apos;t count as a trade.
      </p>
      <ModalError error={error} />
      {!options ? (
        <p className="text-sm text-stone-500">Loading cards…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {options.opponents.map(o => {
            const pick = picks[o.id] ?? { take: null, give: null }
            const taken = o.cards.find(c => c.id === pick.take)
            const blocked = givenElsewhere(o.id)
            const matches = taken ? options.mine.filter(c => c.rarity === taken.rarity && !blocked.has(c.id)) : []
            return (
              <div key={o.id} className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-col gap-2 min-w-0">
                <p className="text-sm font-semibold text-stone-100">{o.name}&apos;s pulls</p>
                <div className="border border-stone-800 rounded-lg max-h-56 overflow-y-auto">
                  {o.cards.length === 0 && <p className="px-3 py-2.5 text-xs text-stone-500">Nothing to take</p>}
                  {o.cards.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={c.id === pick.take}
                      onClick={() => setPicks({ ...picks, [o.id]: { take: c.id === pick.take ? null : c.id, give: null } })}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left border-b border-stone-900 last:border-b-0 ${c.id === pick.take ? 'bg-amber-950/60 text-amber-100' : 'text-stone-200 hover:bg-stone-900'}`}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="flex items-center gap-2 shrink-0 text-xs">
                        <span className="font-mono text-stone-400">{c.price != null ? `$${c.price.toFixed(2)}` : '—'}</span>
                        <span className={`capitalize ${RARITY_COLOR[c.rarity] ?? 'text-stone-400'}`}>{c.rarity}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {taken && (
                  <>
                    <p className="text-xs text-stone-500 uppercase tracking-wider">You give back · {taken.rarity}</p>
                    <div className="border border-stone-800 rounded-lg max-h-40 overflow-y-auto">
                      {matches.length === 0 && <p className="px-3 py-2.5 text-xs text-yellow-300">No {taken.rarity} in your pulls, so you can&apos;t take this card</p>}
                      {matches.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          aria-pressed={c.id === pick.give}
                          onClick={() => setPicks({ ...picks, [o.id]: { ...pick, give: c.id } })}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left border-b border-stone-900 last:border-b-0 ${c.id === pick.give ? 'bg-amber-950/60 text-amber-100' : 'text-stone-200 hover:bg-stone-900'}`}
                        >
                          <span className="truncate">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
      <PrimaryButton onClick={() => run({ action: 'underdogSwap', takes })} disabled={busy || takes.length === 0}>
        {busy ? 'Swapping…' : `Confirm swap · ${takes.length} card${takes.length === 1 ? '' : 's'}`}
      </PrimaryButton>
    </LeagueModal>
  )
}

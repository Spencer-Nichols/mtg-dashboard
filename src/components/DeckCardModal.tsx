'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type FoilType = 'none' | 'foil' | 'etched'

export interface DeckIdeaCard {
  id: string
  board: 'commander' | 'main' | 'sideboard'
  qty: number
  name: string
  setCode: string | null
  collectorNumber: string | null
  foilType: FoilType
  typeLine: string | null
  imageUrl: string | null
  exactPrice: number | null
  cheapestPrice: number | null
  cheapestSetCode: string | null
  cheapestCollectorNumber: string | null
  cheapestFoilType: FoilType | null
  cheapestScryfallId: string | null
  scryfallId: string | null
  cheapestChecked: boolean
  ownership: 'owned' | 'owned_other' | 'missing'
  binderCopy: { displayName: string; scryfallId: string | null; setCode: string | null; foilType: FoilType } | null
  onWishlist: boolean
}

interface Printing {
  scryfallId: string
  setCode: string
  setName: string
  collectorNumber: string
  imageUrls: string[]
  scryfallUri: string | null
  prices: Record<FoilType, number | null>
}

interface Row {
  key: 'list' | 'cheapest' | 'binder'
  label: string
  labelClass: string
  scryfallId: string | null
  setCode: string | null
  collectorNumber: string | null
  foilType: FoilType
  fallbackPrice: number | null
}

interface DeckCardModalProps {
  cards: DeckIdeaCard[]
  index: number
  groupTitle: string
  deckName: string
  onIndexChange: (index: number) => void
  onClose: () => void
  onWishlisted: (cardId: string) => void
}

const FINISH_LABEL: Record<FoilType, string> = { none: 'Nonfoil', foil: 'Foil', etched: 'Etched' }

function buildRows(card: DeckIdeaCard): Row[] {
  const rows: Row[] = [{
    key: 'list',
    label: 'In this list',
    labelClass: 'text-stone-300',
    scryfallId: card.scryfallId,
    setCode: card.setCode,
    collectorNumber: card.collectorNumber,
    foilType: card.foilType,
    fallbackPrice: card.exactPrice,
  }]
  const cheapestIsList = card.cheapestScryfallId === card.scryfallId && card.cheapestFoilType === card.foilType
  if (card.cheapestScryfallId && !cheapestIsList) {
    rows.push({
      key: 'cheapest',
      label: 'Cheapest',
      labelClass: 'text-amber-400',
      scryfallId: card.cheapestScryfallId,
      setCode: card.cheapestSetCode,
      collectorNumber: card.cheapestCollectorNumber,
      foilType: card.cheapestFoilType ?? 'none',
      fallbackPrice: card.cheapestPrice,
    })
  }
  if (card.ownership === 'owned_other' && card.binderCopy) {
    rows.push({
      key: 'binder',
      label: 'Your copy',
      labelClass: 'text-green-300',
      scryfallId: card.binderCopy.scryfallId,
      setCode: card.binderCopy.setCode,
      collectorNumber: null,
      foilType: card.binderCopy.foilType,
      fallbackPrice: null,
    })
  }
  return rows
}

function defaultRow(rows: Row[]): Row['key'] {
  return rows.find(r => r.key === 'binder')?.key ?? rows.find(r => r.key === 'cheapest')?.key ?? 'list'
}

export default function DeckCardModal({ cards, index, groupTitle, deckName, onIndexChange, onClose, onWishlisted }: DeckCardModalProps) {
  const card = cards[index]
  const rows = buildRows(card)
  const [selectedKey, setSelectedKey] = useState<Row['key']>(() => defaultRow(rows))
  const [printings, setPrintings] = useState<Record<string, Printing>>({})
  const [face, setFace] = useState(0)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const ids = rows.map(r => r.scryfallId).filter((id): id is string => !!id && !printings[id])
  const idsKey = ids.join(',')

  useEffect(() => {
    if (!idsKey) return
    fetch('/api/deck-ideas/printings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: idsKey.split(',') }),
    })
      .then(r => r.ok ? r.json() : [])
      .then((list: Printing[]) => setPrintings(prev => ({ ...prev, ...Object.fromEntries(list.map(p => [p.scryfallId, p])) })))
  }, [idsKey])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && index > 0) goTo(index - 1)
      else if (e.key === 'ArrowRight' && index < cards.length - 1) goTo(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function goTo(next: number) {
    setSelectedKey(defaultRow(buildRows(cards[next])))
    setFace(0)
    setAddError(null)
    onIndexChange(next)
  }

  const selected = rows.find(r => r.key === selectedKey) ?? rows[0]
  const selectedPrinting = selected.scryfallId ? printings[selected.scryfallId] : undefined
  const images = selectedPrinting?.imageUrls ?? (selected.key === 'list' && card.imageUrl ? [card.imageUrl] : [])
  const image = images[face] ?? images[0]

  const priceOf = (row: Row) => {
    const p = row.scryfallId ? printings[row.scryfallId] : undefined
    return p ? p.prices[row.foilType] ?? (row.foilType === 'etched' ? p.prices.foil : null) : row.fallbackPrice
  }
  const listPrice = priceOf(rows[0])
  const canWishlist = card.ownership !== 'owned' && selected.key !== 'binder' && !!selected.scryfallId

  async function addToWishlist() {
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch('/api/wishlist/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: card.name, scryfallId: selected.scryfallId, note: `From deck idea: ${deckName}` }),
      })
      const data = await res.json()
      if (!res.ok && res.status !== 409) throw new Error(data.error ?? 'Failed to add to wishlist')
      onWishlisted(card.id)
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e))
    } finally {
      setAdding(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div role="dialog" aria-label={card.name} className="bg-stone-900 border border-stone-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              aria-label="Previous card"
              className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg border border-stone-700 text-stone-300 hover:border-stone-500 disabled:opacity-30 transition-colors"
            >‹</button>
            <button
              onClick={() => goTo(index + 1)}
              disabled={index === cards.length - 1}
              aria-label="Next card"
              className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg border border-stone-700 text-stone-300 hover:border-stone-500 disabled:opacity-30 transition-colors"
            >›</button>
            <span className="text-xs text-stone-500 ml-1">{groupTitle} · {index + 1} of {cards.length}</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 sm:w-8 sm:h-8 text-stone-500 hover:text-stone-300 transition-colors text-xl leading-none">✕</button>
        </div>

        <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-6 overflow-y-auto">
          <div className="flex sm:flex-col items-start sm:items-center gap-3 shrink-0">
            <div className="w-32 sm:w-60 aspect-[5/7] rounded-lg sm:rounded-xl bg-stone-800 overflow-hidden">
              {image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt={card.name} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex flex-col gap-1.5 sm:hidden min-w-0">
              <h2 className="text-lg font-bold text-stone-100">{card.name}</h2>
              <p className="text-sm text-stone-400">{card.typeLine} · {card.qty} in deck</p>
            </div>
            {images.length > 1 && (
              <button onClick={() => setFace(f => (f + 1) % images.length)} className="hidden sm:block text-xs text-amber-500 hover:text-amber-400 font-medium transition-colors">
                ↻ Flip
              </button>
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-3.5">
            <div className="hidden sm:block">
              <h2 className="text-xl font-bold text-stone-100">{card.name}</h2>
              <p className="text-sm text-stone-400 mt-1">{card.typeLine} · {card.qty} in deck</p>
            </div>

            {card.ownership === 'owned' && (
              <p className="text-xs text-green-300 bg-green-950/30 border border-green-900 rounded-lg px-3 py-2">You own this exact printing.</p>
            )}
            {card.ownership === 'owned_other' && (
              <p className="text-xs text-green-300 bg-green-950/30 border border-green-900 rounded-lg px-3 py-2">You own this card in a different printing. It counts as owned.</p>
            )}
            {card.ownership === 'missing' && (
              <p className="text-xs text-stone-300 border border-stone-700 rounded-lg px-3 py-2">Not in your binder.</p>
            )}

            <div role="radiogroup" aria-label="Printing" className="flex flex-col gap-1.5">
              {rows.map(row => {
                const p = row.scryfallId ? printings[row.scryfallId] : undefined
                const price = priceOf(row)
                const delta = row.key === 'cheapest' && price != null && listPrice != null ? price - listPrice : null
                const isSelected = row.key === selected.key
                return (
                  <button
                    key={row.key}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => { setSelectedKey(row.key); setFace(0) }}
                    className={`flex items-center gap-3 w-full min-h-14 px-3 py-2.5 rounded-xl border text-left transition-colors ${isSelected ? 'bg-amber-950/45 border-amber-700' : 'bg-stone-950 border-stone-800 hover:border-stone-600'}`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[11px] font-semibold uppercase tracking-wider ${row.labelClass}`}>{row.label}</span>
                      <span className="block text-sm text-stone-100 truncate">
                        {p ? `${p.setName} · ${p.setCode.toUpperCase()} ${p.collectorNumber}` : [row.setCode?.toUpperCase(), row.collectorNumber].filter(Boolean).join(' ') || 'Unknown printing'}
                      </span>
                      <span className="block text-xs text-stone-500">{FINISH_LABEL[row.foilType]}</span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className={`block text-sm font-mono ${price != null ? 'text-stone-100' : 'text-yellow-400 text-xs'}`}>
                        {price != null ? `$${price.toFixed(2)}` : 'no price'}
                      </span>
                      {delta != null && Math.abs(delta) >= 0.01 && (
                        <span className={`block text-[11px] font-mono ${delta < 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {delta < 0 ? '−' : '+'}${Math.abs(delta).toFixed(2)} vs list
                        </span>
                      )}
                      {row.key === 'binder' && <span className="block text-[11px] text-green-300">owned</span>}
                    </span>
                  </button>
                )
              })}
            </div>

            {addError && <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{addError}</p>}

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-auto">
              {card.onWishlist ? (
                <Link href="/wishlist" className="text-center text-sm font-semibold text-green-300 border-2 border-green-900 rounded-lg px-3.5 py-2.5 sm:py-2">
                  On wishlist ✓
                </Link>
              ) : canWishlist && (
                <button
                  onClick={addToWishlist}
                  disabled={adding}
                  className="text-sm font-semibold text-amber-200 bg-amber-950/60 border-2 border-amber-700/50 hover:bg-amber-900/60 hover:border-amber-600 disabled:opacity-50 transition-colors rounded-lg px-3.5 py-2.5 sm:py-2"
                >
                  {adding ? 'Adding…' : `Add ${(selectedPrinting?.setCode ?? selected.setCode ?? '').toUpperCase()} ${selectedPrinting?.collectorNumber ?? selected.collectorNumber ?? ''} to wishlist`.replace(/\s+/g, ' ')}
                </button>
              )}
              {selectedPrinting?.scryfallUri && (
                <a
                  href={selectedPrinting.scryfallUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-center text-sm font-semibold text-stone-200 border-2 border-stone-700 hover:border-stone-500 transition-colors rounded-lg px-3.5 py-2.5 sm:py-2"
                >
                  View on Scryfall ↗
                </a>
              )}
              {card.binderCopy && (
                <Link
                  href={`/binder?expand=${encodeURIComponent(card.binderCopy.displayName)}`}
                  className="text-center text-sm font-semibold text-stone-200 border-2 border-stone-700 hover:border-stone-500 transition-colors rounded-lg px-3.5 py-2.5 sm:py-2"
                >
                  Open in binder
                </Link>
              )}
            </div>
            {canWishlist && !card.onWishlist && selected.foilType !== 'none' && (
              <p className="text-xs text-stone-500">The wishlist tracks the nonfoil price of this printing.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

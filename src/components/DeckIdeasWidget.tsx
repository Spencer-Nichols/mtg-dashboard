'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DeckIdeaModal from '@/components/DeckIdeaModal'

interface DeckIdeaSummary {
  id: string
  name: string
  commanders: string[]
  artUrl: string | null
  cheapestTotal: number | null
  unpricedCount: number
  weekDelta: number | null
  pendingCheapest: number
}

const LS_DECK_IDEAS = 'tnk:deck-ideas'
const POLL_MS = 5000

function formatDelta(delta: number | null) {
  if (delta == null || Math.abs(delta) < 0.01) return { text: '— 7d', className: 'text-stone-500' }
  return delta < 0
    ? { text: `▼ $${Math.abs(delta).toFixed(2)} 7d`, className: 'text-green-400' }
    : { text: `▲ $${delta.toFixed(2)} 7d`, className: 'text-red-400' }
}

export default function DeckIdeasWidget() {
  const router = useRouter()
  const [decks, setDecks] = useState<DeckIdeaSummary[] | null>(() => {
    if (typeof window === 'undefined') return null
    try { const c = localStorage.getItem(LS_DECK_IDEAS); return c ? JSON.parse(c) : null } catch { return null }
  })
  const [max, setMax] = useState(3)
  const [adding, setAdding] = useState(false)

  function load() {
    return fetch('/api/deck-ideas')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data.decks)) return
        setDecks(data.decks)
        setMax(data.max)
        try { localStorage.setItem(LS_DECK_IDEAS, JSON.stringify(data.decks)) } catch {}
      })
  }

  useEffect(() => { load() }, [])

  const pricing = decks?.some(d => d.pendingCheapest > 0)
  useEffect(() => {
    if (!pricing) return
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [pricing])

  if (decks == null) return null

  return (
    <section id="deck-ideas" className="bg-stone-900 border border-stone-800 rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold">Deck Ideas</p>
        {decks.length > 0 && decks.length < max && (
          <button onClick={() => setAdding(true)} className="text-xs font-semibold text-amber-500 hover:text-amber-400 transition-colors">
            + Add deck
          </button>
        )}
      </div>

      {decks.length === 0 ? (
        <div className="border border-dashed border-stone-700 rounded-lg p-5 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-stone-400">Paste a Moxfield list to see what a deck would cost.</p>
          <button
            onClick={() => setAdding(true)}
            className="text-xs font-semibold text-amber-200 bg-amber-950/60 border-2 border-amber-700/50 hover:bg-amber-900/60 hover:border-amber-600 transition-colors rounded-lg px-3 py-1.5"
          >
            + Add a deck
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {decks.map(d => {
            const delta = formatDelta(d.weekDelta)
            return (
              <Link
                key={d.id}
                href={`/deck-ideas/${d.id}`}
                className="flex flex-col bg-stone-950 border border-stone-800 hover:border-amber-800/70 rounded-lg overflow-hidden transition-colors"
              >
                <div className="h-24 bg-stone-800">
                  {d.artUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.artUrl} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-3 flex flex-col gap-0.5 min-w-0">
                  <p className="text-sm font-semibold text-stone-100 truncate">{d.name}</p>
                  <p className="text-xs text-stone-500 truncate">{d.commanders.join(' & ') || 'No commander'}</p>
                  <div className="flex items-baseline justify-between mt-1.5 gap-2">
                    <span className="text-lg font-bold font-mono text-stone-100">
                      {d.cheapestTotal != null ? `$${d.cheapestTotal.toFixed(2)}${d.unpricedCount > 0 ? '+' : ''}` : '—'}
                    </span>
                    {d.pendingCheapest > 0 ? (
                      <span className="text-xs text-stone-500">Pricing…</span>
                    ) : (
                      <span className={`text-xs font-mono ${delta.className}`}>{delta.text}</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {adding && (
        <DeckIdeaModal
          onClose={() => setAdding(false)}
          onSaved={id => router.push(`/deck-ideas/${id}`)}
        />
      )}
    </section>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DeckIdeaModal from '@/components/DeckIdeaModal'

interface DeckSummary {
  id: string
  name: string
  commanders: string[]
  artUrl: string | null
  unresolvedCount: number
}

export default function ProxiesPage() {
  const router = useRouter()
  const [decks, setDecks] = useState<DeckSummary[] | null>(null)
  const [max, setMax] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetch('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: 'proxies' }) })
    fetch('/api/deck-ideas')
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Could not load your decks')
        setDecks(data.decks)
        setMax(data.max)
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const canAdd = decks != null && decks.length < max

  return (
    <div className="flex flex-col gap-6">
      <header id="proxies-header" className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-stone-100">Proxy builder</h1>
          <p className="text-sm text-stone-400">Pick a deck to choose its art. Exports use the exact set and collector number of each card, as a zip for tcgplaytest.</p>
        </div>
        {canAdd && (
          <button
            onClick={() => setAdding(true)}
            className="text-sm font-semibold text-amber-200 bg-amber-950/60 border-2 border-amber-700/50 hover:bg-amber-900/60 hover:border-amber-600 transition-colors rounded-lg px-3 py-2 cursor-pointer"
          >
            + New deck
          </button>
        )}
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!decks && !error && <p className="text-sm text-stone-500">Loading decks…</p>}

      {decks && (
        <section id="proxies-decks" className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
          <div className="flex items-baseline justify-between px-5 py-3 border-b border-stone-800">
            <h2 className="text-xs text-stone-400 uppercase tracking-widest font-semibold">Your decks</h2>
            <span className="text-xs text-stone-500">{decks.length} of {max}</span>
          </div>
          {decks.length === 0 ? (
            <p className="px-5 py-6 text-sm text-stone-400">No decks yet. Paste an Archidekt or Moxfield list to start.</p>
          ) : (
            decks.map(d => (
              <Link
                key={d.id}
                href={`/proxies/${d.id}`}
                className="flex items-center gap-4 px-5 py-3 border-b border-stone-800 last:border-0 hover:bg-stone-800/60 transition-colors"
              >
                <div className="w-16 h-12 shrink-0 rounded bg-stone-800 overflow-hidden">
                  {d.artUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.artUrl} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1 flex flex-col">
                  <span className="text-sm font-semibold text-stone-100 truncate">{d.name}</span>
                  <span className="text-xs text-stone-500 truncate">{d.commanders.join(' & ') || 'No commander'}</span>
                </div>
                {d.unresolvedCount > 0 ? (
                  <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-orange-800 bg-orange-950/50 text-orange-200">{d.unresolvedCount} need a pick</span>
                ) : (
                  <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-amber-800 bg-amber-950/50 text-amber-200">Ready to export</span>
                )}
              </Link>
            ))
          )}
          <Link href="/proxies/quick" id="proxies-quick-link" className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-stone-800 text-sm font-semibold text-amber-300 hover:bg-stone-800/60 transition-colors">
            Just a few cards? Quick proxies <span aria-hidden>›</span>
          </Link>
          <p className="px-5 py-3 text-xs text-stone-500 border-t border-stone-800">These are your Deck Ideas. Art picks save to the deck, so you can start on your phone and export on a computer.</p>
        </section>
      )}

      {adding && (
        <DeckIdeaModal
          onClose={() => setAdding(false)}
          onSaved={id => router.push(`/proxies/${id}`)}
        />
      )}
    </div>
  )
}

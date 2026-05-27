'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface DeckSummary {
  slug: string
  title: string
  commander: string | null
  colors: string | null
  cardCount: number
}

export default function DecksPage() {
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/decks')
      .then(r => r.json())
      .then(data => { setDecks(data); setLoading(false) })
  }, [])

  if (loading) {
    return <p className="text-stone-500 text-sm">Loading decks...</p>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-100 mb-6">Decks</h1>
      {decks.length === 0 ? (
        <p className="text-stone-500">No decks found.</p>
      ) : (
        <div className="grid gap-3">
          {decks.map(deck => (
            <Link
              key={deck.slug}
              href={`/decks/${deck.slug}`}
              className="block bg-stone-900 border border-stone-800 hover:border-2 hover:border-amber-700 rounded-xl p-5 transition-colors group"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-stone-100 font-semibold group-hover:text-amber-400 transition-colors">
                    {deck.title}
                  </h2>
                  {deck.commander && (
                    <p className="text-stone-500 text-sm mt-1">Commander: {deck.commander}</p>
                  )}
                  {deck.colors && (
                    <p className="text-stone-600 text-xs mt-1">{deck.colors}</p>
                  )}
                </div>
                <span className="text-stone-600 text-sm flex-shrink-0">{deck.cardCount} cards</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

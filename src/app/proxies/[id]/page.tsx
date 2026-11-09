'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import BackLink from '@/components/BackLink'
import ProxyReview from '@/components/proxies/ProxyReview'
import type { Printing, ProxyCard } from '@/components/proxies/PrintingPicker'

export default function ProxyDeckPage() {
  const { id } = useParams<{ id: string }>()
  const [deckName, setDeckName] = useState<string | null>(null)
  const [cards, setCards] = useState<ProxyCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    return fetch(`/api/deck-ideas/${id}`)
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Could not load this deck')
        setDeckName(data.deck.name)
        setCards(data.cards)
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: 'proxies deck' }) })
  }, [])

  async function savePick(card: ProxyCard, printing: Printing) {
    const res = await fetch(`/api/proxies/cards/${card.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scryfallId: printing.scryfallId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'Could not save that printing')
    }
    await load()
  }

  if (error) return <p className="text-sm text-red-400">{error}</p>
  if (!cards || deckName == null) return <p className="text-sm text-stone-500">Loading deck…</p>

  return (
    <ProxyReview
      cards={cards}
      exportName={deckName}
      pickNote="Saves to this deck right away"
      phoneNote="Your picks are saved. Open TapNTrack on desktop, go to Proxies and pick this deck."
      onPick={savePick}
      header={
        <>
          <BackLink href="/proxies" label="Proxies" />
          <h1 className="text-2xl font-bold text-stone-100">{deckName}</h1>
          <p className="text-xs text-green-300">Picks save to this deck</p>
        </>
      }
    />
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ProxyReview from '@/components/proxies/ProxyReview'
import type { Printing, ProxyCard } from '@/components/proxies/PrintingPicker'

interface QuickList {
  title: string
  text: string
  cards: ProxyCard[] | null
}

const STORAGE_KEY = 'tnk:quick-proxies'
const EMPTY: QuickList = { title: '', text: '', cards: null }

function readSaved(): QuickList {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
  } catch {
    return EMPTY
  }
}

function toDecklist(cards: ProxyCard[]) {
  return cards
    .map(c => c.setCode && c.collectorNumber ? `${c.qty} ${c.name} (${c.setCode.toUpperCase()}) ${c.collectorNumber}` : `${c.qty} ${c.name}`)
    .join('\n')
}

export default function QuickProxiesPage() {
  const router = useRouter()
  const [list, setList] = useState<QuickList | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // localStorage only exists in the browser, so the saved list loads after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setList(readSaved())
    fetch('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: 'proxies quick' }) })
  }, [])

  function update(next: QuickList) {
    setList(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }

  async function findPrintings() {
    if (!list) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/proxies/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: list.text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not read that list')
      update({ ...list, cards: data.cards })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function pickLocally(card: ProxyCard, printing: Printing) {
    if (!list?.cards) return
    const cards = list.cards.map(c => c.id === card.id ? {
      ...c,
      name: printing.name,
      setCode: printing.setCode,
      collectorNumber: printing.collectorNumber,
      scryfallId: printing.scryfallId,
      imageUrl: printing.imageUrl,
    } : c)
    update({ ...list, cards, text: toDecklist(cards) })
  }

  async function saveAsDeck() {
    if (!list?.cards) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/deck-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: list.title.trim() || 'Quick proxies', text: toDecklist(list.cards), commanders: [] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not save as a deck')
      update(EMPTY)
      router.push(`/proxies/${data.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (!list) return <p className="text-sm text-stone-500">Loading…</p>

  const title = list.title.trim() || 'Proxies'
  const actionButton = 'min-h-10 px-3 rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default'

  if (list.cards) {
    return (
      <ProxyReview
        cards={list.cards}
        exportName={title}
        pickNote="Kept in this browser until you clear the list"
        phoneNote="Quick lists stay in this browser. Save as deck to finish on your computer."
        onPick={pickLocally}
        header={
          <>
            <button onClick={() => update({ ...list, cards: null })} className="self-start py-2 -my-2 text-sm font-semibold text-amber-500 sm:py-0 sm:my-0 sm:font-normal sm:text-stone-500 sm:hover:text-stone-300 cursor-pointer">← Edit list</button>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h1 className="text-2xl font-bold text-stone-100">{title}</h1>
                <p className="text-xs text-stone-500">Quick list, kept in this browser only</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => update(EMPTY)} disabled={busy} className={`${actionButton} border border-stone-700 text-stone-300 hover:border-stone-500`}>Clear</button>
                <button onClick={saveAsDeck} disabled={busy} className={`${actionButton} font-semibold border border-amber-700/60 bg-amber-950/50 text-amber-200 hover:bg-amber-900/60`}>{busy ? 'Saving…' : 'Save as deck'}</button>
              </div>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex flex-col gap-1">
        <Link href="/proxies" className="self-start py-2 -my-2 text-sm font-semibold text-amber-500 sm:py-0 sm:my-0 sm:font-normal sm:text-stone-500 sm:hover:text-stone-300">← Proxies</Link>
        <h1 className="text-2xl font-bold text-stone-100">Quick proxies</h1>
        <p className="text-sm text-stone-400">A handful of cards, no deck needed. Nothing is saved to your account.</p>
        <p className="mt-1 self-start text-xs text-sky-200 bg-sky-950/40 border border-sky-900/60 rounded-lg px-2.5 py-1.5">Real card art only: the official Scryfall printing you choose.</p>
      </div>

      <label htmlFor="quick-title" className="text-xs text-stone-500 uppercase tracking-wider">Name (optional, used for the zip)</label>
      <input
        id="quick-title"
        value={list.title}
        onChange={e => update({ ...list, title: e.target.value })}
        placeholder="Proxies"
        className="-mt-2 bg-stone-900 border border-stone-700 rounded-lg px-3 py-2.5 text-base text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600"
      />
      <label htmlFor="quick-list" className="text-xs text-stone-500 uppercase tracking-wider">Cards, one per line</label>
      <textarea
        id="quick-list"
        value={list.text}
        onChange={e => update({ ...list, text: e.target.value })}
        rows={8}
        placeholder={'1 Sol Ring (C21) 263\n1 Scroll Rack (CMR) 699\n2 Arcane Signet'}
        className="-mt-2 bg-stone-900 border border-stone-700 rounded-lg px-3 py-3 font-mono text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-stone-500">Same format as Moxfield or Archidekt. No set code? You get the newest printing and can change it next.</p>
        <button
          onClick={findPrintings}
          disabled={busy || !list.text.trim()}
          className="min-h-11 px-5 rounded-lg bg-amber-500 text-stone-950 text-sm font-bold hover:bg-amber-400 disabled:opacity-50 cursor-pointer disabled:cursor-default"
        >
          {busy ? 'Finding printings…' : 'Find printings'}
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

function scryfallImageUrl(name: string) {
  return `https://api.scryfall.com/cards/named?format=image&version=normal&fuzzy=${encodeURIComponent(name)}`
}

type Status = 'owned' | 'proxy' | 'not_owned'

interface CardEntry {
  name: string
  count: number
  status: Status
}

interface DeckDetail {
  title: string
  commander: string | null
  commanderStatus: Status | null
  colors: string | null
  cards: CardEntry[]
}

const STATUS_STYLES: Record<Status, string> = {
  owned: 'text-green-400',
  proxy: 'text-yellow-400',
  not_owned: 'text-red-400',
}

const STATUS_LABELS: Record<Status, string> = {
  owned: 'Owned',
  proxy: 'Proxy',
  not_owned: 'Missing',
}

const STATUS_BADGE: Record<Status, string> = {
  owned: 'bg-green-900/40 text-green-300 border border-green-800',
  proxy: 'bg-yellow-900/40 text-yellow-300 border border-yellow-800',
  not_owned: 'bg-red-900/40 text-red-300 border border-red-800',
}

export default function DeckPage() {
  const { slug } = useParams<{ slug: string }>()
  const [deck, setDeck] = useState<DeckDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    fetch(`/api/decks/${slug}`)
      .then(r => r.json())
      .then(data => { setDeck(data); setLoading(false) })
  }, [slug])

  useEffect(() => {
    const handler = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  if (loading) return <p className="text-stone-500 text-sm">Loading deck...</p>
  if (!deck) return <p className="text-red-400 text-sm">Deck not found.</p>

  const owned = deck.cards.filter(c => c.status === 'owned').length
  const proxy = deck.cards.filter(c => c.status === 'proxy').length
  const missing = deck.cards.filter(c => c.status === 'not_owned').length
  const total = deck.cards.length

  const filtered = filter === 'all' ? deck.cards : deck.cards.filter(c => c.status === filter)
  const sorted = [...filtered].sort((a, b) => {
    const order = { not_owned: 0, proxy: 1, owned: 2 }
    return order[a.status] - order[b.status] || a.name.localeCompare(b.name)
  })

  return (
    <div>
      {/* Back link */}
      <Link href="/decks" className="text-sm text-stone-500 hover:text-stone-300 transition-colors mb-6 inline-block">
        ← All Decks
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-100">{deck.title}</h1>
        {deck.commander && (
          <p className="text-stone-400 text-sm mt-1">
            Commander:{' '}
            <span className={deck.commanderStatus ? STATUS_STYLES[deck.commanderStatus] : 'text-stone-300'}>
              {deck.commander}
            </span>
            {deck.commanderStatus && (
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${STATUS_BADGE[deck.commanderStatus]}`}>
                {STATUS_LABELS[deck.commanderStatus]}
              </span>
            )}
          </p>
        )}
        {deck.colors && <p className="text-stone-600 text-xs mt-1">{deck.colors}</p>}
      </div>

      {/* Summary bars */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {([
          { label: `${owned} Owned`, status: 'owned' as Status, count: owned },
          { label: `${proxy} Proxy`, status: 'proxy' as Status, count: proxy },
          { label: `${missing} Missing`, status: 'not_owned' as Status, count: missing },
        ]).map(({ label, status, count }) => (
          <button
            key={status}
            onClick={() => setFilter(filter === status ? 'all' : status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status ? STATUS_BADGE[status] : 'bg-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center">
          <div className="h-2 rounded-full overflow-hidden flex w-48 bg-stone-800">
            <div className="bg-green-600 h-full" style={{ width: `${(owned / total) * 100}%` }} />
            <div className="bg-yellow-600 h-full" style={{ width: `${(proxy / total) * 100}%` }} />
            <div className="bg-red-900 h-full" style={{ width: `${(missing / total) * 100}%` }} />
          </div>
          <span className="text-stone-500 text-xs ml-3">{total} cards</span>
        </div>
      </div>

      {/* Card list */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-stone-800">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-medium text-stone-500 uppercase tracking-wider">Card</th>
              <th className="text-center px-3 py-2 text-xs font-medium text-stone-500 uppercase tracking-wider">Qty</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-stone-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sorted.map(card => (
              <tr
                key={card.name}
                className="hover:bg-stone-800/50 transition-colors cursor-default"
                onMouseEnter={() => setHoveredCard(card.name)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <td className="px-4 py-2.5 text-stone-200 text-sm">{card.name}</td>
                <td className="px-3 py-2.5 text-center text-stone-500 text-sm">{card.count}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGE[card.status]}`}>
                    {STATUS_LABELS[card.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Floating card image tooltip */}
      {hoveredCard && <CardTooltip name={hoveredCard} mousePos={mousePos} />}
    </div>
  )
}

function CardTooltip({ name, mousePos }: { name: string; mousePos: { x: number; y: number } }) {
  const imgW = 200, imgH = 280, pad = 16
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const tipX = mousePos.x + pad + imgW > vw ? mousePos.x - imgW - pad : mousePos.x + pad
  const tipY = Math.max(pad, Math.min(mousePos.y - imgH / 2, vh - imgH - pad))
  return (
    <div
      className="fixed z-50 pointer-events-none rounded-xl overflow-hidden shadow-2xl border border-stone-700"
      style={{ left: tipX, top: tipY, width: imgW }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={scryfallImageUrl(name)} alt={name} className="w-full block" />
    </div>
  )
}

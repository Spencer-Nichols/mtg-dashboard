'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import CollectionChart from '@/components/CollectionChart'
import DeckIdeaModal from '@/components/DeckIdeaModal'
import DeckCardModal, { type DeckIdeaCard } from '@/components/DeckCardModal'

type Ownership = DeckIdeaCard['ownership']
type DeckCard = DeckIdeaCard
type Mode = 'cheapest' | 'exact'
type Filter = 'all' | 'owned' | 'missing'

interface DeckDetail {
  deck: {
    id: string
    name: string
    colorIdentity: string | null
    sourceUrl: string | null
    pricedAt: string | null
  }
  cards: DeckCard[]
  history: { date: string; cheapestTotal: number | null; exactTotal: number | null }[]
}

const POLL_MS = 5000

const TYPE_GROUPS = ['Planeswalkers', 'Creatures', 'Sorceries', 'Instants', 'Enchantments', 'Artifacts', 'Battles', 'Lands', 'Other'] as const

function typeGroup(typeLine: string | null): string {
  const front = (typeLine ?? '').split(' // ')[0]
  if (front.includes('Creature')) return 'Creatures'
  if (front.includes('Planeswalker')) return 'Planeswalkers'
  if (front.includes('Battle')) return 'Battles'
  if (front.includes('Land')) return 'Lands'
  if (front.includes('Instant')) return 'Instants'
  if (front.includes('Sorcery')) return 'Sorceries'
  if (front.includes('Artifact')) return 'Artifacts'
  if (front.includes('Enchantment')) return 'Enchantments'
  return 'Other'
}

const OWNERSHIP_BADGE: Record<Ownership, { label: string; className: string }> = {
  owned: { label: 'Owned', className: 'bg-green-900/40 text-green-300 border border-green-800' },
  owned_other: { label: 'Owned · diff. printing', className: 'bg-green-950/40 text-green-300 border border-green-900' },
  missing: { label: 'Not owned', className: 'text-stone-300 border border-stone-700' },
}

function unitPrice(card: DeckCard, mode: Mode) {
  return mode === 'exact' ? card.exactPrice : card.cheapestPrice ?? card.exactPrice
}

function printing(card: DeckCard, mode: Mode) {
  const useCheapest = mode === 'cheapest' && card.cheapestSetCode
  return {
    setCode: useCheapest ? card.cheapestSetCode : card.setCode,
    collectorNumber: useCheapest ? card.cheapestCollectorNumber : card.collectorNumber,
    foilType: useCheapest ? card.cheapestFoilType ?? 'none' : card.foilType,
  }
}

function money(n: number) {
  return `$${n.toFixed(2)}`
}

function timeAgo(iso: string | null) {
  if (!iso) return 'not yet'
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

export default function DeckIdeaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<DeckDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('cheapest')
  const [filter, setFilter] = useState<Filter>('all')
  const [repasting, setRepasting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [threshold, setThreshold] = useState('5')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openCard, setOpenCard] = useState<{ groupTitle: string; cards: DeckCard[]; index: number } | null>(null)

  const load = useCallback(() => {
    return fetch(`/api/deck-ideas/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
  }, [id])

  useEffect(() => { load() }, [load])

  const pendingCheapest = data?.cards.filter(c => !c.cheapestChecked).length ?? 0
  useEffect(() => {
    if (pendingCheapest === 0) return
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [pendingCheapest, load])

  if (loading) return <p className="text-stone-500 text-sm">Loading deck…</p>
  if (!data) return <p className="text-red-400 text-sm">Deck not found.</p>

  const { deck, cards, history } = data
  const commanders = cards.filter(c => c.board === 'commander')
  const totalQty = cards.reduce((n, c) => n + c.qty, 0)
  const sideQty = cards.filter(c => c.board === 'sideboard').reduce((n, c) => n + c.qty, 0)
  const ownedQty = cards.filter(c => c.ownership !== 'missing').reduce((n, c) => n + c.qty, 0)

  const totalFor = (m: Mode) => cards.reduce((sum, c) => sum + c.qty * (unitPrice(c, m) ?? 0), 0)
  const unpricedFor = (m: Mode) => cards.filter(c => unitPrice(c, m) == null).length
  const otherMode: Mode = mode === 'cheapest' ? 'exact' : 'cheapest'
  const modeLabel = (m: Mode) => m === 'cheapest' ? 'cheapest printings' : 'exact printings'

  const visible = cards.filter(c => filter === 'all' || (filter === 'owned' ? c.ownership !== 'missing' : c.ownership === 'missing'))
  const groups = [
    { title: 'Commander', cards: visible.filter(c => c.board === 'commander') },
    ...TYPE_GROUPS.map(g => ({ title: g, cards: visible.filter(c => c.board === 'main' && typeGroup(c.typeLine) === g) })),
    { title: 'Sideboard', cards: visible.filter(c => c.board === 'sideboard') },
  ].filter(g => g.cards.length > 0)

  const priciest = [...cards]
    .filter(c => unitPrice(c, mode) != null)
    .sort((a, b) => unitPrice(b, mode)! - unitPrice(a, mode)!)
    .slice(0, 5)

  const minPrice = parseFloat(threshold)
  const sendable = new Set(cards
    .filter(c => c.ownership === 'missing' && Number.isFinite(minPrice) && (unitPrice(c, mode) ?? -1) >= minPrice)
    .map(c => c.name)).size

  const chartData = history
    .map(h => ({ date: h.date, total: (mode === 'exact' ? h.exactTotal : h.cheapestTotal) ?? 0 }))

  const commanderImage = commanders[0]?.imageUrl ?? null
  const deckTotal = totalFor(mode)
  const firstHistory = history[0]
  const historyBaseline = firstHistory ? (mode === 'exact' ? firstHistory.exactTotal : firstHistory.cheapestTotal) : null
  const trend = historyBaseline != null && history.length > 1 ? deckTotal - historyBaseline : null

  async function sendToWishlist() {
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch(`/api/deck-ideas/${id}/wishlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: minPrice, mode }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Failed to add cards')
      const parts = [`Added ${result.added.length} card${result.added.length === 1 ? '' : 's'} to your wishlist.`]
      if (result.skipped.length > 0) parts.push(`${result.skipped.length} already there.`)
      if (result.limitReached) parts.push('Wishlist limit reached (100 cards).')
      setSendResult(parts.join(' '))
    } catch (e) {
      setSendResult(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  async function deleteDeck() {
    setDeleting(true)
    setError(null)
    const res = await fetch(`/api/deck-ideas/${id}`, { method: 'DELETE' })
    if (res.ok) {
      try { localStorage.removeItem('tnk:deck-ideas') } catch {}
      router.push('/')
      return
    }
    const result = await res.json().catch(() => ({}))
    setError(result.error ?? 'Failed to delete deck')
    setDeleting(false)
    setConfirmDelete(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="text-sm text-stone-500 hover:text-stone-300 transition-colors">← Home</Link>

      {error && <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{error}</p>}

      <section className="flex flex-wrap gap-5 items-end justify-between">
        <div className="flex gap-4 items-center min-w-0">
          <div className="w-[72px] aspect-[5/7] bg-stone-800 rounded-md overflow-hidden shrink-0">
            {commanderImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={commanderImage} alt={commanders[0].name} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-xs text-stone-500 uppercase tracking-widest">Deck Idea</p>
            <h1 className="text-2xl font-bold text-stone-100">{deck.name}</h1>
            <p className="text-sm text-stone-400">
              {[commanders.map(c => c.name).join(' & '), deck.colorIdentity, `${totalQty - sideQty} cards${sideQty ? ` + ${sideQty} sideboard` : ''}`].filter(Boolean).join(' · ')}
            </p>
            <p className="text-xs text-stone-500">Prices from Scryfall · updated {timeAgo(deck.pricedAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setRepasting(true)}
            className="text-xs font-semibold text-amber-200 bg-amber-950/60 border-2 border-amber-700/50 hover:bg-amber-900/60 hover:border-amber-600 transition-colors rounded-lg px-3 py-2"
          >
            Re-paste from Moxfield
          </button>
          {deck.sourceUrl && (
            <a
              href={deck.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-stone-200 border-2 border-stone-700 hover:border-stone-500 transition-colors rounded-lg px-3 py-2"
            >
              Open on Moxfield ↗
            </a>
          )}
        </div>
      </section>

      {pendingCheapest > 0 && (
        <p className="text-xs text-stone-400 bg-stone-900 border border-stone-800 rounded-lg px-3 py-2">
          Finding cheapest printings… {cards.length - pendingCheapest} / {cards.length} cards checked. Cheapest totals use the exact printing until then.
        </p>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-stone-900 border-2 border-amber-900/40 rounded-xl p-4 flex flex-col gap-1">
          <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold">Deck total · {modeLabel(mode)}</p>
          <p className="text-2xl font-bold font-mono text-stone-100">{money(deckTotal)}{unpricedFor(mode) > 0 ? '+' : ''}</p>
          {unpricedFor(mode) > 0 ? (
            <p className="text-xs text-yellow-400">{unpricedFor(mode)} card{unpricedFor(mode) === 1 ? '' : 's'} with no price yet</p>
          ) : trend != null && Math.abs(trend) >= 0.01 ? (
            <p className={`text-xs font-mono ${trend < 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend < 0 ? '▼' : '▲'} {money(Math.abs(trend))} since {history[0].date}
            </p>
          ) : null}
        </div>
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 flex flex-col gap-1">
          <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold">Total · {modeLabel(otherMode)}</p>
          <p className="text-2xl font-bold font-mono text-stone-400">{money(totalFor(otherMode))}{unpricedFor(otherMode) > 0 ? '+' : ''}</p>
          <p className="text-xs text-stone-500">For comparison</p>
        </div>
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 flex flex-col gap-2">
          <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold">Already in binder</p>
          <p className="text-2xl font-bold text-stone-100">{ownedQty} <span className="text-sm font-medium text-stone-500">/ {totalQty} cards</span></p>
          <div className="h-1.5 rounded-full bg-stone-800 overflow-hidden">
            <div className="h-full bg-green-600" style={{ width: `${totalQty ? (ownedQty / totalQty) * 100 : 0}%` }} />
          </div>
        </div>
      </section>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <main className="flex-1 min-w-0 w-full flex flex-col gap-4">
          <div className="flex flex-wrap gap-3 justify-between items-center">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by ownership">
              {([['all', 'All'], ['owned', 'Owned'], ['missing', 'Not owned']] as [Filter, string][]).map(([f, label]) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${filter === f ? 'border-amber-700 bg-amber-950/60 text-amber-200' : 'border-stone-700 text-stone-300 hover:border-stone-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex bg-stone-900 border border-stone-800 rounded-lg p-0.5" role="group" aria-label="Price by">
              {(['cheapest', 'exact'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`text-xs font-semibold rounded-md px-3 py-1.5 transition-colors ${mode === m ? 'bg-stone-700 text-stone-100' : 'text-stone-400 hover:text-stone-200'}`}
                >
                  {m === 'cheapest' ? 'Cheapest printing' : 'Exact printing'}
                </button>
              ))}
            </div>
          </div>

          {groups.map(group => (
            <section key={group.title} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2.5 border-b border-stone-800">
                <h2 className="text-xs font-semibold text-stone-300 uppercase tracking-widest">
                  {group.title} <span className="text-stone-500 font-normal">({group.cards.reduce((n, c) => n + c.qty, 0)})</span>
                </h2>
                <span className="text-xs font-mono text-stone-500">{money(group.cards.reduce((s, c) => s + c.qty * (unitPrice(c, mode) ?? 0), 0))}</span>
              </div>
              <div className="flex flex-col divide-y divide-stone-800/60">
                {group.cards.map(card => {
                  const p = printing(card, mode)
                  const price = unitPrice(card, mode)
                  const badge = OWNERSHIP_BADGE[card.ownership]
                  return (
                    <button
                      key={card.id}
                      onClick={() => setOpenCard({ groupTitle: group.title, cards: group.cards, index: group.cards.indexOf(card) })}
                      className="flex items-center gap-3 px-4 py-2 w-full text-left hover:bg-stone-800/50 transition-colors"
                    >
                      <span className="w-5 text-right text-sm font-mono text-stone-500 shrink-0">{card.qty}</span>
                      <div className="w-6 aspect-[5/7] bg-stone-800 rounded-sm overflow-hidden shrink-0">
                        {card.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={card.imageUrl} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-stone-100 truncate">
                          {card.name}
                          {p.foilType !== 'none' && (
                            <span className="ml-1.5 text-[10px] font-bold text-amber-400 border border-amber-800 rounded px-1 py-px align-middle uppercase">{p.foilType}</span>
                          )}
                        </p>
                        {p.setCode && <p className="text-xs text-stone-500 uppercase">{p.setCode} · {p.collectorNumber}</p>}
                      </div>
                      <span className={`hidden sm:inline text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap ${badge.className}`}>{badge.label}</span>
                      <span className="w-20 text-right text-sm font-mono text-stone-200 shrink-0">
                        {price != null ? money(card.qty * price) : <span className="text-yellow-400 text-xs">no price</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
          {groups.length === 0 && <p className="text-sm text-stone-500">No cards match this filter.</p>}
        </main>

        <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
          <section className="bg-stone-900 border border-stone-800 rounded-xl p-4">
            <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold mb-3">Deck price, 30 days</p>
            {chartData.length > 1 ? (
              <CollectionChart data={chartData} height={90} />
            ) : (
              <p className="text-xs text-stone-500">The trend appears after a couple of daily price snapshots.</p>
            )}
          </section>

          <section className="bg-stone-900 border border-stone-800 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold mb-1">Priciest cards</p>
            {priciest.map(card => (
              <div key={card.id} className="flex justify-between gap-3 text-sm">
                <span className="text-stone-200 truncate">{card.name}</span>
                <span className="font-mono text-stone-200 shrink-0">{money(unitPrice(card, mode)!)}</span>
              </div>
            ))}
          </section>

          <section className="bg-stone-900 border border-stone-800 rounded-xl p-4 flex flex-col gap-3">
            <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold">Track the expensive ones</p>
            <label className="flex items-center gap-2 text-sm text-stone-300">
              Not owned and over
              <span className="flex items-center gap-1">
                <span className="text-stone-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={threshold}
                  onChange={e => setThreshold(e.target.value)}
                  className="w-16 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-sm font-mono text-stone-100 focus:outline-none focus:border-amber-600"
                />
              </span>
            </label>
            <button
              onClick={sendToWishlist}
              disabled={sending || sendable === 0}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-amber-950/60 border border-amber-700/50 hover:bg-amber-900/60 text-amber-200 disabled:opacity-50 transition-colors"
            >
              {sending ? 'Adding…' : `Send ${sendable} card${sendable === 1 ? '' : 's'} to singles wishlist`}
            </button>
            {sendResult && <p className="text-xs text-stone-400">{sendResult}</p>}
          </section>

          <button
            onClick={() => setConfirmDelete(true)}
            className="self-start text-xs text-red-400 hover:text-red-300 transition-colors py-2"
          >
            Delete deck idea
          </button>
        </aside>
      </div>

      {openCard && (
        <DeckCardModal
          cards={openCard.cards}
          index={openCard.index}
          groupTitle={openCard.groupTitle}
          deckName={deck.name}
          onIndexChange={index => setOpenCard({ ...openCard, index })}
          onClose={() => setOpenCard(null)}
          onWishlisted={cardId => {
            const mark = (c: DeckCard) => c.id === cardId ? { ...c, onWishlist: true } : c
            setData({ ...data, cards: data.cards.map(mark) })
            setOpenCard({ ...openCard, cards: openCard.cards.map(mark) })
          }}
        />
      )}

      {repasting && (
        <DeckIdeaModal
          deckId={deck.id}
          initialName={deck.name}
          initialSourceUrl={deck.sourceUrl}
          onClose={() => setRepasting(false)}
          onSaved={() => { setRepasting(false); load() }}
        />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={e => { if (e.target === e.currentTarget && !deleting) setConfirmDelete(false) }}
          onKeyDown={e => { if (e.key === 'Escape' && !deleting) setConfirmDelete(false) }}
        >
          <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-sm shadow-2xl p-5 flex flex-col gap-4">
            <h2 className="text-stone-100 font-semibold">Delete {deck.name}?</h2>
            <p className="text-sm text-stone-400">This can&apos;t be undone. Cards you sent to your singles wishlist stay there.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-stone-700 text-stone-300 hover:border-stone-500 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteDeck}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-950/60 border border-red-900/50 hover:border-red-700 text-red-300 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

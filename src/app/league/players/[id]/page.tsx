'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import type { CardView, playerView } from '@/lib/league/views'
import { RARITY_COLOR } from '@/components/league/LeagueModal'
import LeagueCardSheet from '@/components/league/LeagueCardSheet'
import AddToBinderModal from '@/components/league/AddToBinderModal'
import DeckUpload from '@/components/league/DeckUpload'
import TradeModal from '@/components/league/TradeModal'
import BackLink from '@/components/BackLink'
import ChangeCommanderModal from '@/components/league/ChangeCommanderModal'
import { CardImageGrid, CardViewToggle, useCardViewMode, useHoverPreview } from '@/components/CardImages'

type Player = NonNullable<ReturnType<typeof playerView>> & { binderImportEnabled: boolean }
type Tab = 'main' | 'side'
type TradeStart = { giveId?: string; getId?: string }

const TYPE_GROUPS = ['Commander', 'Planeswalkers', 'Creatures', 'Sorceries', 'Instants', 'Enchantments', 'Artifacts', 'Battles', 'Lands', 'Other'] as const

function typeGroup(c: CardView): string {
  if (c.commander) return 'Commander'
  const front = c.typeLine.split(' // ')[0]
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

function money(n: number | null) {
  return n == null ? '—' : `$${n.toFixed(2)}`
}

function stack(cards: CardView[]) {
  const map = new Map<string, { card: CardView; qty: number }>()
  for (const c of cards) {
    const key = `${c.name}|${c.origin}|${c.printing ?? ''}`
    const entry = map.get(key)
    if (entry) entry.qty++
    else map.set(key, { card: c, qty: 1 })
  }
  return [...map.values()].sort((a, b) => a.card.name.localeCompare(b.card.name))
}

export default function LeaguePlayerPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'side' ? 'side' : 'main')
  const [data, setData] = useState<Player | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openCard, setOpenCard] = useState<CardView | null>(null)
  const [binderOpen, setBinderOpen] = useState(searchParams.get('binder') === '1')
  const [changingCommander, setChangingCommander] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [trade, setTrade] = useState<TradeStart | null>(null)
  const [offerSent, setOfferSent] = useState(false)

  function toggleGroup(title: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }
  const [viewMode, setViewMode] = useCardViewMode('tnk:league-deck-view')
  const preview = useHoverPreview()

  const load = useCallback(() => {
    return fetch(`/api/league/players/${id}`)
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? 'Could not load this deck')
        setData(d)
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: 'league deck' }) })
  }, [])

  if (error) return <p className="text-red-400 text-sm">{error}</p>
  if (!data) return <p className="text-stone-500 text-sm">Loading deck…</p>

  const { member } = data
  const open = (card: CardView) => { preview.clear(); setOpenCard(card) }
  const groups = tab === 'main'
    ? TYPE_GROUPS
      .map(g => ({ title: g, cards: stack(data.main.filter(c => typeGroup(c) === g)) }))
      .filter(g => g.cards.length > 0)
    : [
      { title: 'Pulled', cards: stack(data.side.filter(c => c.origin === 'pull')) },
      { title: 'Precon · protected', cards: stack(data.side.filter(c => c.origin === 'precon')) },
    ].filter(g => g.cards.length > 0)

  const canSwap = (c: CardView) => data.isOwner && data.seasonOpen && c.zone === 'side'
  const swapOptions = stack(data.main.filter(c => !c.commander)).map(o => ({ id: o.card.id, name: o.card.name, qty: o.qty }))
  const canTradeWith = !data.isOwner && data.seasonOpen
  const tradeLabel = (c: CardView) => {
    if (!data.seasonOpen || c.commander) return null
    return data.isOwner ? 'Offer this in a trade' : `Ask ${member.name} for this`
  }
  const startTrade = (c: CardView) => {
    setOpenCard(null)
    setOfferSent(false)
    setTrade(data.isOwner ? { giveId: c.id } : { getId: c.id })
  }

  return (
    <div className="flex flex-col gap-5 min-[1800px]:mx-[calc((100%_-_min(1720px,_100vw_-_6rem))/2)] [&_button:not(:disabled)]:cursor-pointer">
      <div className="flex flex-col gap-1">
        <BackLink href="/league" label="League" />
        <h1 className="text-2xl font-bold text-stone-100">{member.name}</h1>
        <p className="text-sm text-stone-400">{member.precon} · #{member.rank} · {member.points} pts</p>
        <p className="text-sm text-stone-400">
          Main deck <span className="font-mono text-stone-200">{money(data.mainValue)}</span>
          {data.sideValue > 0 && <> · Sideboard <span className="font-mono text-stone-200">{money(data.sideValue)}</span></>}
        </p>
        {canTradeWith && (
          <button
            id="league-deck-trade"
            onClick={() => { setOfferSent(false); setTrade({}) }}
            className="self-start mt-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-950/60 border border-amber-700/50 hover:bg-amber-900/60 text-amber-200 transition-colors"
          >
            Trade with {member.name}
          </button>
        )}
        {offerSent && (
          <p className="text-sm text-green-300">
            Offer sent. {data.isOwner ? 'Your partner' : member.name} has to accept it on the <Link href="/league" className="underline">league page</Link>.
          </p>
        )}
        {data.isOwner && data.seasonEnded && (
          <button
            onClick={() => setBinderOpen(true)}
            className="self-start mt-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-amber-950/60 border-2 border-amber-700/50 hover:bg-amber-900/60 text-amber-200 transition-colors"
          >
            Add my cards to binder
          </button>
        )}
      </div>

      {changingCommander && (
        <ChangeCommanderModal
          current={data.main.filter(c => c.commander).map(c => c.name).join(', ')}
          options={data.commanderOptions}
          onClose={() => setChangingCommander(false)}
          onChanged={() => { setChangingCommander(false); load() }}
        />
      )}

      {data.canUploadDeck && data.main.length === 0 && (
        <DeckUpload onDone={load} />
      )}

      <div id="league-deck-toolbar" className="flex items-center justify-between gap-2 sm:gap-3">
        <div role="tablist" aria-label="Card pools" className="flex gap-2 min-w-0">
          {(['main', 'side'] as Tab[]).map(t => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`min-h-11 px-3 sm:px-4 rounded-lg text-sm font-semibold whitespace-nowrap border transition-colors ${tab === t ? 'bg-amber-950/70 border-amber-700/70 text-amber-200' : 'border-stone-700 text-stone-300 hover:border-stone-500'}`}
            >
              <span className="sm:hidden">{t === 'main' ? `Main · ${data.main.length}` : `Side · ${data.side.length}`}</span>
              <span className="hidden sm:inline">{t === 'main' ? `Main deck · ${data.main.length}` : `Sideboard · ${data.side.length}`}</span>
            </button>
          ))}
        </div>
        <CardViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <section className={`${data.changes.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'} flex flex-col gap-4 min-w-0`}>
          {tab === 'side' && (
            <p className="text-sm text-stone-400">
              Everything not in the main deck. Pulled cards can be taken by the Underdog Swap; precon cards are protected.
              {data.isOwner && data.seasonOpen && ' Tap a card to swap it into your deck.'}
            </p>
          )}
          {groups.length === 0 && <p className="text-sm text-stone-500">Empty for now</p>}
          <div className={viewMode === 'list' ? 'flex flex-col gap-4 min-[1800px]:block min-[1800px]:columns-2 min-[1800px]:gap-6 min-[1800px]:[&>*]:break-inside-avoid min-[1800px]:[&>*]:mb-4' : 'flex flex-col gap-4'}>
          {groups.map(g => (
            <div key={g.title} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <h3>
                  <button
                    onClick={() => toggleGroup(g.title)}
                    aria-expanded={!collapsed.has(g.title)}
                    className="flex items-center gap-2 text-xs text-stone-300 uppercase tracking-widest hover:text-stone-100 transition-colors"
                  >
                    <span aria-hidden className={`text-stone-500 transition-transform ${collapsed.has(g.title) ? '-rotate-90' : ''}`}>▾</span>
                    {g.title} <span className="text-stone-500">· {g.cards.reduce((n, c) => n + c.qty, 0)}</span>
                  </button>
                </h3>
                {g.title === 'Commander' && data.commanderOptions.length > 0 && (
                  <button onClick={() => setChangingCommander(true)} className="text-xs text-amber-500 hover:text-amber-400">
                    Change commander
                  </button>
                )}
              </div>
              {!collapsed.has(g.title) && <div className="bg-stone-900 border border-stone-800 rounded-xl">
                {viewMode === 'images' ? (
                  <CardImageGrid items={g.cards.map(({ card, qty }) => ({
                    key: card.id,
                    name: card.name,
                    imageUrl: card.imageUrl,
                    qty,
                    onClick: () => open(card),
                  }))} />
                ) : (
                  g.cards.map(({ card, qty }) => (
                    <button
                      key={card.id}
                      {...preview.bind(card.imageUrl)}
                      onClick={() => open(card)}
                      className="w-full flex items-center gap-3 px-4 py-2 border-b border-stone-800 last:border-b-0 text-sm text-left hover:bg-stone-800/50 transition-colors"
                    >
                      <span className="w-6 font-mono text-stone-500">{qty}</span>
                      <span className="flex-1 min-w-0 truncate text-stone-100">{card.name}</span>
                      {card.printing && <span className="hidden sm:inline text-xs text-stone-500 truncate max-w-40">{card.printing}</span>}
                      {tab === 'side' && <span className={`text-xs capitalize ${RARITY_COLOR[card.rarity] ?? 'text-stone-400'}`}>{card.rarity}</span>}
                      {tab === 'main' && card.origin === 'pull' && <span className="text-[11px] font-semibold text-green-300">Pull</span>}
                      <span className="w-16 text-right font-mono text-xs text-stone-300 shrink-0">{money(card.price)}</span>
                    </button>
                  ))
                )}
              </div>}
            </div>
          ))}
          </div>
        </section>

        {data.changes.length > 0 && <aside className="flex flex-col gap-2 min-w-0">
          <h2 className="text-xs text-stone-400 uppercase tracking-widest font-semibold">Changelog</h2>
          <div className="bg-stone-900 border border-stone-800 rounded-xl">
            {data.changes.map((c, i) => (
              <div key={i} className="px-4 py-2.5 border-b border-stone-800 last:border-b-0 flex flex-col gap-0.5">
                <span className="text-[11px] text-stone-500 uppercase tracking-wider">Before game {c.gameNumber} · {c.source}</span>
                <span className="text-sm"><span className="text-green-300">+ {c.added}</span> <span className="text-red-300">− {c.removed}</span></span>
              </div>
            ))}
          </div>
        </aside>}
      </div>

      {preview.element}

      {binderOpen && data.isOwner && data.seasonEnded && (
        <AddToBinderModal
          cards={[...data.main, ...data.side]}
          importEnabled={data.binderImportEnabled}
          onClose={() => setBinderOpen(false)}
          onDone={() => { setBinderOpen(false); load() }}
        />
      )}

      {trade && (
        <TradeModal
          initialPartnerId={data.isOwner ? undefined : member.id}
          initialGiveId={trade.giveId}
          initialGetId={trade.getId}
          onClose={() => setTrade(null)}
          onSaved={() => { setTrade(null); setOfferSent(true); load() }}
        />
      )}

      {openCard && (
        <LeagueCardSheet
          card={openCard}
          swapOptions={canSwap(openCard) ? swapOptions : null}
          tradeLabel={tradeLabel(openCard)}
          onTrade={() => startTrade(openCard)}
          onClose={() => setOpenCard(null)}
          onSwapped={() => { setOpenCard(null); load() }}
        />
      )}
    </div>
  )
}

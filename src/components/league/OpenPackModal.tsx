'use client'

import { useEffect, useRef, useState } from 'react'
import type { PulledCardInput } from '@/lib/league/types'
import LeagueModal, { ModalError, PrimaryButton, RARITY_COLOR, useAction } from './LeagueModal'

interface OpenPackModalProps {
  onClose: () => void
  onSaved: () => void
}

const SEARCH_DELAY_MS = 300

interface PrintingOption {
  scryfallId: string
  setCode: string
  collectorNumber: string
  label: string
  imageUrl: string | null
  finishes: string[]
  flavorName: string | null
}

type SearchResult = PulledCardInput & { collectorNumber: string; scryfallId: string }

type PackPull = PulledCardInput & { finishes?: string[] }

const isCollectorNumber = (q: string) => /^#?\d+[a-z]*$/i.test(q)

function PrintingPicker({ card, preferId, onAdd, onCancel }: {
  card: PulledCardInput
  preferId: string | null
  onAdd: (card: PackPull) => void
  onCancel: () => void
}) {
  const [printings, setPrintings] = useState<PrintingOption[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/league/printings?name=${encodeURIComponent(card.name)}`)
      .then(r => r.ok ? r.json() : [])
      .then((list: PrintingOption[]) => {
        setPrintings(list)
        const preferred = list.find(p => p.scryfallId === preferId)
        setSelected(preferred?.scryfallId ?? list[0]?.scryfallId ?? null)
      })
  }, [card.name, preferId])

  const pick = printings?.find(p => p.scryfallId === selected)
  const foilOnly = !!pick && pick.finishes.includes('foil') && !pick.finishes.includes('nonfoil')

  return (
    <div className="flex flex-col gap-3 bg-stone-950 border border-stone-800 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-stone-100">Which printing of {card.displayName ?? card.name}?</p>
        <button type="button" onClick={onCancel} className="text-xs text-stone-400 hover:text-stone-200">Cancel</button>
      </div>
      {!printings ? (
        <p className="text-xs text-stone-500">Loading printings…</p>
      ) : printings.length === 0 ? (
        <p className="text-xs text-stone-500">No Star Trek printings found. It will be added without one.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto">
          {printings.map(p => (
            <button
              key={p.scryfallId}
              type="button"
              aria-pressed={p.scryfallId === selected}
              onClick={() => setSelected(p.scryfallId)}
              className={`flex flex-col rounded-lg overflow-hidden border text-left transition-colors ${p.scryfallId === selected ? 'border-amber-500' : 'border-stone-700 hover:border-stone-500'}`}
            >
              {p.imageUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={p.imageUrl} alt="" loading="lazy" className="w-full aspect-[5/7] object-cover" />
                : <div className="aspect-[5/7] bg-stone-800" />}
              <span className="px-1.5 py-1 bg-stone-800 text-[11px] text-stone-300 truncate">{p.label} · #{p.collectorNumber}</span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        disabled={!printings}
        onClick={() => onAdd(pick ? {
          ...card,
          displayName: pick.flavorName ?? card.displayName,
          imageUrl: pick.imageUrl,
          finishes: pick.finishes,
          printing: { scryfallId: pick.scryfallId, setCode: pick.setCode, collectorNumber: pick.collectorNumber, label: pick.label, foil: foilOnly },
        } : card)}
        className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-amber-950/60 border border-amber-700/50 text-amber-200 disabled:opacity-50"
      >
        Add card
      </button>
    </div>
  )
}

export default function OpenPackModal({ onClose, onSaved }: OpenPackModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [pulls, setPulls] = useState<PackPull[]>([])
  const [choosing, setChoosing] = useState<PulledCardInput | null>(null)
  const [preferId, setPreferId] = useState<string | null>(null)
  const [nameOpen, setNameOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkNote, setBulkNote] = useState<string | null>(null)
  const { busy, error, run } = useAction(onSaved)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function search(value: string) {
    setQuery(value)
    if (timer.current) clearTimeout(timer.current)
    const q = value.trim()
    if (q.length < 2 && !isCollectorNumber(q)) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    timer.current = setTimeout(() => {
      fetch(`/api/league/card-search?q=${encodeURIComponent(q)}`)
        .then(r => r.ok ? r.json() : [])
        .then(setResults)
        .finally(() => setSearching(false))
    }, SEARCH_DELAY_MS)
  }

  function add(card: PackPull) {
    setPulls([...pulls, card])
    setChoosing(null)
  }

  function toggleFoil(index: number) {
    setPulls(pulls.map((p, i) => i === index && p.printing ? { ...p, printing: { ...p.printing, foil: !p.printing.foil } } : p))
  }

  async function addNumbers() {
    const numbers = bulkText.split(/[\s,]+/).filter(Boolean)
    if (numbers.length === 0) return
    setBulkBusy(true)
    setBulkNote(null)
    try {
      const res = await fetch('/api/league/card-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numbers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Card lookup failed')
      const { cards, notFound } = data as { cards: PackPull[]; notFound: string[] }
      setPulls(current => [...current, ...cards])
      setBulkText(notFound.join(' '))
      setBulkNote(notFound.length ? `Not found: ${notFound.map(n => `#${n.replace(/^#/, '')}`).join(', ')}. Fix and add again.` : null)
    } catch (e) {
      setBulkNote(e instanceof Error ? e.message : String(e))
    } finally {
      setBulkBusy(false)
    }
  }

  function choose(result: SearchResult) {
    setPreferId(isCollectorNumber(query.trim()) ? result.scryfallId : null)
    setChoosing(result)
    search('')
  }

  return (
    <LeagueModal title="Open a pack" size="lg" busy={busy} onClose={onClose}>
      <ModalError error={error} />

      <div id="pull-bulk" className="flex flex-col gap-1.5">
        <label htmlFor="pull-numbers" className="text-xs text-stone-500 uppercase tracking-wider">Add pulled cards by collector number · Star Trek</label>
        <textarea
          id="pull-numbers"
          value={bulkText}
          onChange={e => setBulkText(e.target.value)}
          rows={3}
          placeholder="e.g. 42 105 7 230"
          className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-base text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600"
        />
        <p className="text-xs text-stone-500">Type the numbers as printed. Stardates or Commander card? Add sds or trc after the number, like 12sds.</p>
        {bulkNote && <p className="text-xs text-amber-400">{bulkNote}</p>}
        <button
          type="button"
          onClick={addNumbers}
          disabled={bulkBusy || !bulkText.trim()}
          className="w-full sm:w-auto sm:self-end min-h-10 px-4 rounded-lg text-sm font-semibold bg-amber-950/60 border border-amber-700/50 text-amber-200 disabled:opacity-50"
        >
          {bulkBusy ? 'Adding…' : 'Add cards'}
        </button>
      </div>

      {!nameOpen ? (
        <button type="button" onClick={() => setNameOpen(true)} className="self-start min-h-9 text-sm text-amber-400 hover:text-amber-300">
          Add by name ▸
        </button>
      ) : (
        <div className="flex flex-col gap-1">
          <label htmlFor="pull-search" className="text-xs text-stone-500 uppercase tracking-wider">Add by name</label>
          <input
            id="pull-search"
            value={query}
            onChange={e => search(e.target.value)}
            placeholder="Card name or collector # (42 or 042)"
            autoComplete="off"
            className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-base text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600"
          />
          {searching && <p className="text-xs text-stone-500">Searching…</p>}
          {results.length > 0 && (
            <div className="bg-stone-950 border border-stone-800 rounded-lg">
              {results.map((r, i) => (
                <button
                  key={`${r.name}-${i}`}
                  type="button"
                  onClick={() => choose(r)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-stone-200 text-left border-b border-stone-900 last:border-b-0 hover:bg-stone-900"
                >
                  <span className="truncate">{r.displayName ?? r.name}{isCollectorNumber(query.trim()) && <span className="text-stone-400"> · #{r.collectorNumber}</span>}</span>
                  <span className={`text-xs capitalize shrink-0 ${RARITY_COLOR[r.rarity] ?? 'text-stone-400'}`}>{r.rarity} · Add</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {choosing && <PrintingPicker card={choosing} preferId={preferId} onAdd={add} onCancel={() => setChoosing(null)} />}

      <div className="flex flex-col gap-2">
        <p className="text-xs text-stone-500 uppercase tracking-wider">In this pack · {pulls.length} cards</p>
        <div id="pack-pulls" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {pulls.map((p, i) => {
            const finishes = p.finishes ?? []
            const canFoil = finishes.includes('foil')
            const foilOnly = canFoil && !finishes.includes('nonfoil')
            const isFoil = p.printing?.foil ?? false
            return (
              <div key={`${p.name}-${i}`} className="flex flex-col gap-1 min-w-0">
                <div className="relative">
                  {p.imageUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.imageUrl} alt={p.displayName ?? p.name} className="w-full aspect-[5/7] rounded-lg object-cover bg-stone-800" />
                    : <div className="w-full aspect-[5/7] rounded-lg bg-stone-800" />}
                  <button
                    type="button"
                    onClick={() => setPulls(pulls.filter((_, j) => j !== i))}
                    aria-label={`Remove ${p.name}`}
                    className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-stone-950/85 border border-stone-700 text-stone-300 hover:text-stone-100"
                  >
                    ✕
                  </button>
                </div>
                <span className="text-xs text-stone-200 truncate">{p.displayName ?? p.name}</span>
                <span className="text-[11px] text-stone-400 truncate">
                  {p.printing ? `#${p.printing.collectorNumber}${p.printing.label !== 'Regular' ? ` · ${p.printing.label}` : ''} · ` : ''}
                  <span className={`capitalize ${RARITY_COLOR[p.rarity] ?? 'text-stone-400'}`}>{p.rarity}</span>
                </span>
                {canFoil && p.printing && (
                  <button
                    type="button"
                    aria-pressed={isFoil}
                    onClick={() => toggleFoil(i)}
                    disabled={foilOnly}
                    className={`self-start min-h-8 px-2.5 rounded-full border text-xs ${isFoil ? 'border-amber-600 bg-amber-950/60 text-amber-200' : 'border-stone-700 text-stone-400 hover:text-stone-200'} disabled:cursor-default`}
                  >
                    {isFoil ? '★ Foil' : 'Foil'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-stone-500">Logging every card is optional. Cards go to your sideboard; swap them into your deck from your deck page.</p>
      </div>

      <PrimaryButton onClick={() => run({ action: 'openPack', kind: 'weekly', pulls })} disabled={busy || bulkBusy || !!choosing}>
        {busy ? 'Saving…' : 'Save pack'}
      </PrimaryButton>
    </LeagueModal>
  )
}

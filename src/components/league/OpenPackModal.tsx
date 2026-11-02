'use client'

import { useEffect, useRef, useState } from 'react'
import type { PackKind, PulledCardInput } from '@/lib/league/types'
import LeagueModal, { Chip, ModalError, PrimaryButton, RARITY_COLOR, useAction } from './LeagueModal'

interface OpenPackModalProps {
  openPacks: { kind: PackKind; left: number }[]
  onClose: () => void
  onSaved: () => void
}

const KIND_LABEL: Record<PackKind, string> = {
  opening: 'Opening night',
  weekly: 'Weekly',
  reserve: 'Catch-up reserve',
  prize: 'Season prize',
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

function PrintingPicker({ card, onAdd, onCancel }: {
  card: PulledCardInput
  onAdd: (card: PulledCardInput) => void
  onCancel: () => void
}) {
  const [printings, setPrintings] = useState<PrintingOption[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [foil, setFoil] = useState(false)

  useEffect(() => {
    fetch(`/api/league/printings?name=${encodeURIComponent(card.name)}`)
      .then(r => r.ok ? r.json() : [])
      .then((list: PrintingOption[]) => {
        setPrintings(list)
        setSelected(list[0]?.scryfallId ?? null)
      })
  }, [card.name])

  const pick = printings?.find(p => p.scryfallId === selected)
  const canFoil = pick?.finishes.includes('foil') ?? false
  const foilOnly = !!pick && canFoil && !pick.finishes.includes('nonfoil')
  const isFoil = foilOnly || (canFoil && foil)

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
      {canFoil && (
        <label className="flex items-center gap-2 text-sm text-stone-300">
          <input type="checkbox" checked={isFoil} disabled={foilOnly} onChange={e => setFoil(e.target.checked)} className="accent-amber-600" />
          Foil{foilOnly ? ' (only comes in foil)' : ''}
        </label>
      )}
      <button
        type="button"
        disabled={!printings}
        onClick={() => onAdd(pick ? {
          ...card,
          displayName: pick.flavorName ?? card.displayName,
          imageUrl: pick.imageUrl,
          printing: { scryfallId: pick.scryfallId, setCode: pick.setCode, collectorNumber: pick.collectorNumber, label: pick.label, foil: isFoil },
        } : card)}
        className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-amber-950/60 border border-amber-700/50 text-amber-200 disabled:opacity-50"
      >
        Add card
      </button>
    </div>
  )
}

export default function OpenPackModal({ openPacks, onClose, onSaved }: OpenPackModalProps) {
  const [kind, setKind] = useState<PackKind | null>(openPacks[0]?.kind ?? null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PulledCardInput[]>([])
  const [searching, setSearching] = useState(false)
  const [pulls, setPulls] = useState<PulledCardInput[]>([])
  const [choosing, setChoosing] = useState<PulledCardInput | null>(null)
  const { busy, error, run } = useAction(onSaved)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function search(value: string) {
    setQuery(value)
    if (timer.current) clearTimeout(timer.current)
    const q = value.trim()
    if (q.length < 2) {
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

  function add(card: PulledCardInput) {
    setPulls([...pulls, card])
    setChoosing(null)
  }

  function choose(card: PulledCardInput) {
    setChoosing(card)
    search('')
  }

  return (
    <LeagueModal title="Open a pack" busy={busy} onClose={onClose}>
      <ModalError error={error} />

      {openPacks.length === 0 ? (
        <p className="text-sm text-stone-400">You have no packs left to open right now.</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-stone-500 uppercase tracking-wider">Which pack</p>
            <div className="flex flex-wrap gap-2">
              {openPacks.map(p => (
                <Chip key={p.kind} active={kind === p.kind} onClick={() => setKind(p.kind)}>
                  {KIND_LABEL[p.kind]} · {p.left} left
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="pull-search" className="text-xs text-stone-500 uppercase tracking-wider">Add pulled cards · Star Trek</label>
            <input
              id="pull-search"
              value={query}
              onChange={e => search(e.target.value)}
              placeholder="Card name"
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
                    <span className="truncate">{r.displayName ?? r.name}</span>
                    <span className={`text-xs capitalize shrink-0 ${RARITY_COLOR[r.rarity] ?? 'text-stone-400'}`}>{r.rarity} · Add</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {choosing && <PrintingPicker card={choosing} onAdd={add} onCancel={() => setChoosing(null)} />}

          <div className="flex flex-col gap-2">
            <p className="text-xs text-stone-500 uppercase tracking-wider">In this pack · {pulls.length} cards</p>
            <div className="flex flex-wrap gap-1.5">
              {pulls.map((p, i) => (
                <span key={`${p.name}-${i}`} className="inline-flex items-center gap-1.5 text-xs pl-3 pr-1 py-1 rounded-full border border-stone-700 text-stone-200">
                  {p.displayName ?? p.name}
                  {p.printing && <span className="text-stone-400">{p.printing.label}{p.printing.foil ? ' · foil' : ''}</span>}
                  <span className={`capitalize ${RARITY_COLOR[p.rarity] ?? 'text-stone-400'}`}>{p.rarity}</span>
                  <button
                    type="button"
                    onClick={() => setPulls(pulls.filter((_, j) => j !== i))}
                    aria-label={`Remove ${p.name}`}
                    className="w-6 h-6 rounded-full bg-stone-800 text-stone-400 hover:text-stone-200"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <p className="text-xs text-stone-500">Logging every card is optional. Cards go to your sideboard; swap them into your deck from your deck page.</p>
          </div>

          <PrimaryButton onClick={() => run({ action: 'openPack', kind, pulls })} disabled={busy || !kind || !!choosing}>
            {busy ? 'Saving…' : 'Save pack'}
          </PrimaryButton>
        </>
      )}
    </LeagueModal>
  )
}

'use client'

import { useCallback, useState } from 'react'

export type CardViewMode = 'list' | 'images'

export function useCardViewMode(storageKey: string) {
  const [mode, setModeState] = useState<CardViewMode>(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(storageKey) === 'images' ? 'images' : 'list'
    } catch {
      return 'list'
    }
  })

  const setMode = useCallback((next: CardViewMode) => {
    setModeState(next)
    try { localStorage.setItem(storageKey, next) } catch {}
  }, [storageKey])

  return [mode, setMode] as const
}

export function CardViewToggle({ mode, onChange }: { mode: CardViewMode; onChange: (mode: CardViewMode) => void }) {
  return (
    <div className="flex bg-stone-900 border border-stone-800 rounded-lg p-0.5" role="group" aria-label="Show cards as">
      {(['list', 'images'] as CardViewMode[]).map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          aria-pressed={mode === m}
          className={`text-xs font-semibold rounded-md px-3 py-1.5 transition-colors ${mode === m ? 'bg-stone-700 text-stone-100' : 'text-stone-400 hover:text-stone-200'}`}
        >
          {m === 'list' ? 'List' : 'Images'}
        </button>
      ))}
    </div>
  )
}

const PREVIEW_WIDTH = 244
const PREVIEW_HEIGHT = 340
const CURSOR_GAP = 16

function canHover() {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

export function useHoverPreview() {
  const [preview, setPreview] = useState<{ url: string; x: number; y: number } | null>(null)

  const bind = useCallback((url: string | null | undefined) => {
    if (!url) return {}
    const place = (e: React.MouseEvent) => {
      if (!canHover()) return
      const flipX = e.clientX + CURSOR_GAP + PREVIEW_WIDTH > window.innerWidth
      const x = flipX ? e.clientX - CURSOR_GAP - PREVIEW_WIDTH : e.clientX + CURSOR_GAP
      const y = Math.min(Math.max(8, e.clientY - PREVIEW_HEIGHT / 2), window.innerHeight - PREVIEW_HEIGHT - 8)
      setPreview({ url, x, y })
    }
    return { onMouseEnter: place, onMouseMove: place, onMouseLeave: () => setPreview(null) }
  }, [])

  const element = preview ? (
    <div
      aria-hidden
      className="fixed z-[60] pointer-events-none rounded-xl overflow-hidden shadow-2xl border border-stone-700 bg-stone-900"
      style={{ left: preview.x, top: preview.y, width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview.url} alt="" className="w-full h-full object-cover" />
    </div>
  ) : null

  return { bind, element, clear: () => setPreview(null) }
}

export interface ImageGridItem {
  key: string
  name: string
  imageUrl: string | null
  qty?: number
  caption?: React.ReactNode
  onClick: () => void
}

export function CardImageGrid({ items }: { items: ImageGridItem[] }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 min-[1800px]:grid-cols-8 gap-2 p-3">
      {items.map(item => (
        <button
          key={item.key}
          onClick={item.onClick}
          aria-label={item.qty && item.qty > 1 ? `${item.qty} × ${item.name}` : item.name}
          className="group flex flex-col gap-1 text-left min-w-0"
        >
          <div className="relative w-full aspect-[5/7] bg-stone-800 rounded-lg overflow-hidden border border-stone-800 group-hover:border-amber-700/70 transition-colors">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-stone-400">{item.name}</span>
            )}
            {item.qty != null && item.qty > 1 && (
              <span className="absolute top-1.5 left-1.5 text-[11px] font-bold font-mono bg-stone-950/85 text-stone-100 rounded px-1.5 py-0.5">{item.qty}×</span>
            )}
          </div>
          {item.caption && <div className="text-[11px] text-stone-400 truncate px-0.5">{item.caption}</div>}
        </button>
      ))}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'

interface Face {
  name: string
  text: string
}

interface ScryfallCardText {
  oracle_text?: string
  card_faces?: { name: string; oracle_text?: string }[]
}

const cache = new Map<string, Face[]>()

function toFaces(card: ScryfallCardText): Face[] {
  if (card.oracle_text) return [{ name: '', text: card.oracle_text }]
  return (card.card_faces ?? [])
    .filter(f => f.oracle_text)
    .map(f => ({ name: f.name, text: f.oracle_text! }))
}

export default function OracleText({ name }: { name: string }) {
  const [loaded, setLoaded] = useState<{ name: string; faces: Face[] | null } | null>(null)

  useEffect(() => {
    if (cache.has(name)) return
    let cancelled = false
    fetch(`/api/card?q=${encodeURIComponent(name)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return
        const faces = data?.card ? toFaces(data.card) : null
        if (faces) cache.set(name, faces)
        setLoaded({ name, faces })
      })
      .catch(() => { if (!cancelled) setLoaded({ name, faces: null }) })
    return () => { cancelled = true }
  }, [name])

  const cached = cache.get(name)
  const result = loaded?.name === name ? loaded : null
  const faces = cached ?? result?.faces
  const failed = !cached && result != null && result.faces == null

  if (failed) return null
  if (!faces) {
    return (
      <div id="oracle-text-loading" role="status" className="flex flex-col gap-2 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5">
        <span className="text-xs text-stone-400">Loading card text…</span>
        <span className="h-3 w-full rounded bg-stone-800 animate-pulse" />
        <span className="h-3 w-4/5 rounded bg-stone-800 animate-pulse" />
        <span className="h-3 w-3/5 rounded bg-stone-800 animate-pulse" />
      </div>
    )
  }
  if (faces.length === 0) return null

  return (
    <div id="oracle-text" className="flex flex-col gap-2 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-sm text-stone-200">
      {faces.map((f, i) => (
        <div key={i} className="flex flex-col gap-1">
          {f.name && <p className="text-[11px] text-stone-500 uppercase tracking-wider">{f.name}</p>}
          {f.text.split('\n').map((line, j) => <p key={j} className="leading-snug">{line}</p>)}
        </div>
      ))}
    </div>
  )
}

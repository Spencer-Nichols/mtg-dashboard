'use client'

import { useEffect, useState } from 'react'

interface LeagueModalProps {
  title: string
  wide?: boolean
  size?: 'lg'
  busy?: boolean
  onClose: () => void
  children: React.ReactNode
}

export default function LeagueModal({ title, wide, size, busy, onClose, children }: LeagueModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70"
      onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}
    >
      <div
        role="dialog"
        aria-label={title}
        className={`bg-stone-900 border border-stone-700 rounded-t-2xl sm:rounded-2xl w-full ${wide ? 'sm:max-w-4xl' : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl'} max-h-[90vh] flex flex-col shadow-2xl`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 shrink-0">
          <h2 className="text-stone-100 font-semibold truncate pr-4">{title}</h2>
          <button onClick={onClose} disabled={busy} aria-label="Close" className="text-stone-500 hover:text-stone-300 transition-colors text-xl leading-none shrink-0 disabled:opacity-50">✕</button>
        </div>
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

export function ModalError({ error }: { error: string | null }) {
  if (!error) return null
  return <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{error}</p>
}

export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-amber-950/60 border border-amber-700/50 hover:bg-amber-900/60 text-amber-200 disabled:opacity-50 transition-colors"
    >
      {children}
    </button>
  )
}

export function Chip({ active, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...props}
      className={`px-3 py-2 rounded-full text-xs font-semibold border transition-colors disabled:opacity-40 ${active ? 'bg-amber-950/70 border-amber-700/70 text-amber-200' : 'border-stone-700 text-stone-300 hover:border-stone-500'}`}
    >
      {children}
    </button>
  )
}

export async function leagueAction(body: Record<string, unknown>) {
  const res = await fetch('/api/league', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
}

export function useAction(onDone: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      await leagueAction(body)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }
  return { busy, error, run }
}

export const RARITY_COLOR: Record<string, string> = {
  mythic: 'text-orange-300',
  rare: 'text-amber-200',
  uncommon: 'text-slate-300',
  common: 'text-stone-400',
}

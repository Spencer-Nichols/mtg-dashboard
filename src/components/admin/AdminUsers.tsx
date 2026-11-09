'use client'

import { useState } from 'react'

export interface AdminUser {
  id: string
  email: string
  lastSeen: string | null
  lastSeenPage: string | null
  createdAt: string
  cardCount: number
  sealedCount: number
  wishlistCount: number
  unlimitedBinder: boolean
  proxyAccess: boolean
  isAdmin: boolean
  leagueSeat: { name: string; role: 'player' | 'commissioner' } | null
  lastLeagueVisit: string | null
}

interface SealedItem {
  id: string
  product_name: string
  set_name: string
  snapshot_price: number | null
}

type Flag = 'proxyAccess' | 'unlimitedBinder'
type Filter = 'all' | 'week' | 'proxies' | 'binder' | 'league'

const FLAG_LABEL: Record<Flag, string> = { proxyAccess: 'proxy access', unlimitedBinder: 'unlimited binder' }
const FLAG_EFFECT: Record<Flag, string> = {
  proxyAccess: 'Their decks stay, but the Proxies page disappears for them.',
  unlimitedBinder: 'Their cards stay, but they go back to the normal binder limit.',
}
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const GRID = 'sm:grid sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_4.5rem_4.5rem_4rem_5.5rem_5.5rem] sm:gap-3 sm:items-center'

export function formatRelativeTime(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function count(n: number) {
  return n > 0 ? n.toLocaleString() : '—'
}

function Switch({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={e => { e.stopPropagation(); onClick() }}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${on ? 'bg-amber-500' : 'bg-stone-700'}`}
    >
      <span className={`absolute h-[18px] w-[18px] rounded-full transition-all ${on ? 'left-[23px] bg-stone-950' : 'left-[3px] bg-stone-400'}`} />
    </button>
  )
}

export default function AdminUsers({ users, setUsers }: { users: AdminUser[]; setUsers: React.Dispatch<React.SetStateAction<AdminUser[]>> }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [openUser, setOpenUser] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<{ userId: string; flag: Flag } | null>(null)
  const [userSealed, setUserSealed] = useState<Record<string, SealedItem[] | 'loading'>>({})
  const [weekAgo] = useState(() => Date.now() - WEEK_MS)

  async function setFlag(userId: string, flag: Flag, value: boolean) {
    setConfirming(null)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, [flag]: value } : u))
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, [flag]: value }),
    })
    if (!res.ok) {
      console.error('Admin flag update failed', { userId, flag, status: res.status })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, [flag]: !value } : u))
    }
  }

  function requestFlag(user: AdminUser, flag: Flag) {
    if (user[flag]) setConfirming({ userId: user.id, flag })
    else setFlag(user.id, flag, true)
  }

  async function toggleOpen(userId: string) {
    const next = openUser === userId ? null : userId
    setOpenUser(next)
    setConfirming(null)
    if (!next || userSealed[next] !== undefined) return
    const user = users.find(u => u.id === next)
    if (!user || user.sealedCount === 0) return
    setUserSealed(prev => ({ ...prev, [next]: 'loading' }))
    const res = await fetch(`/api/admin/user-sealed?userId=${next}`)
    const data = res.ok ? await res.json() : []
    setUserSealed(prev => ({ ...prev, [next]: data }))
  }

  const isActive = (u: AdminUser) => !!u.lastSeen && new Date(u.lastSeen).getTime() > weekAgo
  const filters: { key: Filter; label: string; match: (u: AdminUser) => boolean }[] = [
    { key: 'all', label: 'All', match: () => true },
    { key: 'week', label: 'Active this week', match: isActive },
    { key: 'proxies', label: 'Proxies', match: u => u.proxyAccess },
    { key: 'binder', label: 'Unlimited binder', match: u => u.unlimitedBinder },
    { key: 'league', label: 'League', match: u => !!u.leagueSeat },
  ]
  const activeFilter = filters.find(f => f.key === filter)!
  const term = search.trim().toLowerCase()
  const shown = users
    .filter(u => activeFilter.match(u) && (!term || u.email.toLowerCase().includes(term)))
    .sort((a, b) => (b.lastSeen ?? b.createdAt) > (a.lastSeen ?? a.createdAt) ? 1 : -1)

  function badges(u: AdminUser) {
    return [
      u.isAdmin && 'Admin',
      u.leagueSeat && `League · ${u.leagueSeat.name}${u.leagueSeat.role === 'commissioner' ? ' (commissioner)' : ''}`,
    ].filter(Boolean).join(' · ')
  }

  function confirmBox(u: AdminUser) {
    if (confirming?.userId !== u.id) return null
    const { flag } = confirming
    return (
      <div role="alert" onClick={e => e.stopPropagation()} className="sm:col-span-7 flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2.5">
        <p className="flex-1 text-sm text-red-200">Remove {FLAG_LABEL[flag]} for {u.email}? {FLAG_EFFECT[flag]}</p>
        <div className="flex gap-2">
          <button onClick={() => setFlag(u.id, flag, false)} className="flex-1 sm:flex-none min-h-11 sm:min-h-9 px-4 rounded-lg border border-red-700 bg-red-950 text-red-100 text-sm font-semibold cursor-pointer">Remove</button>
          <button onClick={() => setConfirming(null)} className="flex-1 sm:flex-none min-h-11 sm:min-h-9 px-4 rounded-lg border border-stone-700 text-stone-300 text-sm cursor-pointer">Cancel</button>
        </div>
      </div>
    )
  }

  function details(u: AdminUser) {
    const sealed = userSealed[u.id]
    return (
      <div className="sm:col-span-7 flex flex-col gap-2 text-xs text-stone-400">
        <p>
          Joined {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {u.lastLeagueVisit && <> · Last league visit {formatRelativeTime(u.lastLeagueVisit)}</>}
        </p>
        {sealed === 'loading' && <p className="text-stone-500">Loading sealed wishlist…</p>}
        {Array.isArray(sealed) && sealed.length > 0 && (
          <ul className="flex flex-col gap-1">
            {sealed.map(item => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <span className="truncate min-w-0 text-stone-300">{item.product_name}</span>
                {item.snapshot_price != null && <span className="font-mono text-stone-500 shrink-0">${item.snapshot_price.toFixed(2)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div id="admin-users-list">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 px-4 sm:px-5 py-3.5 border-b border-stone-800">
        <label htmlFor="admin-user-search" className="sr-only">Search users</label>
        <input
          id="admin-user-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by email"
          className="sm:flex-1 sm:min-w-56 h-11 sm:h-10 bg-stone-800 border border-stone-700 rounded-lg px-3 text-base sm:text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-600"
        />
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          {filters.map(f => {
            const active = f.key === filter
            return (
              <button
                key={f.key}
                aria-pressed={active}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 h-9 px-3 rounded-full text-xs border transition-colors cursor-pointer ${active ? 'bg-amber-950/70 border-amber-700/70 text-amber-200 font-semibold' : 'border-stone-700 text-stone-300 hover:border-stone-500'}`}
              >
                {f.label} {users.filter(f.match).length}
              </button>
            )
          })}
        </div>
      </div>

      <div role="table" aria-label="Users">
        <div role="row" className={`hidden ${GRID} px-5 py-2.5 border-b border-stone-800 text-[11px] uppercase tracking-wider text-stone-500`}>
          <span role="columnheader">User</span>
          <span role="columnheader">Last seen</span>
          <span role="columnheader" className="text-right">Cards</span>
          <span role="columnheader" className="text-right">Wishlist</span>
          <span role="columnheader" className="text-right">Sealed</span>
          <span role="columnheader" className="text-center">Proxies</span>
          <span role="columnheader" className="text-center">∞ Binder</span>
        </div>

        {shown.length === 0 && <p className="px-5 py-4 text-sm text-stone-500">No users match.</p>}

        {shown.map(u => {
          const open = openUser === u.id
          const seen = u.lastSeen ? `${formatRelativeTime(u.lastSeen)}${u.lastSeenPage ? ` · ${u.lastSeenPage}` : ''}` : 'never'
          const note = badges(u)
          return (
            <div key={u.id} role="row" className={`border-b border-stone-800 last:border-0 ${open ? 'bg-stone-950/50' : ''}`}>
              <div
                onClick={() => toggleOpen(u.id)}
                className={`${GRID} px-4 sm:px-5 py-3 cursor-pointer hover:bg-stone-800/30 transition-colors`}
              >
                <button aria-expanded={open} onClick={e => { e.stopPropagation(); toggleOpen(u.id) }} className="w-full min-w-0 flex flex-col text-left cursor-pointer">
                  <span className={`text-sm truncate ${open ? 'text-amber-200 font-semibold' : 'text-stone-200'}`}>{u.email}</span>
                  {note && <span className="text-xs text-stone-500 truncate">{note}</span>}
                  <span className="sm:hidden text-xs text-stone-500 font-mono">{seen}</span>
                </button>
                <span role="cell" className="hidden sm:block text-xs text-stone-500 font-mono truncate">{seen}</span>
                <span role="cell" className="hidden sm:block text-right text-sm font-mono text-stone-300">{count(u.cardCount)}</span>
                <span role="cell" className="hidden sm:block text-right text-sm font-mono text-stone-300">{count(u.wishlistCount)}</span>
                <span role="cell" className="hidden sm:block text-right text-sm font-mono text-stone-300">{count(u.sealedCount)}</span>
                <span role="cell" className="hidden sm:flex justify-center"><Switch on={u.proxyAccess} label={`Proxy access for ${u.email}`} onClick={() => requestFlag(u, 'proxyAccess')} /></span>
                <span role="cell" className="hidden sm:flex justify-center"><Switch on={u.unlimitedBinder} label={`Unlimited binder for ${u.email}`} onClick={() => requestFlag(u, 'unlimitedBinder')} /></span>
              </div>

              <div className="hidden sm:grid sm:grid-cols-7 gap-2 px-5 empty:hidden [&:not(:empty)]:pb-3">
                {confirmBox(u)}
                {open && details(u)}
              </div>

              {open && (
                <div className="sm:hidden flex flex-col gap-3 px-4 pb-4">
                  <div className="grid grid-cols-3 gap-2">
                    {([['cards', u.cardCount], ['wishlist', u.wishlistCount], ['sealed', u.sealedCount]] as const).map(([label, n]) => (
                      <div key={label} className="bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-2 flex flex-col">
                        <span className="text-base font-semibold font-mono text-stone-100">{count(n)}</span>
                        <span className="text-[11px] text-stone-500">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between min-h-11 text-sm text-stone-200">Proxy builder <Switch on={u.proxyAccess} label={`Proxy access for ${u.email}`} onClick={() => requestFlag(u, 'proxyAccess')} /></div>
                  <div className="flex items-center justify-between min-h-11 text-sm text-stone-200">Unlimited binder <Switch on={u.unlimitedBinder} label={`Unlimited binder for ${u.email}`} onClick={() => requestFlag(u, 'unlimitedBinder')} /></div>
                  {confirmBox(u)}
                  {details(u)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'

interface AccessRequest {
  id: string
  email: string
  created_at: string
  status: string
}

interface AdminUser {
  id: string
  email: string
  lastSeen: string | null
  createdAt: string
  cardCount: number
}

function formatRelativeTime(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])

  useEffect(() => {
    fetch('/api/admin/requests')
      .then(r => r.json())
      .then(data => { setRequests(data); setLoading(false) })
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setUsers(data) })
  }, [])

  async function sendInvite(id: string, email: string) {
    setPendingAction(id)
    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, email }),
    })
    if (res.ok) {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r))
    }
    setPendingAction(null)
  }

  async function denyRequest(id: string) {
    setPendingAction(id)
    const res = await fetch('/api/admin/invite', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'denied' }),
    })
    if (res.ok) {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'denied' } : r))
    }
    setPendingAction(null)
  }

  const pending = requests.filter(r => r.status === 'pending')
  const handled = requests.filter(r => r.status !== 'pending')

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-stone-100">Access Requests</h1>
        <p className="text-sm text-stone-500 mt-1">Review and approve requests to join TapNTrack.</p>
      </div>

      {loading ? (
        <p className="text-sm text-stone-600">Loading…</p>
      ) : pending.length === 0 ? (
        <div className="bg-stone-900 border border-stone-800 rounded-xl px-5 py-8 text-center">
          <p className="text-stone-500 text-sm">No pending requests</p>
        </div>
      ) : (
        <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
          {pending.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-4 px-5 py-4 border-b border-stone-800 last:border-0">
              <div>
                <p className="text-stone-200 font-medium">{r.email}</p>
                <p className="text-xs text-stone-600">{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => denyRequest(r.id)}
                  disabled={pendingAction === r.id}
                  className="text-xs px-3 py-1.5 rounded border border-stone-700 text-stone-500 hover:border-red-800 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  Deny
                </button>
                <button
                  onClick={() => sendInvite(r.id, r.email)}
                  disabled={pendingAction === r.id}
                  className="text-xs px-3 py-1.5 rounded border border-amber-700 text-amber-400 hover:bg-amber-950/40 transition-colors disabled:opacity-50"
                >
                  {pendingAction === r.id ? 'Sending…' : 'Send invite'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {handled.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-stone-600 uppercase tracking-wider">Previously handled</p>
          <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
            {handled.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-4 px-5 py-3 border-b border-stone-800 last:border-0">
                <p className="text-stone-500 text-sm">{r.email}</p>
                <span className={`text-xs px-2 py-0.5 rounded font-mono ${r.status === 'approved' ? 'text-green-400 bg-green-950/40' : 'text-red-400 bg-red-950/40'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {users.length > 0 && (
        <div id="admin-users" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-stone-600 uppercase tracking-wider">Users</p>
            <p className="text-xs text-stone-500 font-mono">
              {users.reduce((sum, u) => sum + u.cardCount, 0).toLocaleString()} cards total
            </p>
          </div>
          <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
            {users.sort((a, b) => (b.lastSeen ?? b.createdAt) > (a.lastSeen ?? a.createdAt) ? 1 : -1).map(u => (
              <div key={u.id} className="flex items-center justify-between gap-4 px-5 py-3 border-b border-stone-800 last:border-0">
                <p className="text-stone-300 text-sm">{u.email}</p>
                <div className="flex items-center gap-3 shrink-0">
                  {u.cardCount > 0 && (
                    <span className="text-xs text-stone-600 font-mono">{u.cardCount.toLocaleString()} cards</span>
                  )}
                  <span className="text-xs text-stone-600 font-mono">
                    {u.lastSeen ? formatRelativeTime(u.lastSeen) : 'never'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import AdminLeagueMembers from '@/components/league/AdminLeagueMembers'
import AdminLeagueSettings from '@/components/league/AdminLeagueSettings'
import AdminLeagueWipe from '@/components/league/AdminLeagueWipe'
import AdminUsers, { type AdminUser } from '@/components/admin/AdminUsers'

interface AccessRequest {
  id: string
  email: string
  created_at: string
  status: string
}

function AdminSection({ id, title, meta, openOnDesktop, children }: {
  id: string
  title: string
  meta?: React.ReactNode
  openOnDesktop?: boolean
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const isDesktop = window.matchMedia('(min-width: 640px)').matches
    if (openOnDesktop && isDesktop && ref.current) ref.current.open = true
  }, [openOnDesktop])

  return (
    <details ref={ref} id={id} className="group bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
      <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-3 px-5 py-3.5 cursor-pointer hover:bg-stone-800/40 transition-colors">
        <h2 className="text-base font-bold text-stone-100">{title}</h2>
        <span className="flex items-center gap-3">
          {meta}
          <span aria-hidden className="text-stone-500 transition-transform group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div className="border-t border-stone-800">{children}</div>
    </details>
  )
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [triggeringSealed, setTriggeringSealed] = useState(false)
  const [sealedTriggerStatus, setSealedTriggerStatus] = useState<'idle' | 'ok' | 'error'>('idle')

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
    setInviteError(null)
    setInviteSuccess(null)
    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, email }),
    })
    if (res.ok) {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r))
      setInviteSuccess(`Invite sent to ${email}`)
      setTimeout(() => setInviteSuccess(null), 4000)
    } else {
      const data = await res.json().catch(() => ({}))
      setInviteError(data.error ?? 'Failed to send invite')
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

  async function triggerSealedAction() {
    setTriggeringSealed(true)
    setSealedTriggerStatus('idle')
    const res = await fetch('/api/admin/trigger-sealed', { method: 'POST' })
    setTriggeringSealed(false)
    setSealedTriggerStatus(res.ok ? 'ok' : 'error')
    setTimeout(() => setSealedTriggerStatus('idle'), 4000)
  }

  const pending = requests.filter(r => r.status === 'pending')
  const activeUserEmails = new Set(users.filter(u => u.lastSeen).map(u => u.email.toLowerCase()))
  const handled = requests.filter(r => r.status !== 'pending' && !(r.status === 'approved' && activeUserEmails.has(r.email.toLowerCase())))

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-stone-100">Admin</h1>
        <p className="text-sm text-stone-500 mt-1">Access requests, users, league and tools.</p>
      </div>

      <AdminSection
        id="admin-access"
        title="Access requests"
        meta={<span className="text-xs text-stone-500 font-mono">{pending.length} pending</span>}
      >
        {inviteError && <p className="px-5 pt-3 text-xs text-red-400">{inviteError}</p>}
        {inviteSuccess && <p className="px-5 pt-3 text-xs text-green-400">{inviteSuccess}</p>}
        {loading ? (
          <p className="px-5 py-4 text-sm text-stone-600">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="px-5 py-4 text-sm text-stone-500">No pending requests</p>
        ) : (
          <div>
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
                    className="text-[11px] px-2.5 py-1.5 rounded border border-amber-700 text-amber-400 hover:bg-amber-950/40 transition-colors disabled:opacity-50"
                  >
                    {pendingAction === r.id ? 'Sending…' : 'Send invite'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {handled.length > 0 && (
          <div className="border-t border-stone-800">
            <h3 className="px-5 pt-3 pb-1 text-xs font-semibold text-stone-500">Previously handled</h3>
            <div>
              {handled.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-4 px-5 py-3 border-b border-stone-800 last:border-0">
                  <p className="text-stone-500 text-sm truncate min-w-0">{r.email}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.status === 'approved' && (
                      <button
                        onClick={() => sendInvite(r.id, r.email)}
                        disabled={pendingAction === r.id}
                        className="text-xs px-2 py-0.5 rounded border border-stone-700 text-stone-500 hover:border-amber-700 hover:text-amber-400 transition-colors disabled:opacity-50"
                      >
                        {pendingAction === r.id ? 'Sending…' : 'Resend'}
                      </button>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded font-mono ${r.status === 'approved' ? 'text-green-400 bg-green-950/40' : 'text-red-400 bg-red-950/40'}`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </AdminSection>

      {users.length > 0 && (
        <AdminSection
          id="admin-users"
          title="Users"
          openOnDesktop
          meta={<span className="text-xs text-stone-500 font-mono">{users.length} · {users.reduce((sum, u) => sum + u.cardCount, 0).toLocaleString()} cards</span>}
        >
          <AdminUsers users={users} setUsers={setUsers} />
        </AdminSection>
      )}

      <AdminSection id="admin-league" title="League">
        <div className="p-5 flex flex-col gap-6">
          <AdminLeagueMembers userEmails={users.map(u => u.email)} />
          <AdminLeagueSettings />
          <AdminLeagueWipe />
        </div>
      </AdminSection>

      <AdminSection id="admin-tools" title="Tools">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <p className="flex-1 min-w-48 text-sm text-stone-400">Refresh sealed product prices now instead of waiting for the cron.</p>
          <button
            onClick={triggerSealedAction}
            disabled={triggeringSealed}
            className="text-xs px-3 py-1.5 rounded border border-amber-700 text-amber-400 hover:bg-amber-950/40 transition-colors disabled:opacity-50"
          >
            {triggeringSealed ? 'Triggering…' : 'Run sealed prices'}
          </button>
          {sealedTriggerStatus === 'ok' && <p className="text-xs text-green-400">Action triggered</p>}
          {sealedTriggerStatus === 'error' && <p className="text-xs text-red-400">Failed to trigger</p>}
        </div>
      </AdminSection>
    </div>
  )
}

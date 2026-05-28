'use client'

import Link from 'next/link'
import { useState } from 'react'
import { login } from '@/app/actions/auth'

export default function LoginPage() {
  const [requesting, setRequesting] = useState(false)
  const [requestEmail, setRequestEmail] = useState('')
  const [requestStatus, setRequestStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [requestError, setRequestError] = useState('')

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault()
    setRequestStatus('loading')
    setRequestError('')
    const res = await fetch('/api/access-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: requestEmail }),
    })
    if (res.ok) {
      setRequestStatus('done')
    } else {
      const data = await res.json()
      setRequestError(data.error ?? 'Something went wrong.')
      setRequestStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-amber-500 tracking-wide">TapNTrack</h1>
          <p className="text-stone-400 text-sm mt-1">Sign in to continue</p>
        </div>

        {!requesting ? (
          <>
            <form action={login} className="bg-stone-900 border border-stone-700 rounded-xl p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm text-stone-300">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="bg-stone-800 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-600 transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm text-stone-300">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="bg-stone-800 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-600 transition-colors"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                className="mt-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-lg px-4 py-2.5 transition-colors"
              >
                Sign in
              </button>

              <Link href="/forgot-password" className="text-center text-sm text-stone-500 hover:text-stone-300 transition-colors">
                Forgot password?
              </Link>
            </form>

            <p className="text-center text-sm text-stone-600 mt-4">
              Don&apos;t have an account?{' '}
              <button onClick={() => setRequesting(true)} className="text-stone-400 hover:text-stone-200 underline transition-colors">
                Request access
              </button>
            </p>
          </>
        ) : (
          <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 flex flex-col gap-4">
            {requestStatus === 'done' ? (
              <div className="text-center flex flex-col gap-3">
                <p className="text-stone-200 font-medium">Request submitted</p>
                <p className="text-stone-500 text-sm">You&apos;ll receive an invite email once your request is reviewed.</p>
                <button onClick={() => { setRequesting(false); setRequestStatus('idle'); setRequestEmail('') }} className="text-sm text-stone-500 hover:text-stone-300 transition-colors">
                  Back to sign in
                </button>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-stone-200 font-medium">Request access</p>
                  <p className="text-stone-500 text-sm mt-1">Enter your email and we&apos;ll send you an invite when approved.</p>
                </div>

                {requestStatus === 'error' && (
                  <p className="text-red-400 text-sm bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{requestError}</p>
                )}

                <form onSubmit={submitRequest} className="flex flex-col gap-3">
                  <input
                    type="email"
                    required
                    value={requestEmail}
                    onChange={e => setRequestEmail(e.target.value)}
                    className="bg-stone-800 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-600 transition-colors"
                    placeholder="you@example.com"
                  />
                  <button
                    type="submit"
                    disabled={requestStatus === 'loading'}
                    className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50"
                  >
                    {requestStatus === 'loading' ? 'Submitting…' : 'Submit request'}
                  </button>
                </form>

                <button onClick={() => setRequesting(false)} className="text-center text-sm text-stone-500 hover:text-stone-300 transition-colors">
                  Back to sign in
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

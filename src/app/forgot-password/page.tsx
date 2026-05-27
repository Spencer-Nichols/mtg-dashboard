import Link from 'next/link'
import { requestPasswordReset } from '@/app/actions/auth'

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>
}) {
  const { error, sent } = await searchParams

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-amber-500 tracking-wide">MTG Dashboard</h1>
          <p className="text-stone-400 text-sm mt-1">Reset your password</p>
        </div>

        <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 flex flex-col gap-4">
          {error && (
            <p className="text-red-400 text-sm text-center bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {sent ? (
            <p className="text-green-400 text-sm text-center bg-green-950/30 border border-green-900/50 rounded-lg px-3 py-2">
              Check your email for a reset link.
            </p>
          ) : (
            <form action={requestPasswordReset} className="flex flex-col gap-4">
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

              <button
                type="submit"
                className="mt-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-lg px-4 py-2.5 transition-colors"
              >
                Send reset email
              </button>
            </form>
          )}

          <Link href="/login" className="text-center text-sm text-stone-500 hover:text-stone-300 transition-colors">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

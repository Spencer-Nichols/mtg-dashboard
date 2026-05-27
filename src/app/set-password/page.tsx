import { updatePassword } from '@/app/actions/auth'

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-amber-500 tracking-wide">MTG Dashboard</h1>
          <p className="text-stone-400 text-sm mt-1">Set your password</p>
        </div>

        <form action={updatePassword} className="bg-stone-900 border border-stone-700 rounded-xl p-6 flex flex-col gap-4">
          {error && (
            <p className="text-red-400 text-sm text-center bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm text-stone-300">New password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="bg-stone-800 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-600 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="mt-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-lg px-4 py-2.5 transition-colors"
          >
            Set password
          </button>
        </form>
      </div>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ error, count }, { error: historyError }] = await Promise.all([
    supabase.from('binder_cards').delete({ count: 'exact' }).eq('user_id', user.id),
    supabase.from('binder_history').delete().eq('user_id', user.id),
  ])

  if (error || historyError) {
    return Response.json({ error: error?.message ?? historyError?.message }, { status: 500 })
  }

  return Response.json({ deleted: count })
}

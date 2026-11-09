import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { MAX_DECK_IDEAS } from '@/lib/deck-ideas'

export const PROXY_DECK_IDEAS = 6

export async function hasProxyAccess(userId: string) {
  const { data } = await createServiceClient()
    .from('user_profiles')
    .select('proxy_access')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.proxy_access === true
}

export async function deckIdeaLimit(userId: string) {
  return (await hasProxyAccess(userId)) ? PROXY_DECK_IDEAS : MAX_DECK_IDEAS
}

export async function proxyUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await hasProxyAccess(user.id))) return null
  return { supabase, user }
}

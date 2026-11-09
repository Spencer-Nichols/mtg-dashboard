import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasProxyAccess } from '@/lib/proxy-access'

export default async function ProxiesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!(await hasProxyAccess(user.id))) redirect('/')

  return <>{children}</>
}

'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    redirect('/login?error=Invalid+email+or+password')
  }

  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    redirect('/set-password?error=Could+not+update+password')
  }

  redirect('/')
}

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get('email') as string
  const supabase = await createClient()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3001')

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm`,
  })

  if (error) {
    redirect('/forgot-password?error=Could+not+send+reset+email')
  }

  redirect('/forgot-password?sent=1')
}

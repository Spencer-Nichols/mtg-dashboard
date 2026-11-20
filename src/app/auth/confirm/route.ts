import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'invite' | 'recovery' | 'email' | 'signup' | null
  const code = searchParams.get('code')

  // Supabase's default recovery link verifies on its side, then sends ?code= here.
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('Auth confirm failed: code exchange', { error: error.message, code: error.code })
      return failed(origin)
    }
    return NextResponse.redirect(new URL('/set-password', origin))
  }

  if (!token_hash || !type) {
    console.error('Auth confirm failed: link is missing token_hash or type', { params: [...searchParams.keys()] })
    return failed(origin)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash, type })
  if (error) {
    console.error('Auth confirm failed:', { type, error: error.message, code: error.code })
    return failed(origin)
  }

  const destination = type === 'invite' || type === 'recovery' ? '/set-password' : '/'
  return NextResponse.redirect(new URL(destination, origin))
}

// /login bounces signed-in users to the homepage and hides the error, so failures land on
// /forgot-password, which shows it to everyone and lets them request a new link.
function failed(origin: string) {
  return NextResponse.redirect(new URL('/forgot-password?error=That+link+is+invalid+or+expired.+Request+a+new+one+below.', origin))
}

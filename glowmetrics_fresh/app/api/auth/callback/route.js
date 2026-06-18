import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(req) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data?.user) {
      const user = data.user

      // ── Fire signup notification (non-blocking) ──
      fetch(`${origin}/api/notify/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          created_at: user.created_at,
        }),
      }).catch(err => console.error('[auth/callback] notify/signup failed:', err.message))

      return NextResponse.redirect(`${origin}/onboarding`)
    }
  }

  // Fallback — redirect to landing on failure
  return NextResponse.redirect(`${origin}/landing`)
}

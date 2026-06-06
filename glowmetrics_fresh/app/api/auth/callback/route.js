import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

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

      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // Fallback — redirect to landing on failure
  return NextResponse.redirect(`${origin}/landing`)
}

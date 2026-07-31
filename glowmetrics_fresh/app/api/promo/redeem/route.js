import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseRouteClient } from '../../../../lib/supabase-server'

const ERROR_MESSAGES = {
  not_authenticated: 'Please sign in to redeem a code.',
  invalid_code: "That code doesn't look right. Double-check and try again.",
  inactive_code: 'This code is no longer active.',
  expired_code: 'This code has expired.',
  code_exhausted: 'This code has already been fully redeemed.',
  already_redeemed: "You've already redeemed a promo code on this account.",
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!code) {
      return NextResponse.json({ error: 'Enter a promo code.' }, { status: 400 })
    }

    // Same auth pattern as /api/stripe/checkout — cookie session first,
    // bearer token fallback if the SSR cookie hasn't landed yet.
    let supabase = createSupabaseRouteClient()
    let { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const authorization = request.headers.get('authorization') || ''
      const accessToken = authorization.startsWith('Bearer ')
        ? authorization.slice(7).trim()
        : null

      if (accessToken) {
        const tokenClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          {
            global: { headers: { Authorization: `Bearer ${accessToken}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          }
        )
        const tokenResult = await tokenClient.auth.getUser(accessToken)
        user = tokenResult.data.user
        if (user) supabase = tokenClient
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Your login session expired. Please sign in again.' },
        { status: 401 }
      )
    }

    const { data, error } = await supabase.rpc('redeem_promo_code', { p_code: code })

    if (error) {
      const key = error.message?.split(':')[0]?.trim()
      const message = ERROR_MESSAGES[key] || 'Could not redeem that code. Please try again.'
      const status = key === 'not_authenticated' ? 401 : 400
      return NextResponse.json({ error: message }, { status })
    }

    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    console.error('Promo redeem error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

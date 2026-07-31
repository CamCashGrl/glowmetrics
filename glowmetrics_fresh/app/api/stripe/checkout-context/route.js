// app/api/stripe/checkout-context/route.js
//
// After a successful Stripe redirect, the dashboard calls this with the
// `session_id` Stripe appended to the success_url to retrieve the
// trustworthy, server-held "why did this user upgrade" context — the
// authoritative source, not the sessionStorage fallback the client wrote
// before leaving for Stripe (that fallback only covers same-browser-tab
// same-device continuity; this covers everything else, including Stripe's
// own hosted checkout page being the thing that navigated the browser).
import { NextResponse } from 'next/server'
import { stripe } from '../../../../lib/stripe'
import { createSupabaseRouteClient } from '../../../../lib/supabase-server'
import { metadataToContext } from '../../../../lib/checkoutContext'

export async function GET(request) {
  try {
    const supabase = createSupabaseRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionId = new URL(request.url).searchParams.get('session_id')
    if (!sessionId || !sessionId.startsWith('cs_')) {
      return NextResponse.json({ error: 'Missing or invalid session_id' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId)

    // Never return another user's context, even if they somehow have a
    // stray session_id — the checkout session's own metadata.userId is the
    // authority here, not who's currently logged in making the request.
    if (session.metadata?.userId !== user.id) {
      return NextResponse.json({ error: 'Session does not belong to this user' }, { status: 403 })
    }

    return NextResponse.json({ context: metadataToContext(session.metadata) })
  } catch (error) {
    console.error('checkout-context error:', error.message)
    return NextResponse.json({ error: 'Unable to retrieve checkout context' }, { status: 500 })
  }
}

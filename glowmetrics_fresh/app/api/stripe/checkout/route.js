// app/api/stripe/checkout/route.js
import { NextResponse } from 'next/server'
import { stripe } from '../../../../lib/stripe'
import { createSupabaseRouteClient } from '../../../../lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { resolvePriceMap, missingAnnualEnvVars } from '../../../../lib/stripePriceConfig'

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    let supabase = createSupabaseRouteClient()
    let { data: { user } } = await supabase.auth.getUser()

    // Browser sessions normally arrive through Supabase SSR cookies. The bearer
    // fallback keeps checkout authenticated if the page was reached through a
    // host transition or the cookie was not refreshed before this request.
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

    // Get or create customer — profiles is the single source of truth
    let customerId
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Checkout: failed to read profile', profileError.message)
    }

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id }
      })
      customerId = customer.id

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)

      if (updateError) {
        console.error('Checkout: failed to save stripe_customer_id', updateError.message)
        return NextResponse.json({ error: 'Failed to set up billing profile' }, { status: 500 })
      }
    }

    // Resolve the correct Stripe price ID based on plan_type
    const planType = body.plan_type || 'standard_monthly'

    const PRICE_MAP = resolvePriceMap()

    if (!Object.prototype.hasOwnProperty.call(PRICE_MAP, planType)) {
      return NextResponse.json({ error: 'Invalid subscription plan selected.' }, { status: 400 })
    }

    const priceId = PRICE_MAP[planType].value
    if (!priceId || !priceId.startsWith('price_')) {
      if (planType.includes('annual')) {
        // Annual has historically had no price configured in this environment
        // at all — this isn't an unexpected server error, it's a known,
        // recoverable "not offered right now" state. The client should hide
        // the option rather than hit this, but guard it here too since the
        // client's availability check could be stale.
        console.error(`Checkout: annual plan requested but not configured. Missing env vars: ${missingAnnualEnvVars().join(', ')}`)
        return NextResponse.json(
          { error: 'Annual billing is not available right now. Please choose the monthly plan, or try again shortly.' },
          { status: 503 }
        )
      }
      console.error(`Checkout: missing or invalid price for ${planType} (expected env var: ${PRICE_MAP[planType].source})`)
      return NextResponse.json(
        { error: 'This plan is not configured correctly. Please try again shortly.' },
        { status: 500 }
      )
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${request.headers.get('origin')}/dashboard?success=true&plan=${planType}`,
      cancel_url: `${request.headers.get('origin')}/dashboard?canceled=true`,
      metadata: {
        userId: user.id,
        plan_type: planType,
      },
      // Copies userId onto the Subscription object itself (Checkout Session
      // metadata alone does not propagate there), so customer.subscription.*
      // webhook events can match the user via metadata too, not just email.
      subscription_data: {
        metadata: {
          userId: user.id,
          plan_type: planType,
        },
      },
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe Checkout did not return a payment URL.' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

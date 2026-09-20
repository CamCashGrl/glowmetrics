// app/api/stripe/checkout/route.js
import { NextResponse } from 'next/server'
import { stripe } from '../../../../lib/stripe'
import { createSupabaseRouteClient } from '../../../../lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

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
      .select('stripe_customer_id, trial_ends_at')
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
        // Don't fail checkout — customer was created in Stripe, that's what matters
        // The webhook will save the customer ID when subscription completes
      }
    }

    // Resolve the correct Stripe price ID based on plan_type
    const planType = body.plan_type || 'standard_monthly'

    const PRICE_MAP = {
      standard_monthly:      process.env.STRIPE_MONTHLY_PRICE_ID || process.env.STRIPE_PRICE_STANDARD_MONTHLY || process.env.NEXT_PUBLIC_STRIPE_PRICE_ID,
      standard_annual:       process.env.STRIPE_YEARLY_PRICE_ID || process.env.STRIPE_ANNUAL_PRICE_ID || process.env.STRIPE_PRICE_STANDARD_ANNUAL || process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL,
    }

    if (!Object.prototype.hasOwnProperty.call(PRICE_MAP, planType)) {
      return NextResponse.json({ error: 'Invalid subscription plan selected.' }, { status: 400 })
    }

    const priceId = PRICE_MAP[planType]
    if (!priceId || !priceId.startsWith('price_')) {
      console.error(`Checkout: missing or invalid price for ${planType}`)
      return NextResponse.json(
        { error: `The ${planType.includes('annual') ? 'annual' : 'monthly'} Stripe price is not configured correctly.` },
        { status: 500 }
      )
    }

    // Create checkout session with 7-day trial
    // Card is collected immediately but not charged until after 7 days
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,  // Card on file, charge after 7 days
        metadata: {
          userId: user.id,
          plan_type: planType,
        }
      },
      success_url: `${request.headers.get('origin')}/dashboard?success=true&trial=7days&plan=${planType}`,
      cancel_url: `${request.headers.get('origin')}/dashboard?canceled=true`,
      metadata: {
        userId: user.id,
        plan_type: planType,
      }
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

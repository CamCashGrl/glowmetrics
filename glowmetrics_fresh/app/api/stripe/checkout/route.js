// app/api/stripe/checkout/route.js
import { NextResponse } from 'next/server'
import { stripe } from '../../../../lib/stripe'
import { createSupabaseRouteClient } from '../../../../lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

async function logCheckoutEvent(admin, userId, {
  status,
  planType = null,
  planPrice = null,
  billingCycle = null,
  stripeSessionId = null,
  errorCode = null,
  errorMessage = null,
  failureReason = null,
  properties = {},
} = {}) {
  if (!admin || !userId || !status) return
  const { error } = await admin.from('checkout_events').insert({
    user_id: userId,
    status,
    plan_type: planType,
    plan_price: planPrice,
    billing_cycle: billingCycle,
    stripe_session_id: stripeSessionId,
    error_code: errorCode,
    error_message: errorMessage,
    failure_reason: failureReason,
    properties: { source: 'server', ...properties },
  })
  if (error) console.error('Checkout: failed to log checkout event', status, error.message)
}

export async function POST(request) {
  let admin = null
  let checkoutUserId = null
  let checkoutPlanType = null

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

    checkoutUserId = user.id
    admin = getSupabaseAdmin()

    // Resolve the correct Stripe price ID based on plan_type.
    const planType = body.plan_type || 'standard_monthly'
    checkoutPlanType = planType

    const PRICE_MAP = {
      standard_monthly: process.env.STRIPE_MONTHLY_PRICE_ID || process.env.STRIPE_PRICE_STANDARD_MONTHLY || process.env.NEXT_PUBLIC_STRIPE_PRICE_ID,
      standard_annual: process.env.STRIPE_YEARLY_PRICE_ID || process.env.STRIPE_ANNUAL_PRICE_ID || process.env.STRIPE_PRICE_STANDARD_ANNUAL || process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL,
    }

    if (!Object.prototype.hasOwnProperty.call(PRICE_MAP, planType)) {
      await logCheckoutEvent(admin, user.id, {
        status: 'failed',
        planType,
        errorCode: 'invalid_plan',
        errorMessage: 'Invalid subscription plan selected.',
        failureReason: 'invalid_plan',
      })
      return NextResponse.json({ error: 'Invalid subscription plan selected.' }, { status: 400 })
    }

    await logCheckoutEvent(admin, user.id, {
      status: 'started',
      planType,
      billingCycle: planType === 'standard_annual' ? 'annual' : 'monthly',
    })

    // Get or create customer — profiles is the single source of truth.
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

      // stripe_customer_id is a server-only billing column (browser roles have
      // no UPDATE on it — migration 20261010), so it is written with the
      // service role, scoped to the authenticated caller's own id.
      const { error: updateError } = await admin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)

      if (updateError) {
        console.error('Checkout: failed to save stripe_customer_id', updateError.message)
        // Don't fail checkout — customer was created in Stripe, that's what matters.
        // The webhook will save the customer ID when subscription completes.
      }
    }

    let priceId = PRICE_MAP[planType]

    // The advertised price is the contract: $9.99/month, $99/year. The
    // monthly env var pointed at a $19.99 price, so every price is checked
    // against Stripe before checkout. Monthly falls back to the $9.99 price's
    // lookup key; anything still not matching is refused (never overcharge).
    const ADVERTISED = {
      standard_monthly: { amount: 999, interval: 'month', lookupKey: 'Monthly_Premuim' },
      standard_annual: { amount: 9900, interval: 'year', lookupKey: null },
    }
    const expected = ADVERTISED[planType]
    const matches = (p) => p && p.active && p.currency === 'usd'
      && p.unit_amount === expected.amount && p.recurring?.interval === expected.interval
    let price = null
    if (priceId && priceId.startsWith('price_')) {
      price = await stripe.prices.retrieve(priceId).catch(() => null)
    }
    if (!matches(price) && expected.lookupKey) {
      const found = await stripe.prices.list({ lookup_keys: [expected.lookupKey], active: true, limit: 1 })
      price = found.data[0] || null
    }
    if (!matches(price)) {
      const message = `The ${planType.includes('annual') ? 'annual' : 'monthly'} Stripe price is not configured correctly.`
      console.error(`Checkout: no active Stripe price matches the advertised ${planType} amount (${expected.amount})`)
      await logCheckoutEvent(admin, user.id, {
        status: 'failed',
        planType,
        planPrice: expected.amount / 100,
        billingCycle: expected.interval === 'year' ? 'annual' : 'monthly',
        errorCode: 'price_misconfigured',
        errorMessage: message,
        failureReason: 'price_misconfigured',
      })
      return NextResponse.json({ error: message }, { status: 500 })
    }
    priceId = price.id

    // Create checkout session with 7-day trial.
    // Card is collected immediately but not charged until after 7 days.
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: user.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
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
      await logCheckoutEvent(admin, user.id, {
        status: 'failed',
        planType,
        planPrice: expected.amount / 100,
        billingCycle: expected.interval === 'year' ? 'annual' : 'monthly',
        stripeSessionId: session.id || null,
        errorCode: 'missing_checkout_url',
        errorMessage: 'Stripe Checkout did not return a payment URL.',
        failureReason: 'missing_checkout_url',
      })
      return NextResponse.json({ error: 'Stripe Checkout did not return a payment URL.' }, { status: 500 })
    }

    await logCheckoutEvent(admin, user.id, {
      status: 'session_created',
      planType,
      planPrice: expected.amount / 100,
      billingCycle: expected.interval === 'year' ? 'annual' : 'monthly',
      stripeSessionId: session.id || null,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    await logCheckoutEvent(admin, checkoutUserId, {
      status: 'failed',
      planType: checkoutPlanType,
      errorCode: 'checkout_exception',
      errorMessage: error.message,
      failureReason: 'checkout_exception',
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

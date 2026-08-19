// app/api/stripe/checkout/route.js
import { NextResponse } from 'next/server'
import { stripe } from '../../../../lib/stripe'
import { TRIAL_DAYS } from '../../../../lib/plan'
import { resolvePlanType, resolvePriceId } from '../../../../lib/stripe-plans'
import { createSupabaseRouteClient } from '../../../../lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

// A checkout that fails for a configuration reason is a lost sale that
// otherwise leaves no trace anyone looks at — the previous breakage sat
// undetected through every signup the product has ever had. Anything that
// stops a creator from paying now pages the owner directly.
async function alertCheckoutBlocked(subject, text) {
  if (!process.env.RESEND_API_KEY) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GlowMetrics <notifications@glowmetrics.co>',
        to: 'daphneoncam@gmail.com',
        subject,
        text,
      }),
    })
  } catch (e) {
    console.error('Checkout alert failed to send:', e.message)
  }
}

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

    // Resolve the Stripe price. Both halves of this are deliberately
    // forgiving of history (see lib/stripe-plans.js): the landing page
    // forwards ?plan= straight from the URL, so plan_type can be any string
    // ever shipped in a marketing link, and the price env vars have been
    // named three different ways across deployments. A creator trying to pay
    // must not lose because of either.
    const requestedPlan = body.plan_type || 'monthly'
    const planType = resolvePlanType(requestedPlan)

    if (!planType) {
      // Unknown plan strings are logged rather than silently coerced — this
      // is how the early_adopter_monthly breakage stayed invisible.
      console.error(`Checkout: unrecognized plan_type "${requestedPlan}" — add it to PLAN_ALIASES in lib/stripe-plans.js if it is a real plan`)
      await alertCheckoutBlocked(
        `🚨 CamCash checkout blocked — unknown plan "${requestedPlan}"`,
        `${user.email} tried to subscribe via plan_type "${requestedPlan}", which no longer maps to a plan.\n\n` +
        `This is almost always an old marketing link (?plan=...). Add the alias to PLAN_ALIASES in lib/stripe-plans.js.`
      )
      return NextResponse.json(
        { error: 'That subscription link is out of date. Please pick a plan on the pricing page.' },
        { status: 400 }
      )
    }

    const { priceId, searched } = resolvePriceId(planType)
    if (!priceId) {
      // Names the exact env vars to set, so this is a 30-second fix next time
      // instead of a mystery 500 that costs a sale.
      console.error(
        `Checkout: no Stripe price configured for "${planType}". ` +
        `Set one of these env vars to a price_... id: ${searched.join(', ')}`
      )
      await alertCheckoutBlocked(
        `🚨 CamCash checkout blocked — no ${planType} price configured`,
        `${user.email} tried to subscribe on the ${planType} plan and could not, because no Stripe price is configured for it.\n\n` +
        `Set ONE of these environment variables in Vercel to a price_... id:\n${searched.map(v => `  • ${v}`).join('\n')}\n\n` +
        `They were shown a "temporarily unavailable" message and were not charged.`
      )
      return NextResponse.json(
        { error: `${planType === 'annual' ? 'Annual' : 'Monthly'} billing is temporarily unavailable. Please try the other billing option or contact support — you have not been charged.` },
        { status: 503 }
      )
    }

    // One trial per customer, ever. Stripe does not dedupe this itself, so a
    // user who cancels and comes back would otherwise collect a fresh free
    // week on every checkout. Any prior subscription on the customer (in any
    // status, including canceled) means the trial has already been used.
    let trialEligible = true
    try {
      const priorSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 1,
      })
      trialEligible = priorSubs.data.length === 0
    } catch (e) {
      // Fail closed: if we can't prove the customer is new, sell them the
      // subscription rather than risk handing out repeat trials.
      console.error('Checkout: trial eligibility lookup failed', e.message)
      trialEligible = false
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${request.headers.get('origin')}/dashboard?success=true&plan=${planType}`,
      // Back to the gate, not the dashboard: a user who abandons checkout has
      // no access to return to.
      cancel_url: `${request.headers.get('origin')}/start-trial?canceled=true`,
      metadata: {
        userId: user.id,
        plan_type: planType,
      },
      // Card-backed free trial. CamCash is gated rather than freemium, so this
      // is the only way into the product for a new account: Stripe collects
      // and validates a payment method up front, bills nothing for
      // TRIAL_DAYS, then charges automatically unless the user cancels.
      //
      // `payment_method_collection: 'always'` is what makes the card
      // mandatory — Stripe's default for a trialing subscription is to let
      // checkout complete with no payment method at all, which would hand out
      // free access with nothing to convert.
      //
      // A subscription that somehow reaches the end of its trial with no
      // usable payment method is canceled rather than left hanging in
      // `past_due`, since past_due deliberately keeps access during Stripe's
      // retry window (see the webhook's ACTIVE_STATUSES) — that window is for
      // real customers whose card failed, not for trials that never had one.
      payment_method_collection: 'always',
      subscription_data: {
        ...(trialEligible ? {
          trial_period_days: TRIAL_DAYS,
          trial_settings: {
            end_behavior: { missing_payment_method: 'cancel' },
          },
        } : {}),
        metadata: {
          userId: user.id,
          plan_type: planType,
        }
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

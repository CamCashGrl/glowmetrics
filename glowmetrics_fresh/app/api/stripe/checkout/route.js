// app/api/stripe/checkout/route.js
import { NextResponse } from 'next/server'
import { stripe } from '../../../../lib/stripe'
import { TRIAL_DAYS } from '../../../../lib/plan'
import { resolvePlanType, resolvePriceId } from '../../../../lib/stripe-plans'
import { createSupabaseRouteClient } from '../../../../lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

// EVERY failure exit in this route goes through failCheckout() below, so
// there is no way to add a new one that fails silently. That mattered: the
// route previously had five failure exits and none of them told anyone, which
// is how a checkout that rejected the only purchase anyone ever attempted sat
// undetected for weeks.
//
// At current volume every single attempt is worth an email. If attempt volume
// ever grows enough for this to be noisy, batch it — do not drop it.
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

/**
 * Single exit for every checkout failure: logs it, emails the owner, and
 * returns the creator-facing response. `ownerDetail` should say what to DO
 * about it, not just what happened.
 */
async function failCheckout({ status, userMessage, ownerSubject, ownerDetail, email }) {
  console.error(`Checkout failed (${status}) for ${email || 'unauthenticated user'}: ${ownerSubject}`)
  await alertCheckoutBlocked(
    ownerSubject,
    `${ownerDetail}\n\n` +
    `Who: ${email || 'not signed in'}\n` +
    `What they saw: "${userMessage}"\n` +
    `They were NOT charged.`
  )
  return NextResponse.json({ error: userMessage }, { status })
}

export async function POST(request) {
  // Hoisted so the catch-all at the bottom can name who was affected.
  let userEmail = null
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
      return await failCheckout({
        status: 401,
        userMessage: 'Your login session expired. Please sign in again.',
        ownerSubject: '🚨 CamCash checkout blocked — creator was signed out',
        ownerDetail: 'Someone clicked a subscribe button but their session was not recognized, so checkout never opened. If this repeats, the auth cookie is not surviving the trip to /api/stripe/checkout.',
      })
    }

    userEmail = user.email

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
        return await failCheckout({
          status: 500,
          email: userEmail,
          userMessage: 'We could not set up your billing profile. Please try again in a moment.',
          ownerSubject: '🚨 CamCash checkout blocked — could not save billing profile',
          ownerDetail: `Stripe customer ${customerId} was created, but writing stripe_customer_id to profiles failed: ${updateError.message}. The Stripe customer now exists with no profile link — check RLS on profiles before retrying.`,
        })
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
      return await failCheckout({
        status: 400,
        email: userEmail,
        userMessage: 'That subscription link is out of date. Please pick a plan on the pricing page.',
        ownerSubject: `🚨 CamCash checkout blocked — unknown plan "${requestedPlan}"`,
        ownerDetail: `plan_type "${requestedPlan}" no longer maps to a plan. This is almost always an old marketing link (?plan=...). Add the alias to PLAN_ALIASES in lib/stripe-plans.js.`,
      })
    }

    const { priceId, searched } = resolvePriceId(planType)
    if (!priceId) {
      // Names the exact env vars to set, so this is a 30-second fix next time
      // instead of a mystery 500 that costs a sale.
      console.error(
        `Checkout: no Stripe price configured for "${planType}". ` +
        `Set one of these env vars to a price_... id: ${searched.join(', ')}`
      )
      return await failCheckout({
        status: 503,
        email: userEmail,
        userMessage: `${planType === 'annual' ? 'Annual' : 'Monthly'} billing is temporarily unavailable. Please try the other billing option or contact support — you have not been charged.`,
        ownerSubject: `🚨 CamCash checkout blocked — no ${planType} price configured`,
        ownerDetail: `No Stripe price is configured for the ${planType} plan.\n\nSet ONE of these environment variables in Vercel to a price_... id:\n${searched.map(v => `  • ${v}`).join('\n')}`,
      })
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
      return await failCheckout({
        status: 500,
        email: userEmail,
        userMessage: 'We could not open the payment page. Please try again — you have not been charged.',
        ownerSubject: '🚨 CamCash checkout blocked — Stripe returned no payment URL',
        ownerDetail: `Stripe accepted checkout session ${session.id} but returned no url. This usually means the session was created in an unexpected state — inspect it in the Stripe dashboard.`,
      })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    // The catch-all matters most: a revoked Stripe key, a deleted price, or a
    // Stripe outage all land here, and all of them mean nobody can pay.
    return await failCheckout({
      status: 500,
      email: userEmail,
      userMessage: 'Something went wrong opening checkout. Please try again — you have not been charged.',
      ownerSubject: '🚨 CamCash checkout blocked — unexpected error',
      ownerDetail: `Stripe or the checkout route threw: ${error?.message || error}\n\nCommon causes: STRIPE_SECRET_KEY revoked or from the wrong mode (test vs live), the configured price_... was deleted in Stripe, or a Stripe outage.`,
    })
  }
}

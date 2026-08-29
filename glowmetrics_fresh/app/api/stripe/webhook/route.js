import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Server-side funnel events. The client can only track up to the moment it
// hands the user to Stripe — everything that decides whether a trial actually
// exists (card accepted, trial opened, converted, canceled) happens on
// Stripe's side and comes back only through this webhook. Writing those into
// analytics_events is what makes the trial funnel countable end to end
// instead of stopping at "they clicked".
//
// Fire-and-forget on purpose: analytics must never fail a webhook. A thrown
// insert here would return 500 to Stripe, which would retry the event and
// re-run the profile write above it.
async function logEvent(supabase, userId, eventName, properties = {}) {
  try {
    await supabase.from('analytics_events').insert({
      user_id: userId ?? null,
      event_name: eventName,
      properties,
      url: 'stripe:webhook',
    })
  } catch (e) {
    console.error(`Analytics insert failed for ${eventName}:`, e.message)
  }
}

async function getUserByEmail(supabase, email) {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (error) return null
  return data.users.find(u => u.email === email) || null
}

async function getEmailFromCustomer(customerId) {
  const customer = await stripe.customers.retrieve(customerId)
  return customer?.email || null
}

// Resolves the Supabase user id for a Stripe event, preferring the
// identifiers we control (checkout metadata.userId, profiles.stripe_customer_id)
// over an email lookup against auth.admin.listUsers() — email can change,
// and a Stripe customer created outside our checkout route may not match a
// Supabase user by email at all.
async function resolveUserId(supabase, { metadataUserId, customerId }) {
  if (metadataUserId) return metadataUserId

  if (customerId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()
    if (profile?.id) return profile.id

    const email = await getEmailFromCustomer(customerId)
    if (email) {
      const user = await getUserByEmail(supabase, email)
      if (user) return user.id
    }
  }

  return null
}

async function sendResendNotification(subject, text) {
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
    console.error('Resend notification failed:', e.message)
  }
}

// Updates profiles and returns whether it actually succeeded — the whole
// point of this fix is that we never again silently believe an update
// worked when it didn't.
async function updateProfile(supabase, userId, update) {
  const { error } = await supabase.from('profiles').update(update).eq('id', userId)
  if (error) {
    console.error(`Webhook: failed to update profile ${userId} with`, update, error.message)
    return false
  }
  return true
}

// Stripe subscription statuses that should keep/grant Pro access.
// `past_due`/`unpaid` intentionally keep access during Stripe's own retry
// window instead of yanking it on the first failed charge — Stripe will
// fire another `customer.subscription.updated` once it resolves either way.
const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

// profiles.trial_ends_at mirrors the Stripe subscription's trial_end so the
// dashboard can show a countdown. Display only — access is decided by `plan`,
// which this webhook is the sole writer of. Cleared once the subscription is
// no longer trialing so a stale date can't keep rendering a countdown.
function trialFields(sub) {
  if (sub.status === 'trialing' && sub.trial_end) {
    return { trial_ends_at: new Date(sub.trial_end * 1000).toISOString() }
  }
  return { trial_ends_at: null }
}

// Granting Pro from Stripe must also clear plan_expires_at.
//
// plan_expires_at is set only by promo-code grants (redeem_promo_code), and
// isProPlan() treats a past value as "not Pro" regardless of `plan`. A
// creator who redeemed a promo and then subscribed kept the promo's expiry,
// so their paid access silently lapsed on the promo date while Stripe went
// on charging them. That is not hypothetical: it had already happened to the
// only paying subscriber this product has, whose access was due to expire
// 2026-08-27 against an active $19.99/mo subscription started 2026-07-26.
//
// A live Stripe subscription is authoritative and not time-limited, which is
// the invariant lib/plan.js documents: "Stripe-managed subscriptions leave it
// null." So every Pro grant that originates from Stripe writes NULL here.
//
// Tradeoff, deliberate: if someone holds an unexpired promo, subscribes, and
// later cancels, the promo remainder is not restored — the date is gone. That
// is rarer, and far less costly, than a paying customer losing access. The
// downgrade paths below intentionally do NOT touch plan_expires_at, so a
// promo grant on a non-subscriber is left alone.
function proGrantFields(sub) {
  return { plan: 'pro', plan_expires_at: null, ...(sub ? trialFields(sub) : {}) }
}

export async function POST(request) {
  const supabase = getSupabaseAdmin()
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = await resolveUserId(supabase, {
          metadataUserId: session.metadata?.userId,
          customerId: session.customer,
        })
        if (!userId) break
        // checkout.session.completed carries no subscription status, so this
        // only opens access — customer.subscription.created/updated is what
        // writes the trial window and any later downgrade.
        const update = { plan: 'pro', plan_expires_at: null }
        if (session.customer) update.stripe_customer_id = session.customer
        const ok = await updateProfile(supabase, userId, update)
        if (!ok) {
          return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
        }
        const email = session.customer_details?.email || session.customer_email || userId
        await sendResendNotification(
          `💰 New CamCash Subscriber — ${email} subscribed to Pro`,
          `${email} just subscribed to the Pro plan.`
        )
        break
      }

      case 'customer.subscription.created': {
        const sub = event.data.object
        const userId = await resolveUserId(supabase, {
          metadataUserId: sub.metadata?.userId,
          customerId: sub.customer,
        })
        if (!userId) break
        const update = ACTIVE_STATUSES.has(sub.status)
          ? proGrantFields(sub)
          : { plan: 'free', ...trialFields(sub) }
        if (sub.customer) update.stripe_customer_id = sub.customer
        const ok = await updateProfile(supabase, userId, update)
        if (!ok) {
          return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
        }
        await logEvent(
          supabase,
          userId,
          sub.status === 'trialing' ? 'trial_started' : 'subscription_started',
          {
            plan_type: sub.metadata?.plan_type || null,
            status: sub.status,
            trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          }
        )
        const email = await getEmailFromCustomer(sub.customer) || userId
        await sendResendNotification(
          sub.status === 'trialing'
            ? `🚀 CamCash Trial Started — ${email}`
            : `💰 New CamCash Subscriber — ${email} subscribed to Pro`,
          sub.status === 'trialing'
            ? `${email} started a free trial with a card on file. Converts automatically unless they cancel.`
            : `${email} just subscribed to the Pro plan.`
        )
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const userId = await resolveUserId(supabase, {
          metadataUserId: sub.metadata?.userId,
          customerId: sub.customer,
        })
        if (!userId) break
        const ok = await updateProfile(supabase, userId, { plan: 'free', trial_ends_at: null })
        if (!ok) {
          return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
        }
        // A cancellation during the trial and one after a paid month are very
        // different signals, so they are separate events rather than one
        // "canceled" with a flag to remember to filter on.
        await logEvent(
          supabase,
          userId,
          sub.status === 'trialing' ? 'trial_canceled' : 'subscription_canceled',
          { plan_type: sub.metadata?.plan_type || null, status: sub.status }
        )
        const email = await getEmailFromCustomer(sub.customer) || userId
        await sendResendNotification(
          `❌ CamCash Cancellation — ${email} cancelled their subscription`,
          `${email} cancelled their Pro subscription.`
        )
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const userId = await resolveUserId(supabase, {
          metadataUserId: sub.metadata?.userId,
          customerId: sub.customer,
        })
        if (!userId) break
        const plan = ACTIVE_STATUSES.has(sub.status) ? 'pro' : 'free'
        const ok = await updateProfile(
          supabase,
          userId,
          plan === 'pro' ? proGrantFields(sub) : { plan: 'free', ...trialFields(sub) }
        )
        if (!ok) {
          return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
        }
        // previous_attributes is the only thing that distinguishes a trial
        // converting to paid from an ordinary renewal — both arrive as an
        // `updated` event with status 'active'.
        const wasTrialing = event.data.previous_attributes?.status === 'trialing'
        if (plan === 'pro' && sub.status === 'active' && wasTrialing) {
          await logEvent(supabase, userId, 'trial_converted', {
            plan_type: sub.metadata?.plan_type || null,
          })
        } else if (plan === 'free') {
          await logEvent(supabase, userId, wasTrialing ? 'trial_canceled' : 'subscription_canceled', {
            plan_type: sub.metadata?.plan_type || null,
            status: sub.status,
          })
        }
        const email = await getEmailFromCustomer(sub.customer) || userId
        if (plan === 'pro') {
          if (sub.status === 'past_due') {
            await sendResendNotification(
              `⚠️ CamCash Payment Past Due — ${email}`,
              `${email}'s subscription payment is past due. Access is still active during Stripe's retry window.`
            )
          } else {
            await sendResendNotification(
              `💰 New CamCash Subscriber — ${email} subscribed to Pro`,
              `${email} reactivated their Pro plan.`
            )
          }
        } else {
          await sendResendNotification(
            `❌ CamCash Cancellation — ${email} cancelled their subscription`,
            `${email}'s subscription status changed to ${sub.status}.`
          )
        }
        break
      }

      case 'customer.subscription.trial_will_end': {
        // Stripe fires this three days out. Notification only — the trial is
        // still active, so access is untouched here.
        const sub = event.data.object
        const userId = await resolveUserId(supabase, {
          metadataUserId: sub.metadata?.userId,
          customerId: sub.customer,
        })
        await logEvent(supabase, userId, 'trial_will_end', {
          plan_type: sub.metadata?.plan_type || null,
          trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        })
        const email = await getEmailFromCustomer(sub.customer) || sub.customer
        await sendResendNotification(
          `⏳ CamCash Trial Ending — ${email}`,
          `${email}'s free trial ends soon. They convert automatically unless they cancel first.`
        )
        break
      }

      default:
        return NextResponse.json({ error: 'Unhandled event type' }, { status: 400 })
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

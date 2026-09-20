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

// supabase.auth.admin.listUsers() is paginated — 50 users per page by
// default, and NOT called with any page param here previously, so it only
// ever saw the oldest ~50 accounts. Past that (this project has 167+ users),
// every lookup by email silently returned null and every webhook handler
// below hit its `if (!user) break` and did nothing — Stripe still saw a 200
// response, so it never retried, and the failure was completely invisible.
// This is now only a fallback (see getUserById below, which is exact and
// O(1)); when it does run, it pages through the whole user list instead of
// just the first page.
export async function getUserByEmail(supabase, email) {
  if (!email) return null
  let page = 1
  const perPage = 200
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) return null
    const match = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (match) return match
    if (data.users.length < perPage) return null // reached the last page
    page++
  }
}

// Exact, single-lookup user resolution by Supabase auth id — used first.
// The checkout route sets metadata.userId on both the Checkout Session and
// the Subscription it creates (app/api/stripe/checkout/route.js), so this
// is available on every event below without needing to guess from an email
// Stripe collected at checkout, which is not guaranteed to exactly match
// the account's signup email (case, aliasing, or the customer editing it
// in Stripe's hosted checkout page).
export async function getUserById(supabase, userId) {
  if (!userId) return null
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !data?.user) return null
  return data.user
}

export async function resolveUser(supabase, { userId, email }) {
  return (await getUserById(supabase, userId)) || getUserByEmail(supabase, email)
}

async function getEmailFromCustomer(customerId) {
  const customer = await stripe.customers.retrieve(customerId)
  return customer?.email || null
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
        to: process.env.OWNER_EMAIL || 'support@glowmetrics.co',
        subject,
        text,
      }),
    })
  } catch (e) {
    console.error('Resend notification failed:', e.message)
  }
}

// Updates profiles and returns whether it actually succeeded
async function updateProfile(supabase, userId, update) {
  const { error } = await supabase.from('profiles').update(update).eq('id', userId)
  if (error) {
    console.error(`Webhook: failed to update profile ${userId} with`, update, error.message)
    return false
  }
  return true
}

// subscriptions.plan_type has a CHECK constraint limited to these values —
// map Stripe's billing interval onto the closest one instead of writing
// something like "pro" that the constraint would reject outright.
function planTypeFor(sub) {
  const interval = sub.items?.data?.[0]?.price?.recurring?.interval
  return interval === 'year' ? 'standard_annual' : 'standard_monthly'
}

function billingCycleFor(sub) {
  const interval = sub.items?.data?.[0]?.price?.recurring?.interval
  return interval === 'year' ? 'annual' : 'monthly'
}

// Keeps public.subscriptions (read by /api/admin/stats and /api/admin-stats
// for subscriber/revenue counts) in sync with what the webhook already
// writes to profiles. Previously this table was only ever touched by
// handle_new_user() at signup (always plan_type='free') and by one-off
// manual SQL patches (see 20260912_emergency_fix_emmyfox2_subscription_sync.sql)
// — every real subscribe/renew/cancel silently left it stale.
async function upsertSubscriptionRecord(supabase, userId, fields) {
  const { error } = await supabase
    .from('subscriptions')
    .upsert({ user_id: userId, updated_at: new Date().toISOString(), ...fields }, { onConflict: 'user_id' })
  if (error) {
    console.error(`Webhook: failed to upsert subscriptions row for ${userId}:`, error.message)
    return false
  }
  return true
}

// Log subscription events for audit trail and debugging
async function logSubscriptionEvent(supabase, userId, eventType, details) {
  try {
    await supabase.rpc('log_subscription_event', {
      p_user_id: userId,
      p_event_type: eventType,
      p_stripe_event_id: details.stripeEventId || null,
      p_customer_id: details.customerId || null,
      p_subscription_id: details.subscriptionId || null,
      p_prev_plan: details.previousPlan || null,
      p_new_plan: details.newPlan || null,
      p_details: details,
    })
  } catch (e) {
    console.error(`Failed to log subscription event: ${e.message}`)
  }
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
        const email = session.customer_details?.email || session.customer_email
        const user = await resolveUser(supabase, { userId: session.metadata?.userId, email })
        if (!user) {
          console.error(`Webhook checkout.session.completed: could not resolve a user (userId=${session.metadata?.userId}, email=${email})`)
          break
        }

        // Whether this is trialing or already active gets set precisely by
        // customer.subscription.created/updated (fired for the same
        // checkout, momentarily before or after this event) — grant Pro
        // access here without guessing a status this event can't see.
        const update = {
          plan: 'pro',
          stripe_customer_id: session.customer,
        }

        const ok = await updateProfile(supabase, user.id, update)
        if (!ok) {
          console.error(`Webhook checkout: failed to save customer ID for ${email}`)
          // Log event but don't fail — we want Stripe to consider this successful
          // even if our DB update has issues
        }

        await logSubscriptionEvent(supabase, user.id, 'subscription_started', {
          stripeEventId: event.id,
          customerId: session.customer,
          newPlan: 'pro',
        })

        await sendResendNotification(
          `💰 New CamCash Subscriber — ${email}`,
          `${email} just completed payment and subscribed to Pro plan.`
        )
        break
      }

      case 'customer.subscription.created': {
        const sub = event.data.object
        const email = await getEmailFromCustomer(sub.customer)
        const user = await resolveUser(supabase, { userId: sub.metadata?.userId, email })
        if (!user) {
          console.error(`Webhook subscription.created: could not resolve a user (userId=${sub.metadata?.userId}, email=${email})`)
          break
        }

        // Carry Stripe's actual status through (trialing/active/past_due/unpaid/...)
        // instead of collapsing every non-trialing status into 'active' — a
        // past_due or unpaid subscription must not read as 'active' downstream.
        const subscriptionStatus = sub.status

        const update = {
          plan: 'pro',
          stripe_customer_id: sub.customer,
          stripe_subscription_id: sub.id,
          subscription_status: subscriptionStatus,
          trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        }

        const ok = await updateProfile(supabase, user.id, update)
        if (!ok) {
          console.error(`Webhook subscription.created: failed to save subscription data for ${email}`)
        }

        await upsertSubscriptionRecord(supabase, user.id, {
          stripe_customer_id: sub.customer,
          stripe_subscription_id: sub.id,
          stripe_price_id: sub.items?.data?.[0]?.price?.id || null,
          plan_type: planTypeFor(sub),
          billing_cycle: billingCycleFor(sub),
          status: sub.status,
          current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        })

        await logSubscriptionEvent(supabase, user.id, 'subscription_started', {
          stripeEventId: event.id,
          customerId: sub.customer,
          subscriptionId: sub.id,
          newPlan: 'pro',
          details: { status: sub.status, trialEnd: sub.trial_end },
        })

        await sendResendNotification(
          `💰 New Subscription — ${email}`,
          `${email} started a ${subscriptionStatus} subscription (ID: ${sub.id}).`
        )
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const email = await getEmailFromCustomer(sub.customer)
        const user = await resolveUser(supabase, { userId: sub.metadata?.userId, email })
        if (!user) {
          console.error(`Webhook subscription.deleted: could not resolve a user (userId=${sub.metadata?.userId}, email=${email})`)
          break
        }

        const update = {
          plan: 'free',
          subscription_status: 'canceled',
          trial_ends_at: null,
        }

        const ok = await updateProfile(supabase, user.id, update)
        if (!ok) {
          console.error(`Webhook subscription.deleted: failed to downgrade ${email}`)
        }

        await upsertSubscriptionRecord(supabase, user.id, {
          plan_type: 'free',
          billing_cycle: null,
          status: 'canceled',
        })

        await logSubscriptionEvent(supabase, user.id, 'subscription_canceled', {
          stripeEventId: event.id,
          customerId: sub.customer,
          subscriptionId: sub.id,
          previousPlan: 'pro',
          newPlan: 'free',
        })

        await sendResendNotification(
          `❌ Subscription Canceled — ${email}`,
          `${email} cancelled their subscription.`
        )
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const email = await getEmailFromCustomer(sub.customer)
        const user = await resolveUser(supabase, { userId: sub.metadata?.userId, email })
        if (!user) {
          console.error(`Webhook subscription.updated: could not resolve a user (userId=${sub.metadata?.userId}, email=${email})`)
          break
        }

        // Carry Stripe's actual status through (see subscription.created above) —
        // plan is the pro/free gate; subscription_status must reflect what
        // Stripe actually reports (e.g. past_due) so it isn't mistaken for a
        // healthy 'active' subscription downstream.
        const subscriptionStatus = sub.status
        const plan = (sub.status === 'active' || sub.status === 'trialing') ? 'pro' : 'free'

        const update = {
          plan,
          stripe_subscription_id: sub.id,
          subscription_status: subscriptionStatus,
          trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        }

        const ok = await updateProfile(supabase, user.id, update)
        if (!ok) {
          console.error(`Webhook subscription.updated: failed to update ${email}`)
        }

        await upsertSubscriptionRecord(supabase, user.id, {
          stripe_customer_id: sub.customer,
          stripe_subscription_id: sub.id,
          stripe_price_id: sub.items?.data?.[0]?.price?.id || null,
          plan_type: plan === 'pro' ? planTypeFor(sub) : 'free',
          billing_cycle: plan === 'pro' ? billingCycleFor(sub) : null,
          status: sub.status,
          current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        })

        await logSubscriptionEvent(supabase, user.id, 'subscription_updated', {
          stripeEventId: event.id,
          customerId: sub.customer,
          subscriptionId: sub.id,
          newPlan: plan,
          details: { status: sub.status, reason: event.data.previous_attributes },
        })

        if (plan === 'pro') {
          await sendResendNotification(
            `💰 Subscription Updated — ${email}`,
            `${email}'s subscription is now ${subscriptionStatus}.`
          )
        } else {
          await sendResendNotification(
            `❌ Subscription Issue — ${email}`,
            `${email}'s subscription status changed to ${sub.status}.`
          )
        }
        break
      }

      default:
        console.warn(`Unhandled Stripe event type: ${event.type}`)
        // Return success for unhandled events so Stripe doesn't retry
        break
    }

    // ALWAYS return 200 success to acknowledge receipt and prevent Stripe retries
    // Database errors are logged above but shouldn't block the webhook response
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    // Still return 200 to prevent Stripe from retrying indefinitely
    return NextResponse.json({ received: true, error: err.message })
  }
}

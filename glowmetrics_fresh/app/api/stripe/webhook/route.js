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

async function getUserByEmail(supabase, email) {
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) return null
  return data.users.find(u => u.email === email) || null
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
        if (!email) break

        const user = await getUserByEmail(supabase, email)
        if (!user) break

        const update = {
          plan: 'pro',
          stripe_customer_id: session.customer,
          subscription_status: 'active',
          trial_ends_at: null, // Trial is over, they have a paid subscription
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
        if (!email) break

        const user = await getUserByEmail(supabase, email)
        if (!user) break

        // Determine subscription status based on Stripe status
        const subscriptionStatus = sub.status === 'trialing' ? 'trialing' : 'active'

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
        if (!email) break

        const user = await getUserByEmail(supabase, email)
        if (!user) break

        const update = {
          plan: 'free',
          subscription_status: 'canceled',
          trial_ends_at: null,
        }

        const ok = await updateProfile(supabase, user.id, update)
        if (!ok) {
          console.error(`Webhook subscription.deleted: failed to downgrade ${email}`)
        }

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
        if (!email) break

        const user = await getUserByEmail(supabase, email)
        if (!user) break

        const subscriptionStatus = sub.status === 'trialing' ? 'trialing' : 'active'
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

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { resolveUserIdForEvent } from '../../../../lib/stripeWebhookUser'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
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

async function getCurrentPlan(supabase, userId) {
  const { data, error } = await supabase.from('profiles').select('plan').eq('id', userId).single()
  if (error) {
    console.error(`Webhook: failed to read current plan for ${userId}`, error.message)
    return null
  }
  return data?.plan ?? null
}

// Resolves the user for an event and logs (rather than silently returning)
// when a paying customer can't be matched to any account — that case should
// be loud, not swallowed, since it means a real payment has no user to grant.
async function resolveUser(supabase, { metadataUserId, customerEmail, eventType }) {
  const { userId, matchedBy } = await resolveUserIdForEvent(supabase, { metadataUserId, customerEmail, eventType })
  if (!userId) {
    console.error(`Webhook: could not match any user for ${eventType} (customer email: ${customerEmail || 'unknown'}, metadata userId: ${metadataUserId || 'none'})`)
  }
  return userId
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
        const userId = await resolveUser(supabase, {
          metadataUserId: session.metadata?.userId,
          customerEmail: email,
          eventType: event.type,
        })
        if (!userId) break

        const previousPlan = await getCurrentPlan(supabase, userId)
        const update = { plan: 'pro' }
        if (session.customer) update.stripe_customer_id = session.customer
        const ok = await updateProfile(supabase, userId, update)
        if (!ok) {
          return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
        }
        // Only notify on an actual free -> pro transition, so a duplicate
        // delivery of the same event doesn't re-send the subscriber email.
        if (previousPlan !== 'pro') {
          await sendResendNotification(
            `💰 New CamCash Subscriber — ${email || userId} subscribed to Pro`,
            `${email || userId} just subscribed to the Pro plan.`
          )
        }
        break
      }

      case 'customer.subscription.created': {
        const sub = event.data.object
        const email = await getEmailFromCustomer(sub.customer)
        const userId = await resolveUser(supabase, {
          metadataUserId: sub.metadata?.userId,
          customerEmail: email,
          eventType: event.type,
        })
        if (!userId) break

        const previousPlan = await getCurrentPlan(supabase, userId)
        const update = { plan: 'pro' }
        if (sub.customer) update.stripe_customer_id = sub.customer
        const ok = await updateProfile(supabase, userId, update)
        if (!ok) {
          return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
        }
        if (previousPlan !== 'pro') {
          await sendResendNotification(
            `💰 New CamCash Subscriber — ${email || userId} subscribed to Pro`,
            `${email || userId} just subscribed to the Pro plan.`
          )
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const email = await getEmailFromCustomer(sub.customer)
        const userId = await resolveUser(supabase, {
          metadataUserId: sub.metadata?.userId,
          customerEmail: email,
          eventType: event.type,
        })
        if (!userId) break

        const previousPlan = await getCurrentPlan(supabase, userId)
        const ok = await updateProfile(supabase, userId, { plan: 'free' })
        if (!ok) {
          return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
        }
        if (previousPlan !== 'free') {
          await sendResendNotification(
            `❌ CamCash Cancellation — ${email || userId} cancelled their subscription`,
            `${email || userId} cancelled their Pro subscription.`
          )
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const email = await getEmailFromCustomer(sub.customer)
        const userId = await resolveUser(supabase, {
          metadataUserId: sub.metadata?.userId,
          customerEmail: email,
          eventType: event.type,
        })
        if (!userId) break

        const previousPlan = await getCurrentPlan(supabase, userId)
        const plan = sub.status === 'active' ? 'pro' : 'free'
        const ok = await updateProfile(supabase, userId, { plan })
        if (!ok) {
          return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
        }
        if (plan !== previousPlan) {
          if (plan === 'pro') {
            await sendResendNotification(
              `💰 New CamCash Subscriber — ${email || userId} subscribed to Pro`,
              `${email || userId} reactivated their Pro plan.`
            )
          } else {
            await sendResendNotification(
              `❌ CamCash Cancellation — ${email || userId} cancelled their subscription`,
              `${email || userId}'s subscription status changed to ${sub.status}.`
            )
          }
        }
        break
      }

      default:
        // Stripe retries indefinitely on any non-2xx response. Events we
        // deliberately don't act on (e.g. invoice.*, payment_method.*) must
        // still return success, or Stripe will keep redelivering them forever.
        return NextResponse.json({ received: true, ignored: event.type })
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

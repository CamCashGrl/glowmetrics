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

// Resolve which app user an event belongs to. Prefers the userId we stamped
// into metadata at checkout time (session.metadata / subscription.metadata)
// over the customer_id lookup, and only falls back to an email search —
// via profiles.stripe_customer_id first, then Stripe customer email — when
// metadata isn't present (e.g. events created outside our checkout flow).
async function resolveUserId(supabase, { metadataUserId, customerId, email }) {
  if (metadataUserId) return metadataUserId

  if (customerId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()
    if (profile?.id) return profile.id
  }

  const resolvedEmail = email || (customerId ? await getEmailFromCustomer(customerId) : null)
  if (!resolvedEmail) return null
  const user = await getUserByEmail(supabase, resolvedEmail)
  return user?.id || null
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
        const userId = await resolveUserId(supabase, {
          metadataUserId: session.metadata?.userId,
          customerId: session.customer,
          email,
        })
        if (!userId) break
        const update = { plan: 'pro' }
        if (session.customer) update.stripe_customer_id = session.customer
        if (session.metadata?.plan_type) update.plan_type = session.metadata.plan_type
        await supabase.from('profiles').update(update).eq('id', userId)
        await sendResendNotification(
          `💰 New CamCash Subscriber — ${email || userId} subscribed to Pro`,
          `${email || userId} just subscribed to the Pro plan.`
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
        const update = { plan: 'pro' }
        if (sub.customer) update.stripe_customer_id = sub.customer
        if (sub.metadata?.plan_type) update.plan_type = sub.metadata.plan_type
        if (sub.current_period_end) update.plan_expires_at = new Date(sub.current_period_end * 1000).toISOString()
        await supabase.from('profiles').update(update).eq('id', userId)
        const email = await getEmailFromCustomer(sub.customer)
        await sendResendNotification(
          `💰 New CamCash Subscriber — ${email || userId} subscribed to Pro`,
          `${email || userId} just subscribed to the Pro plan.`
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
        await supabase.from('profiles').update({ plan: 'free', plan_type: null, plan_expires_at: null }).eq('id', userId)
        const email = await getEmailFromCustomer(sub.customer)
        await sendResendNotification(
          `❌ CamCash Cancellation — ${email || userId} cancelled their subscription`,
          `${email || userId} cancelled their Pro subscription.`
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
        const plan = sub.status === 'active' || sub.status === 'trialing' ? 'pro' : 'free'
        const update = { plan }
        if (sub.metadata?.plan_type) update.plan_type = plan === 'pro' ? sub.metadata.plan_type : null
        update.plan_expires_at = sub.current_period_end && plan === 'pro'
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null
        await supabase.from('profiles').update(update).eq('id', userId)
        const email = await getEmailFromCustomer(sub.customer)
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
        break
      }

      default:
        // Intentionally ignored event type — respond 200 so Stripe doesn't
        // treat it as a delivery failure and retry/alert on it.
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

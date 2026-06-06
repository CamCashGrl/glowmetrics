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
        if (!email) break
        const user = await getUserByEmail(supabase, email)
        if (!user) break
        const update = { plan: 'pro' }
        if (session.customer) update.stripe_customer_id = session.customer
        await supabase.from('profiles').update(update).eq('id', user.id)
        await sendResendNotification(
          `💰 New CamCash Subscriber — ${email} subscribed to Pro`,
          `${email} just subscribed to the Pro plan.`
        )
        break
      }

      case 'customer.subscription.created': {
        const sub = event.data.object
        const email = await getEmailFromCustomer(sub.customer)
        if (!email) break
        const user = await getUserByEmail(supabase, email)
        if (!user) break
        const update = { plan: 'pro' }
        if (sub.customer) update.stripe_customer_id = sub.customer
        await supabase.from('profiles').update(update).eq('id', user.id)
        await sendResendNotification(
          `💰 New CamCash Subscriber — ${email} subscribed to Pro`,
          `${email} just subscribed to the Pro plan.`
        )
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const email = await getEmailFromCustomer(sub.customer)
        if (!email) break
        const user = await getUserByEmail(supabase, email)
        if (!user) break
        await supabase.from('profiles').update({ plan: 'free' }).eq('id', user.id)
        await sendResendNotification(
          `❌ CamCash Cancellation — ${email} cancelled their subscription`,
          `${email} cancelled their Pro subscription.`
        )
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const email = await getEmailFromCustomer(sub.customer)
        if (!email) break
        const user = await getUserByEmail(supabase, email)
        if (!user) break
        const plan = sub.status === 'active' ? 'pro' : 'free'
        await supabase.from('profiles').update({ plan }).eq('id', user.id)
        if (plan === 'pro') {
          await sendResendNotification(
            `💰 New CamCash Subscriber — ${email} subscribed to Pro`,
            `${email} reactivated their Pro plan.`
          )
        } else {
          await sendResendNotification(
            `❌ CamCash Cancellation — ${email} cancelled their subscription`,
            `${email}'s subscription status changed to ${sub.status}.`
          )
        }
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

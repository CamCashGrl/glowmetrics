import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Cron endpoint — must run fresh on every invocation (real DB state, never
// a build-time snapshot). Same reasoning as the other cron routes.
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Mirrors the plan-gate logic in app/api/stripe/webhook/route.js — a
// subscription only earns 'pro' while it's active or trialing; everything
// else (past_due, unpaid, canceled, incomplete_expired, ...) should read
// as 'free'/that Stripe status, never as a healthy 'active'.
function expectedPlanFor(stripeStatus) {
  return stripeStatus === 'active' || stripeStatus === 'trialing' ? 'pro' : 'free'
}

async function sendDriftAlert(mismatches) {
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
        subject: `⚠️ Subscription drift: ${mismatches.length} profile(s) out of sync with Stripe`,
        text: mismatches.map(m =>
          `user ${m.userId} (sub ${m.stripeSubscriptionId}): ` +
          `Stripe says status=${m.stripeStatus}, Supabase has subscription_status=${m.dbStatus}, plan=${m.dbPlan} ` +
          `(expected plan=${m.expectedPlan})`
        ).join('\n'),
      }),
    })
  } catch (e) {
    console.error('[cron/check-subscription-drift] Failed to send alert email:', e.message)
  }
}

// Catches the class of bug found in the Sept 19 audit: the webhook writing
// a Stripe status into Supabase incorrectly (or a webhook delivery being
// missed entirely) leaves profiles.subscription_status silently wrong until
// someone happens to look. This compares Stripe's live status against what
// Supabase has on file for every profile with a Stripe subscription, and
// alerts instead of relying on a human noticing during an unrelated task.
// Read-only — reports mismatches, never writes anything.
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: profiles, error: selectError } = await supabase
    .from('profiles')
    .select('id, plan, subscription_status, stripe_subscription_id')
    .not('stripe_subscription_id', 'is', null)
    .limit(500)

  if (selectError) {
    console.error('[cron/check-subscription-drift] select failed:', selectError.message)
    return NextResponse.json({ success: false, error: selectError.message }, { status: 500 })
  }

  if (!profiles?.length) {
    return NextResponse.json({ success: true, checked: 0, mismatches: [] })
  }

  const mismatches = []
  let checked = 0

  for (const profile of profiles) {
    let sub
    try {
      sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id)
    } catch (e) {
      // Deleted/invalid subscription IDs are a separate, lower-urgency data
      // hygiene issue — log but don't fail the whole run over one bad row.
      console.error(`[cron/check-subscription-drift] could not retrieve ${profile.stripe_subscription_id}:`, e.message)
      continue
    }
    checked++

    const expectedPlan = expectedPlanFor(sub.status)
    const statusMismatch = profile.subscription_status !== sub.status
    const planMismatch = profile.plan !== expectedPlan

    if (statusMismatch || planMismatch) {
      mismatches.push({
        userId: profile.id,
        stripeSubscriptionId: profile.stripe_subscription_id,
        stripeStatus: sub.status,
        dbStatus: profile.subscription_status,
        dbPlan: profile.plan,
        expectedPlan,
      })
    }
  }

  if (mismatches.length > 0) {
    console.warn(`[cron/check-subscription-drift] found ${mismatches.length} mismatch(es):`, mismatches)
    await sendDriftAlert(mismatches)
  }

  return NextResponse.json({ success: true, checked, mismatches })
}

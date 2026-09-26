import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '../../../../../lib/supabase-server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Create or retrieve 50% off coupon
async function getOrCreateRetentionCoupon() {
  try {
    // Try to get existing coupon
    const coupons = await stripe.coupons.list({ limit: 100 })
    const existing = coupons.data.find(c => c.id === 'RETENTION_50OFF')

    if (existing) return existing

    // Create new coupon if it doesn't exist
    return await stripe.coupons.create({
      id: 'RETENTION_50OFF',
      percent_off: 50,
      duration: 'repeating',
      duration_in_months: 1,
      max_redemptions: 10000
    })
  } catch (e) {
    console.error('Coupon error:', e)
    throw e
  }
}

export async function POST(request) {
  try {
    const supabase = createSupabaseRouteClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id, plan')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    if (!profile.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
    }

    // Get or create retention coupon
    const coupon = await getOrCreateRetentionCoupon()

    // Apply coupon to subscription
    const updatedSub = await stripe.subscriptions.update(
      profile.stripe_subscription_id,
      {
        coupon: coupon.id,
        cancel_at_period_end: false // Un-cancel if it was scheduled for cancellation
      }
    )

    // Log the retention offer acceptance
    await supabase.from('user_lifecycle_events').insert({
      user_id: user.id,
      event_type: 'retention_offer_accepted',
      new_value: '50% discount applied for 1 month',
      reason: 'user_accepted_retention_offer',
      properties: {
        coupon_id: coupon.id,
        discount_percent: 50,
        duration_months: 1
      },
      stripe_event_id: `retention_offer_${Date.now()}`
    })

    return NextResponse.json({
      success: true,
      message: 'Great! Your subscription has been updated with 50% off. Your next bill will reflect this discount.',
      discount: '50% OFF for 1 month',
      nextBillingAmount: updatedSub.lines.data[0]?.amount / 100 / 2 // Approximate, Stripe will calculate exact
    })
  } catch (error) {
    console.error('Retention offer error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

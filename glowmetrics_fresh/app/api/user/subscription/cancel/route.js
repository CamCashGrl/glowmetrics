import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '../../../../../lib/supabase-server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  try {
    const supabase = createSupabaseRouteClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { surveyData } = await request.json()

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, plan, subscription_status, plan_expires_at')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    if (!profile.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
    }

    // Cancel the Stripe subscription
    const canceledSub = await stripe.subscriptions.update(
      profile.stripe_subscription_id,
      { cancel_at_period_end: true }
    )

    // Calculate subscription duration
    const planExpiresAt = profile.plan_expires_at ? new Date(profile.plan_expires_at) : new Date()
    const now = new Date()
    const durationDays = Math.floor((planExpiresAt - now) / (1000 * 60 * 60 * 24))

    // Record the exit survey
    await supabase.from('user_exit_surveys').insert({
      user_id: user.id,
      survey_type: 'subscription_cancel',
      reason: surveyData?.reason || 'no_reason_provided',
      details: surveyData?.details || null,
      survey_answers: surveyData || {},
      user_email: user.email,
      user_plan: profile.plan,
      months_active: Math.floor(durationDays / 30),
      subscription_duration_days: Math.max(0, durationDays)
    })

    // Log the lifecycle event
    await supabase.from('user_lifecycle_events').insert({
      user_id: user.id,
      event_type: 'subscription_canceled',
      old_value: profile.subscription_status,
      new_value: 'canceled',
      reason: surveyData?.reason || 'user_initiated',
      properties: surveyData || {},
      stripe_event_id: `manual_cancel_${Date.now()}`
    })

    return NextResponse.json({
      success: true,
      message: 'Subscription will be canceled at the end of your billing period',
      canceledAt: canceledSub.canceled_at,
      endsAt: canceledSub.current_period_end * 1000
    })
  } catch (error) {
    console.error('Cancel subscription error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

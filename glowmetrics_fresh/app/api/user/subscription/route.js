import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '../../../../lib/supabase-server'

export async function GET(request) {
  try {
    const supabase = createSupabaseRouteClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch subscription data from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan, subscription_status, plan_expires_at, stripe_customer_id, stripe_subscription_id')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Failed to fetch profile subscription:', profileError.message)
      return NextResponse.json({ error: 'Failed to load subscription' }, { status: 500 })
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Determine billing cycle from subscription status and plan
    // Default to monthly, but this would come from Stripe if we fetch subscription details
    const billingCycle = profile.plan === 'pro' ? 'monthly' : 'free'

    return NextResponse.json({
      plan: profile.plan,
      subscription_status: profile.subscription_status,
      plan_expires_at: profile.plan_expires_at,
      stripe_customer_id: profile.stripe_customer_id,
      stripe_subscription_id: profile.stripe_subscription_id,
      billing_cycle: billingCycle,
      is_pro: profile.plan === 'pro'
    })
  } catch (error) {
    console.error('Subscription fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

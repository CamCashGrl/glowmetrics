import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

// Gets (or creates) a Stripe customer for this user, using `profiles` as the
// single source of truth for stripe_customer_id — matching what the webhook
// and the dashboard both read.
export const getStripeCustomerId = async (userId, email) => {
  const { supabase } = await import('./supabase')
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (fetchError) {
    console.error('getStripeCustomerId: failed to read profile', fetchError.message)
  }

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { userId }
  })

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId)

  if (updateError) {
    console.error('getStripeCustomerId: failed to save stripe_customer_id', updateError.message)
  }

  return customer.id
}

// Check if user has pro access (either paid subscription or valid trial)
export const hasProAccess = async (userId) => {
  const { supabase } = await import('./supabase')
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('plan, trial_ends_at, subscription_status')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    return false
  }

  if (profile.plan !== 'pro') {
    return false
  }

  // subscription_status is authoritative — Stripe leaves trial_end populated
  // with the original trial date even after the subscription goes active, so
  // checking trial_ends_at first would incorrectly lock out paying customers
  // once that date passes.
  if (profile.subscription_status === 'active' || profile.subscription_status === 'trialing') {
    return true
  }

  // subscription_status missing/unknown — fall back to the trial window.
  if (!profile.subscription_status && profile.trial_ends_at) {
    return new Date(profile.trial_ends_at) > new Date()
  }

  return false
}

// Get user's plan details
export const getUserPlanDetails = async (userId) => {
  const { supabase } = await import('./supabase')
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('plan, trial_ends_at, subscription_status, stripe_customer_id, stripe_subscription_id')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    return {
      plan: 'free',
      hasAccess: false,
      isTrialing: false,
      trialEndsAt: null,
      subscriptionStatus: 'none',
    }
  }

  const isTrialing = profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date()
  const hasAccess = profile.plan === 'pro' && (isTrialing || profile.subscription_status === 'active' || profile.subscription_status === 'trialing')

  return {
    plan: profile.plan,
    hasAccess,
    isTrialing,
    trialEndsAt: profile.trial_ends_at,
    subscriptionStatus: profile.subscription_status,
    stripeCustomerId: profile.stripe_customer_id,
    stripeSubscriptionId: profile.stripe_subscription_id,
  }
}

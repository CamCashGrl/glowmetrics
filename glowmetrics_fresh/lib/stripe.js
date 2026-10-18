import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

export const getStripeCustomerId = async (userId, email) => {
  const { supabase } = await import('./supabase')
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (fetchError) console.error('getStripeCustomerId: failed to read profile', fetchError.message)
  if (profile?.stripe_customer_id) return profile.stripe_customer_id

  const customer = await stripe.customers.create({ email, metadata: { userId } })
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId)

  if (updateError) console.error('getStripeCustomerId: failed to save stripe_customer_id', updateError.message)
  return customer.id
}

function validTrial(profile, now = new Date()) {
  if (profile?.subscription_status !== 'trialing') return false
  if (!profile?.trial_ends_at) return true
  const end = new Date(profile.trial_ends_at)
  return !Number.isNaN(end.getTime()) && end > now
}

// Full Pro means paid/active. Stripe trialing is deliberately capped elsewhere
// and must never be treated as unlimited Pro access.
export const hasProAccess = async (userId) => {
  const { supabase } = await import('./supabase')
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('plan, subscription_status')
    .eq('id', userId)
    .single()

  if (error || !profile) return false
  if (profile.plan === 'unlimited') return true
  return profile.plan === 'pro' && profile.subscription_status === 'active'
}

export const hasTrialAccess = async (userId) => {
  const { supabase } = await import('./supabase')
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('trial_ends_at, subscription_status')
    .eq('id', userId)
    .single()

  return !error && !!profile && validTrial(profile)
}

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
      accessTier: 'free',
      hasAccess: false,
      hasFullHistoryAccess: false,
      isTrialing: false,
      trialEndsAt: null,
      subscriptionStatus: 'none',
    }
  }

  const isTrialing = validTrial(profile)
  const paidPro = profile.plan === 'unlimited' || (profile.plan === 'pro' && profile.subscription_status === 'active')

  return {
    plan: profile.plan,
    accessTier: paidPro ? 'pro' : isTrialing ? 'trial' : 'free',
    hasAccess: paidPro,
    hasFullHistoryAccess: paidPro,
    isTrialing,
    trialEndsAt: profile.trial_ends_at,
    subscriptionStatus: profile.subscription_status,
    stripeCustomerId: profile.stripe_customer_id,
    stripeSubscriptionId: profile.stripe_subscription_id,
  }
}

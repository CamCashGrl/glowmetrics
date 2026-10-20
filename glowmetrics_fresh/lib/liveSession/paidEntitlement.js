// Live routes must verify paid access before bypassing start/duration caps.
// Keep the existing legacy unlimited exception; never infer paid access from
// a stale pro/active profile. Lookup failures propagate so heartbeats can retry
// without stopping a legitimate paid stream during a billing outage.
export async function verifyLiveModeProfile(profile) {
  if (profile?.plan === 'unlimited') return profile
  if (profile?.plan !== 'pro' || profile.subscription_status !== 'active') return profile

  let paid = false
  if (profile.stripe_subscription_id && profile.stripe_customer_id) {
    const { stripe } = await import('../stripe')
    try {
      const subscription = await stripe.subscriptions.retrieve(
        profile.stripe_subscription_id, {}, { timeout: 5000, maxNetworkRetries: 0 },
      )
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer : subscription.customer?.id
      paid = subscription.id === profile.stripe_subscription_id
        && subscription.status === 'active'
        && customerId === profile.stripe_customer_id
    } catch (error) {
      if (error.code !== 'resource_missing') throw error
    }
  }
  return paid ? profile : { ...profile, plan: 'free' }
}

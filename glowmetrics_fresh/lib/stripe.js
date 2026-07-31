import Stripe from 'stripe'

// .trim() guards against a stray trailing newline/space in the env var value
// (a common copy-paste mistake in Vercel's dashboard) which otherwise surfaces
// as a cryptic ERR_INVALID_CHAR on the Authorization header at request time.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY?.trim(), {
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

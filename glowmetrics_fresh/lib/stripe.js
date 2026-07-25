import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

export const getStripeCustomerId = async (userId, email) => {
  const { supabase } = await import('./supabase')
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { userId }
  })

  await supabase.from('profiles').update({
    stripe_customer_id: customer.id
  }).eq('id', userId)

  return customer.id
}

// lib/stripe.js
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

export const getStripeCustomerId = async (userId, email) => {
  // Check if customer exists in Supabase
  const { supabase } = await import('./supabase')
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single()

  if (subscription?.stripe_customer_id) {
    return subscription.stripe_customer_id
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: { userId }
  })

  // Save to database
  await supabase.from('subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: customer.id,
    status: 'free'
  })

  return customer.id
}

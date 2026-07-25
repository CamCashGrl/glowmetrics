// app/api/stripe/checkout/route.js
import { NextResponse } from 'next/server'
import { stripe } from '../../../../lib/stripe'
import { createSupabaseRouteClient } from '../../../../lib/supabase-server'

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const supabase = createSupabaseRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get or create customer
    let customerId
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id }
      })
      customerId = customer.id

      await supabase.from('profiles').update({
        stripe_customer_id: customerId
      }).eq('id', user.id)
    }
    
    // Resolve the correct Stripe price ID based on plan_type
    const planType = body.plan_type || 'standard_monthly'

    const PRICE_MAP = {
      early_adopter_monthly: process.env.STRIPE_PRICE_EARLY_ADOPTER_MONTHLY,
      early_adopter_annual:  process.env.STRIPE_PRICE_EARLY_ADOPTER_ANNUAL,
      standard_monthly:      process.env.STRIPE_PRICE_STANDARD_MONTHLY || process.env.NEXT_PUBLIC_STRIPE_PRICE_ID,
      standard_annual:       process.env.STRIPE_PRICE_STANDARD_ANNUAL,
    }

    const priceId = PRICE_MAP[planType] || process.env.NEXT_PUBLIC_STRIPE_PRICE_ID
    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan or price not configured' }, { status: 400 })
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${request.headers.get('origin')}/dashboard?success=true&plan=${planType}`,
      cancel_url: `${request.headers.get('origin')}/pricing?canceled=true`,
      metadata: {
        userId: user.id,
        plan_type: planType,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          plan_type: planType,
        }
      }
    })
    
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

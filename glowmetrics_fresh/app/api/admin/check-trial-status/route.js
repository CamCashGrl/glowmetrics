import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminToken, getAdminTokenFromCookieHeader } from '../../../../lib/adminAuth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function requireAdmin(req) {
  const token = getAdminTokenFromCookieHeader(req.headers.get('cookie'))
  return verifyAdminToken(token)
}

export async function GET(request) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = sb()
    const emails = [
      'gingerdivine3@gmail.com',
      'omgitslilith@proton.me',
      'updating1@camcashgrl.com',
      'venice.mert@dropoffs.org',
    ]

    const results = []

    for (const email of emails) {
      try {
        // Get auth user
        const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()
        if (userError) throw new Error(`Auth list: ${userError.message}`)

        const authUser = users?.find(u => u.email === email)
        if (!authUser) {
          results.push({
            email,
            status: 'NOT_FOUND',
            supabase: { error: 'User not in auth' },
          })
          continue
        }

        // Get profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, plan, trial_ends_at, plan_expires_at, stripe_customer_id')
          .eq('id', authUser.id)
          .single()

        if (profileError || !profile) {
          results.push({
            email,
            status: 'PROFILE_NOT_FOUND',
            supabase: { error: profileError?.message },
          })
          continue
        }

        const supabaseData = {
          userId: authUser.id,
          authCreatedAt: authUser.created_at,
          plan: profile.plan,
          trial_ends_at: profile.trial_ends_at,
          plan_expires_at: profile.plan_expires_at,
          stripe_customer_id: profile.stripe_customer_id,
        }

        // Check Stripe subscriptions
        let stripeData = null
        if (profile.stripe_customer_id) {
          try {
            const subs = await stripe.subscriptions.list({
              customer: profile.stripe_customer_id,
              limit: 10,
            })

            stripeData = {
              customerFound: true,
              subscriptions: subs.data.map(sub => ({
                id: sub.id,
                status: sub.status,
                startDate: new Date(sub.start_date * 1000).toISOString(),
                trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
                currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
                currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
                amountUSD: (sub.items.data[0]?.price?.unit_amount / 100).toFixed(2),
              })),
            }
          } catch (stripeErr) {
            stripeData = { error: stripeErr.message }
          }
        } else {
          stripeData = { note: 'No Stripe customer ID in profile' }
        }

        results.push({
          email,
          status: 'OK',
          supabase: supabaseData,
          stripe: stripeData,
        })
      } catch (err) {
        results.push({
          email,
          status: 'ERROR',
          error: err.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (err) {
    console.error('Check trial status error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

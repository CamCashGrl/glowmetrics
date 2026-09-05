#!/usr/bin/env node

/**
 * Check Free Trial Users - Supabase & Stripe Status
 *
 * Reports on:
 * 1. Supabase profile (plan, trial_ends_at, stripe_customer_id)
 * 2. Stripe subscription (status, current_period_end, etc.)
 */

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const stripeKey = process.env.STRIPE_SECRET_KEY

if (!supabaseUrl || !serviceRoleKey || !stripeKey) {
  console.error('❌ Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)
const stripe = new Stripe(stripeKey)

const TRIAL_USERS = [
  'gingerdivine3@gmail.com',
  'omgitslilith@proton.me',
  'updating1@camcashgrl.com',
  'venice.mert@dropoffs.org',
]

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    year: '2-digit',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function checkUserStatus() {
  console.log('\n📊 TRIAL USERS STATUS CHECK\n')
  console.log('=' .repeat(80))

  for (const email of TRIAL_USERS) {
    console.log(`\n👤 ${email}`)
    console.log('-' .repeat(80))

    try {
      // 1. Get auth user
      const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()
      if (userError) throw new Error(`Auth list: ${userError.message}`)

      const authUser = users?.find(u => u.email === email)
      if (!authUser) {
        console.log('   ❌ NOT FOUND in auth.users')
        continue
      }

      console.log(`   ✅ Auth ID: ${authUser.id}`)
      console.log(`   📅 Created: ${formatDate(authUser.created_at)}`)

      // 2. Get Supabase profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, plan, trial_ends_at, plan_expires_at, stripe_customer_id')
        .eq('id', authUser.id)
        .single()

      if (profileError || !profile) {
        console.log(`   ❌ Profile: NOT FOUND`)
        continue
      }

      console.log(`\n   📋 SUPABASE PROFILE:`)
      console.log(`      plan: ${profile.plan}`)
      console.log(`      trial_ends_at: ${formatDate(profile.trial_ends_at)}`)
      console.log(`      plan_expires_at: ${formatDate(profile.plan_expires_at)}`)
      console.log(`      stripe_customer_id: ${profile.stripe_customer_id || '—'}`)

      // 3. Check Stripe subscription
      if (!profile.stripe_customer_id) {
        console.log(`\n   💳 STRIPE: No customer ID in profile`)
      } else {
        try {
          const subs = await stripe.subscriptions.list({
            customer: profile.stripe_customer_id,
            limit: 10,
          })

          console.log(`\n   💳 STRIPE SUBSCRIPTIONS: (${subs.data.length} found)`)
          if (subs.data.length === 0) {
            console.log(`      ❌ No subscriptions`)
          } else {
            subs.data.forEach((sub, idx) => {
              console.log(`\n      [${idx + 1}] ID: ${sub.id}`)
              console.log(`          Status: ${sub.status}`)
              console.log(`          Started: ${formatDate(new Date(sub.start_date * 1000))}`)
              console.log(`          Trial End: ${sub.trial_end ? formatDate(new Date(sub.trial_end * 1000)) : '—'}`)
              console.log(`          Current Period: ${formatDate(new Date(sub.current_period_start * 1000))} → ${formatDate(new Date(sub.current_period_end * 1000))}`)
              console.log(`          Amount: $${(sub.items.data[0]?.price?.unit_amount / 100).toFixed(2)}/month`)
            })
          }
        } catch (stripeErr) {
          console.log(`\n   💳 STRIPE ERROR: ${stripeErr.message}`)
        }
      }

    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`)
    }
  }

  console.log(`\n${'='.repeat(80)}\n`)
}

checkUserStatus().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

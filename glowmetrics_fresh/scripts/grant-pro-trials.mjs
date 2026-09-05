#!/usr/bin/env node

/**
 * Grant Free Trial Users Pro Access for 30 Days
 *
 * Usage: node scripts/grant-pro-trials.mjs
 *
 * This script:
 * 1. Finds the 4 specified free trial users
 * 2. Updates their plan to 'pro' with 30-day expiry
 * 3. Sends them welcome emails
 * 4. Sends admin notification
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const resendApiKey = process.env.RESEND_API_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

// Users to grant pro access
const TRIAL_USERS = [
  'gingerdivine3@gmail.com',
  'omgitslilith@proton.me',
  'updating1@camcashgrl.com',
  'venice.mert@dropoffs.org',
]

async function sendEmail(to, subject, text) {
  if (!resendApiKey) {
    console.warn(`⚠️  RESEND_API_KEY not set, skipping email to ${to}`)
    return true
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GlowMetrics <hello@glowmetrics.co>',
        to,
        subject,
        text,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return true
  } catch (err) {
    console.error(`❌ Email failed to ${to}:`, err.message)
    return false
  }
}

async function grantProAccess() {
  console.log('🚀 Starting Pro Trial Grant Process...\n')

  // Calculate expiry: 30 days from now
  const now = new Date()
  const expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const expiryISO = expiryDate.toISOString()

  console.log(`📅 Pro access will expire: ${expiryDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })} (${expiryISO})`)
  console.log(`\n📧 Processing ${TRIAL_USERS.length} users:\n`)

  let successCount = 0
  let failCount = 0
  const results = []

  for (const email of TRIAL_USERS) {
    try {
      // Get auth user by email
      const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()
      if (userError) throw new Error(`Failed to list users: ${userError.message}`)

      const authUser = users?.find(u => u.email === email)
      if (!authUser) {
        console.log(`❌ ${email}: User not found in auth.users`)
        results.push({ email, status: 'NOT_FOUND', reason: 'User not in auth.users' })
        failCount++
        continue
      }

      const userId = authUser.id

      // Update profile
      const { data: profileData, error: updateError } = await supabase
        .from('profiles')
        .update({
          plan: 'pro',
          plan_expires_at: expiryISO,
        })
        .eq('id', userId)
        .select()
        .single()

      if (updateError) {
        console.log(`❌ ${email}: Database update failed - ${updateError.message}`)
        results.push({ email, status: 'UPDATE_FAILED', reason: updateError.message })
        failCount++
        continue
      }

      // Send welcome email
      const emailSent = await sendEmail(
        email,
        '🎉 You\'ve Been Granted 1 Month of GlowMetrics Pro!',
        `Hi there!\n\nGood news! You've been granted 1 month of complimentary GlowMetrics Pro access.\n\nYour pro features are now active and will remain available until ${expiryDate.toLocaleDateString('en-US')}.\n\nLog in to your dashboard to get started: https://www.glowmetrics.co/dashboard\n\nEnjoy your pro features!\n\nBest,\nThe GlowMetrics Team`
      )

      if (!emailSent) {
        console.log(`⚠️  ${email}: Profile updated but email delivery failed`)
        results.push({ email, status: 'EMAIL_FAILED', userId })
        failCount++
      } else {
        console.log(`✅ ${email}: Pro access granted + email sent`)
        results.push({ email, status: 'SUCCESS', userId, expiryDate: expiryISO })
        successCount++
      }
    } catch (err) {
      console.log(`❌ ${email}: ${err.message}`)
      results.push({ email, status: 'ERROR', reason: err.message })
      failCount++
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 Summary: ${successCount} succeeded, ${failCount} failed`)
  console.log(`${'='.repeat(60)}\n`)

  // Send admin notification
  if (resendApiKey) {
    const summaryText = results.map(r => {
      const base = `${r.email}: ${r.status}`
      if (r.reason) return `${base} (${r.reason})`
      return base
    }).join('\n')

    await sendEmail(
      'daphneoncam@gmail.com',
      `🎯 Pro Trial Grant Complete — ${successCount}/${TRIAL_USERS.length} successful`,
      `Pro trial grant process completed.\n\nExpiry Date: ${expiryDate.toLocaleDateString('en-US')}\n\nResults:\n${summaryText}`
    )
  }

  // Return exit code based on success
  process.exit(failCount > 0 ? 1 : 0)
}

grantProAccess().catch(err => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})

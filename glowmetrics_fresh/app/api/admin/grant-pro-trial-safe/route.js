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

async function sendEmail(to, subject, text) {
  if (!process.env.RESEND_API_KEY) return true
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GlowMetrics <hello@glowmetrics.co>',
        to,
        subject,
        text,
      }),
    })
    return true
  } catch (err) {
    console.error(`Email failed to ${to}:`, err.message)
    return false
  }
}

export async function POST(request) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { emails, days = 30 } = body

    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'emails array required (non-empty)' },
        { status: 400 }
      )
    }

    if (days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'days must be between 1 and 365' },
        { status: 400 }
      )
    }

    const supabase = sb()
    const results = []
    const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    const expiryISO = expiryDate.toISOString()

    for (const email of emails) {
      try {
        // 1. Find auth user
        const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()
        if (userError) throw new Error(`Auth list failed: ${userError.message}`)

        const authUser = users?.find(u => u.email === email)
        if (!authUser) {
          results.push({ email, status: 'NOT_FOUND', reason: 'User not in auth' })
          continue
        }

        // 2. Get profile with stripe_customer_id
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, plan, stripe_customer_id')
          .eq('id', authUser.id)
          .single()

        if (profileError || !profile) {
          results.push({ email, status: 'PROFILE_NOT_FOUND', reason: profileError?.message })
          continue
        }

        // 3. Check Stripe subscription status IF they have a stripe_customer_id
        let hasActiveSubscription = false
        if (profile.stripe_customer_id) {
          try {
            const subs = await stripe.subscriptions.list({
              customer: profile.stripe_customer_id,
              limit: 1,
            })
            hasActiveSubscription = subs.data.some(sub =>
              ['active', 'trialing', 'past_due'].includes(sub.status)
            )
          } catch (stripeErr) {
            console.error(`Stripe check failed for ${email}:`, stripeErr.message)
            // Don't fail the whole operation, just skip Stripe check
          }
        }

        // 4. Update profile
        // If they have active Stripe subscription, don't set plan_expires_at
        // (let Stripe webhook manage it)
        const update = {
          plan: 'pro',
        }
        if (!hasActiveSubscription) {
          update.plan_expires_at = expiryISO
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .update(update)
          .eq('id', profile.id)

        if (updateError) {
          results.push({ email, status: 'UPDATE_FAILED', reason: updateError.message })
          continue
        }

        // 5. Send email
        const emailText = hasActiveSubscription
          ? `Hi!\n\nYour GlowMetrics Pro access is now confirmed and active.\n\nYour existing Stripe subscription remains active and will be managed normally.\n\nEnjoy your pro features!\n\nBest,\nThe GlowMetrics Team`
          : `Hi!\n\nYou've been granted ${days} days of complimentary GlowMetrics Pro access.\n\nYour pro features are now active and will be available until ${expiryDate.toLocaleDateString('en-US')}.\n\nEnjoy!\n\nBest,\nThe GlowMetrics Team`

        await sendEmail(
          email,
          '🎉 Your GlowMetrics Pro Access is Active!',
          emailText
        )

        results.push({
          email,
          status: 'SUCCESS',
          hasActiveSubscription,
          expiryDate: hasActiveSubscription ? 'Managed by Stripe' : expiryISO,
        })
      } catch (err) {
        results.push({ email, status: 'ERROR', reason: err.message })
      }
    }

    // Send admin notification
    const summary = results
      .map(r => `${r.email}: ${r.status}${r.reason ? ` (${r.reason})` : ''}`)
      .join('\n')

    await sendEmail(
      'daphneoncam@gmail.com',
      `✅ Pro Trial Grant Complete — ${results.filter(r => r.status === 'SUCCESS').length}/${results.length}`,
      `Pro access granted.\n\nExpiry: ${expiryDate.toLocaleDateString('en-US')}\nDuration: ${days} days\n\nResults:\n${summary}`
    )

    return NextResponse.json({
      success: true,
      count: results.length,
      results,
    })
  } catch (err) {
    console.error('Grant pro trial error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

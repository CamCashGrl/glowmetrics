import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

async function logEmail(supabase, emailType, recipient, subject, status, resendResponse, errorMessage) {
  try {
    await supabase.from('email_logs').insert({
      email_type: emailType,
      recipient,
      subject,
      status,
      resend_response: resendResponse,
      error_message: errorMessage,
    })
  } catch (err) {
    console.error('[logEmail] Failed to log email:', err.message)
  }
}

async function sendEmail(supabase, emailType, recipient, subject, text) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[sendEmail] RESEND_API_KEY not set')
    await logEmail(supabase, emailType, recipient, subject, 'failed', null, 'Missing RESEND_API_KEY')
    return false
  }

  try {
    await logEmail(supabase, emailType, recipient, subject, 'pending', null, null)

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GlowMetrics <noreply@camcashgrl.com>',
        to: recipient,
        subject,
        text,
      }),
    })

    const resendResponse = await response.json()

    if (response.ok && resendResponse.id) {
      await logEmail(supabase, emailType, recipient, subject, 'sent', resendResponse, null)
      console.log(`[sendEmail] Email sent to ${recipient}: ${resendResponse.id}`)
      return true
    } else {
      await logEmail(supabase, emailType, recipient, subject, 'failed', resendResponse, resendResponse.message || 'Unknown error')
      console.error(`[sendEmail] Resend API error: ${resendResponse.message}`)
      return false
    }
  } catch (e) {
    await logEmail(supabase, emailType, recipient, subject, 'failed', null, e.message)
    console.error(`[sendEmail] Exception: ${e.message}`)
    return false
  }
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  // Get users whose trials expired today
  const { data: trialsExpiredToday, error } = await supabase
    .from('profiles')
    .select('id, email, plan, trial_ends_at')
    .gte('trial_ends_at', today.toISOString())
    .lt('trial_ends_at', tomorrow.toISOString())
    .eq('subscription_status', 'trialing')

  if (error) {
    console.error('[send-trial-expired] query failed:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  let emailsSent = 0
  let emailsFailed = 0

  if (trialsExpiredToday?.length) {
    for (const user of trialsExpiredToday) {
      const subject = '✅ Reactivate your GlowMetrics account'
      const text = `Hi ${user.email},

Your GlowMetrics trial has ended. Your account is currently on a free plan with limited features.

Upgrade now to get back your full analytics, insights, and all Pro tools.

👉 Reactivate subscription: https://glowmetrics.co/upgrade

Your data is safe and ready to go. Just upgrade to continue!

Questions? Contact support@glowmetrics.co

Best,
GlowMetrics Team`

      const sent = await sendEmail(supabase, 'trial_expired', user.email, subject, text)
      if (sent) emailsSent++
      else emailsFailed++
    }
  }

  console.log(`[send-trial-expired] sent ${emailsSent} emails, ${emailsFailed} failed`)
  return NextResponse.json({
    success: true,
    trialsExpiredToday: trialsExpiredToday?.length || 0,
    emailsSent,
    emailsFailed,
  })
}

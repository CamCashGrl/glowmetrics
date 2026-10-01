import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function sendAlert(subject, text) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[sendAlert] RESEND_API_KEY not set')
    return false
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GlowMetrics <noreply@camcashgrl.com>',
        to: 'daphneoncam@gmail.com',
        subject,
        text,
      }),
    })

    return response.ok
  } catch (e) {
    console.error(`[sendAlert] Exception: ${e.message}`)
    return false
  }
}

export async function GET() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: failedEmails, error } = await supabase
    .from('email_logs')
    .select('id, email_type, recipient, subject, status, error_message, created_at')
    .eq('status', 'failed')
    .gte('created_at', yesterday)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[check-email-failures] Database error:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  if (!failedEmails?.length) {
    console.log('[check-email-failures] No failed emails in last 24 hours')
    return NextResponse.json({
      success: true,
      failedEmailCount: 0,
      alertSent: false,
    })
  }

  let alertText = '🚨 EMAIL DELIVERY FAILURES\n\n'
  alertText += `Report Date: ${new Date().toISOString().split('T')[0]}\n`
  alertText += '='.repeat(60) + '\n\n'
  alertText += `Failed Emails: ${failedEmails.length}\n\n`

  alertText += failedEmails.slice(0, 20).map(e =>
    `• ${e.email_type} - ${e.subject}\n  Error: ${e.error_message || 'Unknown error'}\n  Time: ${new Date(e.created_at).toISOString()}\n`
  ).join('')

  if (failedEmails.length > 20) {
    alertText += `\n... and ${failedEmails.length - 20} more\n`
  }

  alertText += '\n' + '='.repeat(60) + '\n'
  alertText += 'ACTION: Check RESEND_API_KEY is set in Vercel environment variables\n'
  alertText += 'Or verify noreply@camcashgrl.com domain is verified in Resend dashboard\n'
  alertText += '\nQuery all failures in database:\n'
  alertText += 'SELECT * FROM email_logs WHERE status=\'failed\' ORDER BY created_at DESC LIMIT 50;'

  const alertSent = await sendAlert(
    `🚨 Email Delivery Failures - ${new Date().toISOString().split('T')[0]}`,
    alertText
  )

  if (alertSent) {
    console.log('[check-email-failures] Email failure alert sent')
  }

  return NextResponse.json({
    success: true,
    failedEmailCount: failedEmails.length,
    alertSent,
  })
}

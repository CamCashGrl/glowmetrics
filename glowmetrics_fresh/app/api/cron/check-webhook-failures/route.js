import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

async function sendAlert(subject, text) {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GlowMetrics <notifications@glowmetrics.co>',
        to: 'daphneoncam@gmail.com',
        subject,
        text,
      }),
    })
  } catch (e) {
    console.error('Failed to send alert email:', e.message)
  }
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Check for failures in the last 24 hours
  const { data: failures, error } = await supabase
    .from('webhook_events')
    .select('stripe_event_id, event_type, status, error_message, created_at')
    .neq('status', 'success')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[cron/check-webhook-failures] query failed:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  if (!failures?.length) {
    return NextResponse.json({ success: true, failures_found: 0 })
  }

  // Group failures by type
  const failuresByStatus = {}
  failures.forEach(f => {
    if (!failuresByStatus[f.status]) {
      failuresByStatus[f.status] = []
    }
    failuresByStatus[f.status].push(f)
  })

  // Build alert email
  const failureDetails = Object.entries(failuresByStatus)
    .map(([status, events]) => {
      const examples = events.slice(0, 3).map(e =>
        `  - ${e.event_type}: ${e.error_message || '(no error message)'} (${new Date(e.created_at).toISOString()})`
      ).join('\n')
      return `${status.toUpperCase()} (${events.length} failures):\n${examples}${events.length > 3 ? `\n  ... and ${events.length - 3} more` : ''}`
    })
    .join('\n\n')

  const alertSubject = `🚨 CRITICAL: ${failures.length} Stripe Webhook Failures in Last 24h`
  const alertText = `WARNING: Your Stripe webhook processing had failures in the last 24 hours.\n\nTotal Failures: ${failures.length}\n\nBreakdown:\n${failureDetails}\n\nCheck your webhook_events table for full details:\nSELECT * FROM webhook_events WHERE status != 'success' AND created_at >= NOW() - INTERVAL '24 hours' ORDER BY created_at DESC;`

  await sendAlert(alertSubject, alertText)

  console.log(`[cron/check-webhook-failures] found ${failures.length} failures, alert sent`)
  return NextResponse.json({ success: true, failures_found: failures.length, grouped: failuresByStatus })
}

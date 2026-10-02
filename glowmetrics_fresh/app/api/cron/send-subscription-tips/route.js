import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const TIPS = [
  {
    subject: '💡 Tip: Master Your Daily Analytics Dashboard',
    text: `Hi there,

Did you know you can customize your GlowMetrics dashboard to show exactly what matters to you?

Here's a quick tip:
1. Go to Settings → Dashboard
2. Toggle on/off the metrics you want to see
3. Arrange them in any order you prefer

This way, you only see what's relevant to your goals. Give it a try!

Learn more: https://glowmetrics.co/docs/dashboard

Best,
GlowMetrics Team`,
  },
  {
    subject: '📊 Tip: Get More from Your Analytics',
    text: `Hi there,

Want to understand your audience better? Here's a powerful feature you might not know about:

Use our Audience Insights tool to:
- See who's engaging with your content
- Track growth trends over time
- Identify your top performing content

Check it out in your dashboard under "Analytics" → "Insights".

Learn more: https://glowmetrics.co/docs/insights

Best,
GlowMetrics Team`,
  },
  {
    subject: '🎯 Tip: Set Goals and Track Progress',
    text: `Hi there,

Want to stay motivated and focused? GlowMetrics lets you set custom goals and track your progress toward them.

To set a goal:
1. Go to Settings → Goals
2. Add your target metrics
3. Watch your progress in real-time

Perfect for tracking growth, engagement targets, or revenue goals.

Learn more: https://glowmetrics.co/docs/goals

Best,
GlowMetrics Team`,
  },
  {
    subject: '📧 Tip: Get Smarter Reports Delivered to Your Inbox',
    text: `Hi there,

Did you know GlowMetrics can automatically send you weekly or daily reports?

Never miss important metrics:
1. Go to Settings → Reports
2. Choose your frequency (Daily, Weekly, Monthly)
3. Pick which metrics matter most
4. Get summaries delivered straight to your email

Set it and forget it!

Learn more: https://glowmetrics.co/docs/reports

Best,
GlowMetrics Team`,
  },
  {
    subject: '🚀 Tip: Export Your Data Anytime',
    text: `Hi there,

Need to analyze your data elsewhere or share reports with your team?

You can export all your analytics:
1. Select the date range you want
2. Choose CSV or PDF format
3. Get a download link instantly

Perfect for presentations, spreadsheets, or team sharing.

Learn more: https://glowmetrics.co/docs/export

Best,
GlowMetrics Team`,
  },
  {
    subject: '⚙️ Tip: Optimize Your Settings for Maximum Impact',
    text: `Hi there,

Your settings are your control center. Here's what you should know:

Key settings to review:
- Privacy & Data: Choose your data retention policy
- Notifications: Get alerts on important changes
- Integrations: Connect with your favorite tools
- Team Access: Add team members to collaborate

Spend 5 minutes optimizing today!

Learn more: https://glowmetrics.co/docs/settings

Best,
GlowMetrics Team`,
  },
]

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
      return true
    } else {
      await logEmail(supabase, emailType, recipient, subject, 'failed', resendResponse, resendResponse.message || 'Unknown error')
      return false
    }
  } catch (e) {
    await logEmail(supabase, emailType, recipient, subject, 'failed', null, e.message)
    return false
  }
}

function getRandomTip() {
  return TIPS[Math.floor(Math.random() * TIPS.length)]
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Get all active subscribers (paid + trialing, excluding free)
  const { data: activeSubscribers, error } = await supabase
    .from('profiles')
    .select('id, email, plan, subscription_status')
    .in('subscription_status', ['active', 'trialing'])
    .neq('plan', 'free')

  if (error) {
    console.error('[send-subscription-tips] query failed:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  let emailsSent = 0
  let emailsFailed = 0
  const tip = getRandomTip()

  if (activeSubscribers?.length) {
    for (const user of activeSubscribers) {
      const sent = await sendEmail(supabase, 'subscription_tip', user.email, tip.subject, tip.text)
      if (sent) emailsSent++
      else emailsFailed++
    }
  }

  console.log(`[send-subscription-tips] sent ${emailsSent} subscription tips, ${emailsFailed} failed (total subscribers: ${activeSubscribers?.length || 0})`)
  return NextResponse.json({
    success: true,
    activeSubscribers: activeSubscribers?.length || 0,
    emailsSent,
    emailsFailed,
    tipTopic: tip.subject,
  })
}

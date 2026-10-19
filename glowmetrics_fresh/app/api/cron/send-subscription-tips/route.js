import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const PRODUCT_UPDATE_TYPE = 'product_update_2026_10_free_live_limits'
const PROFILE_BATCH_SIZE = 1000

const PRODUCT_UPDATE = {
  subject: 'CamCash update: new Free limits, Live Mode progress, and stored-history unlocks',
  text: `Hi there,

We’re updating CamCash so the Free plan stays useful while making Pro clearer and more valuable.

What’s changing:
- Free analytics use 1 selected platform with a rolling 31 days of visible analytics.
- You can still upload more history and other supported platforms. CamCash keeps that data stored for you.
- Stored history may power locked previews such as “we found more high-value fans” or “we found a stronger earning window,” but the full answer stays locked until Pro.
- Platform comparison remains available on Free.
- Other advanced insights appear as locked previews built from your real data.
- Free Live Mode includes 2 streams per week, up to 30 active minutes per stream. Paused time does not count.
- Your Live Mode progress bar will show how much free tracking is left.
- A 7-day trial is available, but it does not unlock unlimited historical data. Trial access stays capped to the 31-day analytics window and the trial Live Mode allowance.

You can also skip CSV importing and start building your history automatically with Live Mode.

Open your dashboard: https://www.camcashgrl.com/dashboard
See plans: https://www.camcashgrl.com/pricing
Terms: https://www.camcashgrl.com/terms

Your uploaded data remains stored in your account so it can be unlocked if you upgrade later.

— CamCash`,
}

const RETENTION_TIPS = [
  {
    subject: 'Your CamCash dashboard may have something new for you',
    text: `Hi there,

Open CamCash and check “Since your last visit.” As your stream and fan data changes, CamCash can surface new spenders, returning fans, timing shifts, and new locked discoveries from your stored history.

The goal is simple: show you what changed and what your next best move should be.

Open your dashboard: https://www.camcashgrl.com/dashboard

— CamCash`,
  },
  {
    subject: 'Before your next stream: check your best move',
    text: `Hi there,

Before you go live, open CamCash and check your current best move: strongest platform, strongest time window, fan activity, and anything new we found in your recent data.

Then start Live Mode so CamCash can keep learning from the stream automatically.

Open CamCash: https://www.camcashgrl.com/dashboard

— CamCash`,
  },
  {
    subject: 'Your stored history can keep getting more valuable',
    text: `Hi there,

You can upload more than the Free dashboard displays. CamCash keeps that history stored and can use it to identify locked discoveries worth revisiting later.

Free shows your rolling 31-day analytics window. Pro unlocks the deeper history and full insight details.

See what CamCash found: https://www.camcashgrl.com/dashboard

— CamCash`,
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
        from: 'CamCash <noreply@camcashgrl.com>',
        to: recipient,
        subject,
        text,
      }),
    })

    const resendResponse = await response.json().catch(() => ({}))
    if (response.ok && resendResponse.id) {
      await logEmail(supabase, emailType, recipient, subject, 'sent', resendResponse, null)
      return true
    }

    await logEmail(supabase, emailType, recipient, subject, 'failed', resendResponse, resendResponse.message || 'Unknown error')
    return false
  } catch (e) {
    await logEmail(supabase, emailType, recipient, subject, 'failed', null, e.message)
    return false
  }
}

async function alreadySent(supabase, emailType, recipient) {
  const { data, error } = await supabase
    .from('email_logs')
    .select('id')
    .eq('email_type', emailType)
    .eq('recipient', recipient)
    .eq('status', 'sent')
    .limit(1)
  return !error && !!data?.length
}

function getRandomTip() {
  return RETENTION_TIPS[Math.floor(Math.random() * RETENTION_TIPS.length)]
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  let updateEmailsSent = 0
  let retentionEmailsSent = 0
  let emailsFailed = 0
  const tip = getRandomTip()
  let usersChecked = 0
  let lastId = null

  // Advance by the immutable unique id, so earlier deletions cannot shift
  // offsets and cause an eligible profile to be skipped.
  while (true) {
    let query = supabase
      .from('profiles')
      .select('id, email, plan, subscription_status')
      .not('email', 'is', null)
      .order('id', { ascending: true })
      .limit(PROFILE_BATCH_SIZE)
    if (lastId !== null) query = query.gt('id', lastId)
    const { data: users, error } = await query
    if (error) {
      console.error('[send-subscription-tips] query failed:', error.message)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    if (!users?.length) break
    usersChecked += users.length

    for (const user of users) {
      if (!user.email) continue

      const hasUpdate = await alreadySent(supabase, PRODUCT_UPDATE_TYPE, user.email)
      if (!hasUpdate) {
        const sent = await sendEmail(
          supabase,
          PRODUCT_UPDATE_TYPE,
          user.email,
          PRODUCT_UPDATE.subject,
          PRODUCT_UPDATE.text
        )
        if (sent) updateEmailsSent++
        else emailsFailed++
        continue
      }

      if (['active', 'trialing'].includes(user.subscription_status)) {
        const sent = await sendEmail(supabase, 'subscription_retention_tip', user.email, tip.subject, tip.text)
        if (sent) retentionEmailsSent++
        else emailsFailed++
      }
    }
    lastId = users[users.length - 1].id
  }

  console.log(`[send-subscription-tips] product updates=${updateEmailsSent}, retention=${retentionEmailsSent}, failed=${emailsFailed}`)
  return NextResponse.json({
    success: true,
    usersChecked,
    updateEmailsSent,
    retentionEmailsSent,
    emailsFailed,
    retentionTopic: tip.subject,
  })
}

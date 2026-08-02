import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

// Called once a day by /api/cron/daily. Finds anyone whose time-limited Pro
// grant (promo code, etc.) expires within the next 48 hours and hasn't been
// warned yet, emails them, and marks them notified so this never re-fires
// for the same expiry date. Nothing here changes plan/plan_expires_at —
// expiry itself is still just a live comparison everywhere it's checked;
// this route only sends the heads-up email.
export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    const resend = new Resend(process.env.RESEND_API_KEY)

    const now = new Date()
    const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    const { data: expiringSoon, error } = await supabaseAdmin
      .from('profiles')
      .select('id, plan, plan_expires_at')
      .in('plan', ['pro', 'unlimited'])
      .not('plan_expires_at', 'is', null)
      .gt('plan_expires_at', now.toISOString())
      .lte('plan_expires_at', windowEnd.toISOString())
      .is('plan_expiry_notified_at', null)

    if (error) throw error
    if (!expiringSoon || expiringSoon.length === 0) {
      return NextResponse.json({ success: true, notified: 0 })
    }

    let notified = 0
    const failures = []

    for (const profile of expiringSoon) {
      try {
        const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(profile.id)
        const email = userData?.user?.email
        if (userErr || !email) { failures.push({ id: profile.id, reason: 'no_email' }); continue }

        const expiresLabel = new Date(profile.plan_expires_at).toLocaleDateString('en-US', {
          timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric',
        })

        await resend.emails.send({
          from: 'CamCashGrl <hello@camcashgrl.com>',
          to: email,
          subject: '⏰ Your CamCashGrl Pro access ends in 2 days',
          html: reminderHtml(expiresLabel),
        })

        const { error: updateErr } = await supabaseAdmin
          .from('profiles')
          .update({ plan_expiry_notified_at: now.toISOString() })
          .eq('id', profile.id)
        if (updateErr) { failures.push({ id: profile.id, reason: updateErr.message }); continue }

        notified += 1
      } catch (e) {
        failures.push({ id: profile.id, reason: e.message })
      }
    }

    return NextResponse.json({ success: true, notified, failed: failures.length, failures })
  } catch (err) {
    console.error('[notify/plan-expiry-reminder] Failed:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

function reminderHtml(expiresLabel) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#050713;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">

  <div style="text-align:center;margin-bottom:8px;">
    <span style="font-size:22px;">👑</span>
    <span style="font-size:18px;font-weight:800;color:#F1F5F9;font-style:italic;margin-left:6px;">CamCashGrl</span>
  </div>

  <div style="text-align:center;margin:20px 0 28px;">
    <div style="font-size:48px;line-height:1;margin-bottom:16px;">⏰</div>
    <h1 style="margin:0;font-size:26px;font-weight:900;color:#F1F5F9;line-height:1.2;">Your Pro access ends in 2 days</h1>
    <p style="margin:14px 0 0;font-size:14px;color:#D7D9EA;">
      Your free CamCashGrl Pro period wraps up on <strong style="color:#FFC857;">${expiresLabel}</strong>.
    </p>
  </div>

  <div style="border-radius:16px;background:rgba(13,17,38,0.85);border:1px solid rgba(255,255,255,0.09);padding:20px 22px;margin-bottom:24px;">
    <p style="margin:0 0 10px;font-size:13px;color:#F1F5F9;font-weight:700;">What happens after that:</p>
    <p style="margin:0 0 8px;font-size:13px;color:#D7D9EA;line-height:1.6;">
      🔒 You'll move back to the Free plan — unlimited platform tracking, Live Mode coaching sync, whale alerts, and advanced insights get locked again.
    </p>
    <p style="margin:0;font-size:13px;color:#D7D9EA;line-height:1.6;">
      💾 <strong style="color:#F1F5F9;">Nothing is deleted.</strong> All your tips, sessions, and history stay exactly as they are — you just won't see the Pro-only views until you upgrade or claim another code.
    </p>
  </div>

  <div style="text-align:center;margin-bottom:28px;">
    <a href="https://www.camcashgrl.com/pricing" style="display:inline-block;padding:16px 44px;border-radius:12px;background:linear-gradient(90deg,#16F4FF 0%,#7C5CFF 48%,#FF2BAE 100%);color:#fff;font-size:16px;font-weight:800;text-decoration:none;">
      Keep My Pro Features →
    </a>
  </div>

  <div style="text-align:center;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);">
    <p style="margin:0 0 6px;font-size:12px;color:#5E647C;">
      Questions? We're here for you. <a href="mailto:support@camcashgrl.com" style="color:#8D93AA;">support@camcashgrl.com</a>
    </p>
    <p style="margin:0;font-size:12px;color:#5E647C;">
      👑 <a href="https://www.camcashgrl.com" style="color:#8D93AA;text-decoration:none;">CamCashGrl.com</a>
    </p>
  </div>

</div>
</body>
</html>
`
}

import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const FOUNDER_EMAIL = 'daphneoncam@gmail.com'

export async function POST(req) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { email, created_at } = await req.json()

    // ── Pull total user count from Supabase (service role required for auth.users) ──
    let totalUsers = '—'
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
      const { count } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .schema('auth')
      if (count !== null) totalUsers = count.toLocaleString()
    } catch (_) {
      // Non-fatal — proceed without count
    }

    const signupDate = created_at
      ? new Date(created_at).toLocaleString('en-US', {
          timeZone: 'America/New_York',
          weekday: 'short', month: 'short', day: 'numeric',
          year: 'numeric', hour: 'numeric', minute: '2-digit',
          hour12: true,
        })
      : new Date().toLocaleString('en-US', {
          timeZone: 'America/New_York',
          weekday: 'short', month: 'short', day: 'numeric',
          year: 'numeric', hour: 'numeric', minute: '2-digit',
          hour12: true,
        })

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#05070f;font-family:'Inter',system-ui,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#0d1117;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7C5CFF,#EC4899);padding:24px 32px;">
      <div style="font-size:24px;margin-bottom:4px;">🆕</div>
      <div style="font-size:20px;font-weight:800;color:#fff;">New CamCash Signup</div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#94a3b8;font-size:13px;width:140px;">Email</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#f1f5f9;font-size:13px;font-weight:600;">${email}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#94a3b8;font-size:13px;">Signed up</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#f1f5f9;font-size:13px;">${signupDate} ET</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#94a3b8;font-size:13px;">Total users</td>
          <td style="padding:10px 0;color:#7C5CFF;font-size:20px;font-weight:900;">${totalUsers}</td>
        </tr>
      </table>

      <div style="margin-top:24px;">
        <a href="https://supabase.com/dashboard/project/_/auth/users"
           style="display:inline-block;padding:11px 22px;background:linear-gradient(135deg,#7C5CFF,#EC4899);border-radius:8px;color:#fff;font-size:13px;font-weight:700;text-decoration:none;">
          View users in Supabase →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
      <div style="font-size:11px;color:#334155;">CamCash · Founder notifications</div>
    </div>
  </div>
</body>
</html>`

    await resend.emails.send({
      from: 'CamCash Notifications <notifications@camcashgrl.com>',
      to: FOUNDER_EMAIL,
      subject: '🆕 New CamCash Signup',
      html,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notify/signup] Failed:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

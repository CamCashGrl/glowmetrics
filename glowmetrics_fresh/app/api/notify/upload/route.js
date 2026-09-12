import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const FOUNDER_EMAIL = 'daphneoncam@gmail.com'

export async function POST(req) {
  try {
    const { email, platform, tip_count, user_id } = await req.json()

    const timestamp = new Date().toLocaleString('en-US', {
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
    <div style="background:linear-gradient(135deg,#22D3EE,#7C5CFF);padding:24px 32px;">
      <div style="font-size:24px;margin-bottom:4px;">📁</div>
      <div style="font-size:20px;font-weight:800;color:#fff;">New CSV Upload — ${platform || 'Unknown'}</div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#94a3b8;font-size:13px;width:140px;">User</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#f1f5f9;font-size:13px;font-weight:600;">${email || '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#94a3b8;font-size:13px;">Platform</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#22D3EE;font-size:13px;font-weight:700;">${platform || 'Unknown'}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#94a3b8;font-size:13px;">Tips uploaded</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#10B981;font-size:20px;font-weight:900;">${tip_count?.toLocaleString() || '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#94a3b8;font-size:13px;">User ID</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#475569;font-size:11px;font-family:monospace;">${user_id || '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#94a3b8;font-size:13px;">Timestamp</td>
          <td style="padding:10px 0;color:#f1f5f9;font-size:13px;">${timestamp} ET</td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
      <div style="font-size:11px;color:#334155;">CamCash · Founder notifications</div>
    </div>
  </div>
</body>
</html>`

    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'CamCash Notifications <notifications@camcashgrl.com>',
      to: FOUNDER_EMAIL,
      subject: `📁 New CSV Upload — ${platform || 'Unknown'}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notify/upload] Failed:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

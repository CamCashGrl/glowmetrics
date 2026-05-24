import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req) {
  try {
    const { email } = await req.json()
    if (!email) return Response.json({ error: 'No email' }, { status: 400 })

    await resend.emails.send({
      from: 'CamCash <welcome@camcashgrl.com>',
      to: email,
      subject: 'Welcome to CamCash 💰 — here\'s how to get started',
      html: WELCOME_EMAIL_HTML,
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error('Email error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

const WELCOME_EMAIL_HTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#05070f;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">

  <div style="text-align:center;margin-bottom:32px;">
    <div style="width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#22D3EE,#EC4899);display:inline-flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#fff;margin-bottom:20px;">$</div>
    <h1 style="color:#F1F5F9;font-size:26px;font-weight:900;margin:0 0 8px;">Welcome to CamCash 💰</h1>
    <p style="color:#94A3B8;font-size:15px;margin:0;line-height:1.6;">Your AI-powered earnings dashboard is ready.<br>Here's how to get your stats loaded in 2 minutes.</p>
  </div>

  <div style="margin-bottom:28px;border-radius:16px;overflow:hidden;border:1px solid rgba(34,211,238,0.25);">
    <div style="background:rgba(15,20,32,0.9);padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
      <p style="margin:0;font-size:13px;font-weight:700;color:#F1F5F9;">▶ Watch: How to upload your CSV (2 min)</p>
    </div>
    <a href="https://youtu.be/IJyzM7Pntyc" target="_blank" style="display:block;position:relative;text-decoration:none;">
      <img src="https://img.youtube.com/vi/IJyzM7Pntyc/maxresdefault.jpg" alt="How to upload your CSV" style="width:100%;display:block;" />
    </a>
  </div>

  <div style="background:rgba(15,20,32,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;margin-bottom:24px;">
    <h2 style="color:#F1F5F9;font-size:16px;font-weight:800;margin:0 0 16px;">Get started in 3 steps</h2>
    <div style="margin-bottom:14px;">
      <p style="margin:0;font-size:14px;font-weight:700;color:#F1F5F9;">1. Export your CSV from Chaturbate</p>
      <p style="margin:4px 0 0;font-size:13px;color:#94A3B8;">Go to Stats & Data → Token Stats → Download CSV</p>
    </div>
    <div style="margin-bottom:14px;">
      <p style="margin:0;font-size:14px;font-weight:700;color:#F1F5F9;">2. Upload it to your dashboard</p>
      <p style="margin:4px 0 0;font-size:13px;color:#94A3B8;">Drag and drop your CSV — we handle the rest</p>
    </div>
    <div>
      <p style="margin:0;font-size:14px;font-weight:700;color:#F1F5F9;">3. See your full earnings breakdown</p>
      <p style="margin:4px 0 0;font-size:13px;color:#94A3B8;">Top fans, best hours, peak days, AI insights</p>
    </div>
  </div>

  <div style="text-align:center;margin-bottom:28px;">
    <a href="https://www.camcashgrl.com/onboarding" style="display:inline-block;padding:16px 48px;border-radius:12px;background:linear-gradient(135deg,#22D3EE,#EC4899);color:#fff;font-size:16px;font-weight:800;text-decoration:none;">
      Upload My CSV Now →
    </a>
  </div>

  <div style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.25);border-radius:14px;padding:20px;margin-bottom:28px;text-align:center;">
    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#F1F5F9;">📡 Prefer not to upload a CSV?</p>
    <p style="margin:0 0 14px;font-size:13px;color:#94A3B8;">Install the CamCash Chrome extension — tips tracked automatically while you stream.</p>
    <a href="https://www.camcashgrl.com/extension" style="display:inline-block;padding:10px 28px;border-radius:10px;background:rgba(168,85,247,0.2);border:1px solid rgba(168,85,247,0.5);color:#a855f7;font-size:13px;font-weight:700;text-decoration:none;">
      Get the Chrome Extension →
    </a>
  </div>

  <div style="text-align:center;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0 0 6px;font-size:12px;color:#475569;">CamCash · camcashgrl.com</p>
    <p style="margin:0;font-size:12px;color:#475569;">You received this because you signed up at camcashgrl.com</p>
  </div>

</div>
</body>
</html>
`

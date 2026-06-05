import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req) {
  try {
    const { name, email, message, created_at } = await req.json()
    if (!message) return Response.json({ error: 'No message' }, { status: 400 })

    await resend.emails.send({
      from: 'CamCash Contact <welcome@camcashgrl.com>',
      to: 'daphneoncam@gmail.com',
      subject: '📬 CamCash Contact Form',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#05070f;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:28px;">
    <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#7C5CFF,#EC4899);display:inline-flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:12px;">📬</div>
    <h1 style="color:#F1F5F9;font-size:22px;font-weight:900;margin:0;">New Contact Form Submission</h1>
  </div>

  <div style="background:rgba(15,20,32,0.9);border:1px solid rgba(124,92,255,0.25);border-radius:14px;padding:24px;margin-bottom:20px;">
    <p style="color:#94A3B8;font-size:12px;margin:0 0 10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Message</p>
    <p style="color:#F1F5F9;font-size:15px;line-height:1.7;margin:0;">${(message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
  </div>

  <div style="background:rgba(15,20,32,0.6);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:20px;">
    <p style="color:#64748B;font-size:13px;margin:0 0 8px;"><strong style="color:#94A3B8;">Name:</strong> ${(name || '').replace(/</g, '&lt;')}</p>
    <p style="color:#64748B;font-size:13px;margin:0 0 8px;"><strong style="color:#94A3B8;">Email:</strong> ${(email || '').replace(/</g, '&lt;')}</p>
    ${created_at ? `<p style="color:#64748B;font-size:13px;margin:0;"><strong style="color:#94A3B8;">Time:</strong> ${created_at}</p>` : ''}
  </div>

  <div style="text-align:center;padding-top:24px;">
    <p style="color:#334155;font-size:12px;margin:0;">CamCash · camcashgrl.com</p>
  </div>
</div>
</body>
</html>`,
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error('Contact email error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

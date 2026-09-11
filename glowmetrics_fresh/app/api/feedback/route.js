import { Resend } from 'resend'

export async function POST(req) {
  try {
    const body = await req.json()
    const { message, page_url, page_title, user_id, created_at } = body

    if (!message) return Response.json({ error: 'No message' }, { status: 400 })

    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'CamCash Feedback <welcome@camcashgrl.com>',
      to: 'daphneoncam@gmail.com',
      subject: '💬 New CamCash Feedback',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#05070f;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:28px;">
    <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#7C5CFF,#EC4899);display:inline-flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:12px;">💬</div>
    <h1 style="color:#F1F5F9;font-size:22px;font-weight:900;margin:0;">New CamCash Feedback</h1>
  </div>

  <div style="background:rgba(15,20,32,0.9);border:1px solid rgba(124,92,255,0.25);border-radius:14px;padding:24px;margin-bottom:20px;">
    <p style="color:#94A3B8;font-size:12px;margin:0 0 10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Message</p>
    <p style="color:#F1F5F9;font-size:15px;line-height:1.7;margin:0;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
  </div>

  <div style="background:rgba(15,20,32,0.6);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:20px;">
    ${page_url ? `<p style="color:#64748B;font-size:13px;margin:0 0 8px;"><strong style="color:#94A3B8;">Page:</strong> ${page_url}</p>` : ''}
    ${page_title ? `<p style="color:#64748B;font-size:13px;margin:0 0 8px;"><strong style="color:#94A3B8;">Title:</strong> ${page_title}</p>` : ''}
    ${user_id ? `<p style="color:#64748B;font-size:13px;margin:0 0 8px;"><strong style="color:#94A3B8;">User ID:</strong> ${user_id}</p>` : ''}
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
    console.error('Feedback email error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

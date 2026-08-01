import { Resend } from 'resend'

export async function POST(req) {
  try {
    const { email, code } = await req.json()
    if (!email) return Response.json({ error: 'No email' }, { status: 400 })
    if (!code) return Response.json({ error: 'No promo code' }, { status: 400 })

    const claimUrl = `https://www.camcashgrl.com/dashboard?promo=${encodeURIComponent(code)}`

    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'CamCashGrl <hello@camcashgrl.com>',
      to: email,
      subject: "🎁 You've Been Randomly Selected — 2 Weeks of CamCashGrl PRO, On Us",
      html: proTrialHtml(claimUrl),
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error('Email error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

const FEATURES = [
  ['📶', 'Unlimited platform tracking'],
  ['⏱️', 'Detailed session breakdowns'],
  ['⚡', 'Live Mode + real-time coaching'],
  ['👑', 'Priority support'],
  ['🔬', 'Advanced analytics & insights'],
  ['📅', 'Save & compare past sessions'],
  ['🐋', 'Whale alerts & tip predictions'],
  ['💗', '...and so much more!'],
]

function proTrialHtml(claimUrl) {
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
    <div style="font-size:56px;line-height:1;margin-bottom:16px;">🎁</div>
    <h1 style="margin:0;font-size:30px;font-weight:900;line-height:1.15;">
      <span style="color:#F1F5F9;">YOU'VE BEEN</span><br/>
      <span style="background:linear-gradient(90deg,#7C5CFF 0%,#D83DFF 55%,#FF2BAE 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">RANDOMLY SELECTED!</span>
    </h1>
    <p style="margin:16px 0 0;font-size:15px;color:#D7D9EA;">Enjoy 2 weeks of</p>
    <p style="margin:2px 0 0;font-size:17px;font-weight:800;color:#FFC857;">CAMCASHGRL PRO ON US 💗</p>
  </div>

  <p style="font-size:15px;color:#F1F5F9;font-weight:700;margin:0 0 12px;">Hey Gorgeous, 💗</p>
  <p style="font-size:14px;color:#D7D9EA;line-height:1.6;margin:0 0 12px;">
    We love our <strong style="color:#F1F5F9;">CamCashGrl</strong> community, and we wanted to do something special for a few amazing members like you.
  </p>
  <p style="font-size:14px;color:#D7D9EA;line-height:1.6;margin:0 0 24px;">
    That's why you've been randomly selected to receive
    <strong style="color:#FFC857;">✨ 2 weeks of CamCashGrl PRO — completely free! ✨</strong>
  </p>

  <div style="border-radius:18px;background:rgba(13,17,38,0.85);border:1px solid rgba(124,92,255,0.3);padding:22px 24px;margin-bottom:28px;">
    <p style="margin:0 0 16px;font-size:12px;font-weight:800;color:#16F4FF;text-transform:uppercase;letter-spacing:0.08em;">With Pro, you get:</p>
    <table style="width:100%;border-collapse:collapse;">
      ${(() => {
        let rows = ''
        for (let i = 0; i < FEATURES.length; i += 2) {
          const [icon1, label1] = FEATURES[i]
          const pair = FEATURES[i + 1]
          rows += `<tr>
            <td style="padding:8px 8px 8px 0;font-size:13px;color:#F1F5F9;vertical-align:top;width:50%;">${icon1} ${label1}</td>
            ${pair ? `<td style="padding:8px 0 8px 8px;font-size:13px;color:#F1F5F9;vertical-align:top;width:50%;">${pair[0]} ${pair[1]}</td>` : '<td></td>'}
          </tr>`
        }
        return rows
      })()}
    </table>
  </div>

  <div style="text-align:center;margin-bottom:24px;">
    <a href="${claimUrl}" style="display:inline-block;padding:18px 52px;border-radius:14px;background:linear-gradient(90deg,#16F4FF 0%,#7C5CFF 48%,#FF2BAE 100%);color:#fff;font-size:16px;font-weight:800;text-decoration:none;">
      Claim Your 2 Weeks Free 👑
    </a>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
    <tr>
      <td style="padding:0 8px 0 0;text-align:center;width:33.3%;vertical-align:top;">
        <div style="font-size:20px;margin-bottom:6px;">🛡️</div>
        <div style="font-size:12px;font-weight:700;color:#F1F5F9;">No credit card needed.</div>
        <div style="font-size:11px;color:#8D93AA;margin-top:2px;">No catch. Just our way of saying thank you.</div>
      </td>
      <td style="padding:0 8px;text-align:center;width:33.3%;vertical-align:top;">
        <div style="font-size:20px;margin-bottom:6px;">⏰</div>
        <div style="font-size:12px;font-weight:700;color:#F1F5F9;">Exclusive offer.</div>
        <div style="font-size:11px;color:#8D93AA;margin-top:2px;">This is only for you and expires in 14 days.</div>
      </td>
      <td style="padding:0 0 0 8px;text-align:center;width:33.3%;vertical-align:top;">
        <div style="font-size:20px;margin-bottom:6px;">💗</div>
        <div style="font-size:12px;font-weight:700;color:#F1F5F9;">We appreciate you.</div>
        <div style="font-size:11px;color:#8D93AA;margin-top:2px;">Thanks for being part of our amazing community.</div>
      </td>
    </tr>
  </table>

  <div style="border-radius:14px;background:rgba(13,17,38,0.72);border:1px solid rgba(255,255,255,0.09);padding:18px 20px;margin-bottom:28px;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#F1F5F9;">📧 Want tips, updates & exclusive offers?</p>
    <p style="margin:0 0 10px;font-size:12px;color:#8D93AA;">Subscribe to our emails (you can unsubscribe anytime).</p>
    <a href="mailto:support@camcashgrl.com?subject=Keep%20me%20in%20the%20loop" style="display:inline-block;margin-right:16px;font-size:12px;color:#16F4FF;text-decoration:none;font-weight:700;">☑ Yes, keep me in the loop!</a>
    <a href="mailto:support@camcashgrl.com?subject=Please%20unsubscribe%20me" style="font-size:12px;color:#8D93AA;text-decoration:none;">☐ No thanks, I'll pass for now.</a>
  </div>

  <p style="font-size:14px;color:#D7D9EA;margin:0 0 24px;">
    Keep slaying,<br/>
    <strong style="color:#F1F5F9;">The CamCashGrl Team</strong> 💋
  </p>

  <div style="text-align:center;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);">
    <p style="margin:0 0 6px;font-size:12px;color:#5E647C;">
      Questions? We're here for you. <a href="mailto:support@camcashgrl.com" style="color:#8D93AA;">support@camcashgrl.com</a>
    </p>
    <p style="margin:0;font-size:12px;color:#5E647C;">
      👑 <a href="https://www.camcashgrl.com" style="color:#8D93AA;text-decoration:none;">CamCashGrl.com</a>
      &nbsp;·&nbsp;
      <a href="mailto:support@camcashgrl.com?subject=Please%20unsubscribe%20me" style="color:#5E647C;text-decoration:none;">Unsubscribe</a>
    </p>
  </div>

</div>
</body>
</html>
`
}

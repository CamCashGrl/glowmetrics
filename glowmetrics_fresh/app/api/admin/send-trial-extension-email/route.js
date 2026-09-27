import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req) {
  try {
    const { userId, email, displayName, newTrialEndDate } = await req.json()

    if (!email || !displayName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #05070f;
      font-family: 'Inter', Arial, sans-serif;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #0d1322;
      border: 1px solid #1e2d45;
      border-radius: 12px;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #22D3EE, #EC4899);
      padding: 32px;
    }
    .header-icon {
      font-size: 28px;
      margin-bottom: 8px;
    }
    .header-text {
      font-size: 24px;
      font-weight: 800;
      color: #fff;
    }
    .body {
      padding: 32px;
      color: #94A3B8;
      line-height: 1.6;
    }
    .body h2 {
      color: #22D3EE;
      margin-top: 0;
      margin-bottom: 16px;
      font-size: 20px;
    }
    .highlight {
      color: #22D3EE;
      font-weight: 600;
    }
    .detail-box {
      background: rgba(34, 211, 238, 0.1);
      border-left: 4px solid #22D3EE;
      padding: 16px;
      margin: 20px 0;
      border-radius: 6px;
    }
    .detail-row {
      margin: 10px 0;
      display: flex;
      justify-content: space-between;
    }
    .detail-label {
      color: #6B7488;
      font-size: 13px;
    }
    .detail-value {
      color: #F1F5F9;
      font-weight: 600;
      font-size: 13px;
    }
    .steps {
      background: rgba(168, 85, 247, 0.08);
      border: 1px solid rgba(168, 85, 247, 0.3);
      padding: 16px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .steps ol {
      margin: 10px 0;
      padding-left: 20px;
      color: #94A3B8;
    }
    .steps li {
      margin: 8px 0;
      font-size: 14px;
    }
    .cta-button {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(135deg, #22D3EE, #a855f7);
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 700;
      font-size: 14px;
      margin-top: 16px;
    }
    .footer {
      padding: 20px 32px;
      border-top: 1px solid #1e2d45;
      color: #6B7488;
      font-size: 12px;
      text-align: center;
    }
    .divider {
      color: #6B7488;
      margin: 24px 0;
      border: none;
      border-top: 1px solid #1e2d45;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-icon">💰</div>
      <div class="header-text">CamCash</div>
    </div>

    <!-- Body -->
    <div class="body">
      <h2>Hi ${displayName},</h2>

      <p>I'm the founder of CamCash, and I wanted to personally reach out to you about the outage we experienced over the last few days. I sincerely apologize—we know how frustrating that was, and we're implementing additional monitoring to ensure it doesn't happen again.</p>

      <p style="font-size: 16px; line-height: 1.8;">
        As a gesture of our appreciation for your patience,
        <span class="highlight">I've extended your Pro trial by two weeks, free of charge.</span>
      </p>

      <div class="detail-box">
        <h3 style="margin-top: 0; color: #22D3EE; font-size: 15px;">Your Updated Trial Details</h3>
        <div class="detail-row">
          <span class="detail-label">New Trial End Date:</span>
          <span class="detail-value">${newTrialEndDate}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">When You'll Be Charged:</span>
          <span class="detail-value">${newTrialEndDate}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Monthly Subscription Cost:</span>
          <span class="detail-value">\$29.99/month</span>
        </div>
      </div>

      <h2>How to Manage Your Subscription</h2>
      <p>You have full control over your subscription and can manage it anytime:</p>

      <div class="steps">
        <ol>
          <li>Log in to your CamCash dashboard</li>
          <li>Click the <strong>"✦ Pro plan active"</strong> button in the left sidebar</li>
          <li>Click <strong>"⚙️ Manage"</strong> to access your Stripe billing portal</li>
        </ol>
        <p style="margin-top: 16px; color: #94A3B8; font-size: 13px;">
          From the billing portal, you can update your payment method, change your billing cycle, pause, or cancel your subscription—all with just a few clicks.
        </p>
      </div>

      <hr class="divider" />

      <h2>Quick Question</h2>
      <p>Have you had a chance to explore CamCash yet? We'd love to know what you think—whether it's helping you with your analytics, planning, or earnings tracking. Feel free to reply to this email anytime. I read and respond to all customer feedback personally.</p>

      <p style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #1e2d45; color: #94A3B8;">
        <strong style="color: #F1F5F9;">Best regards,</strong><br/>
        Founder, CamCash<br/>
        <a href="mailto:daphneoncam@gmail.com" style="color: #22D3EE; text-decoration: none;">daphneoncam@gmail.com</a>
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>© 2026 CamCash. All rights reserved.</p>
      <p style="margin: 8px 0; font-size: 11px; color: #334155;">
        You're receiving this because you're a CamCash Pro trial member.
      </p>
    </div>
  </div>
</body>
</html>`

    await resend.emails.send({
      from: 'CamCash <noreply@camcash.io>',
      to: email,
      cc: 'daphneoncam@gmail.com',
      subject: 'Your CamCash Pro Trial Has Been Extended – 2 Extra Weeks Free 🎁',
      html,
    })

    return NextResponse.json({
      success: true,
      message: `Email sent to ${email}`,
    })
  } catch (err) {
    console.error('[send-trial-extension-email] Failed:', err.message)
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}

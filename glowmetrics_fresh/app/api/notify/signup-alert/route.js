import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = await request.json();
    const { userId, email, displayName } = body;

    if (!email || !userId) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Send email to user (welcome email)
    await resend.emails.send({
      from: 'CamCash <welcome@camcashgrl.com>',
      to: email,
      subject: '🎉 Welcome to CamCash — You\'re on a 7-day free trial!',
      html: generateWelcomeEmail(displayName || email),
    });

    // Send notification to admin
    await resend.emails.send({
      from: 'CamCash <alerts@camcashgrl.com>',
      to: 'polefreaktrial@gmail.com',
      subject: `📝 New Signup: ${displayName || email}`,
      html: generateAdminSignupAlert(email, displayName),
    });

    // Record signup event
    await supabase.from('signup_events').insert({
      user_id: userId,
      email,
      display_name: displayName,
      signup_email_sent: true,
      signup_email_sent_at: new Date().toISOString(),
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error('[/api/notify/signup-alert] Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

function generateWelcomeEmail(displayName) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#05070f;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">

  <div style="text-align:center;margin-bottom:32px;">
    <div style="width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#22D3EE,#EC4899);display:inline-flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#fff;margin-bottom:20px;">$</div>
    <h1 style="color:#F1F5F9;font-size:26px;font-weight:900;margin:0 0 8px;">Welcome to CamCash! 🎉</h1>
    <p style="color:#94A3B8;font-size:15px;margin:0;line-height:1.6;">Your account is set up with a <strong style="color:#22D3EE;">7-day free trial</strong>.<br>Trial expires in 7 days.</p>
  </div>

  <div style="background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.25);border-radius:14px;padding:20px;margin-bottom:24px;text-align:center;">
    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#22D3EE;">✨ Your trial includes:</p>
    <ul style="margin:12px 0 0;padding:0;list-style:none;font-size:13px;color:#94A3B8;">
      <li style="margin-bottom:6px;">✓ Unlimited CSV uploads</li>
      <li style="margin-bottom:6px;">✓ Full earnings breakdown</li>
      <li style="margin-bottom:6px;">✓ Chrome extension tips tracking</li>
      <li>✓ AI-powered insights</li>
    </ul>
  </div>

  <div style="text-align:center;margin-bottom:28px;">
    <a href="https://www.camcashgrl.com/dashboard" style="display:inline-block;padding:16px 48px;border-radius:12px;background:linear-gradient(135deg,#22D3EE,#EC4899);color:#fff;font-size:16px;font-weight:800;text-decoration:none;">
      Go to Dashboard →
    </a>
  </div>

  <div style="text-align:center;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0 0 6px;font-size:12px;color:#475569;">CamCash · camcashgrl.com</p>
    <p style="margin:0;font-size:12px;color:#475569;">Trial expires in 7 days. No credit card required.</p>
  </div>

</div>
</body>
</html>
  `;
}

function generateAdminSignupAlert(email, displayName) {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <h2>📝 New Signup Alert</h2>
  <p><strong>Email:</strong> ${email}</p>
  <p><strong>Display Name:</strong> ${displayName || 'N/A'}</p>
  <p><strong>Plan:</strong> Free (7-day trial)</p>
  <p><strong>Signup Time:</strong> ${new Date().toISOString()}</p>
  <p><strong>Trial Expires:</strong> ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}</p>
</div>
  `;
}

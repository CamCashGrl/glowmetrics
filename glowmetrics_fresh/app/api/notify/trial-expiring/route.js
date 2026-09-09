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
    const { userId, email, displayName, trialEndsAt } = body;

    if (!email || !userId || !trialEndsAt) {
      return Response.json(
        { error: 'Missing required fields: email, userId, trialEndsAt' },
        { status: 400 }
      );
    }

    const trialEndDate = new Date(trialEndsAt);
    const daysRemaining = Math.ceil((trialEndDate - new Date()) / (1000 * 60 * 60 * 24));

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Send email to user about trial expiration
    const emailSubject = daysRemaining <= 0
      ? '⏰ Your CamCash trial has ended'
      : `⏰ Your CamCash trial expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;

    await resend.emails.send({
      from: 'CamCash <alerts@camcashgrl.com>',
      to: email,
      subject: emailSubject,
      html: generateTrialExpiringEmail(displayName || email, daysRemaining, trialEndDate),
    });

    // Send notification to admin
    await resend.emails.send({
      from: 'CamCash <alerts@camcashgrl.com>',
      to: 'polefreaktrial@gmail.com',
      subject: `⏰ Trial Alert: ${displayName || email} (${daysRemaining} days remaining)`,
      html: generateAdminTrialAlert(email, displayName, daysRemaining, trialEndDate),
    });

    // Record trial notification event
    await supabase.from('signup_events').update({
      trial_notification_sent: true,
      trial_notification_sent_at: new Date().toISOString(),
    }).eq('user_id', userId);

    return Response.json({ success: true, daysRemaining });
  } catch (err) {
    console.error('[/api/notify/trial-expiring] Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

function generateTrialExpiringEmail(displayName, daysRemaining, trialEndDate) {
  const isExpired = daysRemaining <= 0;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#05070f;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">

  <div style="text-align:center;margin-bottom:32px;">
    <div style="width:64px;height:64px;border-radius:18px;background:${isExpired ? '#EF4444' : '#F59E0B'};display:inline-flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#fff;margin-bottom:20px;">⏰</div>
    <h1 style="color:#F1F5F9;font-size:26px;font-weight:900;margin:0 0 8px;">${isExpired ? 'Trial Ended' : 'Trial Expiring Soon'}</h1>
    <p style="color:#94A3B8;font-size:15px;margin:0;line-height:1.6;">
      ${isExpired
        ? 'Your 7-day trial has ended. Upgrade to Pro to keep using CamCash.'
        : `Your trial expires in <strong style="color:#F59E0B;">${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong> on ${trialEndDate.toLocaleDateString()}.`}
    </p>
  </div>

  <div style="background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.25);border-radius:14px;padding:20px;margin-bottom:24px;">
    <h2 style="color:#22D3EE;font-size:16px;margin:0 0 16px;">Go Pro for just $9.99/month</h2>
    <ul style="margin:0;padding:0;list-style:none;font-size:14px;color:#94A3B8;">
      <li style="margin-bottom:10px;"><strong style="color:#F1F5F9;">✓ Unlimited uploads</strong> — import data from any platform</li>
      <li style="margin-bottom:10px;"><strong style="color:#F1F5F9;">✓ Full analytics</strong> — top fans, peak hours, earnings trends</li>
      <li style="margin-bottom:10px;"><strong style="color:#F1F5F9;">✓ Chrome extension</strong> — automatic tip tracking while you stream</li>
      <li><strong style="color:#F1F5F9;">✓ AI insights</strong> — personalized recommendations to boost earnings</li>
    </ul>
  </div>

  <div style="text-align:center;margin-bottom:28px;">
    <a href="https://www.camcashgrl.com/pricing" style="display:inline-block;padding:16px 48px;border-radius:12px;background:linear-gradient(135deg,#22D3EE,#EC4899);color:#fff;font-size:16px;font-weight:800;text-decoration:none;margin-bottom:12px;">
      Upgrade to Pro Now →
    </a>
    <p style="color:#94A3B8;font-size:13px;margin:12px 0 0;">No lock-in. Cancel anytime.</p>
  </div>

  <div style="text-align:center;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0 0 6px;font-size:12px;color:#475569;">CamCash · camcashgrl.com</p>
    <p style="margin:0;font-size:12px;color:#475569;">Questions? Reply to this email or contact support.</p>
  </div>

</div>
</body>
</html>
  `;
}

function generateAdminTrialAlert(email, displayName, daysRemaining, trialEndDate) {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <h2>⏰ Trial Expiration Alert</h2>
  <p><strong>User:</strong> ${displayName || email}</p>
  <p><strong>Email:</strong> ${email}</p>
  <p><strong>Days Remaining:</strong> ${daysRemaining > 0 ? daysRemaining : 'EXPIRED'}</p>
  <p><strong>Trial Expires:</strong> ${trialEndDate.toISOString()}</p>
  <p><strong>Action:</strong> Consider reaching out if trial expires without conversion</p>
</div>
  `;
}

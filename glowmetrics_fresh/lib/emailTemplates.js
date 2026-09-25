// ============================================================
// CAMCASH — RETENTION EMAIL TEMPLATES
// ============================================================
// Single source of truth for all retention email templates
// Used by /api/emails/* routes

export const emailTemplates = {
  welcome: {
    subject: 'Welcome to CamCash — Your First Steps 🎉',
    getBody: (email, displayName) => `Hi ${displayName || email.split('@')[0]}!

Welcome to CamCash! 🎉 We're thrilled to have you on board.

CamCash helps you understand exactly where your money comes from and how to earn more. Here's what you can do right now:

📱 NEXT STEP: Connect Your First Platform
Head to your dashboard and add Chaturbate, BongaCams, MyFreeCams, or Stripchat. This takes less than 1 minute and gives you immediate access to live tip tracking and real-time alerts.

🎯 FREE TIER INCLUDES:
✓ Track up to 3 platforms
✓ CSV tip history uploads
✓ Live tip detection while streaming
✓ Basic earnings dashboard
✓ 31-day rolling analysis per platform
✓ Real-time alerts & live mode coaching

💰 READY TO GO DEEPER?
Upgrade to Standard ($19.99/month) to unlock unlimited platforms, full earnings history, fan profiles, advanced coaching, and more.

Questions? Reply to this email — we're here to help!

Best,
The CamCash Team
`.trim(),
  },

  platformConnected: {
    subject: '✓ Platform Connected — Your Next Step',
    getBody: (displayName, platform) => `Hi ${displayName}!

Great job connecting ${platform}! 🎉

Now you can:
✓ See live tip alerts while you stream
✓ Track your earnings across sessions
✓ Get analytics on your top fans

📥 IMPORT YOUR TIP HISTORY
To unlock advanced insights (best streaming times, fan analysis, etc.), import your past tips:

1. Go to your dashboard → "Import" tab
2. Download your tip history from ${platform}
3. Upload the CSV file

This takes about 3 minutes and gives you the data to unlock insights.

After your first import, you'll see:
• Your earnings breakdown by day, fan, and stream length
• Peak earning windows (your best hours to stream)
• Top fan analytics (who tips most, who's most loyal)
• Stream performance metrics

📚 NEED HELP?
See our guide: https://camcash.app/blog/how-to-upload-csv-to-camcash

Happy tracking!
The CamCash Team
`.trim(),
  },

  day3Follow: {
    subject: 'Here\'s What Pro Unlocks for You 💎',
    getBody: (displayName) => `Hi ${displayName}!

We noticed you connected your platform — awesome! 🙌

73% of creators who imported their tip history upgraded to Standard within a week. Here's why:

🔓 STANDARD PLAN UNLOCKS:
✓ Unlimited platform tracking (instead of 3)
✓ Full earnings history (instead of 31-day rolling window)
✓ Advanced fan profiles & CRM tools
✓ Cross-platform earnings comparisons
✓ Private-session analytics
✓ Advanced Live Mode coaching
✓ Complete historical trend analysis
✓ Money Map (see where your money comes from)
✓ Stream Planner (optimize your schedule)
✓ Churn & re-engagement insights

💰 JUST $19.99/MONTH OR $99/YEAR
No commitments. Cancel anytime. All features included.

👉 UPGRADE NOW →  https://camcash.app/pricing

Questions? We're happy to help — reply to this email.

Best,
The CamCash Team
`.trim(),
  },

  day7Final: {
    subject: '⏰ Your Free History is Ending Soon — Upgrade Before It\'s Gone',
    getBody: (displayName) => `Hi ${displayName}!

Quick heads up: Your free plan shows the last 31 days of analytics.

If you don't upgrade in the next 7 days, your older earnings data will be hidden. But don't worry — it's not deleted, just inaccessible on the free plan.

💡 HERE'S THE CATCH:
Free tier: See only the past 31 days
Standard: See your ENTIRE earnings history

Being able to look back and see trends from months ago is powerful. You can spot:
→ Seasonal earnings patterns
→ Which platforms pay best over time
→ Fan loyalty trends
→ Your real average earnings per hour

🎯 UPGRADE TO STANDARD
Just $19.99/month. See your full history. Cancel anytime.

→ https://camcash.app/pricing

We've also thrown in a bonus: your first 7 days are half off if you upgrade in the next 48 hours.

Ready? https://camcash.app/pricing

Questions? Reply to this email.

Best,
The CamCash Team
`.trim(),
  },
}

// Helper to send via Resend API
export async function sendEmail(to, subject, text) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CamCash <notifications@camcash.co>',
        to,
        subject,
        text,
        reply_to: 'support@camcash.co',
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Resend API error:', error)
      return { success: false, error: error.message }
    }

    const data = await response.json()
    return { success: true, messageId: data.id }
  } catch (error) {
    console.error('Email send failed:', error.message)
    return { success: false, error: error.message }
  }
}

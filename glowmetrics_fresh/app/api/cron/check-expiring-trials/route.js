import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('Authorization');
    const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedSecret) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Find users with trials expiring in the next 1 day or already expired
    const { data: expiringTrials, error: queryError } = await supabase
      .from('profiles')
      .select('id, trial_ends_at')
      .lte('trial_ends_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
      .gt('trial_ends_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .is('trial_notification_sent', null);

    if (queryError) throw queryError;

    let sentCount = 0;

    for (const trial of expiringTrials || []) {
      try {
        // Get user email
        const { data: user } = await supabase.auth.admin.getUserById(trial.id);
        if (!user) continue;

        // Send trial expiring notification
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://www.camcashgrl.com'}/api/notify/trial-expiring`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: trial.id,
            email: user.email,
            displayName: user.user_metadata?.display_name,
            trialEndsAt: trial.trial_ends_at,
          }),
        });

        if (response.ok) sentCount++;
      } catch (err) {
        console.error(`Error notifying user ${trial.id}:`, err);
      }
    }

    return Response.json({
      success: true,
      message: `Sent ${sentCount} trial expiration notifications`,
      checked: expiringTrials?.length || 0,
    });
  } catch (err) {
    console.error('[/api/cron/check-expiring-trials] Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

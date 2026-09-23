import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function corsHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const allowed = origin.startsWith('chrome-extension://')
    ? origin
    : 'https://www.camcashgrl.com';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req) {
  const cors = corsHeaders(req);

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Missing authorization' }, { status: 401, headers: cors });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const since = searchParams.get('since');

    // Get the active live session for this user
    const { data: activeSession, error: sessionError } = await supabaseAdmin
      .from('live_sessions')
      .select('id, tips_cleared_at')
      .eq('user_id', user.id)
      .in('status', ['starting', 'active', 'paused', 'stopping', 'needs_resolution'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError) throw sessionError;

    // Build query for live_tips
    let query = supabaseAdmin
      .from('live_tips')
      .select('id, username, tokens, usd, platform, received_at, live_session_id')
      .eq('user_id', user.id)
      .order('received_at', { ascending: false })
      .limit(limit);

    if (since) {
      query = query.gt('received_at', since);
    }

    const { data: tips, error } = await query;
    if (error) throw error;

    // Filter out cleared tips (same logic as /api/live/tips GET)
    let filteredTips = tips || [];
    if (activeSession?.tips_cleared_at) {
      const clearedAtMs = new Date(activeSession.tips_cleared_at).getTime();
      filteredTips = filteredTips.filter((t) => {
        if (t.live_session_id !== activeSession.id) return true;
        return new Date(t.received_at).getTime() > clearedAtMs;
      });
    }

    // Calculate platform totals and breakdown
    const platformTotals = {};
    const platformTipCounts = {};

    filteredTips.forEach((tip) => {
      const platform = tip.platform || 'Unknown';
      if (!platformTotals[platform]) {
        platformTotals[platform] = 0;
        platformTipCounts[platform] = 0;
      }
      platformTotals[platform] += tip.usd || 0;
      platformTipCounts[platform] += 1;
    });

    // Sort platforms by total USD (descending)
    const platformStats = Object.keys(platformTotals)
      .map((platform) => ({
        platform,
        totalUSD: parseFloat(platformTotals[platform].toFixed(2)),
        tipCount: platformTipCounts[platform],
      }))
      .sort((a, b) => b.totalUSD - a.totalUSD);

    // Determine currently streaming platform (most recent tip's platform)
    const currentlyStreaming = filteredTips.length > 0 ? filteredTips[0].platform || 'Unknown' : null;

    // Reverse tips to chronological order (oldest first) for the feed
    const tipsChronological = [...filteredTips].reverse();

    return Response.json(
      {
        tips: tipsChronological,
        platformStats,
        currentlyStreaming,
        sessionId: activeSession?.id || null,
        tipsClearedAt: activeSession?.tips_cleared_at || null,
        totalTips: filteredTips.length,
        totalUSD: parseFloat(
          filteredTips.reduce((sum, t) => sum + (t.usd || 0), 0).toFixed(2)
        ),
      },
      { headers: cors }
    );
  } catch (err) {
    console.error('Tip stream GET error:', err);
    return Response.json(
      { error: err.message },
      { status: 500, headers: cors }
    );
  }
}

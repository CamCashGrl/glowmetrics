import { createClient } from '@supabase/supabase-js';
import { tokenRate } from '../../../../lib/constants';

export const dynamic = 'force-dynamic';

function corsHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const allowed = origin.startsWith('chrome-extension://')
    ? origin
    : 'https://www.camcashgrl.com';
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req) {
  const cors = corsHeaders(req);

  try {
    // Constructing these inside the try means a misconfigured/missing key
    // (e.g. SUPABASE_SERVICE_ROLE_KEY unset in this environment) is caught
    // and returned as a normal JSON error with CORS headers attached,
    // instead of an uncaught exception that skips both.
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
      return Response.json({ error: 'Invalid or expired token' }, { status: 401, headers: cors });
    }

    const body = await req.json();
    const { username, amount, platform, timestamp } = body;

    if (!username || !amount || !platform) {
      return Response.json(
        { error: 'Missing required fields: username, amount, platform' },
        { status: 400, headers: cors }
      );
    }

    // Use the tip's own timestamp (ms) so back-to-back tips from the same user
    // with the same amount are only deduped if they share the exact same event time.
    const receivedAt = timestamp || new Date().toISOString();
    const tsMs = new Date(receivedAt).getTime();
    const deduplication_key = `${user.id}-${username.trim().toLowerCase()}-${amount}-${platform.toLowerCase()}-${tsMs}`;

    const tipData = {
      user_id:  user.id,
      username: username.trim(),
      tokens:   parseInt(amount, 10),
      usd:      parseFloat((parseInt(amount, 10) * tokenRate(platform)).toFixed(2)),
      platform: platform.toLowerCase(),
      source:   'extension',
      received_at: receivedAt,
      deduplication_key,
    };

    const { data, error } = await supabaseAdmin
      .from('live_tips')
      .insert(tipData)
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      if (error.message?.includes('PLATFORM_LIMIT_REACHED')) {
        return Response.json({
          error: 'Free tier tracks 1 platform. Upgrade to Standard ($19.99/mo) to track multiple platforms.',
          code: 'platform_limit_reached',
          upgradeUrl: '/pricing',
        }, { status: 402, headers: cors });
      }
      return Response.json({ error: 'Failed to save tip' }, { status: 500, headers: cors });
    }

    // Permanent history (dashboard analytics) is a Pro feature — live coaching
    // and the live tip feed above are free on every supported platform, but
    // only paid plans get tips written into the historical `tips` table.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle();
    const savedToHistory = profile?.plan === 'pro' || profile?.plan === 'unlimited';

    if (savedToHistory) {
      await supabaseAdmin.from('tips').insert({
        user_id:   user.id,
        username:  username.trim(),
        tokens:    parseInt(amount, 10),
        platform:  platform.toLowerCase(),
        date_time: receivedAt,
      });
    }

    return Response.json(
      { success: true, tip: data[0], savedToHistory, message: `Tip from ${username} synced` },
      { headers: cors }
    );

  } catch (err) {
    console.error('Tip POST error:', err);
    return Response.json({ error: err.message }, { status: 500, headers: cors });
  }
}

export async function GET(req) {
  const cors = corsHeaders(req);

  try {
    // See POST above — constructing these inside the try catches a
    // misconfigured/missing key instead of throwing uncaught.
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const since = searchParams.get('since');

    let query = supabaseAdmin
      .from('live_tips')
      .select('*')
      .eq('user_id', user.id)
      .order('received_at', { ascending: false })
      .limit(limit);

    if (since) query = query.gt('received_at', since);

    const { data, error } = await query;
    if (error) throw error;

    return Response.json({ tips: data, count: data?.length || 0 }, { headers: cors });

  } catch (err) {
    console.error('Tip GET error:', err);
    return Response.json({ error: err.message }, { status: 500, headers: cors });
  }
}

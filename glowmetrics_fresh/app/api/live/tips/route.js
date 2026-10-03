import { createClient } from '@supabase/supabase-js';
import { tokenRate } from '../../../../lib/constants';
import { platformLimitMessage } from '../../../../lib/planLimits';

async function logLiveFailure(supabaseAdmin, userId, liveSessionId, failureType, severity, errorMessage, errorContext) {
  try {
    await supabaseAdmin.rpc('log_live_mode_failure', {
      p_user_id: userId,
      p_live_session_id: liveSessionId,
      p_failure_type: failureType,
      p_severity: severity,
      p_error_message: errorMessage,
      p_error_context: errorContext
    })
  } catch (err) {
    console.warn('[LIVE] Failed to log live mode failure:', err.message)
  }
}

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
      // Can't log failure without user_id, so just return error
      return Response.json({ error: 'Invalid or expired token' }, { status: 401, headers: cors });
    }

    const body = await req.json();
    const { username, amount, platform, timestamp, isTest, clientEventId, detectedAt } = body;

    if (!username || !amount || !platform) {
      const missingFields = [!username && 'username', !amount && 'amount', !platform && 'platform'].filter(Boolean).join(', ');
      await logLiveFailure(supabaseAdmin, user.id, null, 'data_fetch_error', 'error', `Missing required fields: ${missingFields}`, { received_fields: Object.keys(body) });
      return Response.json(
        { error: 'Missing required fields: username, amount, platform' },
        { status: 400, headers: cors }
      );
    }

    // Phase 1: clientEventId is required for idempotent deduplication
    if (!clientEventId) {
      await logLiveFailure(supabaseAdmin, user.id, null, 'data_fetch_error', 'error', 'Missing clientEventId for idempotent deduplication', { received_fields: Object.keys(body) });
      return Response.json(
        { error: 'Missing clientEventId for idempotent deduplication' },
        { status: 400, headers: cors }
      );
    }

    // Room-ownership verification (#285) is reverted here: the extension has
    // no way to tell "I am the broadcaster of this room" apart from "I am a
    // viewer" — detectBroadcasterUsername() in content.js just reads whose
    // room it is from the page, the same for every visitor. The check that
    // depended on that signal required a broadcaster_accounts row that
    // nothing in the app ever creates, so it rejected every real tip for
    // every user, unconditionally, since the day it shipped. A tip is
    // trusted based on the authenticated Supabase session alone, same as
    // before #285 — that auth token isn't spoofable, unlike the room-name
    // heuristic this replaces. Revisit only alongside an actual reliable
    // broadcaster-vs-viewer signal, not a self-reported username field.

    // The popup's "Test Tip" button proves the extension can reach this
    // route (auth token valid, network path working) without ever writing
    // anything real — not live_tips (which would inflate a genuinely live
    // session's earnings-per-hour/tip-count with fake data) and not the
    // permanent tips history. Short-circuits before any DB access.
    if (isTest) {
      return Response.json(
        { success: true, tip: null, savedToHistory: false, message: `Test tip from ${username} acknowledged (not saved)` },
        { headers: cors }
      );
    }

    // Phase 1: Use the extension's original detection timestamp and client event ID
    const receivedAt = timestamp || new Date().toISOString();
    const detectedAtFinal = detectedAt || receivedAt;

    // TODO: Consolidate token rate logic — move from /lib/constants.js tokenRate()
    // into persist_extension_tip() RPC or a shared server-side utility. Currently
    // the RPC duplicates rates to ensure correctness, but this creates maintenance
    // burden (two sources of truth). Decide ownership after Phase 1 stabilizes.

    // Phase 1: Call persist_extension_tip() RPC for atomic, idempotent persistence
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'persist_extension_tip',
      {
        p_client_event_id: clientEventId,
        p_username: username,
        p_tokens: parseInt(amount, 10),
        p_platform: platform,
        p_broadcaster_username: null, // Legacy field, not used
        p_received_at: receivedAt,
        p_detected_at: detectedAtFinal,
      }
    );

    if (rpcError || !rpcResult?.success) {
      console.error('[LIVE] RPC error:', rpcError || rpcResult?.error);
      const errorMessage = rpcResult?.error || rpcError?.message || 'Failed to persist tip';
      const errorCode = rpcResult?.error_code || rpcError?.code || 'UNKNOWN';

      if (errorMessage.includes('PLATFORM_LIMIT_REACHED')) {
        await logLiveFailure(supabaseAdmin, user.id, null, 'save_error', 'critical', 'Platform limit reached during live tip insertion', { platform, error_code: errorCode });
        return Response.json({
          error: platformLimitMessage(),
          code: 'platform_limit_reached',
          upgradeUrl: '/pricing',
        }, { status: 402, headers: cors });
      }

      if (errorCode === '28000') {
        // Not authenticated
        return Response.json({ error: 'Not authenticated' }, { status: 401, headers: cors });
      }

      await logLiveFailure(supabaseAdmin, user.id, null, 'save_error', 'error', `Failed to persist tip via RPC: ${errorMessage}`, { platform, error_code: errorCode, client_event_id: clientEventId });
      return Response.json({ error: 'Failed to save tip' }, { status: 500, headers: cors });
    }

    // Phase 1: ALL users get canonical history now (not Pro-only)
    // The RPC already inserted to tips table, so always mark as savedToHistory
    const savedToHistory = true;

    // Fetch the live_tip from the database to return in response
    let liveTip = null;
    try {
      const { data: tip } = await supabaseAdmin
        .from('live_tips')
        .select()
        .eq('id', rpcResult.live_tip_id)
        .maybeSingle();
      liveTip = tip;
    } catch (_) {
      // If fetch fails, that's ok — we know the RPC succeeded
    }

    return Response.json(
      {
        success: true,
        tip: liveTip,
        savedToHistory,
        clientEventId: rpcResult.client_event_id,
        message: `Tip from ${username} synced to live and history`
      },
      { headers: cors }
    );

  } catch (err) {
    console.error('Tip POST error:', err);
    // Can't reliably log without user context at this point
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

    // "Clear Session Tips" never deletes rows — it hides them by setting
    // tips_cleared_at on the current session. Apply that filter here too so
    // this route stays consistent with the client-side feeds, scoped only
    // to that exact session's own tips (never a blanket user-wide cutoff).
    let tips = data;
    const { data: currentSession } = await supabaseAdmin
      .from('live_sessions')
      .select('id, tips_cleared_at')
      .eq('user_id', user.id)
      .in('status', ['starting', 'active', 'paused', 'stopping', 'needs_resolution'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (currentSession?.tips_cleared_at) {
      const clearedAtMs = new Date(currentSession.tips_cleared_at).getTime();
      tips = tips.filter((t) => {
        if (t.live_session_id !== currentSession.id) return true;
        return new Date(t.received_at).getTime() > clearedAtMs;
      });
    }

    return Response.json({ tips, count: tips?.length || 0 }, { headers: cors });

  } catch (err) {
    console.error('Tip GET error:', err);
    return Response.json({ error: err.message }, { status: 500, headers: cors });
  }
}

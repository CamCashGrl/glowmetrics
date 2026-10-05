import { createClient } from '@supabase/supabase-js';
import { tokenRate } from '../../../../lib/constants';
import { platformLimitMessage } from '../../../../lib/planLimits';
import crypto from 'crypto';

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
    const { username, amount, platform, timestamp, isTest, clientEventId } = body;

    if (!username || !amount || !platform) {
      const missingFields = [!username && 'username', !amount && 'amount', !platform && 'platform'].filter(Boolean).join(', ');
      await logLiveFailure(supabaseAdmin, user.id, null, 'data_fetch_error', 'error', `Missing required fields: ${missingFields}`, { received_fields: Object.keys(body) });
      return Response.json(
        { error: 'Missing required fields: username, amount, platform' },
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

    // Use the tip's own timestamp (ms) so back-to-back tips from the same user
    // with the same amount are only deduped if they share the exact same event time.
    const receivedAt = timestamp || new Date().toISOString();
    const tsMs = new Date(receivedAt).getTime();
    const deduplication_key = `${user.id}-${username.trim().toLowerCase()}-${amount}-${platform.toLowerCase()}-${tsMs}`;

    // Phase 1 writer: clientEventId from extension identifies the logical tip event.
    // For backward compatibility with old extension payloads lacking clientEventId,
    // derive a deterministic UUID from the deduplication_key so retries are idempotent.
    let eventId = clientEventId;
    if (!eventId) {
      const hash = crypto.createHash('sha256').update(deduplication_key).digest();
      // Convert first 16 bytes of SHA256 to UUID format
      eventId = [
        hash.toString('hex', 0, 4),
        hash.toString('hex', 4, 6),
        hash.toString('hex', 6, 8),
        hash.toString('hex', 8, 10),
        hash.toString('hex', 10, 16),
      ].join('-');
    }

    // Attribute this tip to the caller's current live_sessions row when it's
    // 'active', or 'needs_resolution' — never while 'paused' or absent.
    // needs_resolution is included because a tip landing during that window
    // is the strongest possible proof the stream never actually stopped: it
    // both cancels the pending "Are you still there?" auto-end (see
    // sweep_stale_live_session()) and correctly counts toward the session if
    // it later resolves back to active. A tip that arrives while paused
    // still gets saved above (no income data is lost), it just isn't
    // counted toward this session's analytics. Best-effort: a lookup
    // failure must never block saving the tip itself, so it's wrapped
    // separately from the main persist call.
    let live_session_id = null;
    try {
      const { data: activeSession } = await supabaseAdmin
        .from('live_sessions')
        .select('id, status')
        .eq('user_id', user.id)
        .in('status', ['active', 'needs_resolution'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (activeSession) live_session_id = activeSession.id;
    } catch (_) {
      // live_sessions lookup failed — tip is still saved, just unattributed.
    }

    const tokens = parseInt(amount, 10);
    const usd = parseFloat((tokens * tokenRate(platform)).toFixed(2));
    const queuedMs = Date.now() - tsMs; // Approximate queue time

    // Phase 1: Call persist_extension_tip() RPC to atomically persist both
    // canonical tips + live_tips. This is the authoritative writer for all
    // extension earnings, regardless of plan tier.
    const { data, error } = await supabaseAdmin.rpc('persist_extension_tip', {
      p_user_id: user.id,
      p_client_event_id: eventId,
      p_deduplication_key: deduplication_key,
      p_username: username.trim(),
      p_tokens: tokens,
      p_usd: usd,
      p_platform: platform.toLowerCase(),
      p_event_at: receivedAt,
      p_queued_ms: Math.max(0, queuedMs),
    });

    if (error) {
      console.error('persist_extension_tip RPC error:', error);
      if (error.message?.includes('PLATFORM_LIMIT_REACHED')) {
        await logLiveFailure(supabaseAdmin, user.id, live_session_id, 'save_error', 'critical', 'Platform limit reached during tip persistence', { platform, error_code: error.code, error_message: error.message });
        return Response.json({
          error: platformLimitMessage(),
          code: 'platform_limit_reached',
          upgradeUrl: '/pricing',
        }, { status: 402, headers: cors });
      }
      await logLiveFailure(supabaseAdmin, user.id, live_session_id, 'save_error', 'error', `Failed to persist tip: ${error.message}`, { platform, error_code: error.code, username });
      return Response.json({ error: 'Failed to save tip' }, { status: 500, headers: cors });
    }

    // RPC returns { success, duplicate, live_tip_id, tip_id, live_session_id, client_event_id }
    // success=false indicates validation failure; duplicate=true indicates retry of existing event
    if (!data?.success) {
      console.error('persist_extension_tip RPC returned success=false:', data);
      await logLiveFailure(supabaseAdmin, user.id, live_session_id, 'save_error', 'error', 'RPC persistence failed (validation)', { platform, username, rpc_data: data });
      return Response.json({ error: 'Failed to save tip' }, { status: 500, headers: cors });
    }

    // Duplicate event (retry of existing event_id or dedup_key) — return 200 with duplicate flag
    if (data.duplicate) {
      return Response.json(
        { success: true, duplicate: true, live_tip_id: data.live_tip_id, message: `Tip from ${username} already received` },
        { headers: cors }
      );
    }

    // New event successfully persisted
    return Response.json(
      { success: true, duplicate: false, live_tip_id: data.live_tip_id, tip_id: data.tip_id, message: `Tip from ${username} persisted` },
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

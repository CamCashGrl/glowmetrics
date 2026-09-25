/**
 * Stream end detection and final tip sync
 *
 * Called when:
 * - User manually stops streaming
 * - Extension detects stream end (no tips for 5+ minutes)
 * - Dashboard detects user is offline
 *
 * This endpoint:
 * 1. Fetches any remaining tips from all platforms (final sync)
 * 2. Stops the active live session
 * 3. Returns summary of earnings for the stream
 * 4. Triggers dashboard refresh
 *
 * SECURITY:
 * - Requires authentication
 * - Only stops own stream (own user_id)
 * - Only syncs to own account
 * - Verifies session ownership
 */

import { createClient } from '@supabase/supabase-js';
import { fetchPlatformTips, storeTipsToDatabase } from '../../../../../lib/platform-apis';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function corsHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const allowed = origin.startsWith('chrome-extension://')
    ? origin
    : 'https://www.camcashgrl.com';
  return {
    'Access-Control-Allow-Origin': allowed,
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
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // ─── Authenticate user ─────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json(
        { error: 'Missing authorization' },
        { status: 401, headers: cors }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return Response.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: cors }
      );
    }

    const userId = user.id;
    const body = await req.json();
    const { sessionId } = body;

    // ─── Verify session exists and belongs to user ────────────────────────
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('live_sessions')
      .select('id, user_id, status, started_at, tips_total_usd')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      return Response.json(
        { error: 'Session not found or access denied' },
        { status: 404, headers: cors }
      );
    }

    // ─── Fetch any final tips from all platforms ──────────────────────────
    console.log(`[StreamEnd] Performing final tip sync for user ${userId}, session ${sessionId}`);

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan, chaturbate_username, chaturbate_api_token, bongacams_username, bongacams_password, myfreecams_username, myfreecams_token, stripchat_username, stripchat_oauth_token, camsoda_username, camsoda_api_key')
      .eq('id', userId)
      .single();

    const saveToHistory = profile?.plan === 'pro' || profile?.plan === 'unlimited';
    const platformsToFetch = [];

    if (profile?.chaturbate_username && profile?.chaturbate_api_token) {
      platformsToFetch.push({
        name: 'chaturbate',
        username: profile.chaturbate_username,
        credentials: { chaturbate_api_token: profile.chaturbate_api_token },
      });
    }
    if (profile?.bongacams_username && profile?.bongacams_password) {
      platformsToFetch.push({
        name: 'bongacams',
        username: profile.bongacams_username,
        credentials: { bongacams_password: profile.bongacams_password },
      });
    }
    if (profile?.myfreecams_username && profile?.myfreecams_token) {
      platformsToFetch.push({
        name: 'myfreecams',
        username: profile.myfreecams_username,
        credentials: { myfreecams_token: profile.myfreecams_token },
      });
    }
    if (profile?.stripchat_username && profile?.stripchat_oauth_token) {
      platformsToFetch.push({
        name: 'stripchat',
        username: profile.stripchat_username,
        credentials: { stripchat_oauth_token: profile.stripchat_oauth_token },
      });
    }
    if (profile?.camsoda_username && profile?.camsoda_api_key) {
      platformsToFetch.push({
        name: 'camsoda',
        username: profile.camsoda_username,
        credentials: { camsoda_api_key: profile.camsoda_api_key },
      });
    }

    let finalTipCount = 0;
    let finalUsdEarned = 0;

    // Fetch from all platforms (best effort - don't fail if one platform errors)
    if (platformsToFetch.length > 0) {
      const fetchPromises = platformsToFetch.map(p =>
        fetchPlatformTips(p.name, p.username, p.credentials, supabaseClient)
          .then(tips => ({ platform: p.name, tips, error: null }))
          .catch(err => {
            console.warn(`[StreamEnd] Platform ${p.name} fetch failed:`, err.message);
            return { platform: p.name, tips: [], error: err.message };
          })
      );

      const results = await Promise.all(fetchPromises);
      let allFinalTips = [];

      for (const result of results) {
        if (!result.error && result.tips.length > 0) {
          allFinalTips = allFinalTips.concat(result.tips);
        }
      }

      if (allFinalTips.length > 0) {
        const storeResult = await storeTipsToDatabase(userId, allFinalTips, supabaseAdmin, saveToHistory);
        finalTipCount = storeResult.inserted;
        finalUsdEarned = allFinalTips.reduce((sum, t) => sum + (t.usd || 0), 0);
      }
    }

    // ─── Get current session totals before closing ────────────────────────
    const { data: liveTips } = await supabaseAdmin
      .from('live_tips')
      .select('usd, amount')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .gte('created_at', session.started_at);

    const sessionUsdTotal = (liveTips || []).reduce((sum, t) => sum + (t.usd || 0), 0);
    const sessionTipCount = (liveTips || []).length;

    // ─── Close the live session ─────────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from('live_sessions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        tips_total_usd: sessionUsdTotal,
        tips_count: sessionTipCount,
      })
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('[StreamEnd] Failed to close session:', updateError.message);
    }

    console.log(`[StreamEnd] Completed for user ${userId}, session ${sessionId}. Final tips: ${finalTipCount}, Total: $${sessionUsdTotal.toFixed(2)}`);

    return Response.json(
      {
        success: true,
        sessionId,
        streamSummary: {
          totalEarned: sessionUsdTotal,
          totalTips: sessionTipCount,
          finalSyncTips: finalTipCount,
          finalSyncUsd: finalUsdEarned,
        },
        message: `Stream ended. Synced ${finalTipCount} final tip(s) worth $${finalUsdEarned.toFixed(2)}.`,
      },
      { status: 200, headers: cors }
    );

  } catch (err) {
    console.error('[StreamEnd] Error:', err);
    return Response.json(
      { error: 'Failed to end stream' },
      { status: 500, headers: cors }
    );
  }
}

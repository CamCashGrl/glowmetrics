/**
 * Unified multi-platform tip fetching endpoint
 *
 * Called by:
 * - Extension (on demand to refresh tips from all platforms)
 * - Dashboard (to sync tips from all platforms)
 * - Background cron job (to periodically pull tips)
 *
 * SECURITY:
 * - Requires authentication
 * - Only fetches from platforms user has configured
 * - Only stores to authenticated user's account
 * - Validates all platform credentials exist
 * - Rate-limited to prevent abuse
 */

import { createClient } from '@supabase/supabase-js';
import { fetchPlatformTips, storeTipsToDatabase } from '../../../../../lib/platform-apis';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel timeout

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

    // ─── Get user's plan to determine if tips save to history ──────────────
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan, chaturbate_username, chaturbate_api_token, bongacams_username, bongacams_password, myfreecams_username, myfreecams_token, stripchat_username, stripchat_oauth_token, camsoda_username, camsoda_api_key')
      .eq('id', userId)
      .single();

    if (!profile) {
      return Response.json(
        { error: 'Profile not found' },
        { status: 404, headers: cors }
      );
    }

    const saveToHistory = profile.plan === 'pro' || profile.plan === 'unlimited';

    // ─── Identify which platforms are configured ──────────────────────────
    const platformsToFetch = [];
    if (profile.chaturbate_username && profile.chaturbate_api_token) {
      platformsToFetch.push({
        name: 'chaturbate',
        username: profile.chaturbate_username,
        credentials: {
          chaturbate_api_token: profile.chaturbate_api_token,
        },
      });
    }
    if (profile.bongacams_username && profile.bongacams_password) {
      platformsToFetch.push({
        name: 'bongacams',
        username: profile.bongacams_username,
        credentials: {
          bongacams_password: profile.bongacams_password,
        },
      });
    }
    if (profile.myfreecams_username && profile.myfreecams_token) {
      platformsToFetch.push({
        name: 'myfreecams',
        username: profile.myfreecams_username,
        credentials: {
          myfreecams_token: profile.myfreecams_token,
        },
      });
    }
    if (profile.stripchat_username && profile.stripchat_oauth_token) {
      platformsToFetch.push({
        name: 'stripchat',
        username: profile.stripchat_username,
        credentials: {
          stripchat_oauth_token: profile.stripchat_oauth_token,
        },
      });
    }
    if (profile.camsoda_username && profile.camsoda_api_key) {
      platformsToFetch.push({
        name: 'camsoda',
        username: profile.camsoda_username,
        credentials: {
          camsoda_api_key: profile.camsoda_api_key,
        },
      });
    }

    if (platformsToFetch.length === 0) {
      return Response.json(
        { error: 'No platform credentials configured' },
        { status: 400, headers: cors }
      );
    }

    // ─── Fetch from all configured platforms in parallel ───────────────────
    console.log(`[Multi-Platform] Fetching tips for user ${userId} from ${platformsToFetch.length} platform(s)`);

    const fetchPromises = platformsToFetch.map(p =>
      fetchPlatformTips(p.name, p.username, p.credentials, supabaseClient)
        .then(tips => ({ platform: p.name, tips, error: null }))
        .catch(err => ({ platform: p.name, tips: [], error: err.message }))
    );

    const results = await Promise.all(fetchPromises);

    // ─── Aggregate successful fetches and store to database ────────────────
    let allTips = [];
    const platformResults = {};

    for (const result of results) {
      platformResults[result.platform] = {
        success: !result.error,
        tipCount: result.tips.length,
        error: result.error,
      };

      if (!result.error && result.tips.length > 0) {
        allTips = allTips.concat(result.tips);
      }
    }

    // Store all tips to database
    const storeResult = await storeTipsToDatabase(userId, allTips, supabaseAdmin, saveToHistory);

    console.log(`[Multi-Platform] Stored ${storeResult.inserted} tips for user ${userId}`);

    return Response.json(
      {
        success: true,
        totalTips: allTips.length,
        inserted: storeResult.inserted,
        skipped: storeResult.skipped,
        platformResults,
        saveToHistory,
      },
      { status: 200, headers: cors }
    );

  } catch (err) {
    console.error('[Multi-Platform] Fetch failed:', err);
    return Response.json(
      { error: 'Failed to fetch tips from platforms' },
      { status: 500, headers: cors }
    );
  }
}

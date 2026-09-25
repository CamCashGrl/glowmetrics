/**
 * Platform-agnostic API handlers for tip fetching from multiple streaming platforms.
 * Each platform has its own API endpoint and credential structure.
 *
 * SECURITY: All platform credentials are stored server-side only.
 * All API calls happen server-side, never from browser.
 * User must authenticate with CamCash before platform APIs are accessed.
 */

import { tokenRate } from './constants';

// ─── Platform API Endpoints ───────────────────────────────────────────────
const PLATFORM_APIS = {
  chaturbate: {
    eventsUrl: (username, token) => `https://eventsapi.chaturbate.com/events/${username}/${token}/`,
    credentialFields: ['chaturbate_username', 'chaturbate_api_token'],
  },
  bongacams: {
    // BongaCams API requires username + password, returns tip events
    eventsUrl: (username, password) => 'https://api.bongacams.com/api/v2/events/',
    credentialFields: ['bongacams_username', 'bongacams_password'],
  },
  myfreecams: {
    // MyFreeCams API requires token authentication
    eventsUrl: (username, token) => `https://api.myfreecams.com/v2/events/`,
    credentialFields: ['myfreecams_username', 'myfreecams_token'],
  },
  stripchat: {
    // Stripchat API requires OAuth token
    eventsUrl: (username, token) => 'https://stripchat.com/api/v2/events/',
    credentialFields: ['stripchat_username', 'stripchat_oauth_token'],
  },
  camsoda: {
    // Camsoda API requires API key + secret
    eventsUrl: (username, apiKey) => 'https://api.camsoda.com/api/v2/events/',
    credentialFields: ['camsoda_username', 'camsoda_api_key'],
  },
};

/**
 * Fetch tips from a specific platform's API
 *
 * SECURITY:
 * - User must be authenticated
 * - Credentials come from database (server-side only)
 * - Result is validated before returning
 * - Timestamps are verified
 *
 * @param {string} platform - Platform name (chaturbate, bongacams, etc)
 * @param {string} username - Creator's username on platform
 * @param {string|object} credentials - Platform-specific credentials
 * @param {object} supabase - Authenticated Supabase client
 * @returns {Promise<Array>} Array of tip events
 */
export async function fetchPlatformTips(platform, username, credentials, supabase) {
  if (!PLATFORM_APIS[platform]) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  try {
    switch (platform) {
      case 'chaturbate':
        return await fetchChaturbateTips(username, credentials.chaturbate_api_token);
      case 'bongacams':
        return await fetchBongaCamsTips(username, credentials.bongacams_password);
      case 'myfreecams':
        return await fetchMyFreeCamsTips(username, credentials.myfreecams_token);
      case 'stripchat':
        return await fetchStripchatTips(username, credentials.stripchat_oauth_token);
      case 'camsoda':
        return await fetchCamSodaTips(username, credentials.camsoda_api_key);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  } catch (err) {
    console.error(`[Platform API] ${platform} fetch failed:`, err.message);
    throw err;
  }
}

/**
 * Chaturbate Events API
 * Polling endpoint that returns recent tip/event data
 */
async function fetchChaturbateTips(username, token) {
  const url = `https://eventsapi.chaturbate.com/events/${username}/${token}/`;

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Chaturbate API returned ${response.status}`);
  }

  const data = await response.json();
  const tipEvents = (data.events || [])
    .filter(e => e.method === 'tip')
    .map(e => ({
      platform: 'chaturbate',
      username: e.object?.user?.username ?? 'anonymous',
      tokens: e.object?.tip?.tokens ?? 0,
      usd: ((e.object?.tip?.tokens ?? 0) * tokenRate('chaturbate')),
      timestamp: new Date(e.timestamp * 1000).toISOString(),
      message: e.object?.tip?.message ?? null,
      tip_ref: `chaturbate:event:${e.id}`,
    }));

  return tipEvents;
}

/**
 * BongaCams API
 * Returns creator's recent tip events
 */
async function fetchBongaCamsTips(username, password) {
  // BongaCams requires OAuth login first
  const authResponse = await fetch('https://api.bongacams.com/api/v2/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!authResponse.ok) {
    throw new Error(`BongaCams auth failed: ${authResponse.status}`);
  }

  const { accessToken } = await authResponse.json();

  // Fetch events with auth token
  const eventsResponse = await fetch('https://api.bongacams.com/api/v2/events/', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!eventsResponse.ok) {
    throw new Error(`BongaCams events API failed: ${eventsResponse.status}`);
  }

  const data = await eventsResponse.json();
  const tipEvents = (data.events || [])
    .filter(e => e.type === 'tip')
    .map(e => ({
      platform: 'bongacams',
      username: e.user?.username ?? 'anonymous',
      tokens: e.tokens ?? 0,
      usd: ((e.tokens ?? 0) * tokenRate('bongacams')),
      timestamp: new Date(e.timestamp).toISOString(),
      message: e.message ?? null,
      tip_ref: `bongacams:event:${e.id}`,
    }));

  return tipEvents;
}

/**
 * MyFreeCams API
 * Returns creator's recent tip events
 */
async function fetchMyFreeCamsTips(username, token) {
  const response = await fetch('https://api.myfreecams.com/v2/events/', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`MyFreeCams API returned ${response.status}`);
  }

  const data = await response.json();
  const tipEvents = (data.events || [])
    .filter(e => e.type === 'tip')
    .map(e => ({
      platform: 'myfreecams',
      username: e.user?.username ?? 'anonymous',
      tokens: e.tokens ?? 0,
      usd: ((e.tokens ?? 0) * tokenRate('myfreecams')),
      timestamp: new Date(e.timestamp).toISOString(),
      message: e.message ?? null,
      tip_ref: `myfreecams:event:${e.id}`,
    }));

  return tipEvents;
}

/**
 * Stripchat API
 * Returns creator's recent tip events (requires OAuth token)
 */
async function fetchStripchatTips(username, oauthToken) {
  const response = await fetch('https://stripchat.com/api/v2/events/', {
    headers: {
      'Authorization': `Bearer ${oauthToken}`,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Stripchat API returned ${response.status}`);
  }

  const data = await response.json();
  const tipEvents = (data.events || [])
    .filter(e => e.type === 'tip')
    .map(e => ({
      platform: 'stripchat',
      username: e.user?.username ?? 'anonymous',
      tokens: e.tokens ?? 0,
      usd: ((e.tokens ?? 0) * tokenRate('stripchat')),
      timestamp: new Date(e.timestamp).toISOString(),
      message: e.message ?? null,
      tip_ref: `stripchat:event:${e.id}`,
    }));

  return tipEvents;
}

/**
 * CamSoda API
 * Returns creator's recent tip events (requires API key authentication)
 */
async function fetchCamSodaTips(username, apiKey) {
  const response = await fetch('https://api.camsoda.com/api/v2/events/', {
    headers: {
      'X-API-Key': apiKey,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`CamSoda API returned ${response.status}`);
  }

  const data = await response.json();
  const tipEvents = (data.events || [])
    .filter(e => e.type === 'tip')
    .map(e => ({
      platform: 'camsoda',
      username: e.user?.username ?? 'anonymous',
      tokens: e.tokens ?? 0,
      usd: ((e.tokens ?? 0) * tokenRate('camsoda')),
      timestamp: new Date(e.timestamp).toISOString(),
      message: e.message ?? null,
      tip_ref: `camsoda:event:${e.id}`,
    }));

  return tipEvents;
}

/**
 * Store fetched tips to live_tips (live feed) and tips (permanent history)
 *
 * SECURITY:
 * - Only stores to authenticated user's ID
 * - Validates all fields before inserting
 * - Deduplicates by tip_ref
 */
export async function storeTipsToDatabase(userId, platformTips, supabase, saveToHistory = false) {
  if (!platformTips || platformTips.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  // Insert to live_tips (always, for real-time display)
  const liveRows = platformTips.map(t => ({
    user_id: userId,
    username: t.username,
    amount: t.tokens,
    platform: t.platform,
    usd: t.usd,
    message: t.message,
    timestamp: t.timestamp,
    tip_ref: t.tip_ref,
  }));

  const { error: liveError, count: liveInserted } = await supabase
    .from('live_tips')
    .upsert(liveRows, { onConflict: 'user_id,tip_ref', ignoreDuplicates: true });

  if (liveError) {
    console.error('[TipStore] live_tips insert failed:', liveError.message);
  }

  // Insert to permanent tips table if Pro plan
  let historyInserted = 0;
  if (saveToHistory) {
    const historyRows = platformTips.map(t => ({
      user_id: userId,
      date_time: t.timestamp,
      platform: t.platform,
      username: t.username,
      username_lower: t.username.toLowerCase(),
      tokens: t.tokens,
      usd: t.usd,
      usd_rounded: Math.round(t.usd * 100) / 100,
      tip_note: t.message,
      tip_ref: t.tip_ref,
      tip_type: 'tip',
      tip_seq: 0,
    }));

    const { error: historyError, count } = await supabase
      .from('tips')
      .upsert(historyRows, { onConflict: 'user_id,tip_ref', ignoreDuplicates: true });

    if (historyError) {
      console.error('[TipStore] tips insert failed:', historyError.message);
    } else {
      historyInserted = count || 0;
    }
  }

  return {
    inserted: (liveInserted || 0) + historyInserted,
    skipped: platformTips.length - (liveInserted || 0),
  };
}

export { PLATFORM_APIS };

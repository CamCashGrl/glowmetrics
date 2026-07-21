// CamCash background service worker

const SUPABASE_URL  = 'https://hlsdlaibnayzbfflxclj.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc2RsYWlibmF5emJmZmx4Y2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjQwODUsImV4cCI6MjA4OTIwMDA4NX0.5FwPe35UL-o46FvBJX526La5o7jcbFaP1KVoLtI4U_M';
const API_BASE       = 'https://www.camcashgrl.com';

// Token→USD rates for the popup's local display only — the server (see
// app/api/live/tips/route.js) is the source of truth for what actually gets
// stored. Mirrors glowmetrics_fresh/lib/constants.js PLATFORM_TOKEN_RATES;
// this extension has no build step to import that file directly, so keep
// these two tables in sync by hand if a rate ever changes.
const TOKEN_RATES = { chaturbate: 0.05, bongacams: 0.025, myfreecams: 0.05, stripchat: 0.05, camsoda: 0.05 };

// ─── State ────────────────────────────────────────────────────────────────────
let session = null;
let whales = [];
let coachMsgs = [];
let lastTipTs = null;
let sessionTips = [];
let sessionTokens = 0;
let sessionUsd = 0;
let topTipper = null;
let plan = 'free'; // 'free' | 'pro' | 'unlimited' — controls whether tips save to permanent history

// restorePromise resolves once the initial restore() call completes.
// Tip sync always awaits this before trying to use session.
let restorePromise = null;

// ─── Live session state (official live_sessions row) ──────────────────────
// Distinct from `session` above (the auth session). `liveSession` mirrors
// whatever GET /api/live/session last returned — the extension never keeps
// its own independent timer/session record, per design.
let liveSession = null;
// Set true only while a content script has confirmed it's actively observing
// a supported broadcaster page (the same signal already used for the
// 'connected' message); cleared when that tab closes or navigates away.
// This is the best available "is this really the broadcast page" signal
// without inventing new detection rules on top of what content.js already does.
let broadcasterPageActive = false;
let broadcasterTabId = null;
let broadcasterPlatform = null;

// Coaching cooldowns — prevents the same signal repeating within its window.
const coachCooldowns = {};
function canCoach(key, cooldownMs) {
  const last = coachCooldowns[key];
  if (!last || Date.now() - last > cooldownMs) {
    coachCooldowns[key] = Date.now();
    return true;
  }
  return false;
}

// ─── Persistence ─────────────────────────────────────────────────────────────
async function save() {
  await chrome.storage.local.set({ _bg_whales: whales, _bg_coachMsgs: coachMsgs });
}

async function restore() {
  const data = await chrome.storage.local.get(['session', 'user', '_bg_whales', '_bg_coachMsgs']);
  whales    = data._bg_whales    || [];
  coachMsgs = data._bg_coachMsgs || [];
  if (data.session && data.user) {
    const token = typeof data.session === 'string' ? data.session : data.session?.access_token;
    if (token) session = { access_token: token, user: data.user };
  }
}

// ─── Supabase helpers (direct REST — no server hop, no CORS issues) ───────────
function sbHeaders(token) {
  return {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_ANON,
    'Authorization': `Bearer ${token || SUPABASE_ANON}`,
    'Prefer':        'return=minimal',
  };
}

// ─── Usage/install tracking ─────────────────────────────────────────────────
// Writes straight to analytics_events, the same table app/api/track/route.js
// (the website's tracker) writes to — one place for signup/import/extension
// events. Before login this inserts with user_id: null (allowed by the
// table's "user_id IS NULL" RLS policy); once signed in it's sent with the
// caller's own access_token so auth.uid() = user_id and RLS accepts it.
function logExtensionEvent(eventName, properties) {
  const token = session ? session.access_token : null;
  fetch(`${SUPABASE_URL}/rest/v1/analytics_events`, {
    method: 'POST',
    headers: sbHeaders(token),
    body: JSON.stringify({
      user_id: session ? session.user.id : null,
      event_name: eventName,
      properties: { ...properties, extension_version: chrome.runtime.getManifest().version },
    }),
  }).catch(() => {});
}

// Fires at most once per calendar day per install — proof the extension is
// actually being opened/used by a signed-in account, not just sitting
// installed. Boot and AUTH_CHANGED are the only two places a valid `session`
// can newly become available, so those are the only call sites.
async function pingExtensionActive() {
  if (!session) return;
  const today = new Date().toISOString().slice(0, 10);
  const stored = await chrome.storage.local.get(['_last_active_ping']);
  if (stored._last_active_ping === today) return;
  await chrome.storage.local.set({ _last_active_ping: today });
  logExtensionEvent('extension_active', {});
}

// Fires once per real install/update — chrome.runtime.onInstalled guarantees
// this, unlike a page-load-based signal. Happens before any login, so this
// is always the anonymous (user_id: null) path.
chrome.runtime.onInstalled.addListener((details) => {
  logExtensionEvent(details.reason === 'update' ? 'extension_updated' : 'extension_installed', {
    reason: details.reason,
    previousVersion: details.previousVersion || null,
  });
});

// ─── Token refresh — called automatically when a 401 is returned ──────────────
async function refreshSession() {
  try {
    const data = await chrome.storage.local.get(['refresh_token']);
    if (!data.refresh_token) return false;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ refresh_token: data.refresh_token }),
    });
    if (!res.ok) return false;
    const tokenData = await res.json();
    if (!tokenData.access_token) return false;
    await chrome.storage.local.set({
      session: tokenData.access_token,
      refresh_token: tokenData.refresh_token || data.refresh_token,
    });
    if (session) session.access_token = tokenData.access_token;
    console.log('[CamCash] token refreshed');
    return true;
  } catch (e) {
    console.error('[CamCash] token refresh failed:', e.message);
    return false;
  }
}

// ─── Live session engine (official live_sessions row) ──────────────────────
// All calls go through /api/live/session/*, the same routes and RPCs the
// website uses — no separate/duplicate session logic here. A 401 triggers
// one refresh-and-retry, same pattern as syncTip below.
async function liveSessionCall(path, method, body) {
  await restorePromise;
  if (!session) return null;

  const doFetch = () => fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  try {
    let res = await doFetch();
    if (res.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) res = await doFetch();
    }
    if (!res.ok) {
      console.error('[CamCash] live session call failed:', path, res.status);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('[CamCash] live session call error:', path, e.message);
    return null;
  }
}

async function restoreLiveSession() {
  const data = await liveSessionCall('/api/live/session', 'GET');
  liveSession = data?.session || null;
  broadcast({ action: 'state', state: getState() });
}

async function startLiveSession(platform) {
  const data = await liveSessionCall('/api/live/session/start', 'POST');
  if (data?.session) liveSession = data.session;
  broadcast({ action: 'state', state: getState() });
  return data;
}

async function pauseLiveSession() {
  const data = await liveSessionCall('/api/live/session/pause', 'POST');
  if (data?.session) liveSession = data.session;
  broadcast({ action: 'state', state: getState() });
  return data;
}

async function resumeLiveSession() {
  const data = await liveSessionCall('/api/live/session/resume', 'POST');
  if (data?.session) liveSession = data.session;
  broadcast({ action: 'state', state: getState() });
  return data;
}

async function stopLiveSession() {
  const data = await liveSessionCall('/api/live/session/stop', 'POST');
  // A stopped session is 'ended', not null — but there is nothing further
  // to act on, so this extension should stop tracking it as "the current
  // session" the same as if there were none at all (matches the popup no
  // longer treating a non-active/paused status as still-live).
  liveSession = null;
  broadcast({ action: 'state', state: getState() });
  return data;
}

async function resolveLiveSession(choice) {
  const data = await liveSessionCall('/api/live/session/resolve', 'POST', { choice });
  liveSession = data?.session || null;
  broadcast({ action: 'state', state: getState() });
  return data;
}

// Sent periodically (see the 'live_heartbeat' alarm below) while a session
// is unresolved. Proves the extension is on a confirmed broadcaster page —
// never sent as "detected" unless broadcasterPageActive is genuinely true.
async function sendExtensionHeartbeat() {
  if (!liveSession) return;
  const data = await liveSessionCall(
    '/api/live/session/extension-heartbeat', 'POST',
    { platform: broadcasterPlatform, broadcasterPageDetected: broadcasterPageActive }
  );
  // A null session here means the server no longer considers there to be
  // an unresolved session for this account (ended, or auto-resolved) —
  // stop tracking it so this heartbeat correctly stops firing on its own,
  // instead of retrying forever against a session that's already done.
  liveSession = data?.session || null;
}

// ─── Tip sync ──────────────────────────────────────────────────────────────────
// Always saved to the live feed (free, on every supported platform). Permanent
// history — the data behind the dashboard's historical analytics — is a Pro
// feature, so the plan check happens server-side in this route rather than
// here; the extension can't be trusted to gate its own writes.
async function syncTip({ username, tokens, platform, timestamp }) {
  await restorePromise;
  if (!session) return;

  const body = JSON.stringify({
    username,
    amount:    parseInt(tokens, 10),
    platform:  platform ? platform.toLowerCase() : 'extension',
    timestamp: timestamp || new Date().toISOString(),
  });

  const doPost = () => fetch(`${API_BASE}/api/live/tips`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body,
  });

  try {
    let res = await doPost();
    // If token expired, refresh once and retry
    if (res.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) res = await doPost();
    }
    if (!res.ok) {
      const err = await res.text();
      console.error('[CamCash] tip sync failed:', res.status, err);
      return { savedToHistory: false };
    }
    const data = await res.json();
    return { savedToHistory: !!data.savedToHistory };
  } catch (e) {
    console.error('[CamCash] sync failed:', e.message);
    return { savedToHistory: false };
  }
}

// ─── Plan loading — determines whether tips save to permanent history ────────
async function loadPlan() {
  await restorePromise;
  if (!session) { plan = 'free'; return; }
  try {
    const doFetch = () => fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=plan&id=eq.${session.user.id}`,
      { headers: sbHeaders(session.access_token) }
    );
    let res = await doFetch();
    if (res.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) res = await doFetch();
    }
    if (!res.ok) return;
    const rows = await res.json();
    plan = rows?.[0]?.plan || 'free';
  } catch (_) {}
}

// ─── Whale loading — reads historical tips directly from Supabase ─────────────
async function loadWhales() {
  await restorePromise;
  if (!session) return;
  try {
    const doFetch = () => fetch(
      `${SUPABASE_URL}/rest/v1/tips?select=username,tokens&user_id=eq.${session.user.id}&order=date_time.desc&limit=200`,
      { headers: sbHeaders(session.access_token) }
    );
    let res = await doFetch();
    if (res.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) res = await doFetch();
    }
    if (!res.ok) return;
    const tips = await res.json();

    const totals = {};
    for (const t of tips || []) {
      if (!t.username) continue;
      totals[t.username] = (totals[t.username] || 0) + (t.tokens || 0);
    }
    whales = Object.entries(totals)
      .filter(([, tok]) => tok >= 100)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50)
      .map(([username, tokens]) => ({ username, tokens }));
    await save();
  } catch (_) {}
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function logout() {
  session = null;
  whales = [];
  coachMsgs = [];
  sessionTips = [];
  sessionTokens = 0;
  sessionUsd = 0;
  topTipper = null;
  lastTipTs = null;
  liveSession = null;
  broadcasterPageActive = false;
  broadcasterTabId = null;
  await chrome.storage.local.clear();
  chrome.alarms.clearAll();
}

// ─── Coaching ─────────────────────────────────────────────────────────────────
const COACH = {
  dead_air: [
    "💡 It's quiet — try a countdown goal to spark tips",
    "💡 Ask viewers: 'Who wants to see __?' Drive interaction!",
    "💡 Shoutout your last 3 tippers to re-engage the room",
    "💡 Set a 5-min goal — urgency drives tips",
    "💡 Try a quick poll: '50 tokens or 100?' — gets people talking",
  ],
  streak: [
    "🔥 Room is hot! Set a bigger goal while momentum is high",
    "🔥 Tip streak! Tease your next milestone to keep it going",
    "🔥 Great energy — call out your top tipper by name!",
  ],
  whale: [
    "🐋 Whale just entered — acknowledge them personally right now",
    "🐋 Big tipper in the room! Make them feel like a VIP",
    "🐋 Give your whale a personal shoutout — it keeps them coming back",
  ],
  quiet: [
    "💬 Engage the lurkers — ask a fun question",
    "💬 Try: 'Next tip gets a personal shoutout on screen!'",
    "💬 Drop a limited-time offer in chat to wake the room up",
  ],
};

function addCoach(type) {
  const pool = COACH[type] || COACH.dead_air;
  const text = pool[Math.floor(Math.random() * pool.length)];
  coachMsgs.unshift({ text, type, ts: Date.now() });
  if (coachMsgs.length > 8) coachMsgs.length = 8;
  save();
  broadcast({ action: 'state', state: getState() });
  broadcastOverlay();
}

// ─── Alarms ───────────────────────────────────────────────────────────────────
function scheduleAlarms() {
  chrome.alarms.create('dead_air',      { periodInMinutes: 5 });
  chrome.alarms.create('whale_refresh', { periodInMinutes: 10 });
  // chrome.alarms has a 1-minute minimum period — coarser than the website's
  // 20s heartbeat, but that's fine: the grace period for missed-heartbeat
  // detection is designed around minutes, not seconds.
  chrome.alarms.create('live_heartbeat', { periodInMinutes: 1 });
}

// If the tab we were treating as the active broadcaster page closes, the
// extension must stop claiming the page is detected — never keep reporting
// a stale "true" once the tab is gone.
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === broadcasterTabId) {
    broadcasterTabId = null;
    broadcasterPageActive = false;
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dead_air' && session) {
    const sinceLastTip = lastTipTs ? Date.now() - lastTipTs : Infinity;
    if (sinceLastTip > 5 * 60 * 1000) {
      const type = sessionTips.length > 0 ? 'quiet' : 'dead_air';
      if (canCoach(`alarm_${type}`, 2 * 60 * 1000)) addCoach(type);
    }
  }
  if (alarm.name === 'whale_refresh') { await loadWhales(); await loadPlan(); }
  if (alarm.name === 'live_heartbeat' && session && liveSession) await sendExtensionHeartbeat();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getState() {
  return {
    authed: !!session, user: session?.user || null,
    tips: sessionTips.slice(0, 20), tokens: sessionTokens,
    usd: sessionUsd, topTipper, coaches: coachMsgs,
    whales: whales.slice(0, 10), connected: true,
    plan, isPro: plan === 'pro' || plan === 'unlimited',
    liveSession, broadcasterPageActive,
  };
}

function broadcast(msg) { chrome.runtime.sendMessage(msg).catch(() => {}); }

// Send overlay state to all active cam-site tabs
async function broadcastOverlay() {
  const overlayMsg = { action: 'overlay_state', state: getState() };
  try {
    const tabs = await chrome.tabs.query({ url: [
      'https://chaturbate.com/*',
      'https://*.chaturbate.com/*',
      'https://bongacams.com/*',
      'https://*.bongacams.com/*',
      'https://myfreecams.com/*',
      'https://*.myfreecams.com/*',
    ]});
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, overlayMsg).catch(() => {});
    }
  } catch (_) {}
}

function isWhale(u) { return whales.some(w => w.username.toLowerCase() === u.toLowerCase()); }
function getWhale(u) { return whales.find(w => w.username.toLowerCase() === u.toLowerCase()); }

// ─── Token history scan ─────────────────────────────────────────────────────
// Triggered by the "Scan Token History" button in the overlay/popup.
// Flow: ask the content script to read the on-page table → send the parsed
// rows to /api/scan/preview for server-side validation/normalization →
// return the preview payload to whoever asked (popup or overlay) for the
// user to review. Nothing gets written to `tips` from this function —
// import only happens after explicit user confirmation via a separate
// 'confirm_token_scan' action, which calls /api/scan/import.
async function scanTokenHistory() {
  await restorePromise;
  if (!session) return { ok: false, error: 'Not signed in.' };

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { ok: false, error: 'No active tab found.' };

  let scanResult;
  try {
    scanResult = await chrome.tabs.sendMessage(tab.id, { action: 'run_token_scan' });
  } catch (e) {
    return { ok: false, error: 'Could not reach the page. Make sure you\'re on your Chaturbate token history page.' };
  }
  if (!scanResult?.ok) return scanResult || { ok: false, error: 'Scan failed.' };

  try {
    const res = await fetch(`${API_BASE}/api/scan/preview`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ platform: 'chaturbate', rows: scanResult.rows }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `Server rejected the scan: ${err}` };
    }
    const preview = await res.json();
    return { ok: true, preview };
  } catch (e) {
    return { ok: false, error: 'Could not reach CamCash to validate the scan.' };
  }
}

// Takes the exact "inbound" rows the user already saw and approved in the
// preview modal — nothing is re-fetched from the page at confirm time, so
// what the user reviewed is exactly what gets sent for import.
async function confirmTokenImport(rows) {
  await restorePromise;
  if (!session) return { ok: false, error: 'Not signed in.' };
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: 'Nothing to import.' };
  try {
    const res = await fetch(`${API_BASE}/api/scan/import`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `Import failed: ${err}` };
    }
    const result = await res.json();
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: 'Could not reach CamCash to complete the import.' };
  }
}

// ─── Message router ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {

  if (msg.action === 'get_state') { reply(getState()); return false; }

  if (msg.action === 'scan_token_history') {
    scanTokenHistory().then(reply);
    return true;
  }

  if (msg.action === 'confirm_token_import') {
    confirmTokenImport(msg.rows).then(reply);
    return true;
  }

  if (msg.action === 'logout') {
    logout().then(() => reply({ ok: true }));
    return true;
  }

  if (msg.action === 'tip') {
    const { username, tokens, platform } = msg;
    lastTipTs = Date.now();
    const usd = parseFloat((tokens * (TOKEN_RATES[platform] || 0.05)).toFixed(2));
    const tip = { username, tokens, usd, platform, ts: lastTipTs };

    sessionTips.unshift(tip);
    if (sessionTips.length > 100) sessionTips.length = 100;
    sessionTokens += tokens;
    sessionUsd    += usd;
    if (!topTipper || tokens > topTipper.tokens) topTipper = tip;

    const storageKey = `tip_${lastTipTs}`;
    const tipRecord  = { username, amount: tokens, platform, timestamp: new Date(lastTipTs).toISOString(), synced: false, savedToHistory: false };
    chrome.storage.local.set({ [storageKey]: tipRecord });

    chrome.storage.local.get(null, (items) => {
      const keys = Object.keys(items).filter(k => k.startsWith('tip_')).sort().reverse();
      if (keys.length > 100) chrome.storage.local.remove(keys.slice(100));
    });

    syncTip({ username, tokens, platform, timestamp: new Date(lastTipTs).toISOString() }).then((result) => {
      chrome.storage.local.set({ [storageKey]: { ...tipRecord, synced: true, savedToHistory: !!result?.savedToHistory } });
    });

    // Coaching with cooldowns — prevents spam
    const recentCount = sessionTips.filter(t => lastTipTs - t.ts < 60000).length;
    if (recentCount >= 3 && canCoach('streak', 3 * 60 * 1000)) addCoach('streak');
    if (isWhale(username) && canCoach(`whale_tip_${username}`, 5 * 60 * 1000)) addCoach('whale');

    broadcast({ action: 'state', state: getState() });
    broadcastOverlay();
    return false;
  }

  if (msg.action === 'entered') {
    const { username } = msg;
    if (isWhale(username)) {
      const w = getWhale(username);
      if (canCoach(`whale_enter_${username}`, 5 * 60 * 1000)) addCoach('whale');
      chrome.notifications.create(`whale_${username}_${Date.now()}`, {
        type: 'basic',
        iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        title: '🐋 Whale Alert!',
        message: `${username} just entered (${w.tokens.toLocaleString()} tokens historically)`,
        priority: 2,
      });
      broadcast({ action: 'whale_alert', username, tokens: w.tokens });
      broadcastOverlay();
    }
    return false;
  }

  if (msg.action === 'connected') {
    // A content script confirmed it successfully attached to a supported
    // broadcaster page's chat — the same real signal already used for the
    // overlay, now also feeding the extension heartbeat's page-detected flag.
    if (_sender.tab?.id) {
      broadcasterTabId = _sender.tab.id;
      broadcasterPageActive = true;
      broadcasterPlatform = msg.platform || broadcasterPlatform;
    }
    broadcast({ action: 'state', state: getState() });
    broadcastOverlay();
    return false;
  }

  if (msg.action === 'live_start') {
    startLiveSession(msg.platform).then(reply);
    return true;
  }
  if (msg.action === 'live_pause') {
    pauseLiveSession().then(reply);
    return true;
  }
  if (msg.action === 'live_resume') {
    resumeLiveSession().then(reply);
    return true;
  }
  if (msg.action === 'live_stop') {
    stopLiveSession().then(reply);
    return true;
  }
  if (msg.action === 'live_resolve') {
    resolveLiveSession(msg.choice).then(reply);
    return true;
  }
  if (msg.action === 'live_get_state') {
    reply({ liveSession, broadcasterPageActive });
    return false;
  }

  if (msg.type === 'AUTH_CHANGED') {
    restorePromise = restore().then(() => {
      if (session) { loadWhales(); loadPlan(); restoreLiveSession(); scheduleAlarms(); pingExtensionActive(); }
      else { plan = 'free'; liveSession = null; chrome.alarms.clearAll(); }
    });
    return false;
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
restorePromise = restore().then(() => {
  if (session) { loadWhales(); loadPlan(); restoreLiveSession(); scheduleAlarms(); pingExtensionActive(); }
});

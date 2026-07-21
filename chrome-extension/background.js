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
let lastTipTs = null;
let sessionTips = [];
let sessionTokens = 0;
let sessionUsd = 0;
let topTipper = null;
let plan = 'free'; // 'free' | 'pro' | 'unlimited' — controls whether tips save to permanent history

// The single canonical coaching prompt, fetched from the shared
// server-persisted engine (GET /api/live/coaching) — this extension never
// computes its own coaching triggers anymore. null when nothing is
// currently active. Mirrors app/live/page.js's coachingPrompt state.
let coachingPrompt = null;

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

// ─── Persistence ─────────────────────────────────────────────────────────────
async function save() {
  await chrome.storage.local.set({ _bg_whales: whales });
}

async function restore() {
  const data = await chrome.storage.local.get(['session', 'user', '_bg_whales']);
  whales = data._bg_whales || [];
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
  if (liveSession) await fetchCoachingPrompt();
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
  coachingPrompt = null;
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
// No local trigger logic here anymore — every coaching prompt is evaluated
// server-side (lib/coaching/triggers.js in the website repo) and fetched
// through the same GET /api/live/coaching endpoint the website polls, so
// this extension always shows the exact same canonical prompt, never one
// it computed independently. reuses liveSessionCall(), the same
// auth+refresh+error handling every other /api/live/* call here already
// goes through.
async function fetchCoachingPrompt() {
  if (!liveSession) { coachingPrompt = null; return; }
  const data = await liveSessionCall('/api/live/coaching', 'GET');
  coachingPrompt = data?.prompt || null;
  broadcast({ action: 'state', state: getState() });
  broadcastOverlay();
}

// Shared by popup and the on-page overlay against the same coaching_events
// row — whichever surface the user responds on updates the one canonical
// record; the other surface converges on its next fetchCoachingPrompt().
async function respondToCoachingPrompt(eventId, status) {
  const data = await liveSessionCall('/api/live/coaching/respond', 'POST', { eventId, status });
  if (data?.event?.action_status && data.event.action_status !== 'unmarked' && coachingPrompt?.id === eventId) {
    coachingPrompt = null;
  }
  broadcast({ action: 'state', state: getState() });
  broadcastOverlay();
  return data;
}

// ─── Alarms ───────────────────────────────────────────────────────────────────
function scheduleAlarms() {
  // whale_refresh keeps loading the historical top-tippers list even though
  // nothing currently triggers off it — kept for the deferred room-entry
  // whale-notification restoration (see the 'entered' handler below), so
  // that data is already warm whenever that phase gets built.
  chrome.alarms.create('whale_refresh', { periodInMinutes: 10 });
  // chrome.alarms has a 1-minute minimum period — coarser than the website's
  // 15s coaching poll, but that's fine for time-based triggers (dead air,
  // stream fatigue), which are themselves measured in minutes. The
  // coaching prompt fetch below piggybacks on this same alarm rather than
  // its own — one fewer moving part, and it's already the natural "is
  // there anything new" pulse for an unresolved session.
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
  if (alarm.name === 'whale_refresh') { await loadWhales(); await loadPlan(); }
  if (alarm.name === 'live_heartbeat' && session && liveSession) {
    await sendExtensionHeartbeat();
    await fetchCoachingPrompt();
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getState() {
  return {
    authed: !!session, user: session?.user || null,
    tips: sessionTips.slice(0, 20), tokens: sessionTokens,
    usd: sessionUsd, topTipper, coachingPrompt,
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

    broadcast({ action: 'state', state: getState() });
    broadcastOverlay();
    return false;
  }

  if (msg.action === 'entered') {
    // FOLLOW-UP (deferred, not this phase): this used to independently fire
    // a native "🐋 Whale Alert!" OS notification + a popup banner whenever
    // a historically-known big spender entered the room — a genuinely
    // different signal from whale_prox/whale_dep (which are both
    // tip-based, current-session triggers from the shared coaching
    // engine). Restoring a native notification for room-entry requires
    // persisting 'entered' events server-side first (they're currently
    // extension-local only) and adding that as a real 10th trigger —
    // deliberately out of scope this phase. isWhale()/loadWhales() are
    // left in place so that data is ready whenever this gets built.
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
  if (msg.action === 'coaching_respond') {
    respondToCoachingPrompt(msg.eventId, msg.status).then(reply);
    return true;
  }

  if (msg.type === 'AUTH_CHANGED') {
    restorePromise = restore().then(() => {
      if (session) { loadWhales(); loadPlan(); restoreLiveSession(); scheduleAlarms(); }
      else { plan = 'free'; liveSession = null; chrome.alarms.clearAll(); }
    });
    return false;
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
restorePromise = restore().then(() => {
  if (session) { loadWhales(); loadPlan(); restoreLiveSession(); scheduleAlarms(); }
});

// CamCash background service worker

const SUPABASE_URL  = 'https://hlsdlaibnayzbfflxclj.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc2RsYWlibmF5emJmZmx4Y2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjQwODUsImV4cCI6MjA4OTIwMDA4NX0.5FwPe35UL-o46FvBJX526La5o7jcbFaP1KVoLtI4U_M';

// ─── State ────────────────────────────────────────────────────────────────────
let session = null;
let whales = [];
let coachMsgs = [];
let lastTipTs = null;
let sessionTips = [];
let sessionTokens = 0;
let sessionUsd = 0;
let topTipper = null;

// restorePromise resolves once the initial restore() call completes.
// Tip sync always awaits this before trying to use session.
let restorePromise = null;

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

// ─── Tip sync — writes directly to Supabase live_tips table ──────────────────
async function syncTip({ username, tokens, platform, timestamp }) {
  await restorePromise;
  if (!session) return;
  const usd = parseFloat((tokens * 0.05).toFixed(2));
  const body = JSON.stringify({
    user_id:     session.user.id,
    username:    username.trim(),
    tokens:      parseInt(tokens, 10),
    usd,
    source:      platform ? platform.toLowerCase() : 'extension',
    received_at: timestamp || new Date().toISOString(),
  });

  const doInsert = () => fetch(`${SUPABASE_URL}/rest/v1/live_tips`, {
    method: 'POST',
    headers: sbHeaders(session.access_token),
    body,
  });

  try {
    let res = await doInsert();
    // If token expired, refresh once and retry
    if (res.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) res = await doInsert();
    }
    if (!res.ok) {
      const err = await res.text();
      console.error('[CamCash] live_tips insert failed:', res.status, err);
    }
  } catch (e) {
    console.error('[CamCash] sync failed:', e.message);
  }
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
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dead_air' && session) {
    const sinceLastTip = lastTipTs ? Date.now() - lastTipTs : Infinity;
    if (sinceLastTip > 5 * 60 * 1000) {
      const type = sessionTips.length > 0 ? 'quiet' : 'dead_air';
      if (canCoach(`alarm_${type}`, 2 * 60 * 1000)) addCoach(type);
    }
  }
  if (alarm.name === 'whale_refresh') await loadWhales();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getState() {
  return {
    authed: !!session, user: session?.user || null,
    tips: sessionTips.slice(0, 20), tokens: sessionTokens,
    usd: sessionUsd, topTipper, coaches: coachMsgs,
    whales: whales.slice(0, 10), connected: true,
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

// ─── Message router ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {

  if (msg.action === 'get_state') { reply(getState()); return false; }

  if (msg.action === 'logout') {
    logout().then(() => reply({ ok: true }));
    return true;
  }

  if (msg.action === 'tip') {
    const { username, tokens, platform } = msg;
    lastTipTs = Date.now();
    const usd = parseFloat((tokens * 0.05).toFixed(2));
    const tip = { username, tokens, usd, platform, ts: lastTipTs };

    sessionTips.unshift(tip);
    if (sessionTips.length > 100) sessionTips.length = 100;
    sessionTokens += tokens;
    sessionUsd    += usd;
    if (!topTipper || tokens > topTipper.tokens) topTipper = tip;

    const storageKey = `tip_${lastTipTs}`;
    const tipRecord  = { username, amount: tokens, platform, timestamp: new Date(lastTipTs).toISOString(), synced: false };
    chrome.storage.local.set({ [storageKey]: tipRecord });

    chrome.storage.local.get(null, (items) => {
      const keys = Object.keys(items).filter(k => k.startsWith('tip_')).sort().reverse();
      if (keys.length > 100) chrome.storage.local.remove(keys.slice(100));
    });

    syncTip({ username, tokens, platform, timestamp: new Date(lastTipTs).toISOString() }).then(() => {
      chrome.storage.local.set({ [storageKey]: { ...tipRecord, synced: true } });
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
    broadcast({ action: 'state', state: getState() });
    broadcastOverlay();
    return false;
  }

  if (msg.type === 'AUTH_CHANGED') {
    restorePromise = restore().then(() => {
      if (session) { loadWhales(); scheduleAlarms(); }
      else { chrome.alarms.clearAll(); }
    });
    return false;
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
restorePromise = restore().then(() => {
  if (session) { loadWhales(); scheduleAlarms(); }
});

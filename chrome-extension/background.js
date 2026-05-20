// CamCash background service worker

const API = 'https://www.camcashgrl.com';

// ─── State ────────────────────────────────────────────────────────────────────
let session = null;      // { access_token, user: { id, email, username } }
let whales = [];         // [{ username, tokens }] - loaded from historical tips
let coachMsgs = [];      // [{ text, type, ts }]
let lastTipTs = null;
let sessionTips = [];    // tips seen this session
let sessionTokens = 0;
let sessionUsd = 0;
let topTipper = null;

// Coaching cooldowns — prevents the same signal repeating within its window.
// { [signalKey]: lastFiredTimestampMs }
const coachCooldowns = {};
function canCoach(key, cooldownMs) {
  const last = coachCooldowns[key];
  if (!last || Date.now() - last > cooldownMs) {
    coachCooldowns[key] = Date.now();
    return true;
  }
  return false;
}

// ─── CORS helper (dynamic origin) ────────────────────────────────────────────
// All auth/tip API responses now allow any chrome-extension:// origin.
// The actual extension ID doesn't need to be hardcoded.

// ─── Persistence ─────────────────────────────────────────────────────────────
async function save() {
  await chrome.storage.local.set({ _bg_whales: whales, _bg_coachMsgs: coachMsgs });
}

async function restore() {
  // Support both old format ({ session: {access_token, user} })
  // and new popup format ({ session: access_token_string, user: {...} })
  const data = await chrome.storage.local.get(['session', 'user', '_bg_whales', '_bg_coachMsgs']);
  whales    = data._bg_whales    || [];
  coachMsgs = data._bg_coachMsgs || [];

  if (data.session && data.user) {
    const token = typeof data.session === 'string' ? data.session : data.session?.access_token;
    if (token) {
      session = { access_token: token, user: data.user };
    }
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function login(email, password) {
  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const text = await res.text();
    if (!text) return { ok: false, error: `Server returned empty response (${res.status})` };

    let data;
    try { data = JSON.parse(text); }
    catch { return { ok: false, error: `Bad server response (${res.status}): ${text.slice(0, 120)}` }; }

    if (!res.ok) return { ok: false, error: data.error || 'Login failed' };

    session = { access_token: data.session.access_token, user: data.user };
    await save();
    await loadWhales();
    scheduleAlarms();
    return { ok: true, user: data.user };
  } catch (e) {
    return { ok: false, error: 'Connection error: ' + e.message };
  }
}

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

// ─── Whale loading ────────────────────────────────────────────────────────────
async function loadWhales() {
  if (!session) return;
  try {
    const userId = session.user?.id;
    if (!userId) return;
    const res = await fetch(`${API}/api/live/tips?userId=${encodeURIComponent(userId)}&limit=200`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return;
    const { tips } = await res.json();

    // Aggregate total tokens per username
    const totals = {};
    for (const t of tips || []) {
      if (!t.username) continue;
      totals[t.username] = (totals[t.username] || 0) + (t.tokens || 0);
    }

    // Anyone with 100+ tokens historically is a whale
    whales = Object.entries(totals)
      .filter(([, tok]) => tok >= 100)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50)
      .map(([username, tokens]) => ({ username, tokens }));

    await save();
  } catch (_) {}
}

// ─── Tip sync ─────────────────────────────────────────────────────────────────
async function syncTip({ username, tokens, platform, timestamp }) {
  if (!session) return;
  const userId = session.user?.id;
  if (!userId) return;
  try {
    const usd = parseFloat((tokens * 0.05).toFixed(2));
    await fetch(`${API}/api/live/tips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        userId,
        username,
        tokens,
        usd,
        platform,
        source: 'extension',
        timestamp: timestamp || new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error('[CamCash] sync failed:', e.message);
  }
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
      // 2-min cooldown prevents the same alarm firing twice in quick succession
      const type = sessionTips.length > 0 ? 'quiet' : 'dead_air';
      if (canCoach(`alarm_${type}`, 2 * 60 * 1000)) addCoach(type);
    }
  }
  if (alarm.name === 'whale_refresh') {
    await loadWhales();
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getState() {
  return {
    authed:    !!session,
    user:      session?.user || null,
    tips:      sessionTips.slice(0, 20),
    tokens:    sessionTokens,
    usd:       sessionUsd,
    topTipper,
    coaches:   coachMsgs,
    whales:    whales.slice(0, 10),
    connected: true,
  };
}

// Send to popup if it's open
function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

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

function isWhale(username) {
  return whales.some(w => w.username.toLowerCase() === username.toLowerCase());
}

function getWhale(username) {
  return whales.find(w => w.username.toLowerCase() === username.toLowerCase());
}

// ─── Message router ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {

  // Popup: get current state
  if (msg.action === 'get_state') {
    reply(getState());
    return false;
  }

  // Popup: login
  if (msg.action === 'login') {
    login(msg.email, msg.password).then(reply);
    return true; // async
  }

  // Popup: logout
  if (msg.action === 'logout') {
    logout().then(() => reply({ ok: true }));
    return true;
  }

  // Content: tip detected
  if (msg.action === 'tip') {
    const { username, tokens, platform } = msg;
    lastTipTs = Date.now();

    const usd = parseFloat((tokens * 0.05).toFixed(2));
    const tip = { username, tokens, usd, platform, ts: lastTipTs };

    sessionTips.unshift(tip);
    if (sessionTips.length > 100) sessionTips.length = 100;
    sessionTokens += tokens;
    sessionUsd += usd;
    if (!topTipper || tokens > topTipper.tokens) topTipper = tip;

    // Write to storage so popup.js loadTips() can read it
    const storageKey = `tip_${lastTipTs}`;
    const tipRecord = {
      username,
      amount: tokens,
      platform,
      timestamp: new Date(lastTipTs).toISOString(),
      synced: false,
    };
    chrome.storage.local.set({ [storageKey]: tipRecord });

    // Prune old tip keys — keep only the 100 newest
    chrome.storage.local.get(null, (items) => {
      const tipKeys = Object.keys(items)
        .filter(k => k.startsWith('tip_'))
        .sort()
        .reverse();
      if (tipKeys.length > 100) {
        chrome.storage.local.remove(tipKeys.slice(100));
      }
    });

    syncTip({ username, tokens, platform, timestamp: new Date(lastTipTs).toISOString() }).then(() => {
      chrome.storage.local.set({ [storageKey]: { ...tipRecord, synced: true } });
    });

    // Tip streak coaching: 3+ tips in 60s — cooldown 3 min
    const recentCount = sessionTips.filter(t => lastTipTs - t.ts < 60000).length;
    if (recentCount >= 3 && canCoach('streak', 3 * 60 * 1000)) addCoach('streak');

    // Whale coach on tip — cooldown 5 min per whale
    if (isWhale(username) && canCoach(`whale_tip_${username}`, 5 * 60 * 1000)) addCoach('whale');

    broadcast({ action: 'state', state: getState() });
    broadcastOverlay();
    return false;
  }

  // Content: user entered room
  if (msg.action === 'entered') {
    const { username } = msg;
    if (isWhale(username)) {
      const w = getWhale(username);
      // 5-min cooldown per whale so re-entries don't spam
      if (canCoach(`whale_enter_${username}`, 5 * 60 * 1000)) addCoach('whale');

      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon.png'),
        title: '🐋 Whale Alert!',
        message: `${username} just entered (${w.tokens.toLocaleString()} tokens historically)`,
        priority: 2,
      });

      broadcast({ action: 'whale_alert', username, tokens: w.tokens });
      broadcastOverlay();
    }
    return false;
  }

  // Content: connected/disconnected
  if (msg.action === 'connected') {
    broadcast({ action: 'state', state: getState() });
    broadcastOverlay();
    return false;
  }

  // Popup: auth changed (new popup.js format)
  if (msg.type === 'AUTH_CHANGED') {
    restore().then(() => {
      if (session) { loadWhales(); scheduleAlarms(); }
      else { chrome.alarms.clearAll(); }
    });
    return false;
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
restore().then(() => {
  if (session) {
    loadWhales();
    scheduleAlarms();
  }
});

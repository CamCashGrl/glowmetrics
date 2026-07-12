// popup.js - CamCash Live popup UI

const SUPABASE_URL = 'https://hlsdlaibnayzbfflxclj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc2RsYWlibmF5emJmZmx4Y2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjQwODUsImV4cCI6MjA4OTIwMDA4NX0.5FwPe35UL-o46FvBJX526La5o7jcbFaP1KVoLtI4U_M';

// ─── Icons (inline, lucide-style) ──────────────────────────────────────────
const ICONS = {
  user: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  check: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  checkCircle: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
  clock: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  zap: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>',
  crown: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7Z"/><path d="M5 19h14"/></svg>',
  wallet: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>',
  star: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.1 6.9L22 10l-5 5 1.3 7.1L12 18.3 5.7 22.1 7 15 2 10l6.9-1.1Z"/></svg>',
  heart: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.5-1.5 3-3.4 3-5.5A5.5 5.5 0 0 0 12 5a5.5 5.5 0 0 0-10 3.5C2 15 12 21 12 21s5-3.1 7-6"/></svg>',
  heartSmall: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21s-7-4.35-9.5-8.5C.8 9.2 2.7 5.8 6 5.3c2-.3 3.6.7 6 3.2 2.4-2.5 4-3.5 6-3.2 3.3.5 5.2 3.9 3.5 7.2C19 16.65 12 21 12 21Z"/></svg>',
  wifi: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13a10 10 0 0 1 14 0"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.8a15 15 0 0 1 20 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
  dashboard: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 15v3M12 10v8M17 6v12"/></svg>',
  send: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/></svg>',
  logOut: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
  inbox: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>',
  moon: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  pause: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  play: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7Z"/></svg>',
  trash: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
};

const AVATAR_COLORS = ['#a855f7', '#22d3ee', '#ec4899', '#818cf8', '#34d399', '#f59e0b'];

// Coaching message "type" (from background.js COACH pools) -> display category
const COACH_CATEGORY = {
  dead_air: { label: 'Slow Period', cls: 'type-slow' },
  streak: { label: 'Momentum', cls: 'type-momentum' },
  whale: { label: 'Whale Alert', cls: 'type-whale' },
  quiet: { label: 'Session Pace', cls: 'type-pace' },
};

// ─── DOM refs ────────────────────────────────────────────────────────────
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const guestBtn = document.getElementById('guest-btn');
const logoutBtn = document.getElementById('logout-btn');
const authError = document.getElementById('auth-error');

const statusPill = document.getElementById('status-pill');
const statusState = document.getElementById('status-state');

const accountAvatarFallback = document.getElementById('account-avatar-fallback');
const accountEmailEl = document.getElementById('account-email');

const planCard = document.getElementById('plan-card');
const whaleAlertEl = document.getElementById('whale-alert');
const platformLimitAlertEl = document.getElementById('platform-limit-alert');

const coachContent = document.getElementById('coach-content');

const snapshotPlatform = document.getElementById('snapshot-platform');
const snapshotPlatformName = document.getElementById('snapshot-platform-name');
const snapshotPlatformChip = document.getElementById('snapshot-platform-chip');
const snapEarned = document.getElementById('snap-earned');
const snapTokens = document.getElementById('snap-tokens');
const snapTips = document.getElementById('snap-tips');
const snapTop = document.getElementById('snap-top');

const sessionToggleBtn = document.getElementById('session-toggle-btn');
const sessionToggleLabel = document.getElementById('session-toggle-label');

const tipsList = document.getElementById('tips-list');
const tipsMeta = document.getElementById('tips-meta');
const tipsCountText = document.getElementById('tips-count-text');
const clearTipsBtn = document.getElementById('clear-tips-btn');

// ─── State ───────────────────────────────────────────────────────────────
let liveModeActive = false;
let lastState = null;      // most recent background getState() payload
let currentTips = [];      // parsed tip_* records from chrome.storage, newest first
let seenTipKeys = new Set();
let hasLoadedTipsOnce = false; // suppresses the "new tip" flash for tips that already existed before this popup opened
let lastRenderedCoachTs = null;

// ─── Init ────────────────────────────────────────────────────────────────
function init() {
  setStaticIcons();
  checkAuthState();
  loadTips();
  fetchInitialState();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function setStaticIcons() {
  document.getElementById('icon-connected').innerHTML = ICONS.wifi;
  document.getElementById('plan-icon-slot').innerHTML = ICONS.crown;
  document.getElementById('coach-icon-slot').innerHTML = ICONS.zap;
  document.getElementById('coach-sparkle-slot').innerHTML = ICONS.sparkles;
  document.getElementById('icon-earned').innerHTML = ICONS.wallet;
  document.getElementById('icon-tokens').innerHTML = ICONS.star;
  document.getElementById('icon-tips').innerHTML = ICONS.heart;
  document.getElementById('icon-top').innerHTML = ICONS.crown;
  document.getElementById('icon-dashboard').innerHTML = ICONS.dashboard;
  document.getElementById('icon-test').innerHTML = ICONS.send;
  document.getElementById('icon-logout').innerHTML = ICONS.logOut;
  document.getElementById('icon-clear').innerHTML = ICONS.trash;
  document.getElementById('icon-heart').innerHTML = ICONS.heartSmall;
}

// ─── Auth ────────────────────────────────────────────────────────────────
async function checkAuthState() {
  const stored = await getStoredAuth();
  if (stored.session && stored.user) {
    showDashboard(stored.user);
  } else {
    showAuth();
  }
  updateStatus();
}

function showAuth() {
  authSection.style.display = 'block';
  dashboardSection.style.display = 'none';
  authError.style.display = 'none';
}

function showDashboard(user) {
  authSection.style.display = 'none';
  dashboardSection.style.display = 'flex';

  const email = user.email || '';
  accountEmailEl.textContent = email;
  accountEmailEl.title = email;
  accountAvatarFallback.textContent = (email.trim()[0] || '?').toUpperCase();
}

loginBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showError('Email and password required');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in…';

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ email: email.toLowerCase().trim(), password })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      showError(data.error_description || data.message || 'Invalid credentials');
      return;
    }

    await chrome.storage.local.set({
      session: data.access_token,
      refresh_token: data.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        username: data.user.user_metadata?.username || data.user.email.split('@')[0]
      }
    });

    console.log('[Popup] Logged in via Supabase directly');
    chrome.runtime.sendMessage({ type: 'AUTH_CHANGED', authenticated: true });
    showDashboard(data.user);
    fetchInitialState();
    loadTips();

  } catch (err) {
    console.error('Login error:', err);
    showError('Connection error: ' + err.message);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
});

guestBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({
    session: null,
    user: { id: 'guest', email: 'guest@localhost', username: 'Guest' }
  });
  chrome.runtime.sendMessage({ type: 'AUTH_CHANGED', authenticated: false });
  showDashboard({ email: 'guest@localhost' });
  fetchInitialState();
  loadTips();
});

logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  try {
    await chrome.storage.local.remove(['session', 'refresh_token', 'user']);
    chrome.runtime.sendMessage({ type: 'AUTH_CHANGED', authenticated: false });
    lastState = null;
    currentTips = [];
    seenTipKeys = new Set();
    hasLoadedTipsOnce = false;
    showAuth();
    emailInput.value = '';
    passwordInput.value = '';
  } finally {
    logoutBtn.disabled = false;
  }
});

function showError(message) {
  authError.textContent = message;
  authError.style.display = 'block';
}

function getStoredAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['session', 'user'], (items) => {
      resolve({ session: items.session, user: items.user || null });
    });
  });
}

// ─── Live Mode status pill ─────────────────────────────────────────────────
function updateStatus() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'PING' }, () => {
        liveModeActive = !chrome.runtime.lastError;
        renderStatusPill();
        renderCoachCard();
      });
    } else {
      liveModeActive = false;
      renderStatusPill();
      renderCoachCard();
    }
  });
}

function renderStatusPill() {
  const paused = !!lastState?.paused;
  statusPill.classList.remove('active', 'paused');
  if (!liveModeActive) {
    statusState.textContent = 'Off';
  } else if (paused) {
    statusPill.classList.add('paused');
    statusState.textContent = 'Paused';
  } else {
    statusPill.classList.add('active');
    statusState.textContent = 'Active';
  }
  tipsMeta.classList.toggle('is-paused', liveModeActive && paused);
  document.getElementById('tips-live-text').textContent = liveModeActive && paused ? 'Paused' : 'Live';
}

// ─── Session pause / resume ────────────────────────────────────────────────
sessionToggleBtn.addEventListener('click', () => {
  const nextPaused = !lastState?.paused;
  sessionToggleBtn.disabled = true;
  chrome.runtime.sendMessage({ action: 'set_paused', paused: nextPaused }, () => {
    sessionToggleBtn.disabled = false;
  });
});

function renderSessionToggle() {
  const paused = !!lastState?.paused;
  sessionToggleBtn.classList.toggle('is-paused', paused);
  sessionToggleLabel.textContent = paused ? 'Resume Session' : 'Pause Session';
  document.getElementById('icon-session-toggle').innerHTML = paused ? ICONS.play : ICONS.pause;
}

// ─── Clear tip feed ──────────────────────────────────────────────────────
clearTipsBtn.addEventListener('click', () => {
  if (currentTips.length === 0) return;
  const ok = confirm("Clear all tips from this session's feed? This does not affect your saved dashboard history.");
  if (!ok) return;
  clearTipsBtn.disabled = true;
  chrome.runtime.sendMessage({ action: 'clear_tips' }, () => {
    clearTipsBtn.disabled = false;
    seenTipKeys = new Set();
    loadTips();
  });
});

// ─── Recent tips feed ────────────────────────────────────────────────────
function loadTips() {
  chrome.storage.local.get(null, (items) => {
    const tips = Object.entries(items)
      .filter(([key, item]) => key.startsWith('tip_') && item && item.amount)
      .map(([key, item]) => ({ key, ...item }));

    tips.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    currentTips = tips;

    renderTipsList(tips);
    renderSnapshot();
  });
}

function renderTipsList(tips) {
  const visible = tips.slice(0, 10);
  const whaleSet = new Set((lastState?.whales || []).map(w => w.username.toLowerCase()));
  const newKeys = new Set();
  // Only flag tips as "new" once we've established a baseline — otherwise every
  // tip already on disk would flash NEW the moment the popup is reopened.
  const suppressNewFlash = !hasLoadedTipsOnce;

  clearTipsBtn.disabled = visible.length === 0;

  if (visible.length === 0) {
    tipsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${ICONS.inbox}</div>
        <strong>Waiting for your first tip</strong>
        <span>New tips will appear here automatically while Live Mode is running.</span>
      </div>`;
    tipsCountText.textContent = '0 detected';
    seenTipKeys = new Set();
    hasLoadedTipsOnce = true;
    return;
  }

  tipsCountText.textContent = `${tips.length} detected`;

  tipsList.innerHTML = visible.map((tip) => {
    const isNew = !suppressNewFlash && !seenTipKeys.has(tip.key);
    if (isNew) newKeys.add(tip.key);

    const isWhale = whaleSet.has((tip.username || '').toLowerCase());
    const isLarge = isWhale || tip.amount >= 100;
    const isMedium = !isLarge && tip.amount >= 50;

    const tierClass = isLarge ? 'tip-row--whale' : isMedium ? 'tip-row--medium' : '';
    const avatarColor = colorForUsername(tip.username);
    const initial = (tip.username || '?').trim()[0]?.toUpperCase() || '?';

    const statusHTML = isNew
      ? `<span class="tip-new-pill">NEW</span>`
      : tip.synced
        ? `<span class="tip-status" title="Synced to your account">${ICONS.checkCircle}</span>`
        : `<span class="tip-status pending" title="Syncing…">${ICONS.clock}</span>`;

    return `
      <div class="tip-row ${tierClass}${isNew ? ' tip-row--new' : ''}" data-key="${escapeHtml(tip.key)}">
        <div class="tip-avatar" style="background:${avatarColor}">${escapeHtml(initial)}</div>
        <div class="tip-main">
          <div class="tip-top">
            <span class="tip-username" title="${escapeHtml(tip.username)}">${escapeHtml(tip.username)}</span>
            <span class="tip-verb">tipped</span>
            <span class="tip-amount">${tip.amount.toLocaleString()} tokens</span>
          </div>
        </div>
        <div class="tip-side">
          <span class="tip-time" title="${new Date(tip.timestamp).toLocaleString()}">${formatTime(tip.timestamp)}</span>
          ${statusHTML}
        </div>
      </div>`;
  }).join('');

  seenTipKeys = new Set(visible.map(t => t.key));
  hasLoadedTipsOnce = true;

  if (newKeys.size > 0) {
    setTimeout(() => {
      newKeys.forEach((key) => {
        const row = tipsList.querySelector(`[data-key="${cssEscape(key)}"]`);
        if (row) row.classList.remove('tip-row--new');
      });
    }, 1800);
  }
}

function colorForUsername(username) {
  const str = String(username || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function cssEscape(str) {
  return String(str).replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c);
}

function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000 && date.getDate() === now.getDate()) return Math.floor(diff / 3600000) + 'h ago';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

setInterval(loadTips, 5000);

// ─── Session snapshot ────────────────────────────────────────────────────
function renderSnapshot() {
  const usd = lastState?.usd;
  const tokens = lastState?.tokens;

  snapEarned.textContent = typeof usd === 'number' ? `$${usd.toFixed(2)}` : '—';
  snapTokens.textContent = typeof tokens === 'number' ? tokens.toLocaleString() : '—';
  snapTips.textContent = currentTips.length.toLocaleString();

  if (currentTips.length === 0) {
    snapTop.textContent = '—';
    snapTop.title = '';
  } else {
    const top = currentTips.reduce((a, b) => (b.amount > a.amount ? b : a), currentTips[0]);
    snapTop.textContent = top.username;
    snapTop.title = `${top.username} — ${top.amount.toLocaleString()} tokens`;
  }

  if (currentTips.length > 0 && currentTips[0].platform) {
    const platform = currentTips[0].platform;
    const label = platform.charAt(0).toUpperCase() + platform.slice(1);
    snapshotPlatform.style.display = 'flex';
    snapshotPlatformName.textContent = label;
    snapshotPlatformChip.textContent = label.slice(0, 2).toUpperCase();
  } else {
    snapshotPlatform.style.display = 'none';
  }
}

// ─── Live Coach ──────────────────────────────────────────────────────────
function renderCoachCard() {
  const coaches = lastState?.coaches || [];
  const paused = !!lastState?.paused;
  const latest = coaches[0] || null;

  if (!latest) {
    let title, body;
    if (!liveModeActive) {
      title = 'Live Mode is currently off';
      body = 'Open a supported streaming platform to begin tracking your session.';
    } else if (paused) {
      title = 'Session paused';
      body = 'Resume your session to keep watching pace, goals, and tip activity.';
    } else {
      title = 'Coaching prompts will appear here while you stream.';
      body = 'Start Live Mode and CamCash will watch your pace, goals, and tip activity.';
    }
    coachContent.innerHTML = `<div class="coach-empty"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(body)}</span></div>`;
    lastRenderedCoachTs = null;
    return;
  }

  const category = COACH_CATEGORY[latest.type] || { label: 'Session Pace', cls: 'type-pace' };
  const isNew = latest.ts !== lastRenderedCoachTs;
  lastRenderedCoachTs = latest.ts;

  coachContent.innerHTML = `
    <div class="coach-body ${category.cls}${isNew ? ' coach-enter' : ''}">
      <div class="coach-msg-text">${escapeHtml(latest.text)}</div>
      <div class="coach-meta">
        <span class="coach-category ${category.cls}">${escapeHtml(category.label)}</span>
        <span class="coach-time">${formatTime(new Date(latest.ts).toISOString())}</span>
      </div>
    </div>`;
}

// ─── Plan card ───────────────────────────────────────────────────────────
function updatePlanNotice(isPro) {
  planCard.style.display = isPro ? 'none' : 'flex';
}

// ─── Background state sync ─────────────────────────────────────────────────
function applyState(state) {
  if (!state) return;
  lastState = state;
  updatePlanNotice(state.isPro);
  renderStatusPill();
  renderSessionToggle();
  renderCoachCard();
  renderSnapshot();
}

function fetchInitialState() {
  chrome.runtime.sendMessage({ action: 'get_state' }, (state) => {
    if (chrome.runtime.lastError || !state) return;
    applyState(state);
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'state' && msg.state) {
    applyState(msg.state);
    loadTips();
  }
  if (msg.action === 'whale_alert') {
    whaleAlertEl.innerHTML = `${ICONS.crown} <span>${escapeHtml(msg.username)} just entered — historically a ${msg.tokens.toLocaleString()} token tipper.</span>`;
    whaleAlertEl.style.display = 'flex';
    setTimeout(() => { whaleAlertEl.style.display = 'none'; }, 12000);
  }
  if (msg.action === 'platform_limit_reached') {
    platformLimitAlertEl.innerHTML = `${ICONS.moon} <span>Tips on ${escapeHtml(msg.platform)} aren't being saved — free plan tracks 1 platform. <a href="https://www.camcashgrl.com/pricing" target="_blank" rel="noopener">Upgrade →</a></span>`;
    platformLimitAlertEl.style.display = 'flex';
  }
});

// ─── Test tip ────────────────────────────────────────────────────────────
document.getElementById('test-tip-btn').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  chrome.runtime.sendMessage({
    action: 'tip',
    username: 'TestTipper',
    tokens: 50,
    platform: 'chaturbate',
  }, () => {
    btn.disabled = false;
    loadTips();
  });
});

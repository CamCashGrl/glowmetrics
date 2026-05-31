// popup.js - CamCash Live popup UI

const SUPABASE_URL = 'https://hlsdlaibnayzbfflxclj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc2RsYWlibmF5emJmZmx4Y2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjQwODUsImV4cCI6MjA4OTIwMDA4NX0.5FwPe35UL-o46FvBJX526La5o7jcbFaP1KVoLtI4U_M';

// DOM elements
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const guestBtn = document.getElementById('guest-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const tipsList = document.getElementById('tips-list');
const authError = document.getElementById('auth-error');
const statusBadge = document.getElementById('status');

// On load
function init() {
  checkAuthState();
  loadTips();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

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
  dashboardSection.style.display = 'block';
  userInfo.textContent = `✅ Logged in as ${user.email}`;
}

// Login directly via Supabase
loginBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showError('Email and password required');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';

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

  } catch (err) {
    console.error('Login error:', err);
    showError('Connection error: ' + err.message);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
});

// Guest mode
guestBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({
    session: null,
    user: { id: 'guest', email: 'guest@localhost', username: 'Guest' }
  });
  chrome.runtime.sendMessage({ type: 'AUTH_CHANGED', authenticated: false });
  showDashboard({ email: 'guest@localhost' });
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove(['session', 'refresh_token', 'user']);
  chrome.runtime.sendMessage({ type: 'AUTH_CHANGED', authenticated: false });
  showAuth();
  emailInput.value = '';
  passwordInput.value = '';
});

// Load and display tips
async function loadTips() {
  chrome.storage.local.get(null, (items) => {
    const tips = Object.values(items).filter(item => item && item.amount);

    if (tips.length === 0) {
      tipsList.innerHTML = '<div class="empty-state">No tips detected yet this session</div>';
      return;
    }

    tips.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    tipsList.innerHTML = tips.slice(0, 10).map(tip => `
      <div class="tip-item">
        <div>
          <span class="tip-username">${escapeHtml(tip.username)}</span>
          <span style="color:#64748b"> tipped </span>
          <span class="tip-amount">${tip.amount} tokens</span>
        </div>
        <div class="tip-time">${formatTime(tip.timestamp)}${tip.synced ? ' ✅' : ' ⏳'}</div>
      </div>
    `).join('');
  });
}

// Update status badge
function updateStatus() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'PING' }, (response) => {
        if (chrome.runtime.lastError) {
          statusBadge.textContent = 'Inactive';
          statusBadge.style.background = 'rgba(107,114,128,0.2)';
          statusBadge.style.color = '#9ca3af';
        } else {
          statusBadge.textContent = 'Active';
          statusBadge.style.background = 'rgba(34,197,94,0.1)';
          statusBadge.style.color = '#4ade80';
        }
      });
    }
  });
}

function getStoredAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['session', 'user'], (items) => {
      resolve({ session: items.session, user: items.user || null });
    });
  });
}

function showError(message) {
  authError.textContent = '❌ ' + message;
  authError.style.display = 'block';
}

function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

setInterval(loadTips, 5000);

// Listen for coaching + state broadcasts from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'state' && msg.state) {
    const coaches = msg.state.coaches;
    if (coaches && coaches.length > 0) {
      const coachMsg = document.getElementById('coach-msg');
      if (coachMsg) coachMsg.textContent = coaches[0].text;
    }
    loadTips();
  }
  if (msg.action === 'whale_alert') {
    const whaleAlert = document.getElementById('whale-alert');
    if (whaleAlert) {
      whaleAlert.textContent = `🐋 ${msg.username} just entered! (${msg.tokens.toLocaleString()} tokens historically)`;
      whaleAlert.style.display = 'block';
      setTimeout(() => { whaleAlert.style.display = 'none'; }, 12000);
    }
  }
});

// Test tip button
document.getElementById('test-tip-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({
    action: 'tip',
    username: 'TestTipper',
    tokens: 50,
    platform: 'chaturbate',
  }, () => {
    loadTips();
  });
});
// ─── Sync UI ──────────────────────────────────────────────────────────────────



syncBtn.addEventListener('click', async () => {
  // Check if logged into Chaturbate first
  const status = await chrome.runtime.sendMessage({ type: 'GET_SESSION_STATUS' });
  if (!status?.chaturbate) {
    syncStatus.textContent = '⚠️ Log into Chaturbate first, then try again';
    syncStatus.style.color = '#f87171';
    return;
  }

  // Check if this is first sync or incremental
  const key = `sync_cursor_${(await getStoredAuth()).user?.id}_chaturbate`;
  const stored = await chrome.storage.local.get(key);
  const isFirst = !stored[key];

  syncBtn.disabled = true;
  syncBtn.textContent = 'Syncing…';
  syncStatus.style.color = '#fbbf24';
  syncStatus.textContent = isFirst
    ? 'Importing full history — this may take a minute…'
    : 'Fetching latest tips…';

  chrome.runtime.sendMessage({
    type: 'SYNC_START',
    platform: 'chaturbate',
    mode: isFirst ? 'full' : 'incremental',
  });
});

// Listen for sync progress from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'SYNC_PROGRESS') return;

  if (msg.error) {
    syncBtn.disabled = false;
    syncBtn.textContent = 'Retry Sync →';
    syncStatus.style.color = '#f87171';
    const errors = {
      SESSION_NOT_FOUND:  '⚠️ Log into Chaturbate first',
      SESSION_EXPIRED:    '⚠️ Chaturbate session expired — re-login and retry',
      NOT_AUTHENTICATED:  '⚠️ Sign into CamCash first',
    };
    syncStatus.textContent = errors[msg.error] || '❌ Sync failed — try again';
    return;
  }

  if (msg.done) {
    syncBtn.disabled = false;
    syncBtn.textContent = 'Sync Latest →';
    syncStatus.style.color = '#4ade80';
    syncStatus.textContent = `✅ ${(msg.inserted || 0).toLocaleString()} tips imported`;
    loadTips(); // refresh the tips list
    return;
  }

  // Progress update
  syncStatus.style.color = '#fbbf24';
  syncStatus.textContent = `Importing · ${(msg.tipsFound || 0).toLocaleString()} tips found…`;
});

// ─── One-Click Sync (connector path) ─────────────────────────────────────────
const _syncBtn  = document.getElementById('sync-btn');
const _syncProg = document.getElementById('sync-progress');
const _syncBar  = document.getElementById('sync-bar');
const _syncStat = document.getElementById('sync-status');
const _syncRes  = document.getElementById('sync-result');

if (_syncBtn && !_syncBtn.dataset.connectorBound) {
  _syncBtn.dataset.connectorBound = '1';
  _syncBtn.addEventListener('click', () => {
    _syncBtn.disabled = true;
    _syncBtn.textContent = 'Syncing...';
    if (_syncProg) { _syncProg.style.display = 'block'; }
    if (_syncRes)  { _syncRes.style.display = 'none'; }
    if (_syncBar)  { _syncBar.style.width = '5%'; }
    chrome.runtime.sendMessage({ action: 'start_sync' });
  });
}

chrome.runtime.onMessage.addListener(msg => {
  if (msg.action !== 'sync_progress') return;
  if (msg.error) {
    if (_syncProg) _syncProg.style.display = 'none';
    if (_syncRes)  { _syncRes.style.display = 'block'; _syncRes.style.color = '#f87171'; _syncRes.textContent = '❌ ' + msg.error; }
    if (_syncBtn)  { _syncBtn.disabled = false; _syncBtn.textContent = 'Sync Earnings →'; }
    return;
  }
  if (msg.done) {
    if (_syncBar)  _syncBar.style.width = '100%';
    if (_syncStat) _syncStat.textContent = 'Done! ' + msg.tipsFound + ' tips synced';
    setTimeout(() => {
      if (_syncProg) _syncProg.style.display = 'none';
      if (_syncRes)  { _syncRes.style.display = 'block'; _syncRes.style.color = '#10b981'; _syncRes.textContent = '✅ ' + msg.tipsFound + ' tips imported'; }
      if (_syncBtn)  { _syncBtn.disabled = false; _syncBtn.textContent = 'Sync Earnings →'; }
    }, 1500);
  } else {
    if (_syncBar)  _syncBar.style.width = Math.min(5 + msg.pagesLoaded * 8, 90) + '%';
    if (_syncStat) _syncStat.textContent = 'Page ' + msg.pagesLoaded + ' · ' + msg.tipsFound + ' tips...';
  }
});

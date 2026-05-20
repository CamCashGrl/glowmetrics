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

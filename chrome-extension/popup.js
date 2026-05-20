// CamCash popup script

const $ = id => document.getElementById(id);

// ─── Elements ─────────────────────────────────────────────────────────────────
const loginView   = $('login-view');
const dashView    = $('dash-view');
const emailEl     = $('email');
const passEl      = $('password');
const btnLogin    = $('btn-login');
const loginErr    = $('login-error');
const statusDot   = $('status-dot');
const statusText  = $('status-text');
const headerRight = $('header-right');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
function fmtUsd(n) { return '$' + n.toFixed(2); }
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Render state ─────────────────────────────────────────────────────────────
function render(state) {
  if (!state.authed) {
    loginView.style.display = 'block';
    dashView.style.display  = 'none';
    // Hide logout
    const lo = document.getElementById('btn-logout-el');
    if (lo) lo.remove();
    return;
  }

  loginView.style.display = 'none';
  dashView.style.display  = 'block';

  // Add logout button to header if not there
  if (!document.getElementById('btn-logout-el')) {
    const btn = document.createElement('button');
    btn.className = 'btn-logout';
    btn.id = 'btn-logout-el';
    btn.textContent = 'Sign out';
    btn.addEventListener('click', doLogout);
    headerRight.prepend(btn);
  }

  // Status
  if (state.connected) {
    statusDot.className  = 'dot green';
    statusText.textContent = 'Connected · ' + (state.user?.username || state.user?.email || '');
  } else {
    statusDot.className  = 'dot yellow';
    statusText.textContent = 'Waiting for stream page…';
  }

  // Stats
  $('stat-usd').textContent    = fmtUsd(state.usd || 0);
  $('stat-tokens').textContent = fmt(state.tokens || 0);
  $('stat-count').textContent  = state.tips?.length || 0;

  // Top tipper label
  if (state.topTipper) {
    $('top-tipper-label').textContent =
      `Top: ${state.topTipper.username} (${state.topTipper.tokens} tok)`;
  }

  // Coach messages
  const coachList = $('coach-list');
  if (state.coaches?.length) {
    coachList.innerHTML = state.coaches.slice(0, 3).map(c =>
      `<div class="coach-item">${c.text}</div>`
    ).join('');
  } else {
    coachList.innerHTML = '<div class="empty">Coaching tips will appear here during your stream</div>';
  }

  // Tip feed
  const tipList = $('tip-list');
  if (state.tips?.length) {
    tipList.innerHTML = state.tips.slice(0, 8).map(t => `
      <div class="tip-row">
        <span class="tip-user">${t.username}</span>
        <div class="tip-right">
          <span class="tip-tokens">${t.tokens} tok</span>
          <span class="tip-usd">${fmtUsd(t.usd || 0)}</span>
          <span class="tip-time">${fmtTime(t.ts)}</span>
        </div>
      </div>
    `).join('');
  } else {
    tipList.innerHTML = '<div class="empty">No tips yet this session</div>';
  }
}

// ─── Whale alert ──────────────────────────────────────────────────────────────
function showWhaleAlert(username, tokens) {
  const el = $('whale-alert');
  el.style.display = 'block';
  el.innerHTML = `🐋 <strong>${username}</strong> just entered — ${tokens.toLocaleString()} tokens historically!`;
  setTimeout(() => { el.style.display = 'none'; }, 10000);
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function doLogin() {
  const email    = emailEl.value.trim();
  const password = passEl.value;
  if (!email || !password) { loginErr.textContent = 'Enter email and password'; return; }

  btnLogin.disabled    = true;
  btnLogin.textContent = 'Signing in…';
  loginErr.textContent = '';

  const res = await chrome.runtime.sendMessage({ action: 'login', email, password });
  btnLogin.disabled    = false;
  btnLogin.textContent = 'Sign In';

  if (res?.ok) {
    render({ authed: true, user: res.user, tips: [], tokens: 0, usd: 0, coaches: [], connected: false });
    // Load full state
    loadState();
  } else {
    loginErr.textContent = res?.error || 'Login failed';
  }
}

async function doLogout() {
  await chrome.runtime.sendMessage({ action: 'logout' });
  render({ authed: false });
}

// ─── Load state from background ───────────────────────────────────────────────
async function loadState() {
  const state = await chrome.runtime.sendMessage({ action: 'get_state' });
  if (state) render(state);
}

// ─── Listen for live updates ──────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'state')       render(msg.state);
  if (msg.action === 'whale_alert') showWhaleAlert(msg.username, msg.tokens);
});

// ─── Event listeners ──────────────────────────────────────────────────────────
btnLogin.addEventListener('click', doLogin);
emailEl.addEventListener('keydown',  e => { if (e.key === 'Enter') passEl.focus(); });
passEl.addEventListener('keydown',   e => { if (e.key === 'Enter') doLogin(); });

// ─── Init ─────────────────────────────────────────────────────────────────────
loadState();

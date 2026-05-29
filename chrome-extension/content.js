// CamCash content script — tip detection + on-page overlay
// Runs on Chaturbate, BongaCams, MyFreeCams

(function () {
  'use strict';

  // ─── Platform detection ─────────────────────────────────────────────────────
  const host = location.hostname;
  let platform = 'chaturbate';
  if (host.includes('bongacams'))  platform = 'bongacams';
  if (host.includes('myfreecams')) platform = 'myfreecams';

  // ─── Tip / event patterns ───────────────────────────────────────────────────
  const TIP_PATTERNS = {
    chaturbate: [
      /^(.+?) tipped (\d+) token/i,
      /^(.+?): tipped (\d+)/i,
      /^(.+?) sent (\d+) token/i,
    ],
    bongacams: [
      /^(.+?) sent (\d+) token/i,
      /^(.+?) tipped (\d+)/i,
    ],
    myfreecams: [
      /^(.+?) tips? (\d+) token/i,
      /^(.+?) tip[pt]ed (\d+)/i,
    ],
  };

  const ENTER_PATTERNS = [
    /^(.+?) entered the room/i,
    /^(.+?) has entered/i,
    /^(.+?) joined the room/i,
    /^(.+?) is now in the room/i,
  ];

  // ─── Chat container selectors ───────────────────────────────────────────────
  const CHAT_SELECTORS = [
    '#chat-room-rows',
    '#chat-room-main',
    '.chat_room_messages',
    '[id*="chat"][id*="row"]',
    '[id*="chat"][id*="message"]',
    '.chat-messages-list',
    '#chat_messages',
    '.js-chat-messages',
    '#chat_area',
    '.chat-room-content',
    '[class*="chat"][class*="message"]',
    '[class*="chat"][class*="list"]',
  ];

  // ─── Tip detection state ────────────────────────────────────────────────────
  let observer  = null;
  let seenMsgs  = new Set();
  let retryTimer = null;

  function processText(text) {
    if (!text || text.length < 5) return;
    const clean = text.trim().replace(/\s+/g, ' ');
    const key   = clean.toLowerCase();
    if (seenMsgs.has(key)) return;
    seenMsgs.add(key);
    if (seenMsgs.size > 500) {
      const arr = [...seenMsgs];
      seenMsgs = new Set(arr.slice(arr.length - 200));
    }

    const patterns = TIP_PATTERNS[platform] || TIP_PATTERNS.chaturbate;
    for (const pat of patterns) {
      const m = clean.match(pat);
      if (m) {
        const tokens = parseInt(m[2], 10);
        if (isNaN(tokens) || tokens <= 0) continue;
        chrome.runtime.sendMessage({ action: 'tip', username: m[1].trim(), tokens, platform });
        return;
      }
    }

    for (const pat of ENTER_PATTERNS) {
      const m = clean.match(pat);
      if (m) {
        chrome.runtime.sendMessage({ action: 'entered', username: m[1].trim() });
        return;
      }
    }
  }

  // ─── DOM observation ────────────────────────────────────────────────────────
  function observeNode(node) {
    if (observer) observer.disconnect();
    observer = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        for (const added of mut.addedNodes) {
          if (added.nodeType === Node.ELEMENT_NODE || added.nodeType === Node.TEXT_NODE) {
            processText(added.textContent);
          }
        }
      }
    });
    observer.observe(node, { childList: true, subtree: true });
    chrome.runtime.sendMessage({ action: 'connected' });
  }

  function findAndObserve() {
    for (const sel of CHAT_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) { observeNode(el); return true; }
    }
    const candidates = document.querySelectorAll('div[id*="chat"], div[class*="chat"]');
    let best = null, bestH = 0;
    for (const el of candidates) {
      if (el.scrollHeight > bestH) { best = el; bestH = el.scrollHeight; }
    }
    if (best) { observeNode(best); return true; }
    return false;
  }

  function init() {
    if (findAndObserve()) return;
    let attempts = 0;
    retryTimer = setInterval(() => {
      attempts++;
      if (findAndObserve() || attempts > 60) {
        clearInterval(retryTimer);
        if (attempts > 60) { observeNode(document.body); }
      }
    }, 1000);
  }

  // PING from popup
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type === 'PING') { reply({ pong: true }); return true; }
  });

  // SPA navigation re-init
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      clearInterval(retryTimer);
      setTimeout(init, 1500);
    }
  }).observe(document, { subtree: true, childList: true });

  init();


  // ═══════════════════════════════════════════════════════════════════════════
  // ON-PAGE OVERLAY — floating HUD injected into the stream page
  // Uses Shadow DOM so page styles never bleed in
  // ═══════════════════════════════════════════════════════════════════════════

  let _host   = null;   // the outer wrapper element appended to body
  let _shadow = null;   // shadow root
  let _state  = null;   // latest state from background

  // Drag state
  let _dragging = false, _dragSX, _dragSY, _dragOX, _dragOY;

  // Collapsed state persisted in localStorage
  let _collapsed = localStorage.getItem('_cc_col') === '1';

  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _defaultPos() {
    const w = document.documentElement.clientWidth  || 1200;
    return { x: Math.max(0, w - 290), y: 20 };
  }

  function _loadPos() {
    try { return JSON.parse(localStorage.getItem('_cc_pos')) || null; } catch (_) { return null; }
  }

  function _savePos(x, y) {
    localStorage.setItem('_cc_pos', JSON.stringify({ x, y }));
  }

  // ─── CSS ──────────────────────────────────────────────────────────────────
  function _css() {
    return `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      #panel {
        width: 272px;
        background: rgba(7, 10, 20, 0.97);
        border: 1px solid rgba(124, 92, 255, 0.45);
        border-radius: 14px;
        backdrop-filter: blur(24px);
        box-shadow: 0 16px 60px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04);
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      }

      /* ── HEADER ── */
      #hdr {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 9px 13px;
        background: linear-gradient(135deg, rgba(124,92,255,0.2), rgba(34,211,238,0.08));
        border-bottom: 1px solid rgba(124,92,255,0.22);
        cursor: grab;
        user-select: none;
        touch-action: none;
      }
      #hdr:active { cursor: grabbing; }

      #title {
        display: flex;
        align-items: center;
        gap: 7px;
        font-size: 13px;
        font-weight: 800;
        color: #f1f5f9;
        letter-spacing: 0.3px;
      }
      .dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: #10b981; box-shadow: 0 0 6px #10b981;
        flex-shrink: 0;
        animation: blink 1.8s ease-in-out infinite;
      }
      .dot.off { background: #475569; box-shadow: none; animation: none; }
      @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.35} }

      .hbtn {
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 5px;
        color: #94a3b8;
        font-size: 11px;
        line-height: 1;
        padding: 4px 8px;
        cursor: pointer;
      }
      .hbtn:hover { background: rgba(255,255,255,0.14); color: #f1f5f9; }

      /* ── BODY ── */
      #body {
        padding: 11px 13px;
        display: flex;
        flex-direction: column;
        gap: 9px;
      }

      /* Latest coaching message */
      #coach {
        padding: 9px 11px;
        background: rgba(236,72,153,0.1);
        border: 1px solid rgba(236,72,153,0.28);
        border-radius: 9px;
        font-size: 12px;
        color: #f1f5f9;
        line-height: 1.55;
        font-weight: 500;
        min-height: 36px;
      }

      /* Room heat badge */
      #heat {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 6px 10px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 700;
      }
      .heat-label { flex: 1; }
      .heat-dir   { font-size: 10px; opacity: 0.8; }

      /* Stats row */
      #stats { display: flex; gap: 7px; }
      .st {
        flex: 1;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 8px;
        padding: 6px 5px;
        text-align: center;
      }
      .stl { font-size: 8px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
      .stv { font-size: 14px; font-weight: 800; }
      .g   { color: #10b981; }
      .c   { color: #22d3ee; }
      .o   { color: #f59e0b; }

      /* Tip rows */
      #tips { display: flex; flex-direction: column; gap: 4px; }
      .tr {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 5px 9px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 7px;
        font-size: 11px;
      }
      .tr.whale {
        background: rgba(245,158,11,0.1);
        border-color: rgba(245,158,11,0.35);
        animation: wflash 0.4s ease 3;
      }
      @keyframes wflash {
        0%,100% { background: rgba(245,158,11,0.1); }
        50%      { background: rgba(245,158,11,0.25); }
      }
      .tu { color: #f1f5f9; font-weight: 600; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tt { color: #22d3ee; }
      .td { color: #10b981; font-weight: 700; }

      #empty { font-size: 11px; color: #475569; text-align: center; padding: 6px 0; }

      /* Footer */
      #foot { padding: 0 13px 11px; }
      .dashbtn {
        display: block;
        width: 100%;
        padding: 7px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        text-align: center;
        text-decoration: none;
        color: #f1f5f9;
        background: linear-gradient(135deg, rgba(124,92,255,0.3), rgba(34,211,238,0.18));
        border: 1px solid rgba(124,92,255,0.38);
      }
      .dashbtn:hover {
        background: linear-gradient(135deg, rgba(124,92,255,0.5), rgba(34,211,238,0.3));
      }

      /* Not signed in */
      #noauth {
        padding: 14px 13px;
        text-align: center;
        font-size: 11px;
        color: #94a3b8;
        line-height: 1.7;
      }
      #noauth a { color: #a78bfa; font-weight: 700; }

      /* Collapsed: hide everything except header */
      #panel.collapsed #body,
      #panel.collapsed #foot { display: none; }
    `;
  }

  // ─── HTML ─────────────────────────────────────────────────────────────────
  function _panelHTML() {
    const s       = _state;
    const authed  = s?.authed;

    const hdr = `
      <div id="hdr">
        <div id="title">
          <div class="dot${authed ? '' : ' off'}"></div>
          CamCash
          ${authed ? '<span style="font-size:10px;font-weight:500;color:#475569;margin-left:2px;">Live</span>' : ''}
        </div>
        <button class="hbtn" id="tbtn">${_collapsed ? '▲' : '▼'}</button>
      </div>
    `;

    if (!authed) {
      return hdr + `
        <div id="noauth">
          Sign in to activate live coaching.<br/>
          <a href="https://www.camcashgrl.com/login" target="_blank">Sign in at camcashgrl.com →</a>
        </div>
      `;
    }

    // Coach message
    const coachText = s.coaches?.[0]?.text || '👁 Watching for tips...';

    // Room heat (passed through from background state if available)
    const heatState = s.roomHeat || null;
    let heatHTML = '';
    if (heatState) {
      heatHTML = `<div id="heat" style="background:${heatState.bg};border:1px solid ${heatState.border};">
        <span style="color:${heatState.color};">${heatState.emoji}</span>
        <span class="heat-label" style="color:${heatState.color};">${heatState.label}</span>
        <span class="heat-dir" style="color:${heatState.directionColor};">${heatState.directionLabel}</span>
      </div>`;
    }

    // Stats
    const usd      = '$' + (s.usd    || 0).toFixed(2);
    const tokens   = (s.tokens || 0).toLocaleString();
    const tipCount = (s.tips   || []).length;

    // Tips — mark whales
    const whaleSet = new Set((s.whales || []).map(w => w.username.toLowerCase()));
    const tips     = (s.tips   || []).slice(0, 4);
    const tipRows  = tips.length === 0
      ? '<div id="empty">No tips yet this session</div>'
      : tips.map(t => {
          const isW = whaleSet.has((t.username || '').toLowerCase());
          const usdVal = (t.usd || t.tokens * 0.05).toFixed(2);
          return `<div class="tr${isW ? ' whale' : ''}">
            <span class="tu">${_esc(t.username)}</span>
            <span class="tt">${t.tokens}t</span>
            <span class="td">$${usdVal}</span>
          </div>`;
        }).join('');

    return hdr + `
      <div id="body">
        <div id="coach">${_esc(coachText)}</div>
        ${heatHTML}
        <div id="stats">
          <div class="st"><div class="stl">Revenue</div><div class="stv g">${usd}</div></div>
          <div class="st"><div class="stl">Tokens</div><div class="stv c">${tokens}</div></div>
          <div class="st"><div class="stl">Tips</div><div class="stv o">${tipCount}</div></div>
        </div>
        <div id="tips">${tipRows}</div>
      </div>
      <div id="foot">
        <a class="dashbtn" href="https://www.camcashgrl.com/dashboard" target="_blank">📊 Open Dashboard →</a>
      </div>
    `;
  }

  // ─── Bind events (called after each render) ───────────────────────────────
  function _bindEvents() {
    // Toggle collapse
    const tbtn = _shadow.getElementById('tbtn');
    if (tbtn) {
      tbtn.onclick = () => {
        _collapsed = !_collapsed;
        localStorage.setItem('_cc_col', _collapsed ? '1' : '0');
        const panel = _shadow.getElementById('panel');
        if (panel) panel.classList.toggle('collapsed', _collapsed);
        tbtn.textContent = _collapsed ? '▲' : '▼';
      };
    }

    // Drag — use pointer capture so events aren't stolen by the page
    const hdr = _shadow.getElementById('hdr');
    if (hdr) {
      hdr.onpointerdown = (e) => {
        if (e.target.id === 'tbtn') return;
        _dragging = true;
        _dragSX = e.clientX;
        _dragSY = e.clientY;
        _dragOX = parseInt(_host.style.left) || 0;
        _dragOY = parseInt(_host.style.top)  || 0;
        hdr.setPointerCapture(e.pointerId);
        e.preventDefault();
      };
      hdr.onpointermove = (e) => {
        if (!_dragging) return;
        const nx = _dragOX + (e.clientX - _dragSX);
        const ny = _dragOY + (e.clientY - _dragSY);
        _host.style.left = nx + 'px';
        _host.style.top  = ny + 'px';
        _savePos(nx, ny);
      };
      hdr.onpointerup = () => { _dragging = false; };
      hdr.onpointercancel = () => { _dragging = false; };
    }
  }

  // ─── Create overlay (first call only) ─────────────────────────────────────
  function _create() {
    if (_host) return;

    _host = document.createElement('div');
    _host.style.cssText = 'position:fixed;z-index:2147483647;';

    const pos = _loadPos() || _defaultPos();
    _host.style.left = pos.x + 'px';
    _host.style.top  = pos.y + 'px';

    _shadow = _host.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = _css();
    _shadow.appendChild(styleEl);

    const panel = document.createElement('div');
    panel.id = 'panel';
    if (_collapsed) panel.classList.add('collapsed');
    _shadow.appendChild(panel);

    document.body.appendChild(_host);
    _render();
  }

  // ─── Render / update ──────────────────────────────────────────────────────
  function _render() {
    if (!_shadow) return;
    const panel = _shadow.getElementById('panel');
    if (!panel) return;

    const wasCollapsed = panel.classList.contains('collapsed');
    panel.innerHTML = _panelHTML();
    if (wasCollapsed) panel.classList.add('collapsed');

    _bindEvents();
  }

  // ─── Public update — called when background sends new state ───────────────
  function _update(state) {
    _state = state;
    if (!_host) { _create(); } else { _render(); }
  }

  // ─── Listen for background broadcasts ─────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'overlay_state' && msg.state) _update(msg.state);
    return false;
  });

  // ─── Initial state fetch ──────────────────────────────────────────────────
  // Create immediately with loading state, then update with real state
  _create();
  setTimeout(() => {
    chrome.runtime.sendMessage({ action: 'get_state' }, (state) => {
      if (chrome.runtime.lastError) return;
      _update(state || { authed: false });
    });
  }, 1000);

})();

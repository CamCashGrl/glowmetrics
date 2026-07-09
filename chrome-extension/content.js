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

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKEN ACTIVITY TABLE SCAN — reads the "Your Account's Activity" table on
  // Chaturbate's own token history page (?tab=tokens). This is DOM reading of
  // content already rendered on a page the user is logged into and viewing —
  // same category as the live chat-tip parser above, not automated fetching
  // of anything, no requests to chaturbate.com beyond what the browser
  // already made to load the page the user navigated to.
  //
  // Platform-specific: only Chaturbate's activity table is known to render
  // this way. BongaCams/MyFreeCams need their own investigation before
  // extending this — do not assume the same selectors apply.
  // ═══════════════════════════════════════════════════════════════════════════

  function isChaturbateTokensPage() {
    return platform === 'chaturbate' && /[?&]tab=tokens/.test(location.search);
  }

  // Parses one <tr> from the activity table into a structured row.
  // Returns null for rows that don't match the expected shape (defensive —
  // a partial/garbled row should be skipped, never guessed at).
  function parseActivityRow(tr) {
    const cells = tr.querySelectorAll('td');
    if (cells.length < 4) return null;

    const [dateCell, actionCell, tokensCell] = cells;
    const dateText   = dateCell.textContent.trim();
    const actionText = actionCell.textContent.trim();
    const tokensText = tokensCell.textContent.trim();

    // Direction + username. The action cell's first line is either
    // "Outbound Tip: <username>" or "Tip From: <username>" — everything
    // after is the tip message, which we deliberately do not parse further
    // (message text is not needed and could contain misleading patterns).
    const link = actionCell.querySelector('a');
    const username = link ? link.textContent.trim() : null;

    let direction = null;
    if (/^Outbound Tip:/i.test(actionText)) direction = 'outbound';
    else if (/^Tip From:/i.test(actionText)) direction = 'inbound';
    else return null; // not a tip row (could be a token purchase, refund, etc. — skip)

    if (!username) return null;

    const tokens = parseInt(tokensText.replace(/[^\d-]/g, ''), 10);
    if (isNaN(tokens)) return null;

    // Parse "Jul 7, 2026, 11:43 PM" — Chaturbate's own rendered format.
    // If this ever fails to parse, surface the row as needs-review rather
    // than guessing a timestamp (never fabricate data going into `tips`).
    const parsedDate = new Date(dateText);
    const validDate  = !isNaN(parsedDate.getTime());

    return {
      username,
      tokens: Math.abs(tokens),
      direction, // 'inbound' | 'outbound' — outbound rows are NOT earnings
      timestamp: validDate ? parsedDate.toISOString() : null,
      raw_date_text: dateText, // kept for manual review if timestamp parse failed
      platform: 'chaturbate',
    };
  }

  function findActivityTable() {
    // The activity table is preceded by a heading; walk all tables and
    // match on header cells rather than relying on a specific class name,
    // since Chaturbate's markup for this isn't documented and could change.
    const tables = document.querySelectorAll('table');
    for (const table of tables) {
      const headers = [...table.querySelectorAll('th')].map(th => th.textContent.trim().toLowerCase());
      if (headers.includes('date') && headers.includes('action') && headers.includes('tokens')) {
        return table;
      }
    }
    return null;
  }

  // Clicks the "Load more" button repeatedly until it's gone or stops adding
  // rows. This table paginates via an explicit button, NOT scroll position —
  // confirmed against real page markup. Scrolling alone does nothing here.
  async function expandFullHistory(table) {
    const container = table.closest('[style*="overflow"]') || table.parentElement;
    const maxRounds = 300; // hard ceiling — a very long history is still finite

    let lastRowCount = table.querySelectorAll('tbody tr').length;
    let stableRounds = 0;

    for (let round = 0; round < maxRounds; round++) {
      const loadMoreBtn = container?.querySelector('.loadMoreButton, [data-testid="load-more-stats"]');
      if (!loadMoreBtn) break; // button is gone — fully loaded

      loadMoreBtn.click();
      await new Promise(r => setTimeout(r, 500)); // let the new rows render

      const currentRowCount = table.querySelectorAll('tbody tr').length;
      if (currentRowCount === lastRowCount) {
        stableRounds++;
        if (stableRounds >= 3) break; // clicking isn't adding rows anymore — stop
      } else {
        stableRounds = 0;
      }
      lastRowCount = currentRowCount;
    }
  }

  // Reads the table exactly once, after it's fully expanded — NOT incrementally
  // across multiple passes. A single complete read means no cross-pass
  // duplication is possible, so no content-based dedup key is needed here.
  // This matters: some real tips are genuinely identical (same user, same
  // amount, same minute, sent back-to-back) — deduping by content would
  // silently collapse those into one and undercount real earnings. The
  // existing insert_tips_dedup RPC already handles same-batch repeats
  // correctly via its own ordinality-based tip_seq — we just need to hand
  // it every real row, in order, exactly once.
  function readAllRows(table) {
    const rows = [];
    for (const tr of table.querySelectorAll('tbody tr')) {
      const parsed = parseActivityRow(tr);
      if (parsed) rows.push(parsed);
    }
    return rows;
  }

  // Entry point — called when the user clicks "Scan Token History" in the overlay.
  async function runTokenScan() {
    if (!isChaturbateTokensPage()) {
      return { ok: false, error: 'Navigate to your Chaturbate token history page (Tokens tab) first.' };
    }
    const table = findActivityTable();
    if (!table) {
      return { ok: false, error: 'Could not find the activity table on this page. Chaturbate may have changed their layout.' };
    }
    await expandFullHistory(table);
    const rows = readAllRows(table);
    return { ok: true, rows };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.action === 'run_token_scan') {
      runTokenScan().then(reply);
      return true; // async response
    }
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

  let _host   = null;
  let _shadow = null;
  let _state  = null;

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

  // ─── CSS ─────────────────────────────────────────────────────────────────
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
        cursor: grab;
      }
      #panel:active { cursor: grabbing; }

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

      /* Free plan notice — tips are live-only, not saved to history */
      #planNotice {
        padding: 7px 10px;
        border-radius: 8px;
        font-size: 10px;
        line-height: 1.5;
        background: rgba(245,158,11,0.08);
        border: 1px solid rgba(245,158,11,0.25);
        color: #fbbf24;
      }
      #planNotice a { color: #fbbf24; font-weight: 700; text-decoration: underline; }

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

    const coachText = s.coaches?.[0]?.text || '👁 Watching for tips...';

    const heatState = s.roomHeat || null;
    let heatHTML = '';
    if (heatState) {
      heatHTML = `<div id="heat" style="background:${heatState.bg};border:1px solid ${heatState.border};">
        <span style="color:${heatState.color};">${heatState.emoji}</span>
        <span class="heat-label" style="color:${heatState.color};">${heatState.label}</span>
        <span class="heat-dir" style="color:${heatState.directionColor};">${heatState.directionLabel}</span>
      </div>`;
    }

    const usd      = '$' + (s.usd    || 0).toFixed(2);
    const tokens   = (s.tokens || 0).toLocaleString();
    const tipCount = (s.tips   || []).length;

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

    const planNotice = s.isPro ? '' : `
      <div id="planNotice">
        🔓 Free plan: live coaching + this tip feed, always. Tips aren't saved to
        your permanent history — <a href="https://www.camcashgrl.com/pricing" target="_blank">upgrade to keep them forever →</a>
      </div>
    `;

    const scanBtn = isChaturbateTokensPage()
      ? `<button class="dashbtn" id="scanBtn" style="width:100%;margin-top:6px;border:1px solid rgba(16,185,129,0.4);background:linear-gradient(135deg, rgba(16,185,129,0.25), rgba(16,185,129,0.12));">🔍 Scan Token History</button>`
      : '';

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
        ${planNotice}
      </div>
      <div id="foot">
        <a class="dashbtn" href="https://www.camcashgrl.com/dashboard" target="_blank">📊 Open Dashboard →</a>
        ${scanBtn}
      </div>
    `;
  }

  // ─── Bind events (called after each render) ───────────────────────────────
  function _bindEvents() {
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

    const scanBtn = _shadow.getElementById('scanBtn');
    if (scanBtn) {
      scanBtn.onclick = () => _startScan(scanBtn);
    }

    // Drag — bound to full panel so anywhere is draggable
    const panel = _shadow.getElementById('panel');
    if (panel) {
      panel.onpointerdown = (e) => {
        if (e.target.id === 'tbtn' ||
            e.target.id === 'hidebtn' ||
            e.target.tagName === 'BUTTON' ||
            e.target.tagName === 'A') return;
        _dragging = true;
        _dragSX = e.clientX;
        _dragSY = e.clientY;
        _dragOX = parseInt(_host.style.left) || 0;
        _dragOY = parseInt(_host.style.top)  || 0;
        panel.setPointerCapture(e.pointerId);
        e.preventDefault();
      };
      panel.onpointermove = (e) => {
        if (!_dragging) return;
        const nx = _dragOX + (e.clientX - _dragSX);
        const ny = _dragOY + (e.clientY - _dragSY);
        _host.style.left = nx + 'px';
        _host.style.top  = ny + 'px';
        _savePos(nx, ny);
      };
      panel.onpointerup     = () => { _dragging = false; };
      panel.onpointercancel = () => { _dragging = false; };
    }
  }

  // ─── Scan trigger + preview/confirm modal ──────────────────────────────────
  let _scanModal = null;

  function _startScan(btn) {
    const originalText = btn.textContent;
    btn.textContent = '⏳ Scanning... this can take a minute for long histories';
    btn.disabled = true;

    chrome.runtime.sendMessage({ action: 'scan_token_history' }, (result) => {
      btn.textContent = originalText;
      btn.disabled = false;

      if (chrome.runtime.lastError) {
        _showScanError('Lost connection to the extension. Try reloading the page.');
        return;
      }
      if (!result?.ok) {
        _showScanError(result?.error || 'Scan failed for an unknown reason.');
        return;
      }
      _showScanPreview(result.preview);
    });
  }

  function _closeScanModal() {
    if (_scanModal) { _scanModal.remove(); _scanModal = null; }
  }

  function _showScanError(message) {
    _closeScanModal();
    _scanModal = document.createElement('div');
    _scanModal.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);';
    const shadow = _scanModal.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${_css()}</style>
      <div id="panel" style="width:340px;">
        <div id="hdr"><div id="title">⚠️ Scan couldn't complete</div></div>
        <div id="body">
          <div style="font-size:13px;color:#f1f5f9;line-height:1.5;">${_esc(message)}</div>
        </div>
        <div id="foot"><button class="dashbtn" id="closeBtn">Close</button></div>
      </div>
    `;
    document.body.appendChild(_scanModal);
    shadow.getElementById('closeBtn').onclick = _closeScanModal;
  }

  // Shows the parsed, categorized results for explicit review. Nothing is
  // written to Supabase until the user clicks "Import" here — this is the
  // hard boundary between "read what's on the page" and "change the database."
  function _showScanPreview(preview) {
    _closeScanModal();
    const { inbound, outboundExcluded, needsReview, summary } = preview;

    _scanModal = document.createElement('div');
    _scanModal.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);';
    const shadow = _scanModal.attachShadow({ mode: 'open' });

    const rowsPreviewHTML = inbound.slice(0, 8).map(r => `
      <div class="tr">
        <span class="tu">${_esc(r.username)}</span>
        <span class="tt">${r.tokens}t</span>
        <span class="td">$${r.usd.toFixed(2)}</span>
      </div>
    `).join('') || '<div id="empty">No inbound tips found</div>';

    const moreCount = inbound.length > 8 ? inbound.length - 8 : 0;

    shadow.innerHTML = `
      <style>${_css()}</style>
      <div id="panel" style="width:320px;cursor:default;">
        <div id="hdr"><div id="title">🔍 Scan Results</div></div>
        <div id="body">
          <div style="font-size:12px;color:#94a3b8;line-height:1.6;">
            Found <strong style="color:#10b981;">${summary.inboundCount}</strong> tips worth
            <strong style="color:#10b981;">$${summary.totalUsd.toFixed(2)}</strong>.
            ${summary.outboundExcludedCount > 0 ? `<br/>Excluded ${summary.outboundExcludedCount} outbound tip(s) you sent to others — those aren't your earnings.` : ''}
            ${summary.needsReviewCount > 0 ? `<br/>⚠️ ${summary.needsReviewCount} row(s) couldn't be read reliably and were skipped.` : ''}
          </div>
          <div id="tips">${rowsPreviewHTML}</div>
          ${moreCount > 0 ? `<div style="font-size:11px;color:#475569;text-align:center;">+ ${moreCount} more</div>` : ''}
        </div>
        <div id="foot" style="display:flex;gap:8px;">
          <button class="dashbtn" id="cancelBtn" style="background:transparent;border:1px solid rgba(255,255,255,0.15);">Cancel</button>
          <button class="dashbtn" id="importBtn" ${inbound.length === 0 ? 'disabled' : ''}>Import ${summary.inboundCount} Tips</button>
        </div>
      </div>
    `;
    document.body.appendChild(_scanModal);

    shadow.getElementById('cancelBtn').onclick = _closeScanModal;
    shadow.getElementById('importBtn').onclick = () => {
      const importBtn = shadow.getElementById('importBtn');
      importBtn.textContent = 'Importing...';
      importBtn.disabled = true;

      // Send exactly the rows the user was shown — nothing re-fetched or
      // re-derived at this step.
      chrome.runtime.sendMessage(
        { action: 'confirm_token_import', rows: inbound },
        (result) => {
          if (chrome.runtime.lastError || !result?.ok) {
            _showScanError(result?.error || 'Import failed. Nothing was lost — your scan results are gone, but no data was changed. Try scanning again.');
            return;
          }
          _closeScanModal();
          const { inserted, skipped } = result.result;
          _showScanError(`✅ Imported ${inserted} tip(s). ${skipped > 0 ? `${skipped} were already in your history and skipped.` : ''}`);
        }
      );
    };
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

  function _update(state) {
    _state = state;
    if (!_host) { _create(); } else { _render(); }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'overlay_state' && msg.state) _update(msg.state);
    return false;
  });

  _create();
  setTimeout(() => {
    chrome.runtime.sendMessage({ action: 'get_state' }, (state) => {
      if (chrome.runtime.lastError) return;
      _update(state || { authed: false });
    });
  }, 1000);

})();

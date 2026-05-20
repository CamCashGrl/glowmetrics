// CamCash content script — tip & user detection
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
    // Chaturbate
    '#chat-room-rows',
    '#chat-room-main',
    '.chat_room_messages',
    '[id*="chat"][id*="row"]',
    '[id*="chat"][id*="message"]',
    // BongaCams
    '.chat-messages-list',
    '#chat_messages',
    '.js-chat-messages',
    // MFC
    '#chat_area',
    '.chat-room-content',
    // Generic fallback
    '[class*="chat"][class*="message"]',
    '[class*="chat"][class*="list"]',
  ];

  // ─── State ──────────────────────────────────────────────────────────────────
  let observer = null;
  let seenMessages = new Set();  // deduplicate
  let retryTimer = null;

  // ─── Tip detection ──────────────────────────────────────────────────────────
  function processText(text) {
    if (!text || text.length < 5) return;

    const clean = text.trim().replace(/\s+/g, ' ');
    const key = clean.toLowerCase();
    if (seenMessages.has(key)) return;
    seenMessages.add(key);
    if (seenMessages.size > 500) {
      // Trim oldest
      const arr = [...seenMessages];
      seenMessages = new Set(arr.slice(arr.length - 200));
    }

    // Check tip patterns
    const patterns = TIP_PATTERNS[platform] || TIP_PATTERNS.chaturbate;
    for (const pat of patterns) {
      const m = clean.match(pat);
      if (m) {
        const tokens = parseInt(m[2], 10);
        if (isNaN(tokens) || tokens <= 0) continue;
        chrome.runtime.sendMessage({
          action:   'tip',
          username: m[1].trim(),
          tokens,
          platform,
        });
        return;
      }
    }

    // Check room-entry patterns
    for (const pat of ENTER_PATTERNS) {
      const m = clean.match(pat);
      if (m) {
        chrome.runtime.sendMessage({
          action:   'entered',
          username: m[1].trim(),
        });
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
          if (added.nodeType === Node.ELEMENT_NODE) {
            processText(added.textContent);
          } else if (added.nodeType === Node.TEXT_NODE) {
            processText(added.textContent);
          }
        }
      }
    });

    observer.observe(node, { childList: true, subtree: true });
    chrome.runtime.sendMessage({ action: 'connected' });
    console.log('[CamCash] Observing chat on', platform, node);
  }

  function findAndObserve() {
    // 1. Try known selectors
    for (const sel of CHAT_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) {
        observeNode(el);
        return true;
      }
    }

    // 2. Heuristic: find the tallest scrollable div with "chat" in its id/class
    const candidates = document.querySelectorAll('div[id*="chat"], div[class*="chat"]');
    let best = null;
    let bestH = 0;
    for (const el of candidates) {
      if (el.scrollHeight > bestH) { best = el; bestH = el.scrollHeight; }
    }
    if (best) {
      observeNode(best);
      return true;
    }

    return false;
  }

  // ─── Boot with retry ────────────────────────────────────────────────────────
  function init() {
    if (findAndObserve()) return;

    // Retry every second until chat loads (page may be loading)
    let attempts = 0;
    retryTimer = setInterval(() => {
      attempts++;
      if (findAndObserve() || attempts > 60) {
        clearInterval(retryTimer);
        if (attempts > 60) {
          // Last-resort: observe entire body
          observeNode(document.body);
          console.warn('[CamCash] Fell back to body observation');
        }
      }
    }, 1000);
  }

  // Respond to PING from popup (status badge)
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type === 'PING') {
      reply({ pong: true });
      return true;
    }
  });

  // Re-init if the page navigates (SPA)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      clearInterval(retryTimer);
      setTimeout(init, 1500);
    }
  }).observe(document, { subtree: true, childList: true });

  init();
})();

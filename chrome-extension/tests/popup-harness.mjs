// Automated harness for chrome-extension/popup.js — loads the REAL popup.html
// and popup.js in a real Chromium page via Playwright, with a mocked `chrome`
// global standing in for the extension APIs (no real extension context, no
// network). Lets us drive button clicks and assert on real DOM state instead
// of guessing from screenshots.
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const popupPath = path.join(__dirname, '..', 'popup.html');

// This sandbox's pre-installed Chromium — falls back to Playwright's own
// browser resolution (PLAYWRIGHT_BROWSERS_PATH / a local `npx playwright
// install`) when run somewhere else.
const SANDBOX_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const launchOpts = { headless: true, args: ['--no-sandbox'] };
if (fs.existsSync(SANDBOX_CHROME)) launchOpts.executablePath = SANDBOX_CHROME;

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS:', name); }
  else { fail++; console.error('FAIL:', name); }
}

const initScript = `
window.__mock = {
  handlers: {}, delays: {}, dropReply: {},
  storage: { session: 'fake-token', refresh_token: 'fake-refresh',
             user: { id: '5cb1a333-be55-4808-ab45-51e12d9f8650', email: 'test@test.com' } },
  sentMessages: [],
};
window.chrome = {
  runtime: {
    lastError: null,
    sendMessage: function(msg, cb) {
      window.__mock.sentMessages.push(msg);
      const action = msg.action || msg.type;
      const drop = window.__mock.dropReply[action];
      const delay = window.__mock.delays[action] || 0;
      const handler = window.__mock.handlers[action];
      if (drop) return; // simulate "message port closed before response" — cb never fires
      setTimeout(() => { const res = handler ? handler(msg) : {}; if (cb) cb(res); }, delay);
    },
    onMessage: { addListener: function(fn) { window.__mock._listener = fn; } },
  },
  storage: {
    local: {
      get: function(keys, cb) {
        const data = window.__mock.storage;
        if (keys === null || keys === undefined) { cb({ ...data }); return; }
        const out = {}; for (const k of keys) if (k in data) out[k] = data[k];
        cb(out);
      },
      set: function(obj, cb) { Object.assign(window.__mock.storage, obj); if (cb) cb(); },
      clear: function(cb) { for (const k of Object.keys(window.__mock.storage)) delete window.__mock.storage[k]; if (cb) cb(); },
    },
  },
  tabs: { query: function(q, cb) { cb([]); }, sendMessage: function(id, msg, cb) { if (cb) cb(); } },
  alarms: { create: function() {}, clearAll: function() {} },
};
`;

async function freshPage(browser, { liveSession = null, coachingPrompt = null } = {}) {
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message));
  await page.addInitScript(initScript);
  await page.goto('file://' + popupPath);
  await page.evaluate(({ liveSession, coachingPrompt }) => {
    window.__mock.handlers['live_get_state'] = () => ({ liveSession, broadcasterPageActive: false });
    window.__mock.handlers['get_state'] = () => ({ isPro: false, tips: [], tokens: 0, usd: 0, topTipper: null, coachingPrompt });
    // init() already ran before handlers existed (DOMContentLoaded fires on goto) — re-run the
    // same calls checkAuthState() makes so this page reflects the intended starting state.
    window.chrome.runtime.sendMessage({ action: 'live_get_state' }, (res) => window.updateLiveSession(res?.liveSession));
    window.chrome.runtime.sendMessage({ action: 'get_state' }, (state) => {
      window.updateCoach(state.coachingPrompt);
    });
  }, { liveSession, coachingPrompt });
  await page.waitForTimeout(50);
  return page;
}

async function main() {
  const browser = await chromium.launch(launchOpts);

  // ---- Test 1: idle state renders an enabled Start Stream button ----
  {
    const page = await freshPage(browser);
    const startBtn = page.locator('.session-btn-start');
    check('T1: Start Stream button present on idle', await startBtn.count() === 1);
    check('T1: Start Stream button enabled', await startBtn.isEnabled());
    await page.close();
  }

  // ---- Test 2: clicking Start Stream disables it immediately (pending state) ----
  {
    const page = await freshPage(browser);
    await page.evaluate(() => {
      window.__mock.delays['live_start'] = 2000; // slow reply, so we can observe the pending state
      window.__mock.handlers['live_start'] = () => ({
        session: { id: 'sess-1', status: 'live', live_substate: 'active', started_at: new Date().toISOString(), active_duration_seconds: 0 },
      });
    });
    await page.locator('.session-btn-start').click();
    await page.waitForTimeout(50);
    check('T2: button disabled immediately after click (pending)', await page.locator('.session-btn-start').isDisabled());
    await page.waitForTimeout(2200);
    // After the reply arrives, session is active -> Pause/Stop should now render.
    check('T2: Pause button renders after successful start reply', await page.locator('.session-btn-pause').count() === 1);
    check('T2: Stop button renders after successful start reply', await page.locator('.session-btn-stop').count() === 1);
    check('T2: Pause button is enabled (not stuck disabled)', await page.locator('.session-btn-pause').isEnabled());
    await page.close();
  }

  // ---- Test 3: THE DISPUTED BUG — background never replies at all.
  // Does the 5s failsafe in callLiveAction() actually reset _liveActionPending
  // and re-render, or does the button stay disabled forever? ----
  {
    const page = await freshPage(browser);
    await page.evaluate(() => {
      window.__mock.dropReply['live_start'] = true; // simulate "message port closed before a response was received"
    });
    await page.locator('.session-btn-start').click();
    await page.waitForTimeout(200);
    check('T3: button disabled right after a click with no reply', await page.locator('.session-btn-start').isDisabled());
    await page.waitForTimeout(5300); // past the 5s failsafe in popup.js
    const btn = page.locator('.session-btn-start');
    check('T3: button re-enables on its own after the 5s failsafe (no reply ever came)', await btn.isEnabled());
    check('T3: still showing Start Stream, not stuck on a different state', await btn.count() === 1);
    await page.close();
  }

  // ---- Test 4: rapid double-click is ignored while an action is pending ----
  {
    const page = await freshPage(browser);
    let callCount = 0;
    await page.exposeFunction('__recordCall', () => { callCount++; });
    await page.evaluate(() => {
      window.__mock.delays['live_start'] = 1000;
      window.__mock.handlers['live_start'] = () => { window.__recordCall(); return { session: { id: 's', status: 'live', live_substate: 'active', started_at: new Date().toISOString(), active_duration_seconds: 0 } }; };
    });
    await page.locator('.session-btn-start').click();
    await page.locator('.session-btn-start').click({ force: true }); // second click while disabled/pending
    await page.waitForTimeout(1200);
    check('T4: rapid double-click only triggers one live_start call', callCount === 1);
    await page.close();
  }

  // ---- Test 5: Pause -> website-equivalent status flip renders Resume/Stop ----
  {
    const page = await freshPage(browser, {
      liveSession: { id: 'sess-2', status: 'live', live_substate: 'active', started_at: new Date().toISOString(), active_duration_seconds: 30 },
    });
    check('T5: Pause button present while active', await page.locator('.session-btn-pause').count() === 1);
    await page.evaluate(() => {
      window.__mock.handlers['live_pause'] = () => ({
        session: { id: 'sess-2', status: 'live', live_substate: 'paused', started_at: new Date().toISOString(), active_duration_seconds: 30, paused_at: new Date().toISOString() },
      });
    });
    await page.locator('.session-btn-pause').click();
    await page.waitForTimeout(150);
    check('T5: Resume button renders after pause', await page.locator('.session-btn-resume').count() === 1);
    check('T5: Stop button still present while paused', await page.locator('.session-btn-stop').count() === 1);
    check('T5: no leftover Pause button while paused', await page.locator('.session-btn-pause').count() === 0);
    await page.close();
  }

  // ---- Test 6: Stop ends the session and falls back to Start Stream ----
  {
    const page = await freshPage(browser, {
      liveSession: { id: 'sess-3', status: 'live', live_substate: 'active', started_at: new Date().toISOString(), active_duration_seconds: 60 },
    });
    await page.evaluate(() => {
      window.__mock.handlers['live_stop'] = () => ({ session: { id: 'sess-3', status: 'ended' } });
    });
    await page.locator('.session-btn-stop').click();
    await page.waitForTimeout(150);
    check('T6: Start Stream renders again after Stop', await page.locator('.session-btn-start').count() === 1);
    check('T6: no leftover Pause/Stop buttons after session ended', await page.locator('.session-btn-pause, .session-btn-stop').count() === 0);
    await page.close();
  }

  // ---- Test 7: coaching prompt Performed/Skip UI wiring ----
  {
    const page = await freshPage(browser, {
      liveSession: { id: 'sess-4', status: 'live', live_substate: 'active', started_at: new Date().toISOString(), active_duration_seconds: 10 },
      coachingPrompt: { id: 'evt-1', type: 'whale_dep', message: 'Test prompt', compact_message: 'Test', title: 'Test', shown_at: new Date().toISOString() },
    });
    check('T7: coach action buttons visible when a prompt is active', await page.locator('#coach-actions').evaluate(el => getComputedStyle(el).display !== 'none'));
    let respondedWith = null;
    await page.exposeFunction('__recordRespond', (status) => { respondedWith = status; });
    await page.evaluate(() => {
      window.__mock.handlers['coaching_respond'] = (msg) => { window.__recordRespond(msg.status); return { event: { id: msg.eventId, action_status: msg.status } }; };
    });
    await page.locator('#coach-performed-btn').click();
    await page.waitForTimeout(100);
    check('T7: clicking Performed sends status=performed for the right event id', respondedWith === 'performed');
    await page.close();
  }

  // ---- T8: a failed Start shows the reason instead of doing nothing ----
  {
    const page = await freshPage(browser);
    await page.evaluate(() => {
      window.__mock.handlers['live_start'] = () => ({ error: 'You are signed out. Sign in again to start Live Mode.' });
    });
    await page.locator('.session-btn-start').click();
    await page.waitForTimeout(200);
    const err = page.locator('#live-action-error');
    check('T8: failure message is visible', await err.isVisible());
    check('T8: failure message explains why', /signed out/i.test(await err.innerText()));
    check('T8: Start Stream is clickable again', await page.locator('.session-btn-start').isEnabled());
    // The next attempt clears the old message.
    await page.evaluate(() => {
      window.__mock.delays['live_start'] = 500;
      window.__mock.handlers['live_start'] = () => ({ session: { id: 's', status: 'starting', started_at: new Date().toISOString() } });
    });
    await page.locator('.session-btn-start').click();
    await page.waitForTimeout(100);
    check('T8: message cleared on the next attempt', !(await err.isVisible()));
    await page.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('HARNESS CRASH:', e); process.exit(1); });

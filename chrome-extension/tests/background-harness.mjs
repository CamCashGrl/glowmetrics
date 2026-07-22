// Automated harness for chrome-extension/background.js — runs the REAL,
// unmodified source in a Node vm context with mocked chrome.* APIs and a
// mocked fetch (standing in for the real Supabase/API network calls, which
// this sandbox cannot reach). Captures the registered onMessage/onAlarm
// listeners so we can drive them directly and assert on resulting state,
// broadcasts, and fetch calls — the same things the real extension would do
// when a tip arrives, a heartbeat fires, or the network is flaky.
import vm from 'vm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS:', name); }
  else { fail++; console.error('FAIL:', name); }
}

function makeContext({ initialStorage = {} } = {}) {
  const state = {
    storage: { ...initialStorage },
    broadcasts: [],
    tabMessages: [],
    fetchCalls: [],
    fetchHandler: null, // (url, opts) => { status, json() }
    alarms: {},
    notifications: [],
  };

  const chromeMock = {
    storage: {
      // Real chrome.storage.local supports both callback style and (when the
      // callback is omitted) Promise style — background.js uses `await
      // chrome.storage.local.get([...])` with no callback in several places,
      // so the mock must support both or restore() throws immediately at boot.
      local: {
        get: (keys, cb) => {
          if (typeof keys === 'function') { cb = keys; keys = null; }
          const compute = () => {
            if (keys === null || keys === undefined) return { ...state.storage };
            const arr = Array.isArray(keys) ? keys : [keys];
            const out = {};
            for (const k of arr) if (k in state.storage) out[k] = state.storage[k];
            return out;
          };
          if (cb) { cb(compute()); return undefined; }
          return Promise.resolve(compute());
        },
        set: (obj, cb) => {
          Object.assign(state.storage, obj);
          if (cb) { cb(); return undefined; }
          return Promise.resolve();
        },
        remove: (keys, cb) => {
          const arr = Array.isArray(keys) ? keys : [keys];
          for (const k of arr) delete state.storage[k];
          if (cb) { cb(); return undefined; }
          return Promise.resolve();
        },
        clear: (cb) => {
          for (const k of Object.keys(state.storage)) delete state.storage[k];
          if (cb) { cb(); return undefined; }
          return Promise.resolve();
        },
      },
    },
    runtime: {
      lastError: null,
      onMessage: { addListener: (fn) => { state.onMessage = fn; } },
      sendMessage: (msg) => { state.broadcasts.push(msg); return Promise.resolve(); },
      onInstalled: { addListener: () => {} },
    },
    alarms: {
      create: (name, opts) => { state.alarms[name] = opts; },
      clearAll: () => { state.alarms = {}; },
      onAlarm: { addListener: (fn) => { state.onAlarm = fn; } },
    },
    tabs: {
      query: (q, cb) => cb([]),
      sendMessage: (id, msg) => { state.tabMessages.push({ id, msg }); return Promise.resolve(); },
      onRemoved: { addListener: (fn) => { state.onTabRemoved = fn; } },
    },
    notifications: {
      create: (id, opts) => { state.notifications.push({ id, opts }); },
    },
  };

  const fakeFetch = async (url, opts) => {
    state.fetchCalls.push({ url, opts });
    if (state.fetchHandler) return state.fetchHandler(url, opts);
    return { ok: false, status: 500, json: async () => ({ error: 'no handler configured' }), text: async () => 'no handler' };
  };

  const sandbox = {
    chrome: chromeMock,
    fetch: fakeFetch,
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Date,
    __state: state,
  };
  vm.createContext(sandbox);
  return { sandbox, state };
}

function loadBackground(sandbox) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  vm.runInContext(src, sandbox, { filename: 'background.js' });
}

async function tick(ms = 10) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  // ---- Test 1: boot with a stored session restores auth, doesn't crash ----
  {
    const { sandbox, state } = makeContext({
      initialStorage: { session: 'fake-token', user: { id: 'u1', email: 'test@test.com' }, _bg_whales: [] },
    });
    state.fetchHandler = (url) => {
      if (url.includes('/rest/v1/profiles')) return { ok: true, json: async () => [{ plan: 'free' }] };
      if (url.includes('/rest/v1/tips')) return { ok: true, json: async () => [] };
      if (url.includes('/api/live/session')) return { ok: true, json: async () => ({ session: null }) };
      return { ok: true, json: async () => ({}) };
    };
    loadBackground(sandbox);
    await tick(30);
    check('T1: boot does not throw with a stored session', true);
    check('T1: onMessage listener registered', typeof state.onMessage === 'function');
    check('T1: onAlarm listener registered', typeof state.onAlarm === 'function');
  }

  // ---- Test 2: mocked tip event accumulates local state and syncs to server ----
  {
    const { sandbox, state } = makeContext({ initialStorage: { session: 'fake-token', user: { id: 'u1', email: 'test@test.com' } } });
    state.fetchHandler = (url) => {
      if (url.includes('/api/live/tips')) return { ok: true, json: async () => ({ success: true, savedToHistory: false }) };
      if (url.includes('/rest/v1/profiles')) return { ok: true, json: async () => [{ plan: 'free' }] };
      if (url.includes('/rest/v1/tips')) return { ok: true, json: async () => [] };
      if (url.includes('/api/live/session')) return { ok: true, json: async () => ({ session: null }) };
      return { ok: true, json: async () => ({}) };
    };
    loadBackground(sandbox);
    await tick(30);

    let replyValue;
    state.onMessage({ action: 'tip', username: 'Alice', tokens: 50, platform: 'chaturbate' }, {}, (r) => { replyValue = r; });
    await tick(30);

    const getStateReply = await new Promise((resolve) => state.onMessage({ action: 'get_state' }, {}, resolve));
    check('T2: tip is added to sessionTips', getStateReply.tips.length === 1 && getStateReply.tips[0].username === 'Alice');
    check('T2: sessionTokens incremented by tip amount', getStateReply.tokens === 50);
    check('T2: sessionUsd computed at chaturbate rate (0.05/token)', Math.abs(getStateReply.usd - 2.5) < 0.001);
    check('T2: topTipper set to the only tipper', getStateReply.topTipper?.username === 'Alice');
    const tipPost = state.fetchCalls.find(c => c.url.includes('/api/live/tips'));
    check('T2: tip was actually POSTed to /api/live/tips (real sync attempted)', !!tipPost && tipPost.opts.method === 'POST');
    check('T2: state broadcast fired after tip', state.broadcasts.some(b => b.action === 'state'));
  }

  // ---- Test 3: tip sync failure (network down) doesn't crash background.js ----
  {
    const { sandbox, state } = makeContext({ initialStorage: { session: 'fake-token', user: { id: 'u1', email: 'test@test.com' } } });
    state.fetchHandler = (url) => {
      if (url.includes('/api/live/tips')) throw new Error('Failed to fetch');
      if (url.includes('/rest/v1/profiles')) return { ok: true, json: async () => [{ plan: 'free' }] };
      if (url.includes('/rest/v1/tips')) return { ok: true, json: async () => [] };
      if (url.includes('/api/live/session')) return { ok: true, json: async () => ({ session: null }) };
      return { ok: true, json: async () => ({}) };
    };
    loadBackground(sandbox);
    await tick(30);
    let threw = false;
    try {
      state.onMessage({ action: 'tip', username: 'Bob', tokens: 10, platform: 'chaturbate' }, {}, () => {});
      await tick(30);
    } catch (e) { threw = true; }
    check('T3: a failed tip sync (network error) does not crash the extension', !threw);
    const getStateReply = await new Promise((resolve) => state.onMessage({ action: 'get_state' }, {}, resolve));
    check('T3: tip still recorded locally even though server sync failed', getStateReply.tips.length === 1);
  }

  // ---- Test 4: live_start / live_pause / live_resume / live_stop lifecycle ----
  {
    const { sandbox, state } = makeContext({ initialStorage: { session: 'fake-token', user: { id: 'u1', email: 'test@test.com' } } });
    let currentStatus = null;
    state.fetchHandler = (url, opts) => {
      if (url.includes('/api/live/session/start')) { currentStatus = 'active'; return { ok: true, json: async () => ({ session: { id: 's1', status: 'active' } }) }; }
      if (url.includes('/api/live/session/pause')) { currentStatus = 'paused'; return { ok: true, json: async () => ({ session: { id: 's1', status: 'paused' } }) }; }
      if (url.includes('/api/live/session/resume')) { currentStatus = 'active'; return { ok: true, json: async () => ({ session: { id: 's1', status: 'active' } }) }; }
      if (url.includes('/api/live/session/stop')) { currentStatus = 'ended'; return { ok: true, json: async () => ({ session: { id: 's1', status: 'ended' } }) }; }
      if (url.includes('/api/live/session') && !url.includes('/start') && !url.includes('/pause') && !url.includes('/resume') && !url.includes('/stop')) {
        return { ok: true, json: async () => ({ session: null }) };
      }
      if (url.includes('/rest/v1/profiles')) return { ok: true, json: async () => [{ plan: 'free' }] };
      if (url.includes('/rest/v1/tips')) return { ok: true, json: async () => [] };
      if (url.includes('/api/live/coaching')) return { ok: true, json: async () => ({ prompt: null }) };
      return { ok: true, json: async () => ({}) };
    };
    loadBackground(sandbox);
    await tick(30);

    const startRes = await new Promise((resolve) => state.onMessage({ action: 'live_start', platform: 'chaturbate' }, {}, resolve));
    check('T4: live_start returns the new active session', startRes?.session?.status === 'active');

    const pauseRes = await new Promise((resolve) => state.onMessage({ action: 'live_pause' }, {}, resolve));
    check('T4: live_pause returns a paused session', pauseRes?.session?.status === 'paused');

    const resumeRes = await new Promise((resolve) => state.onMessage({ action: 'live_resume' }, {}, resolve));
    check('T4: live_resume returns an active session again', resumeRes?.session?.status === 'active');

    const stopRes = await new Promise((resolve) => state.onMessage({ action: 'live_stop' }, {}, resolve));
    check('T4: live_stop returns an ended session', stopRes?.session?.status === 'ended');

    const afterStop = await new Promise((resolve) => state.onMessage({ action: 'live_get_state' }, {}, resolve));
    check('T4: after stop, extension no longer tracks a live session (liveSession cleared to null)', afterStop.liveSession === null);
  }

  // ---- Test 5: heartbeat alarm fires session heartbeat + coaching fetch only while a session is active ----
  {
    const { sandbox, state } = makeContext({ initialStorage: { session: 'fake-token', user: { id: 'u1', email: 'test@test.com' } } });
    state.fetchHandler = (url) => {
      if (url.includes('/api/live/session/start')) return { ok: true, json: async () => ({ session: { id: 's1', status: 'active' } }) };
      if (url.includes('/api/live/session/extension-heartbeat')) return { ok: true, json: async () => ({ session: { id: 's1', status: 'active' } }) };
      if (url.includes('/api/live/coaching')) return { ok: true, json: async () => ({ prompt: { id: 'e1', type: 'goal_hit', message: 'Nice!', compact_message: 'Nice!', title: 'Nice!', shown_at: new Date().toISOString() } }) };
      if (url.includes('/api/live/session') && !url.includes('start')) return { ok: true, json: async () => ({ session: null }) };
      if (url.includes('/rest/v1/profiles')) return { ok: true, json: async () => [{ plan: 'free' }] };
      if (url.includes('/rest/v1/tips')) return { ok: true, json: async () => [] };
      return { ok: true, json: async () => ({}) };
    };
    loadBackground(sandbox);
    await tick(30);
    await new Promise((resolve) => state.onMessage({ action: 'live_start', platform: 'chaturbate' }, {}, resolve));

    await state.onAlarm({ name: 'live_heartbeat' });
    await tick(30);
    check('T5: heartbeat alarm calls extension-heartbeat while a session is active', state.fetchCalls.some(c => c.url.includes('extension-heartbeat')));
    check('T5: heartbeat alarm also fetches the coaching prompt', state.fetchCalls.some(c => c.url.includes('/api/live/coaching')));

    const getStateReply = await new Promise((resolve) => state.onMessage({ action: 'get_state' }, {}, resolve));
    check('T5: coaching prompt from the heartbeat is reflected in state', getStateReply.coachingPrompt?.id === 'e1');
  }

  // ---- Test 6: heartbeat alarm does nothing when there's no active session (no wasted calls) ----
  {
    const { sandbox, state } = makeContext({ initialStorage: { session: 'fake-token', user: { id: 'u1', email: 'test@test.com' } } });
    state.fetchHandler = (url) => {
      if (url.includes('/api/live/session') ) return { ok: true, json: async () => ({ session: null }) };
      if (url.includes('/rest/v1/profiles')) return { ok: true, json: async () => [{ plan: 'free' }] };
      if (url.includes('/rest/v1/tips')) return { ok: true, json: async () => [] };
      return { ok: true, json: async () => ({}) };
    };
    loadBackground(sandbox);
    await tick(30);
    state.fetchCalls.length = 0; // clear boot-time calls
    await state.onAlarm({ name: 'live_heartbeat' });
    await tick(30);
    check('T6: no extension-heartbeat call when there is no active session', !state.fetchCalls.some(c => c.url.includes('extension-heartbeat')));
  }

  // ---- Test 7: coaching_respond message routes to the right RPC-equivalent endpoint ----
  {
    const { sandbox, state } = makeContext({ initialStorage: { session: 'fake-token', user: { id: 'u1', email: 'test@test.com' } } });
    state.fetchHandler = (url, opts) => {
      if (url.includes('/api/live/coaching/respond')) {
        const body = JSON.parse(opts.body);
        return { ok: true, json: async () => ({ event: { id: body.eventId, action_status: body.status } }) };
      }
      if (url.includes('/api/live/session')) return { ok: true, json: async () => ({ session: null }) };
      if (url.includes('/rest/v1/profiles')) return { ok: true, json: async () => [{ plan: 'free' }] };
      if (url.includes('/rest/v1/tips')) return { ok: true, json: async () => [] };
      return { ok: true, json: async () => ({}) };
    };
    loadBackground(sandbox);
    await tick(30);
    const res = await new Promise((resolve) => state.onMessage({ action: 'coaching_respond', eventId: 'evt-9', status: 'skipped' }, {}, resolve));
    check('T7: coaching_respond returns the correct event id and status', res?.event?.id === 'evt-9' && res.event.action_status === 'skipped');
  }

  // ---- Test 8: rapid burst — 30 tips fired back-to-back with no waits between them ----
  {
    const { sandbox, state } = makeContext({ initialStorage: { session: 'fake-token', user: { id: 'u1', email: 'test@test.com' } } });
    state.fetchHandler = (url) => {
      if (url.includes('/api/live/tips')) return { ok: true, json: async () => ({ success: true, savedToHistory: false }) };
      if (url.includes('/rest/v1/profiles')) return { ok: true, json: async () => [{ plan: 'free' }] };
      if (url.includes('/rest/v1/tips')) return { ok: true, json: async () => [] };
      if (url.includes('/api/live/session')) return { ok: true, json: async () => ({ session: null }) };
      return { ok: true, json: async () => ({}) };
    };
    loadBackground(sandbox);
    await tick(30);

    let expectedTokens = 0;
    for (let i = 0; i < 30; i++) {
      const tokens = i + 1;
      expectedTokens += tokens;
      state.onMessage({ action: 'tip', username: `burst${i}`, tokens, platform: 'chaturbate' }, {}, () => {});
    }
    await tick(60);

    const getStateReply = await new Promise((resolve) => state.onMessage({ action: 'get_state' }, {}, resolve));
    check('T8: all 30 rapid-fire tips are counted (sessionTokens sums correctly, no lost updates)', getStateReply.tokens === expectedTokens);
    // get_state deliberately caps the display feed at the 20 most recent (see
    // getState()'s `tips: sessionTips.slice(0, 20)`) — a separate, smaller cap
    // than sessionTips' own 100-item storage limit. Token sums/topTipper below
    // confirm all 30 were actually processed; this only checks the feed cap.
    check('T8: get_state feed is capped at the 20 most recent tips', getStateReply.tips.length === 20);
    check('T8: capped feed still starts with the most recent tip (burst29)', getStateReply.tips[0]?.username === 'burst29');
    check('T8: topTipper is the largest of the burst (burst29, 30 tokens)', getStateReply.topTipper?.username === 'burst29' && getStateReply.topTipper?.tokens === 30);
    const tipPosts = state.fetchCalls.filter(c => c.url.includes('/api/live/tips'));
    check('T8: every one of the 30 tips was POSTed to the server (none silently dropped)', tipPosts.length === 30);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('HARNESS CRASH:', e); process.exit(1); });

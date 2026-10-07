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
      onInstalled: { addListener: (fn) => { state.onInstalled = fn; } },
      getManifest: () => ({ version: '3.0.0-test' }),
    },
    alarms: {
      create: (name, opts) => { state.alarms[name] = opts; },
      clear: (name) => { delete state.alarms[name]; return Promise.resolve(true); },
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

  // Controllable clock: state.advance(ms) moves Date.now()/new Date()
  // forward so retry backoff can be tested without real waiting.
  state.clockOffset = 0;
  state.advance = (ms) => { state.clockOffset += ms; };
  class FakeDate extends Date {
    constructor(...args) { if (args.length === 0) super(Date.now() + state.clockOffset); else super(...args); }
    static now() { return Date.now() + state.clockOffset; }
  }

  const sandbox = {
    chrome: chromeMock,
    fetch: fakeFetch,
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Date: FakeDate,
    crypto: globalThis.crypto,
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
      if (url.includes('/api/live/session/start')) { currentStatus = 'starting'; return { ok: true, json: async () => ({ session: { id: 's1', status: 'starting' } }) }; }
      if (url.includes('/api/live/session/pause')) { currentStatus = 'live'; return { ok: true, json: async () => ({ session: { id: 's1', status: 'live', live_substate: 'paused' } }) }; }
      if (url.includes('/api/live/session/resume')) { currentStatus = 'live'; return { ok: true, json: async () => ({ session: { id: 's1', status: 'live', live_substate: 'active' } }) }; }
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
    check('T4: live_start returns the new session in starting', startRes?.session?.status === 'starting');

    const pauseRes = await new Promise((resolve) => state.onMessage({ action: 'live_pause' }, {}, resolve));
    check('T4: live_pause returns a paused session', pauseRes?.session?.status === 'live' && pauseRes?.session?.live_substate === 'paused');

    const resumeRes = await new Promise((resolve) => state.onMessage({ action: 'live_resume' }, {}, resolve));
    check('T4: live_resume returns an active session again', resumeRes?.session?.status === 'live' && resumeRes?.session?.live_substate === 'active');

    const stopRes = await new Promise((resolve) => state.onMessage({ action: 'live_stop' }, {}, resolve));
    check('T4: live_stop returns an ended session', stopRes?.session?.status === 'ended');

    const afterStop = await new Promise((resolve) => state.onMessage({ action: 'live_get_state' }, {}, resolve));
    check('T4: after stop, extension no longer tracks a live session (liveSession cleared to null)', afterStop.liveSession === null);
  }

  // ---- Test 5: heartbeat alarm fires session heartbeat + coaching fetch only while a session is active ----
  {
    const { sandbox, state } = makeContext({ initialStorage: { session: 'fake-token', user: { id: 'u1', email: 'test@test.com' } } });
    state.fetchHandler = (url) => {
      if (url.includes('/api/live/session/start')) return { ok: true, json: async () => ({ session: { id: 's1', status: 'starting' } }) };
      if (url.includes('/api/live/session/extension-heartbeat')) return { ok: true, json: async () => ({ session: { id: 's1', status: 'live', live_substate: 'active' } }) };
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

  // ---- Test 9: extension discovers a session the WEBSITE started, on the next heartbeat tick ----
  // Regression test for a real bug: the heartbeat alarm only re-synced with
  // the server when liveSession was already truthy, so an extension that
  // booted with no session never learned about one started elsewhere.
  {
    const { sandbox, state } = makeContext({ initialStorage: { session: 'fake-token', user: { id: 'u1', email: 'test@test.com' } } });
    let websiteHasStartedASession = false;
    state.fetchHandler = (url) => {
      if (url.includes('/api/live/session') && !url.includes('start') && !url.includes('heartbeat')) {
        return websiteHasStartedASession
          ? { ok: true, json: async () => ({ session: { id: 'web-started-1', status: 'starting', started_at: new Date().toISOString(), active_duration_seconds: 0 } }) }
          : { ok: true, json: async () => ({ session: null }) };
      }
      if (url.includes('/api/live/session/extension-heartbeat')) {
        return { ok: true, json: async () => ({ session: { id: 'web-started-1', status: 'live', live_substate: 'active', started_at: new Date().toISOString(), active_duration_seconds: 1 } }) };
      }
      if (url.includes('/api/live/coaching')) return { ok: true, json: async () => ({ prompt: null }) };
      if (url.includes('/rest/v1/profiles')) return { ok: true, json: async () => [{ plan: 'free' }] };
      if (url.includes('/rest/v1/tips')) return { ok: true, json: async () => [] };
      return { ok: true, json: async () => ({}) };
    };
    loadBackground(sandbox);
    await tick(30);

    const beforeState = await new Promise((resolve) => state.onMessage({ action: 'live_get_state' }, {}, resolve));
    check('T9: boots with no session tracked (none existed yet)', beforeState.liveSession === null);

    // The website starts a session with the extension already idle and running.
    websiteHasStartedASession = true;
    await state.onAlarm({ name: 'live_heartbeat' });
    await tick(30);

    const afterState = await new Promise((resolve) => state.onMessage({ action: 'live_get_state' }, {}, resolve));
    check('T9: next heartbeat tick discovers the website-started session', afterState.liveSession?.id === 'web-started-1');
    check('T9: discovered session reflects the real status from the server', afterState.liveSession?.status === 'live' && afterState.liveSession?.live_substate === 'active');
  }

  // ══════════════════ Phase 1: persistent tip queue ══════════════════
  const QKEY = '_tip_queue_v1';
  const ALARM = 'tip_queue_flush';
  const AUTH = { session: 'fake-token', refresh_token: 'r1', user: { id: 'u1', email: 'test@test.com' } };
  const ev = () => crypto.randomUUID();
  const baseHandler = (url) => {
    if (url.includes('/rest/v1/profiles')) return { ok: true, json: async () => [{ plan: 'free' }] };
    if (url.includes('/rest/v1/tips')) return { ok: true, json: async () => [] };
    if (url.includes('/api/live/session')) return { ok: true, json: async () => ({ session: null }) };
    if (url.includes('/api/live/coaching')) return { ok: true, json: async () => ({ prompt: null }) };
    return { ok: true, json: async () => ({}) };
  };
  // Stand-in server with the same idempotency contract as persist_extension_tip:
  // one stored row per clientEventId no matter how many times it is sent.
  function makeServer() {
    const server = {
      rows: new Map(),
      posts: [],
      mode: 'ok', // 'ok' | 'offline' | 'lost-response' (committed, reply lost) | HTTP status number
      handle(url, opts) {
        const body = JSON.parse(opts.body);
        server.posts.push({ body, auth: opts.headers.Authorization });
        const mode = typeof server.mode === 'function' ? server.mode(body) : server.mode;
        if (mode === 'offline') throw new Error('Failed to fetch');
        if (typeof mode === 'number') return { ok: false, status: mode, text: async () => `HTTP ${mode}`, json: async () => ({}) };
        const dup = server.rows.has(body.clientEventId);
        if (!dup) server.rows.set(body.clientEventId, body);
        if (mode === 'lost-response') throw new Error('connection reset after the server committed');
        return { ok: true, status: 200, json: async () => ({ success: true, duplicate: dup, savedToHistory: true }) };
      },
    };
    return server;
  }
  function boot(server, storage = AUTH, clockOffsetMs = 0) {
    const ctx = makeContext({ initialStorage: structuredClone(storage) });
    ctx.state.clockOffset = clockOffsetMs;
    ctx.state.fetchHandler = (url, opts) => (url.includes('/api/live/tips') ? server.handle(url, opts) : baseHandler(url));
    loadBackground(ctx.sandbox);
    return ctx;
  }
  const sendTip = (state, msg) => new Promise((resolve) => state.onMessage({ action: 'tip', platform: 'chaturbate', ...msg }, {}, resolve));
  const getState = (state) => new Promise((resolve) => state.onMessage({ action: 'get_state' }, {}, resolve));
  const queueOf = (state) => state.storage[QKEY] || [];
  const fireRetryAlarm = async (state, advanceMs) => { state.advance(advanceMs); await state.onAlarm({ name: ALARM }); await tick(25); };

  // Q1: persisted BEFORE send; payload carries detection identity + time
  {
    const server = makeServer();
    const { state } = boot(server); await tick(30);
    let queuedAtSend = null;
    const realHandle = server.handle;
    server.handle = (url, opts) => {
      const id = JSON.parse(opts.body).clientEventId;
      queuedAtSend = (state.storage[QKEY] || []).some((i) => i.id === id);
      return realHandle(url, opts);
    };
    const id = ev();
    const detectedAt = new Date(Date.now() - 1500).toISOString();
    const reply = await sendTip(state, { username: 'Alice', tokens: 100, clientEventId: id, detectedAt });
    await tick(30);
    const post = server.posts[0]?.body;
    check('Q1: content script gets an ack only once the tip is queued', reply?.queued === true);
    check('Q1: tip was in chrome.storage.local BEFORE the network send', queuedAtSend === true);
    check('Q1: POST carries the content-script clientEventId', post?.clientEventId === id);
    check('Q1: POST carries the original detectedAt (legacy timestamp identical)', post?.detectedAt === detectedAt && post?.timestamp === detectedAt);
    check('Q1: POST reports time spent queued (queuedMs >= 1500)', post?.queuedMs >= 1500);
    check('Q1: synced tip removed from the queue', queueOf(state).length === 0);
    check('Q1: popup tip record marked synced', Object.values(state.storage).some((v) => v && v.amount === 100 && v.synced === true));
  }

  // Q2: the same event delivered twice by content.js -> counted and queued once
  {
    const server = makeServer(); server.mode = 'offline';
    const { state } = boot(server); await tick(30);
    const msg = { username: 'Bob', tokens: 200, clientEventId: ev(), detectedAt: new Date().toISOString() };
    await sendTip(state, msg); await sendTip(state, msg); await tick(30);
    const st = await getState(state);
    check('Q2: re-delivered event counted once in local stats', st.tips.length === 1 && st.tokens === 200);
    check('Q2: re-delivered event queued once', queueOf(state).length === 1);
  }

  // Q3: network outage -> stays queued across attempts, syncs after recovery with the same identity
  {
    const server = makeServer(); server.mode = 'offline';
    const { state } = boot(server); await tick(30);
    const id = ev(); const detectedAt = new Date().toISOString();
    await sendTip(state, { username: 'Carol', tokens: 50, clientEventId: id, detectedAt }); await tick(30);
    const first = queueOf(state)[0];
    check('Q3: offline -> tip stays queued as pending after 1 attempt', first?.status === 'pending' && first?.attempts === 1);
    check('Q3: first retry scheduled ~1s out', first && first.nextAttemptAt - Date.now() > 500);
    check('Q3: wake-up alarm armed for a stopped worker', !!state.alarms[ALARM]);
    for (let i = 0; i < 3; i++) await fireRetryAlarm(state, 60_000);
    check('Q3: still queued after 3 more failed attempts', queueOf(state).length === 1 && queueOf(state)[0].attempts === 4);
    server.mode = 'ok';
    await fireRetryAlarm(state, 600_000);
    const bodies = server.posts.map((p) => p.body);
    check('Q3: after recovery the tip syncs and leaves the queue', queueOf(state).length === 0 && server.rows.size === 1);
    check('Q3: all 5 attempts used the same clientEventId', bodies.length === 5 && new Set(bodies.map((b) => b.clientEventId)).size === 1);
    check('Q3: all attempts kept the original detectedAt', bodies.every((b) => b.detectedAt === detectedAt));
    check('Q3: queuedMs reflects the outage length', bodies.at(-1).queuedMs >= 780_000);
  }

  // Q4: service worker restart -> pending tip survives in storage and is sent by the new worker
  {
    const server = makeServer(); server.mode = 'offline';
    const a = boot(server); await tick(30);
    const id = ev(); const detectedAt = new Date().toISOString();
    await sendTip(a.state, { username: 'Dana', tokens: 30, clientEventId: id, detectedAt }); await tick(30);
    check('Q4: pending before the worker stops', queueOf(a.state).length === 1);
    server.mode = 'ok';
    // New worker: fresh memory, only chrome.storage.local carried over.
    const b = boot(server, a.state.storage, 5_000); await tick(60);
    check('Q4: restarted worker resends the stored tip on boot', server.rows.has(id));
    check('Q4: queue empty after the resend', queueOf(b.state).length === 0);
    check('Q4: resent with the original detectedAt', server.posts.at(-1).body.detectedAt === detectedAt);
  }

  // Q5: which failures retry and which are permanent
  for (const [status, retry] of [[500, true], [503, true], [429, true], [408, true], [400, false], [402, false], [403, false]]) {
    const server = makeServer(); server.mode = status;
    const { state } = boot(server); await tick(30);
    await sendTip(state, { username: `S${status}`, tokens: 10, clientEventId: ev(), detectedAt: new Date().toISOString() }); await tick(30);
    const item = queueOf(state)[0];
    check(`Q5: HTTP ${status} -> ${retry ? 'kept for retry' : 'permanent failure'}`, item?.status === (retry ? 'pending' : 'failed'));
    if (!retry) {
      const n = server.posts.length;
      await fireRetryAlarm(state, 3_600_000);
      check(`Q5: HTTP ${status} is never resent`, server.posts.length === n);
    }
  }

  // Q6: 401 -> refresh token -> same event resent immediately with the new token
  {
    const server = makeServer();
    const { state } = boot(server); await tick(30);
    const realHandle = server.handle;
    server.handle = (url, opts) => {
      if (opts.headers.Authorization !== 'Bearer new-token') {
        server.posts.push({ body: JSON.parse(opts.body), auth: opts.headers.Authorization });
        return { ok: false, status: 401, text: async () => 'expired', json: async () => ({}) };
      }
      return realHandle(url, opts);
    };
    const prev = state.fetchHandler;
    state.fetchHandler = (url, opts) => (url.includes('/auth/v1/token')
      ? { ok: true, json: async () => ({ access_token: 'new-token', refresh_token: 'r2' }) }
      : prev(url, opts));
    const id = ev();
    await sendTip(state, { username: 'Eli', tokens: 40, clientEventId: id, detectedAt: new Date().toISOString() }); await tick(40);
    check('Q6: 401 -> refreshed and synced in the same attempt', server.rows.has(id) && queueOf(state).length === 0);
    check('Q6: resend used the refreshed token', server.posts.at(-1).auth === 'Bearer new-token');
  }

  // Q7: 401 and the refresh also fails -> kept for retry, not dropped
  {
    const server = makeServer(); server.mode = 401;
    const { state } = boot(server); await tick(30);
    const prev = state.fetchHandler;
    state.fetchHandler = (url, opts) => (url.includes('/auth/v1/token') ? { ok: false, status: 400, json: async () => ({}) } : prev(url, opts));
    await sendTip(state, { username: 'Fin', tokens: 40, clientEventId: ev(), detectedAt: new Date().toISOString() }); await tick(40);
    check('Q7: unrecoverable 401 keeps the tip pending', queueOf(state)[0]?.status === 'pending');
  }

  // Q8: a tip queued under one account is never sent with another account's token
  {
    const server = makeServer(); server.mode = 'offline';
    const a = boot(server); await tick(30);
    const id = ev();
    await sendTip(a.state, { username: 'Gia', tokens: 60, clientEventId: id, detectedAt: new Date().toISOString() }); await tick(30);
    server.mode = 'ok';
    const b = boot(server, { ...a.state.storage, session: 'token-u2', user: { id: 'u2', email: 'other@test.com' } }, 600_000); await tick(60);
    check('Q8: other account signed in -> previous account\'s tip not sent', !server.rows.has(id) && queueOf(b.state).length === 1);
    const c = boot(server, { ...b.state.storage, session: 'fake-token', user: { id: 'u1', email: 'test@test.com' } }, 600_000); await tick(60);
    check('Q8: original account signs back in -> tip sent with its own token', server.rows.has(id) && server.posts.at(-1).auth === 'Bearer fake-token' && queueOf(c.state).length === 0);
  }

  // Q9: sign-out keeps unsent tips
  {
    const server = makeServer(); server.mode = 'offline';
    const { state } = boot(server); await tick(30);
    await sendTip(state, { username: 'Hal', tokens: 20, clientEventId: ev(), detectedAt: new Date().toISOString() }); await tick(30);
    await new Promise((resolve) => state.onMessage({ action: 'logout' }, {}, resolve)); await tick(20);
    check('Q9: logout clears the session but keeps the unsent tip', !state.storage.session && queueOf(state).length === 1);
  }

  // Q10: the same clientEventId sent 10 times (server committed, replies lost 9x) -> stored once
  {
    const server = makeServer(); server.mode = 'lost-response';
    const { state } = boot(server); await tick(30);
    const id = ev();
    await sendTip(state, { username: 'Ivy', tokens: 100, clientEventId: id, detectedAt: new Date().toISOString() }); await tick(30);
    for (let i = 0; i < 8; i++) await fireRetryAlarm(state, 600_000);
    server.mode = 'ok';
    await fireRetryAlarm(state, 600_000);
    check('Q10: event sent 10 times, always with the same clientEventId', server.posts.length === 10 && server.posts.every((p) => p.body.clientEventId === id));
    check('Q10: server holds it exactly once', server.rows.size === 1);
    check('Q10: queue empty once a send is confirmed', queueOf(state).length === 0);
  }

  // Q11: capped backoff schedule
  {
    const server = makeServer(); server.mode = 503;
    const { state } = boot(server); await tick(30);
    await sendTip(state, { username: 'Jo', tokens: 10, clientEventId: ev(), detectedAt: new Date().toISOString() }); await tick(30);
    const delays = [];
    for (let i = 0; i < 10; i++) {
      const it = queueOf(state)[0];
      delays.push(it.nextAttemptAt - it.lastAttemptAt);
      await fireRetryAlarm(state, it.nextAttemptAt - Date.now() + 1);
    }
    const expected = [1000, 2000, 5000, 15000, 30000, 60000, 120000, 300000, 300000, 300000];
    check(`Q11: backoff 1s,2s,5s,15s,30s,1m,2m,5m then capped at 5m (got ${delays.join(',')})`, JSON.stringify(delays) === JSON.stringify(expected));
  }

  // Q12: popup Test Tip is acknowledged by the server without saving -> never queued
  {
    const server = makeServer();
    const { state } = boot(server); await tick(30);
    await sendTip(state, { username: 'TestTipper', tokens: 50, isTest: true }); await tick(30);
    check('Q12: Test Tip sent once with isTest and never queued', queueOf(state).length === 0 && server.posts.length === 1 && server.posts[0].body.isTest === true);
  }

  // Q13: offline pauses the whole queue; a server-rejected item doesn't block the rest
  {
    const server = makeServer(); server.mode = 'offline';
    const { state } = boot(server); await tick(30);
    for (const u of ['K1', 'K2', 'K3']) await sendTip(state, { username: u, tokens: 10, clientEventId: ev(), detectedAt: new Date().toISOString() });
    await tick(30);
    check('Q13: while offline only one request is attempted for 3 queued tips', server.posts.length === 1 && queueOf(state).length === 3);

    const s2 = makeServer(); s2.mode = (body) => (body.username === 'Poison' ? 500 : 'ok');
    const b = boot(s2); await tick(30);
    for (const u of ['Poison', 'Ok1', 'Ok2']) await sendTip(b.state, { username: u, tokens: 10, clientEventId: ev(), detectedAt: new Date().toISOString() });
    await tick(40);
    const names = [...s2.rows.values()].map((r) => r.username).sort().join(',');
    check('Q13: a failing 500 item does not block later tips', names === 'Ok1,Ok2' && queueOf(b.state).length === 1 && queueOf(b.state)[0].payload.username === 'Poison');
  }

  // Q14: requested scenario through the real background.js — Alice $5, Bob $10, Bob $10 (separate
  // event), Alice $20; Bob's first send commits but its reply is lost (exact network retry), and
  // content.js re-delivers the second Bob event once.
  {
    const server = makeServer();
    const { state } = boot(server); await tick(30);
    const t0 = Date.now();
    const tips = [['Alice', 100], ['Bob', 200], ['Bob', 200], ['Alice', 400]]
      .map(([username, tokens], i) => ({ username, tokens, clientEventId: ev(), detectedAt: new Date(t0 + i * 1000).toISOString() }));
    await sendTip(state, tips[0]); await tick(25);
    server.mode = 'lost-response';
    await sendTip(state, tips[1]); await tick(25);
    server.mode = 'ok';
    await fireRetryAlarm(state, 5_000); // exact retry of Bob #1
    await sendTip(state, tips[2]); await sendTip(state, tips[2]); // duplicate delivery of Bob #2
    await sendTip(state, tips[3]); await tick(40);
    const rows = [...server.rows.values()];
    const usd = (u) => rows.filter((r) => !u || r.username === u).reduce((s, r) => s + r.amount * 0.05, 0);
    const st = await getState(state);
    check('Q14: 4 real tip events stored', rows.length === 4);
    check('Q14: total $45', Math.abs(usd() - 45) < 1e-9);
    check('Q14: Alice $25', Math.abs(usd('Alice') - 25) < 1e-9);
    check('Q14: Bob $20 (both identical tips)', Math.abs(usd('Bob') - 20) < 1e-9);
    check('Q14: Bob #1 was sent twice (exact retry) yet stored once', server.posts.filter((p) => p.body.clientEventId === tips[1].clientEventId).length === 2);
    check('Q14: local popup totals also $45 over 4 tips', Math.abs(st.usd - 45) < 1e-9 && st.tips.length === 4);
    check('Q14: queue empty', queueOf(state).length === 0);
  }

  // ── Simultaneous multi-platform: each tab's platform is immutable event data ──
  const sendTipFromTab = (state, tabId, msg) =>
    new Promise((resolve) => state.onMessage({ action: 'tip', ...msg }, { tab: { id: tabId } }, resolve));
  const connectTab = (state, tabId, platform) =>
    new Promise((resolve) => { state.onMessage({ action: 'connected', platform }, { tab: { id: tabId } }, resolve); setTimeout(resolve, 5); });
  const PLATFORM_TABS = { chaturbate: 11, bongacams: 22, myfreecams: 33 };
  const postsFor = (server, id) => server.posts.filter((p) => p.body.clientEventId === id).map((p) => p.body);

  async function simultaneous(platforms, label) {
    const server = makeServer();
    const { state } = boot(server); await tick(30);
    for (const pf of platforms) await connectTab(state, PLATFORM_TABS[pf], pf);
    const detectedAt = new Date().toISOString();
    // Same fan, same amount, same detection time on every platform.
    const tips = platforms.map((pf) => ({ platform: pf, username: 'SameFan', tokens: 100, clientEventId: ev(), detectedAt }));
    await Promise.all(tips.map((t) => sendTipFromTab(state, PLATFORM_TABS[t.platform], t)));
    await tick(40);
    const rows = [...server.rows.values()];
    check(`${label}: ${platforms.length} tips stored, none merged across platforms`, rows.length === platforms.length);
    check(`${label}: distinct clientEventIds`, new Set(rows.map((r) => r.clientEventId)).size === platforms.length);
    check(`${label}: every stored tip keeps its originating platform`,
      tips.every((t) => server.rows.get(t.clientEventId)?.platform === t.platform));
    check(`${label}: identical username/amount/detectedAt on different platforms all survive`,
      rows.every((r) => r.username === 'SameFan' && r.amount === 100 && r.detectedAt === detectedAt));
    check(`${label}: queue empty`, queueOf(state).length === 0);
  }

  // M1-M3: Chaturbate + BongaCams, Chaturbate + MyFreeCams, all three at once
  await simultaneous(['chaturbate', 'bongacams'], 'M1 CB+BC');
  await simultaneous(['chaturbate', 'myfreecams'], 'M2 CB+MFC');
  await simultaneous(['chaturbate', 'bongacams', 'myfreecams'], 'M3 all three');

  // M4: outage -> queued; another tab connects (focus / last-connected changes); retries keep each tip's platform
  {
    const server = makeServer(); server.mode = 'offline';
    const { state } = boot(server); await tick(30);
    await connectTab(state, PLATFORM_TABS.chaturbate, 'chaturbate');
    const detectedAt = new Date().toISOString();
    const tips = ['chaturbate', 'bongacams', 'myfreecams'].map((pf) => ({ platform: pf, username: 'Queued', tokens: 40, clientEventId: ev(), detectedAt }));
    await Promise.all(tips.map((t) => sendTipFromTab(state, PLATFORM_TABS[t.platform], t))); await tick(30);
    check('M4: all three queued during outage', queueOf(state).length === 3);
    // The user switches to the MyFreeCams tab, then BongaCams reconnects last.
    await connectTab(state, PLATFORM_TABS.myfreecams, 'myfreecams');
    await connectTab(state, PLATFORM_TABS.bongacams, 'bongacams');
    await fireRetryAlarm(state, 600_000);
    server.mode = 'ok';
    await fireRetryAlarm(state, 600_000);
    check('M4: all three delivered after recovery', tips.every((t) => server.rows.has(t.clientEventId)) && queueOf(state).length === 0);
    check('M4: at least one tip was actually retried after failing',
      tips.some((t) => postsFor(server, t.clientEventId).length >= 2));
    check('M4: every attempt (failed and successful) sent the original platform',
      tips.every((t) => { const ps = postsFor(server, t.clientEventId); return ps.length >= 1 && ps.every((b) => b.platform === t.platform); }));
    check('M4: every attempt resent the original clientEventId and detectedAt',
      tips.every((t) => postsFor(server, t.clientEventId).every((b) => b.clientEventId === t.clientEventId && b.detectedAt === detectedAt)));
  }

  // M5: extension restart with a multi-platform queue -> platforms preserved
  {
    const server = makeServer(); server.mode = 'offline';
    const a = boot(server); await tick(30);
    const detectedAt = new Date().toISOString();
    const tips = ['bongacams', 'myfreecams', 'chaturbate'].map((pf) => ({ platform: pf, username: 'Restart', tokens: 75, clientEventId: ev(), detectedAt }));
    for (const t of tips) await sendTipFromTab(a.state, PLATFORM_TABS[t.platform], t);
    await tick(30);
    server.mode = 'ok';
    // New service worker instance from the persisted storage; last-connected tab is unknown.
    const b = boot(server, { ...a.state.storage }, 600_000); await tick(80);
    check('M5: queue drained after restart', queueOf(b.state).length === 0);
    check('M5: each tip stored with its original platform after restart',
      tips.every((t) => server.rows.get(t.clientEventId)?.platform === t.platform));
  }

  // M6: only the identical immutable event is deduplicated
  {
    const server = makeServer();
    const { state } = boot(server); await tick(30);
    const detectedAt = new Date().toISOString();
    const cb = { platform: 'chaturbate', username: 'Twin', tokens: 50, clientEventId: ev(), detectedAt };
    const mfc = { platform: 'myfreecams', username: 'Twin', tokens: 50, clientEventId: ev(), detectedAt };
    await sendTipFromTab(state, PLATFORM_TABS.chaturbate, cb);
    await sendTipFromTab(state, PLATFORM_TABS.myfreecams, mfc);
    await sendTipFromTab(state, PLATFORM_TABS.chaturbate, cb); // re-delivery of the same event
    await tick(40);
    const st = await getState(state);
    check('M6: same content on two platforms = two events', server.rows.size === 2);
    check('M6: re-delivered identical event counted once locally', st.tips.length === 2);
  }

  // M7: top tipper ranks by USD across platforms (BongaCams tokens are worth half)
  {
    const server = makeServer();
    const { state } = boot(server); await tick(30);
    const detectedAt = new Date().toISOString();
    await sendTipFromTab(state, PLATFORM_TABS.bongacams, { platform: 'bongacams', username: 'BongaBig', tokens: 100, clientEventId: ev(), detectedAt }); // $2.50
    await sendTipFromTab(state, PLATFORM_TABS.chaturbate, { platform: 'chaturbate', username: 'CbSmaller', tokens: 60, clientEventId: ev(), detectedAt }); // $3.00
    await tick(30);
    const st = await getState(state);
    check('M7: top tipper chosen by USD, not raw tokens', st.topTipper?.username === 'CbSmaller');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('HARNESS CRASH:', e); process.exit(1); });

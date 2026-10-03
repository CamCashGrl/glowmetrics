/**
 * @jest-environment node
 *
 * Full Phase 1 chain with no stand-ins for our own code:
 *   real chrome-extension/content.js (jsdom page, real MutationObserver)
 *   -> real chrome-extension/background.js (vm, persistent queue)
 *   -> real app/api/live/tips/route.js
 *   -> real persist_extension_tip on a Postgres copy of the production schema.
 *
 * Needs a disposable Postgres (same one scripts/test-persist-extension-tip.sh
 * uses). Skipped unless PERSIST_TIP_TEST_PGHOST is set, so CI without
 * Postgres reports it as skipped rather than passing it.
 */
jest.mock('next/server', () => ({}))

const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { execFileSync } = require('child_process')
const { JSDOM } = require('jsdom')

const PGHOST = process.env.PERSIST_TIP_TEST_PGHOST
const REPO = path.resolve(__dirname, '../../../../../..')
const FRESH = path.join(REPO, 'glowmetrics_fresh')
const DB = 'cc_phase1_real_chain'
const NEW_EXT_USER = '00000000-0000-0000-0000-0000000000a1'
const OLD_EXT_USER = '00000000-0000-0000-0000-0000000000a2'
const SESSION_ID = '00000000-0000-0000-0000-0000000005a1'
const TOKENS = { 'new-ext-token': NEW_EXT_USER, 'old-ext-token': OLD_EXT_USER }

const pgEnv = () => ({ ...process.env, PGHOST, PGPORT: process.env.PERSIST_TIP_TEST_PGPORT || '5432', PGUSER: process.env.PERSIST_TIP_TEST_PGUSER || 'postgres' })
const psql = (db, args) => execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-qtA', '-d', db, ...args], { env: pgEnv(), stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()
const sql = (q) => psql(DB, ['-c', q])
const lit = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
const num = (v) => (v === null || v === undefined ? 'NULL' : String(Number(v)))

function supabaseMock() {
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: null, error: null }) }
  return {
    auth: {
      getUser: async (token) => (TOKENS[token]
        ? { data: { user: { id: TOKENS[token] } }, error: null }
        : { data: { user: null }, error: new Error('invalid token') }),
    },
    rpc: async (name, p) => {
      if (name !== 'persist_extension_tip') return { data: null, error: null }
      try {
        const out = sql(`SELECT public.persist_extension_tip(${lit(p.p_user_id)}::uuid, ${lit(p.p_client_event_id)}::uuid, ${lit(p.p_deduplication_key)}, ${lit(p.p_username)}, ${num(p.p_tokens)}, ${num(p.p_usd)}, ${lit(p.p_platform)}, ${lit(p.p_event_at)}::timestamptz, ${num(p.p_queued_ms)})`)
        return { data: JSON.parse(out), error: null }
      } catch (e) {
        const message = e.stderr ? e.stderr.toString() : e.message
        return { data: null, error: { code: /PLATFORM_LIMIT/.test(message) ? 'P0001' : 'XX000', message } }
      }
    },
    from: () => chain,
  }
}

async function loadRoutePOST() {
  jest.resetModules()
  jest.doMock('@supabase/supabase-js', () => ({ createClient: () => supabaseMock() }))
  return (await import('../route.js')).POST
}

// Network between the extension and our API, with injectable failures.
function makeNetwork(POST) {
  const net = { mode: 'ok', tipPosts: [] }
  net.fetch = async (url, opts = {}) => {
    if (!url.includes('/api/live/tips')) return { ok: true, status: 200, json: async () => (url.includes('/rest/v1/') ? [] : { session: null, prompt: null }), text: async () => '' }
    const body = JSON.parse(opts.body)
    net.tipPosts.push(body)
    if (net.mode === 'offline') throw new Error('Failed to fetch')
    const auth = opts.headers?.Authorization || opts.headers?.authorization
    const res = await POST({ headers: { get: (h) => (h.toLowerCase() === 'authorization' ? auth : null) }, json: async () => body })
    if (net.mode === 'lost-response') throw new Error('connection reset after the server committed')
    return res
  }
  return net
}

function bootBackground(net, storage) {
  const state = { storage: { ...storage }, clockOffset: 0 }
  class FakeDate extends Date {
    constructor(...a) { if (a.length === 0) super(Date.now() + state.clockOffset); else super(...a) }
    static now() { return Date.now() + state.clockOffset }
  }
  const local = {
    get: (keys, cb) => {
      if (typeof keys === 'function') { cb = keys; keys = null }
      const pick = () => {
        if (keys == null) return { ...state.storage }
        const out = {}
        for (const k of (Array.isArray(keys) ? keys : [keys])) if (k in state.storage) out[k] = state.storage[k]
        return out
      }
      if (cb) { cb(pick()); return undefined }
      return Promise.resolve(pick())
    },
    set: (obj, cb) => { Object.assign(state.storage, JSON.parse(JSON.stringify(obj))); if (cb) cb(); return Promise.resolve() },
    remove: (keys, cb) => { for (const k of [].concat(keys)) delete state.storage[k]; if (cb) cb(); return Promise.resolve() },
    clear: (cb) => { state.storage = {}; if (cb) cb(); return Promise.resolve() },
  }
  const sandbox = {
    chrome: {
      storage: { local },
      runtime: {
        lastError: null,
        onMessage: { addListener: (fn) => { state.onMessage = fn } },
        sendMessage: () => Promise.resolve(),
        onInstalled: { addListener: () => {} },
        getManifest: () => ({ version: 'test' }),
      },
      alarms: { create: () => {}, clear: () => Promise.resolve(true), clearAll: () => {}, onAlarm: { addListener: (fn) => { state.onAlarm = fn } } },
      tabs: { query: (q, cb) => (cb ? cb([]) : Promise.resolve([])), sendMessage: () => Promise.resolve(), onRemoved: { addListener: () => {} } },
      notifications: { create: () => {} },
    },
    fetch: net.fetch,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Date: FakeDate,
    crypto: globalThis.crypto,
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(path.join(REPO, 'chrome-extension/background.js'), 'utf8'), sandbox, { filename: 'background.js' })
  return state
}

function loadContentScript(bg) {
  const dom = new JSDOM('<!doctype html><html><body><div id="chat_area"></div></body></html>', {
    url: 'https://chaturbate.com/testroom/', runScripts: 'outside-only',
  })
  const w = dom.window
  w.chrome = {
    runtime: {
      lastError: null,
      // Real extension messaging: content.js -> background.js onMessage.
      sendMessage: (msg, cb) => {
        const replied = new Promise((resolve) => { if (bg.onMessage(msg, { tab: { id: 1 } }, resolve) !== true) resolve(undefined) })
        if (cb) replied.then((r) => cb(r))
      },
      onMessage: { addListener: () => {} },
    },
  }
  w.eval(fs.readFileSync(path.join(REPO, 'chrome-extension/content.js'), 'utf8'))
  return w
}

const settle = (ms = 40) => new Promise((r) => setTimeout(r, ms))
async function waitFor(fn, ms = 4000) {
  const start = Date.now()
  while (!fn()) {
    if (Date.now() - start > ms) throw new Error('timed out waiting for condition')
    await settle(20)
  }
}

const maybe = PGHOST ? describe : describe.skip

maybe('Phase 1 real chain: content.js -> background.js -> route.js -> Postgres', () => {
  let POST, net, bg, page

  beforeAll(async () => {
    psql('postgres', ['-c', `DROP DATABASE IF EXISTS ${DB}`])
    psql('postgres', ['-c', `CREATE DATABASE ${DB}`])
    for (const f of [
      'supabase/tests/fixtures/prod_live_tips_schema.sql',
      'supabase/migrations/20261003_add_client_event_id_for_extension_idempotency.sql',
      'supabase/migrations/20261003_add_persist_extension_tip_rpc.sql',
    ]) psql(DB, ['-f', path.join(FRESH, f)])
    sql(`INSERT INTO profiles VALUES ('${NEW_EXT_USER}','free',NULL), ('${OLD_EXT_USER}','free',NULL)`)
    sql(`INSERT INTO live_sessions (id, user_id, status, started_at) VALUES ('${SESSION_ID}','${NEW_EXT_USER}','active', now() - interval '10 minutes')`)

    POST = await loadRoutePOST()
    net = makeNetwork(POST)
    bg = bootBackground(net, { session: 'new-ext-token', refresh_token: 'r', user: { id: NEW_EXT_USER, email: 'model@test.com' } })
    await settle(50)
    page = loadContentScript(bg)
    await settle(50)
  })

  afterAll(() => {
    if (page) page.close()
    if (PGHOST) psql('postgres', ['-c', `DROP DATABASE IF EXISTS ${DB}`])
  })

  const area = () => page.document.getElementById('chat_area')
  const say = async (text) => { const d = page.document.createElement('div'); d.textContent = text; area().appendChild(d); await settle() }
  const queue = () => bg.storage._tip_queue_v1 || []

  test('Alice $5, Bob $10, Bob $10 again, Alice $20 -> exactly $45, with observer noise and an exact network retry', async () => {
    await say('Alice tipped 100 tokens')
    await waitFor(() => queue().length === 0 && net.tipPosts.length === 1)

    // Bob #1: the server commits it but the reply is lost -> the queue resends the exact same event.
    net.mode = 'lost-response'
    await say('Bob tipped 200 tokens')
    await waitFor(() => net.tipPosts.length === 2)
    await settle()
    expect(queue()).toHaveLength(1)
    net.mode = 'ok'
    bg.clockOffset += 5000
    await bg.onAlarm({ name: 'tip_queue_flush' })
    await waitFor(() => queue().length === 0)

    // Bob #2: a separate real tip with identical text, plus MutationObserver noise.
    await say('viewer1: nice show')
    await say('Bob tipped 200 tokens')
    const lines = area().children
    area().appendChild(lines[1]) // re-attach an already-counted line
    await settle()
    const star = page.document.createElement('span'); star.textContent = ' ★'
    lines[0].appendChild(star) // decoration appended into a counted line
    await settle()

    await say('Alice tipped 400 tokens')
    const last = area().lastChild
    const fresh = page.document.createElement('div'); fresh.textContent = last.textContent
    area().replaceChild(fresh, last) // in-place re-render
    await settle()
    area().innerHTML = area().innerHTML // full chat re-render
    await settle()
    await waitFor(() => queue().length === 0 && net.tipPosts.length === 5)
    await settle(100)

    const q = (s) => sql(s)
    expect(q(`SELECT count(*) FROM tips WHERE user_id='${NEW_EXT_USER}'`)).toBe('4')
    expect(q(`SELECT count(*) FROM live_tips WHERE user_id='${NEW_EXT_USER}'`)).toBe('4')
    expect(q(`SELECT sum(usd)::numeric(10,2) FROM tips WHERE user_id='${NEW_EXT_USER}'`)).toBe('45.00')
    expect(q(`SELECT sum(usd)::numeric(10,2) FROM tips WHERE user_id='${NEW_EXT_USER}' AND username='Alice'`)).toBe('25.00')
    expect(q(`SELECT sum(usd)::numeric(10,2) FROM tips WHERE user_id='${NEW_EXT_USER}' AND username='Bob'`)).toBe('20.00')
    expect(q(`SELECT count(*) FROM tips WHERE user_id='${NEW_EXT_USER}' AND username='Bob'`)).toBe('2')
    expect(q(`SELECT sum(usd)::numeric(10,2) FROM live_tips WHERE user_id='${NEW_EXT_USER}' AND live_session_id='${SESSION_ID}'`)).toBe('45.00')
    expect(q(`SELECT count(DISTINCT client_event_id) FROM tips WHERE user_id='${NEW_EXT_USER}'`)).toBe('4')

    // Bob #1 really was sent twice with one identity, and stored once.
    const bobIds = net.tipPosts.filter((b) => b.username === 'Bob').map((b) => b.clientEventId)
    expect(bobIds).toHaveLength(3)
    expect(new Set(bobIds).size).toBe(2)
  })

  test('an installed old extension (no clientEventId) keeps working alongside the new one', async () => {
    const legacyBody = { username: 'Zed', amount: 50, platform: 'chaturbate', timestamp: new Date().toISOString() }
    const send = () => POST({ headers: { get: (h) => (h === 'authorization' ? 'Bearer old-ext-token' : null) }, json: async () => legacyBody })
    const first = await (await send()).json()
    const resend = await (await send()).json() // old extension's identical 401-retry resend
    expect(first.success).toBe(true)
    expect(resend.duplicate).toBe(true)
    expect(sql(`SELECT count(*) FROM tips WHERE user_id='${OLD_EXT_USER}'`)).toBe('1')
    expect(sql(`SELECT count(*) FROM live_tips WHERE user_id='${OLD_EXT_USER}' AND deduplication_key IS NOT NULL`)).toBe('1')
    expect(sql(`SELECT sum(usd)::numeric(10,2) FROM tips WHERE user_id='${OLD_EXT_USER}'`)).toBe('2.50')
  })
})

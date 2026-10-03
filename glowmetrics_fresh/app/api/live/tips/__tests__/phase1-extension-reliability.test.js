/**
 * @jest-environment node
 *
 * POST /api/live/tips — old + new extension payload compatibility.
 *
 * These tests cover the ROUTE: which idempotency identity it hands to
 * persist_extension_tip and how it maps results. The database behavior
 * (exactly-once rows, Pro mirror trigger, atomicity, concurrency) is covered
 * against a real Postgres by scripts/test-persist-extension-tip.sh.
 */
jest.mock('next/server', () => ({}))

import { legacyDeduplicationKey, uuidV5, isUuid } from '../../../../../lib/liveTips/legacyEventId'

const USER_ID = 'user-123'
const OLD_EXT_TS = '2026-10-03T20:00:00.123Z'

let rpcCalls
let rpcImpl

function chain(result) {
  const c = {
    select: () => c, eq: () => c, in: () => c, order: () => c, limit: () => c,
    maybeSingle: async () => result,
  }
  return c
}

function mockClient() {
  return {
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: USER_ID } }, error: null })) },
    from: jest.fn(() => chain({ data: { id: 'live-tip-1' }, error: null })),
    rpc: jest.fn(async (name, params) => {
      if (name !== 'persist_extension_tip') return { data: null, error: null }
      rpcCalls.push(params)
      return rpcImpl(params)
    }),
  }
}

async function post(body, headers = { authorization: 'Bearer t' }) {
  jest.resetModules()
  jest.doMock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => mockClient()) }))
  const { POST } = await import('../route.js')
  const res = await POST({
    headers: { get: (h) => headers[h] ?? null },
    json: async () => body,
  })
  return { status: res.status ?? 200, body: await res.json() }
}

// Exact payload shape sent by the installed (pre-Phase-1) extension's syncTip().
const oldExtensionPayload = (overrides = {}) => ({
  username: 'Alice', amount: 100, platform: 'chaturbate', timestamp: OLD_EXT_TS, ...overrides,
})

beforeEach(() => {
  rpcCalls = []
  const seen = new Map()
  // Minimal stand-in for the RPC's idempotency: same event id -> duplicate.
  rpcImpl = async (p) => {
    const dup = seen.has(p.p_client_event_id)
    if (!dup) seen.set(p.p_client_event_id, `live-${seen.size + 1}`)
    return {
      data: { success: true, duplicate: dup, live_tip_id: seen.get(p.p_client_event_id), client_event_id: p.p_client_event_id, live_session_id: 'session-1' },
      error: null,
    }
  }
})

describe('legacy event id derivation', () => {
  test('uuidV5 matches the RFC 4122 reference vector', () => {
    expect(uuidV5('python.org', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe('886313e1-3b8a-5372-9b90-0c9aee199e5d')
  })

  test('legacy key is byte-identical to the pre-Phase-1 route format', () => {
    expect(legacyDeduplicationKey('u1', ' Alice ', 100, 'Chaturbate', OLD_EXT_TS))
      .toBe(`u1-alice-100-chaturbate-${Date.parse(OLD_EXT_TS)}`)
  })

  test('same key -> same id; different millisecond -> different id', () => {
    const a = uuidV5(legacyDeduplicationKey('u1', 'Alice', 100, 'chaturbate', OLD_EXT_TS))
    const b = uuidV5(legacyDeduplicationKey('u1', 'Alice', 100, 'chaturbate', OLD_EXT_TS))
    const c = uuidV5(legacyDeduplicationKey('u1', 'Alice', 100, 'chaturbate', '2026-10-03T20:00:00.124Z'))
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(isUuid(a)).toBe(true)
  })
})

describe('old extension payload (no clientEventId)', () => {
  test('1. is accepted and persisted with a deterministic id + legacy key', async () => {
    const { status, body } = await post(oldExtensionPayload())
    expect(status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.savedToHistory).toBe(true)
    const p = rpcCalls[0]
    expect(p.p_user_id).toBe(USER_ID)
    expect(p.p_deduplication_key).toBe(`${USER_ID}-alice-100-chaturbate-${Date.parse(OLD_EXT_TS)}`)
    expect(p.p_client_event_id).toBe(uuidV5(p.p_deduplication_key))
    expect(p.p_event_at).toBe(OLD_EXT_TS)
    expect(p.p_usd).toBe(5)
  })

  test('2. exact retry of the same old payload resolves to the same event (persists once)', async () => {
    const first = await post(oldExtensionPayload())
    const retry = await post(oldExtensionPayload())
    expect(rpcCalls[0].p_client_event_id).toBe(rpcCalls[1].p_client_event_id)
    expect(first.body.duplicate).toBe(false)
    expect(retry.body.duplicate).toBe(true)
    expect(retry.body.success).toBe(true)
  })

  test('3. two identical old-extension tips at different detection times are two events', async () => {
    await post(oldExtensionPayload({ timestamp: '2026-10-03T20:00:00.123Z' }))
    const second = await post(oldExtensionPayload({ timestamp: '2026-10-03T20:00:04.500Z' }))
    expect(rpcCalls[0].p_client_event_id).not.toBe(rpcCalls[1].p_client_event_id)
    expect(second.body.duplicate).toBe(false)
  })

  test('newer source build fields (isTest=false, broadcaster_username) do not change identity', async () => {
    await post(oldExtensionPayload())
    await post(oldExtensionPayload({ isTest: false, broadcaster_username: 'someroom' }))
    expect(rpcCalls[0].p_client_event_id).toBe(rpcCalls[1].p_client_event_id)
  })
})

describe('new extension payload (with clientEventId)', () => {
  const EV = '550e8400-e29b-41d4-a716-446655440000'

  test('4. uses the client id as the idempotency key, no legacy key', async () => {
    const { body } = await post({ username: 'Bob', amount: 200, platform: 'chaturbate', clientEventId: EV, detectedAt: OLD_EXT_TS, timestamp: '2026-10-03T20:05:00Z' })
    expect(body.success).toBe(true)
    expect(rpcCalls[0].p_client_event_id).toBe(EV)
    expect(rpcCalls[0].p_deduplication_key).toBeNull()
    expect(rpcCalls[0].p_event_at).toBe(OLD_EXT_TS)
  })

  test('retry with same clientEventId is a duplicate', async () => {
    await post({ username: 'Bob', amount: 200, platform: 'chaturbate', clientEventId: EV, detectedAt: OLD_EXT_TS })
    const retry = await post({ username: 'Bob', amount: 200, platform: 'chaturbate', clientEventId: EV, detectedAt: OLD_EXT_TS })
    expect(retry.body.duplicate).toBe(true)
  })

  test('non-UUID clientEventId is rejected before any write', async () => {
    const { status } = await post({ username: 'Bob', amount: 200, platform: 'chaturbate', clientEventId: 'abc' })
    expect(status).toBe(400)
    expect(rpcCalls).toHaveLength(0)
  })
})

describe('5. both generations write canonical history through the same RPC', () => {
  test('old and new payloads both report savedToHistory and call persist_extension_tip', async () => {
    const oldRes = await post(oldExtensionPayload())
    const newRes = await post({ username: 'Bob', amount: 200, platform: 'chaturbate', clientEventId: '550e8400-e29b-41d4-a716-446655440001' })
    expect(oldRes.body.savedToHistory).toBe(true)
    expect(newRes.body.savedToHistory).toBe(true)
    expect(rpcCalls).toHaveLength(2)
  })
})

describe('USD uses lib/constants tokenRate (single source of truth)', () => {
  test.each([
    ['chaturbate', 100, 5], ['bongacams', 100, 2.5], ['myfreecams', 100, 5], ['stripchat', 100, 5], ['camsoda', 100, 5],
    ['BongaCams', 3, 0.08],
  ])('%s %i tokens -> $%d', async (platform, amount, usd) => {
    await post(oldExtensionPayload({ platform, amount }))
    expect(rpcCalls[0].p_usd).toBe(usd)
    expect(rpcCalls[0].p_platform).toBe(platform.toLowerCase())
  })
})

describe('validation and error mapping', () => {
  test('missing auth -> 401, no write', async () => {
    const { status } = await post(oldExtensionPayload(), {})
    expect(status).toBe(401)
    expect(rpcCalls).toHaveLength(0)
  })

  test('zero / non-numeric amount -> 400, no write', async () => {
    expect((await post(oldExtensionPayload({ amount: 'abc' }))).status).toBe(400)
    expect(rpcCalls).toHaveLength(0)
  })

  test('unparseable timestamp -> 400, no write', async () => {
    expect((await post(oldExtensionPayload({ timestamp: 'not-a-date' }))).status).toBe(400)
    expect(rpcCalls).toHaveLength(0)
  })

  test('isTest acknowledges without writing', async () => {
    const { body } = await post(oldExtensionPayload({ isTest: true }))
    expect(body.success).toBe(true)
    expect(body.tip).toBeNull()
    expect(rpcCalls).toHaveLength(0)
  })

  test('platform limit from DB -> 402 with upgrade info', async () => {
    rpcImpl = async () => ({ data: null, error: { code: 'P0001', message: 'PLATFORM_LIMIT_REACHED: Free tier tracks up to 3 platforms.' } })
    const { status, body } = await post(oldExtensionPayload({ platform: 'camsoda' }))
    expect(status).toBe(402)
    expect(body.code).toBe('platform_limit_reached')
  })

  test('any other DB error -> 500, never reported as success', async () => {
    rpcImpl = async () => ({ data: null, error: { code: '42703', message: 'boom' } })
    const { status, body } = await post(oldExtensionPayload())
    expect(status).toBe(500)
    expect(body.success).toBeUndefined()
  })
})

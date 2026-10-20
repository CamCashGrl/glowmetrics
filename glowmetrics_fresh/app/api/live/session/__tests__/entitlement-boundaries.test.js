/** @jest-environment node */
jest.mock('next/server', () => ({ NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } }))
const mockRetrieve = jest.fn()
jest.mock('../../../../../lib/stripe', () => ({ stripe: { subscriptions: { retrieve: (...args) => mockRetrieve(...args) } } }))
const mockDb = { from: jest.fn(), rpc: jest.fn() }
jest.mock('../../../../../lib/liveSession/auth', () => ({ getLiveSessionCaller: async () => ({ supabase: mockDb, user: { id: 'creator' } }) }))
const { POST: heartbeat } = require('../heartbeat/route')
const { POST: extensionHeartbeat } = require('../extension-heartbeat/route')
const { POST: start } = require('../start/route')
const request = () => ({ headers: new Map(), json: async () => ({ platform: 'Chaturbate' }) })
let profile, profileError, session
beforeEach(() => {
  jest.clearAllMocks()
  mockRetrieve.mockReset().mockResolvedValue({ id: 'sub_test', status: 'active', customer: 'cus_test' })
  jest.useFakeTimers().setSystemTime(new Date('2026-10-19T12:00:00Z'))
  profile = { plan: 'free', subscription_status: 'none', trial_ends_at: null }
  profileError = null
  session = { id: 's1', started_at: '2026-10-19T11:00:00Z', status: 'live', total_paused_seconds: 0 }
  mockDb.from.mockImplementation(table => {
    const chain = {}
    for (const method of ['select', 'eq', 'in', 'order', 'limit']) chain[method] = () => chain
    chain.maybeSingle = async () => table === 'profiles' ? { data: profile, error: profileError } : { data: null, error: null }
    chain.gte = async () => ({ data: [{ started_at: '2026-10-19T01:00:00Z' }, { started_at: '2026-10-19T02:00:00Z' }], error: null })
    return chain
  })
  mockDb.rpc.mockImplementation(async name => ({ data: name === 'stop_live_session' ? { ...session, status: 'ended' } : session, error: null }))
})
afterEach(() => jest.useRealTimers())
test.each([heartbeat, extensionHeartbeat])('profile lookup error does not stop an existing paid stream', async route => {
  profile = null; profileError = { message: 'billing store unavailable' }
  expect((await route(request())).status).toBe(500)
  expect(mockDb.rpc.mock.calls.some(([name]) => name === 'stop_live_session')).toBe(false)
})
test.each(['none', 'trialing', 'past_due', 'canceled'])('heartbeat enforces duration for %s', async status => {
  profile = { plan: 'pro', subscription_status: status, trial_ends_at: '2026-10-24T12:00:00Z' }
  const response = await heartbeat(request())
  expect(response.body.endedByFreeLimit).toBe(true)
  expect(mockDb.rpc).toHaveBeenCalledWith('stop_live_session')
})
test('active paid Pro is not stopped at the Free timer', async () => {
  profile = { plan: 'pro', subscription_status: 'active', stripe_subscription_id: 'sub_test', stripe_customer_id: 'cus_test' }
  expect((await heartbeat(request())).status).toBe(200)
  expect(mockDb.rpc.mock.calls.some(([name]) => name === 'stop_live_session')).toBe(false)
})
test('third Free start is blocked before invoking start RPC', async () => {
  expect((await start(request())).status).toBe(403)
  expect(mockDb.rpc).not.toHaveBeenCalled()
})
test('a stale active profile without a Stripe subscription must not bypass start limits', async () => {
  profile = { plan: 'pro', subscription_status: 'active', stripe_subscription_id: null }
  expect((await start(request())).status).toBe(403)
})

const activeProfile = () => ({ plan: 'pro', subscription_status: 'active', stripe_subscription_id: 'sub_test', stripe_customer_id: 'cus_test' })

test('authoritative active Stripe subscription bypasses the start cap', async () => {
  profile = activeProfile()
  expect((await start(request())).status).toBe(200)
  expect(mockRetrieve).toHaveBeenCalledWith('sub_test', {}, { timeout: 5000, maxNetworkRetries: 0 })
  expect(mockDb.rpc).toHaveBeenCalledWith('start_live_session', { p_platform: 'Chaturbate' })
})

test.each(['trialing', 'past_due', 'canceled'])('Stripe %s overrides a stale active profile for new starts', async status => {
  profile = activeProfile()
  mockRetrieve.mockResolvedValue({ id: 'sub_test', status, customer: 'cus_test' })
  expect((await start(request())).status).toBe(403)
  expect(mockDb.rpc).not.toHaveBeenCalled()
})

test('an active subscription belonging to a different customer cannot bypass limits', async () => {
  profile = activeProfile()
  mockRetrieve.mockResolvedValue({ id: 'sub_test', status: 'active', customer: 'cus_other' })
  expect((await start(request())).status).toBe(403)
  expect(mockDb.rpc).not.toHaveBeenCalled()
})

test('a deleted Stripe subscription cannot bypass the start cap', async () => {
  profile = activeProfile()
  mockRetrieve.mockRejectedValue({ code: 'resource_missing' })
  expect((await start(request())).status).toBe(403)
  expect(mockDb.rpc).not.toHaveBeenCalled()
})

test('Stripe outage blocks new starts without granting a fresh allowance', async () => {
  profile = activeProfile()
  mockRetrieve.mockRejectedValue(new Error('Stripe unavailable'))
  expect((await start(request())).status).toBe(503)
  expect(mockDb.rpc).not.toHaveBeenCalled()
})

test.each([heartbeat, extensionHeartbeat])('Stripe outage does not stop an existing paid stream', async route => {
  profile = activeProfile()
  mockRetrieve.mockRejectedValue(new Error('Stripe unavailable'))
  expect((await route(request())).status).toBe(503)
  expect(mockDb.rpc.mock.calls.some(([name]) => name === 'stop_live_session')).toBe(false)
})

test.each([heartbeat, extensionHeartbeat])('stale active profile is capped when Stripe reports canceled', async route => {
  profile = activeProfile()
  mockRetrieve.mockResolvedValue({ id: 'sub_test', status: 'canceled', customer: 'cus_test' })
  expect((await route(request())).body.endedByFreeLimit).toBe(true)
  expect(mockDb.rpc).toHaveBeenCalledWith('stop_live_session')
})

test.each([heartbeat, extensionHeartbeat])('stale active profile without a subscription cannot bypass the duration cap', async route => {
  profile = { plan: 'pro', subscription_status: 'active', stripe_subscription_id: null }
  expect((await route(request())).body.endedByFreeLimit).toBe(true)
  expect(mockDb.rpc).toHaveBeenCalledWith('stop_live_session')
  expect(mockRetrieve).not.toHaveBeenCalled()
})

test.each([null, '', 'invalid-date'])('trial expiry %s blocks a NEW start even with no recorded starts', async trialEnd => {
  profile = { plan: 'free', subscription_status: 'trialing', trial_ends_at: trialEnd }
  mockDb.from.mockImplementation(() => {
    const chain = {}
    for (const method of ['select', 'eq', 'in', 'order', 'limit']) chain[method] = () => chain
    chain.maybeSingle = async () => ({ data: profile, error: null })
    chain.gte = async () => ({ data: [], error: null })
    return chain
  })
  // No existing session: reuse the standard first query with an empty result.
  const existingQuery = {}
  for (const method of ['select', 'eq', 'in', 'order', 'limit']) existingQuery[method] = () => existingQuery
  existingQuery.maybeSingle = async () => ({ data: null, error: null })
  mockDb.from.mockImplementationOnce(() => existingQuery)
  const response = await start(request())
  expect(response.status).toBe(403)
  expect(response.body.code).toBe('TRIAL_METADATA_INVALID')
  expect(response.body.allowance.remainingInScope).toBe(0)
  expect(mockDb.rpc).not.toHaveBeenCalled()
})

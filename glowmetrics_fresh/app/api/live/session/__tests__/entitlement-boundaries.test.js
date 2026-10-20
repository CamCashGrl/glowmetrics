/** @jest-environment node */
jest.mock('next/server', () => ({ NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } }))
const mockDb = { from: jest.fn(), rpc: jest.fn() }
jest.mock('../../../../../lib/liveSession/auth', () => ({ getLiveSessionCaller: async () => ({ supabase: mockDb, user: { id: 'creator' } }) }))
const { POST: heartbeat } = require('../heartbeat/route')
const { POST: extensionHeartbeat } = require('../extension-heartbeat/route')
const { POST: start } = require('../start/route')
const request = () => ({ headers: new Map(), json: async () => ({ platform: 'Chaturbate' }) })
let profile, profileError, session
beforeEach(() => {
  jest.clearAllMocks()
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
  profile = { plan: 'pro', subscription_status: 'active' }
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

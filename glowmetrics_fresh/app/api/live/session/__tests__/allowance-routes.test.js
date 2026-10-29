/**
 * @jest-environment node
 */
// The routes are thin relays: the database decides entitlement. These tests
// pin that they pass inputs through untouched, never fill in a platform, and
// surface the database's refusal and allowance state.
jest.mock('../../../../../lib/liveSession/auth', () => ({ getLiveSessionCaller: jest.fn() }))
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { POST as startPOST } from '../start/route'
import { GET as sessionGET } from '../route'
import { POST as privateStartPOST } from '../private/start/route'

const req = (body, headers = {}) => ({ headers: { get: (k) => headers[k.toLowerCase()] ?? null }, json: async () => { if (body === undefined) throw new Error('no body'); return body } })
const pgErr = (message, code = 'P0001') => ({ code, message })
let rpc, from
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  rpc = jest.fn(); from = jest.fn()
  getLiveSessionCaller.mockResolvedValue({ user: { id: 'u1' }, supabase: { rpc, from } })
})
afterEach(() => jest.restoreAllMocks())

describe('POST /api/live/session/start', () => {
  test('passes the platform to the database exactly as received', async () => {
    rpc.mockResolvedValue({ data: { id: 's1', status: 'starting', started_at: new Date().toISOString(), total_paused_seconds: 0 }, error: null })
    const res = await startPOST(req({ platform: 'bongacams' }))
    expect(rpc).toHaveBeenCalledWith('start_live_session', { p_platform: 'bongacams' })
    expect(res.status).toBe(200)
  })
  test('with no platform it sends null (never Chaturbate) and relays the database refusal', async () => {
    rpc.mockResolvedValue({ data: null, error: pgErr('PLATFORM_REQUIRED: x') })
    const res = await startPOST(req(undefined))
    expect(rpc).toHaveBeenCalledWith('start_live_session', { p_platform: null })
    expect(res.status).toBe(400); expect((await res.json()).code).toBe('PLATFORM_REQUIRED')
  })
  test('a non-string platform is sent as null', async () => {
    rpc.mockResolvedValue({ data: null, error: pgErr('PLATFORM_REQUIRED: x') })
    await startPOST(req({ platform: { x: 1 } }))
    expect(rpc).toHaveBeenCalledWith('start_live_session', { p_platform: null })
  })
  test('a weekly-limit refusal carries the database allowance state', async () => {
    const allowance = { lock_reason: 'FREE_LIVE_WEEKLY_LIMIT', week: { starts_used: 2 } }
    rpc.mockImplementation(async (name) => name === 'start_live_session' ? { data: null, error: pgErr('FREE_LIVE_WEEKLY_LIMIT: x') } : { data: allowance, error: null })
    const res = await startPOST(req({ platform: 'Chaturbate' }))
    const body = await res.json()
    expect(res.status).toBe(403); expect(body.code).toBe('FREE_LIVE_WEEKLY_LIMIT'); expect(body.allowance).toEqual(allowance)
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['start_live_session', 'get_live_mode_allowance'])
  })
  test('TIMEZONE_REQUIRED carries allowance state so the UI can prompt', async () => {
    rpc.mockImplementation(async (name) => name === 'start_live_session' ? { data: null, error: pgErr('TIMEZONE_REQUIRED: x') } : { data: { timezone: { required: true } }, error: null })
    const body = await (await startPOST(req({ platform: 'Chaturbate' }))).json()
    expect(body.code).toBe('TIMEZONE_REQUIRED'); expect(body.allowance.timezone.required).toBe(true)
  })
  test('unauthenticated -> 401 and the database is never called', async () => {
    getLiveSessionCaller.mockResolvedValue({ user: null, supabase: { rpc, from } })
    expect((await startPOST(req({ platform: 'Chaturbate' }))).status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })
  test('the route reads no profile, plan, subscription or session table itself', async () => {
    rpc.mockResolvedValue({ data: { id: 's', started_at: new Date().toISOString() }, error: null })
    await startPOST(req({ platform: 'Chaturbate' }))
    expect(from).not.toHaveBeenCalled()
  })
})

describe('GET /api/live/session', () => {
  const chain = (data) => { const c = { select: () => c, eq: () => c, in: () => c, order: () => c, limit: () => c, is: () => c, maybeSingle: async () => ({ data, error: null }) }; return c }
  test('runs the sweep, then returns session + the database allowance state', async () => {
    const allowance = { entitlement: 'capped', week: { starts_used: 1 } }
    rpc.mockImplementation(async (name) => ({ data: name === 'get_live_mode_allowance' ? allowance : null, error: null }))
    from.mockImplementation(() => chain(null))
    const body = await (await sessionGET(req())).json()
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['sweep_stale_live_session', 'get_live_mode_allowance'])
    expect(body.allowance).toEqual(allowance); expect(body.session).toBeNull(); expect(body.serverNow).toBeTruthy()
  })
  test('an allowance failure does not break restoring the session', async () => {
    rpc.mockImplementation(async (name) => name === 'get_live_mode_allowance' ? { data: null, error: { message: 'boom' } } : { data: null, error: null })
    from.mockImplementation(() => chain({ id: 's1', status: 'live', started_at: new Date().toISOString(), total_paused_seconds: 0 }))
    const res = await sessionGET(req())
    const body = await res.json()
    expect(res.status).toBe(200); expect(body.session.id).toBe('s1'); expect(body.allowance).toBeNull()
  })
})

describe('POST /api/live/session/private/start', () => {
  test('passes platform and username through untouched', async () => {
    rpc.mockResolvedValue({ data: { id: 'p1' }, error: null })
    await privateStartPOST(req({ ratePerMinute: 2.5, platform: 'myfreecams', username: '@SomeFan' }))
    expect(rpc).toHaveBeenCalledWith('start_private_interval', { p_rate_per_minute: 2.5, p_platform: 'myfreecams', p_username: '@SomeFan' })
  })
  test('missing platform/username are sent as null, never defaulted', async () => {
    rpc.mockResolvedValue({ data: null, error: pgErr('PLATFORM_REQUIRED: x') })
    const res = await privateStartPOST(req({ ratePerMinute: 2 }))
    expect(rpc).toHaveBeenCalledWith('start_private_interval', { p_rate_per_minute: 2, p_platform: null, p_username: null })
    expect(res.status).toBe(400)
  })
  test('rejects a bad rate before the database', async () => {
    expect((await privateStartPOST(req({ ratePerMinute: -1, platform: 'Chaturbate', username: 'x' }))).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  test('no live session -> a readable 409', async () => {
    rpc.mockResolvedValue({ data: null, error: pgErr('NO_LIVE_SESSION: x', '22023') })
    const res = await privateStartPOST(req({ ratePerMinute: 2, platform: 'Chaturbate', username: 'x' }))
    expect(res.status).toBe(409)
  })
})

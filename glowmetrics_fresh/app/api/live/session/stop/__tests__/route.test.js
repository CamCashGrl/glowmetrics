/**
 * @jest-environment node
 *
 * The user-facing Stop route must finalize through the canonical Phase 2
 * finalize_live_session RPC (never the legacy stop_live_session) and keep
 * the { session, alreadyStopped } response contract the website and
 * extension rely on.
 */
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init) => ({ status: init?.status ?? 200, json: async () => body }),
  },
}))

const ENDED_ROW = {
  id: 'session-1',
  user_id: 'creator-1',
  status: 'ended',
  started_at: '2026-10-07T10:00:00.000Z',
  ended_at: '2026-10-07T11:00:00.000Z',
  paused_at: null,
  total_paused_seconds: 600,
  is_active: false,
  session_resolution_type: 'normal_stop',
  final_tip_count: 2,
  final_total_usd: 75,
  final_tokens: 1500,
  final_unique_tippers: 2,
  final_top_tipper_username: 'tipper_alice',
  final_top_tipper_usd: 50,
  final_largest_tip_usd: 50,
  final_avg_tip_usd: 37.5,
  final_duration_seconds: 3000,
  final_usd_per_hour: 90,
  finalized_at: '2026-10-07T11:00:00.000Z',
}

const NULL_ROW = Object.fromEntries(Object.keys(ENDED_ROW).map((k) => [k, null]))

let state

function makeLookupChain() {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn((col, val) => { state.lookupFilters.push([col, val]); return chain }),
    in: jest.fn((col, vals) => { state.lookupStatuses = vals; return chain }),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => state.lookupResult),
  }
  return chain
}

function mockSupabase() {
  return {
    auth: {
      getUser: jest.fn(async () => (state.user
        ? { data: { user: state.user }, error: null }
        : { data: { user: null }, error: { message: 'invalid' } })),
    },
    from: jest.fn((table) => {
      state.fromCalls.push(table)
      return makeLookupChain()
    }),
    rpc: jest.fn(async (name, params) => {
      state.rpcCalls.push({ name, params })
      return state.rpcResult
    }),
  }
}

function bearerRequest() {
  return { headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) } }
}

beforeEach(() => {
  state = {
    user: { id: 'creator-1' },
    lookupResult: { data: null, error: null },
    lookupFilters: [],
    lookupStatuses: null,
    rpcResult: { data: null, error: null },
    rpcCalls: [],
    fromCalls: [],
  }
  jest.resetModules()
  jest.doMock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => mockSupabase()) }))
  jest.doMock('../../../../../../lib/supabase-server', () => ({ createSupabaseRouteClient: jest.fn() }))
})

test('first Stop finalizes the unresolved session via finalize_live_session and returns final metrics', async () => {
  state.lookupResult = { data: { id: 'session-1' }, error: null }
  state.rpcResult = { data: ENDED_ROW, error: null }
  const { POST } = await import('../route.js')

  const res = await POST(bearerRequest())
  const body = await res.json()

  expect(res.status).toBe(200)
  expect(state.rpcCalls).toEqual([{ name: 'finalize_live_session', params: { p_session_id: 'session-1' } }])
  expect(state.lookupFilters).toContainEqual(['user_id', 'creator-1'])
  expect(state.lookupStatuses).toEqual(['active', 'paused', 'needs_resolution'])
  expect(body.alreadyStopped).toBe(false)
  expect(body.session.id).toBe('session-1')
  expect(body.session.status).toBe('ended')
  expect(body.session.final_tip_count).toBe(2)
  expect(body.session.final_total_usd).toBe(75)
  expect(body.session.finalized_at).toBe(ENDED_ROW.finalized_at)
  expect(Object.keys(body).sort()).toEqual(['alreadyStopped', 'session'])
})

test('repeated Stop returns the same ended session with unchanged metrics and alreadyStopped=true', async () => {
  state.lookupResult = { data: null, error: null }
  state.rpcResult = { data: ENDED_ROW, error: null }
  const { POST } = await import('../route.js')

  const res = await POST(bearerRequest())
  const body = await res.json()

  expect(state.rpcCalls).toEqual([{ name: 'finalize_live_session', params: {} }])
  expect(body.alreadyStopped).toBe(true)
  expect(body.session.id).toBe('session-1')
  for (const key of Object.keys(ENDED_ROW)) {
    expect(body.session[key]).toEqual(ENDED_ROW[key])
  }
})

test('Stop with no session at all returns session=null, never an all-null row', async () => {
  state.rpcResult = { data: NULL_ROW, error: null }
  const { POST } = await import('../route.js')

  const body = await (await POST(bearerRequest())).json()

  expect(body).toEqual({ session: null, alreadyStopped: true })
})

test('never calls the legacy stop_live_session RPC', async () => {
  state.lookupResult = { data: { id: 'session-1' }, error: null }
  state.rpcResult = { data: ENDED_ROW, error: null }
  const { POST } = await import('../route.js')

  await POST(bearerRequest())

  expect(state.rpcCalls.map((c) => c.name)).not.toContain('stop_live_session')
})

test('unauthenticated caller gets 401 and nothing is finalized', async () => {
  state.user = null
  const { POST } = await import('../route.js')

  const res = await POST(bearerRequest())

  expect(res.status).toBe(401)
  expect(state.rpcCalls).toEqual([])
})

test('finalize RPC error is sanitized and not leaked', async () => {
  state.lookupResult = { data: { id: 'session-1' }, error: null }
  state.rpcResult = { data: null, error: { code: 'XX000', message: 'internal detail' } }
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const { POST } = await import('../route.js')

  const res = await POST(bearerRequest())
  const body = await res.json()

  expect(res.status).toBe(500)
  expect(JSON.stringify(body)).not.toContain('internal detail')
})

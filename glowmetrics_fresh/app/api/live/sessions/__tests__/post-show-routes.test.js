/**
 * @jest-environment node
 */
jest.mock('next/server', () => ({
  NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, json: async () => body }) },
}))

const SESSION = {
  id: '11111111-1111-4111-8111-111111111111', user_id: 'creator-1', status: 'ended', stream_platform: 'Chaturbate',
  started_at: '2026-10-07T20:00:00Z', ended_at: '2026-10-07T21:00:00Z', finalized_at: '2026-10-07T21:00:00Z',
  dashboard_seen_at: null, final_total_usd: 82.5, final_public_usd: 62.5, final_private_usd: 20,
  final_private_seconds: 600, final_platform_breakdown: { chaturbate: { usd: 62.5, tips: 3 } },
  final_tokens: 1250, final_tip_count: 3, final_unique_tippers: 2, final_top_tipper_username: 'Alice',
  final_top_tipper_usd: 50, final_largest_tip_usd: 50, final_duration_seconds: 3600, final_usd_per_hour: 82.5,
}
const INTERVAL = { id: 'p1', live_session_id: SESSION.id, platform: 'chaturbate', started_at: '2026-10-07T20:10:00Z', ended_at: '2026-10-07T20:20:00Z', rate_per_minute: 2, estimated_earnings_usd: 20 }

let state
function chain(table) {
  const q = { table, filters: [] }
  const c = {
    select: jest.fn(() => c),
    eq: jest.fn((col, v) => { q.filters.push(['eq', col, v]); return c }),
    not: jest.fn((col, op, v) => { q.filters.push(['not', col, op, v]); return c }),
    in: jest.fn((col, v) => { q.filters.push(['in', col, v]); return c }),
    is: jest.fn(() => c),
    order: jest.fn(() => c),
    limit: jest.fn((n) => { q.limit = n; return c }),
    range: jest.fn((f, t) => { q.range = [f, t]; return c }),
    maybeSingle: jest.fn(async () => state.single[table] ?? { data: null, error: null }),
    then: (resolve) => resolve(state.rows[table] ?? { data: [], error: null }),
  }
  state.queries.push(q)
  return c
}
function mockSupabase() {
  return {
    auth: { getUser: jest.fn(async () => ({ data: { user: state.user }, error: state.user ? null : { message: 'x' } })) },
    from: jest.fn((t) => chain(t)),
    rpc: jest.fn(async (name, params) => { state.rpcCalls.push({ name, params }); return state.rpc[name] ?? { data: null, error: null } }),
  }
}
const req = (url = 'http://x/api', body) => ({
  url,
  headers: { get: (h) => (h === 'authorization' ? 'Bearer t' : null) },
  json: async () => body,
})

beforeEach(() => {
  state = {
    user: { id: 'creator-1' },
    rows: { live_sessions: { data: [SESSION], error: null }, live_private_intervals: { data: [INTERVAL], error: null } },
    single: {},
    rpc: {},
    rpcCalls: [],
    queries: [],
  }
  jest.resetModules()
  jest.doMock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => mockSupabase()) }))
  jest.doMock('../../../../../lib/supabase-server', () => ({ createSupabaseRouteClient: jest.fn() }))
})

describe('GET /api/live/sessions/recent', () => {
  test('returns finalized shows rebuilt from persisted rows, own sessions only', async () => {
    const { GET } = await import('../recent/route.js')
    const res = await GET(req('http://x/api/live/sessions/recent?limit=500'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.shows).toHaveLength(1)
    expect(body.shows[0]).toMatchObject({ id: SESSION.id, totalUsd: 82.5, publicUsd: 62.5, privateUsd: 20, isNew: true })
    expect(body.shows[0].privateIntervals).toHaveLength(1)
    const sessions = state.queries.find((q) => q.table === 'live_sessions')
    expect(sessions.filters).toEqual(expect.arrayContaining([
      ['eq', 'user_id', 'creator-1'], ['eq', 'status', 'ended'], ['not', 'finalized_at', 'is', null],
    ]))
    expect(sessions.limit).toBe(50)
  })

  test('401 without a user', async () => {
    state.user = null
    const { GET } = await import('../recent/route.js')
    expect((await GET(req('http://x/api/live/sessions/recent'))).status).toBe(401)
  })
})

describe('GET /api/live/sessions/private-earnings', () => {
  test('returns closed intervals of finalized shows only, own sessions only', async () => {
    state.rows.live_sessions = { data: [{ id: SESSION.id }], error: null }
    state.rows.live_private_intervals = { data: [INTERVAL], error: null }
    const { GET } = await import('../private-earnings/route.js')
    const res = await GET(req('http://x/api/live/sessions/private-earnings'))
    expect(res.status).toBe(200)
    expect((await res.json()).intervals).toEqual([INTERVAL])
    const sess = state.queries.find((q) => q.table === 'live_sessions')
    expect(sess.filters).toEqual(expect.arrayContaining([['eq', 'user_id', 'creator-1'], ['eq', 'status', 'ended'], ['not', 'finalized_at', 'is', null]]))
    const iv = state.queries.find((q) => q.table === 'live_private_intervals')
    expect(iv.filters).toEqual(expect.arrayContaining([['in', 'live_session_id', [SESSION.id]], ['not', 'ended_at', 'is', null]]))
  })

  test('no finalized shows → empty, no interval query', async () => {
    state.rows.live_sessions = { data: [], error: null }
    const { GET } = await import('../private-earnings/route.js')
    const res = await GET(req('http://x/api/live/sessions/private-earnings'))
    expect((await res.json()).intervals).toEqual([])
    expect(state.queries.some((q) => q.table === 'live_private_intervals')).toBe(false)
  })

  test('401 without a user', async () => {
    state.user = null
    const { GET } = await import('../private-earnings/route.js')
    const res = await GET(req('http://x/api/live/sessions/private-earnings'))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/live/sessions/acknowledge', () => {
  test('acknowledges through the per-account RPC', async () => {
    state.rpc.acknowledge_live_session = { data: { id: SESSION.id, dashboard_seen_at: '2026-10-07T21:05:00Z' }, error: null }
    const { POST } = await import('../acknowledge/route.js')
    const body = await (await POST(req('http://x', { sessionIds: [SESSION.id] }))).json()
    expect(state.rpcCalls).toEqual([{ name: 'acknowledge_live_session', params: { p_session_id: SESSION.id } }])
    expect(body.acknowledged).toEqual([{ id: SESSION.id, seenAt: '2026-10-07T21:05:00Z' }])
  })

  test('rejects missing or non-UUID ids without touching the database', async () => {
    const { POST } = await import('../acknowledge/route.js')
    expect((await POST(req('http://x', { sessionIds: ['nope'] }))).status).toBe(400)
    expect((await POST(req('http://x', {}))).status).toBe(400)
    expect(state.rpcCalls).toEqual([])
  })
})

describe('POST /api/live/session/stop summary', () => {
  test('first Stop returns the summary re-read from the finalized row', async () => {
    state.rpc.stop_live_session = { data: SESSION, error: null }
    const { POST } = await import('../../session/stop/route.js')
    const body = await (await POST(req())).json()
    expect(body.alreadyStopped).toBe(false)
    expect(body.summary).toMatchObject({ id: SESSION.id, totalUsd: 82.5, publicUsd: 62.5, privateUsd: 20 })
    expect(state.queries.find((q) => q.table === 'live_sessions').filters).toEqual(
      expect.arrayContaining([['in', 'id', [SESSION.id]]])
    )
  })

  test('repeated Stop returns the same show and earnings, flagged alreadyStopped', async () => {
    state.rpc.stop_live_session = { data: { id: null }, error: null }
    state.single.live_sessions = { data: SESSION, error: null }
    const { POST } = await import('../../session/stop/route.js')
    const body = await (await POST(req())).json()
    expect(body.alreadyStopped).toBe(true)
    expect(body.summary).toMatchObject({ id: SESSION.id, totalUsd: 82.5 })
  })
})

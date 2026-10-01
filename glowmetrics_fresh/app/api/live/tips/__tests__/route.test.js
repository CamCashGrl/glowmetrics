/**
 * @jest-environment node
 *
 * Regression test for the live-tips ingestion route.
 *
 * The #285 "cross-creator tip theft" check required a row in
 * broadcaster_accounts that nothing in the app ever creates — it rejected
 * every real tip from every real user, unconditionally, from the day it
 * shipped (confirmed against production logs and a live 403). This test
 * guards against that exact failure mode: a normal, authenticated tip event
 * must be accepted and saved, and the route must never even query
 * broadcaster_accounts.
 */
jest.mock('next/server', () => ({}))

function makeChain(result) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    gt: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => result),
    then: (resolve) => resolve(result), // awaiting the chain itself (insert().select())
  }
  return chain
}

// Shared across describes: every chain handed out, keyed by table, so tests
// can assert on the exact filters and insert payloads the route used.
let fromCalls
let chainsByTable
let sessionRow = null

function mockSupabase() {
  return {
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { id: 'creator-1' } }, error: null })),
    },
    from: jest.fn((table) => {
      fromCalls.push(table)
      let chain
      if (table === 'live_tips') {
        chain = makeChain({ data: [{ id: 'tip-1' }], error: null })
      } else if (table === 'profiles') {
        chain = makeChain({ data: { plan: 'free' }, error: null })
      } else if (table === 'live_sessions') {
        // Behaves like the real table: a row is only returned when its
        // status is in the list the route filtered on via .in('status', ...).
        chain = makeChain({ data: sessionRow, error: null })
        chain.maybeSingle = jest.fn(async () => {
          const statusFilter = chain.in.mock.calls.find(([col]) => col === 'status')
          const matches = sessionRow && (!statusFilter || statusFilter[1].includes(sessionRow.status))
          return { data: matches ? sessionRow : null, error: null }
        })
      } else {
        chain = makeChain({ data: null, error: null })
      }
      ;(chainsByTable[table] ||= []).push(chain)
      return chain
    }),
  }
}

function setupMocks() {
  fromCalls = []
  chainsByTable = {}
  jest.resetModules()
  jest.doMock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => mockSupabase()) }))
}

describe('POST /api/live/tips — real tip acceptance (regression for #285 lockout)', () => {
  beforeEach(() => {
    sessionRow = null
    setupMocks()
  })

  test('a normal tip with no broadcaster info is accepted and saved (this is what every real extension call looks like)', async () => {
    const { POST } = await import('../route.js')
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : h === 'origin' ? 'chrome-extension://abc' : null) },
      json: async () => ({ username: 'fan123', amount: 50, platform: 'chaturbate', timestamp: Date.now() }),
    }
    const res = await POST(req)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.tip).toEqual({ id: 'tip-1' })
    expect(fromCalls).not.toContain('broadcaster_accounts')
  })

  test('a tip that still includes broadcaster_username (old extension builds) is not blocked by it', async () => {
    const { POST } = await import('../route.js')
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({ username: 'fan456', amount: 20, platform: 'bongacams', broadcaster_username: 'someone_elses_room' }),
    }
    const res = await POST(req)
    const body = await res.json()
    expect(res.status ?? 200).not.toBe(403)
    expect(body.success).toBe(true)
    expect(fromCalls).not.toContain('broadcaster_accounts')
  })

  test('isTest still short-circuits without writing to live_tips', async () => {
    const { POST } = await import('../route.js')
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({ username: 'fan789', amount: 10, platform: 'myfreecams', isTest: true }),
    }
    const res = await POST(req)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.tip).toBeNull()
    expect(fromCalls).not.toContain('live_tips')
  })

  test('session lookup filters on DB status values that can actually exist', async () => {
    const { POST } = await import('../route.js')
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({ username: 'fan1', amount: 25, platform: 'chaturbate' }),
    }
    await POST(req)
    const sessionChain = chainsByTable.live_sessions[0]
    expect(sessionChain.in).toHaveBeenCalledWith('status', ['live', 'inactive_warning'])
  })

  test('missing auth is still rejected', async () => {
    const { POST } = await import('../route.js')
    const req = {
      headers: { get: () => null },
      json: async () => ({ username: 'fan', amount: 10, platform: 'chaturbate' }),
    }
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})

// Regression for the Aug 2 status-vocabulary drift: the DB only ever holds
// 'starting' | 'live' | 'inactive_warning' | 'ending' | 'ended' (+
// live_substate), but the route filtered on 'active'/'needs_resolution', so
// live_session_id was null on every tip and session totals read $0.
describe('POST /api/live/tips — session attribution', () => {
  function tipRequest() {
    return {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({ username: 'fan1', amount: 25, platform: 'chaturbate', timestamp: Date.now() }),
    }
  }

  function insertedLiveTip() {
    const insertCall = chainsByTable.live_tips[0].insert.mock.calls[0]
    return insertCall[0]
  }

  beforeEach(() => setupMocks())

  test('a tip during a live, active session is attributed to it', async () => {
    sessionRow = { id: 'sess-1', status: 'live', live_substate: 'active' }
    const { POST } = await import('../route.js')
    await POST(tipRequest())
    expect(insertedLiveTip().live_session_id).toBe('sess-1')
  })

  test('a tip during a live session with no substate yet is attributed (treated as active)', async () => {
    sessionRow = { id: 'sess-2', status: 'live', live_substate: null }
    const { POST } = await import('../route.js')
    await POST(tipRequest())
    expect(insertedLiveTip().live_session_id).toBe('sess-2')
  })

  test('a tip while the session is awaiting resolution is attributed (proof of life)', async () => {
    sessionRow = { id: 'sess-3', status: 'inactive_warning', live_substate: 'active' }
    const { POST } = await import('../route.js')
    await POST(tipRequest())
    expect(insertedLiveTip().live_session_id).toBe('sess-3')
  })

  test('a tip while paused is still saved but not attributed', async () => {
    sessionRow = { id: 'sess-4', status: 'live', live_substate: 'paused' }
    const { POST } = await import('../route.js')
    const res = await POST(tipRequest())
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(insertedLiveTip().live_session_id).toBeNull()
  })

  test('a tip with no session is still saved, unattributed', async () => {
    sessionRow = null
    const { POST } = await import('../route.js')
    const res = await POST(tipRequest())
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(insertedLiveTip().live_session_id).toBeNull()
  })
})

describe('lib/liveSession/status — DB to API status mapping', () => {
  let status
  let shape
  beforeAll(async () => {
    jest.resetModules()
    status = await import('../../../../../lib/liveSession/status.js')
    shape = await import('../../../../../lib/liveSession/shape.js')
  })

  test('every unresolved DB status is a value the live_sessions check constraint allows', () => {
    const allowed = ['starting', 'live', 'inactive_warning', 'ending', 'ended']
    for (const s of status.UNRESOLVED_DB_STATUSES) expect(allowed).toContain(s)
    expect(status.UNRESOLVED_DB_STATUSES).not.toContain('ended')
  })

  test.each([
    [{ status: 'starting', live_substate: null }, 'starting'],
    [{ status: 'live', live_substate: 'active' }, 'active'],
    [{ status: 'live', live_substate: null }, 'active'],
    [{ status: 'live', live_substate: 'paused' }, 'paused'],
    [{ status: 'inactive_warning', live_substate: 'active' }, 'needs_resolution'],
    [{ status: 'ending', live_substate: null }, 'stopping'],
    [{ status: 'ended', live_substate: null }, 'ended'],
  ])('toApiStatus(%o) -> %s', (row, expected) => {
    expect(status.toApiStatus(row)).toBe(expected)
  })

  test('shapeLiveSession returns the API status and keeps the raw DB status', () => {
    const shaped = shape.shapeLiveSession({
      id: 's', status: 'live', live_substate: 'paused',
      started_at: new Date(Date.now() - 60000).toISOString(),
      paused_at: new Date().toISOString(), total_paused_seconds: 0,
    })
    expect(shaped.status).toBe('paused')
    expect(shaped.db_status).toBe('live')
  })

  test('shapeLiveSession(null) is still null', () => {
    expect(shape.shapeLiveSession(null)).toBeNull()
  })
})

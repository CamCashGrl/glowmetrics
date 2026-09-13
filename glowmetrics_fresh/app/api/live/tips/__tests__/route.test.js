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

describe('POST /api/live/tips — real tip acceptance (regression for #285 lockout)', () => {
  let fromCalls

  function mockSupabase() {
    fromCalls = []
    return {
      auth: {
        getUser: jest.fn(async () => ({ data: { user: { id: 'creator-1' } }, error: null })),
      },
      from: jest.fn((table) => {
        fromCalls.push(table)
        if (table === 'live_tips') {
          return makeChain({ data: [{ id: 'tip-1' }], error: null })
        }
        if (table === 'profiles') {
          return makeChain({ data: { plan: 'free' }, error: null })
        }
        if (table === 'live_sessions') {
          return makeChain({ data: null, error: null })
        }
        return makeChain({ data: null, error: null })
      }),
    }
  }

  beforeEach(() => {
    jest.resetModules()
    jest.doMock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => mockSupabase()) }))
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

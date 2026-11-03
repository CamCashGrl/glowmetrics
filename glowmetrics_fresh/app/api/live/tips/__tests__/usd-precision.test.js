/**
 * @jest-environment node
 *
 * The extension tip route must hand persist_extension_tip the exact per-tip
 * USD from the canonical rate (tokensToUsd), never a value rounded to cents.
 * Regression: the route used parseFloat((tokens * rate).toFixed(2)), so
 * 1 BongaCams token was saved as $0.03 instead of $0.025.
 */
jest.mock('next/server', () => ({}))

describe('POST /api/live/tips — exact per-tip USD sent to persist_extension_tip', () => {
  let rpcCalls

  function mockSupabase() {
    return {
      auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'creator-1' } }, error: null })) },
      from: jest.fn(),
      rpc: jest.fn(async (name, params) => {
        rpcCalls.push({ name, params })
        return {
          data: { success: true, duplicate: false, live_tip_id: 'tip-1', tip_id: 1, live_session_id: null, client_event_id: params.p_client_event_id },
          error: null,
        }
      }),
    }
  }

  beforeEach(() => {
    rpcCalls = []
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key'
    jest.resetModules()
    jest.doMock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => mockSupabase()) }))
  })

  async function send(amount, platform) {
    const { POST } = await import('../route.js')
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({ username: 'fan', amount, platform, detectedAt: '2026-10-29T20:00:00Z' }),
    }
    const res = await POST(req)
    const body = await res.json()
    expect(body.success).toBe(true)
    const call = rpcCalls.find((c) => c.name === 'persist_extension_tip')
    expect(call).toBeDefined()
    return call.params
  }

  test.each([
    [1, 'bongacams', 0.025],
    [2, 'bongacams', 0.05],
    [3, 'bongacams', 0.075],
    [40, 'BongaCams', 1],
    [100, 'chaturbate', 5],
    [100, 'myfreecams', 5],
  ])('%i tokens on %s -> p_usd %f', async (tokens, platform, usd) => {
    const params = await send(tokens, platform)
    expect(params.p_tokens).toBe(tokens)
    expect(params.p_usd).toBe(usd)
  })

  test('1 BongaCams token is never sent as the cent-rounded 0.03', async () => {
    const params = await send(1, 'bongacams')
    expect(params.p_usd).not.toBe(0.03)
  })

  test('forty 1-token BongaCams tips send values that sum to exactly 1.0000', async () => {
    let tenThousandths = 0
    for (let i = 0; i < 40; i++) {
      const params = await send(1, 'bongacams')
      tenThousandths += Math.round(params.p_usd * 10000)
    }
    expect(tenThousandths).toBe(10000)
  })
})

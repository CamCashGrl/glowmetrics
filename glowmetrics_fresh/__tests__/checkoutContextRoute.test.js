import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: () => ({ getAll: () => [], set: () => {} }),
}))

const mockGetUser = vi.fn()
vi.mock('../lib/supabase-server', () => ({
  createSupabaseRouteClient: () => ({ auth: { getUser: mockGetUser } }),
}))

const mockSessionsRetrieve = vi.fn()
vi.mock('../lib/stripe', () => ({
  stripe: { checkout: { sessions: { retrieve: (...args) => mockSessionsRetrieve(...args) } } },
}))

const { GET } = await import('../app/api/stripe/checkout-context/route.js')

function makeRequest(url) {
  return { url }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
})

describe('GET /api/stripe/checkout-context', () => {
  it('requires authentication', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await GET(makeRequest('https://example.com/api/stripe/checkout-context?session_id=cs_test_1'))
    expect(res.status).toBe(401)
  })

  it('rejects a missing or malformed session_id', async () => {
    const res = await GET(makeRequest('https://example.com/api/stripe/checkout-context'))
    expect(res.status).toBe(400)

    const res2 = await GET(makeRequest('https://example.com/api/stripe/checkout-context?session_id=not-a-real-id'))
    expect(res2.status).toBe(400)
  })

  it('returns the sanitized context for a session that belongs to the current user', async () => {
    mockSessionsRetrieve.mockResolvedValue({
      metadata: { userId: 'user-1', plan_type: 'standard_monthly', ctx_gateSource: 'moneymap', ctx_returnPath: 'moneymap' },
    })
    const res = await GET(makeRequest('https://example.com/api/stripe/checkout-context?session_id=cs_test_1'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.context).toEqual({ gateSource: 'moneymap', returnPath: 'moneymap' })
  })

  it('refuses to return context for a session that belongs to a different user', async () => {
    mockSessionsRetrieve.mockResolvedValue({ metadata: { userId: 'someone-else' } })
    const res = await GET(makeRequest('https://example.com/api/stripe/checkout-context?session_id=cs_test_1'))
    expect(res.status).toBe(403)
  })
})

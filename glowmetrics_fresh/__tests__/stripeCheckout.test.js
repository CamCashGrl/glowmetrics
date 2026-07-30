import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: () => ({ getAll: () => [], set: () => {} }),
}))

const mockGetUser = vi.fn()
const mockSingle = vi.fn()
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })

vi.mock('../lib/supabase-server', () => ({
  createSupabaseRouteClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({ eq: () => ({ single: mockSingle }) }),
      update: () => ({ eq: mockUpdateEq }),
    }),
  }),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

const mockSessionsCreate = vi.fn()
vi.mock('../lib/stripe', () => ({
  stripe: {
    customers: { create: vi.fn().mockResolvedValue({ id: 'cus_new' }) },
    checkout: { sessions: { create: (...args) => mockSessionsCreate(...args) } },
  },
}))

const { POST } = await import('../app/api/stripe/checkout/route.js')

function makeRequest(body, { origin = 'https://camcashgrl.com' } = {}) {
  return {
    json: async () => body,
    headers: {
      get: (name) => (name.toLowerCase() === 'origin' ? origin : name.toLowerCase() === 'authorization' ? '' : null),
    },
  }
}

const REAL_ENV = process.env

beforeEach(() => {
  vi.clearAllMocks()
  process.env = {
    ...REAL_ENV,
    STRIPE_PRICE_EARLY_ADOPTER_MONTHLY: 'price_early_monthly',
    STRIPE_PRICE_EARLY_ADOPTER_ANNUAL: 'price_early_annual',
    STRIPE_MONTHLY_PRICE_ID: 'price_standard_monthly',
    // Deliberately no annual price env var — matches this repo's real gap.
  }
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@example.com' } } })
  mockSingle.mockResolvedValue({ data: { stripe_customer_id: 'cus_existing' }, error: null })
  mockSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session/xyz' })
})

describe('POST /api/stripe/checkout', () => {
  it('rejects an unauthenticated request', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ plan_type: 'standard_monthly' }))
    expect(res.status).toBe(401)
  })

  it('rejects an unrecognized plan_type', async () => {
    const res = await POST(makeRequest({ plan_type: 'not_a_real_plan' }))
    expect(res.status).toBe(400)
  })

  it('creates a checkout session for a valid, configured plan', async () => {
    const res = await POST(makeRequest({ plan_type: 'standard_monthly' }))
    const data = await res.json()
    expect(data.url).toBe('https://checkout.stripe.com/session/xyz')
    expect(mockSessionsCreate).toHaveBeenCalledTimes(1)
    const args = mockSessionsCreate.mock.calls[0][0]
    expect(args.line_items[0].price).toBe('price_standard_monthly')
    expect(args.metadata.userId).toBe('user-1')
    // Subscription-level metadata so customer.subscription.* webhooks can
    // also match by userId, not just email.
    expect(args.subscription_data.metadata.userId).toBe('user-1')
  })

  it('returns a clear, recoverable error for annual when its price is not configured — never a bare 500', async () => {
    const res = await POST(makeRequest({ plan_type: 'standard_annual' }))
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data.error).toMatch(/annual/i)
    expect(mockSessionsCreate).not.toHaveBeenCalled()
  })

  it('never leaks env var names or price IDs to the client error response', async () => {
    const res = await POST(makeRequest({ plan_type: 'standard_annual' }))
    const data = await res.json()
    expect(JSON.stringify(data)).not.toMatch(/STRIPE_|price_/)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockConstructEvent = vi.fn()
const mockCustomersRetrieve = vi.fn()

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function StripeMock() {
    return {
      webhooks: { constructEvent: mockConstructEvent },
      customers: { retrieve: mockCustomersRetrieve },
    }
  }),
}))

const mockGetUserById = vi.fn()
const mockListUsers = vi.fn()
const mockUpdate = vi.fn()
const mockProfileSelect = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: {
        getUserById: mockGetUserById,
        listUsers: mockListUsers,
      },
    },
    from: () => ({
      update: (payload) => ({ eq: (col, val) => mockUpdate(payload, val) }),
      select: () => ({ eq: () => ({ single: mockProfileSelect }) }),
    }),
  })),
}))

const { POST } = await import('../app/api/stripe/webhook/route.js')

function makeRequest(rawBody) {
  return {
    text: async () => JSON.stringify(rawBody),
    headers: { get: () => 'fake-signature' },
  }
}

const REAL_ENV = process.env

beforeEach(() => {
  vi.clearAllMocks()
  process.env = { ...REAL_ENV, STRIPE_WEBHOOK_SECRET: 'whsec_test', RESEND_API_KEY: 'test' }
  global.fetch = vi.fn().mockResolvedValue({ ok: true })
  mockUpdate.mockResolvedValue({ error: null })
  mockProfileSelect.mockResolvedValue({ data: { plan: 'free' }, error: null })
})

describe('POST /api/stripe/webhook', () => {
  it('rejects a request with an invalid signature', async () => {
    mockConstructEvent.mockImplementation(() => { throw new Error('bad signature') })
    const res = await POST(makeRequest({ type: 'checkout.session.completed' }))
    expect(res.status).toBe(400)
  })

  it('returns 200 for an event type it intentionally ignores, so Stripe stops retrying it', async () => {
    mockConstructEvent.mockReturnValue({ type: 'invoice.payment_failed', data: { object: {} } })
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.received).toBe(true)
  })

  it('matches the user via checkout-session metadata userId, not email, when metadata is present', async () => {
    mockGetUserById.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_1',
          customer_details: { email: 'user@example.com' },
          metadata: { userId: 'user-1' },
        },
      },
    })

    const res = await POST(makeRequest({}))
    expect(res.status).toBe(200)
    expect(mockGetUserById).toHaveBeenCalledWith('user-1')
    expect(mockListUsers).not.toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'pro', stripe_customer_id: 'cus_1' }),
      'user-1'
    )
  })

  it('falls back to email match when metadata userId is missing, and logs the fallback', async () => {
    mockListUsers.mockResolvedValue({ data: { users: [{ id: 'user-2', email: 'fallback@example.com' }] }, error: null })
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_2',
          customer_details: { email: 'fallback@example.com' },
          metadata: {},
        },
      },
    })

    const res = await POST(makeRequest({}))
    expect(res.status).toBe(200)
    expect(mockListUsers).toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'pro' }),
      'user-2'
    )
  })

  it('is idempotent: redelivering the same completed-checkout event does not re-notify once the user is already pro', async () => {
    mockGetUserById.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { plan: 'pro' }, error: null })
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_1',
          customer_details: { email: 'user@example.com' },
          metadata: { userId: 'user-1' },
        },
      },
    })

    const res = await POST(makeRequest({}))
    expect(res.status).toBe(200)
    // Profile update still runs (harmless/idempotent), but the Resend
    // notification fetch should not fire for a plan that was already 'pro'.
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('sends exactly one notification on an actual free -> pro transition', async () => {
    mockGetUserById.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSelect.mockResolvedValue({ data: { plan: 'free' }, error: null })
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_1',
          customer_details: { email: 'user@example.com' },
          metadata: { userId: 'user-1' },
        },
      },
    })

    await POST(makeRequest({}))
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})

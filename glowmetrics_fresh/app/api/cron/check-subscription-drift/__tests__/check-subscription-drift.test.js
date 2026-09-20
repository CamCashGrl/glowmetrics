/**
 * Regression tests for the Stripe/Supabase subscription-drift check.
 *
 * This exists so the class of bug found in the Sept 19 audit (Supabase
 * silently disagreeing with Stripe's real subscription status) gets caught
 * automatically instead of by a human happening to look. Must:
 *   - flag a profile whose subscription_status doesn't match Stripe's status
 *   - flag a profile whose plan doesn't match what that Stripe status implies
 *   - never flag a profile that's fully in sync
 *   - never write anything — read-only
 */
jest.mock('next/server', () => ({ NextResponse: { json: (body, init) => ({ body, init }) } }))

// route.js does `const stripe = new Stripe(...)` at module top level, so the
// mock constructor runs during `import { GET } from '../route.js'` below —
// before any const declared in this file's own body would be initialized
// (import hoisting runs first). Keeping the retrieve mock self-contained in
// the factory, and hanging it off the mock constructor, sidesteps that TDZ.
jest.mock('stripe', () => {
  const StripeMock = jest.fn().mockImplementation(() => ({
    subscriptions: { retrieve: StripeMock.__mockRetrieve },
  }))
  StripeMock.__mockRetrieve = jest.fn()
  return StripeMock
})

const mockSupabaseClient = { from: jest.fn() }
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => mockSupabaseClient) }))

import { GET } from '../route.js'
import Stripe from 'stripe'
const mockRetrieve = Stripe.__mockRetrieve

function mockProfilesTable(profiles) {
  const chain = {
    select: jest.fn(() => chain),
    not: jest.fn(() => chain),
    limit: jest.fn(async () => ({ data: profiles, error: null })),
  }
  mockSupabaseClient.from.mockReturnValue(chain)
  return chain
}

describe('check-subscription-drift cron', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn().mockResolvedValue({ ok: true })
  })

  test('flags a profile whose subscription_status disagrees with Stripe', async () => {
    mockProfilesTable([
      { id: 'u1', plan: 'free', subscription_status: 'active', stripe_subscription_id: 'sub_1' },
    ])
    mockRetrieve.mockResolvedValue({ status: 'past_due' })

    const res = await GET()

    expect(res.body.success).toBe(true)
    expect(res.body.checked).toBe(1)
    expect(res.body.mismatches).toHaveLength(1)
    expect(res.body.mismatches[0]).toMatchObject({
      userId: 'u1',
      stripeStatus: 'past_due',
      dbStatus: 'active',
      expectedPlan: 'free',
    })
  })

  test('flags a profile whose plan disagrees with what the Stripe status implies', async () => {
    mockProfilesTable([
      { id: 'u2', plan: 'pro', subscription_status: 'past_due', stripe_subscription_id: 'sub_2' },
    ])
    mockRetrieve.mockResolvedValue({ status: 'past_due' })

    const res = await GET()

    expect(res.body.mismatches).toHaveLength(1)
    expect(res.body.mismatches[0].dbPlan).toBe('pro')
    expect(res.body.mismatches[0].expectedPlan).toBe('free')
  })

  test('a fully in-sync profile is never flagged', async () => {
    mockProfilesTable([
      { id: 'u3', plan: 'pro', subscription_status: 'trialing', stripe_subscription_id: 'sub_3' },
      { id: 'u4', plan: 'free', subscription_status: 'canceled', stripe_subscription_id: 'sub_4' },
    ])
    mockRetrieve
      .mockResolvedValueOnce({ status: 'trialing' })
      .mockResolvedValueOnce({ status: 'canceled' })

    const res = await GET()

    expect(res.body.checked).toBe(2)
    expect(res.body.mismatches).toHaveLength(0)
    expect(global.fetch).not.toHaveBeenCalled() // no alert sent when nothing's wrong
  })

  test('no profiles with a Stripe subscription: reports zero checked, never calls Stripe', async () => {
    mockProfilesTable([])
    const res = await GET()
    expect(res.body.checked).toBe(0)
    expect(res.body.mismatches).toEqual([])
    expect(mockRetrieve).not.toHaveBeenCalled()
  })

  test('a Stripe lookup failure for one row is skipped, not fatal to the run', async () => {
    mockProfilesTable([
      { id: 'u5', plan: 'free', subscription_status: 'none', stripe_subscription_id: 'sub_bad' },
      { id: 'u6', plan: 'pro', subscription_status: 'active', stripe_subscription_id: 'sub_6' },
    ])
    mockRetrieve
      .mockRejectedValueOnce(new Error('No such subscription'))
      .mockResolvedValueOnce({ status: 'active' })

    const res = await GET()

    expect(res.body.success).toBe(true)
    expect(res.body.checked).toBe(1)
    expect(res.body.mismatches).toEqual([])
  })

  test('select failure returns an error response instead of a blind pass', async () => {
    const chain = {
      select: jest.fn(() => chain),
      not: jest.fn(() => chain),
      limit: jest.fn(async () => ({ data: null, error: { message: 'db unreachable' } })),
    }
    mockSupabaseClient.from.mockReturnValue(chain)

    const res = await GET()

    expect(res.body.success).toBe(false)
    expect(res.init.status).toBe(500)
  })

  test('sends an alert email when mismatches are found', async () => {
    mockProfilesTable([
      { id: 'u7', plan: 'pro', subscription_status: 'active', stripe_subscription_id: 'sub_7' },
    ])
    mockRetrieve.mockResolvedValue({ status: 'unpaid' })

    await GET()

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

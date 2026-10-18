/**
 * Regression tests for the Stripe/Supabase subscription-drift check.
 * Trialing subscriptions remain on the capped trial entitlement path and
 * therefore intentionally keep profiles.plan='free'. Only Stripe active maps
 * to paid Pro.
 */
jest.mock('next/server', () => ({ NextResponse: { json: (body, init) => ({ body, init }) } }))

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
    mockProfilesTable([{ id: 'u1', plan: 'free', subscription_status: 'active', stripe_subscription_id: 'sub_1' }])
    mockRetrieve.mockResolvedValue({ status: 'past_due' })
    const res = await GET()
    expect(res.body.success).toBe(true)
    expect(res.body.checked).toBe(1)
    expect(res.body.mismatches).toHaveLength(1)
    expect(res.body.mismatches[0]).toMatchObject({ userId: 'u1', stripeStatus: 'past_due', dbStatus: 'active', expectedPlan: 'free' })
  })

  test('flags a profile whose plan disagrees with what Stripe status implies', async () => {
    mockProfilesTable([{ id: 'u2', plan: 'pro', subscription_status: 'past_due', stripe_subscription_id: 'sub_2' }])
    mockRetrieve.mockResolvedValue({ status: 'past_due' })
    const res = await GET()
    expect(res.body.mismatches).toHaveLength(1)
    expect(res.body.mismatches[0].dbPlan).toBe('pro')
    expect(res.body.mismatches[0].expectedPlan).toBe('free')
  })

  test('trialing is in sync only when plan stays free/capped', async () => {
    mockProfilesTable([
      { id: 'u3', plan: 'free', subscription_status: 'trialing', stripe_subscription_id: 'sub_3' },
      { id: 'u4', plan: 'free', subscription_status: 'canceled', stripe_subscription_id: 'sub_4' },
    ])
    mockRetrieve.mockResolvedValueOnce({ status: 'trialing' }).mockResolvedValueOnce({ status: 'canceled' })
    const res = await GET()
    expect(res.body.checked).toBe(2)
    expect(res.body.mismatches).toHaveLength(0)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('flags legacy trialing=pro as entitlement drift', async () => {
    mockProfilesTable([{ id: 'trial-old', plan: 'pro', subscription_status: 'trialing', stripe_subscription_id: 'sub_trial' }])
    mockRetrieve.mockResolvedValue({ status: 'trialing' })
    const res = await GET()
    expect(res.body.mismatches).toHaveLength(1)
    expect(res.body.mismatches[0]).toMatchObject({ dbPlan: 'pro', expectedPlan: 'free', stripeStatus: 'trialing' })
  })

  test('active paid Pro is in sync', async () => {
    mockProfilesTable([{ id: 'paid', plan: 'pro', subscription_status: 'active', stripe_subscription_id: 'sub_paid' }])
    mockRetrieve.mockResolvedValue({ status: 'active' })
    const res = await GET()
    expect(res.body.mismatches).toEqual([])
  })

  test('no profiles with a Stripe subscription reports zero checked', async () => {
    mockProfilesTable([])
    const res = await GET()
    expect(res.body.checked).toBe(0)
    expect(res.body.mismatches).toEqual([])
    expect(mockRetrieve).not.toHaveBeenCalled()
  })

  test('a Stripe lookup failure for one row is skipped, not fatal', async () => {
    mockProfilesTable([
      { id: 'u5', plan: 'free', subscription_status: 'none', stripe_subscription_id: 'sub_bad' },
      { id: 'u6', plan: 'pro', subscription_status: 'active', stripe_subscription_id: 'sub_6' },
    ])
    mockRetrieve.mockRejectedValueOnce(new Error('No such subscription')).mockResolvedValueOnce({ status: 'active' })
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
    mockProfilesTable([{ id: 'u7', plan: 'pro', subscription_status: 'active', stripe_subscription_id: 'sub_7' }])
    mockRetrieve.mockResolvedValue({ status: 'unpaid' })
    await GET()
    expect(global.fetch).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST' }))
  })
})

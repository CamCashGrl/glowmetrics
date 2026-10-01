/**
 * Regression tests for Stripe webhook user resolution.
 *
 * Root cause of a real production bug: supabase.auth.admin.listUsers() is
 * paginated (50 users/page by default) and was being called with no page
 * param, so only the oldest ~50 accounts were ever visible to it. Every
 * account created after that point (this project has 167+ users) was
 * invisible to getUserByEmail(), so every Stripe webhook for those users
 * silently did nothing — Stripe still received a 200 response and never
 * retried, so the failure was undetectable from the outside. Confirmed via
 * a real checkout session for the 167th (newest) signup: Stripe showed the
 * subscription as "trialing", but profiles.plan stayed "free".
 */
// route.js imports NextResponse from next/server, which needs Request/
// Response globals this project's jsdom test environment doesn't provide.
// These tests only exercise the plain user-resolution helpers below, so
// stub next/server out rather than switching the whole suite's environment.
jest.mock('next/server', () => ({ NextResponse: { json: jest.fn() } }))
// Same reasoning as next/server above: the module-level `new Stripe(...)`
// needs a global fetch this test environment doesn't provide, and none of
// the functions under test touch the Stripe client at all.
jest.mock('stripe', () => jest.fn().mockImplementation(() => ({})))

import { getUserByEmail, getUserById, resolveUser, getUserByStripeCustomerId, periodFor } from '../route.js'

// Faithfully honors whatever perPage the caller actually requests — a real
// backend (Supabase's Admin API) does the same. getUserByEmail() hardcodes
// perPage=200, so a user base bigger than that (this test uses 450) is what
// it takes to force a real second page and prove the loop doesn't stop
// after just one.
function makeMockSupabase({ allUsers }) {
  return {
    auth: {
      admin: {
        listUsers: jest.fn(async ({ page = 1, perPage = 50 } = {}) => {
          const start = (page - 1) * perPage
          const users = allUsers.slice(start, start + perPage)
          return { data: { users }, error: null }
        }),
        getUserById: jest.fn(async (id) => {
          const user = allUsers.find(u => u.id === id)
          return user ? { data: { user }, error: null } : { data: null, error: { message: 'not found' } }
        }),
      },
    },
  }
}

describe('Stripe webhook — user resolution does not silently fail past page 1', () => {
  test('getUserByEmail finds a user on a later page instead of stopping after page 1', async () => {
    const allUsers = Array.from({ length: 450 }, (_, i) => ({ id: `user-${i}`, email: `user${i}@example.com` }))
    const supabase = makeMockSupabase({ allUsers })
    const found = await getUserByEmail(supabase, 'user449@example.com') // the last (newest) user, 3rd page at perPage=200
    expect(found).not.toBeNull()
    expect(found.id).toBe('user-449')
    expect(supabase.auth.admin.listUsers.mock.calls.length).toBeGreaterThan(1)
  })

  test('getUserByEmail is case-insensitive', async () => {
    const allUsers = [{ id: 'u1', email: 'Test@Example.com' }]
    const supabase = makeMockSupabase({ allUsers })
    const found = await getUserByEmail(supabase, 'test@example.com')
    expect(found?.id).toBe('u1')
  })

  test('getUserByEmail returns null (not an infinite loop) when nobody matches', async () => {
    const allUsers = Array.from({ length: 60 }, (_, i) => ({ id: `user-${i}`, email: `user${i}@example.com` }))
    const supabase = makeMockSupabase({ allUsers })
    const found = await getUserByEmail(supabase, 'nobody@example.com')
    expect(found).toBeNull()
  })

  test('getUserById resolves directly by id in a single call, regardless of total user count', async () => {
    const allUsers = Array.from({ length: 450 }, (_, i) => ({ id: `user-${i}`, email: `user${i}@example.com` }))
    const supabase = makeMockSupabase({ allUsers })
    const found = await getUserById(supabase, 'user-449')
    expect(found?.id).toBe('user-449')
    expect(supabase.auth.admin.getUserById).toHaveBeenCalledTimes(1)
    expect(supabase.auth.admin.listUsers).not.toHaveBeenCalled()
  })

  test('resolveUser prefers the exact userId lookup and never falls back to the paginated scan when it succeeds', async () => {
    const allUsers = Array.from({ length: 450 }, (_, i) => ({ id: `user-${i}`, email: `user${i}@example.com` }))
    const supabase = makeMockSupabase({ allUsers })
    const found = await resolveUser(supabase, { userId: 'user-449', email: 'user449@example.com' })
    expect(found?.id).toBe('user-449')
    expect(supabase.auth.admin.listUsers).not.toHaveBeenCalled()
  })

  test('resolveUser falls back to email lookup when no userId is available (e.g. legacy events)', async () => {
    const allUsers = Array.from({ length: 450 }, (_, i) => ({ id: `user-${i}`, email: `user${i}@example.com` }))
    const supabase = makeMockSupabase({ allUsers })
    const found = await resolveUser(supabase, { userId: null, email: 'user449@example.com' })
    expect(found?.id).toBe('user-449')
    expect(supabase.auth.admin.listUsers).toHaveBeenCalled()
  })

  test('resolveUser returns null (not a thrown error) when both userId and email fail to resolve', async () => {
    const allUsers = [{ id: 'u1', email: 'someone@example.com' }]
    const supabase = makeMockSupabase({ allUsers })
    const found = await resolveUser(supabase, { userId: 'does-not-exist', email: 'also-nobody@example.com' })
    expect(found).toBeNull()
  })
})

// Regression: niemeyerb101's Sep 27 renewal (customer.subscription.updated)
// failed with "could not resolve a user (userId=undefined)" — her
// subscription predates metadata.userId, and the email scan also missed.
// Her profile already held stripe_customer_id, which is now checked second.
describe('Stripe webhook — resolution by stripe_customer_id', () => {
  function withProfiles(supabase, profiles) {
    supabase.from = jest.fn(() => {
      const filters = {}
      const chain = {
        select: jest.fn(() => chain),
        eq: jest.fn((col, val) => { filters[col] = val; return chain }),
        limit: jest.fn(async (n) => ({
          data: profiles.filter((p) => p.stripe_customer_id === filters.stripe_customer_id).slice(0, n),
          error: null,
        })),
      }
      return chain
    })
    return supabase
  }

  test('a legacy subscription with no metadata.userId resolves via the profile\'s stripe_customer_id', async () => {
    const allUsers = [{ id: 'legacy-user', email: 'legacy@example.com' }]
    const supabase = withProfiles(makeMockSupabase({ allUsers }), [{ id: 'legacy-user', stripe_customer_id: 'cus_LEGACY' }])
    const found = await resolveUser(supabase, { userId: undefined, email: 'mismatch@example.com', customerId: 'cus_LEGACY' })
    expect(found?.id).toBe('legacy-user')
    expect(supabase.auth.admin.listUsers).not.toHaveBeenCalled()
  })

  test('metadata.userId still wins and the customer lookup is skipped', async () => {
    const allUsers = [{ id: 'u1', email: 'a@example.com' }]
    const supabase = withProfiles(makeMockSupabase({ allUsers }), [])
    const found = await resolveUser(supabase, { userId: 'u1', email: null, customerId: 'cus_X' })
    expect(found?.id).toBe('u1')
    expect(supabase.from).not.toHaveBeenCalled()
  })

  test('an ambiguous customer id (shared by 2 profiles) is never used to pick a user', async () => {
    const allUsers = [{ id: 'a', email: 'a@example.com' }, { id: 'b', email: 'b@example.com' }]
    const supabase = withProfiles(makeMockSupabase({ allUsers }), [
      { id: 'a', stripe_customer_id: 'cus_DUP' }, { id: 'b', stripe_customer_id: 'cus_DUP' },
    ])
    expect(await getUserByStripeCustomerId(supabase, 'cus_DUP')).toBeNull()
  })

  test('unknown customer id falls through to the email scan', async () => {
    const allUsers = [{ id: 'e1', email: 'found@example.com' }]
    const supabase = withProfiles(makeMockSupabase({ allUsers }), [])
    const found = await resolveUser(supabase, { userId: null, email: 'found@example.com', customerId: 'cus_NONE' })
    expect(found?.id).toBe('e1')
  })
})

// Regression: on Stripe API 2025-03-31+ (this account: 2026-02-25.clover)
// current_period_* lives on the subscription item, not the subscription, so
// subscriptions.current_period_end was written null for every subscriber.
describe('Stripe webhook — billing period dates', () => {
  test('reads the period from the subscription item on current API versions', () => {
    const sub = { items: { data: [{ current_period_start: 1790527527, current_period_end: 1793119527 }] } }
    expect(periodFor(sub)).toEqual({
      current_period_start: new Date(1790527527 * 1000).toISOString(),
      current_period_end: new Date(1793119527 * 1000).toISOString(),
    })
  })

  test('still reads the top-level period on older API versions', () => {
    const sub = { current_period_start: 100, current_period_end: 200, items: { data: [] } }
    expect(periodFor(sub)).toEqual({
      current_period_start: new Date(100000).toISOString(),
      current_period_end: new Date(200000).toISOString(),
    })
  })

  test('missing period data is null, never an invalid date', () => {
    expect(periodFor({})).toEqual({ current_period_start: null, current_period_end: null })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveUserIdForEvent } from '../lib/stripeWebhookUser'

function makeSupabase({ getUserByIdResult, listUsersResult }) {
  return {
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue(getUserByIdResult),
        listUsers: vi.fn().mockResolvedValue(listUsersResult),
      },
    },
  }
}

describe('resolveUserIdForEvent', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('matches by metadata userId when it resolves to a real user', async () => {
    const supabase = makeSupabase({
      getUserByIdResult: { data: { user: { id: 'user-123' } }, error: null },
      listUsersResult: { data: { users: [] }, error: null },
    })

    const result = await resolveUserIdForEvent(supabase, {
      metadataUserId: 'user-123',
      customerEmail: 'someone@example.com',
      eventType: 'checkout.session.completed',
    })

    expect(result).toEqual({ userId: 'user-123', matchedBy: 'metadata' })
    expect(supabase.auth.admin.listUsers).not.toHaveBeenCalled()
  })

  it('falls back to email match when metadata userId does not resolve', async () => {
    const supabase = makeSupabase({
      getUserByIdResult: { data: null, error: { message: 'not found' } },
      listUsersResult: {
        data: { users: [{ id: 'user-456', email: 'someone@example.com' }] },
        error: null,
      },
    })

    const result = await resolveUserIdForEvent(supabase, {
      metadataUserId: 'stale-id',
      customerEmail: 'someone@example.com',
      eventType: 'customer.subscription.updated',
    })

    expect(result).toEqual({ userId: 'user-456', matchedBy: 'email_fallback' })
  })

  it('falls back to email match when metadata userId is entirely absent', async () => {
    const supabase = makeSupabase({
      getUserByIdResult: { data: null, error: null },
      listUsersResult: {
        data: { users: [{ id: 'user-789', email: 'nometadata@example.com' }] },
        error: null,
      },
    })

    const result = await resolveUserIdForEvent(supabase, {
      metadataUserId: null,
      customerEmail: 'nometadata@example.com',
      eventType: 'customer.subscription.created',
    })

    expect(result).toEqual({ userId: 'user-789', matchedBy: 'email_fallback' })
  })

  it('returns no match when neither metadata nor email resolve to a user', async () => {
    const supabase = makeSupabase({
      getUserByIdResult: { data: null, error: { message: 'not found' } },
      listUsersResult: { data: { users: [] }, error: null },
    })

    const result = await resolveUserIdForEvent(supabase, {
      metadataUserId: 'stale-id',
      customerEmail: 'nobody@example.com',
      eventType: 'customer.subscription.deleted',
    })

    expect(result).toEqual({ userId: null, matchedBy: 'none' })
  })

  it('returns no match when there is no email to fall back on', async () => {
    const supabase = makeSupabase({
      getUserByIdResult: { data: null, error: null },
      listUsersResult: { data: { users: [] }, error: null },
    })

    const result = await resolveUserIdForEvent(supabase, {
      metadataUserId: null,
      customerEmail: null,
      eventType: 'customer.subscription.updated',
    })

    expect(result).toEqual({ userId: null, matchedBy: 'none' })
    expect(supabase.auth.admin.listUsers).not.toHaveBeenCalled()
  })
})

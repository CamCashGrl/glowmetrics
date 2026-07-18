import { describe, it, expect, vi } from 'vitest'
import { logFeatureUsageEvent, createOnceGuard } from '../featureUsage'

function fakeSupabase() {
  const inserted = []
  return {
    inserted,
    from: () => ({
      insert: (row) => {
        inserted.push(row)
        return Promise.resolve({ data: row, error: null })
      },
    }),
  }
}

describe('logFeatureUsageEvent', () => {
  it('inserts a feature usage row with the given feature/action/metadata', async () => {
    const supabase = fakeSupabase()
    await logFeatureUsageEvent(supabase, {
      userId: 'user_1',
      sessionId: 'sess_1',
      feature: 'live_mode',
      action: 'live_mode.session_started',
      metadata: { platform: 'Chaturbate' },
    })
    expect(supabase.inserted).toHaveLength(1)
    expect(supabase.inserted[0]).toMatchObject({
      user_id: 'user_1',
      session_id: 'sess_1',
      feature: 'live_mode',
      action: 'live_mode.session_started',
    })
  })

  it('does nothing when required fields are missing (never throws mid-stream)', async () => {
    const supabase = fakeSupabase()
    await logFeatureUsageEvent(supabase, { userId: null, feature: 'live_mode', action: 'x' })
    expect(supabase.inserted).toHaveLength(0)
  })
})

describe('createOnceGuard', () => {
  it('logs a given key only once', () => {
    const guard = createOnceGuard()
    expect(guard.shouldLog('live_mode.session_started:sess_1')).toBe(true)
    expect(guard.shouldLog('live_mode.session_started:sess_1')).toBe(false)
  })

  it('allows a fresh key after reset() (new session)', () => {
    const guard = createOnceGuard()
    guard.shouldLog('live_mode.session_started:sess_1')
    guard.reset()
    expect(guard.shouldLog('live_mode.session_started:sess_1')).toBe(true)
  })

  it('treats different keys independently', () => {
    const guard = createOnceGuard()
    expect(guard.shouldLog('a')).toBe(true)
    expect(guard.shouldLog('b')).toBe(true)
  })
})

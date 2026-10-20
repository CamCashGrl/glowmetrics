import {
  activeSecondsForSession,
  buildLiveModeAllowance,
  startOfUtcWeek,
  trialWindowStart,
} from '../liveModeAllowance'

test('Free accounts get two Live Mode streams per week', () => {
  const now = new Date('2026-10-18T12:00:00Z')
  const allowance = buildLiveModeAllowance({
    plan: 'free',
    subscriptionStatus: 'none',
    now,
    sessions: [
      { started_at: '2026-10-12T10:00:00Z' },
      { started_at: '2026-10-15T10:00:00Z' },
    ],
  })
  expect(allowance.scope).toBe('week')
  expect(allowance.usedThisWeek).toBe(2)
  expect(allowance.remainingThisWeek).toBe(0)
  expect(allowance.locked).toBe(true)
})

test('sessions before Monday do not consume this week allowance', () => {
  const now = new Date('2026-10-18T12:00:00Z')
  const allowance = buildLiveModeAllowance({
    plan: 'free',
    now,
    sessions: [
      { started_at: '2026-10-11T23:59:59Z' },
      { started_at: '2026-10-12T00:00:00Z' },
    ],
  })
  expect(startOfUtcWeek(now).toISOString()).toBe('2026-10-12T00:00:00.000Z')
  expect(allowance.usedThisWeek).toBe(1)
  expect(allowance.remainingThisWeek).toBe(1)
})

test('7-day trial gets two Live Mode sessions TOTAL, even when trial crosses Monday', () => {
  const now = new Date('2026-10-13T12:00:00Z')
  const trialEndsAt = '2026-10-16T12:00:00Z'
  expect(trialWindowStart(trialEndsAt).toISOString()).toBe('2026-10-09T12:00:00.000Z')

  const allowance = buildLiveModeAllowance({
    plan: 'free',
    subscriptionStatus: 'trialing',
    trialEndsAt,
    now,
    sessions: [
      { started_at: '2026-10-10T10:00:00Z' }, // before Monday
      { started_at: '2026-10-12T10:00:00Z' }, // after Monday
    ],
  })

  expect(allowance.isTrial).toBe(true)
  expect(allowance.scope).toBe('trial')
  expect(allowance.sessionLimit).toBe(2)
  expect(allowance.usedInScope).toBe(2)
  expect(allowance.remainingInScope).toBe(0)
  expect(allowance.weeklyLimit).toBeNull()
  expect(allowance.locked).toBe(true)
})

test('expired trial falls back to ordinary Free weekly allowance', () => {
  const now = new Date('2026-10-18T12:00:00Z')
  const allowance = buildLiveModeAllowance({
    plan: 'free',
    subscriptionStatus: 'trialing',
    trialEndsAt: '2026-10-17T12:00:00Z',
    now,
    sessions: [{ started_at: '2026-10-15T10:00:00Z' }],
  })
  expect(allowance.isTrial).toBe(false)
  expect(allowance.scope).toBe('week')
  expect(allowance.remainingThisWeek).toBe(1)
})

test('paused time does not burn the 30-minute Free allowance', () => {
  const now = new Date('2026-10-18T12:40:00Z')
  const session = {
    started_at: '2026-10-18T12:00:00Z',
    total_paused_seconds: 600,
    live_substate: 'active',
  }
  expect(activeSecondsForSession(session, now)).toBe(1800)
  const allowance = buildLiveModeAllowance({ plan: 'free', sessions: [session], currentSession: session, now })
  expect(allowance.limitReached).toBe(true)
  expect(allowance.currentRemainingSeconds).toBe(0)
})

test('an ongoing pause is excluded from active time', () => {
  const now = new Date('2026-10-18T12:40:00Z')
  const session = {
    started_at: '2026-10-18T12:00:00Z',
    total_paused_seconds: 300,
    live_substate: 'paused',
    paused_at: '2026-10-18T12:30:00Z',
  }
  expect(activeSecondsForSession(session, now)).toBe(1500)
})

test('paid active Pro has no weekly, trial, or duration cap', () => {
  const now = new Date('2026-10-18T12:40:00Z')
  const sessions = Array.from({ length: 8 }, (_, i) => ({ started_at: `2026-10-${12 + i}T10:00:00Z` }))
  const allowance = buildLiveModeAllowance({
    plan: 'pro',
    subscriptionStatus: 'active',
    sessions,
    currentSession: sessions[0],
    now,
  })
  expect(allowance.isPro).toBe(true)
  expect(allowance.scope).toBe('unlimited')
  expect(allowance.weeklyLimit).toBeNull()
  expect(allowance.streamLimitSeconds).toBeNull()
  expect(allowance.locked).toBe(false)
})

test('legacy plan=pro with trialing status is still capped as trial, not treated as paid Pro', () => {
  const now = new Date('2026-10-13T12:00:00Z')
  const allowance = buildLiveModeAllowance({
    plan: 'pro',
    subscriptionStatus: 'trialing',
    trialEndsAt: '2026-10-16T12:00:00Z',
    sessions: [{ started_at: '2026-10-10T10:00:00Z' }],
    now,
  })
  expect(allowance.isPro).toBe(false)
  expect(allowance.isTrial).toBe(true)
  expect(allowance.remainingInScope).toBe(1)
})


test.each([null, '', 'invalid-date'])('invalid trial expiry %s cannot create a fresh allowance or interrupt an existing session', trialEndsAt => {
  const now = new Date('2026-10-19T12:00:00Z')
  const args = { subscriptionStatus: 'trialing', trialEndsAt, now }
  expect(trialWindowStart(trialEndsAt)).toBeNull()
  expect(buildLiveModeAllowance(args)).toMatchObject({ locked: true, remainingInScope: 0, resetAt: null })
  expect(buildLiveModeAllowance({ ...args, currentSession: { started_at: '2026-10-19T11:59:00Z' } }))
    .toMatchObject({ locked: false, limitReached: false, currentRemainingSeconds: 1740 })
})

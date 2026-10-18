import {
  activeSecondsForSession,
  buildLiveModeAllowance,
  startOfUtcWeek,
} from '../liveModeAllowance'

test('Free accounts get two Live Mode streams per week', () => {
  const now = new Date('2026-10-18T12:00:00Z')
  const allowance = buildLiveModeAllowance({
    plan: 'free',
    now,
    sessions: [
      { started_at: '2026-10-12T10:00:00Z' },
      { started_at: '2026-10-15T10:00:00Z' },
    ],
  })
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

test('Pro has no weekly or duration cap', () => {
  const now = new Date('2026-10-18T12:40:00Z')
  const sessions = Array.from({ length: 8 }, (_, i) => ({ started_at: `2026-10-${12 + i}T10:00:00Z` }))
  const allowance = buildLiveModeAllowance({ plan: 'pro', sessions, currentSession: sessions[0], now })
  expect(allowance.isPro).toBe(true)
  expect(allowance.weeklyLimit).toBeNull()
  expect(allowance.streamLimitSeconds).toBeNull()
  expect(allowance.locked).toBe(false)
})

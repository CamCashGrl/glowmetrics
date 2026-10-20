import { hasPaidProAccess } from '../planLimits'
import { activeSecondsForSession, buildLiveModeAllowance, startOfUtcWeek } from '../liveModeAllowance'
import { accessibleDataset, aggregateRows, identifyWhales } from '../analytics'
import { buildCappedAnalyticsDatasets } from '../freeAnalyticsGate'
import { buildSessionHistory, overallSessionStats, localDayKey } from '../sessions/normalize'

const now = new Date('2026-10-19T00:00:00Z')
test.each([
  ['free', 'none', false], ['pro', 'trialing', false], ['pro', 'active', true],
  ['pro', 'past_due', false], ['pro', 'canceled', false], ['pro', 'unpaid', false],
  ['pro', undefined, false], ['free', 'active', false],
])('mirrored entitlement matrix %s / %s', (plan, subscriptionStatus, expected) => {
  expect(hasPaidProAccess({ plan, subscriptionStatus })).toBe(expected)
})

test('a paused session cannot reset its active duration after resume or reload', () => {
  const paused = { id: 's1', started_at: '2026-10-18T22:00:00Z', paused_at: '2026-10-18T22:29:59Z', total_paused_seconds: 0, live_substate: 'paused' }
  const resumeAt = new Date('2026-10-18T23:00:00Z')
  expect(activeSecondsForSession(paused, resumeAt)).toBe(1799)
  const resumed = { ...paused, paused_at: null, total_paused_seconds: 1801, live_substate: 'active' }
  expect(activeSecondsForSession(JSON.parse(JSON.stringify(resumed)), new Date('2026-10-18T23:00:01Z'))).toBe(1800)
  expect(buildLiveModeAllowance({ currentSession: resumed, now: new Date('2026-10-18T23:00:01Z') }).limitReached).toBe(true)
})

test('exact UTC Monday resets Free starts but does not reset trial starts', () => {
  const sessions = [{ started_at: '2026-10-17T12:00:00Z' }, { started_at: '2026-10-18T12:00:00Z' }]
  expect(buildLiveModeAllowance({ sessions, now: new Date(now.getTime() - 1) }).locked).toBe(true)
  expect(buildLiveModeAllowance({ sessions, now }).remainingInScope).toBe(2)
  expect(buildLiveModeAllowance({ sessions, now, subscriptionStatus: 'trialing', trialEndsAt: '2026-10-23T00:00:00Z' }).locked).toBe(true)
})

test('trialing without an expiry must not allow unlimited new starts', () => {
  const sessions = [{ started_at: '2026-10-19T01:00:00Z' }, { started_at: '2026-10-19T02:00:00Z' }]
  const result = buildLiveModeAllowance({ subscriptionStatus: 'trialing', trialEndsAt: null, sessions, now: new Date('2026-10-19T03:00:00Z') })
  expect(result.locked).toBe(true)
})

test.each([
  ['America/Los_Angeles', '2026-10-18'], ['America/New_York', '2026-10-18'],
  ['UTC', '2026-10-19'], ['Pacific/Kiritimati', '2026-10-19'],
])('creator day in %s stays independent of UTC quota', (tz, expectedDay) => {
  expect(localDayKey(now, tz)).toBe(expectedDay)
  expect(startOfUtcWeek(now).toISOString()).toBe('2026-10-19T00:00:00.000Z')
})

const history = [
  { id: 1, platform: 'Chaturbate', username: 'sameFan', tokens: 20, usd: 1.01, date_time: '2026-10-18T12:00:00Z' },
  { id: 2, platform: 'Chaturbate', username: 'otherFan', tokens: 40, usd: 2.02, date_time: '2026-10-18T12:40:00Z' },
  { id: 3, platform: 'BongaCams', username: 'sameFan', tokens: 120, usd: 3.03, date_time: '2026-10-18T14:00:00Z' },
  { id: 4, platform: 'BongaCams', username: 'otherFan', tokens: 160, usd: 4.04, date_time: '2026-10-18T14:40:00Z' },
  { id: 5, platform: 'Chaturbate', username: 'oldFan', tokens: 2000, usd: 100, date_time: '2022-01-01T12:00:00Z' },
]
test('stored history unlocks on active Pro and relocks on downgrade without mutation', () => {
  const stored = JSON.parse(JSON.stringify(history))
  const totals = ['none', 'trialing', 'active', 'past_due', 'canceled'].map(subscriptionStatus => {
    const paid = hasPaidProAccess({ plan: 'pro', subscriptionStatus })
    const data = paid ? stored : buildCappedAnalyticsDatasets(stored, { selectedAnalyticsPlatform: 'Chaturbate' }).detailedAnalysisTips
    return data.reduce((sum, row) => sum + row.usd, 0)
  })
  expect(totals.map(value => Math.round(value * 100))).toEqual([303, 303, 11010, 303, 303])
  expect(stored).toEqual(history)
})

test.each(['America/Los_Angeles', 'America/New_York', 'UTC', 'Pacific/Kiritimati'])('same canonical window reconciles earnings in %s', tz => {
  const tips = accessibleDataset({ tips: history }).tips
  const aggregate = aggregateRows(tips, tz)
  const sessions = buildSessionHistory({ tips })
  const overall = overallSessionStats({ tips, history: sessions })
  const fans = identifyWhales(tips, [], tz)
  expect(aggregate.totalUSD).toBe(10.1)
  expect(overall.publicUSD).toBe(10.1)
  expect(sessions.reduce((sum, session) => sum + Math.round(session.totalUSD * 100), 0)).toBe(1010)
  expect(aggregate.platforms.reduce((sum, platform) => sum + Math.round(platform.totalUSD * 100), 0)).toBe(1010)
  expect(fans.reduce((sum, fan) => sum + Math.round(fan.totalUSD * 100), 0)).toBe(1010)
})

test('multi-year data is capped without mutating stored source rows', () => {
  const rows = Array.from({ length: 30000 }, (_, i) => ({ ...history[0], id: i,
    platform: ['Chaturbate', 'BongaCams', 'MyFreeCams'][i % 3],
    date_time: new Date(Date.UTC(2020, 0, 1) + i * 7200000).toISOString() }))
  const started = performance.now()
  const result = buildCappedAnalyticsDatasets(rows, { selectedAnalyticsPlatform: 'Chaturbate' })
  console.log('PREMERGE performance', { inputRows: rows.length, visibleRows: result.detailedAnalysisTips.length, comparisonRows: result.comparisonTips.length, milliseconds: Math.round(performance.now() - started) })
  expect(rows).toHaveLength(30000)
  expect(result.detailedAnalysisTips.length).toBeLessThan(130)
  expect(result.detailedAnalysisTips.every(row => row.platform === 'Chaturbate')).toBe(true)
})

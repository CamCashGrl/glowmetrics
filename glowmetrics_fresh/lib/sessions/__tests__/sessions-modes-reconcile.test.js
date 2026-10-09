/**
 * Raw data → helper reconciliation for the five Sessions scenarios that the
 * staging browser run (chrome-extension/tests/staging-sessions-modes.mjs)
 * seeds and reads back from the DOM. Expected values are computed by hand
 * from the fixture rows (see comments), not by the helpers.
 */
import fixture from '../__fixtures__/sessions-modes.json'
import { accessibleDataset } from '../../analytics'
import { buildSessionHistory, overallSessionStats, sessionPerformance, dailySessionStats, withTodayDerived, sessionsMode } from '../normalize'

const NOW = new Date('2026-10-08T22:30:00Z')
const at = (daysAgo, hm) => {
  if (daysAgo === 0) return new Date(NOW.getTime() - hm * 60000).toISOString()
  const d = new Date(NOW.getTime() - daysAgo * 86400000)
  const [h, m] = hm.split(':').map(Number)
  d.setUTCHours(h, m, 0, 0)
  return d.toISOString()
}
function rows(name) {
  const sc = fixture.scenarios[name]
  const tips = sc.tips.map(([d, hm, platform, username, usd, source], i) => ({ id: i + 1, date_time: at(d, hm), platform, username, usd, tokens: 0, source, live_session_id: null }))
  const paid = sc.paid.map(([d, hm, platform, username, usd, session_type], i) => ({ id: `p${i}`, date_time: at(d, hm), platform, username, username_lower: username.toLowerCase(), usd, session_type }))
  const acc = accessibleDataset({ tips, paidSessions: paid, isPro: sc.plan === 'pro', unlimitedPlatform: sc.primary })
  const history = buildSessionHistory({ tips: acc.tips, shows: [], paidSessions: acc.paidSessions })
  const overall = overallSessionStats({ tips: acc.tips, history, paidSessions: acc.paidSessions })
  const perf = sessionPerformance({ history, tips: acc.tips, overall })
  const mode = sessionsMode({ tips: acc.tips, paidSessions: acc.paidSessions })
  const today = withTodayDerived(dailySessionStats({ tips: acc.tips, history, paidSessions: acc.paidSessions, tz: 'UTC', now: NOW, days: 1 }))
  return { overall, perf, mode, today }
}

test('CSV-only Free (no primary): 31-day window on every platform', () => {
  const { overall: o, perf: p, mode } = rows('csvFree')
  expect(mode.kind).toBe('csv')
  // in window: CB 10+5+12+6+8+4 = 45, BC 5+7+3+2+1 = 18; day-60 CB (100) excluded
  expect(o.publicUSD).toBe(63)
  expect(o.privateUSD).toBe(6)
  expect(o.totalUSD).toBe(69)
  expect(o.tipCount).toBe(11)
  expect(o.uniqueTippers).toBe(5) // Ann Ben Cy (CB) + Ola Pia (BC)
  expect(o.meaningfulSessions).toBe(5) // CB d3 d5 d8, BC d4 d9; BC d2 lone tip is not a session
  expect(o.medianSessionUSD).toBe(12) // 15 18 12 12 5
  expect(o.avgSessionUSD).toBe(12.4)
  expect(o.topTipper).toMatchObject({ username: 'Ann', usd: 26 })
  expect(o.largestTip).toMatchObject({ username: 'Ann', usd: 12 })
  expect(p.typical).toMatchObject({ sessions: 5, medianUSD: 12, medianTips: 2, early: false })
  expect(p.momentum).toBeNull() // needs 6
  expect(p.audience).toMatchObject({ uniqueTippers: 5, repeatFans: 3, topFansSharePct: 78 }) // Ann Ben Ola; (26+13+10)/63
})

test('single-platform Free (primary Chaturbate): full history kept', () => {
  const { overall: o, perf: p, mode } = rows('singleFree')
  expect(mode).toMatchObject({ kind: 'csv', singlePlatform: true })
  expect(o.publicUSD).toBe(140) // days 40/70/90 kept on the primary
  expect(o.tipCount).toBe(14)
  expect(o.uniqueTippers).toBe(6)
  expect(o.meaningfulSessions).toBe(7)
  expect(o.medianSessionUSD).toBe(20) // 30 20 20 10 10 10 40
  expect(o.avgSessionUSD).toBe(20)
  expect(o.topTipper).toMatchObject({ username: 'Ann', usd: 86 })
  expect(o.largestTip).toMatchObject({ username: 'Ann', usd: 30 })
  expect(p.momentum).toMatchObject({ window: 3, recentAvgUSD: 23.33, priorAvgUSD: 10, deltaPct: 133 })
  expect(p.audience).toMatchObject({ uniqueTippers: 6, repeatFans: 2, topFansSharePct: 83 }) // (86+20+10)/140
})

test('mixed Live + CSV (Free, primary Chaturbate): Today and Overall', () => {
  const { overall: o, today: t, mode } = rows('mixed')
  expect(mode.kind).toBe('mixed')
  expect(t.totalUSD).toBe(13)
  expect(t.tipCount).toBe(3)
  expect(t.uniqueTippers).toBe(3)
  expect(t.streamedMinutes).toBe(0)
  expect(t.activitySpanMinutes).toBe(35) // Gus 40m ago → Hal 5m ago
  expect(t.completedSessions).toBe(1)
  expect(t.bestPlatform).toBe('chaturbate')
  expect(t.platforms.find((x) => x.platform === 'chaturbate')).toMatchObject({ totalUSD: 10, share: 77 })
  expect(o.publicUSD).toBe(38)
  expect(o.tipCount).toBe(7)
  expect(o.uniqueTippers).toBe(6)
  expect(o.meaningfulSessions).toBe(3)
  expect(o.medianSessionUSD).toBe(10)
  expect(o.topTipper).toMatchObject({ username: 'Ann', usd: 16 })
})

test('Pro: full history on every platform', () => {
  const { overall: o, perf: p } = rows('pro')
  expect(o.publicUSD).toBe(65)
  expect(o.tipCount).toBe(8)
  expect(o.uniqueTippers).toBe(4)
  expect(o.meaningfulSessions).toBe(4)
  expect(o.medianSessionUSD).toBe(12.5)
  expect(o.avgSessionUSD).toBe(16.25)
  expect(o.topTipper).toMatchObject({ username: 'Ann', usd: 30 })
  expect(o.largestTip).toMatchObject({ username: 'Ann', usd: 20 })
  expect(p.typical).toMatchObject({ sessions: 4, medianUSD: 12.5, early: true })
  expect(p.audience).toMatchObject({ repeatFans: 4, topFansSharePct: 88 })
})

test('no data', () => {
  const { overall: o, mode } = rows('noData')
  expect(mode.kind).toBe('none')
  expect(o.totalUSD).toBe(0)
  expect(o.meaningfulSessions).toBe(0)
})

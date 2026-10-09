/**
 * Selected-session breakdown: time buckets and the fans who drove the session.
 */
import { buildSessionHistory, sessionBuckets, sessionFanDrivers } from '../normalize'

const tip = (id, iso, username, usd, platform = 'chaturbate', extra = {}) => ({ id, date_time: iso, platform, username, usd, tokens: 0, source: 'upload', live_session_id: null, ...extra })

describe('sessionBuckets', () => {
  // 45-minute imported session → 10-minute buckets
  const tips = [
    tip(1, '2026-10-01T20:00:00Z', 'Ann', 4), tip(2, '2026-10-01T20:05:00Z', 'Ben', 2),
    tip(3, '2026-10-01T20:12:00Z', 'Ben', 12), tip(4, '2026-10-01T20:14:00Z', 'Cy', 9),
    tip(5, '2026-10-01T20:31:00Z', 'Ann', 12), tip(6, '2026-10-01T20:45:00Z', 'Dee', 3.5),
  ]
  const entry = buildSessionHistory({ tips })[0]
  const b = sessionBuckets(entry, { tips })

  test('imported span is labeled earning activity span, 10-minute buckets under 60m', () => {
    expect(b.label).toBe('Earning activity span')
    expect(b.exact).toBe(false)
    expect(b.bucketMinutes).toBe(10)
    expect(b.buckets).toHaveLength(5) // 45 min → 0-10,10-20,20-30,30-40,40-45
  })

  test('per-bucket earnings, counts, unique fans and top fan', () => {
    expect(b.buckets[0]).toMatchObject({ publicUSD: 6, count: 2, uniqueFans: 2, topFan: { username: 'Ann', usd: 4 } })
    expect(b.buckets[1]).toMatchObject({ publicUSD: 21, count: 2, uniqueFans: 2, topFan: { username: 'Ben', usd: 12 } })
    expect(b.buckets[2]).toMatchObject({ publicUSD: 0, count: 0, topFan: null })
    expect(b.buckets.reduce((a, x) => a + x.totalUSD, 0)).toBeCloseTo(42.5)
  })

  test('peak bucket and its share (>= 3 earning buckets)', () => {
    expect(b.peak.totalUSD).toBe(21)
    expect(b.peak.sharePct).toBe(49) // 21 / 42.5
  })

  test('bucket size 15m for 60–180m and 30m above 180m', () => {
    const t2 = [tip(1, '2026-10-01T20:00:00Z', 'Ann', 1), tip(2, '2026-10-01T20:50:00Z', 'Ann', 1), tip(3, '2026-10-01T21:30:00Z', 'Ann', 1)]
    expect(sessionBuckets(buildSessionHistory({ tips: t2 })[0], { tips: t2 }).bucketMinutes).toBe(15)
    const t3 = [tip(1, '2026-10-01T20:00:00Z', 'Ann', 1), tip(2, '2026-10-01T20:55:00Z', 'Ann', 1), tip(3, '2026-10-01T21:50:00Z', 'Ann', 1), tip(4, '2026-10-01T22:45:00Z', 'Ann', 1), tip(5, '2026-10-01T23:30:00Z', 'Ann', 1)]
    expect(sessionBuckets(buildSessionHistory({ tips: t3 })[0], { tips: t3 }).bucketMinutes).toBe(30)
  })

  test('single timestamp or < 10 min → one bucket, no peak claim', () => {
    const one = [tip(1, '2026-10-01T20:00:00Z', 'Ann', 5)]
    const s = sessionBuckets(buildSessionHistory({ tips: one })[0], { tips: one })
    expect(s.single).toBe(true)
    expect(s.buckets).toHaveLength(1)
    expect(s.peak).toBeNull()
    const short = [tip(1, '2026-10-01T20:00:00Z', 'Ann', 5), tip(2, '2026-10-01T20:06:00Z', 'Ben', 5)]
    expect(sessionBuckets(buildSessionHistory({ tips: short })[0], { tips: short }).single).toBe(true)
  })

  test('peak share hidden with fewer than 3 earning buckets', () => {
    const two = [tip(1, '2026-10-01T20:00:00Z', 'Ann', 5), tip(2, '2026-10-01T20:40:00Z', 'Ben', 5)]
    const s = sessionBuckets(buildSessionHistory({ tips: two })[0], { tips: two })
    expect(s.peak.sharePct).toBeNull()
  })

  test('Live: exact duration, private interval spread proportionally across overlapping buckets', () => {
    const show = {
      id: 'S', platform: 'chaturbate', startedAt: '2026-10-01T20:00:00Z', endedAt: '2026-10-01T20:40:00Z', durationSeconds: 2400,
      totalUsd: 13, publicUsd: 3, privateUsd: 10, privateSeconds: 1200, tipCount: 1, uniqueTippers: 1,
      privateIntervals: [{ id: 'iv', platform: 'chaturbate', startedAt: '2026-10-01T20:05:00Z', endedAt: '2026-10-01T20:25:00Z', earningsUsd: 10 }],
      platformRevenue: [{ platform: 'chaturbate', usd: 3, tips: 1 }],
    }
    const liveTips = [tip(9, '2026-10-01T20:30:00Z', 'Gus', 3, 'chaturbate', { live_session_id: 'S', source: 'extension' })]
    const entry = buildSessionHistory({ tips: liveTips, shows: [show] })[0]
    const s = sessionBuckets(entry, { tips: liveTips })
    expect(s.label).toBe('Duration')
    expect(s.exact).toBe(true)
    expect(s.buckets.map((x) => x.privateUSD)).toEqual([2.5, 5, 2.5, 0]) // 5m, 10m, 5m of a 20m interval
    expect(s.buckets.every((x) => x.privateUSD === 0 || x.privateEstimated)).toBe(true)
    expect(s.buckets[3].publicUSD).toBe(3)
  })

  test('imported private charges use their own timestamps', () => {
    const paid = [
      { id: 'p1', date_time: '2026-10-01T20:00:00Z', platform: 'chaturbate', username: 'Fay', username_lower: 'fay', session_type: 'private', usd: 1 },
      { id: 'p2', date_time: '2026-10-01T20:25:00Z', platform: 'chaturbate', username: 'Fay', username_lower: 'fay', session_type: 'private', usd: 2 },
    ]
    const entry = buildSessionHistory({ paidSessions: paid })[0]
    const s = sessionBuckets(entry, {})
    expect(s.buckets[0].privateUSD).toBe(1)
    expect(s.buckets[2].privateUSD).toBe(2)
    expect(s.buckets.some((x) => x.privateEstimated)).toBe(false)
  })
})

describe('sessionFanDrivers', () => {
  const history = [
    tip(1, '2026-09-20T20:00:00Z', 'Ann', 3), // earlier visit → Ann returning
    tip(2, '2026-10-01T20:00:00Z', 'Ann', 10), tip(3, '2026-10-01T20:10:00Z', 'Ben', 5),
    tip(4, '2026-10-01T20:30:00Z', 'Ann', 6), tip(5, '2026-10-01T20:40:00Z', 'Cy', 1),
    tip(6, '2026-09-25T20:00:00Z', 'Ben', 2, 'bongacams'), // Ben on another platform: different fan
  ]
  const entry = buildSessionHistory({ tips: history }).find((e) => e.startTime === '2026-10-01T20:00:00.000Z')
  const fans = sessionFanDrivers(entry, { tips: history })

  test('ranked by session USD with count and share', () => {
    expect(fans.map((f) => f.username)).toEqual(['Ann', 'Ben', 'Cy'])
    expect(fans[0]).toMatchObject({ usd: 16, count: 2, sharePct: 73 }) // 16 / 22
    expect(fans[1]).toMatchObject({ usd: 5, count: 1, sharePct: 23 })
  })

  test('returning = earlier activity for the same platform:username only', () => {
    expect(fans.find((f) => f.username === 'Ann').returning).toBe(true)
    expect(fans.find((f) => f.username === 'Ben').returning).toBe(false) // only earlier on BongaCams
    expect(fans.find((f) => f.username === 'Cy').returning).toBe(false)
  })

  test('earlier private charge also counts as returning', () => {
    const paid = [{ id: 'p', date_time: '2026-09-01T20:00:00Z', platform: 'chaturbate', username: 'Cy', session_type: 'private', usd: 1 }]
    expect(sessionFanDrivers(entry, { tips: history, paidSessions: paid }).find((f) => f.username === 'Cy').returning).toBe(true)
  })
})

import { sessionVsTypical } from '../normalize'
describe('sessionVsTypical', () => {
  const day = (d, a, b) => [tip(d * 10, `2026-09-${String(d).padStart(2, '0')}T20:00:00Z`, 'Ann', a), tip(d * 10 + 1, `2026-09-${String(d).padStart(2, '0')}T20:40:00Z`, 'Ben', b)]
  const tips = [...day(2, 20, 10), ...day(4, 10, 10), ...day(6, 15, 5), ...day(8, 8, 2), ...day(10, 5, 5), ...day(12, 6, 4), ...day(14, 30, 10)]
  const history = buildSessionHistory({ tips })
  const at = (d) => history.find((e) => e.startTime.startsWith(`2026-09-${String(d).padStart(2, '0')}`))
  test('above / below the median of the creator\'s other comparable sessions', () => {
    expect(sessionVsTypical(at(14), history)).toMatchObject({ basis: 'same', sessions: 6, medianUSD: 15, deltaPct: 167, outcome: 'above' }) // 40 vs median of 30,20,20,10,10,10
    expect(sessionVsTypical(at(8), history)).toMatchObject({ outcome: 'below', deltaPct: -50 }) // 10 vs median 20
  })
  test('falls back to all meaningful sessions, labeled, when the same platform/type has < 5', () => {
    const bc = [tip(900, '2026-09-20T20:00:00Z', 'Ola', 9, 'bongacams'), tip(901, '2026-09-20T20:40:00Z', 'Pia', 9, 'bongacams')]
    const h = buildSessionHistory({ tips: [...tips, ...bc] })
    expect(sessionVsTypical(h.find((e) => e.platforms[0] === 'bongacams'), h)).toMatchObject({ basis: 'all', sessions: 7 })
  })
  test('null with fewer than 5 comparable sessions, and for non-meaningful sessions', () => {
    const few = buildSessionHistory({ tips: tips.slice(0, 8) })
    expect(sessionVsTypical(few[0], few)).toBeNull()
    const lone = buildSessionHistory({ tips: [...tips, tip(999, '2026-09-25T10:00:00Z', 'Zed', 50)] })
    expect(sessionVsTypical(lone.find((e) => e.tipCount === 1), lone)).toBeNull()
  })
})

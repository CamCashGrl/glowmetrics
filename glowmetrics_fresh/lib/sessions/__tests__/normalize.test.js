import {
  buildSessionHistory, filterSessionHistory, dailySessionStats,
  isValidSession, fanKey, localDayKey, unlinkedTips,
} from '../normalize'

const TZ = 'America/New_York'
const NOW = new Date('2026-10-07T20:00:00Z') // 16:00 local, Oct 7

const show = {
  id: 'show-1', platform: 'chaturbate',
  startedAt: '2026-10-07T17:00:00Z', endedAt: '2026-10-07T18:00:00Z',
  durationSeconds: 3600, totalUsd: 11.16, publicUsd: 10.5, privateUsd: 0.66, privateSeconds: 120,
  privateIntervals: [{ id: 'iv1', platform: 'chaturbate', startedAt: '2026-10-07T17:10:00Z', endedAt: '2026-10-07T17:12:00Z', earningsUsd: 0.66 }],
  platformRevenue: [
    { platform: 'chaturbate', usd: 5, tips: 1 },
    { platform: 'myfreecams', usd: 3, tips: 1 },
    { platform: 'bongacams', usd: 2.5, tips: 1 },
  ],
  tipCount: 3, uniqueTippers: 3, topTipper: { username: 'Alice', usd: 5 }, isNew: true,
}

const tip = (o) => ({ id: Math.random(), tokens: 0, source: null, live_session_id: null, ...o })

const tips = [
  // Live-linked canonical tips (belong to show-1 only)
  tip({ date_time: '2026-10-07T17:05:00Z', platform: 'chaturbate', username: 'Alice', usd: 5, live_session_id: 'show-1', source: 'extension' }),
  tip({ date_time: '2026-10-07T17:06:00Z', platform: 'myfreecams', username: 'Alice', usd: 3, live_session_id: 'show-1', source: 'extension' }),
  tip({ date_time: '2026-10-07T17:07:00Z', platform: 'bongacams', username: 'Bob', usd: 2.5, live_session_id: 'show-1', source: 'extension' }),
  // Free chat earlier today (extension, not linked)
  tip({ date_time: '2026-10-07T13:00:00Z', platform: 'chaturbate', username: 'Cara', usd: 4, source: 'extension' }),
  tip({ date_time: '2026-10-07T13:40:00Z', platform: 'chaturbate', username: 'Dan', usd: 6, source: 'extension' }),
  // Imported, yesterday local (Oct 6 23:30 New York = Oct 7 03:30Z)
  tip({ date_time: '2026-10-07T03:30:00Z', platform: 'bongacams', username: 'Eve', usd: 1 }),
]

const paid = [
  { id: 9, date_time: '2026-10-07T15:00:00Z', platform: 'bongacams', username: 'Fay', session_type: 'private', usd: 7 },
]

describe('session history', () => {
  const history = buildSessionHistory({ tips, shows: [show], paidSessions: paid })

  test('live-linked tips are never grouped into a second session', () => {
    expect(unlinkedTips(tips)).toHaveLength(3)
    const nonLive = history.filter((e) => e.type !== 'live' && e.type !== 'private')
    const grouped = nonLive.reduce((n, e) => n + e.tipCount, 0)
    expect(grouped).toBe(3)
    expect(nonLive.every((e) => e.session.tips.every((t) => !t.live_session_id))).toBe(true)
  })

  test('one chronological list with type badges, newest first', () => {
    expect(history.map((e) => e.type)).toEqual(['live', 'private', 'free_chat', 'imported'])
    const times = history.map((e) => new Date(e.startTime).getTime())
    expect([...times].sort((a, b) => b - a)).toEqual(times)
  })

  test('a finalized live show is always in the history', () => {
    const onlyLive = buildSessionHistory({ tips: [], shows: [show], paidSessions: [] })
    expect(onlyLive).toHaveLength(1)
    expect(onlyLive[0]).toMatchObject({ type: 'live', totalUSD: 11.16, isNew: true, durationEstimated: false })
    expect(onlyLive[0].platforms).toEqual(['chaturbate', 'myfreecams', 'bongacams'])
  })

  test('inferred durations are labeled estimated', () => {
    const fc = history.find((e) => e.type === 'free_chat')
    expect(fc.durationEstimated).toBe(true)
    expect(fc.durationMinutes).toBe(40)
  })

  test('private imports are private earnings, never tips', () => {
    const p = history.find((e) => e.type === 'private')
    expect(p).toMatchObject({ privateUSD: 7, publicUSD: 0, tipCount: 0 })
  })

  test('filters by type and platform', () => {
    expect(filterSessionHistory(history, { type: 'live' }).map((e) => e.type)).toEqual(['live'])
    expect(filterSessionHistory(history, { platform: 'myfreecams' }).map((e) => e.type)).toEqual(['live'])
    expect(filterSessionHistory(history, { platform: 'bongacams' }).map((e) => e.type)).toEqual(['live', 'private'])
    expect(filterSessionHistory(history, { platform: 'bongacams', includeShort: true }).map((e) => e.type)).toEqual(['live', 'private', 'imported'])
    expect(filterSessionHistory(history, { type: 'free_chat', platform: 'bongacams' })).toEqual([])
  })
})

describe('daily stats (creator-local day)', () => {
  const history = buildSessionHistory({ tips, shows: [show], paidSessions: paid })
  const d = dailySessionStats({ tips, history, paidSessions: paid, tz: TZ, now: NOW })

  test('uses the creator timezone for the day boundary', () => {
    expect(d.day).toBe('2026-10-07')
    expect(localDayKey('2026-10-07T03:30:00Z', TZ)).toBe('2026-10-06')
  })

  test('public = canonical tips today; private = live private + paid; total = sum', () => {
    expect(d.publicUSD).toBe(20.5) // 5 + 3 + 2.5 + 4 + 6 (Eve is yesterday)
    expect(d.privateUSD).toBe(7.66) // 0.66 live + 7 paid
    expect(d.totalUSD).toBe(28.16)
    expect(d.tipCount).toBe(5)
  })

  test('live_tips are never read, so they cannot be added', () => {
    const withLiveTips = dailySessionStats({ tips, history, paidSessions: paid, tz: TZ, now: NOW, liveTips: [{ usd: 999 }] })
    expect(withLiveTips.totalUSD).toBe(28.16)
  })

  test('unique tippers are platform:username — Alice on two platforms is two fans', () => {
    expect(fanKey('Chaturbate', ' Alice ')).toBe('chaturbate:alice')
    expect(d.uniqueTippers).toBe(5) // cb:alice, mfc:alice, bc:bob, cb:cara, cb:dan
  })

  test('streamed time, private time, completed sessions, best platform', () => {
    expect(d.streamedMinutes).toBe(100) // 60 live + 40 estimated free chat
    expect(d.streamedEstimated).toBe(true)
    expect(d.privateMinutes).toBe(2)
    expect(d.completedSessions).toBe(2) // live show + valid 40-min/2-tip free chat
    expect(d.bestPlatform).toBe('chaturbate') // 5 + 4 + 6 + 0.66
  })

  test('today by platform', () => {
    const by = Object.fromEntries(d.platforms.map((p) => [p.platform, p]))
    expect(by.chaturbate).toMatchObject({ publicUSD: 15, privateUSD: 0.66, totalUSD: 15.66, tipCount: 3, uniqueTippers: 3 })
    expect(by.bongacams).toMatchObject({ publicUSD: 2.5, privateUSD: 7, totalUSD: 9.5, tipCount: 1 })
    expect(by.myfreecams).toMatchObject({ totalUSD: 3, uniqueTippers: 1 })
  })

  test('empty day yields zeros and no best platform', () => {
    const e = dailySessionStats({ tips: [], history: [], paidSessions: [], tz: TZ, now: NOW })
    expect(e).toMatchObject({ totalUSD: 0, tipCount: 0, uniqueTippers: 0, bestPlatform: null, completedSessions: 0 })
  })
})

describe('valid session rule', () => {
  test('requires >= 30 min AND >= 2 tips', () => {
    expect(isValidSession({ durationMinutes: 30, tipCount: 2 })).toBe(true)
    expect(isValidSession({ durationMinutes: 29, tipCount: 5 })).toBe(false)
    expect(isValidSession({ durationMinutes: 90, tipCount: 1 })).toBe(false)
  })
})

describe('total earned = public + private', () => {
  const { totalEarned, privateEarningRows } = require('../normalize')
  const { freeWindowStartByPlatform, applyFreeAnalysisWindow } = require('../../analytics')

  const paid = [{ date_time: '2026-10-01T10:00:00Z', platform: 'BongaCams', usd: 7 }]
  const intervals = [{ ended_at: '2026-10-07T17:12:00Z', platform: 'chaturbate', estimated_earnings_usd: 0.66 }]

  test('adds paid sessions and live private intervals to public tips', () => {
    const rows = privateEarningRows({ paidSessions: paid, liveIntervals: intervals })
    expect(rows).toHaveLength(2)
    expect(totalEarned({ publicUSD: 10.5, privateRows: rows })).toEqual({ publicUSD: 10.5, privateUSD: 7.66, totalUSD: 18.16 })
  })

  test('no private earnings → total equals public', () => {
    expect(totalEarned({ publicUSD: 42, privateRows: [] }).totalUSD).toBe(42)
  })

  test('free-tier window applies identically to private earnings', () => {
    const tips = [
      { date_time: '2026-10-07T10:00:00Z', platform: 'BongaCams', usd: 1 },
      { date_time: '2026-08-01T10:00:00Z', platform: 'BongaCams', usd: 1 },
    ]
    const starts = freeWindowStartByPlatform(tips)
    // Same cutoff applyFreeAnalysisWindow uses for the tips themselves.
    expect(applyFreeAnalysisWindow(tips)).toHaveLength(1)
    expect(starts.BongaCams.toISOString()).toBe('2026-09-07T10:00:00.000Z')
    const rows = privateEarningRows({ paidSessions: [
      { date_time: '2026-10-01T10:00:00Z', platform: 'bongacams', usd: 7 },  // inside
      { date_time: '2026-08-15T10:00:00Z', platform: 'bongacams', usd: 50 }, // outside
    ] })
    expect(totalEarned({ publicUSD: 1, privateRows: rows, windowStarts: starts })).toEqual({ publicUSD: 1, privateUSD: 7, totalUSD: 8 })
  })

  test('private-only platform is windowed on its own latest row', () => {
    const rows = privateEarningRows({ paidSessions: [
      { date_time: '2026-10-01T10:00:00Z', platform: 'myfreecams', usd: 5 },
      { date_time: '2026-07-01T10:00:00Z', platform: 'myfreecams', usd: 9 },
    ] })
    expect(totalEarned({ publicUSD: 0, privateRows: rows, windowStarts: {} }).privateUSD).toBe(5)
  })
})

describe('freshest performance helpers', () => {
  const N = require('../normalize')

  test('live snapshot uses only canonical tips linked to the running show', () => {
    const session = { id: 'live-1', status: 'live', started_at: '2026-10-07T19:00:00Z', active_duration_seconds: 2520 }
    const t = [
      { live_session_id: 'live-1', platform: 'chaturbate', username: 'Alice', usd: 5, date_time: '2026-10-07T19:10:00Z' },
      { live_session_id: 'live-1', platform: 'myfreecams', username: 'Alice', usd: 3, date_time: '2026-10-07T19:20:00Z' },
      { live_session_id: 'other', platform: 'chaturbate', username: 'Zed', usd: 100, date_time: '2026-10-07T19:21:00Z' },
      { live_session_id: null, platform: 'chaturbate', username: 'Zed', usd: 50, date_time: '2026-10-07T19:22:00Z' },
    ]
    const s = N.liveSessionSnapshot({ session, tips: t, privateInterval: { started_at: '2026-10-07T19:30:00Z', platform: 'Chaturbate' }, now: new Date('2026-10-07T19:40:00Z') })
    expect(s).toMatchObject({ publicUSD: 8, tipCount: 2, uniqueTippers: 2, largestTipUSD: 5, durationSeconds: 2520, lastUpdated: '2026-10-07T19:20:00.000Z' })
    expect(s.topTipper).toEqual({ username: 'Alice', platform: 'chaturbate', usd: 5 })
    expect(s.platformSplit.map((p) => [p.platform, p.share])).toEqual([['chaturbate', 63], ['myfreecams', 38]])
    expect(s.privateNow).toMatchObject({ platform: 'chaturbate', minutes: 10 })
    expect(N.liveSessionSnapshot({ session: null })).toBeNull()
  })

  test('latest performance = most recently ended non-private entry', () => {
    const h = [
      { type: 'private', endTime: '2026-10-07T23:00:00Z' },
      { type: 'free_chat', endTime: '2026-10-07T12:00:00Z' },
      { type: 'live', endTime: '2026-10-07T18:00:00Z' },
    ]
    expect(N.latestPerformance(h).type).toBe('live')
    expect(N.latestPerformance([])).toBeNull()
  })

  test('platform shares and $/hr only from exact time', () => {
    const base = { totalUSD: 10, streamedMinutes: 60, streamedEstimated: false, platforms: [{ platform: 'chaturbate', totalUSD: 7.5 }, { platform: 'bongacams', totalUSD: 2.5 }] }
    const d = N.withTodayDerived(base)
    expect(d.platforms.map((p) => p.share)).toEqual([75, 25])
    expect(d.usdPerHour).toBe(10)
    expect(N.withTodayDerived({ ...base, streamedEstimated: true }).usdPerHour).toBeNull()
    expect(N.withTodayDerived({ ...base, streamedMinutes: 0 }).usdPerHour).toBeNull()
  })

  test('today signal is truthful or absent', () => {
    expect(N.todaySignal({ totalUSD: 11.13, platforms: [{ platform: 'chaturbate', totalUSD: 5.63 }, { platform: 'myfreecams', totalUSD: 3 }] }, (p) => p.toUpperCase()))
      .toBe('CHATURBATE is leading today with 51% of your earnings.')
    expect(N.todaySignal({ totalUSD: 4, platforms: [{ platform: 'bongacams', totalUSD: 4 }] })).toBe("All of today's earnings so far came from bongacams.")
    expect(N.todaySignal({ totalUSD: 0, platforms: [] })).toBeNull()
  })

  test('same-weekday comparison needs 3+ earning days and compares by this time', () => {
    const now = new Date('2026-10-07T20:00:00Z') // Wednesday
    const tips = [
      { date_time: '2026-10-07T15:00:00Z', usd: 12 },              // today
      { date_time: '2026-09-30T15:00:00Z', usd: 10 },              // Wed, before 20:00
      { date_time: '2026-09-30T21:00:00Z', usd: 500 },             // Wed, after 20:00 → excluded
      { date_time: '2026-09-23T15:00:00Z', usd: 8 },
      { date_time: '2026-09-16T15:00:00Z', usd: 20 },
      { date_time: '2026-09-29T15:00:00Z', usd: 999 },             // Tuesday → excluded
    ]
    expect(N.typicalSameWeekdayByNow({ tips, tz: 'UTC', now })).toEqual({ weekday: 'Wed', todayUSD: 12, typicalUSD: 10, days: 3, deltaPct: 20 })
    expect(N.typicalSameWeekdayByNow({ tips: tips.slice(0, 3), tz: 'UTC', now })).toBeNull()
  })
})

describe('short tip groups are not sessions', () => {
  const N = require('../normalize')
  const lone = [{ id: 1, date_time: '2026-10-07T10:00:00Z', platform: 'chaturbate', username: 'X', usd: 0.5, tokens: 10, source: 'extension', live_session_id: null }]
  const h = N.buildSessionHistory({ tips: lone })

  test('a single $0.50 tip is hidden from history by default, shown on request', () => {
    expect(h).toHaveLength(1)
    expect(h[0]).toMatchObject({ isValid: false, durationUnknown: true, totalUSD: 0.5 })
    expect(N.filterSessionHistory(h)).toEqual([])
    expect(N.filterSessionHistory(h, { includeShort: true })).toHaveLength(1)
  })

  test('its money still counts in today totals', () => {
    const d = N.dailySessionStats({ tips: lone, history: h, tz: 'UTC', now: new Date('2026-10-07T20:00:00Z') })
    expect(d).toMatchObject({ publicUSD: 0.5, tipCount: 1, completedSessions: 0 })
  })

  test('latest performance never picks a short tip group', () => {
    expect(N.latestPerformance(h)).toBeNull()
  })
})

describe('freshness helpers use only real timestamps', () => {
  const N = require('../normalize')
  const now = new Date('2026-10-07T20:00:00Z')
  const tips = [
    { date_time: '2026-10-07T19:55:00Z', platform: 'bongacams', username: 'A', usd: 6.5 },
    { date_time: '2026-10-07T19:30:00Z', platform: 'chaturbate', username: 'B', usd: 5 },
    { date_time: '2026-10-07T20:05:00Z', platform: 'bongacams', username: 'C', usd: 99 }, // future → ignored
  ]

  test('recent activity counts only the window', () => {
    expect(N.recentActivity({ tips, now })).toEqual({ minutes: 10, usd: 6.5, count: 1, lastTipAt: '2026-10-07T19:55:00.000Z' })
    expect(N.recentActivity({ tips: [], now }).lastTipAt).toBeNull()
  })

  test('leader shift only when the #1 platform actually changed', () => {
    const s = N.leaderShift({ tips: tips.slice(0, 2), tz: 'UTC', now })
    expect(s).toEqual({ platform: 'bongacams', previous: 'chaturbate', minutes: 10 })
    expect(N.leaderShift({ tips: [tips[1]], tz: 'UTC', now })).toBeNull()
  })

  test('hourly buckets for today', () => {
    const h = N.todayHourly({ tips: tips.slice(0, 2), tz: 'UTC', now })
    expect(h[19]).toBe(11.5)
    expect(h.reduce((a, b) => a + b, 0)).toBe(11.5)
  })

  test('time ago', () => {
    expect(N.timeAgo('2026-10-07T19:59:42Z', now)).toBe('18s ago')
    expect(N.timeAgo('2026-10-07T19:56:00Z', now)).toBe('4 min ago')
    expect(N.timeAgo(null, now)).toBeNull()
  })
})

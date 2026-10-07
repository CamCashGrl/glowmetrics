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
    expect(filterSessionHistory(history, { platform: 'bongacams' }).map((e) => e.type)).toEqual(['live', 'private', 'imported'])
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

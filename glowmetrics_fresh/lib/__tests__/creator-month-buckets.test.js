import { aggregateRows, computePaidSessionAnalytics } from '../analytics'

// A tip at 2026-10-01T03:00Z is still September 30 in Los Angeles (8 PM PDT),
// so it belongs to the creator's September, not UTC October.
const tip = (iso, usd = 5, username = 'fan1') => ({
  date_time: iso, dateRaw: iso, username, usd, tokens: usd * 20, platform: 'chaturbate', tip_type: 'tip',
})

describe('monthly buckets follow the creator timezone', () => {
  const tips = [
    tip('2026-09-30T20:00:00Z', 10),
    tip('2026-10-01T03:00:00Z', 7),
    tip('2026-10-15T20:00:00Z', 4),
  ]

  it('aggregateRows monthlyData uses creator-local months', () => {
    const la = aggregateRows(tips, 'America/Los_Angeles').monthlyData
    expect(la.find(m => m.month === '2026-09').usd).toBe(17)
    expect(la.find(m => m.month === '2026-10').usd).toBe(4)

    const utc = aggregateRows(tips, 'UTC').monthlyData
    expect(utc.find(m => m.month === '2026-09').usd).toBe(10)
    expect(utc.find(m => m.month === '2026-10').usd).toBe(11)
  })

  it('totals are unchanged; only the month a tip lands in moves', () => {
    const sum = rows => rows.reduce((s, m) => s + m.usd, 0)
    expect(sum(aggregateRows(tips, 'America/Los_Angeles').monthlyData)).toBe(21)
    expect(sum(aggregateRows(tips, 'UTC').monthlyData)).toBe(21)
  })

  it('paid-session analytics bucket hours and months on the creator clock', () => {
    const sessions = [{ date_time: '2026-10-01T03:00:00Z', usd: 12, username: 'a', session_type: 'private' }]
    const r = computePaidSessionAnalytics(sessions, 'America/Los_Angeles')
    expect(r.peakHours[0].hour).toBe(20)
    expect(r.monthlyTrend[0].month).toBe('2026-09')
    const u = computePaidSessionAnalytics(sessions)
    expect(u.peakHours[0].hour).toBe(3)
    expect(u.monthlyTrend[0].month).toBe('2026-10')
  })
})

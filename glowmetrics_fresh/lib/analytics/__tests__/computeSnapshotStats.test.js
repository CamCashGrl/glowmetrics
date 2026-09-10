import { computeSnapshotStats } from '../../analytics.js'

const day = (n) => new Date(2026, 0, n).toISOString()

describe('computeSnapshotStats — Free-tier 31-day window math', () => {
  test('fewer than 31 days: recent window equals the full range, marked partial', () => {
    const rows = [
      { date: day(1), tokens: 100, usd: 5 },
      { date: day(5), tokens: 100, usd: 5 },
      { date: day(10), tokens: 100, usd: 5 },
    ]
    const { full, recent } = computeSnapshotStats(rows, 31)
    expect(full.days).toBe(10)
    expect(full.tips).toBe(3)
    expect(recent.isPartial).toBe(true)
    expect(recent.days).toBe(10)
    expect(recent.tips).toBe(3)
    expect(recent.usd).toBe(full.usd)
  })

  test('exactly 31 days: recent window covers the whole range', () => {
    const rows = []
    for (let i = 1; i <= 31; i++) rows.push({ date: day(i), tokens: 10, usd: 0.5 })
    const { full, recent } = computeSnapshotStats(rows, 31)
    expect(full.days).toBe(31)
    expect(recent.days).toBe(31)
    expect(recent.tips).toBe(31)
    expect(recent.isPartial).toBe(false)
  })

  test('2 years imported: recent window uses only the most recent 31 days, not the first 31', () => {
    const rows = []
    // day 1 (old) and day 600 (recent) — 600 days apart, well over a year
    const base = new Date(2024, 0, 1)
    for (let i = 0; i < 600; i += 5) {
      rows.push({ date: new Date(base.getTime() + i * 86400000).toISOString(), tokens: 20, usd: 1 })
    }
    // Add a cluster in the final 31 days
    for (let i = 570; i < 600; i++) {
      rows.push({ date: new Date(base.getTime() + i * 86400000).toISOString(), tokens: 100, usd: 5 })
    }
    const { full, recent } = computeSnapshotStats(rows, 31)
    expect(full.tips).toBe(rows.length)
    // Recent window's earliest date must be near the END of the range, not the start
    const fullSpanMs = full.to - full.from
    const recentStartOffsetMs = recent.from - full.from
    expect(recentStartOffsetMs).toBeGreaterThan(fullSpanMs * 0.9) // recent.from is near full.to
    expect(recent.days).toBeLessThanOrEqual(31)
    expect(recent.tips).toBeLessThan(full.tips) // did not include the whole 2-year history
  })

  test('empty input never throws and returns zeroed stats, not fabricated values', () => {
    const { full, recent } = computeSnapshotStats([], 31)
    expect(full.tips).toBe(0)
    expect(full.days).toBe(0)
    expect(recent.tips).toBe(0)
    expect(recent.isPartial).toBe(true)
  })

  test('single day of data', () => {
    const rows = [{ date: day(15), tokens: 50, usd: 2.5 }]
    const { full, recent } = computeSnapshotStats(rows, 31)
    expect(full.days).toBe(1)
    expect(full.tips).toBe(1)
    expect(recent.days).toBe(1)
    expect(recent.isPartial).toBe(true)
  })

  test('accepts Date objects, dateRaw strings, and ts fields interchangeably', () => {
    const rows = [
      { ts: new Date(2026, 0, 1), tokens: 10, usd: 1 },
      { dateRaw: '2026-01-02', tokens: 10, usd: 1 },
      { date: '2026-01-03', tokens: 10, usd: 1 },
    ]
    const { full } = computeSnapshotStats(rows, 31)
    expect(full.tips).toBe(3)
    expect(full.days).toBe(3)
  })
})

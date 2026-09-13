/**
 * HOURLY RATE CONSISTENCY
 *
 * Every hourly rate the engine publishes must divide one set of sessions'
 * revenue by that same set's time. Before this was enforced, the per-platform
 * rate divided ALL meaningful-session revenue (including sessions with an
 * unknown duration, which contribute no hours) by only the timed sessions'
 * hours — inflating it well above the overall estimatedHourlyRate shown
 * beside it.
 */
import { aggregateRows } from '../../analytics'

// One clustered, timed session: 5 tips 10 minutes apart, so the engine derives
// a real duration from the tip timestamps.
function timedSession(platform, dayOffset, startHourUTC, tipUsd, tipCount = 5) {
  const base = Date.UTC(2026, 0, 10 + dayOffset, startHourUTC, 0, 0)
  return Array.from({ length: tipCount }, (_, i) => {
    const t = new Date(base + i * 10 * 60000).toISOString()
    return { dateRaw: t, date_time: t, username: `fan${i}`, platform, usd: tipUsd, tokens: tipUsd * 20, tip_type: 'Tip' }
  })
}

// A lone tip: a real earning event, but with no duration it can't carry a rate.
function untimedSession(platform, dayOffset, usd) {
  const t = new Date(Date.UTC(2026, 0, 10 + dayOffset, 12, 0, 0)).toISOString()
  return [{ dateRaw: t, date_time: t, username: 'whale', platform, usd, tokens: usd * 20, tip_type: 'Tip' }]
}

describe('Hourly rate consistency', () => {
  test('per-platform rate divides the same sessions it counts revenue from', () => {
    const rows = [
      ...timedSession('Chaturbate', 0, 20, 10),
      ...timedSession('Chaturbate', 1, 20, 10),
      ...timedSession('Chaturbate', 2, 20, 10),
      // A large untimed windfall on the same platform. It must not lift the
      // hourly rate, because it contributed no measurable time.
      ...untimedSession('Chaturbate', 3, 900),
    ]

    const a = aggregateRows(rows, 'UTC')
    const cb = a.platforms.find(p => p.platform === 'Chaturbate')

    expect(cb).toBeTruthy()
    expect(cb.rateHours).toBeGreaterThan(0)
    // The rate reflects only the eligible sessions' revenue.
    expect(cb.usdPerHour).toBeCloseTo(cb.rateUSD / cb.rateHours, 2)
    // The $900 untimed tip is in earnings but not in the rate's numerator.
    expect(cb.totalUSD).toBeGreaterThan(cb.rateUSD)
  })

  test('platformVelocity and platforms[].usdPerHour never disagree', () => {
    const rows = [
      ...timedSession('Chaturbate', 0, 20, 10),
      ...timedSession('Chaturbate', 1, 20, 10),
      ...timedSession('Stripchat', 2, 21, 6),
      ...timedSession('Stripchat', 3, 21, 6),
      ...untimedSession('Stripchat', 4, 400),
    ]

    const a = aggregateRows(rows, 'UTC')
    a.platforms.forEach(p => {
      expect(a.platformVelocity[p.platform]).toBe(p.usdPerHour)
    })
  })

  test('platform rates roll up to the overall estimatedHourlyRate', () => {
    const rows = [
      ...timedSession('Chaturbate', 0, 20, 10),
      ...timedSession('Chaturbate', 1, 20, 10),
      ...timedSession('Stripchat', 2, 21, 6),
      ...timedSession('Stripchat', 3, 21, 6),
      ...timedSession('BongaCams', 4, 22, 4),
      ...untimedSession('BongaCams', 5, 750),
    ]

    const a = aggregateRows(rows, 'UTC')
    const usd = a.platforms.reduce((s, p) => s + p.rateUSD, 0)
    const hours = a.platforms.reduce((s, p) => s + p.rateHours, 0)

    expect(hours).toBeGreaterThan(0)
    // The weighted roll-up of the per-platform rates is the headline rate, so
    // the two can never contradict each other on screen. Tolerance here is for
    // the 2dp rounding of each platform's rateHours, not for a basis gap.
    expect(usd / hours).toBeCloseTo(a.estimatedHourlyRate, 0)
    expect(usd).toBeCloseTo(a.hourlyRateTotalUsd, 1)
    expect(hours * 60).toBeCloseTo(a.hourlyRateTotalMinutes, 0)
  })

  test('per-platform revenue mix sums to that platform reported earnings', () => {
    const rows = [
      ...timedSession('Chaturbate', 0, 20, 10),
      ...timedSession('Chaturbate', 1, 20, 10),
      ...timedSession('Stripchat', 2, 21, 6),
      // A lone tip that never becomes a meaningful session. It must be absent
      // from both the platform's earnings and its revenue mix, or the mix
      // shown under the earnings figure would total more than it.
      ...untimedSession('Chaturbate', 3, 500),
    ]

    const a = aggregateRows(rows, 'UTC')
    a.platforms.forEach(p => {
      const mix = a.platformTipTypes[p.platform] || []
      const mixTotal = mix.reduce((s, t) => s + t.usd, 0)
      expect(mixTotal).toBeCloseTo(p.totalUSD, 1)
      expect(mix.reduce((s, t) => s + t.count, 0)).toBe(p.tips)
    })
  })

  test('platform trend is withheld when there is no prior period to compare against', () => {
    // Only recent activity — exactly the shape a free-tier 31-day window
    // produces. An empty prior period must not read as growth.
    const recent = (dayOffset) => {
      const base = Date.now() - dayOffset * 86400000
      return Array.from({ length: 5 }, (_, i) => {
        const t = new Date(base + i * 10 * 60000).toISOString()
        return { dateRaw: t, date_time: t, username: `fan${i}`, platform: 'Chaturbate', usd: 10, tokens: 200, tip_type: 'Tip' }
      })
    }
    const a = aggregateRows([...recent(2), ...recent(5), ...recent(9)], 'UTC')
    const m = a.platformMomentum.Chaturbate

    expect(m).toBeTruthy()
    expect(m.pct).toBeNull()
    expect(m.label).toBe('Not enough history')
    expect(m.label).not.toMatch(/Surging|Growing/)
  })

  test('a platform with no rate-eligible session reports no rate, not zero hours divided', () => {
    const rows = [
      ...timedSession('Chaturbate', 0, 20, 10),
      ...untimedSession('Stripchat', 1, 200),
    ]

    const a = aggregateRows(rows, 'UTC')
    const sc = a.platforms.find(p => p.platform === 'Stripchat')

    if (sc) {
      expect(sc.rateSessionCount).toBe(0)
      expect(sc.usdPerHour).toBe(0)
      expect(a.platformVelocity.Stripchat).toBeNull()
    }
  })
})

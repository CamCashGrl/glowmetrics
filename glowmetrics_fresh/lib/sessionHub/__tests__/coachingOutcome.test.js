import { describe, it, expect } from 'vitest'
import { computeCoachingOutcomeWindows, dedupeOutcomesByEventId } from '../coachingOutcome'

const promptShownAt = '2026-07-14T21:00:00Z'
const min = (n) => n * 60_000
const at = (offsetMinutes) => new Date(new Date(promptShownAt).getTime() + min(offsetMinutes)).toISOString()

describe('computeCoachingOutcomeWindows', () => {
  it('captures before/after tip counts and earnings correctly', () => {
    const tips = [
      { timestamp: at(-4), usd: 5, username: 'alex' },   // before5m
      { timestamp: at(-6), usd: 100, username: 'zed' },  // outside before5m, must be excluded
      { timestamp: at(2), usd: 10, username: 'bo' },      // after5m/10m/20m
      { timestamp: at(8), usd: 20, username: 'cleo' },    // after10m/20m only
      { timestamp: at(15), usd: 30, username: 'dee' },    // after20m only
      { timestamp: at(25), usd: 999, username: 'far' },   // outside all after windows
    ]
    const result = computeCoachingOutcomeWindows({ promptShownAt, tips })

    expect(result.tipsBefore5m).toBe(1)
    expect(result.earningsBefore5m).toBe(5)

    expect(result.tipsAfter5m).toBe(1)
    expect(result.earningsAfter5m).toBe(10)

    expect(result.tipsAfter10m).toBe(2)
    expect(result.earningsAfter10m).toBe(30)

    expect(result.tipsAfter20m).toBe(3)
    expect(result.earningsAfter20m).toBe(60)
  })

  it('does not let the before window and after windows overlap at the boundary', () => {
    // A tip at the exact prompt timestamp must land in "after", not "before".
    const tips = [{ timestamp: promptShownAt, usd: 7, username: 'edge' }]
    const result = computeCoachingOutcomeWindows({ promptShownAt, tips })
    expect(result.tipsBefore5m).toBe(0)
    expect(result.tipsAfter5m).toBe(1)
  })

  it('reports whether a related supporter tipped again within the window', () => {
    const tips = [{ timestamp: at(3), usd: 5, username: 'Alex' }]
    const result = computeCoachingOutcomeWindows({ promptShownAt, tips, relatedTipperName: 'alex' })
    expect(result.relatedSupporterTippedAgain5m).toBe(true)
    expect(result.relatedSupporterTippedAgain10m).toBe(true)
  })

  it('returns null (not false) for related-supporter fields when there is no related tipper', () => {
    const result = computeCoachingOutcomeWindows({ promptShownAt, tips: [] })
    expect(result.relatedSupporterTippedAgain5m).toBeNull()
    expect(result.relatedSupporterTippedAgain10m).toBeNull()
  })
})

describe('dedupeOutcomesByEventId', () => {
  it('keeps only one outcome record per coachingEventId', () => {
    const outcomes = [
      { coachingEventId: 'evt_1', earningsAfter5m: 1 },
      { coachingEventId: 'evt_2', earningsAfter5m: 2 },
      { coachingEventId: 'evt_1', earningsAfter5m: 1.5 }, // re-run of the same event
    ]
    const deduped = dedupeOutcomesByEventId(outcomes)
    expect(deduped).toHaveLength(2)
    expect(deduped.filter(o => o.coachingEventId === 'evt_1')).toHaveLength(1)
  })
})

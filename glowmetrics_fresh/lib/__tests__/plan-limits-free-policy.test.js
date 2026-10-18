import {
  FREE_PLATFORM_LIMIT,
  FREE_ANALYTICS_PLATFORM_LIMIT,
  FREE_ANALYSIS_WINDOW_DAYS,
  FREE_FULL_INSIGHT_IDS,
  FREE_LIVE_STREAMS_PER_WEEK,
  FREE_LIVE_STREAM_MINUTES,
  TRIAL_DAYS,
  TRIAL_ANALYSIS_WINDOW_DAYS,
  TRIAL_LIVE_STREAMS_TOTAL,
  TRIAL_LIVE_STREAM_MINUTES,
  PRO_MONTHLY_PRICE,
  platformLimitMessage,
  freeHistoryMessage,
  trialLimitMessage,
} from '../planLimits'

describe('canonical Free + trial product policy', () => {
  test('uploads are not capped by platform count, but detailed Free analytics are limited to one platform', () => {
    expect(FREE_PLATFORM_LIMIT).toBe(Number.POSITIVE_INFINITY)
    expect(FREE_ANALYTICS_PLATFORM_LIMIT).toBe(1)
  })

  test('Free detailed analytics use a rolling 31-day window', () => {
    expect(FREE_ANALYSIS_WINDOW_DAYS).toBe(31)
    expect(platformLimitMessage()).toContain('1 platform')
    expect(platformLimitMessage()).toContain('31-day')
    expect(freeHistoryMessage()).toContain('31 days')
    expect(freeHistoryMessage()).not.toMatch(/full history on your primary/i)
  })

  test('platform comparison is the only full Free insight surface', () => {
    expect(FREE_FULL_INSIGHT_IDS).toEqual(['platformComparison'])
  })

  test('Free Live Mode stays at 2 streams per week and 30 active minutes each', () => {
    expect(FREE_LIVE_STREAMS_PER_WEEK).toBe(2)
    expect(FREE_LIVE_STREAM_MINUTES).toBe(30)
  })

  test('trial is capped and never grants unlimited history or Live Mode', () => {
    expect(TRIAL_DAYS).toBe(7)
    expect(TRIAL_ANALYSIS_WINDOW_DAYS).toBe(31)
    expect(TRIAL_LIVE_STREAMS_TOTAL).toBe(2)
    expect(TRIAL_LIVE_STREAM_MINUTES).toBe(30)
    expect(trialLimitMessage()).toMatch(/7-day trial/i)
    expect(trialLimitMessage()).toMatch(/1 analytics platform/i)
    expect(trialLimitMessage()).toMatch(/31 days/i)
  })

  test('conversion copy uses the approved $9.99 monthly price', () => {
    expect(PRO_MONTHLY_PRICE).toBe(9.99)
    expect(freeHistoryMessage()).toContain('$9.99/mo')
  })
})

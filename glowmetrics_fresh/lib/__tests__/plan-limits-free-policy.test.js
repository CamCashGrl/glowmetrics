import {
  FREE_PLATFORM_LIMIT,
  FREE_ANALYSIS_WINDOW_DAYS,
  FREE_LIVE_STREAMS_PER_WEEK,
  FREE_LIVE_STREAM_MINUTES,
  PRO_MONTHLY_PRICE,
  platformLimitMessage,
  freeHistoryMessage,
} from '../planLimits'

describe('canonical Free plan policy', () => {
  test('Free has no platform-count ceiling', () => {
    expect(FREE_PLATFORM_LIMIT).toBe(Number.POSITIVE_INFINITY)
  })

  test('Free history is rolling 31 days on every supported platform', () => {
    expect(FREE_ANALYSIS_WINDOW_DAYS).toBe(31)
    expect(platformLimitMessage()).toContain('all supported platforms')
    expect(platformLimitMessage()).toContain('31-day')
    expect(platformLimitMessage()).not.toMatch(/3 platforms|primary|secondary/i)
  })

  test('Live Mode tasting limits stay at 2 streams and 30 minutes', () => {
    expect(FREE_LIVE_STREAMS_PER_WEEK).toBe(2)
    expect(FREE_LIVE_STREAM_MINUTES).toBe(30)
  })

  test('conversion copy uses the approved $9.99 monthly price', () => {
    expect(PRO_MONTHLY_PRICE).toBe(9.99)
    expect(freeHistoryMessage()).toContain('$9.99/mo')
  })
})

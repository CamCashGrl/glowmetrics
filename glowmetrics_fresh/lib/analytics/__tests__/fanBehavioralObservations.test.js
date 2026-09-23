import { identifyWhales } from '../../analytics.js'

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()
const hoursAgo = (n) => new Date(Date.now() - n * 3600000).toISOString()

// Build tips for a single burst visit: `count` tips minutes apart, all
// `daysBack` days ago (well within the 3-hour same-visit gap).
function burstVisit(username, platform, count, daysBack, usdEach = 10) {
  const tips = []
  for (let i = 0; i < count; i++) {
    const t = new Date(Date.now() - daysBack * 86400000 + i * 60000).toISOString() // 1 min apart
    tips.push({ username, platform, usd: usdEach, tokens: 0, dateRaw: t, date_time: t })
  }
  return tips
}

// Build tips across `visits` distinct visits, each `spacingDays` apart,
// each containing `tipsPerVisit` tips minutes apart (one visit), ending
// `lastDaysAgo` ago.
function multiVisitTips(username, platform, visits, tipsPerVisit, spacingDays, lastDaysAgo, usdEach = 10) {
  const tips = []
  for (let v = 0; v < visits; v++) {
    const visitDaysBack = lastDaysAgo + (visits - 1 - v) * spacingDays
    for (let i = 0; i < tipsPerVisit; i++) {
      const t = new Date(Date.now() - visitDaysBack * 86400000 + i * 60000).toISOString()
      tips.push({ username, platform, usd: usdEach, tokens: 0, dateRaw: t, date_time: t })
    }
  }
  return tips
}

describe('Fan behavioral observation model — raw visits vs raw tips', () => {
  test('TEST A: single burst — 10 tips, one 20-minute visit, no later activity', () => {
    const tips = []
    for (let i = 0; i < 10; i++) {
      const t = new Date(Date.now() - 5 * 86400000 + i * 2 * 60000).toISOString() // 2 min apart, ~18min total
      tips.push({ username: 'burstFan', platform: 'Chaturbate', usd: 10, tokens: 0, dateRaw: t, date_time: t })
    }
    const [fan] = identifyWhales(tips, [])

    expect(fan.tipCount).toBe(10)
    expect(fan.observationCount).toBe(1)
    expect(fan.baselineEstablished).toBe(false)
    expect(fan.avgDaysBetweenTips).toBeNull() // no fabricated "usually every 1 day"
    expect(fan.expectedNextTip).toBeNull()
    expect(fan.tipProbability).toBeNull()
    expect(fan.behavioralState).not.toBe('At Risk')
    expect(['New/Developing', 'Insufficient Data']).toContain(fan.behavioralState)
    expect(fan.trend.direction).toBe('insufficient') // only 1 visit, far below the 4-visit trend floor
    expect(fan.lifetimeValue.monthly).toBeNull()
  })

  test('TEST B: three distinct visits ~10 days apart — baseline becomes established', () => {
    // Visit 1: 10 tips, Visit 2: 2 tips (10 days later), Visit 3: 3 tips (10 days later)
    const tips = [
      ...burstVisit('threeVisitFan', 'Chaturbate', 10, 20),
      ...burstVisit('threeVisitFan', 'Chaturbate', 2, 10),
      ...burstVisit('threeVisitFan', 'Chaturbate', 3, 0),
    ]
    const [fan] = identifyWhales(tips, [])

    expect(fan.tipCount).toBe(15)
    expect(fan.observationCount).toBe(3)
    expect(fan.baselineEstablished).toBe(true)
    expect(fan.avgDaysBetweenTips).not.toBeNull()
    expect(fan.avgDaysBetweenTips).toBeGreaterThan(8)
    expect(fan.avgDaysBetweenTips).toBeLessThan(12) // ~10 days
    expect(fan.expectedNextTip).not.toBeNull()
    expect(['Active', 'Watch', 'At Risk', 'Dormant']).toContain(fan.behavioralState)
  })

  test('TEST C: same total tips, different behavior — Fan A (1 visit) vs Fan B (5 visits) must NOT share a baseline', () => {
    const tipsA = burstVisit('sameTotalA', 'Chaturbate', 10, 5)
    const tipsB = multiVisitTips('sameTotalB', 'Chaturbate', 5, 2, 4, 5)

    const [fanA] = identifyWhales(tipsA, [])
    const [fanB] = identifyWhales(tipsB, [])

    expect(fanA.tipCount).toBe(10)
    expect(fanB.tipCount).toBe(10)
    expect(fanA.observationCount).toBe(1)
    expect(fanB.observationCount).toBe(5)
    expect(fanA.baselineEstablished).toBe(false)
    expect(fanB.baselineEstablished).toBe(true)
    expect(fanA.avgDaysBetweenTips).toBeNull()
    expect(fanB.avgDaysBetweenTips).not.toBeNull()
  })

  test('TEST D: spend decline reflects behavioral visits, not individual tip-event noise', () => {
    // 6 visits, one tip each: earlier 3 = $100,$90,$80 ; recent 3 = $40,$30,$35
    const amounts = [100, 90, 80, 40, 30, 35]
    const tips = amounts.map((usd, i) => {
      const daysBack = (amounts.length - 1 - i) * 5 // 5 days apart, chronological
      const t = new Date(Date.now() - daysBack * 86400000).toISOString()
      return { username: 'declineFan', platform: 'Chaturbate', usd, tokens: 0, dateRaw: t, date_time: t }
    })
    const [fan] = identifyWhales(tips, [])

    expect(fan.observationCount).toBe(6)
    expect(fan.spendDeclineRatio).not.toBeNull()
    // recentAvg (40+30+35)/3=35, earlierAvg (100+90+80)/3=90 -> ratio ~0.389
    expect(fan.spendDeclineRatio).toBeLessThan(0.5)
  })

  test('TEST E: platform + username identity — same username, different platforms stay separate', () => {
    const tipsA = burstVisit('crossPlatformUser', 'Chaturbate', 10, 5)
    const tipsB = multiVisitTips('crossPlatformUser', 'BongaCams', 5, 2, 4, 5)
    const fans = identifyWhales([...tipsA, ...tipsB], [])

    expect(fans.length).toBe(2)
    const cb = fans.find(f => f.platform === 'Chaturbate')
    const bc = fans.find(f => f.platform === 'BongaCams')
    expect(cb.observationCount).toBe(1)
    expect(bc.observationCount).toBe(5)
    expect(cb.baselineEstablished).toBe(false)
    expect(bc.baselineEstablished).toBe(true)
  })
})

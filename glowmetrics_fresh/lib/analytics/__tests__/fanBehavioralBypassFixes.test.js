// Regression tests for the three approved individual-fan behavioral-insight
// bypass fixes (generateLossAlerts fan_churn, WIN BACK, ONLINE NOW/SOON).
// See lib/analytics.js calcFanBehavioralState / identifyWhales for the
// canonical, baseline-gated rules these alerts must now defer to.
import { identifyWhales, generateLossAlerts } from '../../analytics.js'

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

function meaningfulSession(platform, daysAgoStart) {
  return {
    platform,
    startTime: daysAgo(daysAgoStart),
    endTime: daysAgo(daysAgoStart - 0.05),
    durationMinutes: 70,
    totalUSD: 40,
    sessionQuality: 'meaningful',
  }
}

// One burst visit: `count` tips minutes apart, all `daysBack` days ago.
function burstVisit(username, platform, count, daysBack, usdEach = 60) {
  const tips = []
  for (let i = 0; i < count; i++) {
    const t = new Date(Date.now() - daysBack * 86400000 + i * 60000).toISOString()
    tips.push({ username, platform, usd: usdEach, tokens: 0, dateRaw: t, date_time: t })
  }
  return tips
}

// `visits` distinct visits, `spacingDays` apart, ending `lastDaysAgo` ago.
function multiVisitTips(username, platform, visits, spacingDays, lastDaysAgo, usdEach = 60) {
  const tips = []
  for (let v = 0; v < visits; v++) {
    const daysBack = lastDaysAgo + (visits - 1 - v) * spacingDays
    const t = new Date(Date.now() - daysBack * 86400000).toISOString()
    tips.push({ username, platform, usd: usdEach, tokens: 0, dateRaw: t, date_time: t })
  }
  return tips
}

describe('generateLossAlerts fan_churn — canonical gate only', () => {
  test('TEST 1: single-visit $50+ fan, several days since visit → no fan_churn alert', () => {
    const tips = burstVisit('singleVisitFan', 'Chaturbate', 3, 8, 20) // $60 total, 1 visit, 8 days ago
    const whales = identifyWhales(tips, [])
    const [fan] = whales
    expect(fan.observationCount).toBe(1)
    expect(fan.baselineEstablished).toBe(false)
    expect(fan.behavioralState).not.toBe('At Risk')

    const alerts = generateLossAlerts(tips, [], whales, null)
    const churnAlerts = alerts.filter(a => a.type === 'fan_churn')
    expect(churnAlerts.length).toBe(0)
  })

  test('TEST 5: fan with an established baseline and canonical At Risk state → fan_churn alert still fires', () => {
    // Visits every ~5 days, most recent 15 days ago (r=3, well over the
    // evidence-of-decline threshold), creator active/eligible via recent
    // meaningful sessions on the same platform.
    const tips = multiVisitTips('atRiskFan', 'Chaturbate', 4, 5, 15)
    const sessions = [meaningfulSession('Chaturbate', 1), meaningfulSession('Chaturbate', 3)]
    const whales = identifyWhales(tips, sessions)
    const [fan] = whales
    expect(fan.baselineEstablished).toBe(true)
    expect(fan.behavioralState).toBe('At Risk')

    const alerts = generateLossAlerts(tips, sessions, whales, null)
    const churnAlerts = alerts.filter(a => a.type === 'fan_churn')
    expect(churnAlerts.length).toBe(1)
    expect(churnAlerts[0].message).toContain('atRiskFan')
  })

  test('TEST 4 / TEST 6: raw tip count cannot bypass the gate, and descriptive data remains available', () => {
    // 6 raw tips, all one burst visit -- tipCount is high, observationCount is not.
    const tips = burstVisit('burstOnlyFan', 'Chaturbate', 6, 6, 15)
    const whales = identifyWhales(tips, [])
    const [fan] = whales
    expect(fan.tipCount).toBe(6)
    expect(fan.observationCount).toBe(1)
    expect(fan.baselineEstablished).toBe(false)

    const alerts = generateLossAlerts(tips, [], whales, null)
    expect(alerts.filter(a => a.type === 'fan_churn').length).toBe(0)

    // Descriptive fields must still be present and correct.
    expect(fan.totalUSD).toBeCloseTo(90)
    expect(fan.avgTipSize).toBeCloseTo(15)
    expect(fan.platform).toBe('Chaturbate')
    expect(fan.lastTipDate).toBeTruthy()
    expect(fan.firstTipDate).toBeTruthy()
  })

  test('TEST 8: platform + username identity — same username on two platforms stay separate for the churn gate', () => {
    const tipsA = burstVisit('crossPlatformFan', 'Chaturbate', 3, 8, 20) // 1 visit -> not eligible
    const tipsB = multiVisitTips('crossPlatformFan', 'BongaCams', 4, 5, 15) // established -> At Risk
    const sessions = [meaningfulSession('BongaCams', 1), meaningfulSession('BongaCams', 3)]
    const whales = identifyWhales([...tipsA, ...tipsB], sessions)

    const cb = whales.find(w => w.platform === 'Chaturbate')
    const bc = whales.find(w => w.platform === 'BongaCams')
    expect(cb.baselineEstablished).toBe(false)
    expect(bc.baselineEstablished).toBe(true)

    const alerts = generateLossAlerts([...tipsA, ...tipsB], sessions, whales, null)
    const churnCount = alerts.filter(a => a.type === 'fan_churn').length
    // Only the eligible BongaCams observation may produce a churn alert,
    // never the Chaturbate single-visit one, even though usernames match.
    // With the canonical gate, at most one fan_churn alert can exist here
    // (from bc), and it can only exist if bc is actually 'At Risk'.
    expect(churnCount).toBe(bc.behavioralState === 'At Risk' ? 1 : 0)
    expect(cb.behavioralState).not.toBe('At Risk')
  })
})

// The DORMANT quick action (app/dashboard/page.js) now gates on
// behavioralState === 'Watch' instead of an independent
// totalUSD/day-range formula. It lives inside the ~7000-line dashboard
// component as an inline closure, not an exported function, so it can't
// be unit-tested directly without restructuring the component (out of
// scope for this fix). These tests instead prove the canonical field it
// now depends on -- behavioralState, gated by observationCount and
// FAN_MIN_OBSERVATIONS_FOR_BASELINE -- behaves correctly; the removal of
// the independent day-range formula itself was verified by code
// inspection and the production build.
describe('DORMANT quick action canonical dependency — behavioralState === "Watch"', () => {
  test('TEST 1: a one-visit fan cannot reach "Watch" merely because 7+ days elapsed', () => {
    const tips = burstVisit('oneVisitDormantFan', 'Chaturbate', 2, 10, 25) // $50, 1 visit, 10 days ago
    const [fan] = identifyWhales(tips, [])
    expect(fan.observationCount).toBe(1)
    expect(fan.baselineEstablished).toBe(false)
    expect(fan.behavioralState).not.toBe('Watch')
  })

  test('TEST 2: raw tip count cannot bypass the observation-count gate', () => {
    const tips = burstVisit('burstDormantFan', 'Chaturbate', 8, 10, 25) // 8 raw tips, still 1 visit
    const [fan] = identifyWhales(tips, [])
    expect(fan.tipCount).toBe(8)
    expect(fan.observationCount).toBe(1)
    expect(fan.baselineEstablished).toBe(false)
    expect(fan.behavioralState).not.toBe('Watch')
  })

  test('TEST 3: a fan with an established baseline and real deviation reaches "Watch" legitimately', () => {
    // 4 visits ~5 days apart, most recent 7 days ago -> r = 7/5 = 1.4,
    // inside [1,2) i.e. deviation without full at-risk evidence.
    const tips = multiVisitTips('watchFan', 'Chaturbate', 4, 5, 7)
    const sessions = [meaningfulSession('Chaturbate', 1), meaningfulSession('Chaturbate', 3)]
    const [fan] = identifyWhales(tips, sessions)
    expect(fan.baselineEstablished).toBe(true)
    expect(fan.behavioralState).toBe('Watch')
  })

  test('TEST 4: descriptive fan data remains available for an insufficient-history fan', () => {
    const tips = burstVisit('descriptiveDormantFan', 'Chaturbate', 2, 10, 25)
    const [fan] = identifyWhales(tips, [])
    expect(fan.behavioralState).not.toBe('Watch')
    expect(fan.totalUSD).toBeCloseTo(50)
    expect(fan.platform).toBe('Chaturbate')
    expect(fan.lastTipDate).toBeTruthy()
  })

  test('TEST 5: same username on different platforms stays isolated for the Watch gate', () => {
    const tipsA = burstVisit('crossPlatformDormant', 'Chaturbate', 2, 10, 25) // 1 visit
    const tipsB = multiVisitTips('crossPlatformDormant', 'BongaCams', 4, 5, 7) // established, Watch
    const sessions = [meaningfulSession('BongaCams', 1), meaningfulSession('BongaCams', 3)]
    const whales = identifyWhales([...tipsA, ...tipsB], sessions)
    const cb = whales.find(w => w.platform === 'Chaturbate')
    const bc = whales.find(w => w.platform === 'BongaCams')
    expect(cb.behavioralState).not.toBe('Watch')
    expect(bc.behavioralState).toBe('Watch')
  })
})

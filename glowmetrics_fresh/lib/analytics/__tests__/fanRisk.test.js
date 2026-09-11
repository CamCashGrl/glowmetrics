import { identifyWhales, getPlatformRiskContext } from '../../analytics.js'

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

// Build a meaningful session (duration + tip count large enough for
// sessionQuality === 'meaningful' per lib/analytics.js classifySession).
function meaningfulSession(platform, daysAgoStart) {
  return {
    platform,
    startTime: daysAgo(daysAgoStart),
    endTime: daysAgo(daysAgoStart - 0.05), // ~1.2h later
    durationMinutes: 70,
    totalUSD: 40,
    sessionQuality: 'meaningful',
  }
}

// Build a fan's tip history: `spacingDays` apart, ending `lastDaysAgo` ago.
function fanTips(username, platform, count, spacingDays, lastDaysAgo, usdEach = 10) {
  const tips = []
  for (let i = 0; i < count; i++) {
    const daysBack = lastDaysAgo + (count - 1 - i) * spacingDays
    tips.push({ username, platform, usd: usdEach, tokens: 0, dateRaw: daysAgo(daysBack), date_time: daysAgo(daysBack) })
  }
  return tips
}

describe('Fan risk / behavioral state — Step 1 hardening', () => {
  test('A: creator has not streamed for a long time → Risk Signals Paused, no mass At Risk', () => {
    // Fan tipped regularly every 5 days, then went quiet 40 days ago — long
    // enough to look like decline by frequency alone.
    const tips = fanTips('fanA', 'Chaturbate', 6, 5, 40)
    const sessions = [] // no meaningful sessions at all
    const [fan] = identifyWhales(tips, sessions)
    expect(fan.platformRiskContext.riskSignalsPaused).toBe(true)
    expect(fan.behavioralState).not.toBe('At Risk')
  })

  test('B: creator active but no matching recent import → Data Needs Updating, no false risk', () => {
    const tips = fanTips('fanB', 'Chaturbate', 6, 5, 40)
    // Creator streamed meaningfully just 2 days ago on the SAME platform —
    // but the newest tip on record is 40 days old (a 38-day import gap).
    const sessions = [meaningfulSession('Chaturbate', 2)]
    const ctx = getPlatformRiskContext(tips, sessions)
    expect(ctx['Chaturbate'].dataNeedsUpdating).toBe(true)
    const [fan] = identifyWhales(tips, sessions)
    expect(fan.behavioralState).not.toBe('At Risk')
  })

  test('D: fan tips once then goes quiet → New/Developing or Insufficient Data, never At Risk', () => {
    const tips = fanTips('fanD', 'Chaturbate', 1, 0, 5)
    const sessions = [meaningfulSession('Chaturbate', 1)]
    const [fan] = identifyWhales(tips, sessions)
    expect(['New/Developing', 'Insufficient Data']).toContain(fan.behavioralState)
    expect(fan.behavioralState).not.toBe('At Risk')
  })

  test('E: established fan with real decline while creator stays active same-platform → CAN qualify At Risk', () => {
    // 8 tips every 4 days historically, last tip 20 days ago (~5x their gap).
    // Another fan's recent tip establishes that the platform's tip data
    // itself is fresh (not an import gap) — isolating fanE's own decline.
    const tips = [
      ...fanTips('fanE', 'Chaturbate', 8, 4, 20),
      ...fanTips('otherFan', 'Chaturbate', 3, 2, 1),
    ]
    // Creator has recent + steady meaningful activity on the same platform.
    const sessions = [
      meaningfulSession('Chaturbate', 1),
      meaningfulSession('Chaturbate', 5),
      meaningfulSession('Chaturbate', 10),
    ]
    const fan = identifyWhales(tips, sessions).find(f => f.username === 'fanE')
    expect(fan.behavioralState).toBe('At Risk')
  })

  test('E2: spend-decline-while-still-active also qualifies At Risk', () => {
    const platform = 'Chaturbate'
    const early = [
      { username: 'fanE2', platform, usd: 50, tokens: 0, dateRaw: daysAgo(40), date_time: daysAgo(40) },
      { username: 'fanE2', platform, usd: 50, tokens: 0, dateRaw: daysAgo(34), date_time: daysAgo(34) },
    ]
    const recent = [
      { username: 'fanE2', platform, usd: 3, tokens: 0, dateRaw: daysAgo(6), date_time: daysAgo(6) },
      { username: 'fanE2', platform, usd: 3, tokens: 0, dateRaw: daysAgo(2), date_time: daysAgo(2) },
    ]
    const tips = [...early, ...recent]
    const sessions = [meaningfulSession(platform, 1), meaningfulSession(platform, 8)]
    const [fan] = identifyWhales(tips, sessions)
    expect(fan.spendDeclineRatio).toBeLessThanOrEqual(0.5)
    expect(fan.behavioralState).toBe('At Risk')
  })

  test('F: different-platform creator activity does not create risk for another platform\'s fans', () => {
    // Fan is on BongaCams and has gone quiet; creator is very active on
    // Chaturbate but has NOT streamed meaningfully on BongaCams.
    const tips = fanTips('fanF', 'BongaCams', 8, 4, 20)
    const sessions = [meaningfulSession('Chaturbate', 1), meaningfulSession('Chaturbate', 2)]
    const [fan] = identifyWhales(tips, sessions)
    expect(fan.platform).toBe('BongaCams')
    expect(fan.platformRiskContext.riskSignalsPaused).toBe(true)
    expect(fan.behavioralState).not.toBe('At Risk')
  })

  test('G: whale who goes inactive → tier stays Whale, behavioral state evaluated independently', () => {
    const whaleTips = fanTips('bigSpender', 'Chaturbate', 10, 3, 30, 200) // big $, gone quiet
    const smallFanTips = fanTips('smallFan', 'Chaturbate', 5, 5, 1, 2)
    const tips = [...whaleTips, ...smallFanTips]
    const sessions = [meaningfulSession('Chaturbate', 1), meaningfulSession('Chaturbate', 5)]
    const whale = identifyWhales(tips, sessions).find(f => f.username === 'bigSpender')
    expect(whale.tier).toBe('Whale')
    expect(['Dormant', 'At Risk', 'Watch']).toContain(whale.behavioralState)
  })

  test('H: fan identity is not merged across platforms (platform+username key)', () => {
    const tips = [
      ...fanTips('daddyjohn', 'Chaturbate', 5, 5, 1, 20),
      ...fanTips('daddyjohn', 'BongaCams', 3, 5, 1, 5),
    ]
    const fans = identifyWhales(tips, [])
    const cbFan = fans.find(f => f.username === 'daddyjohn' && f.platform === 'Chaturbate')
    const bcFan = fans.find(f => f.username === 'daddyjohn' && f.platform === 'BongaCams')
    expect(fans.length).toBe(2)
    expect(cbFan.tipCount).toBe(5)
    expect(bcFan.tipCount).toBe(3)
    expect(cbFan.totalUSD).toBe(100)
    expect(bcFan.totalUSD).toBe(15)
  })

  test('active, on-schedule fan is never mislabeled at risk', () => {
    const tips = fanTips('activeFan', 'Chaturbate', 6, 5, 1)
    const sessions = [meaningfulSession('Chaturbate', 1)]
    const [fan] = identifyWhales(tips, sessions)
    expect(fan.behavioralState).toBe('Active')
  })
})

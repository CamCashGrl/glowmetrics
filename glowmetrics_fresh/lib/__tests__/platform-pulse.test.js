import { aggregateRows } from '../analytics'
import {
  buildPlatformComparison, buildPlatformExtras, buildLatestStreamRecap,
  buildPlatformStatuses, buildLearningState, buildCrossPlatformInsights,
  buildShareShift, buildCamCashNoticed,
} from '../platformIntelligenceAnalytics'

const TZ = 'America/New_York'
// One stream = `n` tips spaced 5 minutes apart starting at `start`.
function stream(platform, start, fans, usdEach) {
  return fans.map((u, i) => ({
    username: u, platform, usd: usdEach, tokens: usdEach * 20,
    date_time: new Date(new Date(start).getTime() + i * 5 * 60000).toISOString(),
  }))
}
const fans10 = (p) => Array.from({ length: 10 }, (_, i) => `${p}${i}`)

describe('Platform pulse derivations', () => {
  it('reports no recap and the learning state for a new account', () => {
    const a = aggregateRows([], TZ)
    expect(buildLatestStreamRecap(a)).toBeNull()
    const l = buildLearningState(a)
    expect(l).toMatchObject({ platforms: 0, sessions: 0, tips: 0, isLearning: true, sessionsNeeded: 3 })
  })

  it('recaps the latest meaningful stream, judging returning fans against earlier sessions', () => {
    const tips = [
      ...stream('Chaturbate', '2026-10-01T20:00:00Z', fans10('a'), 2),
      ...stream('Chaturbate', '2026-10-05T20:00:00Z', [...fans10('a').slice(0, 4), 'new1', 'new2', 'a0', 'a1'], 3),
    ]
    const a = aggregateRows(tips, TZ)
    const r = buildLatestStreamRecap(a)
    expect(r.platform).toBe('Chaturbate')
    expect(r.earned).toBe(24)
    expect(r.tips).toBe(8)
    expect(r.fans).toBe(6)
    expect(r.returningFans).toBe(4)
    expect(r.newSpenders).toBe(2)
    expect(r.shareShiftPts).toBeNull() // one platform: no share to move
  })

  it('returns null returning/new counts when no earlier session exists on that platform', () => {
    const a = aggregateRows(stream('MyFreeCams', '2026-10-01T20:00:00Z', fans10('m'), 2), TZ)
    const r = buildLatestStreamRecap(a)
    expect(r.returningFans).toBeNull()
    expect(r.newSpenders).toBeNull()
  })

  it('detects a lead change caused by the latest stream', () => {
    const tips = [
      ...stream('Chaturbate', '2026-10-01T20:00:00Z', fans10('c'), 5), // $50
      ...stream('MyFreeCams', '2026-10-02T20:00:00Z', fans10('m'), 2), // $20
      ...stream('MyFreeCams', '2026-10-03T20:00:00Z', fans10('m'), 4), // +$40 → $60
    ]
    const r = buildLatestStreamRecap(aggregateRows(tips, TZ))
    expect(r.platform).toBe('MyFreeCams')
    expect(r.tookLead).toBe(true)
    expect(r.shareShiftPts).toBeGreaterThan(0)
  })

  it('derives fans and biggest tip per platform from engine output only', () => {
    const tips = [...stream('Chaturbate', '2026-10-01T20:00:00Z', fans10('c'), 5), { username: 'c0', platform: 'Chaturbate', usd: 40, tokens: 800, date_time: '2026-10-01T20:50:00Z' }]
    const a = aggregateRows(tips, TZ)
    const e = buildPlatformExtras(a)
    expect(e.Chaturbate).toEqual({ uniqueFans: 10, biggestTip: 40 })
  })

  it('badges only from deterministic engine fields', () => {
    const tips = [
      ...stream('Chaturbate', '2026-10-01T20:00:00Z', fans10('c'), 5),
      ...stream('MyFreeCams', '2026-10-02T20:00:00Z', fans10('m'), 2),
    ]
    const a = aggregateRows(tips, TZ)
    const s = buildPlatformStatuses(a)
    expect(s.Chaturbate).toContain('leading')
    expect(s.MyFreeCams).toContain('latest')
    expect(s.MyFreeCams).not.toContain('leading')
    expect(s.Chaturbate).toContain('learning') // one session is below the 'Very Low' band
  })

  it('makes no cross-platform claims on thin samples or a single platform', () => {
    const one = aggregateRows(stream('Chaturbate', '2026-10-01T20:00:00Z', fans10('c'), 5), TZ)
    expect(buildCrossPlatformInsights(one)).toEqual([])
    const thin = aggregateRows([
      ...stream('Chaturbate', '2026-10-01T20:00:00Z', fans10('c'), 2),
      ...stream('MyFreeCams', '2026-10-02T20:00:00Z', fans10('m'), 9),
    ], TZ)
    expect(buildCrossPlatformInsights(thin)).toEqual([])
    expect(buildShareShift(thin)).toBeNull() // no prior 30-day period
  })

  it('never claims a share of "0% of your streaming hours"', () => {
    const singles = ['2026-10-01', '2026-10-03', '2026-10-05'].flatMap((d, i) => [
      { username: `x${i}`, platform: 'Chaturbate', usd: 50, tokens: 1000, date_time: `${d}T20:00:00Z` },
      { username: `y${i}`, platform: 'BongaCams', usd: 5, tokens: 100, date_time: `${d}T23:00:00Z` },
    ])
    const a = aggregateRows(singles, TZ)
    expect(buildPlatformComparison(a)[0].hours).toBe(0)
    expect(buildCamCashNoticed(a).some(n => /0% of your streaming hours/.test(n.text))).toBe(false)
  })
})

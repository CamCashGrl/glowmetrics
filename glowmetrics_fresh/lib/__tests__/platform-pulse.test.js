import { aggregateRows } from '../analytics'
import {
  buildPlatformComparison, buildPlatformExtras, buildLatestStreamRecap,
  buildPlatformStatuses, buildLearningState, buildCrossPlatformInsights,
  buildShareShift, buildCamCashNoticed,
  buildPlatformMonthlyHistory, buildNewFans, buildPlatformActivity, buildSinceLastVisit, buildDailySeries,
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

  it('groups monthly history in the creator timezone and reconciles to platform rows', () => {
    // 2026-10-01T02:00Z is still September 30 in New York.
    const tips = [
      ...stream('Chaturbate', '2026-10-01T02:00:00Z', fans10('c'), 3),
      ...stream('MyFreeCams', '2026-10-10T20:00:00Z', fans10('m'), 2),
    ]
    const a = aggregateRows(tips, TZ)
    const h = buildPlatformMonthlyHistory(a, TZ)
    expect(h.map(m => m.month)).toEqual(['2026-09', '2026-10'])
    expect(h[0].platforms).toEqual([{ platform: 'Chaturbate', usd: 30, pct: 100 }])
    const sum = h.reduce((s, m) => s + m.total, 0)
    expect(sum).toBeCloseTo(a.platforms.reduce((s, p) => s + p.totalUSD, 0), 2)
    // Read on UTC both streams fall in October, so there is only one month.
    expect(buildPlatformMonthlyHistory(a, 'UTC')).toBeNull()
  })

  it('returns no monthly history with fewer than two months', () => {
    const a = aggregateRows(stream('Chaturbate', '2026-10-05T20:00:00Z', fans10('c'), 3), TZ)
    expect(buildPlatformMonthlyHistory(a, TZ)).toBeNull()
  })

  it('counts new fans only inside the window, per platform', () => {
    const now = new Date('2026-10-20T00:00:00Z').getTime()
    const tips = [
      ...stream('Chaturbate', '2026-10-01T20:00:00Z', fans10('old'), 2),
      ...stream('Chaturbate', '2026-10-17T20:00:00Z', ['old0', 'old1', 'n1', 'n2'], 2),
      ...stream('MyFreeCams', '2026-10-18T20:00:00Z', ['m1', 'm2'], 2),
    ]
    const nf = buildNewFans(aggregateRows(tips, TZ), { now })
    expect(nf.total).toBe(4)
    expect(nf.byPlatform).toEqual({ Chaturbate: 2, MyFreeCams: 2 })
  })

  it('activity feed lists only dated events and is empty when nothing happened', () => {
    const tips = [
      ...stream('Chaturbate', '2026-10-01T20:00:00Z', fans10('c'), 2),
      ...stream('Chaturbate', '2026-10-19T20:00:00Z', ['c0', 'c0', 'c1', 'c2', 'c0', 'c1', 'c2', 'c1'], 5), // 35 min: a meaningful stream
    ]
    const a = aggregateRows(tips, TZ)
    const later = new Date('2026-12-30T00:00:00Z').getTime()
    expect(buildPlatformActivity(a, { now: later }).filter(i => i.kind !== 'returning' && i.kind !== 'share')).toEqual([])
    const now = new Date('2026-10-20T00:00:00Z').getTime()
    const items = buildPlatformActivity(a, { now })
    expect(items.find(i => i.kind === 'earned24h')).toMatchObject({ platform: 'Chaturbate', text: 'Chaturbate +$40.00' })
    expect(items.find(i => i.kind === 'returning').text).toBe('c0 tipped again')
  })

  it('since-last-visit counts only tips after the previous visit, per platform', () => {
    const tips = [
      ...stream('Chaturbate', '2026-10-01T20:00:00Z', fans10('c'), 2),
      ...stream('Chaturbate', '2026-10-10T20:00:00Z', ['c0', 'c1', 'c2', 'cnew', 'c0', 'c1', 'c2'], 3),
      ...stream('MyFreeCams', '2026-10-11T20:00:00Z', fans10('m'), 1),
    ]
    const a = aggregateRows(tips, TZ)
    const now = new Date('2026-10-12T00:00:00Z').getTime()
    const v = buildSinceLastVisit(a, new Date('2026-10-05T00:00:00Z').getTime(), now)
    expect(v.totalUSD).toBe(31)
    expect(v.tips).toBe(17)
    expect(v.newFans).toBe(11) // cnew + 10 MyFreeCams fans
    expect(v.platforms).toEqual([
      { platform: 'Chaturbate', usd: 21, tips: 7 },
      { platform: 'MyFreeCams', usd: 10, tips: 10 },
    ])
  })

  it('since-last-visit is null without a valid previous visit, and zero when nothing arrived', () => {
    const a = aggregateRows(stream('Chaturbate', '2026-10-01T20:00:00Z', fans10('c'), 2), TZ)
    const now = new Date('2026-10-12T00:00:00Z').getTime()
    expect(buildSinceLastVisit(a, null, now)).toBeNull()
    expect(buildSinceLastVisit(a, NaN, now)).toBeNull()
    expect(buildSinceLastVisit(a, now + 1000, now)).toBeNull()
    expect(buildSinceLastVisit(a, new Date('2026-10-05T00:00:00Z').getTime(), now)).toMatchObject({ totalUSD: 0, tips: 0, newFans: 0, platforms: [] })
  })

  it('daily series buckets by creator-local day and reconciles to the tips in the window', () => {
    const tips = [
      ...stream('Chaturbate', '2026-10-10T02:00:00Z', fans10('c'), 2), // Oct 9 evening in New York
      ...stream('MyFreeCams', '2026-10-11T20:00:00Z', fans10('m'), 3),
    ]
    const a = aggregateRows(tips, TZ)
    const now = new Date('2026-10-12T12:00:00Z').getTime()
    const d = buildDailySeries(a, TZ, { days: 5, now })
    expect(d.days).toEqual(['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12'])
    expect(d.total).toEqual([0, 20, 0, 30, 0])
    expect(d.byPlatform.Chaturbate).toEqual([0, 20, 0, 0, 0])
    expect(d.activeDays).toBe(2)
    expect(buildDailySeries(a, TZ, { days: 5, now: new Date('2027-01-01T00:00:00Z').getTime() })).toBeNull()
  })
})

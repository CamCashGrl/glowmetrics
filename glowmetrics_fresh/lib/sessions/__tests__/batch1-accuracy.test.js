/**
 * Sessions accuracy foundation (Batch 1):
 *  - existing bucket / comparison outputs are unchanged (vs a snapshot taken
 *    from the pre-change engine: __fixtures__/batch1-before.json)
 *  - full contributor lists reconcile with public + attributed + unattributed
 *    private earnings, at full precision (no cent rounding)
 *  - comparisons: same platform + same type only, never private / multi-platform,
 *    never for partial / unknown sessions; $/hr only for verified Live
 *  - completeness uses the existing grouping rules on the full history and
 *    leaks no restricted rows
 */
import {
  buildSessionHistory, sessionBuckets, sessionVsTypical, sessionCompletenessMap, VS_TYPICAL_MIN,
} from '../normalize'
import { accessibleDataset } from '../../analytics'
import { SESSION_GAP_MS } from '../../analytics/sessions'
import {
  lowDataFixture, highDataFixture, tipRow, resetIds, HIGH_CB_WINDOW_START,
} from '../__fixtures__/batch1-fixtures'
import before from '../__fixtures__/batch1-before.json'

const MIN = 60000
const DAY = 86400000
const iso = (ms) => new Date(ms).toISOString()
const NEW_BUCKET_FIELDS = ['fans', 'unattributedPublicUSD', 'unattributedPrivateUSD', 'zeroBasis']
const stripNew = (b) => b && ({ ...b, buckets: b.buckets.map((x) => { const y = { ...x }; NEW_BUCKET_FIELDS.forEach((k) => delete y[k]); return y }) })
const fixtures = () => ({ low: lowDataFixture(), high: highDataFixture() })

describe('existing calculations are preserved', () => {
  const fx = fixtures()
  for (const name of ['low', 'high']) {
    const history = buildSessionHistory(fx[name])
    test(`${name}: every session's bucket output is identical to the pre-change snapshot`, () => {
      expect(history.map((e) => e.id).sort()).toEqual(Object.keys(before[name]).sort())
      for (const e of history) {
        const now = JSON.parse(JSON.stringify(stripNew(sessionBuckets(e, { tips: fx[name].tips }))))
        expect(now).toEqual(before[name][e.id].buckets)
      }
    })
    test(`${name}: same-basis comparisons are unchanged; no session gains a verdict`, () => {
      for (const e of history) {
        const was = before[name][e.id].vs
        const now = sessionVsTypical(e, history)
        if (was && was.basis === 'same') expect(now).toMatchObject(was)
        if (!was) expect(now).toBeNull()
        if (was && was.basis === 'all') expect(now).toBeNull() // removed fallback
      }
    })
  }
})

describe('sessionBuckets: full contributors and reconciliation', () => {
  const fx = highDataFixture()
  const history = buildSessionHistory(fx)
  const raw = (e) => {
    if (e.type === 'live') {
      return fx.tips.filter((t) => t.live_session_id === e.sourceId).reduce((a, t) => a + t.usd, 0)
        + e.privateIntervals.reduce((a, iv) => a + iv.earningsUsd, 0)
    }
    if (e.type === 'private') return e.charges.reduce((a, c) => a + c.usd, 0)
    return e.session.tips.reduce((a, t) => a + t.usd, 0)
  }

  test('for every session: Σ(fans + unattributed) equals the raw session earnings, with no cent rounding', () => {
    for (const e of history) {
      const b = sessionBuckets(e, { tips: fx.tips })
      const sum = b.buckets.reduce((a, k) => a + k.fans.reduce((x, f) => x + f.usd, 0) + k.unattributedPublicUSD + k.unattributedPrivateUSD, 0)
      expect(Math.abs(sum - raw(e))).toBeLessThan(1e-6)
    }
  })

  test('per bucket: public and private parts match the (cent-rounded) existing bucket fields; per fan usd = public + private', () => {
    for (const e of history) {
      for (const k of sessionBuckets(e, { tips: fx.tips }).buckets) {
        const pub = k.fans.reduce((a, f) => a + f.publicUSD, 0) + k.unattributedPublicUSD
        const priv = k.fans.reduce((a, f) => a + f.privateUSD, 0) + k.unattributedPrivateUSD
        expect(Math.abs(pub - k.publicUSD)).toBeLessThanOrEqual(0.005 + 1e-9)
        expect(Math.abs(priv - k.privateUSD)).toBeLessThanOrEqual(0.005 + 1e-9)
        for (const f of k.fans) expect(Math.abs(f.usd - (f.publicUSD + f.privateUSD))).toBeLessThan(1e-9)
        expect(k.uniqueFans).toBe(k.fans.length)
        if (k.topFan) expect(k.fans[0]).toMatchObject({ username: k.topFan.username, platform: k.topFan.platform })
      }
    }
  })

  test('BongaCams $0.025/token is not rounded to cents in the contributor list', () => {
    resetIds()
    const tips = [20, 24, 29].map((m) => tipRow(`2026-10-01T20:${m}:00.000Z`, 'bongacams', 'kit', 1))
    const e = buildSessionHistory({ tips })[0]
    const b = sessionBuckets(e, { tips })
    expect(tips.every((t) => t.usd === 0.025)).toBe(true)
    expect(b.buckets).toHaveLength(1)
    expect(b.buckets[0].fans[0].usd).toBeCloseTo(0.075, 9)
    expect(b.buckets[0].fans[0].count).toBe(3)
    expect(b.buckets[0].publicUSD).toBe(0.08) // existing, display-rounded field is unchanged
  })

  test('Live private intervals are unattributed (no fan detail) and sum to the interval earnings', () => {
    const e = history.find((x) => x.id === 'live:show-bc-2')
    const b = sessionBuckets(e, { tips: fx.tips })
    const unattributed = b.buckets.reduce((a, k) => a + k.unattributedPrivateUSD, 0)
    expect(unattributed).toBeCloseTo(8, 6) // 6 + i, i = 2
    expect(b.buckets.every((k) => k.fans.every((f) => f.privateUSD === 0))).toBe(true)
    expect(b.buckets.some((k) => k.privateEstimated)).toBe(true)
  })

  test('imported private charges: attributed to the fan when known, unattributed when the row has no fan', () => {
    const vip = sessionBuckets(history.find((x) => x.id === 'private:pc0'), { tips: fx.tips }).buckets
    expect(vip.reduce((a, k) => a + k.fans.reduce((x, f) => x + f.privateUSD, 0), 0)).toBeCloseTo(30.3, 9)
    expect(vip.reduce((a, k) => a + k.unattributedPrivateUSD, 0)).toBe(0)
    const anon = sessionBuckets(history.find((x) => x.id === 'private:pc-anon'), { tips: fx.tips }).buckets
    expect(anon.every((k) => k.fans.length === 0)).toBe(true)
    expect(anon.reduce((a, k) => a + k.unattributedPrivateUSD, 0)).toBeCloseTo(4.4, 9)
  })

  test('empty buckets stay visible, and say what a zero means (show span vs activity span)', () => {
    resetIds()
    const tips = [
      tipRow('2026-10-01T20:00:00.000Z', 'chaturbate', 'Ann', 80), tipRow('2026-10-01T20:05:00.000Z', 'chaturbate', 'Ben', 40),
      tipRow('2026-10-01T20:31:00.000Z', 'chaturbate', 'Ann', 240), tipRow('2026-10-01T20:45:00.000Z', 'chaturbate', 'Dee', 70),
    ]
    const b = sessionBuckets(buildSessionHistory({ tips })[0], { tips })
    expect(b.buckets).toHaveLength(5)
    const empties = b.buckets.filter((k) => k.totalUSD === 0)
    expect(empties.length).toBeGreaterThan(0)
    expect(empties.every((k) => k.fans.length === 0 && k.zeroBasis === 'activity_span')).toBe(true)
    expect(b.buckets.filter((k) => k.totalUSD > 0).every((k) => k.zeroBasis === null)).toBe(true)

    const showEntry = buildSessionHistory(fx).find((x) => x.id === 'live:show-bc-0')
    const lb = sessionBuckets(showEntry, { tips: fx.tips })
    const live0 = lb.buckets.filter((k) => k.totalUSD === 0)
    expect(live0.every((k) => k.zeroBasis === 'show_span')).toBe(true)
  })
})

describe('sessionVsTypical: comparable sessions only', () => {
  const day = (platform, d, a, b) => {
    const s = `2026-09-${String(d).padStart(2, '0')}`
    return [tipRow(`${s}T20:00:00.000Z`, platform, 'Ann', a), tipRow(`${s}T20:40:00.000Z`, platform, 'Ben', b)]
  }
  const days = [2, 4, 6, 8, 10, 12, 14]
  const cb = () => { resetIds(); return days.flatMap((d, i) => day('chaturbate', d, 40 + i * 20, 20)) }

  test('the five-session threshold is the existing constant', () => { expect(VS_TYPICAL_MIN).toBe(5) })

  test('a BongaCams session is never compared with Chaturbate sessions, even when plenty exist', () => {
    const tips = [...cb(), ...day('bongacams', 20, 100, 100)]
    const h = buildSessionHistory({ tips })
    expect(sessionVsTypical(h.find((e) => e.platforms[0] === 'bongacams'), h)).toBeNull()
    expect(sessionVsTypical(h.find((e) => e.platforms[0] === 'chaturbate'), h)).toMatchObject({ basis: 'same', sessions: 6 })
  })

  test('a Live show is never compared with imported / free-chat sessions of the same platform', () => {
    const h = buildSessionHistory({
      tips: cb(),
      shows: [{ id: 'l1', platform: 'Chaturbate', startedAt: '2026-09-20T19:00:00.000Z', endedAt: '2026-09-20T21:00:00.000Z', durationSeconds: 7200, publicUsd: 50, privateUsd: 0, totalUsd: 50, platformRevenue: [{ platform: 'Chaturbate', usd: 50, tips: 3 }], tipCount: 3, uniqueTippers: 2 }],
    })
    expect(sessionVsTypical(h.find((e) => e.type === 'live'), h)).toBeNull()
  })

  test('private charges and multi-platform Live shows are never compared', () => {
    const fx = highDataFixture()
    const h = buildSessionHistory(fx)
    expect(h.filter((e) => e.type === 'private').every((e) => sessionVsTypical(e, h) === null)).toBe(true)
    expect(sessionVsTypical(h.find((e) => e.id === 'live:show-multi'), h)).toBeNull() // was −86% vs 92 unrelated sessions
  })

  test('fewer than five comparable sessions gives no verdict (and no invented percentage)', () => {
    const h = buildSessionHistory({ tips: cb().slice(0, 10) }) // 5 sessions: only 4 others
    expect(sessionVsTypical(h[0], h)).toBeNull()
  })

  test('partial / unknown sessions get no verdict and are excluded from the baseline', () => {
    const h = buildSessionHistory({ tips: cb() }) // 7 sessions
    const ids = h.map((e) => e.id)
    const mark = (n) => new Map(ids.map((id, i) => [id, { status: i >= ids.length - n ? 'partial_verified' : 'complete', reason: null }]))
    const latest = h[0]
    // none marked: 6 others
    expect(sessionVsTypical(latest, h, { completeness: mark(0) })).toMatchObject({ sessions: 6 })
    // the two oldest are partial: baseline drops to 4 others → no verdict
    expect(sessionVsTypical(latest, h, { completeness: mark(2) })).toBeNull()
    // one partial: 5 complete others remain; median ignores the partial one
    const one = sessionVsTypical(latest, h, { completeness: mark(1) })
    expect(one.sessions).toBe(5)
    const expectedMedian = [...h.slice(1, 6)].map((e) => e.totalUSD).sort((a, b) => a - b)[2]
    expect(one.medianUSD).toBe(expectedMedian)
    // the partial session itself gets none
    const asSelf = new Map(ids.map((id) => [id, { status: id === latest.id ? 'unknown' : 'complete', reason: 'x' }]))
    expect(sessionVsTypical(latest, h, { completeness: asSelf })).toBeNull()
  })
})

describe('sessionVsTypical: $/hr only for verified Live with a comparable baseline', () => {
  const live = (i, minutes, usd, platform = 'Chaturbate') => ({
    id: `s${i}`, platform, startedAt: iso(Date.parse('2026-09-01T19:00:00Z') + i * DAY), endedAt: iso(Date.parse('2026-09-01T19:00:00Z') + i * DAY + minutes * MIN),
    durationSeconds: minutes * 60, publicUsd: usd, privateUsd: 0, totalUsd: usd, platformRevenue: [{ platform, usd, tips: 3 }], tipCount: 3, uniqueTippers: 2,
  })

  test('median $/hr baseline over >= 5 other verified Live shows; total earnings stays the primary verdict', () => {
    const fx = highDataFixture()
    const h = buildSessionHistory(fx)
    const e = h.find((x) => x.id === 'live:show-bc-6')
    const vs = sessionVsTypical(e, h)
    expect(vs.basis).toBe('same')
    expect(vs.perHour.sessions).toBe(6)
    const rates = fx.shows.filter((s) => s.id.startsWith('show-bc') && s.id !== 'show-bc-6')
      .map((s) => Math.round(s.totalUsd * 100) / 100 / (s.durationSeconds / 3600)).sort((a, b) => a - b)
    const med = (rates[2] + rates[3]) / 2
    expect(vs.perHour.medianUSDPerHour).toBeCloseTo(med, 2)
    expect(vs.perHour.usdPerHour).toBeCloseTo(e.totalUSD / (e.durationMinutes / 60), 2)
  })

  test('fewer than 5 verified comparable Live shows: total verdict may exist, $/hr does not', () => {
    // 6 shows; two others are only 20 minutes long (below the 30-minute valid-session floor)
    const shows = [live(0, 60, 60), live(1, 60, 70), live(2, 60, 80), live(3, 20, 30), live(4, 20, 25), live(5, 60, 90)]
    const h = buildSessionHistory({ shows })
    const vs = sessionVsTypical(h.find((e) => e.sourceId === 's5'), h)
    expect(vs).not.toBeNull()
    expect(vs.sessions).toBe(5)
    expect(vs.perHour).toBeNull()
  })

  test('a Live show shorter than the valid-session floor never gets $/hr', () => {
    const shows = [live(0, 60, 60), live(1, 60, 70), live(2, 60, 80), live(3, 60, 50), live(4, 60, 55), live(5, 20, 90)]
    const h = buildSessionHistory({ shows })
    expect(sessionVsTypical(h.find((e) => e.sourceId === 's5'), h).perHour).toBeNull()
  })

  test('imported sessions and private charges never get $/hr', () => {
    const fx = highDataFixture()
    const h = buildSessionHistory(fx)
    const vs = h.filter((e) => e.type !== 'live').map((e) => sessionVsTypical(e, h)).filter(Boolean)
    expect(vs.length).toBeGreaterThan(10)
    expect(vs.every((v) => v.perHour === null)).toBe(true)
  })
})

// ── Completeness ─────────────────────────────────────────────────────────
const gate = (fx, { isPro = false, unlimitedPlatform = null } = {}) =>
  accessibleDataset({ tips: fx.tips, paidSessions: fx.paidSessions || [], liveIntervals: [], shows: fx.shows || [], isPro, unlimitedPlatform })
const run = (fx, opts = {}) => {
  const g = gate(fx, opts)
  const history = buildSessionHistory({ tips: g.tips, shows: g.shows, paidSessions: g.paidSessions })
  const map = sessionCompletenessMap(history, {
    allTips: fx.tips, allPaidSessions: fx.paidSessions || [], windowStarts: g.windowStarts,
    unlimitedPlatform: g.unlimitedPlatform, isPro: !!opts.isPro, loadComplete: opts.loadComplete,
  })
  return { g, history, map }
}

describe('sessionCompletenessMap (Free history window)', () => {
  test('high-data: the session straddling the Chaturbate window start is verified partial; far-from-boundary sessions are complete', () => {
    const fx = highDataFixture()
    const { history, map } = run(fx)
    const straddle = history.find((e) => e.platforms[0] === 'chaturbate' && e.type === 'imported' && Date.parse(e.startTime) === HIGH_CB_WINDOW_START + 10 * MIN)
    expect(straddle).toBeTruthy()
    expect(map.get(straddle.id)).toEqual({ status: 'partial_verified', reason: 'hidden_earlier_activity' })
    const far = history.filter((e) => e.platforms[0] === 'chaturbate' && e.type !== 'live' && e.type !== 'private' && Date.parse(e.startTime) > HIGH_CB_WINDOW_START + 3 * DAY)
    expect(far.length).toBeGreaterThan(3)
    expect(far.every((e) => map.get(e.id).status === 'complete')).toBe(true)
  })

  test('partial sessions receive no verdict even when a full baseline exists', () => {
    const fx = highDataFixture()
    const { history, map } = run(fx)
    const nonComplete = history.filter((e) => map.get(e.id).status !== 'complete')
    expect(nonComplete.length).toBeGreaterThan(0)
    expect(nonComplete.every((e) => sessionVsTypical(e, history, { completeness: map }) === null)).toBe(true)
  })

  test('Pro, and Free on its primary (unwindowed) platform, are complete', () => {
    const fx = highDataFixture()
    const pro = run(fx, { isPro: true })
    expect([...pro.map.values()].every((v) => v.status === 'complete')).toBe(true)
    // Free on an unwindowed primary platform: no Chaturbate tips are hidden, so
    // nothing can be 'partial_verified'. A session can still be 'unknown' when
    // hidden OTHER-platform tips (outside their own windows) interleave: the
    // existing grouping ends a session at a platform change, so the full
    // history splits what the Free view merges. That is reported, not hidden.
    const primary = run(fx, { unlimitedPlatform: 'Chaturbate' })
    const cbTip = primary.history.filter((e) => e.platforms[0] === 'chaturbate' && (e.type === 'imported' || e.type === 'free_chat'))
    const statuses = cbTip.map((e) => primary.map.get(e.id))
    expect(statuses.some((v) => v.status === 'partial_verified')).toBe(false)
    expect(statuses.filter((v) => v.status === 'unknown').every((v) => v.reason === 'grouping_differs_from_full_history')).toBe(true)
    expect(statuses.filter((v) => v.status === 'unknown').length).toBeGreaterThan(0)
    expect(statuses.filter((v) => v.status === 'complete').length).toBeGreaterThan(0)
  })

  // exact grouping semantics: gap <= SESSION_GAP_MS joins
  const edge = (gapMin) => {
    resetIds()
    const T = Date.parse('2026-10-30T22:00:00Z'); const ws = T - 30 * DAY
    return { tips: [
      tipRow(iso(ws - gapMin * MIN), 'chaturbate', 'Old', 20),
      tipRow(iso(ws), 'chaturbate', 'A', 20), tipRow(iso(ws + 20 * MIN), 'chaturbate', 'B', 20), tipRow(iso(ws + 40 * MIN), 'chaturbate', 'C', 20),
      tipRow(iso(T), 'chaturbate', 'Late', 20),
    ] }
  }
  test.each([[59, 'partial_verified'], [60, 'partial_verified'], [61, 'complete']])(
    'hidden tip %i minutes before the first visible tip → %s (same 60-minute rule as grouping)', (gap, status) => {
      expect(SESSION_GAP_MS).toBe(60 * MIN)
      const { history, map } = run(edge(gap))
      const e = history.find((x) => x.tipCount === 3)
      expect(map.get(e.id).status).toBe(status)
    })

  test('a hidden tip on ANOTHER platform that splits a session in the full history makes the visible session unknown', () => {
    resetIds()
    const T0 = Date.parse('2026-10-01T20:00:00Z')
    const fx = { tips: [
      tipRow(iso(T0), 'chaturbate', 'X', 20), tipRow(iso(T0 + 20 * MIN), 'chaturbate', 'Y', 20),
      tipRow(iso(T0 + 10 * MIN), 'bongacams', 'Hidden', 20),
      tipRow(iso(T0 + 20 * DAY), 'chaturbate', 'LateCB', 20), tipRow(iso(T0 + 40 * DAY), 'bongacams', 'LateBC', 20),
    ] }
    const { history, map } = run(fx)
    const e = history.find((x) => x.platforms[0] === 'chaturbate' && x.tipCount === 2)
    expect(e).toBeTruthy()
    expect(map.get(e.id)).toEqual({ status: 'unknown', reason: 'grouping_differs_from_full_history' })
  })

  test('private charges: hidden earlier charge within 60 min → partial; beyond → complete', () => {
    const mk = (hiddenGapMin) => {
      resetIds()
      const T = Date.parse('2026-10-30T22:00:00Z'); const ws = T - 30 * DAY
      const charge = (id, at) => ({ id, date_time: iso(at), platform: 'BongaCams', username: 'Vip', username_lower: 'vip', session_type: 'private', usd: 7.575 })
      return {
        tips: [tipRow(iso(T), 'bongacams', 'Late', 10)],
        paidSessions: [charge('c1', ws - hiddenGapMin * MIN), charge('c2', ws + 5 * MIN), charge('c3', ws + 9 * MIN)],
      }
    }
    const a = run(mk(20)); const pe = a.history.find((e) => e.type === 'private')
    expect(a.map.get(pe.id)).toEqual({ status: 'partial_verified', reason: 'hidden_earlier_activity' })
    const b = run(mk(100)); const pe2 = b.history.find((e) => e.type === 'private')
    expect(b.map.get(pe2.id).status).toBe('complete')
  })

  test('a multi-platform Live show partly outside a platform window is unknown; unlimited platform makes it complete', () => {
    const show = { id: 'm', platform: 'Chaturbate', startedAt: '2026-10-10T18:00:00.000Z', endedAt: '2026-10-10T19:30:00.000Z', durationSeconds: 5400, publicUsd: 5, privateUsd: 0, totalUsd: 5, tipCount: 2, uniqueTippers: 2,
      platformRevenue: [{ platform: 'Chaturbate', usd: 3, tips: 1 }, { platform: 'MyFreeCams', usd: 2, tips: 1 }] }
    const history = buildSessionHistory({ shows: [show] })
    const windowStarts = { chaturbate: new Date('2026-09-01T00:00:00Z'), myfreecams: new Date('2026-10-12T00:00:00Z') }
    const a = sessionCompletenessMap(history, { windowStarts, isPro: false })
    expect(a.get(history[0].id)).toEqual({ status: 'unknown', reason: 'live_platform_partly_outside_window' })
    const b = sessionCompletenessMap(history, { windowStarts, isPro: false, unlimitedPlatform: 'MyFreeCams' })
    expect(b.get(history[0].id).status).toBe('complete')
  })

  test('an incomplete tip load makes every session unknown (even Pro): completeness cannot be established', () => {
    const { history, map } = run(highDataFixture(), { isPro: true, loadComplete: false })
    expect(history.length).toBeGreaterThan(0)
    expect([...map.values()].every((v) => v.status === 'unknown' && v.reason === 'tips_load_incomplete')).toBe(true)
  })

  test('low-data accounts: lone tip, 31-minute pair and a private charge stay complete for Free and Pro', () => {
    for (const isPro of [false, true]) {
      const { history, map } = run(lowDataFixture(), { isPro })
      expect(history.length).toBe(3)
      expect([...map.values()].every((v) => v.status === 'complete')).toBe(true)
    }
  })

  test('privacy: only a status and a reason code leave the function (no usernames, amounts, timestamps)', () => {
    const fx = highDataFixture()
    const { map } = run(fx)
    for (const v of map.values()) expect(Object.keys(v).sort()).toEqual(['reason', 'status'])
    const blob = JSON.stringify([...map.entries()].map(([, v]) => v))
    for (const t of fx.tips.slice(0, 200)) { expect(blob).not.toContain(`"${t.username}"`) }
    expect(blob).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
  })
})

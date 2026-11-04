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
  liveRecordUsable, liveVerifiedHourly,
} from '../normalize'
import { accessibleDataset } from '../../analytics'
import { SESSION_GAP_MS } from '../../analytics/sessions'
import {
  lowDataFixture, highDataFixture, tipRow, resetIds, liveShow, HIGH_CB_WINDOW_START,
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

describe('sessionVsTypical: $/hr only for VERIFIED Live durations with a comparable baseline', () => {
  const T0 = Date.parse('2026-09-01T19:00:00Z')
  // n consistent, finalized, normal_stop 60-minute shows ($50..$50+10(n-1)/hr)
  const shows = (n, over = {}) => Array.from({ length: n }, (_, i) => liveShow({
    id: `s${i}`, platform: 'Chaturbate', startedAt: iso(T0 + i * DAY), minutes: 60, publicUsd: 50 + i * 10, tipCount: 3, uniqueTippers: 2, ...(over[i] || {}),
  }))
  const hist = (list) => buildSessionHistory({ shows: list })
  const last = (h, id) => h.find((e) => e.sourceId === id)

  test('uses the persisted $/hr; baseline is the median of >= 5 other verified Live shows; total earnings stays the primary verdict', () => {
    const h = hist(shows(6))
    const vs = sessionVsTypical(last(h, 's5'), h)
    expect(vs).toMatchObject({ basis: 'same', sessions: 5, outcome: 'above' })
    expect(vs.perHour).toEqual({ sessions: 5, usdPerHour: 100, medianUSDPerHour: 70, deltaPct: 43, outcome: 'above' })
  })

  test('realistic high-data Live shows (paused-free) reach a verified comparison', () => {
    const fx = highDataFixture(); const h = buildSessionHistory(fx)
    const vs = sessionVsTypical(h.find((x) => x.id === 'live:show-bc-6'), h)
    expect(vs.perHour.sessions).toBe(6)
    expect(vs.perHour.usdPerHour).toBe(fx.shows.find((x) => x.id === 'show-bc-6').usdPerHour)
  })

  test('only 4 verified comparable shows: the total verdict can exist, $/hr does not', () => {
    const h = hist(shows(6, { 1: { minutes: 29 }, 2: { minutes: 20 } })) // two others below the 30-minute floor
    const vs = sessionVsTypical(last(h, 's5'), h)
    expect(vs).not.toBeNull()
    expect(vs.sessions).toBe(5)
    expect(vs.perHour).toBeNull()
  })

  test('30-minute floor is inclusive: 30 min qualifies, 29 min does not', () => {
    const ok = hist(shows(6, { 5: { minutes: 30 } }))
    expect(sessionVsTypical(last(ok, 's5'), ok).perHour).not.toBeNull()
    const short = hist(shows(6, { 5: { minutes: 29 } }))
    expect(sessionVsTypical(last(short, 's5'), short).perHour).toBeNull()
  })

  test('paused time is fine (active duration < span); a duration longer than the span is contradictory', () => {
    const paused = hist(shows(6, { 5: { pausedSeconds: 900 } }))
    expect(sessionVsTypical(last(paused, 's5'), paused).perHour).not.toBeNull()
    const base = shows(6)
    base[5] = { ...base[5], durationSeconds: 3600 + 600 } // active time longer than the start→end span
    const bad = hist(base)
    expect(liveVerifiedHourly(last(bad, 's5'))).toBeNull()
    expect(sessionVsTypical(last(bad, 's5'), bad).perHour).toBeNull() // total verdict stays
    expect(sessionVsTypical(last(bad, 's5'), bad)).not.toBeNull()
  })

  test.each([[0], [-5], [NaN], [null], [undefined], ['abc']])('invalid duration %p never supports $/hr', (dur) => {
    const base = shows(6); base[5] = { ...base[5], durationSeconds: dur }
    const h = hist(base)
    expect(liveVerifiedHourly(last(h, 's5'))).toBeNull()
    expect(sessionVsTypical(last(h, 's5'), h).perHour).toBeNull()
  })

  test('the persisted $/hr must agree with persisted total ÷ persisted duration; missing or contradictory is not trusted', () => {
    for (const bad of [undefined, null, '', NaN, 999, 1]) {
      const base = shows(6); base[5] = { ...base[5], usdPerHour: bad }
      const h = hist(base)
      expect(liveVerifiedHourly(last(h, 's5'))).toBeNull()
    }
    const base = shows(6); base[5] = { ...base[5], usdPerHour: base[5].usdPerHour + 0.01 } // within cents rounding
    expect(liveVerifiedHourly(last(hist(base), 's5'))).not.toBeNull()
  })

  test.each(['end_at_last_heartbeat', 'auto_ended_inactivity', 'chosen_end_time', 'still_live', null, undefined])(
    'an end that is inferred or unknown (%p) never supports $/hr, but the total verdict is still allowed', (endedHow) => {
      const list = shows(6); list[5] = { ...list[5], endedHow } // patched after building so undefined/null really are missing
      const h = hist(list)
      const vs = sessionVsTypical(last(h, 's5'), h)
      expect(vs).not.toBeNull()
      expect(vs.perHour).toBeNull()
    })

  test('system-verified ends (normal_stop, free_active_limit) support $/hr', () => {
    for (const endedHow of ['normal_stop', 'free_active_limit']) {
      const h = hist(shows(6, { 5: { endedHow } }))
      expect(sessionVsTypical(last(h, 's5'), h).perHour).not.toBeNull()
    }
  })

  test('unverified shows are removed from the $/hr baseline', () => {
    const h = hist(shows(6, { 0: { endedHow: 'auto_ended_inactivity' } })) // one of the 5 others is not verified
    const vs = sessionVsTypical(last(h, 's5'), h)
    expect(vs.sessions).toBe(5) // total baseline still has 5
    expect(vs.perHour).toBeNull() // verified baseline has only 4
  })

  test('missing or invalid start/end timestamps: no verdict, no $/hr, and not used as a baseline', () => {
    const noEnd = buildSessionHistory({ shows: [{ ...shows(1)[0], endedAt: null }] })
    expect(noEnd).toHaveLength(0) // existing rule: a show with no end is not a finished show
    for (const patch of [{ startedAt: 'not-a-date' }, { startedAt: undefined }, { endedAt: 'garbage' }]) {
      const base = shows(7); base[5] = { ...base[5], ...patch }
      const h = hist(base)
      const e = h.find((x) => x.sourceId === 's5')
      expect(liveRecordUsable(e)).toBe(false)
      expect(liveVerifiedHourly(e)).toBeNull()
      expect(sessionVsTypical(e, h)).toBeNull()
      expect(sessionVsTypical(last(h, 's6'), h).sessions).toBe(5) // the 6 others minus the unusable one
    }
    const base = shows(7); base[5] = { ...base[5], endedAt: iso(T0 + 5 * DAY - 60000) } // ends before it starts
    const h = hist(base)
    expect(liveRecordUsable(h.find((x) => x.sourceId === 's5'))).toBe(false)
    expect(sessionVsTypical(h.find((x) => x.sourceId === 's5'), h)).toBeNull()
  })

  test('incomplete shows (not finalized, or marked invalid) get no verdict and are excluded from baselines', () => {
    for (const patch of [{ finalized: false }, { endedHow: 'marked_invalid' }]) {
      const h = hist(shows(7, { 5: patch }))
      const e = h.find((x) => x.sourceId === 's5')
      expect(sessionVsTypical(e, h)).toBeNull()
      expect(sessionVsTypical(last(h, 's6'), h).sessions).toBe(5)
    }
  })

  test('a running entry never supports $/hr', () => {
    const e = buildSessionHistory({ shows: shows(1) })[0]
    expect(liveVerifiedHourly({ ...e, running: true })).toBeNull()
    expect(liveVerifiedHourly({ ...e, durationEstimated: true })).toBeNull()
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
    allTips: fx.tips, visibleTips: g.tips, allPaidSessions: fx.paidSessions || [], windowStarts: g.windowStarts,
    isPro: !!opts.isPro, loadComplete: opts.loadComplete,
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

  describe('Live shows: completeness is proven from the show\'s tips, not from start times', () => {
    const SHOW = Date.parse('2026-10-01T20:00:00Z')
    // show tips on Chaturbate (visible) and MyFreeCams; MFC's own window starts AFTER the show, so its tip is hidden for Free.
    const multiFixture = (over = {}) => {
      resetIds()
      const id = 'live-multi'
      const cb = tipRow(iso(SHOW + 10 * MIN), 'chaturbate', 'sam', 100, { live_session_id: id, source: 'extension' })
      const mfc = tipRow(iso(SHOW + 40 * MIN), 'myfreecams', 'kit', 400, { live_session_id: id, source: 'extension' })
      const show = liveShow({
        id, platform: 'Chaturbate', startedAt: iso(SHOW), minutes: 90, publicUsd: cb.usd + mfc.usd, tipCount: 2, uniqueTippers: 2,
        platformRevenue: [{ platform: 'MyFreeCams', usd: mfc.usd, tips: 1 }, { platform: 'Chaturbate', usd: cb.usd, tips: 1 }], ...over,
      })
      return { tips: [cb, mfc, tipRow(iso(SHOW + 5 * DAY), 'chaturbate', 'late', 10), tipRow(iso(SHOW + 40 * DAY), 'myfreecams', 'late', 10)], shows: [show], paidSessions: [] }
    }

    test('multi-platform: a hidden linked tip on a windowed platform proves the show partial (and the show total still includes it)', () => {
      const { history, map, g } = run(multiFixture())
      expect(g.shows).toHaveLength(1) // kept: Chaturbate is inside its window
      const live = history.find((e) => e.type === 'live')
      expect(map.get(live.id)).toEqual({ status: 'partial_verified', reason: 'hidden_live_tips' })
      expect(live.totalUSD).toBeGreaterThan(g.tips.filter((t) => t.live_session_id === 'live-multi').reduce((a, t) => a + t.usd, 0)) // visible tips < persisted total
      expect(sessionVsTypical(live, history, { completeness: map })).toBeNull()
    })

    test('single-platform: every linked tip visible and matching the saved summary → complete', () => {
      resetIds()
      const id = 'live-single'
      const tips = [10, 30, 50].map((m) => tipRow(iso(SHOW + m * MIN), 'bongacams', `f${m}`, 40, { live_session_id: id, source: 'extension' }))
      const show = liveShow({ id, platform: 'BongaCams', startedAt: iso(SHOW), minutes: 90, publicUsd: tips.reduce((a, t) => a + t.usd, 0), tipCount: 3, uniqueTippers: 3 })
      const { history, map } = run({ tips: [...tips, tipRow(iso(SHOW + 3 * DAY), 'bongacams', 'late', 5)], shows: [show], paidSessions: [] })
      expect(map.get(history.find((e) => e.type === 'live').id)).toEqual({ status: 'complete', reason: null })
    })

    test('the saved summary disagrees with the tip records (count or USD) → unknown, even when nothing is hidden', () => {
      for (const over of [{ tipCount: 3 }, { publicUsd: 999 }]) {
        const fx = multiFixture(over)
        const { history, map } = run(fx, { unlimitedPlatform: 'MyFreeCams' }) // MFC unwindowed: nothing hidden
        expect(map.get(history.find((e) => e.type === 'live').id)).toEqual({ status: 'unknown', reason: 'live_summary_mismatch' })
      }
    })

    test('nothing hidden and the summary reconciles → complete (unlimited platform)', () => {
      const { history, map } = run(multiFixture(), { unlimitedPlatform: 'MyFreeCams' })
      expect(map.get(history.find((e) => e.type === 'live').id).status).toBe('complete')
    })

    test('without the visible tips the check cannot prove anything → unknown (fails closed); Pro stays complete', () => {
      const fx = multiFixture(); const g = gate(fx)
      const history = buildSessionHistory({ tips: g.tips, shows: g.shows })
      const m = sessionCompletenessMap(history, { allTips: fx.tips, windowStarts: g.windowStarts, isPro: false })
      expect(m.get(history.find((e) => e.type === 'live').id)).toEqual({ status: 'unknown', reason: 'visible_tips_not_supplied' })
      expect(run(fx, { isPro: true }).map.get(history.find((e) => e.type === 'live').id).status).toBe('complete')
    })

    test('a Live show with no linked tips (private-only) and a consistent summary is complete', () => {
      const show = liveShow({ id: 'priv', platform: 'Chaturbate', startedAt: iso(SHOW), minutes: 60, publicUsd: 0, privateUsd: 12, tipCount: 0 })
      const { history, map } = run({ tips: [tipRow(iso(SHOW + 3 * DAY), 'chaturbate', 'late', 5)], shows: [show], paidSessions: [] })
      expect(map.get(history.find((e) => e.type === 'live').id).status).toBe('complete')
    })

    test('high-data Free fixture: the visible single-platform Live shows reconcile and are complete', () => {
      const { history, map } = run(highDataFixture())
      const lives = history.filter((e) => e.type === 'live')
      expect(lives.length).toBeGreaterThan(0)
      expect(lives.every((e) => map.get(e.id).status === 'complete')).toBe(true)
    })
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

describe('regression: comparison pools, fractional cents, and restricted Free data', () => {
  test('the comparison pool excludes every incomplete session (verified against an independent count and median)', () => {
    const fx = highDataFixture()
    const { history, map } = run(fx)
    const latestCb = history.find((e) => e.platforms[0] === 'chaturbate' && e.type === 'imported' && e.isValid && map.get(e.id).status === 'complete')
    const sameKind = (e) => e.id !== latestCb.id && e.type === latestCb.type && e.platforms.length === 1 && e.platforms[0] === 'chaturbate'
    const meaningful = history.filter((e) => sameKind(e) && e.isValid)
    const completeOnly = meaningful.filter((e) => map.get(e.id).status === 'complete')
    expect(completeOnly.length).toBeLessThan(meaningful.length) // the straddling partial session really is in the raw pool
    const vs = sessionVsTypical(latestCb, history, { completeness: map })
    expect(vs.sessions).toBe(completeOnly.length)
    const sorted = completeOnly.map((e) => e.totalUSD).sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const med = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    expect(vs.medianUSD).toBe(Math.round(med * 100) / 100)
    expect(sessionVsTypical(latestCb, history)?.sessions).toBe(meaningful.length) // without completeness the partial one would count
  })

  test('verdict objects carry only aggregate fields (no usernames, tips or timestamps)', () => {
    const fx = highDataFixture(); const { history, map } = run(fx)
    const allowed = ['basis', 'deltaPct', 'medianUSD', 'outcome', 'perHour', 'sessions']
    for (const e of history) {
      const v = sessionVsTypical(e, history, { completeness: map })
      if (v) { expect(Object.keys(v).sort()).toEqual(allowed); if (v.perHour) expect(Object.keys(v.perHour).sort()).toEqual(['deltaPct', 'medianUSDPerHour', 'outcome', 'sessions', 'usdPerHour']) }
    }
  })

  test('fractional cents are preserved end to end in the contributor list and reconcile exactly', () => {
    resetIds()
    // 1 + 3 + 7 BongaCams tokens = $0.275 in one bucket: not representable in cents
    const tips = [[20, 1], [24, 3], [29, 7]].map(([m, tk]) => tipRow(`2026-10-01T20:${m}:00.000Z`, 'bongacams', 'kit', tk))
    const b = sessionBuckets(buildSessionHistory({ tips })[0], { tips }).buckets[0]
    expect(b.fans[0].usd).toBeCloseTo(0.275, 9)
    expect(b.fans[0].usd).not.toBe(Math.round(b.fans[0].usd * 100) / 100)
    expect(b.fans[0].usd + b.unattributedPublicUSD + b.unattributedPrivateUSD).toBeCloseTo(tips.reduce((a, t) => a + t.usd, 0), 9)
    // high-data: many contributor values are sub-cent, and every session still reconciles to 1e-9
    const fx = highDataFixture(); let subCent = 0
    for (const e of buildSessionHistory(fx)) {
      const bb = sessionBuckets(e, { tips: fx.tips }).buckets
      const sum = bb.reduce((a, k) => a + k.fans.reduce((x, f) => x + f.usd, 0) + k.unattributedPublicUSD + k.unattributedPrivateUSD, 0)
      const raw = e.type === 'live'
        ? fx.tips.filter((t) => t.live_session_id === e.sourceId).reduce((a, t) => a + t.usd, 0) + e.privateIntervals.reduce((a, iv) => a + iv.earningsUsd, 0)
        : e.type === 'private' ? e.charges.reduce((a, c) => a + c.usd, 0) : e.session.tips.reduce((a, t) => a + t.usd, 0)
      expect(Math.abs(sum - raw)).toBeLessThan(1e-9)
      for (const k of bb) for (const f of k.fans) if (Math.abs(f.usd * 100 - Math.round(f.usd * 100)) > 1e-6) subCent++
    }
    expect(subCent).toBeGreaterThan(20)
  })

  test('existing bucket outputs are unchanged for every session in both fixtures (snapshot from the original engine)', () => {
    for (const [name, fx] of [['low', lowDataFixture()], ['high', highDataFixture()]]) {
      const history = buildSessionHistory(fx)
      expect(history.length).toBe(Object.keys(before[name]).length)
      for (const e of history) {
        expect(JSON.parse(JSON.stringify(stripNew(sessionBuckets(e, { tips: fx.tips }))))).toEqual(before[name][e.id].buckets)
      }
    }
  })

  test('restricted Free rows never appear in any engine output (completeness, verdicts, buckets of visible sessions)', () => {
    const fx = highDataFixture()
    const { g, history, map } = run(fx)
    const visibleIds = new Set(g.tips.map((t) => t.id))
    const hidden = fx.tips.filter((t) => !visibleIds.has(t.id))
    expect(hidden.length).toBeGreaterThan(100)
    // usernames that exist ONLY in hidden rows
    const visibleNames = new Set(g.tips.map((t) => t.username))
    const hiddenOnly = new Set(hidden.map((t) => t.username).filter((u) => !visibleNames.has(u)))
    const blob = JSON.stringify({
      map: [...map.entries()],
      vs: history.map((e) => sessionVsTypical(e, history, { completeness: map })),
      buckets: history.map((e) => sessionBuckets(e, { tips: g.tips })),
    })
    for (const u of hiddenOnly) expect(blob).not.toContain(`"${u}"`)
    // the straddling session's visible buckets contain only visible tippers and amounts
    const straddle = history.find((e) => e.platforms[0] === 'chaturbate' && Date.parse(e.startTime) === HIGH_CB_WINDOW_START + 10 * MIN)
    const bk = sessionBuckets(straddle, { tips: g.tips })
    expect(bk.buckets.reduce((a, k) => a + k.fans.reduce((x, f) => x + f.usd, 0), 0)).toBeCloseTo(straddle.session.tips.reduce((a, t) => a + t.usd, 0), 9)
  })
})

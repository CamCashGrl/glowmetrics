import { resolveTableLoad, loadUserHistory, failureState } from '../resolveLoad'
import { tipsSource, paidSessionsSource, toAscending } from '../queries'
import { fakeSupabase, mkTips, mkPaid } from './fakeSupabase'
import { accessibleDataset, applyFreeAnalysisWindow, freeWindowStartByPlatform } from '../../analytics'
import { buildSessionHistory, sessionCompletenessMap, sessionVsTypical } from '../../sessions/normalize'

const noSleep = { sleep: async () => {} }
const run = (tables, serverOpts, previous = {}) => {
  const db = fakeSupabase(tables, serverOpts)
  return loadUserHistory({ tips: tipsSource(db, 'u1'), paid: paidSessionsSource(db, 'u1'), previous, fetchOpts: noSleep }).then((h) => ({ h, db }))
}
// Fail every page of `table`'s full-history queries, or (afterFirst) only the cursor pages after the first.
const failTable = (table, afterFirst = false) => ({ fail: (c) => (c.table === table && c.paged && (!afterFirst || c.cursor) ? 'error' : null) })

describe('resolveTableLoad: never replace complete data with partial data', () => {
  const good = { complete: true, rows: [{ id: 1 }], reason: null, error: null }
  const bad = { complete: false, rows: [{ id: 1 }], reason: 'page_failed', error: { code: '503', message: 'x' }, expected: 3, received: 1 }

  test('complete → apply', () => {
    expect(resolveTableLoad({ table: 'tips', result: good, previousComplete: false })).toMatchObject({ apply: true, complete: true, stale: false, issue: null })
  })
  test('incomplete + a previous COMPLETE load → keep what is on screen (stale, not partial)', () => {
    const d = resolveTableLoad({ table: 'tips', result: bad, previousComplete: true })
    expect(d).toMatchObject({ apply: false, rows: null, complete: true, stale: true })
    expect(d.issue).toMatchObject({ table: 'tips', stale: true, reason: 'page_failed' })
  })
  test('incomplete + no complete load yet → show what arrived, flagged incomplete', () => {
    const d = resolveTableLoad({ table: 'tips', result: bad, previousComplete: false })
    expect(d).toMatchObject({ apply: true, complete: false, stale: false })
    expect(d.rows).toHaveLength(1)
    expect(d.issue.stale).toBe(false)
  })
  test('failureState (a thrown error) never claims completeness it cannot prove', () => {
    expect(failureState({ tips: true, paid: false })).toMatchObject({ tipsComplete: true, paidComplete: false })
    expect(failureState({}).issues.every((i) => i.reason === 'exception')).toBe(true)
  })
})

describe('loadUserHistory with a database-faithful fake', () => {
  test('complete load: 2,500 tips + 1,200 private sessions, ascending output, no flags', async () => {
    const { h } = await run({ tips: mkTips(2500), paid_sessions: mkPaid(1200) })
    expect(h.complete).toBe(true)
    expect(h.fullyFresh).toBe(true)
    expect(h.issues).toEqual([])
    const tips = toAscending(h.tips.rows)
    expect(tips).toHaveLength(2500)
    expect(tips.every((t, i) => i === 0 || (tips[i - 1].date_time <= t.date_time))).toBe(true)
    expect(toAscending(h.paid.rows)).toHaveLength(1200)
  })

  test('FAILED PRIVATE-SESSION LOAD (first load): tips apply normally, private sessions are flagged incomplete', async () => {
    const { h } = await run({ tips: mkTips(10), paid_sessions: mkPaid(1500) }, failTable('paid_sessions', true))
    expect(h.tips).toMatchObject({ apply: true, complete: true })
    expect(h.paid).toMatchObject({ apply: true, complete: false })
    expect(h.paid.rows).toHaveLength(1000) // the NEWEST 1000 arrived
    expect(h.complete).toBe(false)
    expect(h.issues).toHaveLength(1)
    expect(h.issues[0]).toMatchObject({ table: 'paid_sessions', reason: 'page_failed', stale: false })
  })

  test('FAILED PRIVATE-SESSION REFRESH after a complete load: existing private earnings are NOT replaced', async () => {
    const { h } = await run({ tips: mkTips(10), paid_sessions: mkPaid(1500) }, failTable('paid_sessions'), { tips: true, paid: true })
    expect(h.paid).toMatchObject({ apply: false, rows: null, complete: true, stale: true })
    expect(h.tips.apply).toBe(true)
    expect(h.complete).toBe(true) // what is on screen is a complete (older) snapshot
    expect(h.fullyFresh).toBe(false) // but the "Updated" time must not advance
    expect(h.issues[0]).toMatchObject({ table: 'paid_sessions', stale: true })
  })

  test('FAILED TIPS REFRESH after a complete load: the on-screen tips are kept', async () => {
    const { h } = await run({ tips: mkTips(2500), paid_sessions: mkPaid(5) }, failTable('tips', true), { tips: true, paid: true })
    expect(h.tips).toMatchObject({ apply: false, complete: true, stale: true })
    expect(h.paid.apply).toBe(true)
  })

  test('FAILED FIRST TIPS LOAD with no data: flagged incomplete (an empty dashboard is never "complete")', async () => {
    const { h } = await run({ tips: mkTips(50), paid_sessions: [] }, failTable('tips'))
    expect(h.tips).toMatchObject({ apply: true, complete: false })
    expect(h.tips.rows).toHaveLength(0)
    expect(h.complete).toBe(false)
  })

  test('an empty account loads as COMPLETE (zero rows is a real answer, not a failure)', async () => {
    const { h } = await run({ tips: [], paid_sessions: [] })
    expect(h.complete).toBe(true)
    expect(h.tips.rows).toEqual([])
  })

  test('another account\'s rows are never loaded (the query is scoped to the user)', async () => {
    const { h } = await run({ tips: [...mkTips(5, { uid: 'u1' }), ...mkTips(7, { uid: 'u2' })], paid_sessions: mkPaid(3, { uid: 'u2' }) })
    expect(h.tips.rows).toHaveLength(5)
    expect(h.tips.rows.every((t) => t.user_id === 'u1')).toBe(true)
    expect(h.paid.rows).toHaveLength(0)
  })

  test('concurrent loads: "previous" is read when the fetches FINISH, so an older failing load cannot overwrite complete data applied meanwhile', async () => {
    const state = { tips: false, paid: false }
    const db = fakeSupabase({ tips: mkTips(5), paid_sessions: [] }, failTable('tips'))
    const pending = loadUserHistory({ tips: tipsSource(db, 'u1'), paid: paidSessionsSource(db, 'u1'), previous: () => state, fetchOpts: noSleep })
    state.tips = true; state.paid = true // a newer load completes while this one is still running
    const h = await pending
    expect(h.tips).toMatchObject({ apply: false, stale: true })
  })
})

describe('Free and Pro', () => {
  const platformsTips = () => {
    // 3 platforms, 2,400 rows, last 90 days; each platform active until the end
    const out = []
    ;['chaturbate', 'bongacams', 'myfreecams'].forEach((p, pi) => {
      for (let i = 0; i < 800; i++) out.push({ id: pi * 100000 + i + 1, user_id: 'u1', platform: p, username: `f${i % 30}`, usd: 0.05 * ((i % 7) + 1), tokens: 1, date_time: new Date(Date.UTC(2026, 7, 1) + (i * 3 + pi) * 3600000).toISOString() })
    })
    return out
  }

  test('loading is the same for Free and Pro (the Free window is applied afterwards, never in the fetch)', async () => {
    const { h, db } = await run({ tips: platformsTips(), paid_sessions: [] })
    expect(h.tips.rows).toHaveLength(2400)
    expect(JSON.stringify(db.calls.map((c) => c.orders))).not.toMatch(/31|window/i)
    const all = toAscending(h.tips.rows)
    const pro = accessibleDataset({ tips: all, isPro: true })
    const free = accessibleDataset({ tips: all, isPro: false })
    expect(pro.tips).toHaveLength(2400)
    expect(free.tips.length).toBeLessThan(2400) // entitlement unchanged
  })

  test('newest-first means a partial load keeps the Free window anchors correct (oldest-first would not)', async () => {
    const all = toAscending((await run({ tips: platformsTips(), paid_sessions: [] })).h.tips.rows)
    const trueStarts = freeWindowStartByPlatform(all)
    // page 2 fails: the NEWEST 1000 rows arrived
    const { h } = await run({ tips: platformsTips(), paid_sessions: [] }, failTable('tips', true))
    const newestPartial = toAscending(h.tips.rows)
    const partialStarts = freeWindowStartByPlatform(newestPartial)
    expect(h.tips.complete).toBe(false)
    for (const p of Object.keys(partialStarts)) expect(partialStarts[p].getTime()).toBe(trueStarts[p].getTime())
    // what an OLDEST-first partial would have done: anchors far too early → a Free user would see older data than their plan allows
    const oldestPartial = [...all].sort((a, b) => a.date_time.localeCompare(b.date_time)).slice(0, 1000)
    const wrong = freeWindowStartByPlatform(oldestPartial)
    expect(Object.keys(wrong).some((p) => wrong[p].getTime() < trueStarts[p].getTime())).toBe(true)
  })

  test('an incomplete load removes every Sessions verdict for Free AND Pro (completeness cannot be established)', async () => {
    const tips = []
    for (let d = 0; d < 8; d++) { const day = `2026-09-${String(10 + d).padStart(2, '0')}`; tips.push({ id: `a${d}`, platform: 'chaturbate', username: 'Ann', usd: 20, date_time: `${day}T20:00:00Z`, live_session_id: null }, { id: `b${d}`, platform: 'chaturbate', username: 'Ben', usd: 10, date_time: `${day}T20:40:00Z`, live_session_id: null }) }
    const history = buildSessionHistory({ tips })
    for (const isPro of [true, false]) {
      const ok = sessionCompletenessMap(history, { allTips: tips, visibleTips: tips, windowStarts: isPro ? null : {}, isPro, loadComplete: true })
      const bad = sessionCompletenessMap(history, { allTips: tips, visibleTips: tips, windowStarts: isPro ? null : {}, isPro, loadComplete: false })
      if (isPro) expect(sessionVsTypical(history[0], history, { completeness: ok })).not.toBeNull()
      expect(sessionVsTypical(history[0], history, { completeness: bad })).toBeNull()
    }
  })

  test('with a complete load the Free window is applied exactly as before (applyFreeAnalysisWindow unchanged)', async () => {
    const all = toAscending((await run({ tips: platformsTips(), paid_sessions: [] })).h.tips.rows)
    const direct = applyFreeAnalysisWindow(platformsTips(), { windowDays: 31 })
    expect(applyFreeAnalysisWindow(all, { windowDays: 31 }).map((t) => t.id).sort()).toEqual(direct.map((t) => t.id).sort())
  })
})

describe('S1: per-table state, coverage and asOf (recorded only; nothing on screen reads them yet)', () => {
  const T1 = 1_800_000_000_000
  const at = (t) => ({ ...noSleep, now: () => t })
  const runAt = (tables, serverOpts, previous, t) => {
    const db = fakeSupabase(tables, serverOpts)
    return loadUserHistory({ tips: tipsSource(db, 'u1'), paid: paidSessionsSource(db, 'u1'), previous, fetchOpts: at(t) })
  }

  test('complete load → state "current", coverage "all", asOf = when it finished; "Updated" may advance', async () => {
    const h = await runAt({ tips: mkTips(1200), paid_sessions: mkPaid(3) }, {}, {}, T1)
    expect(h.loadState.tips).toEqual({ complete: true, state: 'current', coverage: { kind: 'all' }, asOf: T1 })
    expect(h.loadState.paid.state).toBe('current')
    expect(h.fullyFresh).toBe(true)
  })

  test('failed REFRESH after a complete load → "stale": rows NOT applied, previous coverage and asOf kept, "Updated" must not advance', async () => {
    const previous = { tips: { complete: true, state: 'current', coverage: { kind: 'all' }, asOf: T1 }, paid: { complete: true, state: 'current', coverage: { kind: 'all' }, asOf: T1 } }
    const h = await runAt({ tips: mkTips(2500), paid_sessions: mkPaid(3) }, failTable('tips', true), previous, T1 + 60_000)
    expect(h.tips).toMatchObject({ apply: false, rows: null, complete: true, stale: true })
    expect(h.loadState.tips).toEqual({ complete: true, state: 'stale', coverage: { kind: 'all' }, asOf: T1 }) // the OLD time
    expect(h.fullyFresh).toBe(false)
    expect(h.issues[0]).toMatchObject({ table: 'tips', stale: true })
  })

  test('first load fails part-way → "partial" with a provable "since" coverage; tips and private sessions tracked separately', async () => {
    const h = await runAt({ tips: mkTips(2500), paid_sessions: mkPaid(3) }, failTable('tips', true), {}, T1)
    expect(h.loadState.tips.state).toBe('partial')
    expect(h.loadState.tips.coverage.kind).toBe('since')
    expect(h.loadState.paid).toMatchObject({ complete: true, state: 'current', coverage: { kind: 'all' } })
    expect(h.complete).toBe(false)
  })

  test('first load gets nothing → "failed", coverage "none"', async () => {
    const h = await runAt({ tips: mkTips(50), paid_sessions: [] }, failTable('tips'), {}, T1)
    expect(h.loadState.tips).toEqual({ complete: false, state: 'failed', coverage: { kind: 'none' }, asOf: null })
  })

  test('the #750 boolean shape for "previous" still works (true = complete snapshot on screen)', async () => {
    const h = await runAt({ tips: mkTips(10), paid_sessions: mkPaid(1500) }, failTable('paid_sessions'), { tips: true, paid: true }, T1)
    expect(h.paid).toMatchObject({ apply: false, stale: true })
    expect(h.loadState.paid.state).toBe('stale')
  })

  test('failureState (thrown error) keeps a complete snapshot "stale" with its coverage/asOf and never invents one', () => {
    const f = failureState({ tips: { complete: true, state: 'current', coverage: { kind: 'all' }, asOf: T1 }, paid: { complete: false } })
    expect(f.loadState.tips).toEqual({ complete: true, state: 'stale', coverage: { kind: 'all' }, asOf: T1 })
    expect(f.loadState.paid).toEqual({ complete: false, state: 'failed', coverage: { kind: 'none' }, asOf: null })
    expect(f.tipsComplete).toBe(true)
    expect(f.paidComplete).toBe(false)
  })

  test('recovery: after a failed first load, a successful retry becomes "current"', async () => {
    const tables = { tips: mkTips(2500), paid_sessions: mkPaid(3) }
    const bad = await runAt(tables, failTable('tips', true), {}, T1)
    expect(bad.loadState.tips.state).toBe('partial')
    const good = await runAt(tables, {}, bad.loadState, T1 + 1000)
    expect(good.tips).toMatchObject({ apply: true, complete: true })
    expect(good.loadState.tips).toEqual({ complete: true, state: 'current', coverage: { kind: 'all' }, asOf: T1 + 1000 })
  })
})

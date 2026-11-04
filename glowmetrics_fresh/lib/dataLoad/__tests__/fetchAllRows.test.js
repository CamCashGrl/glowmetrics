import { fetchAllRows, summarizeError, RETRY_DELAYS_MS, PAGE_SIZE } from '../fetchAllRows'
import { tipsPageFetcher } from '../queries'
import { fakeSupabase, mkTips } from './fakeSupabase'

const noSleep = { sleep: async () => {} }
const load = (n, serverOpts, opts = {}, tipOpts = {}) => {
  const db = fakeSupabase({ tips: mkTips(n, tipOpts) }, serverOpts)
  return fetchAllRows(tipsPageFetcher(db, 'u1'), { ...noSleep, ...opts }).then((r) => ({ r, db }))
}

describe('pagination boundaries (page size 1000)', () => {
  test.each([0, 1, 999, 1000, 1001, 1999, 2000, 2001, 2500])('%i rows: complete, every row exactly once, no needless extra request', async (n) => {
    const { r, db } = await load(n)
    expect(r.complete).toBe(true)
    expect(r.rows).toHaveLength(n)
    expect(new Set(r.rows.map((x) => x.id)).size).toBe(n)
    expect(r.verifiedCount).toBe(true)
    expect(r.expected).toBe(n)
    expect(db.calls.length).toBe(Math.max(1, Math.ceil(n / PAGE_SIZE)))
  })

  test('2,500 rows are requested as ranges 0-999, 1000-1999, 2000-2999, asking for the exact count only on page 1', async () => {
    const { db } = await load(2500)
    expect(db.calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
    expect(db.calls.map((c) => c.count)).toEqual(['exact', null, null])
  })

  test('rows with identical timestamps straddling the 1000-row boundary are neither dropped nor duplicated', async () => {
    const { r } = await load(1500, {}, {}, { sameTime: true })
    expect(r.complete).toBe(true)
    expect(new Set(r.rows.map((x) => x.id)).size).toBe(1500)
  })

  test('a query WITHOUT the id tiebreaker (the old ordering) is detected as incomplete instead of returning wrong rows', async () => {
    const db = fakeSupabase({ tips: mkTips(1500, { sameTime: true }) })
    const legacy = (from, to, { wantCount }) => db.from('tips').select('*', wantCount ? { count: 'exact' } : undefined).eq('user_id', 'u1').order('date_time', { ascending: true }).range(from, to)
    const r = await fetchAllRows(legacy, noSleep)
    expect(r.complete).toBe(false)
    expect(r.reason).toBe('row_count_mismatch')
    expect(r.rows.length).toBeLessThan(1500)
  })

  test('a server row cap below the page size cannot be mistaken for the last page', async () => {
    const { r, db } = await load(1200, { maxRows: 500 })
    expect(r.complete).toBe(true)
    expect(r.rows).toHaveLength(1200)
    expect(db.calls.map((c) => c.range[0])).toEqual([0, 500, 1000])
  })

  test('without a count, a short page ends the load (documented weaker guarantee: verifiedCount=false)', async () => {
    const rows = mkTips(1000)
    let calls = 0
    const r = await fetchAllRows(async (from, to) => { calls++; return { data: rows.slice(from, to + 1), error: null, count: null } }, noSleep)
    expect(r.complete).toBe(true)
    expect(r.verifiedCount).toBe(false)
    expect(calls).toBe(2) // a full page forces one more request to find the end
  })
})

describe('failures, retries and incompleteness', () => {
  test.each([['first', 0], ['middle', 1000], ['last', 2000]])('a %s page that keeps failing makes the load INCOMPLETE (never silently complete)', async (_n, failFrom) => {
    const { r } = await load(2500, { fail: ({ from }) => (from === failFrom ? 'error' : null) })
    expect(r.complete).toBe(false)
    expect(r.reason).toBe('page_failed')
    expect(r.failedOffset).toBe(failFrom)
    expect(r.error).toEqual({ code: '503', message: 'upstream unavailable' })
    expect(r.retries).toBe(RETRY_DELAYS_MS.length)
    expect(r.rows).toHaveLength(failFrom) // what arrived is returned, flagged incomplete
  })

  test('retries back off 500ms, 1s, 2s before giving up', async () => {
    const delays = []
    const db = fakeSupabase({ tips: mkTips(50) }, { fail: () => 'error' })
    await fetchAllRows(tipsPageFetcher(db, 'u1'), { sleep: async (ms) => { delays.push(ms) } })
    expect(delays).toEqual([500, 1000, 2000])
    expect(db.calls).toHaveLength(4) // 1 try + 3 retries
  })

  test('a transient failure that succeeds on retry gives a complete load', async () => {
    let failed = 0
    const { r } = await load(2500, { fail: ({ from }) => (from === 1000 && failed++ < 2 ? 'error' : null) })
    expect(r.complete).toBe(true)
    expect(r.rows).toHaveLength(2500)
    expect(r.retries).toBe(2)
  })

  test('a thrown network error is caught, retried and reported (no unhandled rejection)', async () => {
    const { r } = await load(1500, { fail: ({ from }) => (from === 1000 ? 'throw' : null) })
    expect(r.complete).toBe(false)
    expect(r.error.message).toMatch(/network down/)
  })

  test('a malformed response (no data, no error) is a failure, not an empty complete load', async () => {
    const r = await fetchAllRows(async () => ({ data: null, error: null }), noSleep)
    expect(r.complete).toBe(false)
    expect(r.reason).toBe('page_failed')
  })

  test('an early empty page before the expected count is reached is incomplete', async () => {
    const rows = mkTips(10)
    const r = await fetchAllRows(async (from) => ({ data: from === 0 ? rows.slice(0, 4) : [], error: null, count: 10 }), noSleep)
    expect(r.complete).toBe(false)
    expect(r.reason).toBe('row_count_mismatch')
    expect(r.rows).toHaveLength(4)
  })

  test('rows shifted across pages by concurrent changes: duplicates are removed and the shortfall is reported, never hidden', async () => {
    const rows = mkTips(1500)
    // page 2 re-sends the last 200 rows of page 1 (offsets shifted by 200 inserts) and then runs out
    const pages = [rows.slice(0, 1000), [...rows.slice(800, 1000), ...rows.slice(1000, 1300)]]
    let i = 0
    const r = await fetchAllRows(async () => ({ data: pages[i++] || [], error: null, count: 1500 }), noSleep)
    expect(r.received).toBeGreaterThan(r.rows.length) // duplicates were received
    expect(new Set(r.rows.map((x) => x.id)).size).toBe(r.rows.length) // and removed
    expect(r.rows).toHaveLength(1300)
    expect(r.complete).toBe(false) // 200 rows are missing
    expect(r.reason).toBe('row_count_mismatch')
  })

  test('rows inserted DURING the load (more distinct rows than the starting count) still count as complete', async () => {
    const rows = mkTips(1500)
    const r = await fetchAllRows(async (from, to) => ({ data: rows.slice(from, to + 1), error: null, count: 1400 }), noSleep)
    expect(r.complete).toBe(true)
    expect(r.rows.length).toBeGreaterThanOrEqual(1400)
  })

  test('errors are summarised to code + message only: no row data can be logged', () => {
    const s = summarizeError({ code: 'PGRST', message: 'x'.repeat(500), details: { username: 'secret_fan', usd: 99 }, row: { username: 'secret_fan' } })
    expect(Object.keys(s).sort()).toEqual(['code', 'message'])
    expect(s.message.length).toBe(200)
    expect(JSON.stringify(s)).not.toContain('secret_fan')
  })

  test('a runaway loop is bounded', async () => {
    const r = await fetchAllRows(async () => ({ data: [{ id: Math.random() }], error: null, count: 1e9 }), { ...noSleep, maxPages: 5, pageSize: 1 })
    expect(r.complete).toBe(false)
    expect(r.reason).toBe('max_pages')
  })
})

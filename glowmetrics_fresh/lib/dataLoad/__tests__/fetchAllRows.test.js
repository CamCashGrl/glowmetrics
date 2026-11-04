import { fetchAllRows, summarizeError, tsTextToMs, RETRY_DELAYS_MS, PAGE_SIZE } from '../fetchAllRows'
import { tipsSource, paidSessionsSource, keysetFilter, toAscending } from '../queries'
import { fakeSupabase, mkTips, mkPaid, uuidFor, tsToMicros, microsToPgText } from './fakeSupabase'

const noSleep = { sleep: async () => {} }
const tipsLoad = async (rows, serverOpts = {}, opts = {}) => {
  const db = fakeSupabase({ tips: rows }, serverOpts)
  const r = await fetchAllRows(tipsSource(db, 'u1'), { ...noSleep, ...opts })
  return { r, db }
}
const dated = (db) => db.calls.filter((c) => !c.filters.some(([op]) => op === 'isnull'))
const ids = (rows) => rows.map((x) => String(x.id))
// rows of the fake table in (date_time DESC, id DESC) order, as the database would return them
const dbOrder = (rows) => [...rows].sort((a, b) => {
  const x = tsToMicros(a.date_time); const y = tsToMicros(b.date_time)
  if (x !== y) return x > y ? -1 : 1
  return BigInt(a.id) > BigInt(b.id) ? -1 : 1
})

describe('keyset pagination boundaries (page size 1000)', () => {
  test.each([0, 1, 999, 1000, 1001, 1999, 2000, 2001, 2500])('%i rows: complete, every row exactly once, coverage "all"', async (n) => {
    const { r, db } = await tipsLoad(mkTips(n))
    expect(r.complete).toBe(true)
    expect(r.rows).toHaveLength(n)
    expect(new Set(ids(r.rows)).size).toBe(n)
    expect(r.coverage).toEqual({ kind: 'all' })
    expect(r.verifiedCount).toBe(true)
    expect(r.expected).toBe(n)
    // stop early on a short page once the count is met; a full last page needs one empty page to prove the end
    const expectedDated = n === 0 ? 1 : n % PAGE_SIZE === 0 ? n / PAGE_SIZE + 1 : Math.ceil(n / PAGE_SIZE)
    expect(dated(db)).toHaveLength(expectedDated)
  })

  test('each page after the first asks for rows strictly after the last row received (quoted timestamp, bigint id)', async () => {
    const rows = mkTips(2500)
    const { db } = await tipsLoad(rows)
    const order = dbOrder(rows)
    const calls = dated(db)
    expect(calls[0].logic).toEqual([])
    expect(calls[0].count).toBe('exact')
    expect(calls[1].count).toBe(null)
    for (const [k, c] of calls.slice(1).entries()) {
      const last = order[(k + 1) * PAGE_SIZE - 1]
      const ts = microsToPgText(tsToMicros(last.date_time))
      expect(c.logic).toEqual([`date_time.lt."${ts}",and(date_time.eq."${ts}",id.lt.${last.id})`])
    }
    expect(calls[0].orders).toEqual([['date_time', false], ['id', false]])
    expect(calls[0].filters).toContainEqual(['notnull', 'date_time'])
    expect(calls[0].select).toBe('*,cursor_ts:date_time::text,cursor_id:id::text')
  })

  test('1,500 rows with IDENTICAL timestamps across the page boundary: none dropped, none duplicated', async () => {
    const { r } = await tipsLoad(mkTips(1500, { sameTime: true }))
    expect(r.complete).toBe(true)
    expect(new Set(ids(r.rows)).size).toBe(1500)
  })

  test('microsecond timestamps inside one millisecond are ordered and paged exactly (never rounded through a JS Date)', async () => {
    const rows = Array.from({ length: 2100 }, (_, i) => ({ id: i + 1, user_id: 'u1', platform: 'chaturbate', username: 'f', usd: 1,
      date_time: `2026-10-01T00:00:00.${String(100000 + (i % 1000) * 37 % 1000).padStart(6, '0')}Z` }))
    const { r, db } = await tipsLoad(rows)
    expect(r.complete).toBe(true)
    expect(new Set(ids(r.rows)).size).toBe(2100)
    expect(dated(db)[1].logic[0]).toMatch(/^date_time\.lt\."2026-10-01 00:00:00\.\d+\+00"/) // exact database text in the cursor
  })

  test('BIGINT ids above 2^53: the cursor and de-duplication use exact text, so adjacent ids are not merged', async () => {
    const base = BigInt(Number.MAX_SAFE_INTEGER) + 1n
    const rows = Array.from({ length: 1500 }, (_, i) => ({ id: base + BigInt(i), user_id: 'u1', platform: 'chaturbate', username: 'f', usd: 1, date_time: '2026-10-01T00:00:00.000Z' }))
    const { r, db } = await tipsLoad(rows)
    expect(r.complete).toBe(true)
    expect(r.rows).toHaveLength(1500)
    expect(new Set(r.rows.map((x) => x.id)).size).toBeLessThan(1500) // the plain JS numbers DO collide (why the cursor never uses them)
    expect(dated(db)[1].logic[0]).toContain(`id.lt.${base + 500n}`) // exact digits of the 1000th row (DESC order)
  })

  test('private sessions (UUID ids): the cursor quotes the uuid, and paging is exact across equal timestamps', async () => {
    const paid = Array.from({ length: 1500 }, (_, i) => ({ id: uuidFor(i + 1), user_id: 'u1', platform: 'bongacams', username: 'v', session_type: 'private', usd: 7.575, date_time: '2026-06-01T00:00:00.000Z' }))
    const db = fakeSupabase({ paid_sessions: paid })
    const r = await fetchAllRows(paidSessionsSource(db, 'u1'), noSleep)
    expect(r.complete).toBe(true)
    expect(new Set(r.rows.map((x) => x.id)).size).toBe(1500)
    expect(dated(db)[1].logic[0]).toBe(`date_time.lt."2026-06-01 00:00:00+00",and(date_time.eq."2026-06-01 00:00:00+00",id.lt."${uuidFor(501)}")`)
  })

  test('a server row cap below the page size cannot be mistaken for the end of the data', async () => {
    const { r } = await tipsLoad(mkTips(1200), { maxRows: 500 })
    expect(r.complete).toBe(true)
    expect(r.rows).toHaveLength(1200)
  })

  test('without a count, the loader reads until an empty page (complete, but verifiedCount=false)', async () => {
    const all = mkTips(1000)
    const db = fakeSupabase({ tips: all })
    const src = tipsSource(db, 'u1')
    const noCount = { ...src, dated: { ...src.dated, fetchPage: (c, l) => src.dated.fetchPage(c, l, { wantCount: false }) } }
    const r = await fetchAllRows(noCount, noSleep)
    expect(r.complete).toBe(true)
    expect(r.verifiedCount).toBe(false)
    expect(r.rows).toHaveLength(1000)
  })
})

describe('concurrent changes between pages (each page is its own snapshot)', () => {
  const onCall = (k, fn) => ({ onQuery: (ctx, tables) => { if (ctx.table === 'tips' && ctx.call === k) fn(tables) } })

  test('a row already received is DELETED before page 2: no later row is skipped (offset paging would skip one)', async () => {
    const rows = mkTips(2500)
    const order = dbOrder(rows)
    const victim = order[10].id
    const { r } = await tipsLoad(rows, onCall(2, (t) => { t.tips = t.tips.filter((x) => x.id !== victim) }))
    expect(r.complete).toBe(true) // every row that existed for the whole load is present
    for (const row of order) if (row.id !== victim) expect(ids(r.rows)).toContain(String(row.id))
  })

  test('a row NOT yet received is deleted mid-load: count shortfall → incomplete, coverage "none"', async () => {
    const rows = mkTips(2500)
    const victim = dbOrder(rows)[2200].id
    const { r } = await tipsLoad(rows, onCall(2, (t) => { t.tips = t.tips.filter((x) => x.id !== victim) }))
    expect(r.complete).toBe(false)
    expect(r.reason).toBe('row_count_mismatch')
    expect(r.coverage).toEqual({ kind: 'none' })
    expect(r.rows).toHaveLength(2499) // nothing else lost
  })

  test('a NEWER row inserted after page 1 is not duplicated and nothing older is skipped', async () => {
    const rows = mkTips(2500)
    const { r } = await tipsLoad(rows, onCall(2, (t) => { t.tips = [...t.tips, { ...t.tips[0], id: 999999, date_time: '2027-01-01T00:00:00.000Z' }] }))
    expect(r.complete).toBe(true)
    expect(new Set(ids(r.rows)).size).toBe(r.rows.length)
    expect(r.rows).toHaveLength(2500)
  })

  test('an OLDER (back-dated) row inserted before the last page is read is included', async () => {
    const rows = mkTips(2500)
    const { r } = await tipsLoad(rows, onCall(3, (t) => { t.tips = [...t.tips, { ...t.tips[0], id: 888888, date_time: '2025-01-01T00:00:00.000Z' }] }))
    expect(r.complete).toBe(true)
    expect(ids(r.rows)).toContain('888888')
  })

  test('a row whose timestamp moves OLDER mid-load is seen twice → "concurrent_change", coverage "none", no duplicate kept', async () => {
    const rows = mkTips(2500)
    const mover = dbOrder(rows)[5].id
    const { r } = await tipsLoad(rows, onCall(2, (t) => { t.tips = t.tips.map((x) => (x.id === mover ? { ...x, date_time: '2025-06-01T00:00:00.000Z' } : x)) }))
    expect(r.complete).toBe(false)
    expect(r.reason).toBe('concurrent_change')
    expect(r.coverage).toEqual({ kind: 'none' })
    expect(new Set(ids(r.rows)).size).toBe(r.rows.length)
  })

  test('KNOWN LIMIT (documented, not hidden): a row moved NEWER plus a back-dated insert cancel out in the count, so "all" is reported while the moved row is missing', async () => {
    const rows = mkTips(2500)
    const mover = dbOrder(rows)[2300].id
    const { r } = await tipsLoad(rows, onCall(2, (t) => {
      t.tips = t.tips.map((x) => (x.id === mover ? { ...x, date_time: '2027-06-01T00:00:00.000Z' } : x))
      t.tips = [...t.tips, { ...t.tips[0], id: 888889, date_time: '2025-01-01T00:00:00.000Z' }]
    }))
    expect(r.coverage).toEqual({ kind: 'all' }) // traversal completed and the count check passed...
    expect(ids(r.rows)).not.toContain(String(mover)) // ...yet a row modified during the load is absent
  })

  test('a row whose timestamp moves NEWER before it is read is missed → count shortfall, coverage "none"', async () => {
    const rows = mkTips(2500)
    const mover = dbOrder(rows)[2300].id
    const { r } = await tipsLoad(rows, onCall(2, (t) => { t.tips = t.tips.map((x) => (x.id === mover ? { ...x, date_time: '2027-06-01T00:00:00.000Z' } : x)) }))
    expect(r.complete).toBe(false)
    expect(r.coverage).toEqual({ kind: 'none' })
  })
})

describe('failures and conservative coverage', () => {
  const failingFromPage = (k) => {
    let pagesServed = 0
    let failingNow = false
    return {
      fail: (c) => {
        if (c.table !== 'tips' || c.undated || !c.paged) return null
        if (failingNow) return 'error'
        if (pagesServed + 1 >= k) { failingNow = true; return 'error' }
        pagesServed++
        return null
      },
    }
  }

  test('first page fails: incomplete, nothing arrived, coverage "none"', async () => {
    const { r } = await tipsLoad(mkTips(2500), failingFromPage(1))
    expect(r.complete).toBe(false)
    expect(r.reason).toBe('page_failed')
    expect(r.rows).toHaveLength(0)
    expect(r.coverage).toEqual({ kind: 'none' })
  })

  test.each([[2, 1000], [3, 2000]])('page %i fails: coverage "since" strictly after the last row received', async (k, got) => {
    const rows = mkTips(2500)
    const { r } = await tipsLoad(rows, failingFromPage(k), { now: () => 1_800_000_000_000 })
    expect(r.complete).toBe(false)
    expect(r.rows).toHaveLength(got)
    const boundaryRow = dbOrder(rows)[got - 1]
    expect(r.coverage.kind).toBe('since')
    expect(r.coverage.oldestExclusive).toBe(microsToPgText(tsToMicros(boundaryRow.date_time)))
    expect(r.coverage.coveredFromMs).toBe(Date.parse(boundaryRow.date_time) + 1)
    expect(r.coverage.coveredToMs).toBe(1_800_000_000_000)
    // the claim holds: every table row strictly newer than the boundary was loaded
    const loaded = new Set(ids(r.rows))
    for (const row of rows) if (tsToMicros(row.date_time) > tsToMicros(boundaryRow.date_time)) expect(loaded.has(String(row.id))).toBe(true)
  })

  test('EQUAL timestamps at the failed boundary: that timestamp is NOT claimed as covered', async () => {
    // mkTips index i sits at DESC position 1499 - i. Indices 399..599 share ONE timestamp (that of index 500,
    // which keeps every other row's order), so they occupy DESC positions 900..1100 and the page-1 boundary
    // (position 999) falls inside the tied group.
    const T = new Date(Date.UTC(2026, 0, 1) + 500 * 60000).toISOString()
    const rows = mkTips(1500).map((x, i) => (i >= 399 && i <= 599 ? { ...x, date_time: T } : x))
    const { r } = await tipsLoad(rows, failingFromPage(2))
    const tMs = Date.parse(T)
    expect(r.coverage.kind).toBe('since')
    expect(tsTextToMs(r.coverage.oldestExclusive)).toBe(tMs)
    expect(r.coverage.coveredFromMs).toBeGreaterThan(tMs) // T itself is excluded
    const loaded = new Set(ids(r.rows))
    const tRows = rows.filter((x) => x.date_time === T)
    expect(tRows.some((x) => !loaded.has(String(x.id)))).toBe(true) // some rows at T really are missing
    expect(tRows.some((x) => loaded.has(String(x.id)))).toBe(true) // and some arrived: exactly why T is not claimed
  })

  test('NULL-dated rows: loaded by their own query, placed last in ascending order; their failure makes coverage "none"', async () => {
    const rows = [...mkTips(1200), { id: 777777, user_id: 'u1', platform: 'chaturbate', username: 'x', usd: 1, date_time: null }]
    const ok = await tipsLoad(rows)
    expect(ok.r.complete).toBe(true)
    expect(ok.r.rows).toHaveLength(1201)
    expect(toAscending(ok.r.rows).slice(-1)[0].id).toBe(777777)
    const bad = await tipsLoad(rows, { fail: (c) => (c.undated ? 'error' : null) })
    expect(bad.r.complete).toBe(false)
    expect(bad.r.coverage).toEqual({ kind: 'none' })
  })

  test('retries back off 500ms, 1s, 2s before giving up', async () => {
    const delays = []
    const db = fakeSupabase({ tips: mkTips(50) }, { fail: () => 'error' })
    await fetchAllRows(tipsSource(db, 'u1'), { sleep: async (ms) => { delays.push(ms) } })
    expect(delays.slice(0, 3)).toEqual(RETRY_DELAYS_MS)
  })

  test('a transient failure that succeeds on retry gives a complete load (recovery)', async () => {
    let failed = 0
    const { r } = await tipsLoad(mkTips(2500), { fail: (c) => (c.cursor && !c.undated && failed++ < 2 ? 'error' : null) })
    expect(r.complete).toBe(true)
    expect(r.rows).toHaveLength(2500)
    expect(r.retries).toBe(2)
  })

  test('a thrown network error is caught, retried and reported', async () => {
    const { r } = await tipsLoad(mkTips(1500), { fail: (c) => (c.cursor && !c.undated ? 'throw' : null) })
    expect(r.complete).toBe(false)
    expect(r.error.message).toMatch(/network down/)
  })

  test('a malformed response (no data, no error) is a failure, not an empty complete load', async () => {
    const r = await fetchAllRows({ dated: { fetchPage: async () => ({ data: null, error: null }), cursorOf: () => ({ ts: 'x', id: '1' }) } }, noSleep)
    expect(r.complete).toBe(false)
    expect(r.reason).toBe('page_failed')
    expect(r.coverage).toEqual({ kind: 'none' })
  })

  test('a count shortfall at the end of the data → "row_count_mismatch", coverage "none"', async () => {
    const all = mkTips(10)
    const db = fakeSupabase({ tips: all })
    const src = tipsSource(db, 'u1')
    const lying = { ...src, dated: { ...src.dated, fetchPage: async (c, l, o) => { const res = await src.dated.fetchPage(c, l, o); return o.wantCount ? { ...res, count: 12 } : res } } }
    const r = await fetchAllRows(lying, noSleep)
    expect(r.complete).toBe(false)
    expect(r.reason).toBe('row_count_mismatch')
    expect(r.coverage).toEqual({ kind: 'none' })
  })

  test.each([['not-a-time', '1'], ['2026-10-01 00:00:00+00', '1.5'], ['2026-10-01 00:00:00+00', '1e3'], ['2026-10-01 00:00:00+00', '12),or(id.gt.0']])(
    'an unexpected cursor value (%s / %s) stops the load as not provable: "cursor_invalid", coverage "none"', async (ts, id) => {
      const page = [{ id: 1, cursor_ts: ts, cursor_id: id }]
      const r = await fetchAllRows({ dated: { fetchPage: async () => ({ data: page, error: null, count: 1 }), cursorOf: (row) => tipsSource({ from: () => null }, 'u1').dated.cursorOf(row) } }, noSleep)
      expect(r.complete).toBe(false)
      expect(r.reason).toBe('cursor_invalid')
      expect(r.coverage).toEqual({ kind: 'none' })
    })

  test('cursor helper fields never reach the app', async () => {
    const { r } = await tipsLoad(mkTips(5))
    for (const row of r.rows) { expect(row).not.toHaveProperty('cursor_ts'); expect(row).not.toHaveProperty('cursor_id') }
  })

  test('a cursor that does not advance (same page again) stops after the second request: "concurrent_change", coverage "none"', async () => {
    const page = Array.from({ length: 1000 }, (_, i) => ({ cursor_ts: '2026-01-01 00:00:00+00', cursor_id: String(5000 - i) }))
    let calls = 0
    const r = await fetchAllRows({ dated: { fetchPage: async () => { calls++; return { data: page, error: null, count: 5000 } }, cursorOf: (row) => ({ ts: row.cursor_ts, id: row.cursor_id }) } }, noSleep)
    expect(calls).toBe(2)
    expect(r.complete).toBe(false)
    expect(r.reason).toBe('concurrent_change')
    expect(r.coverage).toEqual({ kind: 'none' })
  })

  test('a runaway loop is bounded', async () => {
    let i = 0
    const r = await fetchAllRows({ dated: { fetchPage: async () => ({ data: [{ cursor_ts: '2026-01-01 00:00:00+00', cursor_id: String(++i) }], error: null, count: 1e9 }), cursorOf: (row) => ({ ts: row.cursor_ts, id: row.cursor_id }) } }, { ...noSleep, maxPages: 5, pageSize: 1 })
    expect(r.complete).toBe(false)
    expect(r.reason).toBe('max_pages')
  })

  test('errors are summarised to code + message only: no row data can be logged', () => {
    const s = summarizeError({ code: 'PGRST', message: 'x'.repeat(500), details: { username: 'secret_fan', usd: 99 } })
    expect(Object.keys(s).sort()).toEqual(['code', 'message'])
    expect(JSON.stringify(s)).not.toContain('secret_fan')
  })
})

describe('tsTextToMs (boundary parsing never rounds up)', () => {
  test.each([
    ['2026-10-01 00:00:00+00', Date.parse('2026-10-01T00:00:00Z')],
    ['2026-10-01 00:00:00.123999+00', Date.parse('2026-10-01T00:00:00.123Z')],
    ['2026-10-01 05:30:00+05:30', Date.parse('2026-10-01T00:00:00Z')],
    ['2026-10-01T00:00:00.5Z', Date.parse('2026-10-01T00:00:00.500Z')],
    ['nonsense', null],
  ])('%s', (s, ms) => { expect(tsTextToMs(s)).toBe(ms) })
})

test('paid sessions load end to end with the same guarantees', async () => {
  const db = fakeSupabase({ paid_sessions: mkPaid(2100) })
  const r = await fetchAllRows(paidSessionsSource(db, 'u1'), noSleep)
  expect(r.complete).toBe(true)
  expect(r.rows).toHaveLength(2100)
  expect(keysetFilter({ ts: '2026-06-01 00:00:00+00', id: uuidFor(3) }, 'uuid')).toContain(`id.lt."${uuidFor(3)}"`)
})

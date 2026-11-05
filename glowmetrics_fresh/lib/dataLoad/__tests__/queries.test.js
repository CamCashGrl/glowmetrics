import { tipsSource, paidSessionsSource, toAscending, quoteValue, keysetFilter, cursorOf, idLiteral, PAGE_SELECT } from '../queries'
import { fakeSupabase, mkTips, mkPaid, uuidFor } from './fakeSupabase'

describe('cursor value formatting and escaping', () => {
  test('quoteValue wraps in double quotes and escapes backslashes and quotes', () => {
    expect(quoteValue('2026-10-01 00:00:00+00')).toBe('"2026-10-01 00:00:00+00"')
    expect(quoteValue('a"b\\c')).toBe('"a\\"b\\\\c"')
  })

  test('tips (BIGINT): the id stays unquoted digits; the timestamp is quoted', () => {
    expect(keysetFilter({ ts: '2026-10-01 00:00:00.123456+00', id: '9007199254740993' }, 'bigint'))
      .toBe('date_time.lt."2026-10-01 00:00:00.123456+00",and(date_time.eq."2026-10-01 00:00:00.123456+00",id.lt.9007199254740993)')
    expect(idLiteral('42', 'bigint')).toBe('42')
  })

  test('the unused uuid id kind would be quoted (kept only for safety; no table uses it)', () => {
    expect(keysetFilter({ ts: '2026-06-01 00:00:00+00', id: uuidFor(7) }, 'uuid'))
      .toBe(`date_time.lt."2026-06-01 00:00:00+00",and(date_time.eq."2026-06-01 00:00:00+00",id.lt."${uuidFor(7)}")`)
  })

  test.each([
    ['bigint', { cursor_ts: '2026-10-01 00:00:00+00', cursor_id: '1.5' }],
    ['bigint', { cursor_ts: '2026-10-01 00:00:00+00', cursor_id: '1e3' }],
    ['bigint', { cursor_ts: '2026-10-01 00:00:00+00', cursor_id: ' 12' }],
    ['bigint', { cursor_ts: '2026-10-01 00:00:00+00', cursor_id: '12),or(id.gt.0' }],
    ['bigint', { cursor_ts: '2026-10-01 00:00:00+00', cursor_id: 12 }], // a JS number is never trusted
    ['bigint', { cursor_ts: 'yesterday', cursor_id: '12' }],
    ['bigint', { cursor_ts: '2026-10-01', cursor_id: '12' }],
    ['bigint', { cursor_ts: '2026-10-01 00:00:00+00",or(id.gt.0', cursor_id: '12' }],
    ['uuid', { cursor_ts: '2026-10-01 00:00:00+00', cursor_id: 'not-a-uuid' }],
    ['uuid', { cursor_ts: '2026-10-01 00:00:00+00', cursor_id: '12' }],
  ])('cursorOf rejects anything the database type would not produce (%s %j)', (kind, row) => {
    expect(cursorOf(row, kind)).toBeNull()
  })

  test.each([
    ['bigint', '2026-10-01 00:00:00+00', '1'],
    ['bigint', '2026-10-01 00:00:00.123456+05:30', '-9223372036854775808'],
    ['bigint', '2026-10-01T00:00:00.000Z', '9007199254740993'],
    ['uuid', '2026-10-01 00:00:00+00', uuidFor(1)],
  ])('cursorOf accepts exact database text (%s, %s, %s)', (kind, ts, id) => {
    expect(cursorOf({ cursor_ts: ts, cursor_id: id }, kind)).toEqual({ ts, id })
  })

  test('a hostile value that somehow reached the filter stays ONE literal (it cannot add conditions)', async () => {
    const db = fakeSupabase({ tips: mkTips(5) })
    const filter = keysetFilter({ ts: 'x",or(id.gt.0', id: '1' }, 'bigint')
    const res = await db.from('tips').select('*').or(filter)
    expect(res.error).toMatchObject({ code: '22007' }) // rejected as an invalid timestamp, not executed as id > 0
    expect(res.data).toBeNull()
  })
})

describe('query shape', () => {
  test('tips: dated keyset query and NULL-dated id query, both scoped to the user', async () => {
    const db = fakeSupabase({ tips: mkTips(3) })
    const src = tipsSource(db, 'u1')
    await src.dated.fetchPage(null, 1000, { wantCount: true })
    await src.dated.fetchPage({ ts: '2026-01-01 00:00:00+00', id: '2' }, 1000, { wantCount: false })
    await src.undated.fetchPage(null, 1000, { wantCount: true })
    await src.undated.fetchPage({ ts: null, id: '9' }, 1000, { wantCount: false })
    const [d1, d2, u1, u2] = db.calls
    expect(d1).toMatchObject({ table: 'tips', orders: [['date_time', false], ['id', false]], limit: 1000, count: 'exact', logic: [], select: PAGE_SELECT })
    expect(d1.filters).toEqual([['eq', 'user_id', 'u1'], ['notnull', 'date_time']])
    expect(d2.count).toBe(null)
    expect(d2.logic).toEqual(['date_time.lt."2026-01-01 00:00:00+00",and(date_time.eq."2026-01-01 00:00:00+00",id.lt.2)'])
    expect(u1).toMatchObject({ orders: [['id', false]], limit: 1000, count: 'exact' })
    expect(u1.filters).toEqual([['eq', 'user_id', 'u1'], ['isnull', 'date_time']])
    expect(u2.filters).toContainEqual(['lt', 'id', '9'])
  })

  test('private sessions use the same shape on paid_sessions, with a BIGINT (unquoted) id like production', async () => {
    const db = fakeSupabase({ paid_sessions: mkPaid(3) })
    const src = paidSessionsSource(db, 'u1')
    expect(src.idKind).toBe('bigint')
    await src.dated.fetchPage(null, 1000, { wantCount: true })
    await src.dated.fetchPage({ ts: '2026-06-01 00:00:00+00', id: '9007199254740993' }, 1000, { wantCount: false })
    await src.undated.fetchPage({ ts: null, id: '9007199254740993' }, 1000, { wantCount: false })
    expect(db.calls[0]).toMatchObject({ table: 'paid_sessions', orders: [['date_time', false], ['id', false]], select: PAGE_SELECT })
    expect(db.calls[0].filters).toEqual([['eq', 'user_id', 'u1'], ['notnull', 'date_time']])
    expect(db.calls[1].logic).toEqual(['date_time.lt."2026-06-01 00:00:00+00",and(date_time.eq."2026-06-01 00:00:00+00",id.lt.9007199254740993)'])
    expect(db.calls[2].filters).toContainEqual(['lt', 'id', '9007199254740993'])
    expect(db.calls.every((c) => !c.error)).toBe(true)
  })

  test('paid_sessions cursor validation is BIGINT: exact digits accepted, uuid text rejected', () => {
    const src = paidSessionsSource(fakeSupabase({}), 'u1')
    expect(src.dated.cursorOf({ cursor_ts: '2026-06-01 00:00:00+00', cursor_id: '9223372036854775807' })).toEqual({ ts: '2026-06-01 00:00:00+00', id: '9223372036854775807' })
    expect(src.dated.cursorOf({ cursor_ts: '2026-06-01 00:00:00+00', cursor_id: uuidFor(1) })).toBeNull()
    expect(src.undated.cursorOf({ cursor_ts: null, cursor_id: '9007199254740993' })).toEqual({ ts: null, id: '9007199254740993' })
  })

  test('toAscending restores (date_time asc, id asc), including equal timestamps', async () => {
    const db = fakeSupabase({ tips: mkTips(40, { sameTime: true }) })
    const { data } = await tipsSource(db, 'u1').dated.fetchPage(null, 1000, { wantCount: false })
    const asc = toAscending(data)
    expect(asc.map((t) => t.id)).toEqual([...asc.map((t) => t.id)].sort((a, b) => a - b))
    expect(data[0].id > data[1].id).toBe(true) // newest-first on the wire
  })
})

import { tipsPageFetcher, paidSessionsPageFetcher, toAscending } from '../queries'
import { fakeSupabase, mkTips, mkPaid } from './fakeSupabase'

test('both tables are ordered by (date_time desc, id desc): a total, stable order with a unique tiebreaker', async () => {
  const db = fakeSupabase({ tips: mkTips(3), paid_sessions: mkPaid(3) })
  await tipsPageFetcher(db, 'u1')(0, 999, { wantCount: true })
  await paidSessionsPageFetcher(db, 'u1')(0, 999, { wantCount: false })
  expect(db.calls[0]).toMatchObject({ table: 'tips', orders: [['date_time', false], ['id', false]], range: [0, 999], count: 'exact' })
  expect(db.calls[1]).toMatchObject({ table: 'paid_sessions', orders: [['date_time', false], ['id', false]], count: null })
})

test('toAscending restores exactly (date_time asc, id asc), including equal timestamps', async () => {
  const db = fakeSupabase({ tips: mkTips(40, { sameTime: true }) })
  const { data } = await tipsPageFetcher(db, 'u1')(0, 999, { wantCount: false })
  const asc = toAscending(data)
  expect(asc.map((t) => t.id)).toEqual([...asc.map((t) => t.id)].sort())
  expect(data[0].id > data[1].id).toBe(true) // newest-first on the wire
})

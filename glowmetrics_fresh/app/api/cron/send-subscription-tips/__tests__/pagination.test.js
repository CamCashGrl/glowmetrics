/** @jest-environment node */
jest.mock('next/server', () => ({
  NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) },
}))
const mockClient = { from: jest.fn() }
jest.mock('@supabase/supabase-js', () => ({ createClient: () => mockClient }))
const { GET } = require('../route')
const UPDATE = 'product_update_2026_10_free_live_limits'
let profiles, sent, queries, failPage

beforeEach(() => {
  profiles = Array.from({ length: 1003 }, (_, i) => ({
    id: String(i + 1).padStart(5, '0'), email: `user${i + 1}@example.test`,
    subscription_status: 'free',
  }))
  sent = new Set()
  queries = []
  failPage = false
  process.env.RESEND_API_KEY = 'test-only'
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'email-test' }) })
  mockClient.from.mockImplementation((table) => {
    if (table === 'profiles') {
      let after = null
      let size
      const query = {
        select: jest.fn(() => query), not: jest.fn(() => query),
        order: jest.fn(() => query), limit: jest.fn((value) => { size = value; return query }),
        gt: jest.fn((column, value) => { after = value; return query }),
        then: (resolve, reject) => {
          queries.push({ after, size, order: query.order.mock.calls })
          return Promise.resolve(after && failPage ? { error: { message: 'page failed' } } : {
            data: profiles.filter(p => after === null || p.id > after).slice(0, size), error: null,
          }).then(resolve, reject)
        },
      }
      return query
    }
    const filters = {}
    const query = {
      select: () => query,
      eq: (column, value) => { filters[column] = value; return query },
      limit: async () => ({ data: sent.has(`${filters.email_type}|${filters.recipient}`) ? [{ id: 1 }] : [], error: null }),
      insert: async (row) => {
        if (row.status === 'sent') sent.add(`${row.email_type}|${row.recipient}`)
        return { error: null }
      },
    }
    return query
  })
})

test('reaches recipients beyond 1000, preserves retention eligibility, and never resends updates', async () => {
  for (const p of profiles.slice(0, 1002)) sent.add(`${UPDATE}|${p.email}`)
  profiles[1000].subscription_status = 'active'
  profiles[1001].subscription_status = 'trialing'
  const result = await GET()
  expect(result.body).toMatchObject({ success: true, usersChecked: 1003, updateEmailsSent: 1, retentionEmailsSent: 2 })
  expect(queries.map(q => q.after)).toEqual([null, '01000', '01003'])
  expect(queries.every(q => q.size === 1000 && q.order[0][0] === 'id' && q.order[0][1].ascending)).toBe(true)
  const messages = fetch.mock.calls.map(([, options]) => JSON.parse(options.body))
  expect(messages.map(m => m.to)).toEqual(['user1001@example.test', 'user1002@example.test', 'user1003@example.test'])
  fetch.mockClear()
  const repeat = await GET()
  expect(repeat.body.updateEmailsSent).toBe(0)
  expect(repeat.body.retentionEmailsSent).toBe(2)
})

test('a later-page failure returns failure instead of reporting complete', async () => {
  for (const p of profiles) sent.add(`${UPDATE}|${p.email}`)
  failPage = true
  expect((await GET()).status).toBe(500)
})

test('exactly 1000 profiles terminates after the empty next page', async () => {
  profiles = profiles.slice(0, 1000)
  for (const p of profiles) sent.add(`${UPDATE}|${p.email}`)
  expect((await GET()).body.usersChecked).toBe(1000)
  expect(queries.map(q => q.after)).toEqual([null, '01000'])
})

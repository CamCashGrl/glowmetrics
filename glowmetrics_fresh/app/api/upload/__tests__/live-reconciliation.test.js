/** @jest-environment node */
jest.mock('next/server', () => ({
  NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) },
}))
const mockClient = { auth: { getUser: jest.fn() }, from: jest.fn(), rpc: jest.fn() }
jest.mock('@supabase/supabase-js', () => ({ createClient: () => mockClient }))
const { POST } = require('../route')

const tip = (seq) => ({ user_id: 'creator', platform: 'Chaturbate', username: 'fanA',
  tokens: 100, usd: 5, date_time: '2026-10-18T12:00:00.000Z', tip_seq: seq, source: 'extension' })
const exactKey = (r) => [r.user_id, r.username.toLowerCase(), r.tokens, r.usd.toFixed(2),
  new Date(r.date_time).toISOString(), r.tip_seq].join('|')
const request = () => ({
  url: 'https://example.test/api/upload',
  headers: { get: () => 'Bearer test' },
  formData: async () => new Map([
    ['platform', 'Chaturbate'],
    ['file', { name: 'chaturbate.csv', text: async () =>
      'date_time,username,tokens\n2026-10-18 12:00:00,fanA,100\n2026-10-18 12:00:00,fanA,100' }],
  ]),
})

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn().mockResolvedValue({ ok: true })
  mockClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'creator' } } })
})

test.each([[1, 1], [2, 0], [0, 2]])(
  '%i existing Live tips plus 2 identical CSV tips inserts %i, and reimport inserts none',
  async (liveCount, expectedInserted) => {
    const live = Array.from({ length: liveCount }, (_, i) => tip(i + 1))
    const stored = new Set(live.map(exactKey))
    const batches = []
    mockClient.from.mockImplementation((table) => {
      if (table === 'csv_uploads') return { insert: async () => ({ error: null }) }
      const query = {}
      for (const name of ['select', 'eq', 'gte', 'lte', 'order']) query[name] = () => query
      query.range = async () => ({ data: live, error: null })
      return query
    })
    mockClient.rpc.mockImplementation(async (name, params) => {
      if (name !== 'insert_tips_dedup') return { data: null, error: null }
      batches.push(params.tips)
      let inserted = 0
      for (const row of params.tips) {
        const key = exactKey(row)
        if (!stored.has(key)) { stored.add(key); inserted++ }
      }
      return { data: { inserted, skipped: params.tips.length - inserted }, error: null }
    })
    const first = await POST(request())
    expect(first.status).toBe(200)
    expect(first.body.inserted).toBe(expectedInserted)
    expect(first.body.crossSourceSkipped).toBe(liveCount)
    expect(stored.size).toBe(2)
    if (liveCount === 1) expect(batches[0][0].tip_seq).toBe(2)
    const second = await POST(request())
    expect(second.status).toBe(200)
    expect(second.body.inserted).toBe(0)
    expect(stored.size).toBe(2)
  }
)

function adversarialStore(live, { failBatch = -1 } = {}) {
  const stored = new Set(live.map(exactKey))
  let batch = 0
  mockClient.from.mockImplementation(table => {
    if (table === 'csv_uploads') return { insert: async () => ({ error: null }) }
    const query = {}
    for (const method of ['select', 'eq', 'gte', 'lte', 'order']) query[method] = () => query
    query.range = async (from, to) => ({ data: live.slice(from, to + 1), error: null })
    return query
  })
  mockClient.rpc.mockImplementation(async (name, params) => {
    if (name !== 'insert_tips_dedup') return { data: null, error: null }
    if (batch++ === failBatch) return { data: null, error: { message: 'temporary batch failure' } }
    let inserted = 0
    for (const row of params.tips) {
      const key = exactKey(row)
      if (!stored.has(key)) { stored.add(key); inserted++ }
    }
    return { data: { inserted, skipped: params.tips.length - inserted }, error: null }
  })
  return stored
}
function csvRequest(lines) {
  const file = { name: 'chaturbate.csv', text: async () => ['date_time,username,tokens', ...lines].join('\n') }
  return { ...request(), formData: async () => new Map([['platform', 'Chaturbate'], ['file', file]]) }
}
test('one exact matching tip is skipped, including fan/platform case variants', async () => {
  const live = { ...tip(1), platform: 'CHATURBATE', username: 'FANA' }
  const stored = adversarialStore([live])
  const response = await POST(csvRequest(['2026-10-18 12:00:00,fanA,100']))
  expect(response.body.inserted).toBe(0)
  expect(response.body.crossSourceSkipped).toBe(1)
  expect(stored.size).toBe(1)
})
test('seconds within the same minute must match the represented occurrence, not discard another real tip', async () => {
  const live = { ...tip(1), date_time: '2026-10-18T12:00:30.000Z' }
  const stored = adversarialStore([live])
  const response = await POST(csvRequest(['2026-10-18 12:00:00,fanA,100', '2026-10-18 12:00:30,fanA,100']))
  expect(response.body.inserted).toBe(1)
  expect(stored.size).toBe(2)
})
test('equal tips across a minute boundary are distinct occurrences', async () => {
  const live = { ...tip(1), date_time: '2026-10-18T12:00:59.000Z' }
  const stored = adversarialStore([live])
  const response = await POST(csvRequest(['2026-10-18 12:00:59,fanA,100', '2026-10-18 12:01:00,fanA,100']))
  expect(response.body.inserted).toBe(1)
  expect(stored.size).toBe(2)
})
test('overlapping CSV files and exact reimports preserve maximum identical occurrence count', async () => {
  const stored = adversarialStore([])
  const line = '2026-10-18 12:00:00,fanA,100'
  expect((await POST(csvRequest([line]))).body.inserted).toBe(1)
  expect((await POST(csvRequest([line, line]))).body.inserted).toBe(1)
  expect((await POST(csvRequest([line, line]))).body.inserted).toBe(0)
  expect(stored.size).toBe(2)
})
test('a partial batch failure can be retried without losing or duplicating repeated tips', async () => {
  const stored = adversarialStore([], { failBatch: 1 })
  const lines = Array(501).fill('2026-10-18 12:00:00,fanA,100')
  const first = await POST(csvRequest(lines))
  expect(first.body.inserted).toBe(251)
  expect(first.body.warnings).toHaveLength(1)
  expect((await POST(csvRequest(lines))).body.inserted).toBe(250)
  expect(stored.size).toBe(501)
})

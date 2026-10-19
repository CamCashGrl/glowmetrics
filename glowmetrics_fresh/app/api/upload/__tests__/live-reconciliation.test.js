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

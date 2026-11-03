/**
 * @jest-environment node
 */
// `replace=true` used to delete every tip the creator had before importing.
// It must now be rejected before ANY write (parse log, delete, insert, RPC),
// while ordinary uploads keep working.
jest.mock('next/server', () => ({
  NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, json: async () => body }) },
}))

let calls
function mockSupabase() {
  const eqResult = { then: (resolve) => resolve({ error: null }), maybeSingle: async () => ({ data: { timezone: 'UTC' }, error: null }) }
  const chain = {
    insert: jest.fn(async () => { calls.push('insert'); return { error: null } }),
    delete: jest.fn(() => { calls.push('delete'); return chain }),
    select: jest.fn(() => chain),
    eq: jest.fn(() => eqResult),
  }
  return {
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'creator-1' } }, error: null })) },
    from: jest.fn((t) => { calls.push(`from:${t}`); return chain }),
    rpc: jest.fn(async (name, params) => {
      calls.push(`rpc:${name}`)
      if (name === 'insert_tips_dedup') return { data: { inserted: params.tips.length, skipped: 0 }, error: null }
      return { data: null, error: null }
    }),
  }
}
jest.mock('@supabase/supabase-js', () => ({ createClient: () => mockSupabase() }))

const { POST: upload } = require('../route')

const CSV = ['date_time,username,tokens', '2025-05-19 21:04,fanA,900', '2025-07-18 05:43,fanB,50'].join('\n')
function req(extra = {}) {
  const fd = new Map([['file', { name: 'chaturbate.csv', text: async () => CSV }], ['platform', 'Chaturbate'], ['time_zone', 'UTC']])
  for (const [k, v] of Object.entries(extra)) fd.set(k, v)
  return {
    headers: { get: (h) => (h.toLowerCase() === 'authorization' ? 'Bearer t' : null) },
    formData: async () => ({ get: (k) => (fd.has(k) ? fd.get(k) : null) }),
  }
}
const writes = () => calls.filter((c) => c === 'delete' || c === 'insert' || c.startsWith('rpc:'))

beforeEach(() => { calls = [] })

describe('/api/upload replace flag', () => {
  test.each(['true', 'TRUE', '1', 'yes'])('replace=%s is rejected before any write', async (v) => {
    const res = await upload(req({ replace: v }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('replace_not_supported')
    expect(writes()).toEqual([])
    expect(calls).not.toContain('from:tips')
  })

  test('no replace field: ordinary import inserts and never deletes', async () => {
    const res = await upload(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.inserted).toBe(2)
    expect(calls).toContain('rpc:insert_tips_dedup')
    expect(calls).not.toContain('delete')
  })

  test('replace=false stays compatible', async () => {
    const res = await upload(req({ replace: 'false' }))
    expect(res.status).toBe(200)
    expect(calls).not.toContain('delete')
  })
})

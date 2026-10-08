/**
 * @jest-environment node
 *
 * Primary platform is set once and never changed; only platform fields are written.
 */
jest.mock('next/server', () => ({ NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, json: async () => body }) } }))

let state
function mockClient() {
  const q = { filters: [] }
  const c = {
    select: jest.fn(() => c),
    eq: jest.fn((k, v) => { q.filters.push(['eq', k, v]); return c }),
    is: jest.fn((k, v) => { q.filters.push(['is', k, v]); return c }),
    update: jest.fn((v) => { q.update = v; state.updates.push(q); return c }),
    maybeSingle: jest.fn(async () => {
      if (q.update) {
        if (state.row.primary_pro_platform) return { data: null, error: null } // .is(null) matched nothing
        state.row = { ...state.row, ...q.update }
        return { data: state.row, error: null }
      }
      return { data: state.row, error: null }
    }),
  }
  return c
}
beforeEach(() => {
  state = { user: { id: 'u1' }, row: { primary_pro_platform: null, streaming_platforms: ['bongacams'] }, updates: [] }
  jest.resetModules()
  jest.doMock('../../../../lib/liveSession/auth', () => ({
    getLiveSessionCaller: async () => ({ user: state.user, supabase: { from: () => mockClient() } }),
  }))
})
const req = (body) => ({ json: async () => body, headers: new Map() })

test('sets primary once, keeps it first in streaming_platforms, writes only platform fields', async () => {
  const { POST } = await import('../primary-platform/route.js')
  const res = await POST(req({ platform: 'Chaturbate' }))
  expect(res.status).toBe(200)
  expect(state.row.primary_pro_platform).toBe('chaturbate')
  expect(state.row.streaming_platforms).toEqual(['chaturbate', 'bongacams'])
  expect(Object.keys(state.updates[0].update).sort()).toEqual(['primary_pro_platform', 'streaming_platforms'])
  expect(state.updates[0].filters).toContainEqual(['is', 'primary_pro_platform', null])
})

test('cannot be changed once set (409)', async () => {
  state.row.primary_pro_platform = 'bongacams'
  const { POST } = await import('../primary-platform/route.js')
  const res = await POST(req({ platform: 'chaturbate' }))
  expect(res.status).toBe(409)
  expect(state.row.primary_pro_platform).toBe('bongacams')
  expect(state.updates).toHaveLength(0)
})

test('rejects unsupported platforms and anonymous callers', async () => {
  const { POST } = await import('../primary-platform/route.js')
  expect((await POST(req({ platform: 'stripchat' }))).status).toBe(400)
  expect((await POST(req({ platform: 'chaturbate', plan: 'pro' }))).status).toBe(200)
  expect(state.row.plan).toBeUndefined() // extra fields are ignored, never written
  state.user = null
  expect((await POST(req({ platform: 'chaturbate' }))).status).toBe(401)
})

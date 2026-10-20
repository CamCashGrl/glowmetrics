/**
 * @jest-environment node
 *
 * The legacy primary_pro_platform column now means the one selected Free/trial
 * analytics platform. It is selected once, stays on a rolling 31-day window,
 * and never grants full historical access.
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
        if (state.row.primary_pro_platform) return { data: null, error: null }
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
    getLiveSessionCaller: async () => ({ user: state.user, supabase: { from: () => { throw new Error('caller client must not write') } } }),
  }))
  jest.doMock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => mockClient() }) }))
})

const req = (body) => ({ json: async () => body, headers: new Map() })

test('selects the Free analytics platform once and never grants full history', async () => {
  const { POST } = await import('../primary-platform/route.js')
  const res = await POST(req({ platform: 'Chaturbate' }))
  const body = await res.json()

  expect(res.status).toBe(200)
  expect(state.row.primary_pro_platform).toBe('chaturbate')
  expect(state.row.streaming_platforms).toEqual(['chaturbate', 'bongacams'])
  expect(body.analytics_window_days).toBe(31)
  expect(body.full_history_unlocked).toBe(false)
  expect(Object.keys(state.updates[0].update).sort()).toEqual(['primary_pro_platform', 'streaming_platforms'])
  expect(state.updates[0].filters).toContainEqual(['is', 'primary_pro_platform', null])
  expect(state.updates[0].filters).toContainEqual(['eq', 'id', 'u1'])
})

test('cannot rotate the selected Free analytics platform to reveal another platform (409)', async () => {
  state.row.primary_pro_platform = 'bongacams'
  const { POST } = await import('../primary-platform/route.js')
  const res = await POST(req({ platform: 'chaturbate' }))
  const body = await res.json()

  expect(res.status).toBe(409)
  expect(state.row.primary_pro_platform).toBe('bongacams')
  expect(body.primary_pro_platform).toBe('bongacams')
  expect(body.error).toMatch(/Free analytics platform/i)
  expect(state.updates).toHaveLength(0)
})

test('rejects unsupported platforms and ignores attempts to write billing/plan fields', async () => {
  const { POST } = await import('../primary-platform/route.js')
  expect((await POST(req({ platform: 'stripchat' }))).status).toBe(400)
  expect((await POST(req({ platform: 'chaturbate', plan: 'pro', subscription_status: 'active' }))).status).toBe(200)
  expect(state.row.plan).toBeUndefined()
  expect(state.row.subscription_status).toBeUndefined()
})

test('anonymous callers cannot select an analytics platform', async () => {
  state.user = null
  const { POST } = await import('../primary-platform/route.js')
  expect((await POST(req({ platform: 'chaturbate' }))).status).toBe(401)
})

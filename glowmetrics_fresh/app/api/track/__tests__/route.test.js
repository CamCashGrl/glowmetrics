/**
 * Regression: from 2026-09-18 every website funnel event (lib/track.js →
 * /api/track) was silently dropped. The route read `eventName` while
 * lib/track.js sends `event_name`, and wrote a `page_url` column that
 * analytics_events does not have, so any event carrying a URL failed.
 */
const ANALYTICS_EVENTS_COLUMNS = ['user_id', 'event_name', 'properties', 'session_id', 'url']

const inserts = []
let insertError = null
let mockUser = null
jest.mock('../../../../lib/supabase-server', () => ({
  createSupabaseRouteClient: () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
    from: (table) => ({ insert: async (row) => { inserts.push({ table, row }); return { error: insertError } } }),
  }),
}))
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }))

global.Response = { json: (body, init) => ({ body, status: init?.status || 200 }) }
const { POST } = require('../route')
const req = (body) => ({ json: async () => body })

beforeEach(() => { inserts.length = 0; insertError = null; mockUser = null })

test('lib/track.js payload is stored under its real event name with only real columns', async () => {
  const res = await POST(req({
    event_name: 'signup_started',
    properties: { source_page: '/' },
    session_id: 'sid-1',
    url: 'https://www.camcashgrl.com/',
  }))
  expect(res.body.success).toBe(true)
  expect(inserts).toHaveLength(1)
  const { table, row } = inserts[0]
  expect(table).toBe('analytics_events')
  expect(row.event_name).toBe('signup_started')
  expect(row.url).toBe('https://www.camcashgrl.com/')
  expect(row.session_id).toBe('sid-1')
  expect(row.user_id).toBeNull()
  for (const k of Object.keys(row)) expect(ANALYTICS_EVENTS_COLUMNS).toContain(k)
})

test('signed-in events carry the verified user id, never one from the body', async () => {
  mockUser = { id: 'user-a' }
  await POST(req({ event_name: 'login_success', properties: { user_id: 'someone-else' } }))
  expect(inserts[0].row.user_id).toBe('user-a')
})

test('camelCase eventName (analytics-client legacy) still works', async () => {
  await POST(req({ eventName: 'pricing_page_viewed', eventCategory: 'nav', referrer: 'x' }))
  expect(inserts[0].row.event_name).toBe('pricing_page_viewed')
  expect(inserts[0].row.properties).toEqual({ event_category: 'nav', referrer: 'x' })
})

test('a failed insert is reported, not hidden behind success:true', async () => {
  insertError = { message: 'column "page_url" does not exist' }
  const res = await POST(req({ event_name: 'signup_started', url: 'u' }))
  expect(res.body.success).toBe(false)
  expect(res.status).toBe(200) // tracking must never break the page
})

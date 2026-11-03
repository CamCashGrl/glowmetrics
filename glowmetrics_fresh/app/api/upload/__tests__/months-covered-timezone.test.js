/**
 * @jest-environment node
 */
// csv_uploads.months_covered (the audit row written for every import) lists the
// calendar months the file covers on the IMPORT timezone — the creator's
// calendar — not UTC.
jest.mock('next/server', () => ({
  NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, json: async () => body }) },
}))

// The route calls the global crypto.randomUUID() for the audit row's upload_ref.
// Node 18's jest sandbox does not expose a global `crypto` (Node 20+ does), which
// made the audit insert silently skip in CI. Provide it so the test runs the
// same way on every Node version.
if (!globalThis.crypto || !globalThis.crypto.randomUUID) globalThis.crypto = require('crypto').webcrypto

let inserts // { table, row }[]
let mockSavedTz
function mockSupabase() {
  const eqResult = { then: (resolve) => resolve({ error: null }), maybeSingle: async () => ({ data: { timezone: mockSavedTz }, error: null }) }
  const makeChain = (table) => {
    const chain = {
      insert: jest.fn(async (row) => { inserts.push({ table, row }); return { error: null } }),
      delete: jest.fn(() => chain), select: jest.fn(() => chain), eq: jest.fn(() => eqResult),
    }
    return chain
  }
  return {
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'creator-1' } }, error: null })) },
    from: jest.fn((table) => makeChain(table)),
    rpc: jest.fn(async (name, params) => (name === 'insert_tips_dedup' ? { data: { inserted: params.tips.length, skipped: 0 }, error: null } : { data: null, error: null })),
  }
}
jest.mock('@supabase/supabase-js', () => ({ createClient: () => mockSupabase() }))
const { POST: upload } = require('../route')

function req(text, { timeZone, platform = 'Chaturbate' } = {}) {
  const fd = new Map([['file', { name: 'tips.csv', text: async () => text }], ['platform', platform]])
  if (timeZone !== undefined) fd.set('time_zone', timeZone)
  return {
    headers: { get: (h) => (h.toLowerCase() === 'authorization' ? 'Bearer t' : null) },
    formData: async () => ({ get: (k) => fd.get(k) ?? null }),
  }
}
const csv = (...rows) => ['date_time,username,tokens', ...rows].join('\n')
const monthsCovered = () => inserts.find(i => i.table === 'csv_uploads').row.months_covered

beforeEach(() => { inserts = []; mockSavedTz = null })

test('Los Angeles: tips at local Oct 31 23:30 and Nov 1 08:00 cover October and November', async () => {
  const res = await upload(req(csv('2026-10-31 23:30,fanA,100', '2026-10-31 23:50,fanB,100', '2026-11-01 08:00,fanC,100'), { timeZone: 'America/Los_Angeles' }))
  expect(res.status).toBe(200)
  expect(monthsCovered()).toEqual(['2026-10', '2026-11'])
})

test('a late-evening local tip stays in its local month even though its stored UTC instant is in the next month', async () => {
  // Oct 31 23:30 PDT is stored as 2026-11-01T06:30Z, but the creator's month is October.
  await upload(req(csv('2026-10-31 23:30,fanA,100', '2026-10-31 23:40,fanB,100'), { timeZone: 'America/Los_Angeles' }))
  expect(monthsCovered()).toEqual(['2026-10'])
})

test('Kolkata (+5:30): local Nov 1 02:00 is Oct 31 in UTC but November on the creator calendar', async () => {
  await upload(req(csv('2026-11-01 02:00,fanA,100', '2026-11-01 02:10,fanB,100'), { timeZone: 'Asia/Kolkata' }))
  expect(monthsCovered()).toEqual(['2026-11'])
})

test('the saved profile timezone is used when it exists', async () => {
  mockSavedTz = 'America/Los_Angeles'
  await upload(req(csv('2026-10-31 23:30,fanA,100', '2026-10-31 23:40,fanB,100')))
  expect(monthsCovered()).toEqual(['2026-10'])
})

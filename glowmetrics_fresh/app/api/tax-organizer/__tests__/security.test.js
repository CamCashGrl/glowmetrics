import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the shared server-data layer so these tests exercise route behavior
// (auth gating, filename generation, CSV/JSON shape) without a live Supabase
// connection. authenticateRequest/fetchEarningsRows are the ONLY places a
// route touches Supabase, so mocking them here is equivalent to controlling
// what "the database" returns.
vi.mock('../../../../lib/taxOrganizer/serverData', async () => {
  const actual = await vi.importActual('../../../../lib/taxOrganizer/serverData')
  return {
    ...actual,
    authenticateRequest: vi.fn(),
    fetchEarningsRows: vi.fn(),
    getAvailableYearRange: vi.fn(),
  }
})

import { authenticateRequest, fetchEarningsRows, getAvailableYearRange } from '../../../../lib/taxOrganizer/serverData'
import { GET as summaryGET } from '../summary/route'
import { GET as recordsGET } from '../records/route'
import { GET as csvGET } from '../export-csv/route'

const USER_A = { id: 'user-a-uuid' }
const USER_B = { id: 'user-b-uuid' }

const USER_A_TIPS = [
  { id: 1, date_time: '2026-03-01T12:00:00Z', platform: 'Chaturbate', username: 'fanA', tip_type: 'Tip', tokens: 100, usd: '5.00', upload_id: null, tip_ref: null, session_id: null, tip_note: '' },
]
const USER_B_TIPS = [
  { id: 2, date_time: '2026-03-02T12:00:00Z', platform: 'BongaCams', username: 'fanB', tip_type: 'Tip', tokens: 40, usd: '1.00', upload_id: null, tip_ref: null, session_id: null, tip_note: '' },
]

function mockRequest(url, headers = { Authorization: 'Bearer test-token' }) {
  return new Request(url, { headers })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('security — authentication required', () => {
  it('summary route returns 401 with no Authorization header', async () => {
    authenticateRequest.mockResolvedValue({ errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) })
    const res = await summaryGET(mockRequest('http://x/api/tax-organizer/summary', {}))
    expect(res.status).toBe(401)
  })

  it('records route returns 401 with no Authorization header', async () => {
    authenticateRequest.mockResolvedValue({ errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) })
    const res = await recordsGET(mockRequest('http://x/api/tax-organizer/records', {}))
    expect(res.status).toBe(401)
  })

  it('export-csv route returns 401 with no Authorization header', async () => {
    authenticateRequest.mockResolvedValue({ errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) })
    const res = await csvGET(mockRequest('http://x/api/tax-organizer/export-csv', {}))
    expect(res.status).toBe(401)
  })
})

describe('security — cross-user isolation', () => {
  it('a request authenticated as User A can never receive User B rows, even if the URL claims to be User B', async () => {
    // The route has no user_id/userId query param at all — but simulate an
    // attacker trying anyway, and prove fetchEarningsRows is still called
    // with the SERVER-DERIVED user (User A), never anything from the URL.
    authenticateRequest.mockResolvedValue({ supabase: {}, user: USER_A })
    fetchEarningsRows.mockResolvedValue({ tipsRows: USER_A_TIPS, paidSessionRows: [], tooLarge: false })
    getAvailableYearRange.mockResolvedValue({ hasData: true, years: [2026] })

    const req = mockRequest('http://x/api/tax-organizer/summary?year=2026&user_id=user-b-uuid&userId=user-b-uuid')
    await summaryGET(req)

    expect(fetchEarningsRows).toHaveBeenCalledWith(expect.anything(), USER_A.id, expect.anything())
    expect(fetchEarningsRows).not.toHaveBeenCalledWith(expect.anything(), USER_B.id, expect.anything())
  })

  it('export-csv for User A never contains User B token/USD amounts', async () => {
    // The CSV spec deliberately has no username column (only the on-screen
    // table shows usernames) — so the distinguishing signal here is the
    // token/USD amounts, which are unique per user's mocked row.
    authenticateRequest.mockResolvedValue({ supabase: {}, user: USER_A })
    fetchEarningsRows.mockResolvedValue({ tipsRows: USER_A_TIPS, paidSessionRows: [], tooLarge: false })

    const res = await csvGET(mockRequest('http://x/api/tax-organizer/export-csv?year=2026'))
    const text = await res.text()

    expect(text).toContain('100') // User A's token amount
    expect(text).not.toContain('40') // User B's token amount must never appear
    expect(fetchEarningsRows).toHaveBeenCalledWith(expect.anything(), USER_A.id, expect.anything())
    expect(fetchEarningsRows).not.toHaveBeenCalledWith(expect.anything(), USER_B.id, expect.anything())
  })
})

describe('export-csv — filename generation', () => {
  it('uses the calendar-year filename for a full-year range', async () => {
    authenticateRequest.mockResolvedValue({ supabase: {}, user: USER_A })
    fetchEarningsRows.mockResolvedValue({ tipsRows: USER_A_TIPS, paidSessionRows: [], tooLarge: false })
    const res = await csvGET(mockRequest('http://x/api/tax-organizer/export-csv?year=2026'))
    expect(res.headers.get('Content-Disposition')).toContain('camcashgrl-earnings-2026.csv')
  })

  it('uses the date-range filename for a custom range', async () => {
    authenticateRequest.mockResolvedValue({ supabase: {}, user: USER_A })
    fetchEarningsRows.mockResolvedValue({ tipsRows: USER_A_TIPS, paidSessionRows: [], tooLarge: false })
    const res = await csvGET(mockRequest('http://x/api/tax-organizer/export-csv?startDate=2026-01-01&endDate=2026-06-30'))
    expect(res.headers.get('Content-Disposition')).toContain('camcashgrl-earnings-2026-01-01-to-2026-06-30.csv')
  })
})

describe('export-csv — formula injection protection end-to-end', () => {
  it('escapes a malicious note field but leaves USD amounts as real numbers', async () => {
    authenticateRequest.mockResolvedValue({ supabase: {}, user: USER_A })
    fetchEarningsRows.mockResolvedValue({
      tipsRows: [{ ...USER_A_TIPS[0], tip_note: '=HYPERLINK("http://evil.example")' }],
      paidSessionRows: [],
      tooLarge: false,
    })
    const res = await csvGET(mockRequest('http://x/api/tax-organizer/export-csv?year=2026'))
    const text = await res.text()
    expect(text).toContain(`'=HYPERLINK`)
    expect(text).toContain('5') // USD amount present as a plain number
  })
})

describe('export-csv — unavailable fields are blank, not zero', () => {
  it('leaves fee/payout/refund columns empty', async () => {
    authenticateRequest.mockResolvedValue({ supabase: {}, user: USER_A })
    fetchEarningsRows.mockResolvedValue({ tipsRows: USER_A_TIPS, paidSessionRows: [], tooLarge: false })
    const res = await csvGET(mockRequest('http://x/api/tax-organizer/export-csv?year=2026'))
    const text = await res.text()
    const lines = text.trim().split('\r\n')
    const dataLine = lines[1].split(',')
    // Header order: ... Platform fee, Processing fee, Refund or adjustment, Confirmed payout ...
    const headerIdx = lines[0].split(',')
    const feeIdx = headerIdx.indexOf('Platform fee')
    expect(dataLine[feeIdx]).toBe('')
  })
})

describe('export-csv — fails safely when the dataset is too large', () => {
  it('returns a 413 with a useful message instead of generating a huge file', async () => {
    authenticateRequest.mockResolvedValue({ supabase: {}, user: USER_A })
    fetchEarningsRows.mockResolvedValue({ tipsRows: [], paidSessionRows: [], tooLarge: true })
    const res = await csvGET(mockRequest('http://x/api/tax-organizer/export-csv?year=2026'))
    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.error).toMatch(/narrow/i)
  })
})

describe('records route — pagination', () => {
  it('never returns more than pageSize records regardless of total', async () => {
    authenticateRequest.mockResolvedValue({ supabase: {}, user: USER_A })
    const manyRows = Array.from({ length: 500 }, (_, i) => ({ ...USER_A_TIPS[0], id: i }))
    fetchEarningsRows.mockResolvedValue({ tipsRows: manyRows, paidSessionRows: [], tooLarge: false })
    const res = await recordsGET(mockRequest('http://x/api/tax-organizer/records?year=2026&pageSize=25'))
    const body = await res.json()
    expect(body.records.length).toBe(25)
    expect(body.pagination.totalRecords).toBe(500)
    expect(body.pagination.totalPages).toBe(20)
  })
})

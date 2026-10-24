import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'

HTMLCanvasElement.prototype.getContext = () => ({
  clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {},
  moveTo: () => {}, lineTo: () => {}, stroke: () => {}, closePath: () => {},
  save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {}, set fillStyle(v) {}, set strokeStyle(v) {},
  set globalAlpha(v) {}, set lineWidth(v) {},
})

const upserts = []
let mockProfile = { plan: 'free', streaming_platforms: null, primary_pro_platform: null }
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'test@example.com', created_at: '2026-01-01' } } }),
      getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
    },
    from: jest.fn((table) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        limit: async () => ({ data: [], error: null }),
        insert: async () => ({ data: null, error: null }),
        single: async () => {
          if (table === 'beta_users') return { data: { onboarding_complete: false } }
          if (table === 'profiles') return { data: mockProfile }
          return { data: null }
        },
        upsert: async (row) => { upserts.push({ table, row }); return { data: null, error: null } },
        update: (row) => ({ eq: () => ({ select: () => ({ maybeSingle: async () => { upserts.push({ table, row }); return { data: { id: 'u1' }, error: null } } }) }) }),
      }
      return chain
    }),
  },
}))
jest.mock('../../../lib/track', () => ({ track: jest.fn() }))
jest.mock('../../../lib/parseTracking', () => ({ logParseAttempt: jest.fn(), analyzeFormat: jest.fn(() => ({})) }))
jest.mock('../../../lib/analytics-client', () => ({ trackCheckoutEvent: jest.fn() }))
const mockRouter = { push: jest.fn(), replace: jest.fn() }
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }))



import OnboardingPage, { buildPreview } from '../page.js'
import { track } from '../../../lib/track'
import { controlPaste } from '../../../lib/__tests__/fixtures/onboardingControl'
import { CB_RECENT_EXPORT } from '../../../lib/__tests__/fixtures/chaturbateRecentExport'

// ── Step 2 (Import) state machine + private-earnings correctness ───────────
// Private earnings (Chaturbate private shows, BongaCams paid chats,
// MyFreeCams privates) must be detected, shown separately (never as regular
// tips), included in total earnings, and actually persisted.

const CB = 'Jun 18, 2026, 8:27 PM\nTip From: fanA\n500  12345\nJun 19, 2026, 9:14 PM\nPrivate Show: fanB\n120  12465\nJun 20, 2026, 9:14 PM\nFan Club Membership: fanC\n100  12565'
const BC = '18.06.2026 14:32\tfanA\t500\t25.00\n19.06.2026 15:14\tfanB\tPrivate Chat\t120\t6.00'
const MFC = '1746555770\tJun 18th, 2026 10:40 PM\t500\tfanA\tTip\n1746555771\tJun 19th, 2026 11:02 PM\t300\tfanB\tPrivate'

let calls
beforeEach(() => {
  upserts.length = 0
  track.mockClear()
  calls = []
  global.fetch = jest.fn(async (url, init) => {
    const body = init?.body
    const entry = { url, platform: body?.get?.('platform'), file: body?.get?.('file'), tz: body?.get?.('time_zone') }
    calls.push(entry)
    const json = url === '/api/upload-paid-sessions' ? { ok: true, inserted: 1, skipped: 0 } : { ok: true, inserted: 1, skipped: 0, paidSessionsInserted: 1 }
    return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) }
  })
})

async function toImport(name) {
  render(<OnboardingPage />)
  fireEvent.click(await screen.findByText(name))
  fireEvent.click(await screen.findByRole('button', { name: `Continue with ${name} →` }))
  return await screen.findByPlaceholderText(`Paste your ${name} tip history here…`)
}
const readFile = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsText(f) })
const paste = (el, text) => { fireEvent.paste(el); fireEvent.change(el, { target: { value: text } }) }

describe('Step 2 states', () => {
  test('EMPTY: short headline, CTA disabled, help collapsed, CSV secondary, no old instruction wall', async () => {
    await toImport('Chaturbate')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Paste your Chaturbate tip history')
    expect(screen.getByText('Copy your earnings rows from Chaturbate and paste them below.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue →' })).toBeDisabled()
    expect(screen.queryByTestId('paste-help')).not.toBeInTheDocument()
    expect(screen.queryByTestId('detected-summary')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '← Back' })).not.toBeInTheDocument()
    expect(screen.queryByText(/HOW TO COPY FROM/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Step 2 of 3/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Open earnings page/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Upload CSV instead/ })).toBeInTheDocument()
    expect(screen.getByText('Import')).toHaveAttribute('aria-current', 'step')
  })

  test('DETECTED: control data shows real count, range and total; paste stays visible, Continue enabled', async () => {
    const el = await toImport('Chaturbate')
    paste(el, controlPaste())
    expect(await screen.findByTestId('detect-parsing')).toHaveTextContent('Analyzing your history…')
    const card = await screen.findByTestId('detected-summary')
    expect(within(card).getByTestId('detected-count')).toHaveTextContent('1,091')
    // Private shows + memberships are present, so they are never called "tips".
    expect(card).toHaveTextContent('transactions detected!')
    expect(within(card).getByTestId('detected-platform')).toHaveTextContent('Chaturbate')
    expect(within(card).getByTestId('detected-total')).toHaveTextContent('$369.40')
    expect(screen.getByPlaceholderText('Paste your Chaturbate tip history here…')).toHaveValue(controlPaste())
    expect(screen.getByRole('button', { name: 'Continue →' })).toBeEnabled()
  })

  test('all-tip paste is headlined as tips', async () => {
    const el = await toImport('Chaturbate')
    paste(el, 'Jun 18, 2026, 8:27 PM\nTip From: fanA\n500  12345\nJun 19, 2026, 9:14 PM\nTip From: fanB\n120  12465')
    const card = await screen.findByTestId('detected-summary')
    expect(within(card).getByTestId('detected-count')).toHaveTextContent('2')
    expect(card).toHaveTextContent('tips detected!')
    expect(within(card).getByTestId('detected-range')).toHaveTextContent('Jun 18 – Jun 19, 2026')
  })

  test('Edit data focuses the paste with it preserved; clearing it resets to empty', async () => {
    const el = await toImport('Chaturbate')
    paste(el, CB)
    await screen.findByTestId('detected-summary')
    fireEvent.click(screen.getByRole('button', { name: 'Edit data' }))
    expect(el).toHaveFocus()
    expect(el).toHaveValue(CB)
    fireEvent.change(el, { target: { value: '' } })
    await waitFor(() => expect(screen.queryByTestId('detected-summary')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Continue →' })).toBeDisabled()
  })

  test('INVALID: inline error, paste preserved, CSV fallback and help reachable, CTA disabled', async () => {
    const el = await toImport('Chaturbate')
    paste(el, 'hello this is not a tip export')
    const err = await screen.findByTestId('detect-invalid')
    expect(err).toHaveTextContent('We couldn’t detect a valid Chaturbate earnings history.')
    expect(within(err).getByRole('button', { name: /Upload CSV instead/ })).toBeInTheDocument()
    expect(el).toHaveValue('hello this is not a tip export')
    expect(screen.getByRole('button', { name: 'Continue →' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Need help copying your history?' }))
    expect(screen.getByTestId('paste-help')).toBeInTheDocument()
  })

  test('help: no saved username → generic instructions, no mislabeled earnings link', async () => {
    await toImport('Chaturbate')
    fireEvent.click(screen.getByRole('button', { name: 'Need help copying your history?' }))
    const help = screen.getByTestId('paste-help')
    expect(help).toHaveTextContent('Token Stats')
    expect(help.querySelector('a')).toBeNull()
  })
})

describe('private earnings are detected, kept out of tips, and persisted', () => {
  test.each([
    ['chaturbate', 'Chaturbate', CB, { tips: 1, priv: 1, mem: 1 }],
    ['bongacams', 'BongaCams', BC, { tips: 1, priv: 1, mem: 0 }],
    ['myfreecams', 'MyFreeCams', MFC, { tips: 1, priv: 1, mem: 0 }],
  ])('%s preview classifies private earnings separately', (id, label, text, want) => {
    const p = buildPreview(text, id, label, 'UTC')
    expect(p.tipsDetected).toBe(want.tips)
    expect(p.privateDetected).toBe(want.priv)
    expect(p.membershipsDetected).toBe(want.mem)
    const c = p.snapshot.full.categories
    expect(p.estimatedEarnings).toBeCloseTo(c.tips.usd + c.private.usd + c.memberships.usd, 2)
    expect(p.paidEarnings).toBe(c.private.usd)
    expect(c.private.usd).toBeGreaterThan(0)
  })

  test('MyFreeCams paste keeps the real dates and usernames', () => {
    const p = buildPreview(MFC, 'myfreecams', 'MyFreeCams', 'UTC')
    expect(p.dateRange).toBe('Jun 18, 2026 – Jun 19, 2026')
    expect(p.rows[0].username.toLowerCase()).toBe('fana')
    expect(p.rows[0].tokens).toBe(500)
  })

  test.each([['Chaturbate', CB, 'Private Show'], ['MyFreeCams', MFC, 'Private']])('%s: raw paste goes to /api/upload (which stores privates) with the creator timezone', async (name, text, marker) => {
    const el = await toImport(name)
    paste(el, text)
    await screen.findByTestId('detected-summary')
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
    await waitFor(() => expect(calls.some(c => c.url === '/api/upload')).toBe(true))
    const up = calls.find(c => c.url === '/api/upload')
    expect(up.platform).toBe(name)
    expect(up.tz).toBeTruthy()
    expect(await readFile(up.file)).toContain(marker)
    expect(calls.some(c => c.url === '/api/upload-paid-sessions')).toBe(false)
  }, 20000)

  test('BongaCams: paid chats are uploaded to the paid-sessions route', async () => {
    const el = await toImport('BongaCams')
    paste(el, BC)
    await screen.findByTestId('detected-summary')
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
    await waitFor(() => expect(calls.some(c => c.url === '/api/upload-paid-sessions')).toBe(true))
    const paid = calls.find(c => c.url === '/api/upload-paid-sessions')
    expect(paid.platform).toBe('BongaCams')
    expect(await readFile(paid.file)).toContain('Private Chat')
  }, 20000)

  test('a partial private-earnings save failure is shown and can be retried (never silent success)', async () => {
    global.fetch = jest.fn(async () => {
      const json = { ok: false, inserted: 1, skipped: 0, paidSessionsWarnings: ['batch failed'] }
      return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) }
    })
    const el = await toImport('Chaturbate')
    paste(el, CB)
    await screen.findByTestId('detected-summary')
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
    // Step 3 stops at "Saving your earnings & fans" with the error + Retry.
    const err = await screen.findByTestId('proc-error', {}, { timeout: 10000 })
    expect(err).toHaveTextContent(/could not be saved/i)
    expect(err).toHaveTextContent('Your pasted data is kept.')
    expect(screen.getByTestId('proc-step-2')).toHaveAttribute('data-state', 'error')
    expect(screen.getByTestId('proc-step-3')).toHaveAttribute('data-state', 'pending')
    expect(screen.queryByText(/Your Chaturbate data is ready/)).not.toBeInTheDocument()
    // Retry re-saves the same import; once it saves, analysis finishes.
    global.fetch = jest.fn(async () => {
      const json = { ok: true, inserted: 3, skipped: 0 }
      return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) }
    })
    fireEvent.click(within(err).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText(/Your Chaturbate data is ready/, {}, { timeout: 10000 })).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  }, 20000)

  test('first insights show private earnings and memberships separately from regular tips', async () => {
    const el = await toImport('Chaturbate')
    paste(el, controlPaste())
    await screen.findByTestId('detected-summary', {}, { timeout: 5000 })
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
    await screen.findByText(/Your Chaturbate data is ready/, {}, { timeout: 10000 })
    expect(screen.getByTestId('stat-earnings')).toHaveTextContent('$369.40')
    expect(screen.getByTestId('stat-tips')).toHaveTextContent('994')
    // Step 4 keeps private earnings and memberships as secondary text inside
    // Total earnings (no separate large cards); they are never counted as tips.
    expect(screen.getByTestId('stat-earnings')).toHaveTextContent('$42.85 private')
    expect(screen.getByTestId('stat-earnings')).toHaveTextContent('$10.00 memberships')
    expect(screen.getByTestId('stat-tips')).not.toHaveTextContent('$42.85')
  }, 20000)
})

// ── Step 2 summary card: real recent Chaturbate export (regression) ────────
// The export's times are the creator's own wall-clock times. The card's date
// range must be first → last EARNING event on that clock; it used to read the
// times as UTC, so for a Pacific creator "Oct 9, 2026, 5:33 AM" showed as Oct 8.
describe('Step 2 summary: real recent Chaturbate export', () => {
  const LA = 'America/Los_Angeles'
  const lines = CB_RECENT_EXPORT.split('\n')

  test('count and earnings are unchanged: 176 earning rows, 1,171 tokens, $58.55', () => {
    const p = buildPreview(CB_RECENT_EXPORT, 'chaturbate', 'Chaturbate', LA)
    expect(p.transactionsDetected).toBe(176)
    expect(p.tipsDetected).toBe(175)
    expect(p.membershipsDetected).toBe(1)
    expect(p.privateDetected).toBe(0)
    const c = p.snapshot.full.categories
    expect(c.tips.tokens + c.memberships.tokens).toBe(1171)
    expect(p.estimatedEarnings).toBe(58.55)
  })

  test('date range is first → last earning event: Sep 18 – Oct 9, 2026, 22 calendar days', () => {
    const p = buildPreview(CB_RECENT_EXPORT, 'chaturbate', 'Chaturbate', LA)
    expect(p.startDate).toBe('2026-09-18')
    expect(p.endDate).toBe('2026-10-09')
    expect(p.dateFrom).toBe('Sep 18, 2026')
    expect(p.dateTo).toBe('Oct 9, 2026')
    // Inclusive calendar dates (Sep 18 … Oct 9), not elapsed days (21).
    expect(p.calendarDays).toBe(22)
  })

  test('Oct 9 earnings are counted and dated Oct 9', () => {
    const p = buildPreview(CB_RECENT_EXPORT, 'chaturbate', 'Chaturbate', LA)
    const oct9 = p.rows.filter(r => String(r.date_time).startsWith('2026-10-09'))
    expect(oct9.map(r => r.tokens)).toEqual([11, 2, 1, 1, 1])
  })

  test.each(['UTC', 'America/Los_Angeles', 'America/New_York', 'Asia/Tokyo', 'Pacific/Auckland'])(
    'the creator timezone (%s) never moves the export\'s own calendar dates', (tz) => {
      const p = buildPreview(CB_RECENT_EXPORT, 'chaturbate', 'Chaturbate', tz)
      expect([p.startDate, p.endDate, p.calendarDays]).toEqual(['2026-09-18', '2026-10-09', 22])
    })

  test('transfers, outbound tips and admin deductions never set the range or count as income', () => {
    const text = [
      lines[0],
      'Oct 12, 2026, 9:00 AM\t', 'Transfer tokens to $5.00 cash.', '-100\t0',
      ...lines.slice(1),
      'Sep 11, 2026, 1:00 PM\t', 'Outbound Tip: fan99', 'thank you', '-1\t3',
      'Sep 10, 2026, 1:00 PM\t', 'Admin Adjustment: Deduction: Please email support for more information.', '-8\t0',
    ].join('\n')
    const p = buildPreview(text, 'chaturbate', 'Chaturbate', LA)
    expect([p.startDate, p.endDate]).toEqual(['2026-09-18', '2026-10-09'])
    expect(p.transactionsDetected).toBe(176)
    expect(p.estimatedEarnings).toBe(58.55)
  })

  test('the detection card renders Sep 18 – Oct 9, 2026 for a Pacific creator', async () => {
    const saved = mockProfile
    mockProfile = { ...mockProfile, timezone: LA }
    try {
      const el = await toImport('Chaturbate')
      paste(el, CB_RECENT_EXPORT)
      const card = await screen.findByTestId('detected-summary')
      expect(within(card).getByTestId('detected-count')).toHaveTextContent('176')
      expect(within(card).getByTestId('detected-total')).toHaveTextContent('$58.55')
      const range = within(card).getByTestId('detected-range')
      expect(range).toHaveTextContent('Sep 18 – Oct 9, 2026')
      expect(range).not.toHaveTextContent('Oct 8')
      expect(range).toHaveTextContent('22 calendar days')
    } finally {
      mockProfile = saved
    }
  })
})

// ── Larger historical export shapes: parser must not crash ─────────────────
// Synthetic rows in the shapes a long Chaturbate history contains. Only rows
// the parser already recognizes as earnings may set the date range. (Spy Show
// is not a recognized earning row today; this only checks it is never counted
// as a regular tip.)
describe('Step 2 summary: mixed historical Chaturbate rows', () => {
  const text = [
    'Date\tAction\tTokens\tToken Balance',
    'Oct 3, 2026, 8:00 AM\t', 'Transfer tokens to $10.00 cash.', '-200\t0',
    'Oct 2, 2026, 11:45 PM\t', 'Private Show: fanP', '120\t200',
    'Oct 2, 2026, 11:10 PM\t', 'Spy Show: fanS', '30\t80',
    'Oct 2, 2026, 10:00 PM\t', 'Snapchat Sale: fanQ', '40\t50',
    'Oct 2, 2026, 9:30 PM\t', 'Fan Club Membership: fanM', '10\t10',
    'Oct 1, 2026, 9:00 PM\t', 'Outbound Tip: fanO', 'thank you', '-1\t0',
    'Oct 1, 2026, 8:00 PM\t', 'Admin Adjustment: Deduction: Please email support for more information.', '-5\t1',
    'Oct 1, 2026, 7:00 PM\t', 'Promoted room for 10 minutes', '-50\t6',
    'Sep 30, 2026, 6:15 AM\t', 'Tip From: fanT', 'hi', '6\t56',
    'Sep 29, 2026, 4:00 PM\t', 'Transfer tokens to $2.50 cash.', '-50\t50',
  ].join('\n')

  test('does not crash; earning rows set the range; private shows are not tips', () => {
    const p = buildPreview(text, 'chaturbate', 'Chaturbate', 'America/Los_Angeles')
    expect(p).not.toBeNull()
    expect(p.privateDetected).toBe(1)
    expect(p.membershipsDetected).toBe(1)
    expect(p.tipsDetected).toBe(1)
    // A late-night private show is the last earning event and stays on Oct 2.
    expect([p.startDate, p.endDate, p.calendarDays]).toEqual(['2026-09-30', '2026-10-02', 3])
    expect(p.rows.some(r => r.username === 'fanS')).toBe(false)
    expect(p.rows.every(r => r.tokens > 0)).toBe(true)
  })
})

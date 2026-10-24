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
jest.mock('../../../lib/onboardingSummary', () => {
  const actual = jest.requireActual('../../../lib/onboardingSummary')
  return { ...actual, streamPatterns: jest.fn(actual.streamPatterns), bestStreamingTimes: jest.fn(actual.bestStreamingTimes) }
})
jest.mock('../../../lib/analytics', () => {
  const actual = jest.requireActual('../../../lib/analytics')
  return { ...actual, parseCSV: jest.fn(actual.parseCSV) }
})



import OnboardingPage, { buildPreview } from '../page.js'
import { track } from '../../../lib/track'
import { streamPatterns, bestStreamingTimes } from '../../../lib/onboardingSummary'
import { parseCSV, aggregateRows } from '../../../lib/analytics'
import { detectSessions, isValidSession } from '../../../lib/analytics/sessions'

// ── Step 3 · Processing ────────────────────────────────────────────────────
// Every row advances only when its real work finishes (parse → save →
// canonical sessions → canonical best times), revealed ≥0.3s apart. Analysis
// runs on the creator-local canonical dataset Step 4 consumes.

const CB = 'Jun 18, 2026, 8:27 PM\nTip From: fanA\n500  12345\nJun 18, 2026, 9:14 PM\nTip From: fanB\n120  12465'
const okUpload = () => { const json = { ok: true, inserted: 2, skipped: 0 }; return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) } }

async function toImport(name) {
  render(<OnboardingPage />)
  fireEvent.click(await screen.findByText(name))
  fireEvent.click(await screen.findByRole('button', { name: `Continue with ${name} →` }))
  return await screen.findByPlaceholderText(`Paste your ${name} tip history here…`)
}
const paste = (el, text) => { fireEvent.paste(el); fireEvent.change(el, { target: { value: text } }) }
const state = (n) => screen.getByTestId(`proc-step-${n}`).getAttribute('data-state')

beforeEach(() => {
  upserts.length = 0; track.mockClear(); streamPatterns.mockClear(); bestStreamingTimes.mockClear(); parseCSV.mockClear()
  mockProfile = { plan: 'free', streaming_platforms: null, primary_pro_platform: null }
})
async function toProcessing(fetchImpl) {
  global.fetch = jest.fn(fetchImpl || (async () => okUpload()))
  const el = await toImport('Chaturbate')
  paste(el, CB)
  await screen.findByTestId('detected-summary', {}, { timeout: 5000 })
  fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
  await screen.findByTestId('processing-steps')
  return el
}
const uploads = () => global.fetch.mock.calls.filter(([url]) => url === '/api/upload').length

describe('Step 3 processing screen', () => {
  test('stepper, copy and the four analysis rows; advances only on real completion', async () => {
    // Only the import save is held open; every other request answers at once.
    let resolveSave
    global.fetch = jest.fn((url) => url === '/api/upload' ? new Promise(r => { resolveSave = () => r(okUpload()) }) : Promise.resolve(okUpload()))
    const el = await toImport('Chaturbate')
    paste(el, CB)
    await screen.findByTestId('detected-summary', {}, { timeout: 5000 })
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Analyzing your data…' })).toBeInTheDocument()
    expect(screen.getByText('This only takes a moment. We’re building your first insights.')).toBeInTheDocument()
    expect(screen.getByText('Insights')).toHaveAttribute('aria-current', 'step')
    // Platform and Import show completed checks; Insights shows the active 3.
    const stepper = document.querySelector('.ob-stepper')
    expect(within(stepper).getAllByText('✓')).toHaveLength(2)
    expect(within(stepper).getByText('3')).toBeInTheDocument()
    const rows = within(screen.getByTestId('processing-steps')).getAllByRole('listitem').map(li => li.textContent)
    expect(rows.map(t => t.replace(/(Complete|In progress|Waiting|Not saved)$/, ''))).toEqual([
      'Reading your tip history', 'Saving your earnings & fans', 'Calculating your stream patterns', 'Detecting your best streaming times',
    ])

    // Parse done → row 1 complete; the save is still pending, so row 2 stays in
    // progress and rows 3–4 wait — no timer moves them.
    await waitFor(() => expect(state(1)).toBe('done'))
    expect(state(2)).toBe('active')
    expect(screen.getByTestId('proc-step-2')).toHaveTextContent('In progress')
    expect([state(3), state(4)]).toEqual(['pending', 'pending'])
    await new Promise(r => setTimeout(r, 1500))
    expect([state(2), state(3), state(4)]).toEqual(['active', 'pending', 'pending'])
    expect(screen.queryByText(/Your Chaturbate data is ready/)).not.toBeInTheDocument()

    // The save finishes → rows 2–4 complete in order → Step 4.
    resolveSave()
    await waitFor(() => expect(state(4)).toBe('done'), { timeout: 5000 })
    expect([state(1), state(2), state(3)]).toEqual(['done', 'done', 'done'])
    // Exactly one icon + one status per row after every state change.
    for (const n of [1, 2, 3, 4]) expect(screen.getByTestId(`proc-step-${n}`).children).toHaveLength(3)
    expect(screen.getByTestId('proc-step-1')).toHaveTextContent('Reading your tip history2 transactions')
    expect(screen.getByTestId('proc-step-2')).toHaveTextContent('Saving your earnings & fansSaved')
    expect(screen.getByTestId('proc-step-3')).toHaveTextContent('Calculating your stream patternsComplete')
    expect(screen.getByTestId('proc-step-4')).toHaveTextContent('Detecting your best streaming timesComplete')
    expect(await screen.findByText(/Your Chaturbate data is ready/, {}, { timeout: 5000 })).toBeInTheDocument()
    expect(global.fetch.mock.calls.filter(([url]) => url === '/api/upload')).toHaveLength(1)
  }, 20000)

  test('rows are revealed at least 0.3s apart', async () => {
    global.fetch = jest.fn(async () => okUpload())
    const el = await toImport('Chaturbate')
    paste(el, CB)
    await screen.findByTestId('detected-summary', {}, { timeout: 5000 })
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
    await screen.findByTestId('processing-steps')
    const doneAt = {}
    const start = Date.now()
    await waitFor(() => {
      for (const n of [1, 2, 3, 4]) if (!doneAt[n] && state(n) === 'done') doneAt[n] = Date.now() - start
      expect(Object.keys(doneAt)).toHaveLength(4)
    }, { timeout: 5000, interval: 20 })
    for (const n of [2, 3, 4]) expect(doneAt[n] - doneAt[n - 1]).toBeGreaterThanOrEqual(250)
  }, 20000)
})

describe('Step 3 analysis uses the creator-local canonical dataset', () => {
  test.each([
    ['chaturbate', 'Chaturbate', 'Jun 18, 2026, 8:27 PM\nTip From: fanA\n500  12345', 'America/Los_Angeles', '2026-06-19T03:27:00.000Z'],
    ['myfreecams', 'MyFreeCams', '1746555770\tJun 18th, 2026 10:40 PM\t500\tfanA\tTip', 'America/Los_Angeles', '2026-06-19T05:40:00.000Z'],
    ['bongacams', 'BongaCams', '18.06.2026 14:32\tfanA\t500\t25.00', 'Asia/Tokyo', '2026-06-18T05:32:00.000Z'],
  ])('%s (%s): naive export times are read in the selected zone, never UTC or the device zone', (id, label, text, tz, iso) => {
    const p = buildPreview(text, id, label, tz)
    expect(p.dataset.timeZone).toBe(tz)
    expect(p.dataset.tips[0].date_time).toBe(iso)
  })

  test.each(['America/Los_Angeles', 'America/New_York', 'Asia/Tokyo'])(
    'canonical best time keeps the export\'s local hour (10 PM) for a %s creator', (tz) => {
      const days = ['Oct 1', 'Oct 2', 'Oct 3', 'Oct 4']
      const text = days.flatMap((d, i) => [
        `${d}, 2026, 10:10 PM`, `Tip From: fan${i}`, '20  100',
        `${d}, 2026, 10:50 PM`, `Tip From: fan${i}`, '30  130',
      ]).join('\n')
      const p = buildPreview(text, 'chaturbate', 'Chaturbate', tz)
      const best = bestStreamingTimes(p.dataset).canonicalBestTimes
      expect(String(best.bestWindow?.localHour ?? best.earlySignal?.localHour)).toBe('22')
      const patterns = streamPatterns(p.dataset)
      expect(patterns.sessionCount).toBe(4)
      expect(patterns.validSessionCount).toBe(4) // 40 min, 2 tips each
    })
})

describe('Step 3 failures: error + Retry on the failed row, imported data kept', () => {
  test('parse failure (row 1): error + Retry; Retry re-reads the same paste and finishes', async () => {
    global.fetch = jest.fn(async () => okUpload())
    const el = await toImport('Chaturbate')
    paste(el, CB)
    await screen.findByTestId('detected-summary', {}, { timeout: 5000 })
    parseCSV.mockImplementationOnce(() => { throw new Error('boom') })
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
    const err = await screen.findByTestId('proc-error')
    expect(err).toHaveTextContent('We couldn’t read this history. Your pasted data is kept.')
    expect(state(1)).toBe('error')
    expect(screen.getByTestId('proc-step-1')).toHaveTextContent('Failed')
    expect(screen.getByTestId('proc-step-1').children).toHaveLength(3)
    expect(uploads()).toBe(0)
    fireEvent.click(within(err).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText(/Your Chaturbate data is ready/, {}, { timeout: 5000 })).toBeInTheDocument()
    expect(uploads()).toBe(1)
  }, 20000)

  test.each([
    [3, () => streamPatterns, 'We couldn’t calculate your stream patterns.'],
    [4, () => bestStreamingTimes, 'We couldn’t detect your best streaming times.'],
  ])('row %i failure: error + Retry resumes from that row without saving again', async (row, fn, message) => {
    fn().mockImplementationOnce(() => { throw new Error('boom') })
    await toProcessing()
    const err = await screen.findByTestId('proc-error', {}, { timeout: 5000 })
    expect(err).toHaveTextContent(`${message} Your earnings are saved.`)
    expect(state(row)).toBe('error')
    expect(screen.getByTestId(`proc-step-${row}`)).toHaveTextContent('Failed')
    for (let n = 1; n < row; n++) expect(state(n)).toBe('done')
    expect(uploads()).toBe(1)
    fireEvent.click(within(err).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText(/Your Chaturbate data is ready/, {}, { timeout: 5000 })).toBeInTheDocument()
    expect(uploads()).toBe(1) // the save is never repeated
  }, 20000)

  test('Back from an error returns to Step 2 with the paste intact', async () => {
    streamPatterns.mockImplementationOnce(() => { throw new Error('boom') })
    await toProcessing()
    const err = await screen.findByTestId('proc-error', {}, { timeout: 5000 })
    fireEvent.click(within(err).getByRole('button', { name: 'Back' }))
    expect(await screen.findByPlaceholderText('Paste your Chaturbate tip history here…')).toHaveValue(CB)
  }, 20000)
})

describe('Step 3 timing and canonical analysis', () => {
  test('finished checklist is held ~0.5–0.8s, then Step 4', async () => {
    await toProcessing()
    await waitFor(() => expect(state(4)).toBe('done'), { timeout: 5000, interval: 10 })
    const doneAt = Date.now()
    await screen.findByText(/Your Chaturbate data is ready/, {}, { timeout: 5000, interval: 10 })
    const held = Date.now() - doneAt
    expect(held).toBeGreaterThanOrEqual(450)
    expect(held).toBeLessThan(1200)
  }, 20000)

  test('sessions and best times run on the creator-selected zone (not the device zone)', async () => {
    mockProfile = { ...mockProfile, timezone: 'Asia/Tokyo' }
    await toProcessing()
    await screen.findByText(/Your Chaturbate data is ready/, {}, { timeout: 5000 })
    expect(streamPatterns).toHaveBeenCalledTimes(1)
    expect(bestStreamingTimes).toHaveBeenCalledTimes(1)
    const dataset = bestStreamingTimes.mock.calls[0][0]
    expect(dataset.timeZone).toBe('Asia/Tokyo')
    expect(streamPatterns.mock.calls[0][0]).toBe(dataset)
    // 'Jun 18, 2026, 8:27 PM' read on a Tokyo clock.
    expect(dataset.tips[0].date_time).toBe('2026-06-18T11:27:00.000Z')
  }, 20000)

  test('results are exactly the dashboard engine’s on the same rows', () => {
    const text = ['Oct 1', 'Oct 2', 'Oct 3'].flatMap((d, i) => [`${d}, 2026, 9:05 PM`, `Tip From: fan${i}`, '20  100', `${d}, 2026, 9:55 PM`, `Tip From: fan${i}`, '30  130']).join('\n')
    const { dataset } = buildPreview(text, 'chaturbate', 'Chaturbate', 'America/Los_Angeles')
    const engine = aggregateRows(dataset.tips, 'America/Los_Angeles')
    expect(bestStreamingTimes(dataset).canonicalBestTimes).toEqual(engine.canonicalBestTimes)
    expect(bestStreamingTimes(dataset).estimatedHourlyRate).toBe(engine.estimatedHourlyRate)
    const sessions = detectSessions(dataset.tips)
    expect(streamPatterns(dataset)).toEqual({
      sessionCount: sessions.length,
      validSessionCount: sessions.filter(isValidSession).length,
      validStreamedMinutes: sessions.filter(isValidSession).reduce((n, s) => n + s.durationMinutes, 0),
    })
  })
})

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

HTMLCanvasElement.prototype.getContext = () => ({
  clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, moveTo: () => {}, lineTo: () => {},
  stroke: () => {}, closePath: () => {}, save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {},
  set fillStyle(v) {}, set strokeStyle(v) {}, set globalAlpha(v) {}, set lineWidth(v) {},
})

// Subscription state and extension tips are read from the database, so the mock
// returns whatever each test sets. Nothing here invents trial state.
let mockProfile
let mockExtensionRows
const upserts = []
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
        limit: async () => ({ data: table === 'tips' ? mockExtensionRows : [], error: null }),
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

import OnboardingPage from '../page.js'
import { controlPaste } from '../../../lib/__tests__/fixtures/onboardingControl'

const FREE = { plan: 'free', streaming_platforms: null, primary_pro_platform: null, trial_ends_at: null, subscription_status: null }
const future = new Date(Date.now() + 5 * 86400000).toISOString()
const past = new Date(Date.now() - 30 * 86400000).toISOString()

let checkoutCalls
beforeEach(() => {
  upserts.length = 0
  mockProfile = FREE
  mockExtensionRows = []
  checkoutCalls = 0
  global.fetch = jest.fn(async (url) => {
    if (url === '/api/stripe/checkout') { checkoutCalls++; return new Promise(() => {}) } // never resolves: keeps the button busy
    const json = { ok: true, inserted: 2, skipped: 0 }
    return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) }
  })
})

// Reach Step 5 through the real flow: paste → Step 3 → Step 4 → Continue →.
async function toStep5() {
  render(<OnboardingPage />)
  fireEvent.click(await screen.findByText('Chaturbate', {}, { timeout: 10000 }))
  fireEvent.click(await screen.findByRole('button', { name: 'Continue with Chaturbate →' }, { timeout: 10000 }))
  const el = await screen.findByPlaceholderText('Paste your Chaturbate tip history here…', {}, { timeout: 10000 })
  fireEvent.paste(el); fireEvent.change(el, { target: { value: controlPaste() } })
  await screen.findByTestId('detected-summary', {}, { timeout: 5000 })
  fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
  await screen.findByTestId('step4-insights', {}, { timeout: 10000 })
  fireEvent.click(screen.getByRole('button', { name: 'Continue to Options →' }))
  return await screen.findByTestId('step5-trial', {}, { timeout: 5000 })
}

describe('Step 5 · trial state comes from existing subscription data', () => {
  test('eligible: shows the 7-day trial with the current price, and does NOT start it on open', async () => {
    await toStep5()
    expect(screen.getByRole('button', { name: 'Start my 7-day Pro trial →' })).toBeEnabled()
    expect(screen.getByText('$9.99/month • Cancel anytime', { exact: false })).toBeInTheDocument()
    expect(checkoutCalls).toBe(0)
  }, 30000)

  test('the trial starts only on click, and a second click while busy does nothing', async () => {
    await toStep5()
    const btn = screen.getByRole('button', { name: 'Start my 7-day Pro trial →' })
    fireEvent.click(btn)
    fireEvent.click(screen.getByRole('button', { name: /Start my 7-day Pro trial|Starting|Upgrade/ }).closest('button') || btn)
    await waitFor(() => expect(checkoutCalls).toBe(1))
    expect(checkoutCalls).toBe(1)
  }, 30000)

  test('already Pro: no trial offer, shows the Pro state', async () => {
    mockProfile = { ...FREE, plan: 'pro' }
    await toStep5()
    expect(screen.getByTestId('trial-pro')).toHaveTextContent('You’re on CamCash Pro')
    expect(screen.queryByRole('button', { name: /Start my 7-day Pro trial/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId('free-column')).not.toBeInTheDocument()
  }, 30000)

  test('already trialing: shows the active trial with its end date, not another trial', async () => {
    mockProfile = { ...FREE, trial_ends_at: future, subscription_status: 'trialing' }
    await toStep5()
    expect(screen.getByTestId('trial-card')).toHaveTextContent('Your Pro trial is active')
    expect(screen.queryByRole('button', { name: /Start my 7-day Pro trial/ })).not.toBeInTheDocument()
  }, 30000)

  test('trial already used: offers the upgrade, not a new free trial', async () => {
    mockProfile = { ...FREE, trial_ends_at: past, subscription_status: 'canceled' }
    await toStep5()
    expect(screen.getByRole('button', { name: 'Upgrade to Pro →' })).toBeEnabled()
    expect(screen.queryByText(/days free/)).not.toBeInTheDocument()
  }, 30000)

  test('Continue with Free is clearly visible and does not start a trial', async () => {
    await toStep5()
    const free = screen.getByRole('button', { name: 'Continue with Free' })
    expect(free).toBeVisible()
    fireEvent.click(free)
    // Existing Free path: the 'ready to use Free' screen, then the dashboard.
    expect(await screen.findByText(/You're ready to use CamCash Free/, {}, { timeout: 5000 })).toBeInTheDocument()
    expect(checkoutCalls).toBe(0)
  }, 30000)

  test('Free column lists only the limits the product enforces', async () => {
    await toStep5()
    const col = screen.getByTestId('free-column')
    expect(col).toHaveTextContent('1 platform with full history')
    expect(col).toHaveTextContent('Other platforms: 31-day view')
    expect(col).toHaveTextContent('Top 3 fans visible')
    expect(col).toHaveTextContent('Live Mode included')
  }, 30000)
})

describe('Step 5 · extension state', () => {
  test('not installed: download link + manual steps, no Edge or store claims', async () => {
    await toStep5()
    const link = screen.getByRole('link', { name: /Download CamCash Extension/ })
    expect(link).toHaveAttribute('href', '/camcash-extension.zip')
    expect(screen.getByText('Load unpacked', { exact: false })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Edge|Chrome Web Store|one-click/i)
  }, 30000)

  test('installed (extension tips exist): shows connected, not the install CTA', async () => {
    mockExtensionRows = [{ id: 1 }]
    await toStep5()
    expect(await screen.findByTestId('ext-connected')).toHaveTextContent('Extension connected')
    expect(screen.queryByRole('link', { name: /Download CamCash Extension/ })).not.toBeInTheDocument()
  }, 30000)

  test('skipping the extension does not block the trial or Free choice', async () => {
    await toStep5()
    expect(screen.getByRole('button', { name: 'Start my 7-day Pro trial →' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Continue with Free' })).toBeEnabled()
  }, 30000)
})

describe('Step 5 · tracking and Stripe trial wiring', () => {
  test('download click is tracked with the existing extension event', async () => {
    const { track } = require('../../../lib/track')
    await toStep5()
    fireEvent.click(screen.getByRole('link', { name: /Download CamCash Extension/ }))
    expect(track).toHaveBeenCalledWith('extension_download_clicked', { source_page: 'onboarding' })
  }, 30000)

  test('trial click posts to the Stripe checkout route with the standard monthly plan', async () => {
    await toStep5()
    fireEvent.click(screen.getByRole('button', { name: 'Start my 7-day Pro trial →' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/stripe/checkout', expect.objectContaining({ method: 'POST' })))
    const body = JSON.parse(global.fetch.mock.calls.find(([u]) => u === '/api/stripe/checkout')[1].body)
    expect(body).toEqual({ plan_type: 'standard_monthly' })
  }, 30000)
})

/**
 * Onboarding activation order: primary import → first insight → trial offer
 * → dashboard. Onboarding connects only the selected primary platform —
 * secondary platforms (even ones already saved) are added later inside
 * CamCash, never offered as an onboarding step or link. beta_users
 * .onboarding_complete is written only on the Trial/Free choice.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
import { track } from '../../../lib/track'

const CB_HEADER = '"Timestamp","Token change","Token balance","Transaction type","User","Note"'
const row = (ts, n, u) => `"${ts}",${n},0,"Tip received","${u}",""`
const PASTE = [CB_HEADER, row('2026-02-12 06:05:59.000000', 5, 'fanA'), row('2026-02-01 10:23:58.000000', 20, 'fanB')].join('\n')

const completionWrites = () => upserts.filter(u => u.table === 'beta_users' && u.row.onboarding_complete === true)

beforeEach(() => {
  upserts.length = 0
  mockProfile = { plan: 'free', streaming_platforms: null, primary_pro_platform: null }
  track.mockClear()
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ inserted: 2, skipped: 0 }), text: async () => JSON.stringify({ inserted: 2, skipped: 0 }) })
})

// The username screen was removed from onboarding: Step 1 goes straight to Import.
const expectNoUsernameStep = () => {
  expect(screen.queryByPlaceholderText('your_username')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Continue to Tip Import/ })).not.toBeInTheDocument()
}

async function importPrimary() {
  render(<OnboardingPage />)
  fireEvent.click(await screen.findByText('Chaturbate'))
  fireEvent.click(await screen.findByRole('button', { name: 'Continue with Chaturbate →' }))
  expectNoUsernameStep()
  fireEvent.change(await screen.findByPlaceholderText(/Paste|paste/), { target: { value: PASTE } })
  await screen.findByTestId('detected-summary')
  fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
  await screen.findByText(/Your Chaturbate data is ready/, {}, { timeout: 10000 })
}

const noSecondaryOffered = () => {
  expect(screen.queryByRole('button', { name: /Continue to (BongaCams|MyFreeCams)/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Connect (BongaCams|MyFreeCams)/ })).not.toBeInTheDocument()
}

test('primary success goes to the trial with no secondary-platform step; completion not yet written', async () => {
  await importPrimary()
  noSecondaryOffered()
  expect(screen.getByText('Import')).toHaveAttribute('aria-current', 'step')
  expect(completionWrites()).toHaveLength(0)
  expect(track).toHaveBeenCalledWith('onboarding_first_insight_viewed', expect.objectContaining({ primary_platform: 'chaturbate' }))

  fireEvent.click(screen.getByRole('button', { name: /^Continue →$/ }))
  expect(await screen.findByText('Your first insight is just the beginning.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Start my 7-day Pro trial/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Continue with Free/ })).toBeInTheDocument()
  expect(screen.queryByText(/Whales/)).not.toBeInTheDocument()
  expect(completionWrites()).toHaveLength(0)
}, 20000)

test('choosing Free marks onboarding complete and goes to the dashboard without a secondary step', async () => {
  await importPrimary()
  fireEvent.click(screen.getByRole('button', { name: /^Continue →$/ }))
  fireEvent.click(await screen.findByRole('button', { name: /Continue with Free/ }))
  expect(await screen.findByText(/You're ready to use CamCash Free/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Enter CamCash/ })).toBeInTheDocument()
  noSecondaryOffered()
  await waitFor(() => expect(completionWrites()).toHaveLength(1))
  expect(track).toHaveBeenCalledWith('onboarding_free_selected', expect.any(Object))
}, 20000)

test('starting the trial marks onboarding complete before the Stripe redirect', async () => {
  await importPrimary()
  fireEvent.click(screen.getByRole('button', { name: /^Continue →$/ }))
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ error: 'stub' }), text: async () => JSON.stringify({ error: 'stub' }) })
  window.alert = jest.fn()
  fireEvent.click(await screen.findByRole('button', { name: /Start my 7-day Pro trial/ }))
  await waitFor(() => expect(completionWrites()).toHaveLength(1))
  expect(track).toHaveBeenCalledWith('onboarding_trial_started', expect.any(Object))
}, 20000)

test('a returning user with saved secondaries still only imports the primary in onboarding', async () => {
  mockProfile = { plan: 'free', streaming_platforms: ['BongaCams', 'Chaturbate'], primary_pro_platform: null }
  render(<OnboardingPage />)
  await waitFor(() => expect(screen.getByRole('radio', { name: /BongaCams/ })).toHaveAttribute('aria-checked', 'true'))
  fireEvent.click(screen.getByText('Chaturbate'))
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Chaturbate →' }))
  expectNoUsernameStep()
  fireEvent.change(await screen.findByPlaceholderText(/Paste|paste/), { target: { value: PASTE } })
  await screen.findByTestId('detected-summary')
  fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
  await screen.findByText(/Your Chaturbate data is ready/, {}, { timeout: 10000 })
  noSecondaryOffered()
  // Saved secondary is preserved in the profile, just not walked through now.
  const saved = upserts.filter(u => u.table === 'profiles' && u.row.streaming_platforms).map(u => u.row.streaming_platforms)
  expect(saved).toEqual([['chaturbate', 'bongacams']])
}, 20000)

test('Step 1 Continue goes directly to Import with platform + timezone preserved, no username needed', async () => {
  render(<OnboardingPage />)
  fireEvent.click(await screen.findByText('Chaturbate'))
  fireEvent.click(await screen.findByRole('button', { name: 'Continue with Chaturbate →' }))
  // Lands on the Chaturbate import screen immediately.
  expect(await screen.findByPlaceholderText(/Paste|paste/)).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Paste your Chaturbate tip history')
  expectNoUsernameStep()
  expect(screen.getByText('Import')).toHaveAttribute('aria-current', 'step')
  expect(screen.queryByText(/^Username$/i)).not.toBeInTheDocument()
  // Platform list + timezone were saved by Step 1; no username was ever written.
  const profileRows = upserts.filter(u => u.table === 'profiles').map(u => u.row)
  expect(profileRows[0]).toEqual(expect.objectContaining({ streaming_platforms: ['chaturbate'], timezone: expect.any(String) }))
  expect(profileRows.some(r => 'chaturbate_username' in r)).toBe(false)
  // Import completes without a username.
  fireEvent.change(screen.getByPlaceholderText(/Paste|paste/), { target: { value: PASTE } })
  await screen.findByTestId('detected-summary')
  fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
  expect(await screen.findByText(/Your Chaturbate data is ready/, {}, { timeout: 10000 })).toBeInTheDocument()
}, 20000)

test('a saved Chaturbate username is still used for the stats-page link, but never required', async () => {
  mockProfile = { plan: 'free', streaming_platforms: null, primary_pro_platform: null, chaturbate_username: 'savedname' }
  render(<OnboardingPage />)
  fireEvent.click(await screen.findByText('Chaturbate'))
  fireEvent.click(await screen.findByRole('button', { name: 'Continue with Chaturbate →' }))
  await screen.findByPlaceholderText(/Paste|paste/)
  fireEvent.click(screen.getByRole('button', { name: 'Need help copying your history?' }))
  expect(document.querySelector('a[href="https://chaturbate.com/p/savedname/?tab=tokens"]')).not.toBeNull()
  expectNoUsernameStep()
}, 20000)

test('Back from Import returns to Step 1 (no username screen in between)', async () => {
  render(<OnboardingPage />)
  fireEvent.click(await screen.findByText('Chaturbate'))
  fireEvent.click(await screen.findByRole('button', { name: 'Continue with Chaturbate →' }))
  await screen.findByPlaceholderText(/Paste|paste/)
  fireEvent.click(screen.getAllByRole('button', { name: '← Back' })[0])
  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Let’s get started')
  expect(screen.getByRole('radio', { name: /Chaturbate/ })).toHaveAttribute('aria-checked', 'true')
}, 20000)

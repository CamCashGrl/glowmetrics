/**
 * Onboarding activation order: primary import → first insight → trial offer,
 * with secondary platforms optional (never forced before the trial), and
 * beta_users.onboarding_complete written only on the Trial/Free choice.
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
          if (table === 'profiles') return { data: { plan: 'free', streaming_platforms: null, primary_pro_platform: null } }
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
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))

import OnboardingPage from '../page.js'
import { track } from '../../../lib/track'

const CB_HEADER = '"Timestamp","Token change","Token balance","Transaction type","User","Note"'
const row = (ts, n, u) => `"${ts}",${n},0,"Tip received","${u}",""`
const PASTE = [CB_HEADER, row('2026-02-12 06:05:59.000000', 5, 'fanA'), row('2026-02-01 10:23:58.000000', 20, 'fanB')].join('\n')

const completionWrites = () => upserts.filter(u => u.table === 'beta_users' && u.row.onboarding_complete === true)

beforeEach(() => {
  upserts.length = 0
  track.mockClear()
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ inserted: 2, skipped: 0 }) })
})

async function importPrimaryWithSecondarySelected() {
  render(<OnboardingPage />)
  fireEvent.click(await screen.findByText('Chaturbate'))
  fireEvent.click(await screen.findByText('BongaCams'))
  fireEvent.click(screen.getByRole('button', { name: /Continue with 2 platforms/ }))
  fireEvent.change(await screen.findByPlaceholderText('your_username'), { target: { value: 'me' } })
  fireEvent.click(screen.getByRole('button', { name: /Continue to Tip Import/ }))
  fireEvent.change(await screen.findByPlaceholderText(/Paste|paste/), { target: { value: PASTE } })
  fireEvent.click(screen.getByRole('button', { name: /Import & build dashboard/ }))
  await screen.findByText(/Your Chaturbate data is ready/, {}, { timeout: 10000 })
}

test('primary success goes to the trial, not the secondary import; completion not yet written', async () => {
  await importPrimaryWithSecondarySelected()
  expect(screen.queryByRole('button', { name: /Continue to BongaCams/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Connect BongaCams later/ })).toBeInTheDocument()
  expect(completionWrites()).toHaveLength(0)
  expect(track).toHaveBeenCalledWith('onboarding_first_insight_viewed', expect.objectContaining({ primary_platform: 'chaturbate' }))

  fireEvent.click(screen.getByRole('button', { name: /^Continue →$/ }))
  expect(await screen.findByText('Your first insight is just the beginning.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Start my 7-day Pro trial/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Continue with Free/ })).toBeInTheDocument()
  expect(screen.queryByText(/Whales/)).not.toBeInTheDocument()
  expect(completionWrites()).toHaveLength(0)
}, 20000)

test('choosing Free marks onboarding complete and still offers the secondary platform', async () => {
  await importPrimaryWithSecondarySelected()
  fireEvent.click(screen.getByRole('button', { name: /Connect BongaCams later/ }))
  fireEvent.click(await screen.findByRole('button', { name: /Continue with Free/ }))
  expect(await screen.findByText(/You're ready to use CamCash Free/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Enter CamCash/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Connect BongaCams/ })).toBeInTheDocument()
  await waitFor(() => expect(completionWrites()).toHaveLength(1))
  expect(track).toHaveBeenCalledWith('onboarding_free_selected', expect.any(Object))
}, 20000)

test('starting the trial marks onboarding complete before the Stripe redirect', async () => {
  await importPrimaryWithSecondarySelected()
  fireEvent.click(screen.getByRole('button', { name: /^Continue →$/ }))
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ error: 'stub' }) })
  window.alert = jest.fn()
  fireEvent.click(await screen.findByRole('button', { name: /Start my 7-day Pro trial/ }))
  await waitFor(() => expect(completionWrites()).toHaveLength(1))
  expect(track).toHaveBeenCalledWith('onboarding_trial_started', expect.any(Object))
}, 20000)

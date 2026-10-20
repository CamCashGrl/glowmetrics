import React, { StrictMode } from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import PricingClient from '../PricingClient'
const mockPush = jest.fn()
const mockGetSession = jest.fn()
const mockTrack = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('../../../lib/supabase', () => ({ supabase: { auth: {
  getSession: (...args) => mockGetSession(...args),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
} } }))
jest.mock('../../../lib/track', () => ({ track: (...args) => mockTrack(...args) }))
jest.mock('../../components/SiteFooter', () => () => null)

beforeEach(() => {
  jest.clearAllMocks()
  mockGetSession.mockResolvedValue({ data: { session: null } })
  global.fetch = jest.fn()
})
afterEach(cleanup)
async function ready() {
  await waitFor(() => expect(screen.getByRole('button', { name: /trial.*pro monthly/i })).toBeEnabled())
}
test('three plans disclose prices, annual savings, and the capped trial', async () => {
  render(<PricingClient />)
  await ready()
  for (const name of ['Free', 'Pro Monthly', 'Pro Annual']) expect(screen.getByRole('heading', { name, exact: true })).toBeInTheDocument()
  expect(screen.getAllByText(/Save.*\$20\.88/i).length).toBeGreaterThan(0)
  expect(screen.getByText(/Best Value.*17%/)).toBeInTheDocument()
  expect(screen.getByText(/2 Live Mode sessions total/)).toBeInTheDocument()
  expect(screen.getByRole('table')).toHaveTextContent('rolling 31 days')
  expect(screen.getByRole('table')).toHaveTextContent('2 sessions total over 7 days')
  expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
  expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
  expect(screen.queryByText(/full pro access|full earning history/i)).not.toBeInTheDocument()
})
test.each([['Monthly', 'standard_monthly'], ['Annual', 'standard_annual']])('anonymous %s choice continues through signup', async (name, plan) => {
  render(<PricingClient />)
  await ready()
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`trial.*pro ${name}`, 'i') }))
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/landing?plan=${plan}`))
  expect(fetch).not.toHaveBeenCalled()
  expect(mockTrack).toHaveBeenCalledWith('pricing_plan_selected', { plan_type: plan })
  expect(mockTrack).toHaveBeenCalledWith('pricing_trial_clicked', { plan_type: plan })
})
test.each([['Monthly', 'standard_monthly'], ['Annual', 'standard_annual']])('authenticated %s choice uses verified checkout mapping and surfaces errors', async (name, plan) => {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 'test-session' } } })
  fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Checkout temporarily unavailable' }) })
  render(<PricingClient />)
  await ready()
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`trial.*pro ${name}`, 'i') }))
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/stripe/checkout', expect.objectContaining({
    body: JSON.stringify({ plan_type: plan }), credentials: 'include',
    headers: expect.objectContaining({ Authorization: 'Bearer test-session' }),
  })))
  expect(await screen.findByRole('alert')).toHaveTextContent('Checkout temporarily unavailable')
  expect(mockPush).not.toHaveBeenCalled()
  expect(mockTrack.mock.calls.some(([event]) => /^checkout_|trial_started|subscription_activated/.test(event))).toBe(false)
})
test('page view is recorded once under Strict Mode', async () => {
  render(<StrictMode><PricingClient /></StrictMode>)
  await ready()
  expect(mockTrack.mock.calls.filter(([event]) => event === 'pricing_page_viewed')).toHaveLength(1)
})

/**
 * Leaving and reopening onboarding restores the saved platform selection.
 * The database stores canonical names (BongaCams, Chaturbate, MyFreeCams);
 * onboarding ids are lowercase. Restoring must never write anything.
 * Step 1 is single select: the restored primary is the one selected card,
 * and the other saved platforms are kept (in order) for the save.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

HTMLCanvasElement.prototype.getContext = () => ({
  clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {},
  moveTo: () => {}, lineTo: () => {}, stroke: () => {}, closePath: () => {},
  save: () => {}, restore: () => {}, set fillStyle(v) {}, set strokeStyle(v) {},
  set globalAlpha(v) {}, set lineWidth(v) {},
})

let mockProfile
const mockWrites = []
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
        single: async () => {
          if (table === 'beta_users') return { data: { onboarding_complete: false } }
          if (table === 'profiles') return { data: mockProfile }
          return { data: null }
        },
        upsert: jest.fn(async (v) => { mockWrites.push({ table, v }); return { data: null, error: null } }),
        update: jest.fn((v) => { mockWrites.push({ table, v }); return chain }),
      }
      return chain
    }),
  },
}))
jest.mock('../../../lib/track', () => ({ track: jest.fn() }))
// Stable router object, as in the real app (a new one per render would
// re-run the page's [router] boot effect).
const mockRouter = { push: jest.fn(), replace: jest.fn() }
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }))

import OnboardingPage from '../page.js'

beforeEach(() => { mockWrites.length = 0; global.fetch = jest.fn() })
const noWrites = () => {
  expect(mockWrites.filter((w) => w.table === 'profiles')).toEqual([])
  expect(global.fetch).not.toHaveBeenCalled()
}

const card = (name) => screen.getByRole('radio', { name: new RegExp(name) })
const selectedOnly = async (name) => {
  await waitFor(() => expect(card(name)).toHaveAttribute('aria-checked', 'true'))
  expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1)
  expect(screen.getByRole('button', { name: `Continue with ${name} →` })).toBeEnabled()
}

test.each([['BongaCams'], ['Chaturbate'], ['MyFreeCams']])('restores a canonical %s selection', async (name) => {
  mockProfile = { plan: 'free', streaming_platforms: [name], primary_pro_platform: null }
  render(<OnboardingPage />)
  await selectedOnly(name)
  noWrites()
})

test('restores three saved platforms: first is the one selected card, no multi-select UI', async () => {
  mockProfile = { plan: 'free', streaming_platforms: ['MyFreeCams', 'BongaCams', 'Chaturbate'], primary_pro_platform: null }
  render(<OnboardingPage />)
  await selectedOnly('MyFreeCams')
  expect(screen.queryByText(/\/ 3/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Primary platform:/)).not.toBeInTheDocument()
  expect(screen.getByText('Platform')).toHaveAttribute('aria-current', 'step')
  noWrites()
})

test('a stored permanent primary is selected even when not first, and nothing is written', async () => {
  mockProfile = { plan: 'free', streaming_platforms: ['BongaCams', 'MyFreeCams', 'Chaturbate'], primary_pro_platform: 'Chaturbate' }
  render(<OnboardingPage />)
  await selectedOnly('Chaturbate')
  noWrites()
})

test('lowercase ids (older rows) still restore', async () => {
  mockProfile = { plan: 'free', streaming_platforms: ['bongacams', 'chaturbate'], primary_pro_platform: 'bongacams' }
  render(<OnboardingPage />)
  await selectedOnly('BongaCams')
  noWrites()
})

test('continuing after restore saves the stored primary first and keeps every saved secondary in order', async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
  mockProfile = { plan: 'free', streaming_platforms: ['BongaCams', 'MyFreeCams', 'Chaturbate'], primary_pro_platform: 'Chaturbate' }
  render(<OnboardingPage />)
  await selectedOnly('Chaturbate')
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Chaturbate →' }))
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
  const saved = mockWrites.filter((w) => w.table === 'profiles').map((w) => w.v.streaming_platforms)
  expect(saved).toEqual([['chaturbate', 'bongacams', 'myfreecams']])
})

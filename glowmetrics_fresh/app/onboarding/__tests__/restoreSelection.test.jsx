/**
 * Leaving and reopening onboarding restores the saved platform selection.
 * The database stores canonical names (BongaCams, Chaturbate, MyFreeCams);
 * onboarding ids are lowercase. Restoring must never write anything.
 */
import { render, screen, waitFor } from '@testing-library/react'
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
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))

import OnboardingPage from '../page.js'

beforeEach(() => { mockWrites.length = 0; global.fetch = jest.fn() })
const noWrites = () => {
  expect(mockWrites.filter((w) => w.table === 'profiles')).toEqual([])
  expect(global.fetch).not.toHaveBeenCalled()
}

test.each([
  ['BongaCams', 1],
  ['Chaturbate', 1],
  ['MyFreeCams', 1],
])('restores a canonical %s selection', async (name, n) => {
  mockProfile = { plan: 'free', streaming_platforms: [name], primary_pro_platform: null }
  render(<OnboardingPage />)
  await waitFor(() => expect(screen.getByText(new RegExp(`Primary platform: ${name}`))).toBeInTheDocument())
  expect(screen.getByRole('button', { name: new RegExp(`Continue with ${n} platform`) })).toBeInTheDocument()
  noWrites()
})

test('restores all three canonical platforms in saved order', async () => {
  mockProfile = { plan: 'free', streaming_platforms: ['MyFreeCams', 'BongaCams', 'Chaturbate'], primary_pro_platform: null }
  render(<OnboardingPage />)
  await waitFor(() => expect(screen.getByText(/Primary platform: MyFreeCams/)).toBeInTheDocument())
  expect(screen.getByText('3 / 3')).toBeInTheDocument()
  noWrites()
})

test('a stored permanent primary is shown as primary even when not first, and nothing is written', async () => {
  mockProfile = { plan: 'free', streaming_platforms: ['BongaCams', 'MyFreeCams', 'Chaturbate'], primary_pro_platform: 'Chaturbate' }
  render(<OnboardingPage />)
  await waitFor(() => expect(screen.getByText(/Primary platform: Chaturbate/)).toBeInTheDocument())
  expect(screen.getByRole('button', { name: /Continue with 3 platforms/ })).toBeInTheDocument()
  noWrites()
})

test('lowercase ids (older rows) still restore', async () => {
  mockProfile = { plan: 'free', streaming_platforms: ['bongacams', 'chaturbate'], primary_pro_platform: 'bongacams' }
  render(<OnboardingPage />)
  await waitFor(() => expect(screen.getByText(/Primary platform: BongaCams/)).toBeInTheDocument())
  expect(screen.getByRole('button', { name: /Continue with 2 platforms/ })).toBeInTheDocument()
  noWrites()
})

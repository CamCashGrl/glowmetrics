/**
 * Integration tests for onboarding Step 1 — multi-platform selection and
 * primary/secondary designation. Renders the real OnboardingPage component
 * (not a re-implementation) so these actually exercise the shipped state
 * machine, per the product rule: "PLATFORM IDENTITY -> PRIMARY PLATFORM ->
 * DATA CONNECTION..." — exactly one platform is ever Primary, selecting more
 * never loses an earlier selection, and changing Primary reorders without
 * deleting anything.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// The page renders a decorative <canvas> particle background (AmbientParticles)
// that jsdom can't run (no real 2D canvas context) — stub it out so its
// requestAnimationFrame loop doesn't throw. Unrelated to what's under test.
HTMLCanvasElement.prototype.getContext = () => ({
  clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {},
  moveTo: () => {}, lineTo: () => {}, stroke: () => {}, closePath: () => {},
  save: () => {}, restore: () => {}, set fillStyle(v) {}, set strokeStyle(v) {},
  set globalAlpha(v) {}, set lineWidth(v) {},
})

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
          if (table === 'profiles') return { data: { plan: 'free', streaming_platforms: null, primary_pro_platform: null } }
          return { data: null }
        },
        upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      return chain
    }),
  },
}))
jest.mock('../../../lib/track', () => ({ track: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))

import OnboardingPage from '../page.js'

describe('Onboarding Step 1 — multi-platform + primary designation', () => {
  test('A: selecting only Chaturbate makes it Primary and shows "Continue with 1 platform"', async () => {
    render(<OnboardingPage />)
    const cbCard = await screen.findByText('Chaturbate')
    fireEvent.click(cbCard)
    await waitFor(() => expect(screen.getByText(/Primary platform: Chaturbate/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Continue with 1 platform/ })).toBeInTheDocument()
  })

  test('B: selecting Chaturbate then BongaCams keeps Chaturbate Primary, BongaCams Secondary', async () => {
    render(<OnboardingPage />)
    fireEvent.click(await screen.findByText('Chaturbate'))
    fireEvent.click(await screen.findByText('BongaCams'))
    await waitFor(() => expect(screen.getByText(/Primary platform: Chaturbate/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Continue with 2 platforms/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Make BongaCams primary/ })).toBeInTheDocument()
  })

  test('C: selecting all three platforms shows exactly one Primary and "3 / 3" coverage', async () => {
    render(<OnboardingPage />)
    fireEvent.click(await screen.findByText('Chaturbate'))
    fireEvent.click(await screen.findByText('BongaCams'))
    fireEvent.click(await screen.findByText('MyFreeCams'))
    await waitFor(() => expect(screen.getByText(/Primary platform: Chaturbate/)).toBeInTheDocument())
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue with 3 platforms/ })).toBeInTheDocument()
    // Only one "Primary" badge should be rendered among the three cards
    expect(screen.getAllByText('Primary')).toHaveLength(1)
  })

  test('D: "Make primary" moves the designation without losing the other selection', async () => {
    render(<OnboardingPage />)
    fireEvent.click(await screen.findByText('Chaturbate'))
    fireEvent.click(await screen.findByText('BongaCams'))
    await waitFor(() => screen.getByRole('button', { name: /Make BongaCams primary/ }))
    fireEvent.click(screen.getByRole('button', { name: /Make BongaCams primary/ }))
    await waitFor(() => expect(screen.getByText(/Primary platform: BongaCams/)).toBeInTheDocument())
    // Chaturbate must still be selected (not lost), now offered as the one to make primary
    expect(screen.getByRole('button', { name: /Make Chaturbate primary/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue with 2 platforms/ })).toBeInTheDocument()
  })

  test('deselecting a platform removes it from the count without crashing', async () => {
    render(<OnboardingPage />)
    fireEvent.click(await screen.findByText('Chaturbate'))
    fireEvent.click(await screen.findByText('BongaCams'))
    await waitFor(() => expect(screen.getByRole('button', { name: /Continue with 2 platforms/ })).toBeInTheDocument())
    fireEvent.click(screen.getByText('BongaCams'))
    await waitFor(() => expect(screen.getByRole('button', { name: /Continue with 1 platform/ })).toBeInTheDocument())
    expect(screen.getByText(/Primary platform: Chaturbate/)).toBeInTheDocument()
  })

  test('no platform selected: CTA is disabled and does not claim a platform', async () => {
    render(<OnboardingPage />)
    await screen.findByText('Chaturbate')
    expect(screen.getByRole('button', { name: 'Select a platform to continue' })).toBeDisabled()
  })
})

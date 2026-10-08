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

const mockUpserts = []
let mockUpsertError = null
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
        upsert: jest.fn(async (v) => { mockUpserts.push({ table, v }); return { data: null, error: table === 'profiles' ? mockUpsertError : null } }),
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

describe('Onboarding Step 1 — saving platforms and the permanent primary', () => {
  const okJson = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
  beforeEach(() => { mockUpserts.length = 0; mockUpsertError = null; global.fetch = jest.fn() })
  const profileUpserts = () => mockUpserts.filter((u) => u.table === 'profiles').map((u) => u.v)
  async function chooseAndContinue() {
    render(<OnboardingPage />)
    fireEvent.click(await screen.findByText('BongaCams'))
    fireEvent.click(await screen.findByText('Chaturbate'))
    fireEvent.click(await screen.findByRole('button', { name: /Continue with 2 platforms/ }))
  }

  test('browser saves only streaming_platforms; the primary goes through the server route', async () => {
    global.fetch.mockResolvedValue(okJson(200, { primary_pro_platform: 'bongacams' }))
    await chooseAndContinue()
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(profileUpserts()).toEqual([{ id: 'u1', streaming_platforms: ['bongacams', 'chaturbate'] }])
    expect(profileUpserts()[0]).not.toHaveProperty('primary_pro_platform')
    const [url, init] = global.fetch.mock.calls[0]
    expect(url).toBe('/api/profile/primary-platform')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ platform: 'bongacams' })
    await waitFor(() => expect(screen.queryByRole('button', { name: /Continue with 2 platforms/ })).not.toBeInTheDocument())
    expect(screen.queryByTestId('primary-save-error')).not.toBeInTheDocument()
  })

  test('route failure is shown, onboarding does not advance, and Continue retries', async () => {
    global.fetch.mockResolvedValueOnce(okJson(500, { error: 'Could not save your primary platform.' }))
    await chooseAndContinue()
    expect(await screen.findByTestId('primary-save-error')).toHaveTextContent('Could not save your primary platform.')
    expect(screen.getByRole('button', { name: /Continue with 2 platforms/ })).toBeInTheDocument()
    global.fetch.mockResolvedValueOnce(okJson(200, { primary_pro_platform: 'bongacams' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue with 2 platforms/ }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Continue with 2 platforms/ })).not.toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  test('network failure is shown and does not advance', async () => {
    global.fetch.mockRejectedValueOnce(new Error('offline'))
    await chooseAndContinue()
    expect(await screen.findByTestId('primary-save-error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue with 2 platforms/ })).toBeInTheDocument()
  })

  test('409 for a DIFFERENT stored primary is shown, not treated as success', async () => {
    global.fetch.mockResolvedValueOnce(okJson(409, { error: 'Your primary platform is already set and cannot be changed.', primary_pro_platform: 'myfreecams' }))
    await chooseAndContinue()
    expect(await screen.findByTestId('primary-save-error')).toHaveTextContent('already set')
    expect(screen.getByRole('button', { name: /Continue with 2 platforms/ })).toBeInTheDocument()
  })

  test('409 for the SAME stored primary (retry after an earlier success) continues', async () => {
    global.fetch.mockResolvedValueOnce(okJson(409, { primary_pro_platform: 'bongacams' }))
    await chooseAndContinue()
    await waitFor(() => expect(screen.queryByRole('button', { name: /Continue with 2 platforms/ })).not.toBeInTheDocument())
    expect(screen.queryByTestId('primary-save-error')).not.toBeInTheDocument()
  })

  test('platform-list save failure is shown and the route is not called', async () => {
    mockUpsertError = { message: 'permission denied' }
    await chooseAndContinue()
    expect(await screen.findByTestId('primary-save-error')).toHaveTextContent('could not save your platforms')
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

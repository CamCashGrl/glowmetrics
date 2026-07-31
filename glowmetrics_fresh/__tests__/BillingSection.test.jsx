import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }) },
  },
}))
vi.mock('../lib/track', () => ({ track: vi.fn() }))

const { default: BillingSection } = await import('../app/dashboard/BillingSection')

beforeEach(() => {
  vi.clearAllMocks()
  delete window.location
  window.location = { assign: vi.fn() }
})

describe('BillingSection — free plan', () => {
  it('shows the free-plan state with a View Pro options link, no billing details', () => {
    render(<BillingSection profile={{ plan: 'free' }} isPro={false} />)
    expect(screen.getByText('Free plan')).toBeInTheDocument()
    expect(screen.getByText('View Pro options')).toBeInTheDocument()
    expect(screen.queryByText('Manage billing')).not.toBeInTheDocument()
  })

  it('never renders a Stripe customer or subscription ID', () => {
    render(<BillingSection profile={{ plan: 'free', stripe_customer_id: 'cus_should_never_render' }} isPro={false} />)
    expect(screen.queryByText(/cus_should_never_render/)).not.toBeInTheDocument()
  })
})

describe('BillingSection — pro plan', () => {
  it('shows active status, interval, and renewal date when known', () => {
    render(
      <BillingSection
        profile={{ plan: 'pro', billing_status: 'ok', billing_interval: 'month', current_period_end: '2026-09-01T00:00:00.000Z' }}
        isPro={true}
      />
    )
    expect(screen.getByText('CamCash Pro')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Monthly')).toBeInTheDocument()
    expect(screen.getByText('Manage billing')).toBeInTheDocument()
  })

  it('labels an Early Adopter subscriber distinctly', () => {
    render(<BillingSection profile={{ plan: 'pro', is_early_adopter: true }} isPro={true} />)
    expect(screen.getByText('CamCash Pro — Early Adopter')).toBeInTheDocument()
  })

  it('shows a past-due banner and does not hide the Manage billing button', () => {
    render(<BillingSection profile={{ plan: 'pro', billing_status: 'past_due' }} isPro={true} />)
    expect(screen.getByText('Your latest CamCash payment needs attention')).toBeInTheDocument()
    expect(screen.getByText('Manage billing')).toBeInTheDocument()
  })

  it('opens the billing portal and tracks billing_portal_opened', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ url: 'https://billing.stripe.com/session/abc' }) })
    render(<BillingSection profile={{ plan: 'pro' }} isPro={true} />)
    fireEvent.click(screen.getByText('Manage billing'))
    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith('https://billing.stripe.com/session/abc')
    })
  })

  it('shows a clear message when the portal has no Stripe customer to manage (404)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({ error: 'No subscription found' }) })
    render(<BillingSection profile={{ plan: 'pro' }} isPro={true} />)
    fireEvent.click(screen.getByText('Manage billing'))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/subscribe to Pro first/i)
    })
  })

  it('shows a generic recoverable error on a portal server error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({ error: 'boom' }) })
    render(<BillingSection profile={{ plan: 'pro' }} isPro={true} />)
    fireEvent.click(screen.getByText('Manage billing'))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/try again shortly/i)
    })
  })
})

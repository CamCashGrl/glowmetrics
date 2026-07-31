import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
    },
  },
}))

vi.mock('../lib/track', () => ({
  track: vi.fn(),
}))

const { default: UpgradeModal } = await import('../components/UpgradeModal')
const { track } = await import('../lib/track')

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn((url) => {
    if (String(url).includes('plan-config')) {
      return Promise.resolve({ json: () => Promise.resolve({ annualAvailable: true }) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: 'https://checkout.stripe.com/xyz' }) })
  })
  delete window.location
  window.location = { assign: vi.fn() }
})

describe('UpgradeModal', () => {
  it('fires upgrade_prompt_viewed once on open, with the gate source', async () => {
    render(<UpgradeModal source="whales_empty" featureName="whales_empty" onClose={() => {}} />)
    expect(track).toHaveBeenCalledWith('upgrade_prompt_viewed', { gate_source: 'whales_empty', feature_name: 'whales_empty' })
    expect(track).toHaveBeenCalledTimes(1)
  })

  it('renders the real discovered value when provided, and nothing when not', () => {
    const { rerender } = render(
      <UpgradeModal source="whales_empty" discoveredValue="7 additional fans analyzed" onClose={() => {}} />
    )
    expect(screen.getByText('7 additional fans analyzed')).toBeInTheDocument()

    rerender(<UpgradeModal source="whales_empty" onClose={() => {}} />)
    expect(screen.queryByText('7 additional fans analyzed')).not.toBeInTheDocument()
  })

  it('renders only the feature-scoped benefits passed in, not a generic full feature list', () => {
    render(
      <UpgradeModal
        source="whales_empty"
        benefits={['Full spending timelines and tip frequency', 'Churn-risk explanations and recovery suggestions']}
        onClose={() => {}}
      />
    )
    expect(screen.getByText('Full spending timelines and tip frequency')).toBeInTheDocument()
    expect(screen.queryByText(/Live Mode/i)).not.toBeInTheDocument()
  })

  it('hides the annual option when the plan-config endpoint says it is unavailable', async () => {
    global.fetch = vi.fn((url) => {
      if (String(url).includes('plan-config')) {
        return Promise.resolve({ json: () => Promise.resolve({ annualAvailable: false }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: 'https://checkout.stripe.com/xyz' }) })
    })
    render(<UpgradeModal source="whales_empty" onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.queryByText(/Upgrade annually/i)).not.toBeInTheDocument()
    })
  })

  it('starts checkout with the monthly plan and tracks the click', async () => {
    render(<UpgradeModal source="whales_empty" featureName="whales_empty" monthlyPlanType="standard_monthly" onClose={() => {}} />)
    fireEvent.click(screen.getByText(/Upgrade monthly/i))

    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith('https://checkout.stripe.com/xyz')
    })
    expect(track).toHaveBeenCalledWith('upgrade_prompt_clicked', {
      gate_source: 'whales_empty',
      feature_name: 'whales_empty',
      plan_type: 'standard_monthly',
    })
    expect(track).toHaveBeenCalledWith('checkout_started', { plan_type: 'standard_monthly' })
  })

  it('calls onClose on Escape and on "Not now"', () => {
    const onClose = vi.fn()
    render(<UpgradeModal source="whales_empty" onClose={onClose} />)

    fireEvent.click(screen.getByText('Not now'))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('moves focus into the dialog on mount for keyboard/screen-reader users', () => {
    render(<UpgradeModal source="whales_empty" onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toHaveFocus()
  })
})

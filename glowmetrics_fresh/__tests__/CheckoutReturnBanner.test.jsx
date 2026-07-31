import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CheckoutReturnBanner from '../components/CheckoutReturnBanner'

describe('CheckoutReturnBanner', () => {
  it('renders nothing when state is null', () => {
    const { container } = render(<CheckoutReturnBanner state={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the activating message, never claiming payment is confirmed', () => {
    render(<CheckoutReturnBanner state="activating" />)
    expect(screen.getByText('Payment successful')).toBeInTheDocument()
    expect(screen.getByText("We're activating CamCash Pro now.")).toBeInTheDocument()
  })

  it('shows the active/confirmed message once the verified plan confirms', () => {
    render(<CheckoutReturnBanner state="active" />)
    expect(screen.getByText('CamCash Pro is active')).toBeInTheDocument()
  })

  it('shows a neutral, non-alarming cancellation notice', () => {
    render(<CheckoutReturnBanner state="canceled" />)
    expect(screen.getByText('Checkout was canceled')).toBeInTheDocument()
    expect(screen.getByText('Your current plan has not changed.')).toBeInTheDocument()
  })

  it('shows a retry action on timeout, without claiming the payment failed', () => {
    const onRetry = vi.fn()
    render(<CheckoutReturnBanner state="timeout" onRetry={onRetry} />)
    expect(screen.getByText('Your payment may still be processing')).toBeInTheDocument()
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Refresh plan status'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss when the close button is clicked', () => {
    const onDismiss = vi.fn()
    render(<CheckoutReturnBanner state="active" onDismiss={onDismiss} />)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

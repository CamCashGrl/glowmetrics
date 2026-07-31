// Pure parsing for the query params Stripe redirects back with
// (app/api/stripe/checkout/route.js sets success_url/cancel_url), kept
// separate from the polling/UI logic in app/dashboard/page.js so the
// parsing itself is unit-testable without rendering the dashboard.

export function parseCheckoutReturnParams(search) {
  const params = new URLSearchParams(search)
  return {
    success: params.get('success') === 'true',
    canceled: params.get('canceled') === 'true',
    planType: params.get('plan'),
    sessionId: params.get('session_id'),
  }
}

export function hasCheckoutReturnParams(search) {
  const { success, canceled } = parseCheckoutReturnParams(search)
  return success || canceled
}

// Bounded polling window for webhook activation — never polls forever.
export const CHECKOUT_POLL_INTERVAL_MS = 2000
export const CHECKOUT_POLL_TIMEOUT_MS = 30000

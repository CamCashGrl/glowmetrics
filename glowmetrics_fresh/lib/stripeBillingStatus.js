// Pure helpers for turning a Stripe Subscription object into the billing
// fields shown in the Plan & Billing UI. Kept separate from `plan` on
// purpose: `plan` (lib/plan.js) is the only thing feature-access checks
// read, so a billing hiccup can never silently unlock or lock a feature —
// it only changes what the billing banner/section says.

const OK_STATUSES = new Set(['active', 'trialing'])
const KNOWN_STATUSES = new Set([
  'active', 'trialing', 'past_due', 'unpaid', 'incomplete',
  'incomplete_expired', 'canceled', 'paused',
])

export function billingStatusFromSubscriptionStatus(status) {
  if (!KNOWN_STATUSES.has(status)) return 'ok' // unknown Stripe status: don't invent an alarming state
  if (OK_STATUSES.has(status)) return 'ok'
  if (status === 'incomplete_expired') return 'incomplete'
  return status // past_due | unpaid | incomplete | canceled | paused
}

export function billingIntervalFromSubscription(sub) {
  return sub?.items?.data?.[0]?.price?.recurring?.interval || null
}

export function currentPeriodEndFromSubscription(sub) {
  const ts = sub?.current_period_end
  return typeof ts === 'number' ? new Date(ts * 1000).toISOString() : null
}

export function isEarlyAdopterFromMetadata(metadata) {
  return Boolean(metadata?.plan_type?.startsWith('early_adopter'))
}

// Everything the webhook needs to write for a subscription created/updated
// event, in one call so the route doesn't re-derive each field separately.
export function deriveBillingFields(sub) {
  return {
    billing_status: billingStatusFromSubscriptionStatus(sub?.status),
    billing_interval: billingIntervalFromSubscription(sub),
    current_period_end: currentPeriodEndFromSubscription(sub),
    is_early_adopter: isEarlyAdopterFromMetadata(sub?.metadata),
  }
}

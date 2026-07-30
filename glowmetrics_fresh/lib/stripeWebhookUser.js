// Resolves which Supabase user a Stripe webhook event belongs to.
//
// Prefers the userId we ourselves stamped into Checkout Session / Subscription
// metadata at creation time (app/api/stripe/checkout/route.js) — that's a
// direct, unambiguous link that can't be broken by an email mismatch between
// Stripe and Supabase auth. Email lookup remains as a fallback for the rare
// case metadata is missing (e.g. a subscription created outside our checkout
// route), and every fallback use is logged so it's visible in server logs
// rather than silently succeeding or silently failing.

export async function resolveUserIdForEvent(supabase, { metadataUserId, customerEmail, eventType }) {
  if (metadataUserId) {
    const { data, error } = await supabase.auth.admin.getUserById(metadataUserId)
    if (error) {
      console.error(`stripeWebhookUser: metadata userId ${metadataUserId} on ${eventType} did not resolve to a real user`, error.message)
    } else if (data?.user) {
      return { userId: data.user.id, matchedBy: 'metadata' }
    }
  }

  if (!customerEmail) {
    return { userId: null, matchedBy: 'none' }
  }

  console.warn(`stripeWebhookUser: falling back to email match for ${eventType} — metadata userId was ${metadataUserId ? 'invalid' : 'missing'}`)

  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) {
    console.error('stripeWebhookUser: email fallback lookup failed', error.message)
    return { userId: null, matchedBy: 'none' }
  }

  const user = data.users.find((u) => u.email === customerEmail)
  if (!user) {
    return { userId: null, matchedBy: 'none' }
  }

  return { userId: user.id, matchedBy: 'email_fallback' }
}

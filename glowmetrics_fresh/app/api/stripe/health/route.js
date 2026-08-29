import { NextResponse } from 'next/server'
import { verifyAdminToken, getAdminTokenFromCookieHeader } from '../../../../lib/adminAuth'
import { auditPriceConfiguration } from '../../../../lib/stripe-plans'
import { stripe } from '../../../../lib/stripe'

// Answers "can a creator actually pay right now, and at what price?" without
// having to attempt a real purchase.
//
// It reports the resolved price's REAL amount, interval and nickname, fetched
// from Stripe — not just that some env var held a value. That distinction is
// the whole point: an env var name tells you nothing about the price inside
// it. This codebase accepts six different variable names per plan for
// historical reasons, and one of them (STRIPE_PRICE_EARLY_ADOPTER_MONTHLY)
// points at a $9.99 beta price in at least one environment while the list
// price is $19.99. "Configured" was never the question worth answering;
// "configured as what" is.
//
// Admin-only: it names environment variables and their state. Price IDs are
// returned because they are needed to verify against the Stripe dashboard,
// and they are not secrets — but the endpoint stays behind admin auth anyway.
export async function GET(req) {
  const token = getAdminTokenFromCookieHeader(req.headers.get('cookie'))
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const audit = auditPriceConfiguration()

  const plans = await Promise.all(audit.map(async (entry) => {
    if (!entry.sellable) {
      return {
        plan: entry.plan,
        sellable: false,
        fix: `Set one of these env vars to a price_... id: ${entry.searched.join(', ')}`,
      }
    }

    // Resolve the ID again here rather than trusting the audit's word for it:
    // the point is to show what Stripe says this price actually is.
    const { resolvePriceId } = await import('../../../../lib/stripe-plans')
    const { priceId } = resolvePriceId(entry.plan)

    try {
      const price = await stripe.prices.retrieve(priceId, { expand: ['product'] })
      return {
        plan: entry.plan,
        sellable: true,
        resolved_from_env_var: entry.resolvedFrom,
        price_id: price.id,
        amount: price.unit_amount != null
          ? `${(price.unit_amount / 100).toFixed(2)} ${price.currency.toUpperCase()}`
          : 'unknown',
        interval: price.recurring
          ? `per ${price.recurring.interval_count > 1 ? price.recurring.interval_count + ' ' : ''}${price.recurring.interval}`
          : 'one-time (NOT a subscription — this is wrong for CamCash)',
        nickname: price.nickname || null,
        product_name: price.product?.name || null,
        price_active: price.active,
        // Loudest possible signal for the two ways a resolved price can still
        // be the wrong one.
        warnings: [
          price.active ? null : 'This price is ARCHIVED in Stripe — checkout will fail.',
          price.recurring ? null : 'This price is not recurring — subscriptions cannot use it.',
        ].filter(Boolean),
      }
    } catch (e) {
      return {
        plan: entry.plan,
        sellable: false,
        resolved_from_env_var: entry.resolvedFrom,
        price_id: priceId,
        fix: `${entry.resolvedFrom} holds "${priceId}", which Stripe rejected: ${e.message}. Check for a typo, or a test-mode id against a live key.`,
      }
    }
  }))

  const blocked = plans.filter(p => !p.sellable)
  const warned = plans.filter(p => p.warnings?.length)

  return NextResponse.json({
    ok: blocked.length === 0 && warned.length === 0 && !!process.env.STRIPE_SECRET_KEY,
    stripe_secret_key_present: !!process.env.STRIPE_SECRET_KEY,
    stripe_webhook_secret_present: !!process.env.STRIPE_WEBHOOK_SECRET,
    resend_api_key_present: !!process.env.RESEND_API_KEY,
    plans,
  })
}

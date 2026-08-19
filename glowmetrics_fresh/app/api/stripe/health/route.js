import { NextResponse } from 'next/server'
import { verifyAdminToken, getAdminTokenFromCookieHeader } from '../../../../lib/adminAuth'
import { auditPriceConfiguration } from '../../../../lib/stripe-plans'

// Answers "can a creator actually pay right now?" without having to attempt a
// real purchase. Exists because the answer was silently NO for an unknown
// stretch of the product's life, and nothing surfaced it.
//
// Admin-only: the response names environment variables and their
// configured/not-configured state, which is not public information. Price IDs
// themselves are never returned, only which env var supplied one.
export async function GET(req) {
  const token = getAdminTokenFromCookieHeader(req.headers.get('cookie'))
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const plans = auditPriceConfiguration()
  const sellable = plans.filter(p => p.sellable).map(p => p.plan)
  const blocked = plans.filter(p => !p.sellable)

  return NextResponse.json({
    ok: blocked.length === 0 && !!process.env.STRIPE_SECRET_KEY,
    stripe_secret_key_present: !!process.env.STRIPE_SECRET_KEY,
    stripe_webhook_secret_present: !!process.env.STRIPE_WEBHOOK_SECRET,
    sellable_plans: sellable,
    blocked_plans: blocked.map(p => ({
      plan: p.plan,
      fix: `Set one of these env vars to a price_... id: ${p.searched.join(', ')}`,
    })),
  })
}

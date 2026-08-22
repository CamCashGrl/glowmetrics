// ════════════════════════════════════════════════════════════════════
// LIVE MODE ENTITLEMENT — the server boundary.
//
// Live Mode is a Pro feature. The dashboard tab already hid it from Free,
// but hiding a tab is not enforcement: /live carries no plan check, so a
// Free creator could navigate there directly, or call the start-session API,
// and get the whole product. Everything Tasks D/E built on top of Live Mode
// — the post-stream report, coaching feed, Streaming Plan feedback — rode in
// through the same hole.
//
// This is the single place that decides. It reuses isProPlan (lib/plan.js),
// the same helper the insights APIs, the DB Pro gates and the promo-code
// trial all honour, so a trial grant (plan + plan_expires_at) unlocks Live
// Mode exactly like a paid plan and expires with it. No second subscription
// system, no allow-list.
// ════════════════════════════════════════════════════════════════════

import { isProPlan } from '../plan.js'

// Shape matches sanitizedErrorResponse()'s contract so routes can return it
// directly, and mirrors the platform-limit 402 the upload path already uses:
// a payment-required status with an upgrade destination, never a bare 403.
export const LIVE_MODE_PRO_REQUIRED = {
  status: 402,
  body: {
    error: 'Live Mode is a Creator Pro feature. Upgrade to run real-time coaching while you stream.',
    code: 'live_mode_requires_pro',
    upgradeUrl: '/pricing',
  },
}

/**
 * Resolve whether this caller may use Live Mode.
 *
 * Reads the plan from `profiles` with the CALLER's own client, so row-level
 * security still applies and a client-supplied id can never be substituted.
 *
 * @param {object} supabase - the authenticated client from getLiveSessionCaller
 * @param {object} user - the server-resolved auth user
 * @returns {Promise<{allowed: boolean, isPro: boolean}>}
 */
export async function resolveLiveModeAccess(supabase, user) {
  if (!user) return { allowed: false, isPro: false }
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', user.id)
    .maybeSingle()
  // isProPlan already rejects an expired plan_expires_at, which is what makes
  // the promo trial time-limited rather than permanent.
  const isPro = isProPlan(profile)
  return { allowed: isPro, isPro }
}

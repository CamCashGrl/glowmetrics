// Server-side whale/CRM intelligence endpoint — closes the gap flagged in
// the audit checklist: "premium fan intelligence" (churnRisk, tipProbability,
// lifetimeValue, expectedNextTip) was computed by identifyWhales() entirely
// client-side from the full tips array, for every user regardless of plan.
// The dashboard's blurred "Upgrade to see this fan" cards past the free
// cutoff are a real, well-designed UX pacing device (per the no-surprise-
// locks rule) — but "client-side hidden" is not the same as "server-side
// protected": the full computed whale list, including every free user's
// beyond-cutoff fans' churn-risk/tip-probability intelligence, already sits
// in the browser's React state and network response, inspectable via
// devtools regardless of the CSS blur.
//
// This route is the real protected path: it computes identifyWhales()
// server-side and redacts before responding, same 3-layer architecture and
// same redact() helper as app/api/insights/route.js. Free gets the same
// top-3-by-lifetime-spend basic identity (username/totalUSD/tipCount/tier)
// already shown unlocked in the existing UI — no less than what's already
// free — but never the computed intelligence fields (churnRisk,
// tipProbability, lifetimeValue, expectedNextTip, daysBetweenTipsArr,
// typicalOnlineHours) for ANY fan, including the free-visible top 3.
//
// NOT YET WIRED INTO ANY UI — per "do not manufacture a UI consumer just to
// claim migration completion," this is the server-side foundation only.
// The existing whales tab / Overview "Your Top Earners" continue to read
// the client-computed whales array (unprotected) until a real migration of
// those consumers is scoped and tested — that's a larger, higher-risk UI
// change than adding this endpoint, tracked as explicit follow-up, not
// silently implied to be done by this route's existence.
import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '../../../../lib/supabase-server'
import { isProPlan } from '../../../../lib/plan'
import { identifyWhales } from '../../../../lib/analytics'
import { redact } from '../../../../lib/entitlement'

const FREE_WHALE_COUNT = 3

function basicShape(w) {
  return { username: w.username, totalUSD: w.totalUSD, tipCount: w.tipCount, tier: w.tier }
}

export async function GET() {
  const supabase = createSupabaseRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('plan, plan_expires_at').eq('id', user.id).maybeSingle()
  const isPro = isProPlan(profile)

  const PAGE = 1000
  let tips = []
  const { data: firstPage, count } = await supabase
    .from('tips').select('*', { count: 'exact' }).eq('user_id', user.id)
    .order('date_time', { ascending: true }).range(0, PAGE - 1)
  if (firstPage) {
    tips = firstPage
    const total = count ?? firstPage.length
    if (total > PAGE) {
      const ranges = []
      for (let from = PAGE; from < total; from += PAGE) ranges.push(from)
      const pages = await Promise.all(ranges.map(from =>
        supabase.from('tips').select('*').eq('user_id', user.id).order('date_time', { ascending: true }).range(from, from + PAGE - 1)
      ))
      for (const { data } of pages) if (data?.length) tips = tips.concat(data)
    }
  }

  const whales = tips.length ? identifyWhales(tips) : []
  const hiddenCount = Math.max(whales.length - FREE_WHALE_COUNT, 0)

  // Basic identity for the top FREE_WHALE_COUNT fans (username/totalUSD/
  // tipCount/tier) is sent unconditionally — it's already unlocked in the
  // existing client-computed UI, so redacting it here would be MORE
  // restrictive than the current product, not the fix this route exists
  // for. What's actually gated is the computed intelligence layer
  // (churnRisk, tipProbability, lifetimeValue, expectedNextTip, etc.) —
  // that never reaches a Free response, for any fan, top-3 included.
  const topFansBasic = whales.slice(0, FREE_WHALE_COUNT).map(basicShape)

  const fans = redact({
    isPro,
    category: 'fan_intelligence',
    summary: hiddenCount > 0
      ? `You have ${hiddenCount} more fan${hiddenCount === 1 ? '' : 's'} with computed churn-risk and tip-probability intelligence.`
      : 'Not enough fan history yet for deeper intelligence.',
    count: hiddenCount,
    data: whales.map(w => ({
      ...basicShape(w),
      avgTipSize: w.avgTipSize, biggestTip: w.biggestTip, platform: w.platform,
      lastTipDate: w.lastTipDate, firstTipDate: w.firstTipDate, daysSinceLastTip: w.daysSinceLastTip,
      avgDaysBetweenTips: w.avgDaysBetweenTips, tipProbability: w.tipProbability, churnRisk: w.churnRisk,
      lifetimeValue: w.lifetimeValue, expectedNextTip: w.expectedNextTip, typicalOnlineHours: w.typicalOnlineHours,
      hasPrivates: w.hasPrivates, privateCount: w.privateCount, privateSpent: w.privateSpent,
      isTopSpender: w.isTopSpender, spendPercentile: w.spendPercentile,
    })),
  })

  return NextResponse.json({ topFansBasic, fans })
}

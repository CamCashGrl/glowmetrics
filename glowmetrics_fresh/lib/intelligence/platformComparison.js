// ============================================================
// CAMCASH DASHBOARD INTELLIGENCE — PLATFORM GAP DETECTED (Phase 6)
// ============================================================
//
// Proves ONE event: platform_gap_detected. Reuses the EXACT rule already
// shipping on the dashboard's "🎯 Platform Comparison" tab (app/dashboard/
// page.js's "Platform Recommendation Banner"): when a creator earns at
// least 2x more per hour on one platform than another, that's already
// considered a meaningful, notification-worthy finding — same threshold,
// same comparison, never a new formula.
//
// The underlying numbers come from aggregateRows()'s own top-level
// `platforms` array (lib/analytics.js), the same canonical, lifetime,
// server-side source app/dashboard/CreatorReport.js's topPlatform already
// uses — not the dashboard tab's client-side time-filtered variant, which
// has no server-side equivalent and computes the identical usdPerHour
// formula anyway.
//
// No new confidence floor is introduced. The existing dashboard rule has
// none beyond requiring usdPerHour > 0 on both sides and at least 2
// platforms — that gap is a known, already-flagged product characteristic
// of the existing rule, not something to silently tighten here.

const MULTIPLIER_THRESHOLD = 2 // reused verbatim from app/dashboard/page.js's
// Platform Recommendation Banner: `top.usdPerHour >= bottom.usdPerHour * 2`

// Pure decision function — no I/O. Takes the account's already-computed
// `platforms` array (analytics.platforms, straight off aggregateRows(),
// unmodified) and returns either a fully-formed event payload or null.
// Never fabricates a comparison: requires at least 2 platforms with a
// real, positive usdPerHour before comparing anything.
export function evaluatePlatformGap({ platforms }) {
  const qualifying = (platforms || []).filter(p => p?.platform && (p.usdPerHour || 0) > 0)
  if (qualifying.length < 2) return null

  const sorted = [...qualifying].sort((a, b) => b.usdPerHour - a.usdPerHour)
  const top = sorted[0]
  const bottom = sorted[sorted.length - 1]

  if (top.usdPerHour < bottom.usdPerHour * MULTIPLIER_THRESHOLD) return null

  const multiplier = parseFloat((top.usdPerHour / bottom.usdPerHour).toFixed(1))
  const topKey = top.platform.trim().toLowerCase()
  const bottomKey = bottom.platform.trim().toLowerCase()

  return {
    priority: 'medium',
    title: '⚡ Platform Earnings Gap',
    message: `You earn ${multiplier}x more per hour on ${top.platform} than ${bottom.platform} — $${top.usdPerHour.toFixed(2)}/hr vs $${bottom.usdPerHour.toFixed(2)}/hr.`,
    fingerprint: `platform_gap:${topKey}:${bottomKey}`,
    metadata: {
      top_platform: top.platform,
      bottom_platform: bottom.platform,
      top_usd_per_hour: top.usdPerHour,
      bottom_usd_per_hour: bottom.usdPerHour,
      multiplier,
      top_hours: top.hours,
      bottom_hours: bottom.hours,
      top_total_usd: top.totalUSD,
      bottom_total_usd: bottom.totalUSD,
      top_session_count: top.sessions,
      bottom_session_count: bottom.sessions,
    },
  }
}

// Orchestration — records the event via the existing dashboard_events RPC
// (unmodified shape), using a 24h cooldown per platform pair so the same
// gap can generate at most one event per day while still recurring if it
// remains true tomorrow. Never fails or blocks the caller — matches the
// established non-fatal pattern from every other intelligence pipeline.
const COOLDOWN_SECONDS = 24 * 60 * 60

export async function runPlatformGapPipeline({ userId, supabase, platforms }) {
  if (!userId || !supabase) throw new Error('runPlatformGapPipeline requires userId and a Supabase client')

  const evaluation = evaluatePlatformGap({ platforms })
  if (!evaluation) return { event: null, evaluation: null }

  let event = null
  try {
    const { data, error } = await supabase.rpc('record_dashboard_event_if_new', {
      p_event_type: 'platform_gap_detected',
      p_source: 'analytics',
      p_priority: evaluation.priority,
      p_title: evaluation.title,
      p_message: evaluation.message,
      p_fingerprint: evaluation.fingerprint,
      p_metadata: evaluation.metadata,
      p_cooldown_seconds: COOLDOWN_SECONDS,
    })
    if (error) throw error
    event = data
  } catch (eventErr) {
    console.warn('[intelligence] Failed to record platform_gap_detected event:', eventErr.message)
  }

  return { event, evaluation }
}

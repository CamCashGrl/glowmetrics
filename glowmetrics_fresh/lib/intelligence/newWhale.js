// ============================================================
// CAMCASH DASHBOARD INTELLIGENCE — NEW WHALE DETECTED (Phase 4)
// ============================================================
//
// Proves ONE event: new_whale_detected. Reuses generateWhaleAlerts()'s own
// EXISTING 'new_whale' rule (lib/analytics.js:571-572) verbatim — never a
// new whale-detection formula, never a new percentile/recency threshold.
// That rule already ships on the dashboard today (app/dashboard/page.js's
// `alerts = liveAnalytics?.whaleAlerts || analytics?.whaleAlerts`) as an
// ephemeral, recomputed-every-load card. This pipeline's only job is to
// also persist it as a dashboard_events row, so it survives past the
// session that produced it and can eventually reach other surfaces
// (notification bell, email, etc.) once those exist.
//
// The canonical rule this reuses, unmodified:
//   w.tier === 'Whale' && w.daysSinceLastTip < 7 && w.isTopSpender
// — tier/isTopSpender both come from identifyWhales()'s percentile ranking
// (top 5% by lifetime USD among this account's own fans), daysSinceLastTip
// from the same fan record. No new sample-floor is added here: whichever
// floor is or isn't implicit in identifyWhales()'s percentile math is the
// SAME floor already governing what the dashboard shows as "Whale" today —
// adding a second, stricter floor here would make this event disagree with
// the UI card it's persisting, which is exactly the inconsistency this
// whole intelligence build has been built to avoid.
//
// Dedup is permanent per (account, whale username) — p_cooldown_seconds
// omitted, same as import_completed's own permanent-fingerprint behavior.
// A whale only ever produces this event once: the first time they're
// observed as a new top spender. If they churn and later re-qualify, that
// is arguably a "welcome back" story (already separately covered by
// generateWhaleAlerts()'s own 'returned' alert type), not a second
// "new_whale_detected" — so no new logic is needed to prevent re-firing
// forever, the existing cooldown=NULL contract already does it.

// Pure decision function — no I/O. Takes the account's already-computed
// whaleAlerts array (analytics.whaleAlerts, straight off aggregateRows())
// and returns one event payload per qualifying whale (there can genuinely
// be more than one new top-spender across one CSV import). Never fabricates
// a whale — an empty/missing whaleAlerts array or no 'new_whale' entries
// simply produces no events.
export function evaluateNewWhales({ whaleAlerts }) {
  const alerts = (whaleAlerts || []).filter(a => a?.type === 'new_whale' && a?.whale?.username)

  return alerts.map(a => {
    const w = a.whale
    const usernameKey = w.username.trim().toLowerCase()
    return {
      priority: 'high',
      title: '🐳 New Top Supporter',
      message: a.message, // reuse generateWhaleAlerts()'s own copy verbatim — never re-word a canonical finding
      fingerprint: `new_whale:${usernameKey}`,
      metadata: {
        username: w.username,
        tier: w.tier,
        total_usd: w.totalUSD,
        days_since_last_tip: w.daysSinceLastTip,
        tip_count: w.tipCount,
        platform: w.platform,
      },
    }
  })
}

// Orchestration — records each qualifying event via the existing
// dashboard_events RPC (unmodified shape), permanently deduped per whale
// username (no cooldown param, matching import_completed). Never fails or
// blocks the caller — same non-fatal pattern as every other pipeline here.
export async function runNewWhalePipeline({ userId, supabase, whaleAlerts }) {
  if (!userId || !supabase) throw new Error('runNewWhalePipeline requires userId and a Supabase client')

  const evaluations = evaluateNewWhales({ whaleAlerts })
  if (!evaluations.length) return { events: [] }

  const events = []
  for (const evaluation of evaluations) {
    try {
      const { data, error } = await supabase.rpc('record_dashboard_event_if_new', {
        p_event_type: 'new_whale_detected',
        p_source: 'analytics',
        p_priority: evaluation.priority,
        p_title: evaluation.title,
        p_message: evaluation.message,
        p_fingerprint: evaluation.fingerprint,
        p_metadata: evaluation.metadata,
      })
      if (error) throw error
      events.push(data)
    } catch (eventErr) {
      console.warn('[intelligence] Failed to record new_whale_detected event:', eventErr.message)
    }
  }

  return { events }
}

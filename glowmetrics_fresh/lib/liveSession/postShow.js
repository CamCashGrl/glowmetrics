// Completed-show summaries, built only from persisted data: the finalized
// live_sessions row (final_* computed by _finalize_live_session_metrics from
// canonical tips + closed private intervals) and its live_private_intervals.
// Nothing here adds live_tips to tips, and nothing re-derives earnings from
// in-memory Live Mode state.

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))
const money = (v) => Math.round((num(v) ?? 0) * 100) / 100

export const FINALIZED_SESSION_COLUMNS = [
  'id', 'user_id', 'status', 'stream_platform', 'started_at', 'ended_at', 'finalized_at',
  'total_paused_seconds', 'session_resolution_type', 'dashboard_seen_at',
  'final_total_usd', 'final_public_usd', 'final_private_usd', 'final_private_seconds',
  'final_platform_breakdown', 'final_tokens', 'final_tip_count', 'final_unique_tippers',
  'final_top_tipper_username', 'final_top_tipper_usd', 'final_largest_tip_usd',
  'final_avg_tip_usd', 'final_duration_seconds', 'final_usd_per_hour',
].join(',')

export const PRIVATE_INTERVAL_COLUMNS =
  'id,live_session_id,platform,started_at,ended_at,rate_per_minute,estimated_earnings_usd'

export function toShowSummary(row, intervals = []) {
  if (!row?.id) return null
  const breakdown = row.final_platform_breakdown || {}
  const platformRevenue = Object.entries(breakdown)
    .map(([platform, v]) => ({ platform, usd: money(v?.usd), tips: Number(v?.tips) || 0 }))
    .sort((a, b) => b.usd - a.usd || a.platform.localeCompare(b.platform))
  const ownIntervals = intervals
    .filter((i) => i.live_session_id === row.id)
    .sort((a, b) => new Date(a.started_at) - new Date(b.started_at))
    .map((i) => ({
      id: i.id,
      platform: i.platform,
      startedAt: i.started_at,
      endedAt: i.ended_at,
      ratePerMinute: money(i.rate_per_minute),
      earningsUsd: money(i.estimated_earnings_usd),
    }))

  return {
    id: row.id,
    platform: row.stream_platform,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    finalizedAt: row.finalized_at,
    endedHow: row.session_resolution_type,
    durationSeconds: num(row.final_duration_seconds) ?? 0,
    totalUsd: money(row.final_total_usd),
    publicUsd: money(row.final_public_usd),
    privateUsd: money(row.final_private_usd),
    privateSeconds: num(row.final_private_seconds) ?? 0,
    privateIntervals: ownIntervals,
    platformRevenue,
    tipCount: num(row.final_tip_count) ?? 0,
    uniqueTippers: num(row.final_unique_tippers) ?? 0,
    tokens: num(row.final_tokens) ?? 0,
    topTipper: row.final_top_tipper_username
      ? { username: row.final_top_tipper_username, usd: money(row.final_top_tipper_usd) }
      : null,
    largestTipUsd: money(row.final_largest_tip_usd),
    usdPerHour: num(row.final_usd_per_hour),
    isNew: !row.dashboard_seen_at,
    seenAt: row.dashboard_seen_at || null,
  }
}

// One entry per session id, newest first. A session fetched twice (refresh,
// reconnect, repeated Stop) is still one show.
export function mergeShows(...lists) {
  const byId = new Map()
  for (const list of lists) {
    for (const s of list || []) {
      if (s?.id) byId.set(s.id, s)
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.endedAt) - new Date(a.endedAt) || (a.id < b.id ? 1 : -1)
  )
}

// KPI delta for the most recent show the creator has not acknowledged yet.
// Exactly one session contributes; it is never added to another show or to
// the historical totals (those already include its canonical tips).
export function latestShowDelta(shows) {
  const newest = mergeShows(shows).find((s) => s.isNew)
  if (!newest) return null
  return {
    sessionId: newest.id,
    totalUsd: newest.totalUsd,
    publicUsd: newest.publicUsd,
    privateUsd: newest.privateUsd,
    tipCount: newest.tipCount,
    label: `+$${newest.totalUsd.toFixed(2)} from latest show`,
  }
}

export function unacknowledgedIds(shows) {
  return mergeShows(shows).filter((s) => s.isNew).map((s) => s.id)
}

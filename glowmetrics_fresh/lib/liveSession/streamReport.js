// ════════════════════════════════════════════════════════════════════
// POST-STREAM REPORT — canonical derivation.
//
// Every value here comes from a column that live_sessions / live_tips /
// coaching_events already persist when a stream ends. This module computes
// NOTHING that the schema cannot support, and the UI computes nothing at
// all — same rule the Command Center and Fans surfaces follow.
//
// Duration is NOT recomputed: shapeLiveSession() (./shape.js) is the single
// implementation of active_duration_seconds, pause accounting included, and
// every route already returns sessions through it.
//
// DELIBERATELY ABSENT: viewer count and viewer-to-tipper conversion. There
// is no viewer data anywhere in the schema, the live API, or the engine, so
// any conversion figure would be invented. The landing page currently claims
// it; that is a copy/data-source decision, not something to paper over here.
// ════════════════════════════════════════════════════════════════════

// Explicit .js extension so plain node ESM (the verification scripts) can
// import this module. Extensionless specifiers are why
// verify-ambiguous-slash-dates cannot load lib/analytics.js today.
import { shapeLiveSession } from './shape.js'

// A tip is "large" for this stream when it is worth calling out next to the
// rest of THIS session — measured against the session's own average, not a
// hardcoded dollar figure that would mean different things to different
// creators. Requires a real spread to be meaningful.
const LARGE_TIP_MULTIPLE = 3
const MIN_TIPS_FOR_SPREAD = 3

// How long after a coaching prompt we report what the room actually did.
// This is an OBSERVATION WINDOW, not an attribution: tips inside it are
// reported as "what happened next", never as "what the prompt caused".
// There is no counterfactual in the data — no control stream, no A/B — so
// no causal or percentage-improvement claim can be made from it.
const OUTCOME_WINDOW_MINUTES = 15

export function buildStreamReport({ session, coachingEvents = [], sessionTips = [], whales = [],
                                    canonicalBestTimes = null, creatorTz = 'UTC' } = {}) {
  if (!session || session.status !== 'ended') return null

  const shaped = shapeLiveSession(session)
  const activeSeconds = shaped.active_duration_seconds || 0
  const activeHours = activeSeconds / 3600

  const earningsUsd = Number(session.session_earnings_usd) || 0
  const tokens = Number(session.session_tokens) || 0
  const tipCount = Number(session.tip_count) || 0
  const uniqueTippers = Number(session.unique_tipper_count) || 0
  const largestTipUsd = Number(session.largest_tip_usd) || 0

  // Revenue velocity. Below a minute of active time the divisor is noise —
  // a single tip 20 seconds in would read as hundreds per hour — so it is
  // reported as null and the UI omits it rather than printing a number the
  // stream did not earn.
  const usdPerHour = activeSeconds >= 60 && earningsUsd > 0
    ? Math.round((earningsUsd / activeHours) * 100) / 100
    : null

  // Goal: only when the creator actually set one.
  const goalTokens = Number(session.coaching_goal_tokens) || 0
  const goal = goalTokens > 0
    ? {
        target: goalTokens,
        earned: tokens,
        reached: tokens >= goalTokens,
        pct: Math.min(100, Math.round((tokens / goalTokens) * 100)),
        remaining: Math.max(0, goalTokens - tokens),
      }
    : null

  // ── COACHING RECAP — persisted events only, counted by their own
  //    action_status. No score is derived from them. ──
  const events = Array.isArray(coachingEvents) ? coachingEvents : []
  const performedCount = events.filter(e => e.action_status === 'performed').length
  const skippedCount = events.filter(e => e.action_status === 'skipped').length
  // Rates only when a prompt actually resolved. Prompts still pending at the
  // end of a stream are neither performed nor skipped, so dividing by
  // events.length would understate both rates against a bad denominator.
  const resolved = performedCount + skippedCount
  const coaching = {
    delivered: events.length,
    performed: performedCount,
    skipped: skippedCount,
    resolved,
    performedRate: resolved > 0 ? Math.round((performedCount / resolved) * 100) : null,
    skippedRate: resolved > 0 ? Math.round((skippedCount / resolved) * 100) : null,
    // Counts per persisted `type`, most used first. A category count, not a
    // ranking of which coaching "works".
    byType: Object.entries(
      events.reduce((acc, e) => { const k = e.type || 'unknown'; acc[k] = (acc[k] || 0) + 1; return acc }, {})
    ).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count })),
    // Highest-priority events first, for the "what mattered" list. Priority
    // and title are persisted columns; nothing is re-ranked by a formula.
    moments: [...events]
      .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0) ||
                      new Date(a.shown_at) - new Date(b.shown_at))
      .slice(0, 3)
      .map(e => ({
        type: e.type, title: e.title, message: e.message,
        status: e.action_status || null, shownAt: e.shown_at,
        // What the room did in the window after the prompt. An observation,
        // never an attribution — see OUTCOME_WINDOW_MINUTES. null when the
        // prompt has no usable timestamp or there are no tips to observe.
        outcome: measureAfter(e.shown_at, sessionTips),
      })),
  }

  // ── FAN SIGNALS — canonical fan identity, canonical tier. ──
  // whales come from identifyWhales(): keyed on username.toLowerCase() with
  // no platform in the key, carrying the canonical `tier`. A tipper in this
  // session is "returning" when the engine already knew them from history
  // beyond this stream; "high value" when the engine's own tier says so.
  // No probability, no score, no invented whale likelihood.
  const whaleByName = new Map(
    (whales || []).map(w => [String(w.username || '').toLowerCase(), w])
  )
  const seen = new Map()
  for (const t of sessionTips || []) {
    const key = String(t.username || '').toLowerCase()
    if (!key) continue
    const prev = seen.get(key) || { username: t.username, usd: 0, tips: 0 }
    prev.usd += Number(t.usd) || 0
    prev.tips += 1
    seen.set(key, prev)
  }
  const tippers = [...seen.entries()].map(([key, agg]) => {
    const known = whaleByName.get(key) || null
    // Tips this fan has in the engine's history BEYOND this session's own.
    const priorTips = known ? Math.max(0, (Number(known.tipCount) || 0) - agg.tips) : 0
    return {
      username: agg.username,
      usdThisStream: Math.round(agg.usd * 100) / 100,
      tipsThisStream: agg.tips,
      returning: priorTips > 0,
      tier: known?.tier || null,
      lifetimeUsd: known ? Number(known.totalUSD) || 0 : null,
    }
  }).sort((a, b) => b.usdThisStream - a.usdThisStream)

  const returningFans = tippers.filter(t => t.returning)
  const highValueFans = tippers.filter(t => t.tier === 'Whale' || t.tier === 'Shark')
  // A tipper the engine has never seen before this stream, who is not yet
  // tiered. Stated as a fact ("first time you've seen them"), never as a
  // prediction that they will become a whale.
  const firstTimeFans = tippers.filter(t => !t.returning)

  // D3: what share of THIS stream's tip money came from supporters the
  // engine already knew. Computed from the session's own tip rows, so the
  // numerator and denominator are the same set — no cross-source ratio.
  const streamTipUsd = tippers.reduce((s, t) => s + t.usdThisStream, 0)
  const returningUsd = returningFans.reduce((s, t) => s + t.usdThisStream, 0)
  const returningShare = streamTipUsd > 0
    ? { pct: Math.round((returningUsd / streamTipUsd) * 100), usd: Math.round(returningUsd * 100) / 100,
        count: returningFans.length }
    : null

  const avgTipUsd = tipCount > 0 ? earningsUsd / tipCount : 0
  const standoutTip = (tipCount >= MIN_TIPS_FOR_SPREAD && avgTipUsd > 0 &&
                       largestTipUsd >= avgTipUsd * LARGE_TIP_MULTIPLE)
    ? { usd: largestTipUsd, multiple: Math.round((largestTipUsd / avgTipUsd) * 10) / 10 }
    : null

  const plan = matchPlannedWindow({ session, canonicalBestTimes, creatorTz, usdPerHour })

  return {
    id: session.id,
    platform: session.stream_platform || null,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    isInaccurate: !!session.is_inaccurate,
    resolution: session.session_resolution_type || null,
    metrics: {
      earningsUsd, tokens, tipCount, uniqueTippers, largestTipUsd,
      activeSeconds, usdPerHour, avgTipUsd: Math.round(avgTipUsd * 100) / 100,
    },
    goal,
    coaching,
    plan,
    // D5: whether CamCash changed a creator's earnings is an attribution
    // question, and the schema cannot answer it. The `tips` table carries no
    // marker separating streams run before CamCash from streams run after —
    // imported CSV history spans both indistinguishably — and there is no
    // control period, so any "CamCash helped you earn $X more" figure would
    // be an invented multiplier. The shape is here so the surface exists;
    // `available` stays false until a real before/after marker does.
    impact: { available: false, reason: 'no_baseline_marker' },
    fans: {
      returning: returningFans,
      highValue: highValueFans,
      firstTime: firstTimeFans,
      counted: tippers.length,
      returningShare,
    },
    insights: buildInsights({ earningsUsd, tokens, tipCount, activeSeconds, usdPerHour,
      goal, coaching, returningFans, highValueFans, firstTimeFans, standoutTip,
      returningShare, plan }),
  }
}

// What the room did in the window after a prompt fired. Returns the raw
// observation and nothing else — no baseline, no delta, no percentage. The
// caller must present it as "what happened next", because the data contains
// no counterfactual that would license anything stronger.
function fmtHour(h) {
  const n = ((Number(h) % 24) + 24) % 24
  const twelve = n % 12 || 12
  return `${twelve}${n < 12 ? 'AM' : 'PM'}`
}

function measureAfter(shownAt, sessionTips) {
  const t0 = shownAt ? new Date(shownAt).getTime() : NaN
  if (!Number.isFinite(t0)) return null
  const t1 = t0 + OUTCOME_WINDOW_MINUTES * 60000
  let tokens = 0, usd = 0, tips = 0
  for (const t of sessionTips || []) {
    const at = new Date(t.received_at || t.timestamp || t.date_time).getTime()
    if (!Number.isFinite(at) || at < t0 || at > t1) continue
    tokens += Number(t.tokens) || 0
    usd += Number(t.usd) || 0
    tips += 1
  }
  if (tips === 0) return null
  return { windowMinutes: OUTCOME_WINDOW_MINUTES, tokens, usd: Math.round(usd * 100) / 100, tips }
}

// D4: did this stream land in one of the creator's own planned windows, and
// how did it compare to that window's history?
//
// The planned windows ARE the canonical grid (lib/analytics/bestTimes.js) —
// the same buckets the Stream Planner renders. This does not re-derive them
// and does not invent a schedule; it looks up the day+hour the session
// actually started in and reports what the grid already says.
//
// The baseline is that bucket's own medianUsdPerHour. When the bucket does
// not exist, or is below the canonical evidence tiers, or this stream has no
// measurable hourly rate, `comparison` is null and the UI says so rather
// than printing an improvement figure.
export function matchPlannedWindow({ session, canonicalBestTimes, creatorTz = 'UTC', usdPerHour = null }) {
  const grid = canonicalBestTimes?.grid
  if (!Array.isArray(grid) || !grid.length || !session?.started_at) return null
  const startedMs = new Date(session.started_at).getTime()
  if (!Number.isFinite(startedMs)) return null

  let day, hour
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: creatorTz, weekday: 'long', hour: 'numeric', hour12: false,
    }).formatToParts(new Date(startedMs))
    day = parts.find(p => p.type === 'weekday')?.value
    hour = parseInt(parts.find(p => p.type === 'hour')?.value, 10)
  } catch (_) { return null }
  if (!day || !Number.isFinite(hour)) return null
  if (hour === 24) hour = 0

  const bucket = grid.find(g => g.localDay === day && g.localHour === hour)
  if (!bucket) return { matched: false, day, hour, comparison: null }

  // Only 'supported'/'high' buckets are treated as a plan the creator could
  // have been following — the same bar bestWindow uses. A 'promising' bucket
  // is a hint, not a plan.
  const planned = bucket.tier === 'supported' || bucket.tier === 'high'
  const baseline = Number(bucket.medianUsdPerHour)
  const canCompare = planned && usdPerHour !== null && Number.isFinite(baseline) && baseline > 0

  return {
    matched: planned,
    day, hour,
    tier: bucket.tier,
    sessionCount: bucket.sessionCount,
    baselineUsdPerHour: Number.isFinite(baseline) ? Math.round(baseline * 100) / 100 : null,
    comparison: canCompare
      ? { deltaUsdPerHour: Math.round((usdPerHour - baseline) * 100) / 100, above: usdPerHour >= baseline }
      : null,
  }
}

// Plain factual statements about what the persisted numbers say. No
// thresholds are invented to grade a stream: each insight either restates a
// measured quantity or reports a comparison the data itself makes
// (goal reached / not, tip vs this session's own average, fan known before
// or not). Nothing here produces a score or a rating.
function buildInsights({ earningsUsd, tokens, tipCount, activeSeconds, usdPerHour,
                         goal, coaching, returningFans, highValueFans, firstTimeFans, standoutTip,
                         returningShare, plan }) {
  const out = []
  const mins = Math.round(activeSeconds / 60)
  const dur = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`

  if (earningsUsd > 0 && usdPerHour !== null) {
    out.push({ kind: 'velocity',
      text: `You earned $${earningsUsd.toFixed(2)} across ${dur} of active stream time — $${usdPerHour.toFixed(2)}/hr.` })
  } else if (activeSeconds > 0 && earningsUsd === 0) {
    out.push({ kind: 'no_earnings',
      text: `No tips came in during ${dur} of active stream time.` })
  }

  if (plan?.matched) {
    const base = `You streamed during a planned ${plan.day} ${fmtHour(plan.hour)} window.`
    out.push({ kind: 'planned_window',
      text: plan.comparison
        ? `${base} That ran ${plan.comparison.above ? '$' + Math.abs(plan.comparison.deltaUsdPerHour).toFixed(2) + '/hr above' : '$' + Math.abs(plan.comparison.deltaUsdPerHour).toFixed(2) + '/hr below'} your usual $${plan.baselineUsdPerHour.toFixed(2)}/hr in that window.`
        : `${base} Not enough historical data to measure improvement yet.` })
  }

  if (returningShare && returningShare.count > 0) {
    out.push({ kind: 'returning_share',
      text: `${returningShare.count} returning supporter${returningShare.count === 1 ? '' : 's'} contributed ${returningShare.pct}% of this stream's tips ($${returningShare.usd.toFixed(2)}).` })
  }

  if (goal) {
    out.push({ kind: goal.reached ? 'goal_reached' : 'goal_missed',
      text: goal.reached
        ? `You hit your ${goal.target.toLocaleString()} token goal, finishing at ${tokens.toLocaleString()}.`
        : `You finished ${goal.earned.toLocaleString()} of your ${goal.target.toLocaleString()} token goal — ${goal.remaining.toLocaleString()} short.` })
  }

  if (standoutTip) {
    out.push({ kind: 'standout_tip',
      text: `Your largest tip was $${standoutTip.usd.toFixed(2)} — ${standoutTip.multiple}× this stream's average tip.` })
  }

  if (highValueFans.length > 0) {
    const f = highValueFans[0]
    out.push({ kind: 'high_value_fan',
      text: `${f.username} is a ${f.tier} in your history and tipped $${f.usdThisStream.toFixed(2)} this stream.` })
  }
  if (firstTimeFans.length > 0) {
    out.push({ kind: 'new_fans',
      text: `${firstTimeFans.length} tipper${firstTimeFans.length === 1 ? '' : 's'} had no prior tip history with you.` })
  }

  if (coaching.delivered > 0) {
    out.push({ kind: 'coaching',
      text: `${coaching.delivered} coaching prompt${coaching.delivered === 1 ? '' : 's'} fired — you acted on ${coaching.performed} and skipped ${coaching.skipped}.` })
  }

  if (tipCount === 0 && activeSeconds === 0) out.length = 0
  return out
}

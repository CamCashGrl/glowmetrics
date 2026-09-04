// ═══════════════════════════════════════════════════════════════════════════
// UNLOCK PROGRESS — what the Creator Report is FOR.
//
// The division of labour, stated once:
//
//   COMMAND CENTER  every actionable insight. What to do now.
//   CREATOR REPORT  what CamCash still needs to build her dashboard, and how
//                   close each thing is. No findings live here.
//
// So this module answers one question per locked capability: what is missing,
// how much of it does she already have, and what appears when it lands. When
// something unlocks it DROPS OUT of this list — the report gets shorter as she
// imports, which is the whole feedback loop. The unlock itself is then
// announced in the Command Center (see newlyUnlocked()), because an unlocked
// insight is an insight, and insights live there.
//
// It COMPUTES NOTHING. Every requirement, count and percentage is read from
// computeIntelligence()'s per-insight nextMilestone ({have, need, pct}),
// which derives from the engine's own thresholds. This file must never
// contain a number.
// ═══════════════════════════════════════════════════════════════════════════

import { rank, CLAIMABLE_FLOOR } from './intelligence/states'

// The capabilities the report tracks, in the order a creator earns them.
// `promise` is what she gets when it unlocks — stated as the thing itself,
// never as an outcome ("your peak earning window", not "more money").
const TRACKED = [
  { id: 'peak_window',    title: 'Peak streaming patterns', promise: 'The day-and-hour window your earnings actually cluster in.' },
  { id: 'hourly_rate',    title: 'Earnings efficiency',     promise: 'What an hour of streaming is really worth to you.' },
  { id: 'top_supporters', title: 'Top supporters',          promise: 'Which fans carry your income, ranked by what they have actually given.' },
  { id: 'fan_behaviour', title: 'Fan tipping patterns',    promise: 'How often each supporter tips, and the hour they usually show up.' },
  { id: 'churn_risk',     title: 'Fans going quiet',        promise: 'Which supporters have slipped past their usual return window.' },
  { id: 'cross_platform', title: 'Platform comparison',     promise: 'Which platform pays you best per hour streamed.' },
  { id: 'money_map',      title: 'Money Map depth',         promise: 'Your full day-by-hour earnings grid.' },
]

/**
 * Locked capabilities, each with its progress. Unlocked ones are absent.
 *
 * @param {Object} intelligence - computeIntelligence() output
 * @returns {Array<{id,title,promise,state,label,remaining,have,need,pct}>}
 */
export function lockedCapabilities(intelligence) {
  const insights = intelligence?.insights || {}
  const out = []

  for (const t of TRACKED) {
    const insight = insights[t.id]
    if (!insight) continue
    // At or above the claimable floor it is no longer "locked" — it belongs in
    // the Command Center, not on the progress list.
    if (rank(insight.state) >= rank(CLAIMABLE_FLOOR)) continue

    const m = insight.nextMilestone || null
    out.push({
      id: t.id,
      title: t.title,
      promise: t.promise,
      state: insight.state,
      label: m?.label || null,
      remaining: m?.remaining ?? null,
      have: m?.have ?? null,
      need: m?.need ?? null,
      // No milestone means the engine cannot name a step yet; show the bar
      // empty rather than guessing a denominator.
      pct: m?.pct ?? 0,
    })
  }

  // Closest to unlocking first — that is the one worth her next import.
  return out.sort((a, b) => (b.pct || 0) - (a.pct || 0))
}

/**
 * Per-platform import progress. Reads the SAME canonical platform entries and
 * confidence labels the rest of the dashboard uses; "comparable" is read from
 * rankablePlatforms rather than re-derived.
 *
 * @param {Object} analytics - aggregateRows() output
 * @param {string[]|null} streamingPlatforms - roster she named in onboarding
 */
export function platformProgress(analytics, streamingPlatforms = null) {
  const entries = (analytics?.platforms || [])
    .filter(p => p.platform && p.platform.toLowerCase() !== 'unknown')
  const rankable = new Set((analytics?.rankablePlatforms || []).map(p => p.platform))
  const byName = new Map(entries.map(p => [p.platform.toLowerCase(), p]))

  // Every platform she said she streams on, plus anything she imported that
  // she did not mention. Nothing is dropped.
  const names = [...new Set([
    ...(Array.isArray(streamingPlatforms) ? streamingPlatforms : []),
    ...entries.map(p => p.platform),
  ])].filter(Boolean)

  return names.map(name => {
    const p = byName.get(String(name).toLowerCase()) || null
    return {
      platform: name,
      imported: !!p,
      tips: p?.tips ?? 0,
      sessions: p?.sessions ?? 0,
      hours: p?.hours ?? 0,
      totalUSD: p?.totalUSD ?? 0,
      confidenceLabel: p?.confidenceLabel ?? null,
      comparable: p ? rankable.has(p.platform) : false,
    }
  })
}

/**
 * Capabilities that have crossed the floor since the snapshot the dashboard
 * last showed her. These are what the Command Center announces — "we just
 * uncovered ..." — and what disappears from the Creator Report.
 *
 * Reads the diff the intelligence API already computes; it does not compare
 * anything itself.
 *
 * @param {Object} changed - diffSnapshots() output, as served by /api/intelligence
 */
export function newlyUnlocked(changed) {
  const titleFor = (id) => TRACKED.find(t => t.id === id)?.title || null
  // `isDiscovery` is the engine's own answer to "is this a finding or just
  // bookkeeping" — it already excludes FACT insights, so importing any file
  // at all cannot trigger a celebration. Trusting it here rather than
  // re-deciding keeps one definition of an unlock in the codebase.
  return (changed?.improved || [])
    .filter(p => p.isDiscovery)
    .map(p => ({ id: p.id, title: titleFor(p.id) || p.label, from: p.from, to: p.to }))
    .filter(p => p.title)
}

export { TRACKED as TRACKED_CAPABILITIES }

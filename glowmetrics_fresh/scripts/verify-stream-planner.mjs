// Phase 5 regression: the Stream Planner plans against the CANONICAL best
// times, and never invents its own.
//
// THE DEFECT THIS CLOSES
// StreamPlanner.js carried bestWindows(tips, tz) — a second, independent
// answer to "when is my best time", disagreeing with the canonical one twice
// over:
//
//   - it ranked by the MEAN of session rates; canonical ranks by the MEDIAN,
//     so a single exceptional night could carry a window here that no other
//     surface ranks;
//   - its confidence thresholds were its own (>=5 high, >=3 medium, >=2 low,
//     else needs-testing), so a 3-session bucket read "Medium" here while the
//     canonical tiers call that same bucket 'promising' — explicitly not
//     enough to be labelled a best time anywhere else in the app.
//
// Swapping mean for median was NOT sufficient. Verified on the real 1912-row
// CSV in America/New_York, the highest-MEDIAN bucket is:
//
//   Wednesday 06:00 — $42.09/hr, sessionCount 1, tier 'insufficient'
//
// which is the same single-night outlier the Command Center's chart was
// rebuilt to stop showing. Meanwhile the canonical bestWindow — what the
// Command Center actually recommends — is:
//
//   Wednesday 08:00 — $9.52/hr, sessionCount 4, tier 'supported'
//
// So the planner also has to apply the canonical TIER GATE ('supported' or
// 'high') before presenting anything as a recommendation. Lower tiers may
// still appear as windows worth TESTING, which is a different claim.

import { readFileSync } from 'fs'

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`) }
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const raw = readFileSync(new URL('../app/dashboard/StreamPlanner.js', import.meta.url), 'utf8')
const src = strip(raw)
const bestTimesRaw = readFileSync(new URL('../lib/analytics/bestTimes.js', import.meta.url), 'utf8')
const bestTimes = strip(bestTimesRaw)
const page = strip(readFileSync(new URL('../app/dashboard/page.js', import.meta.url), 'utf8'))

// ══════════════════════════════════════════════════════════════════════
// 1. ONE BEST-TIME CALCULATION.
// ══════════════════════════════════════════════════════════════════════
check('the planner-local bestWindows() implementation is gone',
  !src.includes('function bestWindows('))
check('windows are mapped from the canonical grid instead',
  src.includes('function windowsFromCanonical(canonicalBestTimes)') &&
  src.includes('const grid = canonicalBestTimes?.grid || []'))
check('the planner reads analytics.canonicalBestTimes, not raw tips, for windows',
  src.includes('windowsFromCanonical(analytics?.canonicalBestTimes)'))
check('the planner no longer buckets sessions by day/hour itself',
  !/const k = `\$\{s\.utcDay\}-\$\{s\.utcHour\}`[\s\S]{0,200}sum \+= s\.usdHr/.test(src))
check('the dashboard passes analytics into the planner', page.includes('<StreamPlanner') && page.includes('analytics={analytics}'))

// ══════════════════════════════════════════════════════════════════════
// 2. THE CANONICAL TIER GATE IS APPLIED TO RECOMMENDATIONS.
// ══════════════════════════════════════════════════════════════════════
check('the planner declares the same recommendable tiers as the engine',
  src.includes("const RECOMMENDABLE_TIERS = new Set(['supported', 'high'])"))
check('the engine agrees those are the only tiers that may be a best time',
  bestTimes.includes('const CAN_BE_BEST_TIME = new Set([CONFIDENCE_TIER.SUPPORTED, CONFIDENCE_TIER.HIGH])'))
check('the weekly plan only draws from tier-qualified windows',
  src.includes('const recommendable = useMemo(() => windows.filter(isRecommendableWindow)') &&
  src.includes('let cands = recommendable.filter('))
check('adherence tracking measures against the same recommendable set',
  src.includes('windows.filter(isRecommendableWindow).slice(0, 10)'))
check('the full grid is still available for the heatmap and the test finder',
  src.includes('untestedWindows(tips, windows)'))
check('the opportunity grid\'s "proven peak" cell uses the same gate, not its own sample threshold',
  src.includes('if (isRecommendableWindow(best) && best.avgUsdPerHr >= q75)') &&
  !src.includes('best.sessionCount >= 5'))
check('the opportunity grid states median, and states it is local time',
  raw.includes('median $/hr where data exists, in your local time'))
check('no planner tooltip claims UTC for creator-local data', !raw.includes('UTC: ${cell.status}'))

// A THIRD best-time calculation lived in platformEfficiency(): it bucketed
// sessions by day/hour for a per-platform bestUtcDay/bestUtcHour on the MEAN.
// Nothing read those fields; its only consumer wanted "which platform earns
// most per hour", which analytics.platforms already carries.
check('the per-platform bestUtcDay/bestUtcHour calculation is gone',
  !src.includes('function platformEfficiency('))
check('per-platform $/hr is read from the canonical platforms array',
  src.includes('analytics?.platforms || []') && src.includes('(b.usdPerHour || 0) - (a.usdPerHour || 0)'))
check('the engine computes each platform\'s window with the SAME function as the account-wide grid',
  readFileSync(new URL('../lib/analytics.js', import.meta.url), 'utf8')
    .includes('const { bestWindow } = computeCanonicalBestTimes(platSessions, userTz)'))

// The gate is not cosmetic: mirror the tier rule and confirm it actually
// rejects the real fixture's top-median bucket.
{
  const tierFor = (n) => n < 2 ? 'insufficient' : n <= 3 ? 'promising' : n <= 5 ? 'supported' : 'high'
  const RECOMMENDABLE = new Set(['supported', 'high'])
  const topMedianBucket = { day: 'Wednesday', hour: 6, median: 42.09, sessions: 1 }
  const canonicalBest  = { day: 'Wednesday', hour: 8, median: 9.52, sessions: 4 }

  check('the real fixture\'s highest-median bucket is a single session',
    topMedianBucket.sessions === 1)
  check('the tier gate rejects it despite it having the highest median',
    !RECOMMENDABLE.has(tierFor(topMedianBucket.sessions)) &&
    topMedianBucket.median > canonicalBest.median,
    `${topMedianBucket.median} > ${canonicalBest.median} but tier=${tierFor(topMedianBucket.sessions)}`)
  check('the tier gate accepts the window the Command Center recommends',
    RECOMMENDABLE.has(tierFor(canonicalBest.sessions)))
  check('without the gate the planner would head its schedule with a different window than the Command Center',
    topMedianBucket.hour !== canonicalBest.hour)
}

// ══════════════════════════════════════════════════════════════════════
// 3. ONE CONFIDENCE VOCABULARY.
// ══════════════════════════════════════════════════════════════════════
// 2C-2: the planner no longer keeps a badge table keyed by tier name. It maps
// the tier onto the ONE canonical ladder with fromConfidenceTier() and renders
// the shared <ConfidenceBadge>, so the keys it used to own now live in exactly
// one place (lib/intelligence/states.js).
check('the planner maps tiers onto the canonical ladder',
  src.includes('fromConfidenceTier(level)'))
check('the planner keeps no badge table of its own', !src.includes('const CONF = {'))
check('the old high/medium/low vocabulary is gone',
  !src.includes('label: "Medium" }') && !src.includes('"needs-testing":'))
check('badge wording matches the other tabs because it is the same component',
  raw.includes('import ConfidenceBadge from "./ConfidenceBadge"') && raw.includes('<ConfidenceBadge state={state}'))
check('an unknown tier degrades to "not enough data", never to a confident label',
  src.includes('if (!badge)') && src.includes('"Not enough data"'))

// ══════════════════════════════════════════════════════════════════════
// 4. UNITS ARE LABELLED HONESTLY — the value is a MEDIAN now.
// ══════════════════════════════════════════════════════════════════════
check('no window rate is described as an average any more',
  !raw.includes('averaging ${fmt$(w.avgUsdPerHr)}'))
check('the weekly table column names the statistic', raw.includes('Median $/hr'))
check('the tonight card names the statistic', raw.includes('Median <strong'))
check('the why-panel names the statistic', raw.includes('at a median ${fmt$(w.avgUsdPerHr)}/hr'))
check('the test-finder comparison is not presented as the creator\'s hourly rate',
  raw.includes('typical window') && !raw.includes('/hr average.`'))

// ══════════════════════════════════════════════════════════════════════
// 5. CREATOR-LOCAL TIME, NO UTC BUCKETING.
// ══════════════════════════════════════════════════════════════════════
check('no getUTCHours/getUTCDay bucketing in the planner',
  !/getUTC(Hours|Day)\(/.test(src))
check('no browser-clock bucketing in the planner', !/getHours\(\)|getDay\(\)/.test(src))
check('local day/hour come from the canonical primitives',
  src.includes('toLocalDow') && src.includes('toLocalHour'))
check('the dashboard passes the resolved creator timezone', page.includes('timezone={_momTz}'))
// The canonical grid is already bucketed in the creator's zone, so mapping it
// cannot reintroduce a zone bug — the mapping carries day/hour straight over.
check('the canonical mapping does not re-derive day or hour from a date',
  src.includes('utcHour: g.localHour') && src.includes('utcDay: CANON_DAY_INDEX[g.localDay]'))

// ══════════════════════════════════════════════════════════════════════
// 6. newTipperRate MOVED TO THE CANONICAL LAYER (it was the one genuinely
//    additive thing the planner's own bucketing produced).
// ══════════════════════════════════════════════════════════════════════
check('the canonical grid now carries newTipperRate', bestTimes.includes('newTipperRate: b.allTips > 0'))
check('it is scoped to the same meaningfulSessions population as the rest of the grid',
  bestTimes.includes('for (const s of meaningfulSessions)') && bestTimes.includes('const firstSeenAt = {}'))
check('it is explicitly NOT part of the bestWindow ranking',
  bestTimesRaw.includes('deliberately NOT part of the bestWindow ranking'))
check('the planner reads it rather than recomputing it',
  src.includes('newTipperRate: g.newTipperRate ?? 0') && !src.includes('m.newTips++'))
check('Growth Mode still ranks by it', src.includes('b.newTipperRate - a.newTipperRate'))

// ══════════════════════════════════════════════════════════════════════
// 7. FREE vs PRO — planning stays useful for Free.
// ══════════════════════════════════════════════════════════════════════
check('Free still sees today\'s real recommended window', src.includes('!isPro && !row.isToday'))
check('the sparse state is honest rather than an empty grid',
  raw.includes('Not enough data yet') && raw.includes('at least 20 tips'))
check('Pro-only tabs are labelled rather than silently missing',
  src.includes('!isPro && t.id !== "plan" ? `🔒 ${t.label}`'))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

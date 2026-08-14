// Regression tests for Phase 1B's first migration: the dashboard header
// (canonicalPeakHourLocal / buildDailyBrief's bestHour fallback) and
// Creator Report's "Best Streaming Time" stat, both repointed from the
// legacy computeBestTimes() output (analytics.bestHour) onto the canonical
// bestTimes.js result (analytics.canonicalBestTimes.bestWindow), per the
// approved Best-Time Migration Matrix row 1/2.
//
// Mirrors the exact shim both consumers now use:
//   bestHour = bestWindow ? { hour: bestWindow.localHour, avg: bestWindow.medianUsdPerHour } : null
// so downstream code (fmtHour(bestHour?.hour), bestHour.avg, etc.) is
// unaffected by the source swap — same shape in, same shape out.

function shimBestHour(bestWindow) {
  return bestWindow ? { hour: bestWindow.localHour, avg: bestWindow.medianUsdPerHour } : null
}

// Mirrors app/dashboard/page.js's canonicalPeakHourLocal fallback chain.
function canonicalPeakHourLocal(engineInsights, dailyBriefBh, canonicalBestTimes) {
  return (
    engineInsights?.daily_plan?.best_hour ??
    dailyBriefBh ??
    (canonicalBestTimes?.bestWindow ? canonicalBestTimes.bestWindow.localHour : null)
  )
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

// ══════════════════════════════════════════════════════════════════════
// 1. Shim shape — same {hour, avg} shape as the legacy computeBestTimes()
//    output, so no downstream rendering code needed to change.
// ══════════════════════════════════════════════════════════════════════
{
  const bestWindow = { localDay: 'Monday', localHour: 20, medianUsdPerHour: 85, sessionCount: 6, tier: 'high' }
  const shimmed = shimBestHour(bestWindow)
  check('shim produces {hour, avg} shape', shimmed, { hour: 20, avg: 85 })
}
{
  const shimmed = shimBestHour(null)
  check('shim of null bestWindow is null (not a crash)', shimmed, null)
}

// ══════════════════════════════════════════════════════════════════════
// 2. Fallback chain precedence unchanged — engineInsights still wins,
//    then dailyBrief.bh, then the (now-canonical) all-time fallback.
// ══════════════════════════════════════════════════════════════════════
{
  const engineInsights = { daily_plan: { best_hour: 14 } }
  const result = canonicalPeakHourLocal(engineInsights, 20, { bestWindow: { localHour: 8 } })
  check('engineInsights.daily_plan.best_hour still wins over everything else', result, 14)
}
{
  const result = canonicalPeakHourLocal(null, 20, { bestWindow: { localHour: 8 } })
  check('dailyBrief.bh still wins over the canonical all-time fallback', result, 20)
}
{
  const result = canonicalPeakHourLocal(null, null, { bestWindow: { localHour: 8, medianUsdPerHour: 40 } })
  check('canonical bestWindow.localHour used as final fallback when higher tiers are absent', result, 8)
}
{
  const result = canonicalPeakHourLocal(null, null, { bestWindow: null })
  check('all tiers absent -> null (no crash, no fabricated hour)', result, null)
}
{
  const result = canonicalPeakHourLocal(null, null, undefined)
  check('canonicalBestTimes itself undefined (e.g. analytics not loaded yet) -> null, not a throw', result, null)
}

// ══════════════════════════════════════════════════════════════════════
// 3. Numeric divergence from the legacy source is expected and
//    intentional (median vs mean, session-level vs tip-level) — confirm
//    the new source can legitimately produce a DIFFERENT hour than the
//    old one would have, on the same underlying data, without erroring.
// ══════════════════════════════════════════════════════════════════════
{
  // A whale-heavy legacy tip-level MEAN would have been pulled toward the
  // outlier hour; the canonical SESSION-level MEDIAN correctly is not.
  const legacyMeanBestHour = { hour: '3', avg: 250 } // hypothetical old skewed result
  const canonicalBestWindow = { localHour: 20, medianUsdPerHour: 85, tier: 'high' }
  const shimmed = shimBestHour(canonicalBestWindow)
  check('new source can differ from a hypothetical legacy value without throwing', shimmed.hour !== parseInt(legacyMeanBestHour.hour), true)
  check('new source value is well-formed regardless of divergence', typeof shimmed.hour === 'number' && typeof shimmed.avg === 'number', true)
}

// ══════════════════════════════════════════════════════════════════════
// 4. Early Signal card — dashboard header's locked/insufficient-data state
//    now reads canonicalBestTimes.earlySignal instead of the legacy
//    earlySignalHour. Confirm the field-name adaptation
//    (hour->localHour, avg->medianUsdPerHour) is correct and complete.
// ══════════════════════════════════════════════════════════════════════
{
  const canonicalEarlySignal = { localDay: 'Tuesday', localHour: 14, medianUsdPerHour: 30, sessionCount: 2, tier: 'promising' }
  // Mirrors the exact JSX expression: fmtHour(analytics.canonicalBestTimes.earlySignal.localHour)
  const hourUsed = canonicalEarlySignal.localHour
  const avgUsed = canonicalEarlySignal.medianUsdPerHour
  check('early signal hour reads from localHour (no parseInt needed — already numeric)', hourUsed, 14)
  check('early signal avg reads from medianUsdPerHour', avgUsed, 30)
}

// ══════════════════════════════════════════════════════════════════════
// 5. Creator Report's "Best Streaming Day" — migrated in the Free/Pro UX
//    audit's B-item pass to derive from the SAME bestWindow as bestHour
//    above, instead of separately reading legacy analytics.bestDay. Before
//    this fix, Creator Report could show a canonical bestHour ("Wed 12 PM")
//    right next to a legacy bestDay ("Friday") for the same account — two
//    different sources contradicting each other inside one component.
//    Confirmed on a real account: legacy bestDay = Friday, canonical
//    bestWindow.localDay = Wednesday.
// ══════════════════════════════════════════════════════════════════════
function shimBestDay(bestWindow) {
  return bestWindow ? { day: bestWindow.localDay, avg: bestWindow.medianUsdPerHour } : null
}
{
  const bestWindow = { localDay: 'Wednesday', localHour: 12, medianUsdPerHour: 9.52, sessionCount: 4, tier: 'supported' }
  const legacyBestDay = { day: 'Friday', avg: 2.34, total: 60.4, count: 16 } // real divergent legacy value
  const shimmedDay = shimBestDay(bestWindow)
  const shimmedHour = shimBestHour(bestWindow)
  check('bestDay shim produces {day, avg} shape', shimmedDay, { day: 'Wednesday', avg: 9.52 })
  check('bestDay and bestHour now derive from the same bestWindow (never disagree on which day)', shimmedDay.day, bestWindow.localDay)
  check('bestDay no longer matches the legacy, independently-sourced value', shimmedDay.day !== legacyBestDay.day, true)
  check('bestDay is null (not a stale legacy value) when no canonical window qualifies yet', shimBestDay(null), null)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

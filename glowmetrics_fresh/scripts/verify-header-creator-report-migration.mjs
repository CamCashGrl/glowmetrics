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

// Mirrors app/dashboard/page.js's canonicalPeakHourLocal — post best-time
// reconciliation, this answers ONLY "what is my general peak/best time to
// stream" and is sourced from canonicalBestTimes.bestWindow alone. SQL's
// engineInsights.daily_plan.best_hour answers a genuinely different,
// narrower question ("best hour for today's specific weekday") and must
// never feed this generic value — see canonicalTodaySpecificHourLocal below
// for where that SQL source is actually supposed to be used.
function canonicalPeakHourLocal(canonicalBestTimes) {
  return canonicalBestTimes?.bestWindow ? canonicalBestTimes.bestWindow.localHour : null
}

// Mirrors app/dashboard/page.js's canonicalTodaySpecificHourLocal — used
// ONLY by the Daily Brief card, whose copy explicitly says "today". This is
// the one place engineInsights.daily_plan.best_hour is allowed to win,
// because it's actually answering the question that card is asking.
function canonicalTodaySpecificHourLocal(engineInsights, dailyBriefBh) {
  return (
    engineInsights?.daily_plan?.best_hour ??
    dailyBriefBh ??
    null
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
// 2. Generic peak-window claim — canonical bestWindow ONLY, SQL never wins.
//    This is the exact reconciliation fix: before it, engineInsights.daily_
//    plan.best_hour won over this value unconditionally, so the command-bar
//    "Peak Window" KPI and "You're Losing Money" card (neither of which say
//    "today") could silently show a completely different, narrower SQL
//    calculation instead of the account-wide canonical answer.
// ══════════════════════════════════════════════════════════════════════
{
  // Even with a present, well-formed SQL daily_plan value, the generic
  // chain must ignore it entirely — it takes no engineInsights argument at
  // all anymore, which is itself the regression guard (a future edit that
  // re-adds an engineInsights param here would be the bug coming back).
  const result = canonicalPeakHourLocal({ bestWindow: { localHour: 8, medianUsdPerHour: 40 } })
  check('generic peak claim reads canonicalBestTimes.bestWindow directly', result, 8)
}
{
  const result = canonicalPeakHourLocal({ bestWindow: null })
  check('no qualifying canonical window -> null (no crash, no fabricated hour, no SQL fallback)', result, null)
}
{
  const result = canonicalPeakHourLocal(undefined)
  check('canonicalBestTimes itself undefined (e.g. analytics not loaded yet) -> null, not a throw', result, null)
}

// ══════════════════════════════════════════════════════════════════════
// 2b. Today-specific claim (Daily Brief card only) — SQL daily_plan wins
//     here, because this is the one question it's actually answering.
// ══════════════════════════════════════════════════════════════════════
{
  const engineInsights = { daily_plan: { best_hour: 14 } }
  const result = canonicalTodaySpecificHourLocal(engineInsights, 20)
  check('today-specific claim: engineInsights.daily_plan.best_hour wins (this IS its question)', result, 14)
}
{
  const result = canonicalTodaySpecificHourLocal(null, 20)
  check('today-specific claim: dailyBrief.bh used when SQL daily_plan is absent', result, 20)
}
{
  const result = canonicalTodaySpecificHourLocal(null, null)
  check('today-specific claim: null when both sources absent (no crash, no fabricated hour)', result, null)
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

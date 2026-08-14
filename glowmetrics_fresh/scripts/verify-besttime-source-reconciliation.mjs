// Regression tests for the full best-time source reconciliation pass:
// every generic ("your peak/best time", no day-of-week framing) consumer
// in the repo must read canonicalBestTimes.bestWindow, and ONLY the Daily
// Brief card (whose copy explicitly says "today") may read the SQL
// get_user_insights engine's daily_plan.best_hour. This file covers the
// consumers verify-header-creator-report-migration.mjs doesn't already
// cover: buildDailyBrief's isBestDay check, the Title Generator's buildCtx
// peak chips, and Live Mode's bestTimes.

let pass = 0, fail = 0
function check(name, cond) { if (cond) { pass++; console.log(`PASS  ${name}`) } else { fail++; console.log(`FAIL  ${name}`) } }

// ══════════════════════════════════════════════════════════════════════
// 1. buildDailyBrief's isBestDay — mirrors app/dashboard/page.js's fix:
//    both bestDay and bh (the hour half of the same card) must now derive
//    from the SAME canonicalBestTimes.bestWindow, so the card's hour claim
//    and its "🏆 Your best day" badge can never disagree about which day.
// ══════════════════════════════════════════════════════════════════════
function computeIsBestDay(canonicalBestTimes, todayName) {
  const bestDay = canonicalBestTimes?.bestWindow
    ? { day: canonicalBestTimes.bestWindow.localDay, avg: canonicalBestTimes.bestWindow.medianUsdPerHour }
    : null
  return bestDay?.day === todayName
}
{
  const canonicalBestTimes = { bestWindow: { localDay: 'Wednesday', localHour: 12, medianUsdPerHour: 9.52 } }
  check('isBestDay is true when today matches the canonical window\'s day', computeIsBestDay(canonicalBestTimes, 'Wednesday') === true)
  check('isBestDay is false on a different day, using the SAME source as the hour claim', computeIsBestDay(canonicalBestTimes, 'Friday') === false)
  // The exact real-account regression case: legacy analytics.bestDay said
  // "Friday" — if isBestDay had still read that legacy field while the
  // card's hour claim read the canonical Wednesday window, a Wednesday
  // visit would show the canonical hour with no "best day" badge, and a
  // Friday visit would show the wrong hour WITH a "best day" badge.
  check('no qualifying canonical window -> isBestDay is false, not a stale legacy badge', computeIsBestDay({ bestWindow: null }, 'Friday') === false)
}

// ══════════════════════════════════════════════════════════════════════
// 2. Title Generator's buildCtx "Peak NOW"/"Peak in Xh" chips — generic
//    claim, must read canonicalBestTimes.bestWindow only, with no second
//    hand-rolled mean-based fallback computed from `sessions`.
// ══════════════════════════════════════════════════════════════════════
function computeBuildCtxBestHour(canonicalBestTimes) {
  return canonicalBestTimes?.bestWindow ? canonicalBestTimes.bestWindow.localHour : null
}
{
  const canonicalBestTimes = { bestWindow: { localDay: 'Wednesday', localHour: 12, medianUsdPerHour: 9.52 } }
  check('buildCtx reads canonicalBestTimes.bestWindow.localHour directly', computeBuildCtxBestHour(canonicalBestTimes) === 12)
  check('no qualifying window -> null, not a fabricated hour from a local mean fallback', computeBuildCtxBestHour({ bestWindow: null }) === null)
}

// ══════════════════════════════════════════════════════════════════════
// 3. Live Mode's bestTimes — migrated from the legacy tip-level-mean
//    computeBestTimes() to computeCanonicalBestTimes() applied to this
//    page's own 90-day session window. The WINDOW stays intentionally
//    different (documented, legitimate — a "personal best from recent
//    memory"); only the FORMULA needed to match the rest of the app.
// ══════════════════════════════════════════════════════════════════════
function shimLiveBestTimes(bestWindow) {
  return {
    bestHour: bestWindow ? { hour: bestWindow.localHour, avg: bestWindow.medianUsdPerHour } : null,
    bestDay: bestWindow ? { day: bestWindow.localDay, avg: bestWindow.medianUsdPerHour } : null,
  }
}
{
  const bestWindow = { localDay: 'Wednesday', localHour: 12, medianUsdPerHour: 9.52, sessionCount: 4, tier: 'supported' }
  const shimmed = shimLiveBestTimes(bestWindow)
  check('Live Mode bestTimes.bestHour shimmed to {hour, avg} — same shape peakHourData already expects', shimmed.bestHour.hour === 12 && shimmed.bestHour.avg === 9.52)
  check('Live Mode bestTimes.bestDay present too (day×hour bucket carries both)', shimmed.bestDay.day === 'Wednesday')
}
{
  const shimmed = shimLiveBestTimes(null)
  check('Live Mode: no qualifying window -> both null, not a crash', shimmed.bestHour === null && shimmed.bestDay === null)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

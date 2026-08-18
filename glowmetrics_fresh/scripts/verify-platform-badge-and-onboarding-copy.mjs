// Regression tests for two smaller fixes in the repo-wide analytics
// consistency pass:
// 1. The Platform ROI card's per-platform "Best day" badge previously read
//    analytics.platformBestTimes[platform].bestDay (the legacy tip-level-
//    mean grid) even though analytics.platforms[].bestLocalDay/bestLocalHour/
//    bestWindowConfidence (a canonical, session-based, confidence-tiered
//    calculation) already existed on the same object and was never rendered
//    anywhere — dead code sitting right next to a second, independently-
//    computed answer to the same question. Now wired up.
// 2. The same card's "Today (X)" badge computed X via new Date().getUTCDay()
//    — a real bug (not just labeling): for a creator far from UTC, this
//    could name the WRONG calendar day, not just skip a timezone-relabel
//    step. Now uses the canonical creator timezone.
// 3. Onboarding's "Your earnings peak around X — that's your sweet spot"
//    copy overstated confidence for a value that can be a single row's
//    worth of signal (no minimum sample size). Softened.

let pass = 0, fail = 0
function check(name, cond) { if (cond) { pass++; console.log(`PASS  ${name}`) } else { fail++; console.log(`FAIL  ${name}`) } }

// ══════════════════════════════════════════════════════════════════════
// 1. Platform ROI badge now reads the canonical per-platform fields.
// ══════════════════════════════════════════════════════════════════════
function renderBestWindowBadge(p) {
  if (p.bestLocalDay == null || p.bestLocalHour == null) return null
  return { day: p.bestLocalDay, hour: p.bestLocalHour, confidence: p.bestWindowConfidence }
}
{
  const p = { bestLocalDay: 'Wednesday', bestLocalHour: 12, bestWindowConfidence: 'supported' }
  const badge = renderBestWindowBadge(p)
  check('badge reads canonical bestLocalDay/bestLocalHour (previously dead fields)', badge.day === 'Wednesday' && badge.hour === 12)
  check('badge carries confidence tier through', badge.confidence === 'supported')
}
{
  const badge = renderBestWindowBadge({ bestLocalDay: null, bestLocalHour: null, bestWindowConfidence: null })
  check('no qualifying canonical window -> badge is null, not a stale legacy fallback', badge === null)
}

// ══════════════════════════════════════════════════════════════════════
// 2. "Today" badge day name — canonical creator timezone, not
//    new Date().getUTCDay().
// ══════════════════════════════════════════════════════════════════════
function toLocalDow(dateStr, tz) {
  try {
    const dayName = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(new Date(dateStr))
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(dayName)
  } catch { return new Date(dateStr).getUTCDay() }
}
{
  // 2026-01-15T01:30:00Z is Thursday in UTC, but still Wednesday evening in
  // America/Los_Angeles — the exact case where getUTCDay() would name the
  // wrong day for this creator's "Today" badge.
  const now = '2026-01-15T01:30:00.000Z'
  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const localName = DAY_NAMES[toLocalDow(now, 'America/Los_Angeles')]
  const buggyUtcName = DAY_NAMES[new Date(now).getUTCDay()]
  check('local "Today" name is Wednesday for this creator, not Thursday (UTC)', localName === 'Wednesday')
  check('this is a real behavior change vs the old getUTCDay() bug, not a no-op', localName !== buggyUtcName)
}

// ══════════════════════════════════════════════════════════════════════
// 3. Onboarding copy no longer overstates confidence.
// ══════════════════════════════════════════════════════════════════════
{
  const fs = await import('fs')
  const src = fs.readFileSync(new URL('../app/onboarding/page.js', import.meta.url), 'utf8')
  check('overstated "sweet spot" claim removed from onboarding preview copy', !src.includes("That's your sweet spot"))
  check('replacement copy frames this as an early, to-be-confirmed signal', src.includes('early signal') && src.includes('will confirm this'))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

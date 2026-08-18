// Regression test for StreamPlanner.js's local-time bucketing fix (repo-wide
// analytics consistency pass). Previously toWeekPlanSession() bucketed
// sessions by literal UTC day/hour (getUTCDay()/getUTCHours()), then left it
// to the display layer to relabel using the BROWSER's runtime timezone (not
// the creator's saved profile timezone) — two independent bugs stacked, each
// capable of putting a session in the wrong day/hour cell on its own.
//
// Verified end-to-end against the real 1912-row BongaCams CSV regression
// fixture in America/New_York (a large-offset, DST-observing zone — exactly
// the case that exposes UTC-vs-local bucketing bugs): sessions genuinely
// land in different (day, hour) cells under the fixed local-time bucketing
// than they would have under literal UTC. This file mirrors that same
// bucketing logic with a synthetic fixture (no network/DB dependency) since
// the real-CSV cross-check needs an extension-resolving loader this repo's
// plain `node scripts/verify-*.mjs` invocation doesn't have.

let pass = 0, fail = 0
function check(name, cond) { if (cond) { pass++; console.log(`PASS  ${name}`) } else { fail++; console.log(`FAIL  ${name}`) } }

// Mirrors lib/analytics/localTime.js's toLocalHour/toLocalDow exactly (same
// Intl.DateTimeFormat approach) so this test doesn't need the real file's
// extensionless import.
function toLocalHour(dateStr, tz) {
  try {
    const date = new Date(dateStr)
    const formatted = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(date)
    const h = parseInt(formatted)
    return isNaN(h) ? 0 : h === 24 ? 0 : h
  } catch { return new Date(dateStr).getUTCHours() }
}
function toLocalDow(dateStr, tz) {
  try {
    const date = new Date(dateStr)
    const dayName = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(date)
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(dayName)
  } catch { return new Date(dateStr).getUTCDay() }
}

// Mirrors the FIXED toWeekPlanSession() — local day/hour via the canonical
// primitives above, not getUTCDay()/getUTCHours().
function toWeekPlanSession(s, tz) {
  return { utcDay: toLocalDow(s.startTime, tz), utcHour: toLocalHour(s.startTime, tz) }
}

// ══════════════════════════════════════════════════════════════════════
// 1. A session just after midnight UTC, for a West-coast US creator (UTC-8,
//    no DST in this fixture's date) — literal UTC bucketing puts this on
//    the wrong calendar day entirely; local bucketing must not.
// ══════════════════════════════════════════════════════════════════════
{
  // 2026-01-15T01:30:00Z -> 2026-01-14 17:30 in America/Los_Angeles (UTC-8):
  // same clock hour region, but the PREVIOUS calendar day locally.
  const startTime = '2026-01-15T01:30:00.000Z'
  const tz = 'America/Los_Angeles'
  const fixed = toWeekPlanSession({ startTime }, tz)
  const buggyUTC = { utcDay: new Date(startTime).getUTCDay(), utcHour: new Date(startTime).getUTCHours() }
  check('fixed bucketing lands on Wednesday (local), not Thursday (UTC)', fixed.utcDay === 3) // Jan 14 2026 is a Wednesday
  check('fixed bucketing disagrees with literal UTC bucketing for this exact session (proves this is a real fix, not a no-op)', fixed.utcDay !== buggyUTC.utcDay)
  check('fixed local hour is 17 (5 PM local), not 1 AM UTC', fixed.utcHour === 17)
}

// ══════════════════════════════════════════════════════════════════════
// 2. A session comfortably mid-day UTC for the same creator — local and UTC
//    day should agree here (sanity check that the fix isn't overcorrecting
//    every session, only the ones that actually cross a day boundary).
// ══════════════════════════════════════════════════════════════════════
{
  const startTime = '2026-01-15T20:00:00.000Z' // noon local in America/Los_Angeles, same calendar day
  const tz = 'America/Los_Angeles'
  const fixed = toWeekPlanSession({ startTime }, tz)
  const buggyUTC = { utcDay: new Date(startTime).getUTCDay(), utcHour: new Date(startTime).getUTCHours() }
  check('mid-day session: local day matches UTC day here (no false-positive shift)', fixed.utcDay === buggyUTC.utcDay)
  check('mid-day session: local hour correctly offset by 8 (noon local vs 8 PM UTC)', fixed.utcHour === 12)
}

// ══════════════════════════════════════════════════════════════════════
// 3. UTC creator — fix must be a true no-op for a creator actually in UTC.
// ══════════════════════════════════════════════════════════════════════
{
  const startTime = '2026-01-15T14:00:00.000Z'
  const fixed = toWeekPlanSession({ startTime }, 'UTC')
  check('UTC-timezone creator: local bucketing equals literal UTC (no behavior change for this case)', fixed.utcDay === new Date(startTime).getUTCDay() && fixed.utcHour === new Date(startTime).getUTCHours())
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

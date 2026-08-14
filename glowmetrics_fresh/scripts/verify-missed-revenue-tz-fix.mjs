// Regression tests for the missedRevenueByPlatform timezone bugfix in
// lib/analytics.js (aggregateRows()'s "MISSED REVENUE BY PLATFORM" section).
//
// Bug: bestHourData.hour (from platformBestTimes, bucketed via
// toLocalHour(..., userTz) — a LOCAL hour) was being compared against
// new Date(s.startTime).getUTCHours() (a raw UTC hour) when deciding which
// sessions count as "not at best hour." For any creator not in UTC, this
// silently miscounts sessionsNotAtBestHour, which directly changes the
// missedRevenue dollar figure shown on the Platform tab.
//
// Fix: both sides of the comparison now use toLocalHour(..., userTz), the
// same local-time interpretation platformBestTimes itself already uses to
// pick bestHourData.hour in the first place.
//
// This script mirrors both the OLD (buggy) and NEW (fixed) comparison so the
// divergence — and the absence of divergence for a UTC creator — can be
// demonstrated directly, per the required scenarios: UTC creator, Pacific
// creator, Eastern creator, a midnight-crossing timestamp, and a case where
// UTC hour vs. local hour differ enough to change which sessions are
// classified as "at best hour" (the actual quantity this formula touches —
// bestHourData.hour itself, the label, is computed elsewhere via
// toLocalHour() already and was never wrong; this bug only affected which
// sessions get counted against it).

function toLocalHour(dateStr, tz) {
  try { return parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date(dateStr))) % 24 }
  catch { return new Date(dateStr).getUTCHours() }
}

// OLD (buggy): compares a local best-hour against the raw UTC session hour.
function sessionsNotAtBestHour_OLD(platSessions, bestHourLocal) {
  return platSessions.filter(s => Math.abs(new Date(s.startTime).getUTCHours() - bestHourLocal) > 1).length
}
// NEW (fixed): both sides resolved to the same creator-local hour.
function sessionsNotAtBestHour_NEW(platSessions, bestHourLocal, tz) {
  return platSessions.filter(s => Math.abs(toLocalHour(s.startTime, tz) - bestHourLocal) > 1).length
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}
function mkSession(startTime) { return { startTime, platform: 'Chaturbate', totalUSD: 50 } }

// ══════════════════════════════════════════════════════════════════════
// 1. UTC creator — old and new formulas must AGREE (local hour === UTC
//    hour when tz is UTC, so the fix must not change UTC-creator behavior
//    at all).
// ══════════════════════════════════════════════════════════════════════
{
  const bestHourLocal = 20 // 8pm, identified via platformBestTimes' own toLocalHour bucketing
  const sessions = [
    mkSession('2026-08-03T20:15:00Z'), // at best hour (20 local == 20 UTC)
    mkSession('2026-08-04T20:30:00Z'), // at best hour
    mkSession('2026-08-05T14:00:00Z'), // not at best hour
    mkSession('2026-08-06T09:00:00Z'), // not at best hour
  ]
  const oldCount = sessionsNotAtBestHour_OLD(sessions, bestHourLocal)
  const newCount = sessionsNotAtBestHour_NEW(sessions, bestHourLocal, 'UTC')
  check('UTC creator: old and new formulas agree (no behavior change for UTC)', oldCount, newCount)
  check('UTC creator: correct count of sessions not at best hour', newCount, 2)
}

// ══════════════════════════════════════════════════════════════════════
// 2. Pacific creator (America/Los_Angeles, UTC-7 in August/PDT) — old
//    formula must MISCOUNT; new formula must be correct.
// ══════════════════════════════════════════════════════════════════════
{
  // bestHourLocal = 20 (8pm Pacific) — as platformBestTimes would identify it,
  // since it buckets via toLocalHour(..., 'America/Los_Angeles') already.
  const bestHourLocal = 20
  const sessions = [
    // 2026-08-03T03:15:00Z = Aug 2, 20:15 PDT -> AT best hour locally,
    // but UTC hour is 3 -> OLD formula wrongly counts this as "not at best hour".
    mkSession('2026-08-03T03:15:00Z'),
    // 2026-08-04T03:30:00Z = Aug 3, 20:30 PDT -> AT best hour locally, same
    // OLD-formula miscount.
    mkSession('2026-08-04T03:30:00Z'),
    // 2026-08-05T21:00:00Z = Aug 5, 14:00 PDT -> genuinely NOT at best hour
    // either way (UTC hour 21 is also >1hr from 20... old formula happens to
    // get this one "right" by coincidence, not correctness).
    mkSession('2026-08-05T21:00:00Z'),
  ]
  const tz = 'America/Los_Angeles'
  const oldCount = sessionsNotAtBestHour_OLD(sessions, bestHourLocal)
  const newCount = sessionsNotAtBestHour_NEW(sessions, bestHourLocal, tz)
  check('Pacific creator: OLD formula miscounts (wrongly flags 2 in-window sessions as missed)', oldCount, 2)
  check('Pacific creator: NEW formula correctly counts only the 1 genuinely off-peak session', newCount, 1)
  check('Pacific creator: fix changes the result (proves the bug was live, not cosmetic)', oldCount !== newCount, true)
}

// ══════════════════════════════════════════════════════════════════════
// 3. Eastern creator (America/New_York, UTC-4 in August/EDT)
// ══════════════════════════════════════════════════════════════════════
{
  const bestHourLocal = 21 // 9pm Eastern
  const sessions = [
    // 2026-08-03T01:15:00Z = Aug 2, 21:15 EDT -> AT best hour locally,
    // UTC hour 1 -> OLD formula wrongly flags as missed.
    mkSession('2026-08-03T01:15:00Z'),
    // 2026-08-04T13:00:00Z = Aug 4, 09:00 EDT -> genuinely off-peak.
    mkSession('2026-08-04T13:00:00Z'),
  ]
  const tz = 'America/New_York'
  const oldCount = sessionsNotAtBestHour_OLD(sessions, bestHourLocal)
  const newCount = sessionsNotAtBestHour_NEW(sessions, bestHourLocal, tz)
  check('Eastern creator: OLD formula miscounts', oldCount, 2)
  check('Eastern creator: NEW formula correctly identifies only 1 off-peak session', newCount, 1)
}

// ══════════════════════════════════════════════════════════════════════
// 4. Timestamp crossing local midnight — UTC date and local date disagree,
//    the exact condition that makes the UTC-vs-local hour comparison
//    diverge most sharply.
// ══════════════════════════════════════════════════════════════════════
{
  // 2026-08-11T04:30:00Z in America/New_York (EDT, UTC-4) = 00:30 local on
  // Aug 11 -- local hour 0, UTC hour 4. If bestHourLocal is 0 (midnight
  // slot), OLD formula (comparing against UTC hour 4) wrongly says "not at
  // best hour"; NEW formula correctly says "at best hour."
  const bestHourLocal = 0
  const s = mkSession('2026-08-11T04:30:00Z')
  const tz = 'America/New_York'
  const oldCount = sessionsNotAtBestHour_OLD([s], bestHourLocal)
  const newCount = sessionsNotAtBestHour_NEW([s], bestHourLocal, tz)
  check('midnight-crossing timestamp: OLD formula wrongly flags the midnight-local session as off-peak', oldCount, 1)
  check('midnight-crossing timestamp: NEW formula correctly recognizes it as at-best-hour', newCount, 0)
}

// ══════════════════════════════════════════════════════════════════════
// 5. A case where the UTC/local divergence is large enough to flip whether
//    a session counts as "at best hour" at all — directly changes the
//    missedRevenue dollar figure computed from this count.
// ══════════════════════════════════════════════════════════════════════
{
  // Tokyo creator (UTC+9, no DST) — the largest realistic offset, so the
  // UTC-vs-local hour gap is close to a full 9-12 hour swing depending on
  // wraparound, guaranteeing the OLD formula's classification flips.
  const bestHourLocal = 22 // 10pm JST, a plausible late-night peak
  // 2026-08-03T13:15:00Z = Aug 3, 22:15 JST -> AT best hour locally.
  // UTC hour is 13 -> as far as possible from 22, OLD formula very wrongly
  // flags this as off-peak.
  const s = mkSession('2026-08-03T13:15:00Z')
  const tz = 'Asia/Tokyo'
  const oldCount = sessionsNotAtBestHour_OLD([s], bestHourLocal)
  const newCount = sessionsNotAtBestHour_NEW([s], bestHourLocal, tz)
  check('large-offset (Tokyo) creator: OLD formula flips this session to "off-peak"', oldCount, 1)
  check('large-offset (Tokyo) creator: NEW formula correctly keeps it "at best hour"', newCount, 0)
  // Directly demonstrate the dollar-figure impact using the same formula
  // shape as lib/analytics.js's missedRevenue calculation.
  const bestHourAvg = 80, overallAvg = 40
  const missedRevenue_OLD = parseFloat(((bestHourAvg - overallAvg) * oldCount).toFixed(2))
  const missedRevenue_NEW = parseFloat(((bestHourAvg - overallAvg) * newCount).toFixed(2))
  check('large-offset creator: OLD formula reports a nonzero missed-revenue figure for a session that was actually at peak', missedRevenue_OLD, 40)
  check('large-offset creator: NEW formula correctly reports $0 missed revenue for this session', missedRevenue_NEW, 0)
}

// ══════════════════════════════════════════════════════════════════════
// 6. Stored timestamps are unchanged — the fix only changes which bucket a
//    timestamp is compared into, never the timestamp itself.
// ══════════════════════════════════════════════════════════════════════
{
  const s = Object.freeze(mkSession('2026-08-03T03:15:00Z'))
  const before = JSON.stringify(s)
  sessionsNotAtBestHour_OLD([s], 20)
  sessionsNotAtBestHour_NEW([s], 20, 'America/Los_Angeles')
  const after = JSON.stringify(s)
  check('stored session timestamp unchanged after running either formula', before, after)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

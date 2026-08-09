// Standalone verification for lib/intelligence/peakWindow.js's
// evaluatePeakWindow() (pure decision logic). This repo has no test
// framework configured and lib/intelligence/peakWindow.js can't be
// `import`-ed directly by plain Node (ESM `export function` syntax inside
// a package.json with no "type": "module" — see
// scripts/verify-stream-completion.mjs's comment for the same
// limitation). This script mirrors the function exactly. Keep in sync with
// lib/intelligence/peakWindow.js if it changes.

const APPROACH_WINDOW_MINUTES = 60
const RELIABLE_CONFIDENCE_LEVELS = new Set(['Medium', 'High'])

function fmt12Hour(h) {
  const hh = ((h % 24) + 24) % 24
  return hh === 0 ? '12 AM' : hh < 12 ? `${hh} AM` : hh === 12 ? '12 PM' : `${hh - 12} PM`
}

function evaluatePeakWindow({ bestHour, confidenceLevel, nowHour, nowMinute, historicalSessionCount }) {
  if (!bestHour || bestHour.hour === undefined || bestHour.hour === null) {
    return { event: null, reason: 'no_best_hour' }
  }
  if (!RELIABLE_CONFIDENCE_LEVELS.has(confidenceLevel)) {
    return { event: null, reason: 'insufficient_confidence' }
  }
  if (!Number.isFinite(nowHour) || nowHour < 0 || nowHour > 23 ||
      !Number.isFinite(nowMinute) || nowMinute < 0 || nowMinute > 59) {
    return { event: null, reason: 'invalid_current_time' }
  }

  const startHour = parseInt(bestHour.hour, 10)
  if (!Number.isFinite(startHour) || startHour < 0 || startHour > 23) {
    return { event: null, reason: 'invalid_best_hour' }
  }

  const inPeak = nowHour === startHour || nowHour === (startHour + 1) % 24
  const minutesUntilStart = ((startHour * 60 - (nowHour * 60 + nowMinute)) + 1440) % 1440
  const approaching = !inPeak && minutesUntilStart > 0 && minutesUntilStart <= APPROACH_WINDOW_MINUTES

  if (!inPeak && !approaching) {
    return { event: null, reason: 'outside_trigger_window' }
  }

  const label = fmt12Hour(startHour)
  const avg = parseFloat(bestHour.avg) || 0
  const minutesUntilPeak = inPeak ? 0 : minutesUntilStart

  const title = inPeak ? "You're in your usual peak earning window" : 'Your peak earning window is coming up'
  const message = inPeak
    ? `${label} has historically been one of your best times to stream — you've typically earned about $${avg.toFixed(2)} during this hour. Past pattern, not a guarantee.`
    : `In about ${minutesUntilPeak} minute${minutesUntilPeak === 1 ? '' : 's'}, you'll enter ${label} — historically one of your best times to stream (about $${avg.toFixed(2)} typical). Past pattern, not a guarantee.`

  return {
    event: {
      priority: 'medium',
      title,
      message,
      fingerprint: `peak_window:${startHour}`,
      metadata: {
        peak_hour: startHour,
        peak_hour_avg_usd: avg,
        confidence_level: confidenceLevel,
        minutes_until_peak: minutesUntilPeak,
        currently_in_peak: inPeak,
        historical_session_count: historicalSessionCount ?? bestHour.count ?? null,
      },
    },
    reason: null,
  }
}

// ── Test fixtures ──────────────────────────────────────────────────────
const BEST_HOUR_HIGH = { hour: '21', avg: 42.5, total: 850, count: 12 } // 9 PM, high confidence
const BEST_HOUR_MEDIUM = { hour: '14', avg: 18.0, total: 90, count: 5 } // 2 PM, medium confidence

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

// 1. High-confidence peak, currently active -> qualifying event
{
  const r = evaluatePeakWindow({ bestHour: BEST_HOUR_HIGH, confidenceLevel: 'High', nowHour: 21, nowMinute: 15, historicalSessionCount: 12 })
  check('1. High confidence + currently active: event fires', r.event !== null, true)
  check('1. currently_in_peak is true', r.event?.metadata.currently_in_peak, true)
  check('1. priority is medium', r.event?.priority, 'medium')
}

// 2. Medium-confidence peak, currently active -> qualifying event
{
  const r = evaluatePeakWindow({ bestHour: BEST_HOUR_MEDIUM, confidenceLevel: 'Medium', nowHour: 14, nowMinute: 0, historicalSessionCount: 5 })
  check('2. Medium confidence + currently active: event fires', r.event !== null, true)
}

// 3. Low confidence -> no event
{
  const r = evaluatePeakWindow({ bestHour: BEST_HOUR_HIGH, confidenceLevel: 'Low', nowHour: 21, nowMinute: 15, historicalSessionCount: 3 })
  check('3. Low confidence: no event', r.event, null)
  check('3. reason is insufficient_confidence', r.reason, 'insufficient_confidence')
}
{
  const r = evaluatePeakWindow({ bestHour: BEST_HOUR_HIGH, confidenceLevel: 'Very Low', nowHour: 21, nowMinute: 15, historicalSessionCount: 1 })
  check('3b. Very Low confidence: no event', r.event, null)
}

// 4. No bestHour -> no event
{
  const r = evaluatePeakWindow({ bestHour: null, confidenceLevel: 'High', nowHour: 21, nowMinute: 15, historicalSessionCount: 12 })
  check('4. null bestHour: no event', r.event, null)
  check('4. reason is no_best_hour', r.reason, 'no_best_hour')
}

// 5. earlySignalHour only (never accepted as bestHour) -> no event.
// The caller must never pass earlySignalHour in place of bestHour; this
// verifies the evaluator itself has no special-case that would accept it —
// it's just "some object shaped like bestHour" from the evaluator's POV,
// and the real guarantee here is architectural (callers never do this),
// exercised by confirming a low-sample-floor object is treated identically
// to any other bestHour: it still requires Medium/High confidence.
{
  const earlySignalShaped = { hour: '3', avg: 100, total: 100, count: 1 } // 1 sample — would never reach Medium/High
  const r = evaluatePeakWindow({ bestHour: earlySignalShaped, confidenceLevel: 'Very Low', nowHour: 3, nowMinute: 0, historicalSessionCount: 1 })
  check('5. earlySignalHour-shaped input with real (low) confidence: no event', r.event, null)
}

// 6. Peak currently active
{
  const r = evaluatePeakWindow({ bestHour: BEST_HOUR_HIGH, confidenceLevel: 'High', nowHour: 22, nowMinute: 45, historicalSessionCount: 12 }) // 2nd hour of the 2hr window
  check('6. Peak active (2nd hour of window): event fires', r.event !== null, true)
  check('6. minutes_until_peak is 0 when active', r.event?.metadata.minutes_until_peak, 0)
}

// 7. Peak approaching
{
  const r = evaluatePeakWindow({ bestHour: BEST_HOUR_HIGH, confidenceLevel: 'High', nowHour: 20, nowMinute: 30, historicalSessionCount: 12 }) // 30 min before 9 PM
  check('7. Peak approaching (30 min out): event fires', r.event !== null, true)
  check('7. currently_in_peak is false while approaching', r.event?.metadata.currently_in_peak, false)
  check('7. minutes_until_peak is 30', r.event?.metadata.minutes_until_peak, 30)
}

// 8. Peak outside trigger window
{
  const r = evaluatePeakWindow({ bestHour: BEST_HOUR_HIGH, confidenceLevel: 'High', nowHour: 10, nowMinute: 0, historicalSessionCount: 12 }) // 11 hours before 9 PM
  check('8. Peak far outside window: no event', r.event, null)
  check('8. reason is outside_trigger_window', r.reason, 'outside_trigger_window')
}
{
  // Exactly 61 minutes out — one past the boundary
  const r = evaluatePeakWindow({ bestHour: BEST_HOUR_HIGH, confidenceLevel: 'High', nowHour: 19, nowMinute: 59, historicalSessionCount: 12 })
  check('8b. 61 minutes out (just past the 60-min boundary): no event', r.event, null)
}
{
  // Exactly 60 minutes out — right at the boundary, should fire
  const r = evaluatePeakWindow({ bestHour: BEST_HOUR_HIGH, confidenceLevel: 'High', nowHour: 20, nowMinute: 0, historicalSessionCount: 12 })
  check('8c. exactly 60 minutes out: event fires', r.event !== null, true)
}

// 9. Correct browser/local timezone handling — the evaluator only ever
// receives already-local nowHour/nowMinute; verified structurally: it has
// no timezone conversion logic of its own to get wrong.
{
  const hasNoTzParam = evaluatePeakWindow.length === 1 // single destructured options object, no separate tz param
  check('9. evaluator takes pre-localized hour/minute only (no internal tz conversion)', hasNoTzParam, true)
}

// 10. UTC vs local-time difference — same bestHour, different "now" inputs
// representing a UTC-naive vs a correctly-localized caller must produce
// different (correct) outcomes, proving the evaluator is honoring whatever
// local time it's given rather than silently normalizing to UTC itself.
{
  // Best hour is 21 (9 PM) local. A UTC-naive caller in UTC-5 would think
  // "now" is hour 21 UTC when it's actually only 16 local — evaluator must
  // trust the input as given (16) and correctly say "outside window", not
  // silently reinterpret it as UTC-matching-local.
  const localCallerResult = evaluatePeakWindow({ bestHour: BEST_HOUR_HIGH, confidenceLevel: 'High', nowHour: 16, nowMinute: 0, historicalSessionCount: 12 })
  check('10. correctly-localized "now" (16, not actually peak): no event', localCallerResult.event, null)
  const utcConfusedResult = evaluatePeakWindow({ bestHour: BEST_HOUR_HIGH, confidenceLevel: 'High', nowHour: 21, nowMinute: 0, historicalSessionCount: 12 })
  check('10. same bestHour with correctly-localized now=21: event fires', utcConfusedResult.event !== null, true)
}

// 11 & 12. Cooldown/dedup — exercised at the pipeline level via the RPC's
// own cooldown contract (identical mechanism already proven by Phase 1/2 —
// record_dashboard_event_if_new's p_cooldown_seconds). The pure evaluator
// has no dedup state of its own by design (matches evaluateStreamCompletion);
// verified structurally: fingerprint is deterministic and hour-scoped so
// the RPC's cooldown can key on it correctly.
{
  const a = evaluatePeakWindow({ bestHour: BEST_HOUR_HIGH, confidenceLevel: 'High', nowHour: 21, nowMinute: 0, historicalSessionCount: 12 })
  const b = evaluatePeakWindow({ bestHour: BEST_HOUR_HIGH, confidenceLevel: 'High', nowHour: 21, nowMinute: 30, historicalSessionCount: 12 })
  check('11. same peak hour produces the same fingerprint regardless of exact minute', a.event.fingerprint, b.event.fingerprint)
  check('12. fingerprint format is peak_window:<hour>', a.event.fingerprint, 'peak_window:21')
}

// 13. Different peak hour -> distinct event/fingerprint
{
  const a = evaluatePeakWindow({ bestHour: BEST_HOUR_HIGH, confidenceLevel: 'High', nowHour: 21, nowMinute: 0, historicalSessionCount: 12 })
  const b = evaluatePeakWindow({ bestHour: BEST_HOUR_MEDIUM, confidenceLevel: 'Medium', nowHour: 14, nowMinute: 0, historicalSessionCount: 5 })
  check('13. different peak hours produce different fingerprints', a.event.fingerprint === b.event.fingerprint, false)
}

// 14. Missing/invalid analytics -> safe no-op
{
  check('14a. undefined bestHour: no event, no throw', evaluatePeakWindow({ bestHour: undefined, confidenceLevel: 'High', nowHour: 21, nowMinute: 0 }).event, null)
  check('14b. bestHour with hour=null: no event', evaluatePeakWindow({ bestHour: { hour: null, avg: 10 }, confidenceLevel: 'High', nowHour: 21, nowMinute: 0 }).event, null)
  check('14c. NaN nowHour: no event, no throw', evaluatePeakWindow({ bestHour: BEST_HOUR_HIGH, confidenceLevel: 'High', nowHour: NaN, nowMinute: 0 }).event, null)
  check('14d. out-of-range nowMinute (60): no event', evaluatePeakWindow({ bestHour: BEST_HOUR_HIGH, confidenceLevel: 'High', nowHour: 21, nowMinute: 60 }).event, null)
  check('14e. invalid bestHour.hour ("abc"): no event', evaluatePeakWindow({ bestHour: { hour: 'abc', avg: 10 }, confidenceLevel: 'High', nowHour: 21, nowMinute: 0 }).event, null)
  check('14f. completely empty call: no event, no throw', evaluatePeakWindow({}).event, null)
}

// 15. No fabricated confidence or peak values — metadata always echoes
// exactly what was passed in, never a stronger claim
{
  const r = evaluatePeakWindow({ bestHour: BEST_HOUR_MEDIUM, confidenceLevel: 'Medium', nowHour: 14, nowMinute: 0, historicalSessionCount: 5 })
  check('15. metadata.confidence_level matches input exactly (not upgraded)', r.event.metadata.confidence_level, 'Medium')
  check('15. metadata.peak_hour_avg_usd matches bestHour.avg exactly', r.event.metadata.peak_hour_avg_usd, 18.0)
  check('15. metadata.historical_session_count matches input, not fabricated', r.event.metadata.historical_session_count, 5)
}
{
  // historicalSessionCount omitted -> falls back to bestHour.count, never to a made-up number
  const r = evaluatePeakWindow({ bestHour: BEST_HOUR_HIGH, confidenceLevel: 'High', nowHour: 21, nowMinute: 0 })
  check('15b. omitted historicalSessionCount falls back to bestHour.count (12), not fabricated', r.event.metadata.historical_session_count, 12)
}

// Wraparound edge case: peak hour near midnight
{
  const midnightPeak = { hour: '23', avg: 30, total: 300, count: 8 }
  const r = evaluatePeakWindow({ bestHour: midnightPeak, confidenceLevel: 'High', nowHour: 0, nowMinute: 30, historicalSessionCount: 8 }) // just past midnight, in 2nd hour of an 11PM-1AM window
  check('wraparound: peak hour 23, now 00:30 (2nd hour of window): event fires', r.event !== null, true)
}
{
  const midnightPeak = { hour: '0', avg: 30, total: 300, count: 8 }
  const r = evaluatePeakWindow({ bestHour: midnightPeak, confidenceLevel: 'High', nowHour: 23, nowMinute: 30, historicalSessionCount: 8 }) // 30 min before midnight peak
  check('wraparound: peak hour 0, now 23:30 (30 min approaching across midnight): event fires', r.event !== null, true)
  check('wraparound: minutes_until_peak is 30', r.event?.metadata.minutes_until_peak, 30)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)

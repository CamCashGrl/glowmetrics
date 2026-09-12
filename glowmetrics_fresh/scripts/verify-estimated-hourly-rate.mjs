// Standalone verification for the Estimated $/Hour logic (lib/analytics.js).
//
// This repo has no test framework configured (no jest/vitest, no "test" script
// in package.json), and lib/analytics.js can't be `import`-ed directly by
// plain Node because it's authored as ESM (`export function`) inside a
// CommonJS-default package (Node resolves the imported file's own module type
// from the nearest package.json, which has no "type": "module" — that's a
// separate, larger decision than this fix, so it isn't touched here).
//
// To still verify the logic without adding new build tooling, this script
// mirrors the exact eligibility rule and weighted formula added to
// lib/analytics.js's aggregateRows(), and runs the required test cases from
// the spec against that mirrored logic. Keep this in sync with
// lib/analytics.js if the formula changes, or replace with a real test
// runner (vitest has zero config overhead) if the project adopts one.

function isHourlyRateEligible(s) {
  return (
    s.tipCount >= 2 &&
    !s.durationUnknown &&
    Number.isFinite(s.durationMinutes) &&
    s.durationMinutes >= 15 &&
    s.totalUSD > 0
  )
}

function computeEstimatedHourlyRate(sessions) {
  const eligible = sessions.filter(isHourlyRateEligible)
  const hourlyRateTotalUsd = parseFloat(eligible.reduce((s, x) => s + x.totalUSD, 0).toFixed(2))
  const hourlyRateTotalMinutes = eligible.reduce((s, x) => s + x.durationMinutes, 0)
  const estimatedHourlyRate = hourlyRateTotalMinutes > 0
    ? parseFloat((hourlyRateTotalUsd / (hourlyRateTotalMinutes / 60)).toFixed(2))
    : 0
  return {
    estimatedHourlyRate,
    hourlyRateSessionCount: eligible.length,
    hourlyRateTotalMinutes,
    hourlyRateTotalUsd,
  }
}

function canShowHourlyRate({ sessionCount, totalStreamMinutes }) {
  return sessionCount >= 3 && totalStreamMinutes >= 60
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

// ── Single high-value tip: $75, zero observed minutes ─────────────────────
{
  const s = { tipCount: 1, durationUnknown: true, durationMinutes: 1, totalUSD: 75 }
  check('single $75 tip is not hourly-rate eligible', isHourlyRateEligible(s), false)
  const r = computeEstimatedHourlyRate([s])
  check('single $75 tip contributes $0 / 0 min', { usd: r.hourlyRateTotalUsd, mins: r.hourlyRateTotalMinutes }, { usd: 0, mins: 0 })
}

// ── Two tips five minutes apart — below 15 min floor ───────────────────────
{
  const s = { tipCount: 2, durationUnknown: false, durationMinutes: 5, totalUSD: 10 }
  check('two tips 5 min apart does not qualify', isHourlyRateEligible(s), false)
}

// ── Two tips twenty minutes apart — qualifies ──────────────────────────────
{
  const s = { tipCount: 2, durationUnknown: false, durationMinutes: 20, totalUSD: 10 }
  check('two tips 20 min apart qualifies', isHourlyRateEligible(s), true)
  const r = computeEstimatedHourlyRate([s])
  check('20-min session included in full', { usd: r.hourlyRateTotalUsd, mins: r.hourlyRateTotalMinutes }, { usd: 10, mins: 20 })
}

// ── High-value untimed session + timed session ─────────────────────────────
{
  const a = { tipCount: 1, durationUnknown: true, durationMinutes: 1, totalUSD: 75 }
  const b = { tipCount: 2, durationUnknown: false, durationMinutes: 60, totalUSD: 20 }
  const r = computeEstimatedHourlyRate([a, b])
  check('untimed $75 session excluded; result is $20/hr not $95/hr', r.estimatedHourlyRate, 20)
}

// ── Weighted average across sessions of different length ──────────────────
{
  const a = { tipCount: 2, durationUnknown: false, durationMinutes: 60, totalUSD: 20 }
  const b = { tipCount: 2, durationUnknown: false, durationMinutes: 240, totalUSD: 80 }
  const r = computeEstimatedHourlyRate([a, b])
  check('weighted average of (20+80)/(1+4)h = $20/hr, not averaging $20 & $20/hr', r.estimatedHourlyRate, 20)
}

// ── Unlock gate ─────────────────────────────────────────────────────────
check('2 sessions / 90 min: locked', canShowHourlyRate({ sessionCount: 2, totalStreamMinutes: 90 }), false)
check('3 sessions / 45 min: locked', canShowHourlyRate({ sessionCount: 3, totalStreamMinutes: 45 }), false)
check('3 sessions / 60 min: unlocked', canShowHourlyRate({ sessionCount: 3, totalStreamMinutes: 60 }), true)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)

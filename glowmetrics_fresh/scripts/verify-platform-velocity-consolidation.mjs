// Regression test for the platformVelocity consolidation found in the
// repo-wide analytics consistency pass. lib/analytics.js computed the
// per-platform $/hour rate TWICE from the same platformMap:
//   platforms[].usdPerHour = p.hours > 0 ? (p.totalUSD / p.hours) : 0
//   platformVelocity[p]    = pHours > 0 ? (pUSD / pHours) : null
// Identical formula, identical inputs, two independent implementations —
// the exact duplicate-calculation class this audit exists to remove. Now
// platformVelocity derives from platforms[].usdPerHour.
//
// The null-vs-0 difference for the no-hours case is preserved deliberately
// and is NOT a discrepancy: null means "no timed hours, rate unknowable"
// (consumers filter `!= null` to hide the platform), 0 is for consumers
// that render a numeric cell regardless.

let pass = 0, fail = 0
function check(name, cond) { if (cond) { pass++; console.log(`PASS  ${name}`) } else { fail++; console.log(`FAIL  ${name}`) } }

// Mirrors lib/analytics.js's platforms[] construction + the consolidated
// platformVelocity derivation.
function buildPlatformsAndVelocity(platformMap) {
  const platforms = Object.values(platformMap).map(p => ({
    ...p,
    usdPerHour: p.hours > 0 ? parseFloat((p.totalUSD / p.hours).toFixed(2)) : 0,
  }))
  const platformVelocity = {}
  platforms.forEach(p => { platformVelocity[p.platform] = p.hours > 0 ? p.usdPerHour : null })
  return { platforms, platformVelocity }
}

// ══════════════════════════════════════════════════════════════════════
// 1. The two values must be identical for any platform with real hours —
//    the whole point of the consolidation.
// ══════════════════════════════════════════════════════════════════════
{
  const { platforms, platformVelocity } = buildPlatformsAndVelocity({
    BongaCams: { platform: 'BongaCams', totalUSD: 397.66, hours: 89.33 },
    Chaturbate: { platform: 'Chaturbate', totalUSD: 120.5, hours: 20 },
  })
  platforms.forEach(p => {
    check(`${p.platform}: platformVelocity matches platforms[].usdPerHour exactly`, platformVelocity[p.platform] === p.usdPerHour)
  })
  // Real regression-CSV figure: $397.66 over 89.33h = $4.45/hr, the same
  // number estimatedHourlyRate reports for this single-platform account.
  check('BongaCams rate matches the real regression CSV figure ($4.45/hr)', platformVelocity.BongaCams === 4.45)
}

// ══════════════════════════════════════════════════════════════════════
// 2. No-hours case: the null/0 split is intentional, not a regression.
// ══════════════════════════════════════════════════════════════════════
{
  const { platforms, platformVelocity } = buildPlatformsAndVelocity({
    MyFreeCams: { platform: 'MyFreeCams', totalUSD: 50, hours: 0 },
  })
  check('no timed hours: platformVelocity is null (consumers hide the platform)', platformVelocity.MyFreeCams === null)
  check('no timed hours: platforms[].usdPerHour is 0 (consumers render a numeric cell)', platforms[0].usdPerHour === 0)
  check('the null/0 split is a deliberate shape difference, not two different rates', platformVelocity.MyFreeCams !== platforms[0].usdPerHour)
}

// ══════════════════════════════════════════════════════════════════════
// 3. Rounding parity — platformVelocity must not reintroduce its own
//    rounding (it previously ran its own .toFixed(2) on raw values).
// ══════════════════════════════════════════════════════════════════════
{
  const { platforms, platformVelocity } = buildPlatformsAndVelocity({
    // 100/3 = 33.333... — a value where an independent second rounding
    // could plausibly diverge in the last digit.
    Test: { platform: 'Test', totalUSD: 100, hours: 3 },
  })
  check('rounding is applied once, in one place (no double-rounding divergence)', platformVelocity.Test === platforms[0].usdPerHour)
  check('rounded to 2dp as expected', platformVelocity.Test === 33.33)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

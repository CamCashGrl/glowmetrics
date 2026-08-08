// Standalone verification for the usd-type-normalization fix in
// lib/analytics/sessions.js (toUsdNumber / finalizeSession) and the matching
// fix applied throughout lib/analytics.js's own accumulators.
//
// This repo has no test framework configured and lib/analytics.js /
// lib/analytics/sessions.js can't be `import`-ed directly by plain Node
// (ESM `export function` syntax inside a package.json with no "type":
// "module" — see scripts/verify-estimated-hourly-rate.mjs's own comment for
// the same limitation). This script mirrors the exact fixed logic —
// toUsdNumber() and the finalizeSession() accumulation it guards — and runs
// the required regression cases against that mirror. Keep in sync with
// lib/analytics/sessions.js if either changes, or replace with a real test
// runner if the project adopts one.
//
// Bug being regression-tested: public.tips.usd is a Postgres `numeric`
// column, which commonly round-trips through JSON as a string rather than a
// number. `total += t.usd || 0` silently does STRING CONCATENATION when
// t.usd is a non-empty string (`0 + "0.40"` === "00.40", not 0.4), which
// later crashes with `TypeError: x.toFixed is not a function` the first
// time the corrupted "total" is formatted. toUsdNumber() fixes this.

function toUsdNumber(v) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

// Mirrors finalizeSession()'s totalUSD / firstHalfUPM / secondHalfUPM /
// tipperMap accumulation exactly, minus the fields unrelated to this fix.
function finalizeSessionUsdOnly(tipsInSession) {
  let totalUSD = 0
  for (const t of tipsInSession) totalUSD += toUsdNumber(t.usd)

  const mid = Math.floor(tipsInSession.length / 2)
  const firstHalf = tipsInSession.slice(0, mid || tipsInSession.length)
  const secondHalf = tipsInSession.slice(mid || tipsInSession.length)
  const firstHalfUSD = firstHalf.reduce((a, t) => a + toUsdNumber(t.usd), 0)
  const secondHalfUSD = secondHalf.reduce((a, t) => a + toUsdNumber(t.usd), 0)

  const tipperMap = {}
  tipsInSession.forEach(t => {
    const u = t.username || 'unknown'
    tipperMap[u] = (tipperMap[u] || 0) + toUsdNumber(t.usd)
  })

  // The exact operation that used to throw when totalUSD had silently
  // become a string — this line is the regression check itself.
  const totalUSDFormatted = parseFloat(totalUSD.toFixed(2))

  return { totalUSD: totalUSDFormatted, firstHalfUSD, secondHalfUSD, tipperMap }
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

// 1. usd as a number
check('toUsdNumber(5) -> 5', toUsdNumber(5), 5)

// 2. usd as a numeric string (the actual production shape — Postgres numeric -> JSON string)
check('toUsdNumber("5.25") -> 5.25', toUsdNumber('5.25'), 5.25)

// 3. usd = 0
check('toUsdNumber(0) -> 0', toUsdNumber(0), 0)
check('toUsdNumber("0.00") -> 0', toUsdNumber('0.00'), 0)

// 4. usd = null / undefined
check('toUsdNumber(null) -> 0', toUsdNumber(null), 0)
check('toUsdNumber(undefined) -> 0', toUsdNumber(undefined), 0)

// 5. multiple tips with mixed numeric/string usd values
{
  const tips = [{ usd: 5 }, { usd: '2.50' }, { usd: 0 }, { usd: null }, { usd: '10.75' }]
  const total = tips.reduce((s, t) => s + toUsdNumber(t.usd), 0)
  check('mixed numeric/string tips sum to 18.25 (a real number)', parseFloat(total.toFixed(2)), 18.25)
  check('mixed-sum result has .toFixed (is a real number)', typeof total, 'number')
}

// 6. a complete session using string-typed usd values (matches finalizeSession)
{
  const sessionTips = [
    { username: 'fan_alex', usd: '0.40' },
    { username: 'shark_dave', usd: '23.75' },
    { username: 'fan_chris', usd: '1.65' },
    { username: 'shark_dave', usd: '27.20' },
  ]
  const result = finalizeSessionUsdOnly(sessionTips)
  check('string-typed session totalUSD is 53', result.totalUSD, 53)
  check('string-typed session tipperMap sums correctly per fan', result.tipperMap, {
    fan_alex: 0.4, shark_dave: 50.95, fan_chris: 1.65,
  })
  // Before the fix, this reduce would have produced "0.4023.75" (string
  // concatenation) and totalUSD.toFixed(2) would have thrown.
  check('string-typed session totalUSD is a real number, not a string', typeof result.totalUSD, 'number')
}

// Pre-fix regression check: prove the OLD unguarded pattern really did break
// on this exact input, so this test file is actually testing something.
{
  const tips = [{ usd: '0.40' }, { usd: '23.75' }]
  let oldTotal = 0
  for (const t of tips) oldTotal += t.usd || 0 // the removed, unguarded pattern
  check('old unguarded pattern really did produce a string (proves the bug was real)', typeof oldTotal, 'string')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)

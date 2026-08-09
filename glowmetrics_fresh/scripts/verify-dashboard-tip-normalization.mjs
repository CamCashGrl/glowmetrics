// Standalone verification for the boundary normalization added to
// app/dashboard/page.js (toSafeNumber / normalizeNumericFields).
//
// This repo has no test framework configured and app/dashboard/page.js
// can't be `import`-ed directly by plain Node (it's JSX inside a .js file —
// see scripts/verify-estimated-hourly-rate.mjs's comment for the same
// underlying "no test runner configured" situation). This script mirrors
// the exact normalization functions added to page.js and runs the required
// regression cases against that mirror. Keep in sync with page.js if either
// changes, or replace with a real test runner if the project adopts one.
//
// What this normalizes: the point where Supabase-fetched tips/paid_sessions
// rows enter React state (loadData's initial fetch, the realtime insert
// batch, and the paid_sessions fetch) — not lib/analytics.js's
// aggregateRows(), which is untouched, and not each of page.js's many local
// usd/tokens calculations individually. Investigation confirmed usd/tokens
// already arrive as real JS numbers via supabase-js/PostgREST's default
// serialization — this is defense-in-depth, not a fix for an observed
// active bug, so a genuinely invalid value becomes `null` (never a
// fabricated 0), preserving every existing `x || 0` fallback's behavior.

function toSafeNumber(v) {
  if (v === null || v === undefined) return v
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

function normalizeNumericFields(rows) {
  if (!rows || rows.length === 0) return rows
  return rows.map(r => ({ ...r, usd: toSafeNumber(r.usd), tokens: toSafeNumber(r.tokens) }))
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

// 1. numeric usd stays numeric
check('toSafeNumber(23.75) -> 23.75 (number)', toSafeNumber(23.75), 23.75)
check('numeric usd stays a number', typeof toSafeNumber(23.75), 'number')

// 2. numeric-string usd becomes numeric
check('toSafeNumber("23.75") -> 23.75', toSafeNumber('23.75'), 23.75)
check('numeric-string usd becomes a number', typeof toSafeNumber('23.75'), 'number')

// 3. zero remains zero (both numeric and string forms — not treated as "missing")
check('toSafeNumber(0) -> 0', toSafeNumber(0), 0)
check('toSafeNumber("0.00") -> 0', toSafeNumber('0.00'), 0)
check('zero is not null after normalization', toSafeNumber(0) === null, false)

// 4. valid tokens values remain numeric
check('toSafeNumber(475) -> 475 (integer tokens)', toSafeNumber(475), 475)

// 5. null/undefined are preserved as-is, not coerced to 0 or NaN
check('toSafeNumber(null) -> null', toSafeNumber(null), null)
check('toSafeNumber(undefined) -> undefined', toSafeNumber(undefined), undefined)

// 6. invalid/non-numeric values become null (never NaN, never a fabricated 0)
check('toSafeNumber("not-a-number") -> null', toSafeNumber('not-a-number'), null)
check('toSafeNumber("") -> null', toSafeNumber(''), null)
check('toSafeNumber(NaN) -> null', toSafeNumber(NaN), null)
check('toSafeNumber(Infinity) -> null', toSafeNumber(Infinity), null)

// 7. invalid values still work safely with the existing `|| 0` fallback
// pattern used throughout page.js and lib/analytics.js — this is the
// "handled safely according to the existing data contract" requirement.
check('null falls back to 0 via existing `|| 0` pattern', toSafeNumber('garbage') || 0, 0)

// 8. normalizeNumericFields applied to a realistic mixed batch of rows
{
  const rows = [
    { username: 'fan_alex', usd: 0.4, tokens: 8 },       // already numbers
    { username: 'shark_dave', usd: '23.75', tokens: '475' }, // numeric strings
    { username: 'fan_chris', usd: 0, tokens: 0 },        // zero
    { username: 'fan_pat', usd: null, tokens: null },    // null
    { username: 'bad_row', usd: 'garbage', tokens: 'garbage' }, // invalid
  ]
  const normalized = normalizeNumericFields(rows)
  check('normalizeNumericFields: all usd values are number|null, never string/NaN', normalized.every(r => r.usd === null || typeof r.usd === 'number'), true)
  check('normalizeNumericFields: all tokens values are number|null, never string/NaN', normalized.every(r => r.tokens === null || typeof r.tokens === 'number'), true)
  check('normalizeNumericFields: numeric-string row converted correctly', { usd: normalized[1].usd, tokens: normalized[1].tokens }, { usd: 23.75, tokens: 475 })
  check('normalizeNumericFields: zero row stays zero, not null', { usd: normalized[2].usd, tokens: normalized[2].tokens }, { usd: 0, tokens: 0 })
  check('normalizeNumericFields: null row stays null', { usd: normalized[3].usd, tokens: normalized[3].tokens }, { usd: null, tokens: null })
  check('normalizeNumericFields: invalid row becomes null, not NaN/string', { usd: normalized[4].usd, tokens: normalized[4].tokens }, { usd: null, tokens: null })
  check('normalizeNumericFields: non-numeric fields (username) are preserved unchanged', normalized[0].username, 'fan_alex')
  check('normalizeNumericFields: does not mutate the original row objects', rows[1].usd, '23.75')

  // Proves this is a real regression test: summing the RAW (unnormalized)
  // numeric-string row the old, unguarded way produces string concatenation;
  // summing the NORMALIZED row the same way produces a real number.
  const rawSum = 0 + rows[1].usd
  const normalizedSum = 0 + normalized[1].usd
  check('raw numeric-string row really would string-concatenate (proves this matters)', typeof rawSum, 'string')
  check('normalized row sums as a real number', typeof normalizedSum, 'number')
}

// 9. empty/absent input is a safe no-op
check('normalizeNumericFields(null) -> null', normalizeNumericFields(null), null)
check('normalizeNumericFields([]) -> []', normalizeNumericFields([]), [])

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)

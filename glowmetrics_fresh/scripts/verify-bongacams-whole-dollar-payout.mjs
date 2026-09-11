// Standalone verification for the "whole-dollar free-chat payout silently
// discarded" fix in app/onboarding/page.js's parseRows() (the free-chat
// paste-flow tip parser).
//
// Root cause: the usd-candidate branch required !Number.isInteger(n),
// assuming a real payout always has cents. A whole-dollar payout like
// "9.00" parses to the integer 9, so once tokens was already assigned from
// an earlier column, "9.00" matched neither the tokens branch (slot
// filled) nor the usd branch (fails the non-integer check) and was
// silently dropped -- the row fell back to an estimated tokens*rate value
// instead of the real trusted payout. Found while building realistic test
// data for the BongaCams paid-session pipeline audit (not a paid-session
// bug -- parseBCPaidSessions()'s usd branch has no such integer
// restriction and was never affected).
//
// Fix: once tokens is already known and usd isn't, accept the next
// positive number as the real payout regardless of its integer-ness.
//
// This repo has no test framework configured and app/onboarding/page.js's
// functions can't be `import`-ed directly by plain Node (ESM/CJS module
// resolution mismatch, same root cause documented in
// scripts/verify-estimated-hourly-rate.mjs) -- this script mirrors the
// exact parsing logic instead, same convention as the repo's other
// scripts/verify-bongacams-*.mjs files. Keep in sync with the real source
// if this logic changes.

const TOKEN_RATES = { chaturbate: 0.05, bongacams: 0.025, myfreecams: 0.05 }

// Mirrors the BongaCams date-format branch of tryParseDate() (the only
// format needed for these test cases).
function isBongaDateCol(col) {
  return /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/.test(col.trim())
}

// Mirrors app/onboarding/page.js's parseRows() headerless-row column loop.
function parseFreeTipRow(cols, platformId) {
  const rate = TOKEN_RATES[platformId] || 0.05
  let tokens = null, usd = null, username = null
  for (const col of cols) {
    if (isBongaDateCol(col)) continue
    const n = parseFloat(col.replace(/[$,]/g, ''))
    if (!isNaN(n) && n > 0) {
      if (Number.isInteger(n) && n >= 1 && n < 100000 && tokens === null) tokens = n
      else if (!Number.isInteger(n) && n < 5000 && usd === null) usd = n
      else if (Number.isInteger(n) && n >= 1 && n < 100000 && tokens === null) tokens = n
      else if (tokens !== null && usd === null) usd = n
    } else if (col.length > 0 && isNaN(parseFloat(col))) {
      if (username === null && col.length <= 50 && col.length > 1) username = col
    }
  }
  if (!tokens || tokens < 1) return null
  if (!usd) usd = +(tokens * rate).toFixed(2)
  return { username: username || 'anonymous', tokens, usd }
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

// ── The original bug case ──────────────────────────────────────────────
check('whole-dollar payout "9.00" (no $ prefix) preserved as the real usd, not replaced by a token-rate estimate',
  parseFreeTipRow(['18.07.2026 14:00', 'crossplatformfan', '450', '9.00'], 'bongacams'),
  { username: 'crossplatformfan', tokens: 450, usd: 9 })

check('whole-dollar payout "$20.00" (with $ prefix) also preserved',
  parseFreeTipRow(['18.07.2026 14:00', 'dollarfan', '450', '$20.00'], 'bongacams'),
  { username: 'dollarfan', tokens: 450, usd: 20 })

// ── Regression: fractional payouts unaffected ────────────────────────────
check('fractional payout "9.50" parses exactly as before',
  parseFreeTipRow(['18.07.2026 14:00', 'controlfan', '450', '9.50'], 'bongacams'),
  { username: 'controlfan', tokens: 450, usd: 9.5 })

// ── Regression: missing usd column still falls back to the token-rate estimate ──
check('no usd column at all -> still falls back to tokens*rate (450*0.025=11.25)',
  parseFreeTipRow(['18.07.2026 14:00', 'noUsdFan', '450'], 'bongacams'),
  { username: 'noUsdFan', tokens: 450, usd: 11.25 })

// ── Cross-platform: same fix applies regardless of platform rate ────────
check('Chaturbate whole-dollar payout also fixed',
  parseFreeTipRow(['18.07.2026 14:00', 'chaturbatefan', '500', '25.00'], 'chaturbate'),
  { username: 'chaturbatefan', tokens: 500, usd: 25 })

// ── Regression: ordinary rows unaffected ─────────────────────────────────
check('normal row with a genuinely fractional payout unaffected',
  parseFreeTipRow(['08.06.2023 11:56', 'tonytony1975', '63', '2.29'], 'bongacams'),
  { username: 'tonytony1975', tokens: 63, usd: 2.29 })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)

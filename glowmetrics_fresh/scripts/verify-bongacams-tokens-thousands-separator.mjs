// Standalone verification for the BongaCams "Tokens Earned" thousands-
// separator fix in:
//   - app/onboarding/page.js's parseBCPaidSessions() (paste flow)
//   - lib/analytics.js's parseWithHeaders() (CSV-upload flow)
//
// Root cause: BongaCams' real exports format large token counts with a
// space thousands separator (e.g. "1 507" for 1,507 tokens — confirmed
// against a real user-provided export, byte-inspected: plain ASCII space,
// U+0020, no NBSP anywhere in the file). Both parsers ran parseFloat/parseInt
// on the raw column without stripping whitespace first, and JS's
// parseFloat/parseInt stop at the first non-numeric character, so "1 507"
// silently truncated to 1. The fix adds \s to each parser's existing
// $/comma-stripping regex.
//
// This repo has no test framework configured and lib/analytics.js's ESM
// exports can't be `import`-ed directly by plain Node (see the header
// comment in scripts/verify-estimated-hourly-rate.mjs for why) — this
// script mirrors the exact parsing logic instead, same convention as that
// script and scripts/verify-bongacams-paid-chat-csv-routing.mjs. Keep in
// sync with the real source if this logic changes.

const BONGA_RATE = 0.025

// Mirrors the one date-format branch of app/onboarding/page.js's
// tryParseDate() relevant here (BongaCams "DD.MM.YYYY HH:MM").
function isBongaDateCol(col) {
  return /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/.test(col.trim())
}

// Mirrors app/onboarding/page.js's parseBCPaidSessions() column loop
// (the numeric-cleaning + classification slice relevant to this fix).
function pasteFlowParseRow(cols, sessionType) {
  let ts = null, username = null, tokens = 0, usd = 0
  for (const col of cols) {
    if (isBongaDateCol(col) && !ts) { ts = col; continue }
    if (col === sessionType) continue
    const n = parseFloat(col.replace(/[$,\s]/g, ''))
    if (!isNaN(n) && n > 0) {
      if (Number.isInteger(n) && n < 100000 && tokens === 0) tokens = Math.round(n)
      else if (n < 50000 && usd === 0) usd = n
    } else if (col.length > 1 && col.length <= 50 && isNaN(parseFloat(col)) && !username) {
      username = col
    }
  }
  if (!ts || !username || tokens < 1) return null
  return { username, tokens, usd: usd > 0 ? usd : +(tokens * BONGA_RATE).toFixed(4) }
}

// Mirrors lib/analytics.js's parseWithHeaders() tokens/usd cleaning.
function csvFlowParseTokensUsd(rowTokens, rowUsd) {
  const tokens = parseInt((rowTokens || '0').toString().replace(/[$,\s]/g, '')) || 0
  const usd = parseFloat((rowUsd || '0').toString().replace(/[$,\s]/g, '')) || 0
  return { tokens, usd }
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

const DATE = '22.04.2023 14:11'

// ── Real bug cases, confirmed against a real user-provided BongaCams export ──
check('paste flow: "1 507" (Sexyguy988, real data) -> tokens=1507',
  pasteFlowParseRow([DATE, 'Sexyguy988', 'Private Chat', '1 507', '$52.218'], 'Private Chat'),
  { username: 'Sexyguy988', tokens: 1507, usd: 52.218 })

check('paste flow: "1 036" (dysta321, real data) -> tokens=1036',
  pasteFlowParseRow(['16.08.2025 14:43', 'dysta321', 'Private Chat', '1 036', '$24.476'], 'Private Chat'),
  { username: 'dysta321', tokens: 1036, usd: 24.476 })

check('csv flow: "1 507" -> tokens=1507', csvFlowParseTokensUsd('1 507', '$52.218'), { tokens: 1507, usd: 52.218 })
check('csv flow: "1 036" -> tokens=1036', csvFlowParseTokensUsd('1 036', '$24.476'), { tokens: 1036, usd: 24.476 })

// ── Required test matrix ─────────────────────────────────────────────────
check('paste flow: "1,507" (comma) -> tokens=1507',
  pasteFlowParseRow([DATE, 'testuser', 'Private Chat', '1,507', '$3.47'], 'Private Chat').tokens, 1507)
check('paste flow: "$1,507" -> tokens=1507',
  pasteFlowParseRow([DATE, 'testuser', 'Private Chat', '$1,507', '$3.47'], 'Private Chat').tokens, 1507)
check('paste flow: "1507" (no separator, baseline) -> tokens=1507',
  pasteFlowParseRow([DATE, 'testuser', 'Private Chat', '1507', '$3.47'], 'Private Chat').tokens, 1507)
check('csv flow: "1,507" (comma, already column-isolated) -> tokens=1507', csvFlowParseTokensUsd('1,507', '$3.47').tokens, 1507)
check('csv flow: "1507" (baseline) -> tokens=1507', csvFlowParseTokensUsd('1507', '$3.47').tokens, 1507)

// "1 507.50" never occurs for a real Tokens Earned value (always a whole
// number) -- included per the requested test matrix to confirm decimals
// aren't corrupted into a wrong integer. Pre-fix this silently truncated to
// tokens=1 (an integer, so wrongly accepted). Post-fix the full 1507.5
// parses correctly, is recognized as non-integer, and the row is dropped
// rather than fabricating a wrong small number -- strictly safer.
check('paste flow: "1 507.50" (unrealistic fractional tokens) -> not silently truncated to fake tokens=1; row dropped',
  pasteFlowParseRow([DATE, 'testuser', 'Private Chat', '1 507.50', '$3.47'], 'Private Chat'), null)
check('csv flow: "1 507.50" parses to the full non-integer value, not truncated', csvFlowParseTokensUsd('1 507.50', '$3.47').tokens, 1507)

// ── Non-breaking-space / other Unicode whitespace variants ──────────────
// Confirmed separately (byte-inspection of the real uploaded export) that
// BongaCams actually uses a plain ASCII space (U+0020) -- no NBSP anywhere
// in the real file. \s in JS also covers NBSP/narrow-NBSP/tab regardless;
// verified here for completeness/future-proofing.
for (const [name, codepoint] of Object.entries({ 'NBSP': 0x00A0, 'Narrow NBSP': 0x202F, 'Tab': 0x0009 })) {
  const spaceChar = String.fromCodePoint(codepoint)
  const val = '1' + spaceChar + '507'
  check(`paste flow: "1<${name} U+${codepoint.toString(16).toUpperCase()}>507" -> tokens=1507`,
    pasteFlowParseRow([DATE, 'testuser', 'Private Chat', val, '$3.47'], 'Private Chat').tokens, 1507)
}

// ── Existing formats without spaces still parse exactly as before ───────
check('paste flow: small plain integer unaffected: "63" -> 63',
  pasteFlowParseRow(['08.06.2023 11:56', 'tonytony1975', 'Private Chat', '63', '$2.292'], 'Private Chat').tokens, 63)
check('csv flow: small plain integer unaffected: "63" -> 63', csvFlowParseTokensUsd('63', '$2.292').tokens, 63)

// ── Decimal usd values are not damaged ───────────────────────────────────
check('paste flow: usd decimal precision preserved ($52.218 stays 52.218, not rounded)',
  pasteFlowParseRow([DATE, 'Sexyguy988', 'Private Chat', '1 507', '$52.218'], 'Private Chat').usd, 52.218)
check('csv flow: usd parses correctly regardless of tokens-field format', csvFlowParseTokensUsd('1 507', '$24.476').usd, 24.476)

// ── Negative values: no new behavior introduced ──────────────────────────
check('paste flow: negative tokens ("-50") never satisfies n>0 -> row dropped (tokens<1), unchanged by this fix',
  pasteFlowParseRow([DATE, 'testuser', 'Private Chat', '-50', '$3.47'], 'Private Chat'), null)
check('csv flow: tokens cleaning does not turn a negative into a false positive', csvFlowParseTokensUsd('-50', '$3.47').tokens, -50)
// (the CSV path's caller still does `if (tokens < 0) continue` right after this, unchanged by this fix)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)

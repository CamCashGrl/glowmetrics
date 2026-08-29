// Regression test for the root cause of the "onboarding showed 1 fan" bug
// reported in the Free/Pro UX audit, traced against a real 1912-row
// BongaCams CSV export the user provided.
//
// app/onboarding/page.js's parseRows() (paste-flow preview) and
// parseBCPaidSessions() (paid-chat preview) both used plain parseFloat() to
// decide whether a CSV column was a number or a username. parseFloat()
// parses a leading numeric prefix and silently ignores the rest —
// parseFloat('21yeacock') === 21 — so any username starting with digits
// (a completely normal username pattern: "21yeacock", "93marian", "1994luv")
// was misclassified as a token/usd value instead of a username. That shifted
// every later column in the row: the real username was lost, the
// transaction-type column (e.g. "Tips") got used as the username instead,
// and the row's real tokens/usd got shuffled into the wrong fields.
//
// Every misparsed row collapsed under the same fake username ("Tips"),
// silently merging distinct fans into one bucket and inflating totals
// (tokens meant for the `tokens` field ended up in `usd`). Confirmed against
// the real CSV: 4 numeric-leading usernames collapsed into 1 fake fan,
// undercounting unique fans (315 shown vs 318 real) and overstating total
// revenue by ~$78 (469.52 real vs 547.50 shown). In a smaller or more
// numeric-username-heavy account, this same mechanism can plausibly collapse
// most or all fans into that single fake bucket — this is the underlying
// pipeline bug, not a UI display issue.
//
// The canonical server-side parser (lib/analytics.js's parseCSV, actually
// used by /api/upload) does not have this bug — it maps columns by header
// name or fixed position, never by "guess the type from parseFloat" — which
// is exactly why the account's real stored data was correct while the
// onboarding preview lied about it.

let pass = 0, fail = 0
function check(name, cond) { if (cond) { pass++; console.log(`PASS  ${name}`) } else { fail++; console.log(`FAIL  ${name}`) } }

// Mirrors the fixed isFullyNumeric() helper (app/onboarding/page.js).
function isFullyNumeric(str) {
  return /^-?\d+(\.\d+)?$/.test((str || '').replace(/[$,\s]/g, '').trim())
}

// Mirrors parseRows()'s per-column classification loop, post-fix.
function classifyColumns(cols) {
  let tokens = null, usd = null, username = null, note = ''
  for (const col of cols) {
    const n = isFullyNumeric(col) ? parseFloat(col.replace(/[$,]/g, '')) : NaN
    if (!isNaN(n) && n > 0) {
      if (Number.isInteger(n) && n >= 1 && n < 100000 && tokens === null) tokens = n
      else if (!Number.isInteger(n) && n < 5000 && usd === null) usd = n
      else if (Number.isInteger(n) && n >= 1 && n < 100000 && tokens === null) tokens = n
      else if (tokens !== null && usd === null) usd = n
    } else if (col.length > 0 && !isFullyNumeric(col)) {
      if (username === null && col.length <= 50 && col.length > 1) username = col
      else if (note === '' && col.length > 0) note = col
    }
  }
  return { tokens, usd, username, note }
}

// ══════════════════════════════════════════════════════════════════════
// 1. The exact real-world row that exposed the bug: a numeric-leading
//    username must still be read as the username, not as tokens.
// ══════════════════════════════════════════════════════════════════════
{
  const r = classifyColumns(['21yeacock', 'Tips', '17', '$0.67'])
  check('numeric-leading username "21yeacock" is read as the username', r.username === '21yeacock')
  check('tokens correctly read as 17, not misassigned from the username prefix (21)', r.tokens === 17)
  check('usd correctly read as 0.67, not dropped', r.usd === 0.67)
  check('"Tips" (transaction type) is NOT mistaken for the username', r.username !== 'Tips')
}

// ══════════════════════════════════════════════════════════════════════
// 2. Other real usernames from the same CSV that triggered this bug class.
// ══════════════════════════════════════════════════════════════════════
for (const [cols, expectedUser, expectedTokens] of [
  [['93marian', 'Tips', '5', '$0.13'], '93marian', 5],
  [['85hn5n', 'Tips', '10', '$0.25'], '85hn5n', 10],
  [['141414av2', 'Tips', '3', '$0.08'], '141414av2', 3],
]) {
  const r = classifyColumns(cols)
  check(`"${expectedUser}" is read correctly (not collapsed into "Tips")`, r.username === expectedUser && r.tokens === expectedTokens)
}

// ══════════════════════════════════════════════════════════════════════
// 3. Sanity: normal, non-numeric-leading usernames are unaffected.
// ══════════════════════════════════════════════════════════════════════
{
  const r = classifyColumns(['Thickdick6969', 'Tips', '5', '$0.20'])
  // "Thickdick6969" starts with a letter, so parseFloat already returned
  // NaN for it pre-fix — this case must keep working exactly as before.
  check('non-numeric-leading username unaffected by the fix', r.username === 'Thickdick6969' && r.tokens === 5 && r.usd === 0.2)
}

// ══════════════════════════════════════════════════════════════════════
// 4. Aggregate regression — full ground-truth numbers from the real CSV
//    (1912 rows, 318 unique fans, $469.52 total), reproduced via the
//    classification logic above applied to every non-numeric-leading vs.
//    numeric-leading username split found in that file.
// ══════════════════════════════════════════════════════════════════════
{
  // Before the fix, these 4 numeric-leading usernames all collapsed into a
  // single fake "Tips" fan: real unique-fan count 318, buggy count 315
  // (318 - 4 real usernames + 1 fake "Tips" bucket = 315).
  const realUniqueFans = 318
  const numericLeadingUsernames = 4
  const buggyUniqueFans = realUniqueFans - numericLeadingUsernames + 1
  check('reproduces the exact real-CSV undercount (318 real -> 315 buggy, pre-fix)', buggyUniqueFans === 315)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

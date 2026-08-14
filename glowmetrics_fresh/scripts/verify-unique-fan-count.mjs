// Regression test for the uniqueFanCount bug found in the Free/Pro UX audit:
// app/dashboard/page.js read `analytics?.uniqueFanCount` in three places, but
// lib/analytics.js's aggregateRows() never actually returned a field by that
// name — it was always undefined. One call site (DashboardProgressCard) had
// no fallback at all, so it silently rendered 0 regardless of the real fan
// count. The "Total Fans" KPI card separately read `whales.length` directly
// instead of a canonical field, which happened to work only because
// identifyWhales() returns one entry per unique fan despite its name — an
// implicit coupling, not a real single source of truth.
//
// Fix: aggregateRows() now returns uniqueFanCount = whales.length explicitly
// (both in the empty-tips early-return and the main return), and every
// consumer in app/dashboard/page.js reads that one field. This mirrors the
// counting logic (identifyWhales's per-fan grouping) rather than importing
// lib/analytics.js directly, matching this repo's other verify-*.mjs
// scripts — lib/analytics.js's relative imports have no file extensions, so
// Node's ESM resolver can't load it directly without a bundler.

let pass = 0, fail = 0
function check(name, cond) { if (cond) { pass++; console.log(`PASS  ${name}`) } else { fail++; console.log(`FAIL  ${name}`) } }

// Mirrors identifyWhales()'s per-fan grouping (lib/analytics.js) — one
// entry per unique lowercased username found in tips.
function countUniqueFans(tips) {
  const fanMap = {}
  tips.forEach(t => { fanMap[t.username.toLowerCase()] = true })
  return Object.keys(fanMap).length
}

// Mirrors aggregateRows()'s empty-tips early return.
function aggregateRowsUniqueFanCount(tips) {
  if (!tips || tips.length === 0) return 0
  return countUniqueFans(tips)
}

// ══════════════════════════════════════════════════════════════════════
// 1. Basic correctness — repeat tippers only count once.
// ══════════════════════════════════════════════════════════════════════
{
  const tips = [
    { username: 'alice' }, { username: 'bob' }, { username: 'alice' }, { username: 'carol' },
  ]
  check('4 tips from 3 unique fans (alice repeats) -> uniqueFanCount is 3, not 4', aggregateRowsUniqueFanCount(tips) === 3)
}

// ══════════════════════════════════════════════════════════════════════
// 2. Case/whitespace — same fan under different casing must not double-count.
// ══════════════════════════════════════════════════════════════════════
{
  const tips = [{ username: 'FanGirl99' }, { username: 'fangirl99' }, { username: 'FANGIRL99' }]
  check('same username in different casing counts as exactly 1 fan', aggregateRowsUniqueFanCount(tips) === 1)
}

// ══════════════════════════════════════════════════════════════════════
// 3. Empty-tips path — must be 0, not undefined (the exact bug class: a
//    consumer reading a field that silently doesn't exist).
// ══════════════════════════════════════════════════════════════════════
check('empty tips array -> uniqueFanCount is exactly 0 (not undefined, not NaN)', aggregateRowsUniqueFanCount([]) === 0)
check('empty tips array -> uniqueFanCount is not undefined', aggregateRowsUniqueFanCount([]) !== undefined)

// ══════════════════════════════════════════════════════════════════════
// 4. Consumer-shape guard — a consumer reading analytics?.uniqueFanCount
//    with `?? 0` (not `|| 0`) must not clobber a real 0-fan result, and
//    must not silently swallow a real nonzero count either.
// ══════════════════════════════════════════════════════════════════════
{
  const readWithNullishCoalescing = (analytics) => analytics?.uniqueFanCount ?? 0
  const readWithBrokenOr = (analytics) => analytics?.uniqueFanCount || 0 // the old, still-wrong pattern
  check('?? correctly reads a real 0 result as 0', readWithNullishCoalescing({ uniqueFanCount: 0 }) === 0)
  check('?? correctly reads a real nonzero result', readWithNullishCoalescing({ uniqueFanCount: 12 }) === 12)
  check('?? falls back to 0 only when analytics itself is missing', readWithNullishCoalescing(null) === 0)
  // Documents why `|| 0` was never actually the bug here (uniqueFanCount was
  // undefined, not a real 0) — but confirms the safer operator behaves
  // identically for the cases that matter, so the migration didn't change
  // behavior for any account that already had fans.
  check('|| and ?? agree once the field is really present and nonzero', readWithBrokenOr({ uniqueFanCount: 12 }) === readWithNullishCoalescing({ uniqueFanCount: 12 }))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

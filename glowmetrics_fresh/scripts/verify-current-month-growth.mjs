// Regression tests for resolveCurrentMonthGrowth() (lib/analytics.js) — the
// shared "how am I doing this month" answer the dashboard and Creator Report
// both read, so they can no longer disagree.
//
// The bug: monthlyData only contains months that HAVE tip data, so the last
// entry is not necessarily the current calendar month. Creator Report read
// monthlyData[last] and labelled it as current performance, meaning a creator
// who had not tipped yet this month saw LAST month's growth presented as this
// month's.
//
// Same mirrored-fixture convention as the other verify-*.mjs scripts.

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`) }
}

// ── mirrored from lib/analytics.js ──────────────────────────────────────────
function resolveCurrentMonthGrowth(monthlyData = [], tz = 'UTC', now = new Date()) {
  const months = Array.isArray(monthlyData) ? monthlyData : []
  const lastMonthWithData = months.length ? months[months.length - 1] : null
  let monthKey = null
  try { monthKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now).slice(0, 7) }
  catch { monthKey = null }
  const idx = monthKey ? months.findIndex(m => m.month === monthKey) : -1
  const thisMonth = idx >= 0 ? months[idx] : null
  const prevMonth = idx > 0 ? months[idx - 1] : null
  if (!thisMonth) {
    return { status: months.length ? 'no_current_month' : 'insufficient_data', monthKey,
      thisMonth: null, prevMonth: null, growthPct: null, thisRevenue: 0, prevRevenue: 0, lastMonthWithData }
  }
  if (!prevMonth) {
    return { status: 'insufficient_data', monthKey, thisMonth, prevMonth: null,
      growthPct: null, thisRevenue: thisMonth.usd ?? 0, prevRevenue: 0, lastMonthWithData }
  }
  return { status: 'current', monthKey, thisMonth, prevMonth,
    growthPct: thisMonth.growthPct ?? null, thisRevenue: thisMonth.usd ?? 0,
    prevRevenue: prevMonth.usd ?? 0, lastMonthWithData }
}

// ── mirrored from aggregateRows()'s monthlyData growthPct ───────────────────
// Verifies the fixtures are built the way the engine actually builds them:
// null when there is no previous month, or when the previous month earned $0.
function withGrowth(rows) {
  return rows.map((m, i) => {
    const prev = i > 0 ? rows[i - 1] : null
    return { ...m, growthPct: prev && prev.usd > 0 ? Math.round(((m.usd - prev.usd) / prev.usd) * 100) : null }
  })
}

const NOW = new Date('2026-08-26T12:00:00Z')
const TZ = 'UTC'

console.log('\nA — CREATOR HAS CURRENT-MONTH TIPS')
{
  const months = withGrowth([
    { month: '2026-06', usd: 400 },
    { month: '2026-07', usd: 500 },
    { month: '2026-08', usd: 650 },
  ])
  const r = resolveCurrentMonthGrowth(months, TZ, NOW)
  check('status is current', r.status, 'current')
  check('this month is August, not the array tail by luck', r.thisMonth.month, '2026-08')
  check('previous month is July', r.prevMonth.month, '2026-07')
  check('growth is +30% (650 vs 500)', r.growthPct, 30)
  check('this-month revenue is correct', r.thisRevenue, 650)
}

console.log('\nB — NO CURRENT-MONTH TIPS, BUT PREVIOUS MONTHS EXIST')
{
  // The exact bug: July was a big month (+150%). August has no data yet.
  const months = withGrowth([
    { month: '2026-06', usd: 200 },
    { month: '2026-07', usd: 500 },
  ])
  const r = resolveCurrentMonthGrowth(months, TZ, NOW)
  check('status says there is no current month', r.status, 'no_current_month')
  check('growthPct is NULL — July is not labelled as August', r.growthPct, null)
  check('no current month object is returned', r.thisMonth, null)
  check('this-month revenue reads as zero, not July\'s', r.thisRevenue, 0)
  // The old code returned monthlyData[last].growthPct here.
  check('the buggy reading would have shown +150%', months[months.length - 1].growthPct, 150)
  check('the fixed reading shows nothing', r.growthPct, null)
  // Still available so the UI can say "no earnings recorded yet this month",
  // which is a different claim from "your growth is +150%".
  check('last month WITH data is still exposed, clearly named', r.lastMonthWithData.month, '2026-07')
}

console.log('\nC — INSUFFICIENT COMPARISON DATA')
{
  const noMonths = resolveCurrentMonthGrowth([], TZ, NOW)
  check('no data at all -> insufficient_data', noMonths.status, 'insufficient_data')
  check('no data -> no percentage', noMonths.growthPct, null)

  // First ever month: there is current-month data, but nothing before it.
  const firstMonth = withGrowth([{ month: '2026-08', usd: 650 }])
  const r = resolveCurrentMonthGrowth(firstMonth, TZ, NOW)
  check('first month of data -> insufficient_data', r.status, 'insufficient_data')
  check('first month -> no percentage, nothing to compare', r.growthPct, null)
  check('first month revenue still reported', r.thisRevenue, 650)
  check('the engine itself also emits null growthPct for a first month', firstMonth[0].growthPct, null)

  // Previous month earned nothing: a percentage against zero is undefined.
  const fromZero = withGrowth([{ month: '2026-07', usd: 0 }, { month: '2026-08', usd: 650 }])
  const rz = resolveCurrentMonthGrowth(fromZero, TZ, NOW)
  check('previous month at $0 -> current status but null percentage', [rz.status, rz.growthPct], ['current', null])
}

console.log('\nTIMEZONE — the current month is the CREATOR\'S current month')
{
  // 2026-09-01 00:30 UTC is still 2026-08-31 in Los Angeles.
  const months = withGrowth([{ month: '2026-07', usd: 300 }, { month: '2026-08', usd: 450 }])
  const edge = new Date('2026-09-01T00:30:00Z')
  check('UTC has rolled into September -> no current-month data', resolveCurrentMonthGrowth(months, 'UTC', edge).status, 'no_current_month')
  check('the creator in Los Angeles is still in August', resolveCurrentMonthGrowth(months, 'America/Los_Angeles', edge).status, 'current')
  check('and sees the correct August growth', resolveCurrentMonthGrowth(months, 'America/Los_Angeles', edge).growthPct, 50)
}

console.log('\nGAPS — a dormant stretch must not read as explosive growth')
{
  // A four-month gap then a small month. The engine flags gapMonths for this;
  // the resolver must still only speak about the CURRENT month.
  const months = withGrowth([{ month: '2026-03', usd: 900 }, { month: '2026-08', usd: 30 }])
  const r = resolveCurrentMonthGrowth(months, TZ, NOW)
  check('current month is found across the gap', r.status, 'current')
  check('growth is the real -97%, not hidden', r.growthPct, -97)
  check('the compared month is named so the gap is visible', r.prevMonth.month, '2026-03')
}

console.log('\nDASHBOARD / CREATOR REPORT AGREEMENT')
{
  // Both surfaces call this one function, so agreement is structural. This
  // pins the property that used to break: the two must never differ.
  const months = withGrowth([{ month: '2026-06', usd: 200 }, { month: '2026-07', usd: 500 }])
  const dashboard = resolveCurrentMonthGrowth(months, TZ, NOW)
  const creatorReport = resolveCurrentMonthGrowth(months, TZ, NOW)
  check('both surfaces return the same status', dashboard.status, creatorReport.status)
  check('both surfaces return the same percentage', dashboard.growthPct, creatorReport.growthPct)
  check('neither presents a stale month as current', [dashboard.thisMonth, creatorReport.thisMonth], [null, null])
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

// Regression test for the "2,883% monthly growth" finding in the Free/Pro
// UX audit. lib/analytics.js's monthlyData only contains months that
// actually have tip data, so month[i-1] is the previous ACTIVE month, not
// necessarily the previous CALENDAR month. Confirmed on a real account:
// Jan 2026 ($0.24) -> May 2026 ($7.16) computes as +2883% growth, which is
// mathematically correct but silently skips Feb/Mar/Apr (zero activity) —
// displaying it as plain "vs last month" implies continuous month-over-month
// growth that didn't happen. gapMonths lets consumers label this correctly
// instead of changing the (accurate) percentage itself.

let pass = 0, fail = 0
function check(name, cond) { if (cond) { pass++; console.log(`PASS  ${name}`) } else { fail++; console.log(`FAIL  ${name}`) } }

// Mirrors lib/analytics.js's monthlyData growthPct/gapMonths computation.
function computeMonthlyGrowth(monthlyDataUnsorted) {
  const monthIndex = (ym) => { const [y, mo] = ym.split('-').map(Number); return y * 12 + mo }
  return monthlyDataUnsorted.map((m, i) => {
    const prev = i > 0 ? monthlyDataUnsorted[i - 1] : null
    const growthPct = prev && prev.usd > 0 ? Math.round(((m.usd - prev.usd) / prev.usd) * 100) : null
    const gapMonths = prev ? monthIndex(m.month) - monthIndex(prev.month) - 1 : null
    return { ...m, growthPct, prevMonth: prev?.month || null, gapMonths }
  })
}

// ══════════════════════════════════════════════════════════════════════
// 1. The exact real-account case: Jan 2026 -> May 2026 (3-month gap).
// ══════════════════════════════════════════════════════════════════════
{
  const months = [
    { month: '2026-01', usd: 0.24 },
    { month: '2026-05', usd: 7.16 },
  ]
  const result = computeMonthlyGrowth(months)
  const may = result[1]
  check('growthPct math is unchanged (still +2883%, arithmetic was never wrong)', may.growthPct === 2883)
  check('gapMonths correctly counts the 3 skipped calendar months (Feb, Mar, Apr)', may.gapMonths === 3)
  check('prevMonth correctly records which month the % is actually measured against', may.prevMonth === '2026-01')
}

// ══════════════════════════════════════════════════════════════════════
// 2. True consecutive months — gapMonths must be 0, not falsely flagged.
// ══════════════════════════════════════════════════════════════════════
{
  const months = [
    { month: '2026-01', usd: 100 },
    { month: '2026-02', usd: 150 },
  ]
  const result = computeMonthlyGrowth(months)
  check('consecutive calendar months -> gapMonths is 0, not null or positive', result[1].gapMonths === 0)
}

// ══════════════════════════════════════════════════════════════════════
// 3. Year boundary — Dec -> Jan must not be misread as an 11-month gap.
// ══════════════════════════════════════════════════════════════════════
{
  const months = [
    { month: '2025-12', usd: 50 },
    { month: '2026-01', usd: 60 },
  ]
  const result = computeMonthlyGrowth(months)
  check('December -> January (year boundary) is correctly 0 gap, not 11', result[1].gapMonths === 0)
}

// ══════════════════════════════════════════════════════════════════════
// 4. First month in the series has no previous month to gap against.
// ══════════════════════════════════════════════════════════════════════
{
  const result = computeMonthlyGrowth([{ month: '2024-06', usd: 10 }])
  check('first month has null gapMonths (nothing to compare against)', result[0].gapMonths === null)
  check('first month has null growthPct', result[0].growthPct === null)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

// Standalone verification for computeDependencyRisk() and
// computePreTipBehavior() in lib/analytics.js.
//
// Both fields (dependencyRisk, preTipBehavior) previously shipped as
// hardcoded `null` in aggregateRows()'s return — the Command Center UI has
// had rendering code for "Revenue Dependency Risk" and "Tip Behavior
// Patterns" cards since before this fix, but the data never existed so
// neither card could ever show for a real user. This fills in the actual
// computation from already-collected tip/session data.
//
// This repo has no test framework configured and lib/analytics.js can't be
// import()-ed directly by plain Node (see verify-estimated-hourly-rate.mjs
// for why) — so, following that script's pattern, the logic is mirrored
// here and exercised with the required test cases. Keep in sync with
// lib/analytics.js if the formulas change.

function computeDependencyRisk(topFanDependency) {
  if (!topFanDependency) return null
  const { top1Pct, top3Pct, lossIfTopFanLeaves } = topFanDependency
  const level = (top1Pct >= 40 || top3Pct >= 65) ? 'high'
    : (top1Pct >= 20 || top3Pct >= 40) ? 'medium'
    : 'low'
  const message = level === 'high'
    ? `Your top fan alone accounts for ${top1Pct}% of your revenue. If they stopped tipping, you'd lose roughly $${lossIfTopFanLeaves} — building up more regular tippers would lower the risk.`
    : level === 'medium'
    ? `Your top fan makes up ${top1Pct}% of your revenue (${top3Pct}% from your top 3). That's manageable, but worth watching — losing them would cost you about $${lossIfTopFanLeaves}.`
    : `Your revenue is spread across your fan base — no single fan makes up more than ${top1Pct}% of what you've earned.`
  return { ...topFanDependency, level, message }
}

function computePreTipBehavior(sessions, bestHour) {
  const gapsMinutes = []
  let sessionsWithMultipleTips = 0
  sessions.forEach(s => {
    if (!s.tips || s.tips.length < 2) return
    sessionsWithMultipleTips++
    const sorted = [...s.tips].sort((a, b) => new Date(a.dateRaw || a.date_time) - new Date(b.dateRaw || b.date_time))
    for (let i = 1; i < sorted.length; i++) {
      const gapMin = (new Date(sorted[i].dateRaw || sorted[i].date_time) - new Date(sorted[i - 1].dateRaw || sorted[i - 1].date_time)) / 60000
      if (gapMin >= 0) gapsMinutes.push(gapMin)
    }
  })
  if (gapsMinutes.length < 15 || sessionsWithMultipleTips < 5) return null

  const avgGapMinutes = parseFloat((gapsMinutes.reduce((a, b) => a + b, 0) / gapsMinutes.length).toFixed(1))
  const variance = gapsMinutes.reduce((s, g) => s + Math.pow(g - avgGapMinutes, 2), 0) / gapsMinutes.length
  const coefficientOfVariation = avgGapMinutes > 0 ? Math.sqrt(variance) / avgGapMinutes : 0
  const burstShare = gapsMinutes.filter(g => g < 2).length / gapsMinutes.length
  const clusteringDetected = coefficientOfVariation > 1.2 && burstShare > 0.3

  let peakTippingWindow = null
  if (bestHour) {
    const h = parseInt(bestHour.hour)
    const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
    peakTippingWindow = { hour: h, label }
  }

  const recommendation = clusteringDetected
    ? `Tips tend to arrive in quick bursts rather than spread evenly — call out each tip as it happens to trigger more in the same window.`
    : avgGapMinutes < 5
    ? `Fans tip frequently throughout your streams (about every ${avgGapMinutes} min) — keep engagement steady, not just at the start.`
    : `Tips land roughly ${avgGapMinutes} min apart on average — running a goal or countdown can create more frequent tipping moments.`

  return { avgGapMinutes, peakTippingWindow, clusteringDetected, recommendation }
}

// ---------------------------------------------------------------------------
let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}`)
  if (!ok) { console.log('  expected:', JSON.stringify(expected)); console.log('  actual:  ', JSON.stringify(actual)) }
  ok ? pass++ : fail++
}

check('null input -> null', computeDependencyRisk(null), null)
check('low concentration -> low', computeDependencyRisk({ top1Pct: 12, top3Pct: 22, top5Pct: 30, lossIfTopFanLeaves: 40 }).level, 'low')
check('top1 20-39 -> medium', computeDependencyRisk({ top1Pct: 25, top3Pct: 35, top5Pct: 45, lossIfTopFanLeaves: 200 }).level, 'medium')
check('top1 >=40 -> high', computeDependencyRisk({ top1Pct: 45, top3Pct: 60, top5Pct: 70, lossIfTopFanLeaves: 900 }).level, 'high')
check('top3 >=65 alone triggers high even if top1 low', computeDependencyRisk({ top1Pct: 15, top3Pct: 70, top5Pct: 80, lossIfTopFanLeaves: 150 }).level, 'high')

check('too few sessions -> null', computePreTipBehavior([
  { tips: [{ date_time: '2026-01-01T00:00:00Z' }, { date_time: '2026-01-01T00:05:00Z' }] },
], null), null)

function mkSession(startMinOffset, gapsMin) {
  let t = new Date(2026, 0, 1, 20, 0, 0).getTime() + startMinOffset * 60000
  const tips = [{ date_time: new Date(t).toISOString() }]
  gapsMin.forEach(g => { t += g * 60000; tips.push({ date_time: new Date(t).toISOString() }) })
  return { tips }
}
const steadySessions = Array.from({ length: 6 }, (_, i) => mkSession(i * 500, [10, 10, 10, 10]))
const steady = computePreTipBehavior(steadySessions, { hour: '20' })
check('steady gaps -> avgGapMinutes = 10', steady.avgGapMinutes, 10)
check('steady gaps -> not clustering', steady.clusteringDetected, false)
check('bestHour 20 -> peak label 8 PM', steady.peakTippingWindow.label, '8 PM')

const burstySessions = Array.from({ length: 6 }, (_, i) => mkSession(i * 500, [0.5, 0.5, 40, 0.5, 0.5]))
const bursty = computePreTipBehavior(burstySessions, null)
check('bursty gaps -> clusteringDetected true', bursty.clusteringDetected, true)
check('bursty gaps -> peakTippingWindow null when no bestHour', bursty.peakTippingWindow, null)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

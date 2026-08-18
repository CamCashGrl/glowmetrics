// Regression tests for the dead-UI resolution pass.
//
// BEFORE: lib/analytics.js hardcoded dependencyRisk/preTipBehavior/
// trueHourlyAvg to null/null/[], while app/dashboard/page.js carried a full
// "Revenue Dependency Risk" card and a "Tip Behavior Patterns" card gated on
// the first two — neither could ever render. The Smart Insights block also
// explicitly defers the concentration-risk framing to the dependency card
// ("that card owns the concentration-risk claim"), so that insight reached
// users NOWHERE, while /guides/chaturbate-earnings-tracker, several blog
// posts, and /landing/demo all advertise exactly this feature.
//
// AFTER:
//   dependencyRisk  -> IMPLEMENTED. Every number comes from the already-
//                      canonical topFanDependency; only a severity label and
//                      a factual restatement were added.
//   preTipBehavior  -> UI REMOVED. Its "peak tipping window" duplicated
//                      canonicalBestTimes.bestWindow, and clusteringDetected/
//                      recommendation had no definition anywhere — filling
//                      them in would have meant inventing metrics.
//   trueHourlyAvg   -> REMOVED. Never actually read by the heatmap a stale
//                      comment claimed used it.

import { readFileSync } from 'fs'

let pass = 0, fail = 0
function check(name, cond) { if (cond) { pass++; console.log(`PASS  ${name}`) } else { fail++; console.log(`FAIL  ${name}`) } }

// Mirrors lib/analytics.js's dependencyRisk derivation exactly.
const DEPENDENCY_MIN_FANS = 5
function computeDependencyRisk(topFanDependency, fanCount, totalUSD) {
  if (!topFanDependency || fanCount < DEPENDENCY_MIN_FANS) return null
  const { top1Pct, top3Pct, top5Pct, lossIfTopFanLeaves } = topFanDependency
  const level = (top1Pct >= 50 || top3Pct >= 80) ? 'high'
              : (top1Pct >= 30 || top3Pct >= 60) ? 'medium'
              : 'low'
  const message =
    level === 'high'
      ? `Your top fan is ${top1Pct}% of all revenue. If they stopped tipping, that's $${lossIfTopFanLeaves.toFixed(2)} of your $${totalUSD.toFixed(2)} lifetime total.`
      : level === 'medium'
        ? `Your top 3 fans are ${top3Pct}% of all revenue, and your top fan alone is ${top1Pct}%. Widening your tipping base lowers what one fan's departure costs you.`
        : `Your revenue is spread across your fan base — your top fan is ${top1Pct}% and your top 5 are ${top5Pct}% of the total.`
  return { level, message, top1Pct, top3Pct, top5Pct, lossIfTopFanLeaves, fanCount }
}

// The dashboard renders the card only when level !== 'low'.
const cardRenders = (d) => !!d && d.level !== 'low'

// ══════════════════════════════════════════════════════════════════════
// 1. The card can actually render now — the whole point of the fix.
// ══════════════════════════════════════════════════════════════════════
{
  const d = computeDependencyRisk({ top1Pct: 62, top3Pct: 81, top5Pct: 88, lossIfTopFanLeaves: 620.5 }, 40, 1000)
  check('single fan >=50% of revenue -> high', d.level === 'high')
  check('card actually renders (was structurally impossible before this fix)', cardRenders(d) === true)
  check('message restates only real numbers, no fabricated figures', d.message.includes('62%') && d.message.includes('$620.50') && d.message.includes('$1000.00'))
}

// ══════════════════════════════════════════════════════════════════════
// 2. Threshold provenance — the repo's own published editorial standard.
//    /landing/demo characterizes top1=42%/top3=72% as "Moderate
//    concentration"; those exact inputs must classify as 'medium', so the
//    dashboard and the marketing demo cannot contradict each other.
// ══════════════════════════════════════════════════════════════════════
{
  const d = computeDependencyRisk({ top1Pct: 42, top3Pct: 72, top5Pct: 80, lossIfTopFanLeaves: 420 }, 30, 1000)
  check("demo's own 42%/72% 'Moderate concentration' example classifies as medium", d.level === 'medium')
  check('medium card renders', cardRenders(d) === true)
}
{
  // The 50%-from-one-fan line is the blog's stated concentration-risk
  // threshold — verify it's the actual boundary, not an approximation.
  check('top1 = 49% is not yet high', computeDependencyRisk({ top1Pct: 49, top3Pct: 55, top5Pct: 60, lossIfTopFanLeaves: 490 }, 30, 1000).level === 'medium')
  check('top1 = 50% crosses into high (the published 50% line)', computeDependencyRisk({ top1Pct: 50, top3Pct: 55, top5Pct: 60, lossIfTopFanLeaves: 500 }, 30, 1000).level === 'high')
}

// ══════════════════════════════════════════════════════════════════════
// 3. Sample-size guard — below 5 unique fans these percentages are
//    arithmetically trivial, so no claim is made at all. Prevents telling a
//    creator with 3 fans that she has "high dependency risk".
// ══════════════════════════════════════════════════════════════════════
{
  // 3 fans: top3Pct is necessarily 100% — a guaranteed false "high".
  const trivial = { top1Pct: 70, top3Pct: 100, top5Pct: 100, lossIfTopFanLeaves: 70 }
  check('3 fans -> null, not a fabricated "high risk" claim', computeDependencyRisk(trivial, 3, 100) === null)
  check('4 fans -> still null (top5Pct is trivially 100% below 5 fans)', computeDependencyRisk(trivial, 4, 100) === null)
  check('5 fans -> claim is now made (matches canShowWhales() >=5 convention)', computeDependencyRisk(trivial, 5, 100) !== null)
  check('no card at all when guard trips (not an empty/broken card)', cardRenders(computeDependencyRisk(trivial, 3, 100)) === false)
}
{
  check('no fan data at all -> null', computeDependencyRisk(null, 0, 0) === null)
}

// ══════════════════════════════════════════════════════════════════════
// 4. Healthy diversification stays silent. Real regression CSV values
//    (1912 rows / 318 fans): top1=19%, top3=32%, top5=41%.
// ══════════════════════════════════════════════════════════════════════
{
  const d = computeDependencyRisk({ top1Pct: 19, top3Pct: 32, top5Pct: 41, lossIfTopFanLeaves: 88.9 }, 318, 469.52)
  check('real regression CSV account classifies as low (well-diversified)', d.level === 'low')
  check('low-risk account is not nagged with a risk card', cardRenders(d) === false)
}

// ══════════════════════════════════════════════════════════════════════
// 5. Dead UI is actually gone from the source — not just unreachable.
// ══════════════════════════════════════════════════════════════════════
{
  const analytics = readFileSync(new URL('../lib/analytics.js', import.meta.url), 'utf8')
  const dashboard = readFileSync(new URL('../app/dashboard/page.js', import.meta.url), 'utf8')
  const demo = readFileSync(new URL('../app/landing/demo/page.js', import.meta.url), 'utf8')

  check('analytics no longer returns a hardcoded-null dependencyRisk', !analytics.includes('dependencyRisk: null, preTipBehavior'))
  check('dashboard no longer reads analytics.preTipBehavior', !dashboard.includes('analytics?.preTipBehavior'))
  check('dashboard no longer reads analytics.trueHourlyAvg', !dashboard.includes('analytics?.trueHourlyAvg'))
  // Checks for the JSX text node (>Title<), not the bare words — the
  // explanatory comment left in place naturally names the removed card.
  check('"Tip Behavior Patterns" card no longer rendered in the dashboard', !dashboard.includes('>Tip Behavior Patterns<'))
  check('invented "clustering detected" claim is gone', !dashboard.includes('Tip clustering detected'))
  check('marketing demo no longer advertises the removed Pre-Stream Tip Behavior card', !demo.includes('Pre-Stream Tip Behavior'))
  // The concentration insight the demo DOES still advertise must remain real.
  check('demo still shows Revenue Concentration (now a genuinely shipping feature)', demo.includes('Revenue Concentration'))
  check('dashboard still renders the Revenue Dependency Risk card', dashboard.includes('Revenue Dependency Risk'))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

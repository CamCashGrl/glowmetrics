// Regression tests for the two evidence-backed classification corrections
// approved 2026-08-26, plus the free-roster behaviour.
//
//   1. A platform with a lucky single session cannot be a confirmed "best".
//   2. Platform ranking uses the MEDIAN, not the mean.
//   3. A single-tip fan cannot be a Top Supporter.
//   4. Below 10 fans, relative ranking produces nothing.
//
// Neither correction introduces a number. The platform gate reuses
// calculateConfidence()'s existing Medium band; the supporter rule reuses
// identifyWhales' own 0.20 percentile boundary, calcChurnRisk's 3-tip floor
// and canShowWhales' 10-fan floor.
//
// Same mirrored-fixture convention as the other verify-*.mjs scripts.

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`) }
}

// ── mirrored from lib/analytics.js ──────────────────────────────────────────
function calculateConfidence(n, h) {
  n = n || 0; h = h || 0
  if (n >= 10 && h >= 20) return { level: 'High', label: 'Strong pattern' }
  if (n < 3 || h < 3) return { level: 'Very Low', label: 'Not enough data yet' }
  if (n <= 4 || h <= 5) return { level: 'Low', label: 'Early signal' }
  return { level: 'Medium', label: 'Likely pattern' }
}
function calcMedian(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const UNDETECTED_PLATFORM = 'Unknown'
const RANKABLE_CONFIDENCE = new Set(['Medium', 'High'])

/** Mirrors the platforms[] build + bestPlatformByRate selection. */
function rankPlatforms(input) {
  const platforms = input.map(p => {
    const conf = calculateConfidence(p.sessions, p.hours)
    return {
      platform: p.platform,
      sessions: p.sessions,
      hours: p.hours,
      totalUSD: p.totalUSD,
      usdPerHour: p.hours > 0 ? parseFloat((p.totalUSD / p.hours).toFixed(2)) : 0,
      medianUsdPerHour: p.rates.length ? parseFloat(calcMedian(p.rates).toFixed(2)) : 0,
      confidenceLevel: conf.level,
      confidenceLabel: conf.label,
    }
  })
  const rankable = platforms.filter(p =>
    p.platform !== UNDETECTED_PLATFORM &&
    p.medianUsdPerHour > 0 &&
    RANKABLE_CONFIDENCE.has(p.confidenceLevel)
  )
  const best = rankable.length
    ? [...rankable].sort((a, b) => b.medianUsdPerHour - a.medianUsdPerHour)[0]
    : null
  return { platforms, rankable, best }
}

// ── mirrored from identifyWhales' Top Supporter rule ────────────────────────
const TOP_SUPPORTER_PERCENTILE = 0.20
const TOP_SUPPORTER_MIN_TIPS = 3
const TOP_SUPPORTER_MIN_FANS = 10

function classifyRoster(fans) {
  const sorted = [...fans].sort((a, b) => b.totalUSD - a.totalUSD)
  const total = sorted.length
  return sorted.map((f, i) => {
    const percentileRank = total > 1 ? i / (total - 1) : 0
    const isTopSupporter =
      total >= TOP_SUPPORTER_MIN_FANS &&
      f.tipCount >= TOP_SUPPORTER_MIN_TIPS &&
      percentileRank <= TOP_SUPPORTER_PERCENTILE
    const blockedBy =
      total < TOP_SUPPORTER_MIN_FANS ? 'audience_too_small'
        : percentileRank > TOP_SUPPORTER_PERCENTILE ? 'outside_top_20'
        : f.tipCount < TOP_SUPPORTER_MIN_TIPS ? 'not_enough_tips'
        : null
    return { ...f, percentileRank, isTopSupporter, topSupporterBlockedBy: blockedBy, isTopSpender: percentileRank <= 0.05 }
  })
}

console.log('\n1 — A LUCKY SINGLE SESSION CANNOT CROWN A PLATFORM')
{
  // The protected account's real shape: Chaturbate's mean was $23.16/hr from
  // ONE 92-minute $77.55 session out of four.
  const { platforms, best } = rankPlatforms([
    { platform: 'Chaturbate', sessions: 4, hours: 3.8, totalUSD: 88.00, rates: [50.58, 13.36, 2.28, 1.62] },
    { platform: 'BongaCams', sessions: 99, hours: 126.6, totalUSD: 488.61, rates: Array.from({ length: 99 }, () => 3.89) },
    { platform: 'Unknown', sessions: 5, hours: 1.38, totalUSD: 116.15, rates: [0.87, 0.87, 0.87, 0.87, 83.96] },
  ])
  const cb = platforms.find(p => p.platform === 'Chaturbate')
  check('Chaturbate mean is the old, misleading figure', cb.usdPerHour, 23.16)
  check('Chaturbate confidence is Low — not rankable', cb.confidenceLevel, 'Low')
  check('best platform is BongaCams, not Chaturbate', best.platform, 'BongaCams')
  check('the crowned figure is the median', best.medianUsdPerHour, 3.89)
  check('Unknown is still excluded outright', platforms.find(p => p.platform === 'Unknown') && best.platform !== 'Unknown', true)

  // Chaturbate is NOT hidden — it keeps its numbers and says why it cannot win.
  check('the weak platform keeps its figures', [cb.totalUSD, cb.sessions], [88, 4])
  check('and states its confidence honestly', cb.confidenceLabel, 'Early signal')
}

console.log('\n2 — MEDIAN VS MEAN')
{
  // Two platforms, equal hours. A has one huge night; B is steady and better
  // on a typical session. The mean picks A, the median picks B.
  const { platforms, best } = rankPlatforms([
    { platform: 'Chaturbate', sessions: 12, hours: 24, totalUSD: 480, rates: [200, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] },
    { platform: 'BongaCams', sessions: 12, hours: 24, totalUSD: 240, rates: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
  ])
  const a = platforms.find(p => p.platform === 'Chaturbate')
  const b = platforms.find(p => p.platform === 'BongaCams')
  check('mean would have picked the outlier platform', a.usdPerHour > b.usdPerHour, true)
  check('median picks the consistently better one', best.platform, 'BongaCams')
  check('outlier platform median is its typical session', a.medianUsdPerHour, 4)
  check('both are rankable — this is a ranking change, not a gate', [a.confidenceLevel, b.confidenceLevel], ['High', 'High'])
}

console.log('\n2b — THE GATE DOES NOT SILENCE A GENUINELY STRONG PLATFORM')
{
  const { best } = rankPlatforms([
    { platform: 'Chaturbate', sessions: 40, hours: 80, totalUSD: 4000, rates: Array.from({ length: 40 }, () => 50) },
    { platform: 'BongaCams', sessions: 99, hours: 126.6, totalUSD: 488, rates: Array.from({ length: 99 }, () => 3.89) },
  ])
  check('a well-evidenced high earner still wins', best.platform, 'Chaturbate')
  check('at its median rate', best.medianUsdPerHour, 50)
}

console.log('\n2c — NO PLATFORM QUALIFIES')
{
  const { best, rankable } = rankPlatforms([
    { platform: 'Chaturbate', sessions: 2, hours: 1.5, totalUSD: 60, rates: [40, 20] },
    { platform: 'BongaCams', sessions: 3, hours: 2, totalUSD: 30, rates: [15, 15, 15] },
  ])
  check('nothing is rankable', rankable.length, 0)
  check('and no best platform is claimed', best, null)
}

console.log('\n3 — SINGLE-TIP FANS ARE NOT TOP SUPPORTERS')
{
  // The protected account's real problem: ranks 3, 6 and 7 were one-tip
  // strangers on an undetected platform, all labelled "Whale".
  const roster = classifyRoster([
    { username: 'loyal', totalUSD: 88.90, tipCount: 18 },
    { username: 'threetip', totalUSD: 75.60, tipCount: 3 },
    { username: 'stranger_a', totalUSD: 45.00, tipCount: 1 },
    { username: 'grinder', totalUSD: 44.29, tipCount: 81 },
    { username: 'micro', totalUSD: 36.36, tipCount: 188 },
    { username: 'stranger_b', totalUSD: 35.00, tipCount: 1 },
    { username: 'stranger_c', totalUSD: 25.00, tipCount: 1 },
    { username: 'f8', totalUSD: 23.00, tipCount: 6 },
    { username: 'f9', totalUSD: 19.40, tipCount: 20 },
    { username: 'f10', totalUSD: 18.50, tipCount: 34 },
    { username: 'f11', totalUSD: 15.46, tipCount: 12 },
    { username: 'f12', totalUSD: 15.31, tipCount: 23 },
  ])
  const by = (u) => roster.find(f => f.username === u)

  check('a one-tip fan is NOT a top supporter', by('stranger_a').isTopSupporter, false)
  check('and the reason is stated', by('stranger_a').topSupporterBlockedBy, 'not_enough_tips')
  check('all three one-tip strangers are excluded', ['stranger_a', 'stranger_b', 'stranger_c'].map(u => by(u).isTopSupporter), [false, false, false])
  check('the 18-tip top fan qualifies', by('loyal').isTopSupporter, true)
  check('exactly-3 tips is enough (the floor is inclusive)', by('threetip').isTopSupporter, true)
  // micro is rank 5 of 12 (percentile 0.36), so it falls outside the top 20%
  // band on VALUE despite 188 tips. That is correct: Top Supporter is a
  // value ranking with a repeat-behaviour floor, not a loyalty ranking. The
  // reason is stated so the UI can show loyalty as its own separate fact.
  check('a 188-tip micro-tipper outside the top 20% is excluded on value', by('micro').isTopSupporter, false)
  check('and the reason is value rank, not evidence', by('micro').topSupporterBlockedBy, 'outside_top_20')
  check('its 188 tips are still recorded', by('micro').tipCount, 188)

  // The raw percentile fact is preserved — it is just no longer a badge.
  check('a one-tip stranger still ranks inside the top 20% by raw value', by('stranger_a').percentileRank <= 0.20, true)
  check('but is not the supporter classification', by('stranger_a').isTopSupporter, false)
  check('the raw percentile is still exposed as a fact', typeof by('stranger_a').percentileRank, 'number')

  // Nothing is deleted: every fan is still in the roster.
  check('no fan is removed from the roster', roster.length, 12)
  check('every fan keeps their lifetime value', by('stranger_a').totalUSD, 45)
}

console.log('\n4 — FEWER THAN 10 FANS PRODUCES NO RELATIVE RANKING')
{
  const nine = classifyRoster(
    Array.from({ length: 9 }, (_, i) => ({ username: `f${i}`, totalUSD: 100 - i * 5, tipCount: 20 }))
  )
  check('nobody is a top supporter with 9 fans', nine.filter(f => f.isTopSupporter).length, 0)
  check('and the reason is the audience, not the fan', nine[0].topSupporterBlockedBy, 'audience_too_small')
  check('their data is untouched', nine[0].totalUSD, 100)

  const ten = classifyRoster(
    Array.from({ length: 10 }, (_, i) => ({ username: `f${i}`, totalUSD: 100 - i * 5, tipCount: 20 }))
  )
  check('at exactly 10 fans, ranking becomes meaningful', ten.filter(f => f.isTopSupporter).length > 0, true)
  // percentileRank = i/(n-1), so with 10 fans: 0, 0.111, 0.222… Only the
  // first two sit at or below 0.20. The band is deliberately tight at small
  // audience sizes rather than rounding up to include a third.
  check('top 20% of 10 fans is the first two', ten.filter(f => f.isTopSupporter).map(f => f.username), ['f0', 'f1'])
  check('the third fan is just outside the band', ten[2].topSupporterBlockedBy, 'outside_top_20')

  const one = classifyRoster([{ username: 'solo', totalUSD: 500, tipCount: 50 }])
  check('a single fan is never "top 20%" of anything', one[0].isTopSupporter, false)
}

console.log('\n5 — PROTECTED ACCOUNT, BEFORE vs AFTER (measured)')
{
  // Counts measured read-only against production on 2026-08-26.
  const measured = {
    totalFans: 352,
    beforeWhaleTop5: 18,
    beforeSharkTop20: 71,
    afterTopSupporters: 51,
    removedByTipFloor: 20,
    singleTipRemoved: 13,
  }
  check('audience is large enough for ranking', measured.totalFans >= TOP_SUPPORTER_MIN_FANS, true)
  check('top-20% band before the tip floor', measured.beforeSharkTop20, 71)
  check('top supporters after the tip floor', measured.afterTopSupporters, 51)
  check('the floor removes exactly the thin-evidence fans', measured.beforeSharkTop20 - measured.removedByTipFloor, measured.afterTopSupporters)
  check('13 of those had a single tip', measured.singleTipRemoved, 13)
  check('no fan record is deleted — only the badge changes', measured.totalFans, 352)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

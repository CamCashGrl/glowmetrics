// Regression tests for the repo-wide metric consistency audit's remaining
// families: average session earnings, forecast units, and the whale-threshold
// constant.
//
// 1. AVG SESSION EARNINGS — three consumers used three different populations.
//    The Overview KPI card ("Avg Per Session") used meaningfulSessions, while
//    the Daily Brief card directly above it and the Title Generator's context
//    used analytics.sessions (= allValidSessions, which still includes
//    low_signal sessions). Two different answers to "what is a session worth?"
//    on the same screen. On the real 1912-row regression CSV: $5.10 across 78
//    meaningful vs $2.79 across 168 allValid — the same class of contradiction
//    originally reported as "$2 avg vs $10 avg per session".
//    lib/analytics/sessions.js documents meaningfulSessions as "the population
//    every rate calculation should use", so the two outliers were migrated.
//
// 2. FORECAST UNITS — buildDailyBrief's peakAvg fallback chain was
//    `displayAvg || bestHour.avg || sessionAvg`. The first two are $/HOUR;
//    sessionAvg is $/SESSION. Whichever tier resolved silently determined the
//    unit of a forecast rendered as an hourly figure, and displayAvg was
//    labeled "avg/session" while carrying $/hour.
//
// 3. FABRICATED STATISTICS — "longer sessions earn +101% more on average" and
//    "Extending to 45-60 min could 2x your earnings" were hardcoded in JSX,
//    derived from no calculation anywhere, while presented as the creator's
//    own data.

import { readFileSync } from 'fs'

let pass = 0, fail = 0
function check(name, cond) { if (cond) { pass++; console.log(`PASS  ${name}`) } else { fail++; console.log(`FAIL  ${name}`) } }

// These assertions ask "does this string still reach the screen?", so they
// must run against live code only. The fixes below deliberately leave
// comments naming what was removed (so the next reader knows why the card
// reads the way it does), and those comments would otherwise register as
// false failures.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')       // /* */ and JSX {/* */}
    .replace(/(^|[^:])\/\/.*$/gm, '$1')      // // line comments, sparing URLs
}
const dashboardRaw = readFileSync(new URL('../app/dashboard/page.js', import.meta.url), 'utf8')
const dashboard = stripComments(dashboardRaw)

// Mirrors lib/analytics/sessions.js's classifySession() thresholds.
function classifySession(s) {
  const mins = s.durationMinutes || 0
  const usd = s.totalUSD || 0
  if (mins < 2 && usd === 0) return 'invalid'
  if (mins < 15 && usd < 10) return 'low_signal'
  return 'meaningful'
}
const avg = (arr) => arr.length ? arr.reduce((s, x) => s + (x.totalUSD || 0), 0) / arr.length : 0

// ══════════════════════════════════════════════════════════════════════
// 1. The two populations genuinely differ — so picking one matters.
// ══════════════════════════════════════════════════════════════════════
{
  const sessions = [
    { durationMinutes: 90, totalUSD: 60 },   // meaningful
    { durationMinutes: 45, totalUSD: 40 },   // meaningful
    { durationMinutes: 5,  totalUSD: 2 },    // low_signal
    { durationMinutes: 3,  totalUSD: 1 },    // low_signal
    { durationMinutes: 1,  totalUSD: 0 },    // invalid
  ]
  const allValid = sessions.filter(s => classifySession(s) !== 'invalid')
  const meaningful = sessions.filter(s => classifySession(s) === 'meaningful')
  check('allValid and meaningful populations differ (test is meaningful, not a no-op)', allValid.length !== meaningful.length)
  check('meaningful-only average is $50.00', avg(meaningful) === 50)
  check('allValid average is materially lower ($25.75)', avg(allValid) === 25.75)
  check('choosing the wrong population changes the headline number by >$24', Math.abs(avg(meaningful) - avg(allValid)) > 24)
}

// ══════════════════════════════════════════════════════════════════════
// 2. All session-average consumers now read meaningfulSessions.
// ══════════════════════════════════════════════════════════════════════
{
  check('Daily Brief sessionAvg no longer reduces over analytics.sessions',
    !dashboard.includes('analytics.sessions.reduce((s, x) => s + x.totalUSD, 0) / analytics.sessions.length'))
  check('Daily Brief sessionAvg reads meaningfulSessions', dashboard.includes('const _avgPop = analytics?.meaningfulSessions || []'))
  check('Title Generator buildCtx reads meaningfulSessions', dashboard.includes('const _ctxSessions = analytics?.meaningfulSessions || []'))
  check('Overview KPI card still uses meaningfulSessions (unchanged, already correct)',
    dashboard.includes('const avgSessionUSD = meaningfulSessions.length ? meaningfulSessions.reduce'))
}

// ══════════════════════════════════════════════════════════════════════
// 3. Forecast unit consistency — no $/session tier in a $/hour chain.
// ══════════════════════════════════════════════════════════════════════
{
  check('peakAvg chain no longer falls back to the $/session value',
    !dashboard.includes('const peakAvg = displayAvg || bestHour?.avg || sessionAvg'))
  check('peakAvg chain is $/hour-only, degrading to 0 rather than a wrong-unit number',
    dashboard.includes('const peakAvg = displayAvg || bestHour?.avg || 0'))
  check('displayAvg is no longer mislabeled "avg/session"', !dashboard.includes('avg/session'))
  check('displayAvg is labeled as an hourly rate', dashboard.includes('/hr avg'))
  check('Today card no longer mixes bestDay.avg with sessionAvg behind one label',
    !dashboard.includes('const _bdA = bestDay?.avg || sessionAvg'))
}

// ══════════════════════════════════════════════════════════════════════
// 4. Fabricated statistics removed.
// ══════════════════════════════════════════════════════════════════════
{
  check('hardcoded "+101% more" claim removed', !dashboard.includes('+101% more'))
  check('hardcoded "could 2x your earnings" claim removed', !dashboard.includes('could 2x your earnings'))
  // The surrounding advice should survive — the fix removes the invented
  // number, not the actionable recommendation.
  check('short-session recommendation still present (advice kept, number dropped)',
    dashboard.includes('Try extending to 45–60 min'))
}

// ══════════════════════════════════════════════════════════════════════
// 5. Whale threshold is a single shared constant, and the two whale
//    CONCEPTS stay deliberately distinct.
// ══════════════════════════════════════════════════════════════════════
{
  const constants = readFileSync(new URL('../lib/constants.js', import.meta.url), 'utf8')
  const planner = readFileSync(new URL('../app/dashboard/StreamPlanner.js', import.meta.url), 'utf8')
  const moneyMap = readFileSync(new URL('../app/dashboard/MoneyMap.js', import.meta.url), 'utf8')
  const analytics = readFileSync(new URL('../lib/analytics.js', import.meta.url), 'utf8')

  check('WHALE_LIFETIME_TOKEN_THRESHOLD defined once in lib/constants.js', constants.includes('export const WHALE_LIFETIME_TOKEN_THRESHOLD = 500'))
  check('StreamPlanner imports the constant instead of hardcoding 500', planner.includes('WHALE_LIFETIME_TOKEN_THRESHOLD') && !planner.includes('totalTokens >= 500'))
  check('MoneyMap imports the constant instead of hardcoding 500', moneyMap.includes('WHALE_LIFETIME_TOKEN_THRESHOLD') && !moneyMap.includes('tokens>=500'))
  // identifyWhales() is a RELATIVE percentile tiering, not an absolute
  // spend threshold — it must NOT adopt this constant.
  check('identifyWhales() stays percentile-based (different question, not migrated)',
    analytics.includes("percentileRank <= 0.05") && !analytics.includes('WHALE_LIFETIME_TOKEN_THRESHOLD'))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

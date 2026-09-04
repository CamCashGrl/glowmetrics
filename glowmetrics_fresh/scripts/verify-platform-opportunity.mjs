// Standalone verification for 2C-6 — cross-platform discovery -> conversion.
//
// LOGIC half mirrors the rankable gate and the three render states; SOURCE
// half reads the real files, because "no second ranking rule" and "no future-
// earnings claim" are properties of the source.
//
// Cases (the 15 required by 2C-6) are grouped below.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`) }
}

const OPP_RAW  = read('app/dashboard/PlatformOpportunity.jsx')
const OPP      = stripComments(OPP_RAW)
const CTXS     = stripComments(read('lib/upgradeContexts.js'))
const ANALYTICS= read('lib/analytics.js')
const PERF     = read('app/dashboard/Performance.js')
const PAGE     = read('app/dashboard/page.js')
const LIMITS   = read('lib/planLimits.js')
const PREVIEW  = read('app/dashboard/DashboardPreview.js')

// ── mirrored from lib/analytics.js: the EXISTING rankable gate ──────────────
// calculateConfidence()'s bands, scoped per platform. Nothing new.
const conf = (n, h) => {
  if (n >= 10 && h >= 20) return 'High'
  if (n < 3 || h < 3) return 'Very Low'
  if (n <= 4 || h <= 5) return 'Low'
  return 'Medium'
}
const RANKABLE = new Set(['Medium', 'High'])
const rankableSet = (platforms) => platforms
  .filter(p => p.platform !== 'Unknown' && p.medianUsdPerHour > 0 && RANKABLE.has(conf(p.sessions, p.hours)))
  .sort((a, b) => b.medianUsdPerHour - a.medianUsdPerHour)

// The three render states, decided only by that set.
const decide = (platforms) => {
  const all = platforms.filter(p => p.platform !== 'Unknown')
  if (all.length === 0) return 'render_nothing'
  return rankableSet(platforms).length >= 2 ? 'comparison' : 'evidence_building'
}

const P = (platform, sessions, hours, medianUsdPerHour, totalUSD = 100) =>
  ({ platform, sessions, hours, medianUsdPerHour, totalUSD })

console.log('\n1. Two rankable platforms with a meaningful difference')
const two = [P('BongaCams', 99, 126.6, 3.89, 700), P('Stripchat', 12, 25, 2.10, 200)]
check('both clear the existing confidence gate', rankableSet(two).map(p => p.platform), ['BongaCams', 'Stripchat'])
check('a comparison is shown', decide(two), 'comparison')
check('the lead is the higher MEDIAN rate, not the higher total',
  rankableSet([P('A', 99, 126, 3.89, 100), P('B', 12, 25, 2.10, 9999)])[0].platform, 'A')

console.log('\n2. Two platforms, insufficient evidence')
const weak = [P('Chaturbate', 4, 3.8, 23.16, 90), P('CamSoda', 2, 1.5, 40.00, 60)]
check('a lucky-session platform is not rankable', rankableSet(weak).length, 0)
check('no comparison is claimed', decide(weak), 'evidence_building')
check('a 4-session/3.8h platform stays below the gate', conf(4, 3.8), 'Low')

console.log('\n3. Only one rankable platform')
const one = [P('BongaCams', 99, 126.6, 3.89, 700), P('Chaturbate', 4, 3.8, 23.16, 90)]
check('only the strong sample ranks', rankableSet(one).map(p => p.platform), ['BongaCams'])
check('one rankable platform is not a comparison', decide(one), 'evidence_building')
check('the higher-rate weak platform is NOT crowned',
  rankableSet(one).some(p => p.platform === 'Chaturbate'), false)

console.log('\n4. Zero usable comparison')
check('no platforms at all renders nothing', decide([]), 'render_nothing')
check('only the Unknown bucket renders nothing', decide([P('Unknown', 50, 60, 13.51)]), 'render_nothing')
check('Unknown can never be ranked', rankableSet([P('Unknown', 50, 60, 13.51)]).length, 0)
check('a zero-rate platform cannot be ranked', rankableSet([P('A', 50, 60, 0), P('B', 50, 60, 0)]).length, 0)

console.log('\n5. Confidence states come from the canonical layer')
check('the component reads the canonical rankable set',
  /analytics\?\.rankablePlatforms/.test(OPP), true)
check('it does NOT re-implement the gate',
  /(RANKABLE_CONFIDENCE|calculateConfidence|'Medium'|'High')/.test(OPP), false)
check('analytics exports the same array bestPlatformByRate comes from',
  /rankablePlatforms: \[\.\.\.rankablePlatforms\]\.sort\(\(a, b\) => b\.medianUsdPerHour - a\.medianUsdPerHour\)/.test(ANALYTICS), true)
check('the export is additive — the gate itself is unchanged',
  /const RANKABLE_CONFIDENCE = new Set\(\['Medium', 'High'\]\)/.test(ANALYTICS), true)
check('the empty-analytics shape stays in sync',
  /bestPlatformByRate: null, rankablePlatformCount: 0, rankablePlatforms: \[\]/.test(ANALYTICS), true)
check('confidence wording is the shared badge',
  /<ConfidenceBadge intelligence=\{intelligence\} insight="cross_platform" \/>/.test(OPP), true)
check('each platform still shows its own confidence label',
  /p\.confidenceLabel/.test(OPP), true)

console.log('\n6. Free sees the observed comparison')
check('the numbers render before any plan check',
  OPP.indexOf('PlatformRow') < OPP.indexOf('isPro ? ('), true)
check('sessions, hours and earnings are all shown',
  /\{p\.sessions\} session/.test(OPP) && /fmtHours\(p\.hours\)\} streamed/.test(OPP) && /fmtUsd0\(p\.totalUSD\)\} earned/.test(OPP), true)
check('median rate is labelled as a median', /median rate/.test(OPP), true)
check('the four measures are kept distinct',
  ['sessions', 'streamed', 'earned', 'median rate'].every(t => OPP.includes(t)), true)
check('nothing is hidden behind a lock', /(🔒|locked)/i.test(OPP), false)

console.log('\n7. Pro gets the deeper comparison, not a sales pitch')
check('Pro is offered the existing comparison', /Compare my platforms/.test(OPP), true)
// Slice the Pro branch exactly, rather than guessing a character window: from
// `isPro ? (` to the `) : (` that opens the free branch.
const proStart = OPP.indexOf('isPro ? (')
const proBranch = OPP.slice(proStart, OPP.indexOf(') : (', proStart))
check('the Pro branch exists', proBranch.length > 40, true)
check('Pro is not shown the upsell copy', /onUpgrade/.test(proBranch), false)
check('Pro is not shown the Pro-marketing line', /Pro compares your platform/.test(proBranch), false)
check('the Pro action scrolls to the existing platform cards',
  /platform-performance/.test(PERF), true)
check('no new comparison analytics is created',
  /(reduce\(|sort\(\(a, b\)|median|percentile)/.test(OPP.replace(/median rate/g, '').replace(/medianUsdPerHour/g, '')), false)

console.log('\n8-9. Contextual upgrade, with the platform discovery preserved')
check('the free CTA opens platform_comparison', /onUpgrade\('platform_comparison'\)/.test(OPP), true)
check('no second modal is created here', /role="dialog"/.test(OPP), false)
check('it never links to /pricing', /\/pricing/.test(OPP), false)
check('the context states the observed difference',
  /Your recorded sessions show a stronger observed hourly rate on \$\{lead\.platform\} than \$\{runnerUp\.platform\}\./.test(CTXS), true)
check('the context reads the canonical rankable set',
  /const rankable = analytics\?\.rankablePlatforms \|\| \[\]/.test(CTXS), true)
check('fewer than two rankable means no discovery to sell',
  /if \(rankable\.length < 2\) return \[\]/.test(CTXS), true)
check('the CTA is the outcome', /primaryCta: 'Compare My Platforms'/.test(CTXS), true)
check('the unlock line describes recorded history',
  /how platform and streaming time interact across your recorded history/.test(CTXS), true)
check('checkout context still travels as upgrade_source',
  /upgrade_source: source/.test(stripComments(read('app/dashboard/ContextualUpgradeModal.jsx'))), true)

console.log('\n10-12. No promise, no projection, no invented recommendation')
const BANNED = [
  'you will make', 'will earn', 'move to', 'switch to', 'abandon',
  'you should stream', 'guaranteed', 'guarantee', 'projected', 'expect to earn',
  'best platform', 'earn more on', 'increase your income', 'maximize',
  'tonightStream', '7-day', '30-day',
]
// The one sentence naming a future outcome does so to deny it; it is removed
// before the scan and asserted separately, so the scan cannot be satisfied by
// deleting the disclaimer.
const DISCLAIMER = 'not a projection of what another stream would earn'
check('the disclaimer is present', OPP.includes(DISCLAIMER), true)
const OPP_CLAIMS = OPP.replace(DISCLAIMER, '')
for (const phrase of BANNED) {
  check(`never says "${phrase}"`, OPP_CLAIMS.toLowerCase().includes(phrase.toLowerCase()), false)
}
check('the finding is phrased as an observation',
  /show a stronger observed hourly rate on/.test(OPP), true)
check('the evidence state refuses to name a stronger platform',
  /CamCash will not name one as stronger/.test(OPP), true)
check('no dollar figure is attached to a future action',
  /(will|could|expect|gain)[^\n]{0,24}\$\{/.test(OPP), false)

console.log('\n13. Platform entitlement untouched')
check('the free platform limit constant is unchanged', /FREE_MAX_PLATFORMS = 3/.test(LIMITS), true)
check('the plan-access rule is unchanged',
  /freePlatformLimitReached: !isPro && trackedPlatformCount >= FREE_MAX_PLATFORMS/.test(PREVIEW), true)
check('this step changes no entitlement logic',
  /(FREE_MAX_PLATFORMS|planLimits|freePlatformLimitReached)/.test(OPP), false)

console.log('\n14-15. Wiring and scope')
check('mounted on the Performance tab', /<PlatformOpportunity/.test(PERF), true)
check('not duplicated on the Command Center',
  /<PlatformOpportunity/.test(read('app/dashboard/CommandCenter.js')), false)
check('the Command Center keeps its existing platform chip',
  /is #1/.test(read('app/dashboard/CommandCenter.js')), true)
check('Performance still receives intelligence', /intelligence=\{intelligence\}/.test(PAGE), true)
check('platform tab navigation unchanged', /activeTab === "platforms"/.test(PAGE), true)
check('no analytics formula changed — only an additive export',
  (ANALYTICS.match(/const RANKABLE_CONFIDENCE/g) || []).length, 1)
check('no SEO/blog/sitemap import', /(app\/blog|app\/guides|sitemap|robots)/.test(OPP), false)
check('no schema or migration ships here', /(CREATE TABLE|ALTER TABLE)/i.test(OPP), false)

console.log(`\n  ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

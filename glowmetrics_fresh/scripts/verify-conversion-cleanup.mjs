// Standalone verification for 2C-7 — the final conversion cleanup.
//
// This suite is almost entirely SOURCE assertions, because what 2C-7 changed
// is which prompts exist and what they claim — properties of the files, not of
// a return value. It is the guard that stops a generic upgrade prompt, a
// second checkout, or a fabricated capability from creeping back in.
//
// Cases (the 20 required by 2C-7) are grouped below.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`) }
}

// Every dashboard source, comments stripped — what actually reaches a creator.
const DASH_DIR = join(ROOT, 'app/dashboard')
const FILES = Object.fromEntries(
  readdirSync(DASH_DIR)
    .filter(f => /\.(js|jsx)$/.test(f))
    .map(f => [f, stripComments(read(`app/dashboard/${f}`))])
)
const ALL = Object.values(FILES).join('\n')
const PAGE = FILES['page.js']

console.log('\n1. No duplicate Pro CTA at the same value moment')
// One contextual conversion per surface. These counts are the guard: if a
// second CTA is added beside an existing one, the count moves and this fails.
const ctaCount = (file, re) => (FILES[file].match(re) || []).length
check('Performance has exactly one upgrade CTA', ctaCount('Performance.js', /onUpgrade\?\./g), 1)
check('Fans has one priority CTA plus the shared overlap block',
  ctaCount('Fans.js', /onUpgrade\?\.\(/g), 1)
check('the overlap block owns its own single CTA',
  ctaCount('WindowFanOverlap.jsx', /onUpgrade\(/g), 1)
check('the plan card owns its own single CTA',
  ctaCount('PeakWindowPlan.jsx', /onUpgrade\(/g), 1)
check('the platform card owns its own single CTA',
  ctaCount('PlatformOpportunity.jsx', /onUpgrade\(/g), 1)
check('the onboarding checklist no longer carries an upgrade CTA',
  /onUpgrade/.test(FILES['OnboardingChecklist.js']), false)

console.log('\n2-3. Discovery CTAs route through the shared contextual modal')
check('exactly one upgrade modal component exists',
  Object.keys(FILES).filter(f => /UpgradeModal/.test(f)), ['ContextualUpgradeModal.jsx'])
check('exactly one checkout call in the whole dashboard',
  (ALL.match(/fetch\('\/api\/stripe\/checkout'/g) || []).length, 1)
check('Settings no longer runs its own checkout',
  /startCheckout/.test(FILES['Settings.js']), false)
check('Settings no longer hardcodes a price in its label',
  /\$19\.99/.test(FILES['Settings.js']), false)
check('Settings keeps billing management',
  /openBillingPortal/.test(FILES['Settings.js']), true)
for (const [src, file] of [
  ['window_fan_overlap', 'WindowFanOverlap.jsx'],
  ['stream_planner', 'PeakWindowPlan.jsx'],
  ['platform_comparison', 'PlatformOpportunity.jsx'],
  ['whales_cutoff', 'Fans.js'],
]) check(`${file} uses the ${src} context`, FILES[file].includes(`'${src}'`) || FILES[file].includes(`"${src}"`), true)
check('no CTA uses a source missing from the catalogue',
  /fans_priority_locked/.test(ALL), false)

console.log('\n4. Public pricing stays reachable, and only as the secondary path')
check('the modal still links to /pricing', /href="\/pricing"/.test(FILES['ContextualUpgradeModal.jsx']), true)
check('no other dashboard file links to /pricing',
  Object.entries(FILES).filter(([n, s]) => n !== 'ContextualUpgradeModal.jsx' && /href="\/pricing"|push\('\/pricing'\)/.test(s)).map(([n]) => n), [])
check('the public pricing page still exists', read('app/pricing/page.js').length > 0, true)

console.log('\n5. Free factual data stays visible')
check('the fan roster is still free and complete',
  /the full roster, free/.test(read('app/dashboard/Fans.js')), true)
check('the Money Map heatmap tab is still free', /tab==="map" && <MoneyMapTab/.test(FILES['MoneyMap.js']), true)
check('raw MEASURE stats carry no badge',
  FILES['CommandCenter.js'].split('\n').filter(l => l.includes('<Stat ')).some(l => l.includes('ConfidenceBadge')), false)
check('the free platform limit rule is unchanged',
  /freePlatformLimitReached: !isPro && trackedPlatformCount >= FREE_MAX_PLATFORMS/.test(FILES['DashboardPreview.js']), true)
check('data-needed messages survive (they are not paywalls)',
  /Unlocks after 3 eligible sessions and 60 minutes tracked/.test(PAGE), true)

console.log('\n6. Creator Report keeps no local confidence logic')
check('no local confidence table', /STATE_LABEL/.test(FILES['CreatorReport.js']), false)
check('it reads the canonical vocabulary', /badgeFor\(/.test(FILES['CreatorReport.js']), true)
check('it computes no confidence of its own',
  /calculateConfidence\(/.test(FILES['CreatorReport.js']), false)
check('it uses the shared upgrade path only', /onUpgrade/.test(FILES['CreatorReport.js']), true)

console.log('\n7-8. One coherent conversion action per surface')
check('Command Center mounts the plan discovery', /<PeakWindowPlan/.test(FILES['CommandCenter.js']), true)
check('Command Center mounts the fan discovery', /<WindowFanOverlap/.test(FILES['CommandCenter.js']), true)
check('Command Center does not also mount the platform block',
  /<PlatformOpportunity/.test(FILES['CommandCenter.js']), false)
check('Performance owns the platform conversion', /<PlatformOpportunity/.test(FILES['Performance.js']), true)
check('Performance no longer carries the generic strategy footer',
  /Build My Strategy/.test(FILES['Performance.js']), false)

console.log('\n9-11. Fans, planner and Money Map keep their established flows')
check('Fans mounts the shared overlap block', /<WindowFanOverlap/.test(FILES['Fans.js']), true)
check('Fans keeps its factual rows unbadged',
  FILES['Fans.js'].slice(FILES['Fans.js'].indexOf('ALL SUPPORTERS')).includes('ConfidenceBadge'), false)
check('Stream Planner uses the contextual path', /onUpgrade\?\.\('stream_planner'\)/.test(FILES['StreamPlanner.js']), true)
check('Money Map uses the contextual path', /onUpgrade\?\.\('money_map'\)/.test(FILES['MoneyMap.js']), true)
// D5/D6 are explicitly out of scope and must still be intact.
check('D5 tips<20 gate untouched in StreamPlanner', FILES['StreamPlanner.js'].includes('tips.length < 20'), true)
check('D5 tips<20 gate untouched in MoneyMap', FILES['MoneyMap.js'].includes('tips.length < 20'), true)
check('the 4-week rule untouched', read('app/dashboard/StreamPlanner.js').includes('Stream 4+ weeks'), true)
check('D6 inline sample gates untouched', FILES['AnalyticsCharts.js'].includes('points.length < 3'), true)

console.log('\n12. The sidebar stays a valid generic navigation entry')
check('it opens the shared modal, not a legacy one', /onUpgrade\?\.\('default'\)/.test(FILES['Sidebar.js']), true)
check('it names no price of its own', /\$\d/.test(FILES['Sidebar.js']), false)
check('it claims no specific feature', /(predict|forecast|guarantee)/i.test(FILES['Sidebar.js']), false)

console.log('\n13-15. No unsupported capability claims anywhere in the dashboard')
const BANNED = [
  'AI Predictions', 'AI fan behavior', 'return forecasts', 'Predicted next tip size',
  '30-day revenue forecast', 'Engagement score', 'likely to tip again soon',
  'Earnings forecasting', 'Whale detection', 'is a Creator Pro feature',
  'See what Pro unlocks', 'guaranteed', 'maximize your income', 'make more money',
]
for (const phrase of BANNED) {
  const offenders = Object.entries(FILES).filter(([, s]) => s.includes(phrase)).map(([n]) => n)
  check(`no dashboard file says "${phrase}"`, offenders, [])
}
check('the fan profile states the cadence as an observation',
  /Observed tipping pattern/.test(PAGE), true)
check('and says outright that it predicts nothing',
  /CamCash does not predict whether or when they will tip again/.test(PAGE), true)
check('the evidence list no longer quotes retired counter thresholds',
  /25\+ tips & 3\+ sessions|10\+ fans & \$50\+ earned|8\+ sessions & \$50\+ earned/.test(PAGE), false)
check('it reads the canonical next-milestone instead',
  /intelligence\?\.insights\?\.\[id\]/.test(PAGE) && /nextMilestone\.label/.test(PAGE), true)
check('claimability uses the canonical ladder comparison',
  /atLeast\(e\.state, CLAIMABLE_FLOOR\)/.test(PAGE), true)

console.log('\n16-17. Nothing analytical or persistent moved')
check('no analytics module imported by any conversion component',
  ['ContextualUpgradeModal.jsx', 'WindowFanOverlap.jsx', 'PeakWindowPlan.jsx', 'PlatformOpportunity.jsx']
    .filter(f => /lib\/analytics/.test(FILES[f])), [])
check('the platform confidence gate is untouched',
  (read('lib/analytics.js').match(/const RANKABLE_CONFIDENCE = new Set\(\['Medium', 'High'\]\)/g) || []).length, 1)
check('the claimable floor is untouched',
  /CLAIMABLE_FLOOR = INSIGHT_STATE\.SUPPORTED/.test(read('lib/intelligence/states.js')), true)
check('no schema or migration ships here', /(CREATE TABLE|ALTER TABLE)/i.test(ALL), false)
check('no Stripe product/price/webhook edit in the dashboard',
  /(products\.|prices\.create|webhook)/.test(ALL), false)
check('no price id is hardcoded anywhere in the dashboard', /price_[A-Za-z0-9]{6}/.test(ALL), false)

console.log('\n18-20. Checkout, navigation and mobile still intact')
const MODAL = FILES['ContextualUpgradeModal.jsx']
check('checkout still posts a plan_type', /plan_type: plan/.test(MODAL), true)
check('both plans are still offered', /standard_monthly/.test(MODAL) && /standard_annual/.test(MODAL), true)
check('the discovery still travels to checkout', /upgrade_source: source/.test(MODAL), true)
check('success still returns to the originating tab', /if \(tab\) \{ setActiveTab\(tab\)/.test(PAGE), true)
check('every tab still renders', [
  'overview', 'report', 'platforms', 'whales', 'planner', 'moneymap', 'analytics', 'settings',
].filter(t => !PAGE.includes(`activeTab === '${t}'`) && !PAGE.includes(`activeTab === "${t}"`)), [])
check('the modal is still a labelled dialog', /role="dialog"/.test(MODAL) && /aria-modal="true"/.test(MODAL), true)
check('Escape still closes it', /e\.key === 'Escape'/.test(MODAL), true)
check('the mobile bottom sheet is intact',
  /alignItems: 'flex-end'/.test(MODAL) && /@media \(min-width: 620px\)/.test(MODAL), true)

console.log(`\n  ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

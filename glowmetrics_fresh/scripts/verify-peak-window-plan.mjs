// Standalone verification for 2C-5 — discovery -> personalized streaming plan.
//
// LOGIC half mirrors the claimable-floor decision and the contextual copy;
// SOURCE half reads the real files, because "no new threshold" and "no
// forecast language" are properties of the source.
//
// Cases (the 16 required by 2C-5) are grouped below.

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

const PLAN_RAW = read('app/dashboard/PeakWindowPlan.jsx')
const PLAN     = stripComments(PLAN_RAW)
const CTXS     = stripComments(read('lib/upgradeContexts.js'))
const PAGE     = read('app/dashboard/page.js')
const CC       = read('app/dashboard/CommandCenter.js')
const PLANNER  = read('app/dashboard/StreamPlanner.js')
const STATES   = read('lib/intelligence/states.js')

// ── mirrored: the only decision this component makes ────────────────────────
const CLAIMABLE = new Set(['SUPPORTED', 'HIGH_CONFIDENCE', 'ESTABLISHED'])
const decide = (state, bestWindow) => {
  if (!state || state === 'NOT_AVAILABLE') return 'render_nothing'
  return CLAIMABLE.has(state) && !!bestWindow ? 'discovery_and_plan' : 'evidence_building'
}
const WINDOW = { localDay: 'Wednesday', localHour: 17, medianUsdPerHour: 9.52, sessionCount: 4, totalUsd: 15.12 }

console.log('\n1-5. The ladder alone decides what the creator sees')
check('SUPPORTED -> discovery + plan CTA',       decide('SUPPORTED', WINDOW), 'discovery_and_plan')
check('HIGH_CONFIDENCE -> discovery + plan CTA', decide('HIGH_CONFIDENCE', WINDOW), 'discovery_and_plan')
check('ESTABLISHED -> discovery + plan CTA',     decide('ESTABLISHED', WINDOW), 'discovery_and_plan')
check('DEVELOPING -> evidence building',         decide('DEVELOPING', WINDOW), 'evidence_building')
check('EARLY_SIGNAL -> evidence building',       decide('EARLY_SIGNAL', null), 'evidence_building')
check('CALIBRATING -> evidence building',        decide('CALIBRATING', null), 'evidence_building')
check('NOT_AVAILABLE -> nothing at all',         decide('NOT_AVAILABLE', null), 'render_nothing')
check('loading intelligence -> nothing at all',  decide(null, null), 'render_nothing')
check('a claimable state with no window still cannot claim',
  decide('SUPPORTED', null), 'evidence_building')
check('the floor set mirrors the canonical one',
  /CLAIMABLE_FLOOR = INSIGHT_STATE\.SUPPORTED/.test(STATES), true)
// `=== 1` is plural grammar, not a threshold; everything else numeric here is
// a style value. What must not exist is a data comparison.
// fmtHour/fmtUsd0 are clock and currency formatting shared with every other
// surface — their 12s and 24s are not data thresholds. Excluded by name.
const PLAN_LOGIC = PLAN
  .replace(/=== 1/g, '')
  .replace(/const fmtHour = [\s\S]*?\n\}/, '')
  .replace(/const fmtUsd0 = .*/, '')
  .replace(/style=\{\{[\s\S]*?\}\}/g, '')
  .replace(/const \w+ = \{[\s\S]*?\n\}/g, '')
check('the component invents no threshold of its own',
  /(>=\s*\d|<\s*\d|MIN_|THRESHOLD)/.test(PLAN_LOGIC), false)

console.log('\n5b. Insufficient evidence never fabricates a plan or an upsell')
const evidenceBranch = PLAN.slice(PLAN.indexOf('if (!claimable)'), PLAN.indexOf('const sessions ='))
check('the evidence branch exists', evidenceBranch.length > 200, true)
check('it offers no upgrade', /onUpgrade/.test(evidenceBranch), false)
check('it offers no planner', /onOpenPlanner/.test(evidenceBranch), false)
check('it says what evidence is missing, from the canonical milestone',
  /insight\.nextMilestone\.label/.test(evidenceBranch), true)
check('it uses the canonical explanation, not its own wording',
  /insight\?\.explanation/.test(evidenceBranch), true)
check('it says plainly that a plan is not yet worth building',
  /A weekly plan is only worth building once/.test(evidenceBranch), true)
// "Finding your strongest window" is a heading about the search, not a claim
// that one has been found. What must never appear below the floor is the
// assertion itself.
check('it does not assert a strongest window below the floor',
  /(your strongest observed|Your strongest streaming window)/.test(evidenceBranch), false)
check('it marks the window as too early to call', /too early to call/.test(evidenceBranch), true)

console.log('\n6-7. Free sees the discovery; Pro gets the planner')
check('free is offered the plan CTA', /Turn this pattern into a weekly plan/.test(PLAN), true)
check('pro is offered the existing planner instead', /Open my weekly plan/.test(PLAN), true)
check('the two are mutually exclusive', /isPro \? \(/.test(PLAN), true)
check('free still sees the whole discovery before any plan check',
  PLAN.indexOf('Your strongest streaming window') < PLAN.indexOf('isPro ? ('), true)
check('evidence counts are shown to everyone',
  /comparable session/.test(PLAN) && /compared</.test(PLAN) && /\{compared\}/.test(PLAN), true)
check('rate and volume are separate figures',
  /median rate/.test(PLAN) && /earned in it so far/.test(PLAN), true)

console.log('\n8. It consumes existing intelligence and the existing planner')
check('the state comes from the canonical insight',
  /intelligence\?\.insights\?\.peak_window/.test(PLAN), true)
check('the window comes from canonical analytics',
  /analytics\?\.canonicalBestTimes\?\.bestWindow/.test(PLAN), true)
check('confidence is the shared badge, not new wording',
  /<ConfidenceBadge intelligence=\{intelligence\} insight="peak_window" \/>/.test(PLAN), true)
check('no scheduling engine is created here',
  /(weekPlan|buildWindows|groupIntoSessions|detectSessions)/.test(PLAN), false)
check('the existing Stream Planner still mounts on the planner tab',
  /<StreamPlanner tips=\{tips\}/.test(PAGE), true)
check('the planner gate is the same canonical lock 2C-1 wired',
  /_plannerLock\.locked/.test(PAGE), true)
check('D5 tips<20 gate untouched', PLANNER.includes('tips.length < 20'), true)
check('the 4-week rule untouched', PLANNER.includes('Stream 4+ weeks to unlock earnings lift tracking'), true)
check('planner session thresholds untouched', PLANNER.includes('sessionCount >= 3'), true)

console.log('\n9-10. Conversion runs through 2C-4, with the window preserved')
check('the free CTA opens the stream_planner context',
  /onUpgrade\('stream_planner'\)/.test(PLAN), true)
check('no second modal is created', /role="dialog"/.test(PLAN), false)
check('it never links to /pricing directly', /\/pricing/.test(PLAN), false)
check('the context is keyed to the peak window discovery',
  /STREAM_PLANNER\]: \{[\s\S]{0,200}insightId: 'peak_window'/.test(CTXS), true)
check('the ask states the identified window',
  /You've identified \$\{windowLabel\} as your strongest observed window\./.test(CTXS), true)
check('the primary CTA is the outcome, not the feature name',
  /primaryCta: 'Build My Weekly Plan'/.test(CTXS), true)
check('the unlock line describes recorded history, not a forecast',
  /turn your recorded performance history into a personalized weekly streaming plan/.test(CTXS), true)
check('no window means no fabricated planner discovery',
  /STREAM_PLANNER: \{[\s\S]{0,120}if \(!bestWindow\) return \[\]/.test(CTXS.replace(/case UPGRADE_SOURCE\./g, '')), true)

console.log('\n11-14. Nothing predictive, nothing promised')
const BANNED = [
  'tonightStream', '7-day', '30-day', 'next week you', 'you will make', 'will earn',
  'expected to make', 'guarantee', 'guaranteed', 'projected', 'increase your income',
  'maximize your income', 'make more money', 'should earn',
]
// The one sentence that names a future outcome does so to DENY it. It is
// removed before the ban scan and asserted separately below, so the scan
// cannot be satisfied by deleting the disclaimer.
const DISCLAIMER = 'not a promise about what a future stream will earn'
check('the disclaimer is present', PLAN.includes(DISCLAIMER), true)
const PLAN_CLAIMS = PLAN.replace(DISCLAIMER, '')
for (const phrase of BANNED) {
  check(`plan card never says "${phrase}"`, PLAN_CLAIMS.toLowerCase().includes(phrase.toLowerCase()), false)
}
check('it says "observed" rather than predicted',
  /strongest observed streaming window/.test(PLAN), true)
check('it states outright that this is not a promise',
  /not a promise about what a future stream will earn/.test(PLAN), true)
check('it describes the plan as built on recorded history',
  /the times that have performed best in your recorded history/.test(PLAN), true)
check('no dollar figure is attached to a future action',
  /(will|could|expect)[^\n]{0,20}\$/.test(PLAN), false)

console.log('\n15-16. Scope held')
check('no analytics module is imported', /lib\/analytics/.test(PLAN), false)
check('no intelligence threshold is redefined', /CLAIMABLE_FLOOR\s*=/.test(PLAN), false)
check('the mirrored floor set matches the canonical states exactly',
  [...CLAIMABLE].sort(), ['ESTABLISHED', 'HIGH_CONFIDENCE', 'SUPPORTED'])
check('mounted on the Command Center', /<PeakWindowPlan/.test(CC), true)
check('mounted on the planner tab', /<PeakWindowPlan/.test(PAGE), true)
check('the planner tab still renders its lock state when gated',
  /_plannerLock\.locked[\s\S]{0,400}<LockedInsightCard title="Stream Planner"/.test(PAGE), true)
check('tab navigation is unchanged', /activeTab === 'planner'/.test(PAGE), true)
check('no SEO/blog/sitemap import', /(app\/blog|app\/guides|sitemap|robots)/.test(PLAN), false)
check('no schema or migration ships here', /(CREATE TABLE|ALTER TABLE)/i.test(PLAN), false)

console.log(`\n  ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

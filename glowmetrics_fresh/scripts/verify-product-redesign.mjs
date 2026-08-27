// Regression coverage for the product-experience redesign: the Command Center's
// four zones, the Creator Report narrative, the onboarding first-aha, the
// re-weighted import result, and the enforced platform entitlement.
//
// Source assertions only here — the RENDERED proof (that these are visibly the
// product, not just present in code) lives in the render suite.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '')

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`) }
}

const CC = strip(read('app/dashboard/CommandCenter.js'))
const NBM = strip(read('app/dashboard/NextBestMove.jsx'))
const WC = strip(read('app/dashboard/WhatChanged.jsx'))
const REPORT = strip(read('app/dashboard/CreatorReport.js'))
const NARR = strip(read('app/dashboard/ReportNarrative.jsx'))
const DISC = strip(read('lib/reportDiscoveries.js'))
const ONB = strip(read('app/onboarding/page.js'))
// The aha markup was extracted to its own component so it renders without a
// Supabase client and can be verified against real output, not source text.
const AHA = strip(read('app/onboarding/OnboardingAha.jsx'))
const IMP = strip(read('app/dashboard/ImportSuccess.jsx'))
const PAGE = strip(read('app/dashboard/page.js'))
const UNLOCK = strip(read('lib/unlockProgress.js'))
const LOOP = strip(read('lib/conversionLoop.js'))
const INTEL_ROUTE = strip(read('app/api/intelligence/route.js'))
const INSIGHTS_ROUTE = strip(read('app/api/insights/route.js'))
const ENT = strip(read('lib/platformEntitlement.js'))

console.log('\nA. COMMAND CENTER — four zones, one dominant move')
check('the primary block exists', /<NextBestMove/.test(CC), true)
// Compared against the hero ELEMENT, not the HERO_GRADIENT constant, which is
// declared near the top of the file and would always sort first.
check('it is the FIRST thing in the rendered tree',
  CC.indexOf('<NextBestMove') < CC.indexOf('hasWindow ? HERO_GRADIENT'), true)
check('what-changed sits directly under it',
  CC.indexOf('<NextBestMove') < CC.indexOf('<WhatChanged'), true)
check('the winner is chosen canonically, not templated',
  /primaryMove\(buildReportDiscoveries\(\{ analytics, intelligence \}\)\)/.test(CC), true)
// A "next best move" with nothing to do is not a move: the selector prefers the
// strongest ACTIONABLE discovery over the strongest one overall.
check('the selector prefers an actionable discovery',
  /discoveries\.find\(d => d\.claimable && d\.action\)/.test(DISC), true)
check('exactly one primary action renders', (NBM.match(/onAction\?\.\(/g) || []).length, 1)
check('Pro performs the action; free is asked contextually',
  /isPro \? \([\s\S]{0,200}onAction/.test(NBM) && /onUpgrade\?\.\(action\.source\)/.test(NBM), true)
check('a calibrating account gets a real step, not an upsell',
  /discovery\.nextMilestone/.test(NBM) && !/onUpgrade[\s\S]{0,200}nextMilestone/.test(NBM), true)
check('no discovery at all still says something honest',
  /CamCash is still learning your business/.test(NBM), true)

console.log('\nB. WHAT CHANGED — real diffs only')
check('it reads the canonical diff', /diff\.improved/.test(WC) && /diff\.evidenceDelta/.test(WC), true)
check('a first visit renders nothing', /if \(loading \|\| !diff\) return null/.test(WC), true)
check('no change says so plainly', /Nothing new since your last visit/.test(WC), true)
check('it fabricates no activity', /(streak|today you|active now|live now)/i.test(WC), false)
check('only real deltas are listed', /\.filter\(\(\[, v\]\) => Number\(v\) > 0\)/.test(WC), true)

console.log('\nC. THE BASELINE ADVANCES ON A DASHBOARD VISIT')
check('the dashboard reads the diff then advances the baseline',
  PAGE.indexOf("setChangedSinceLastVisit") < PAGE.indexOf("method: 'POST'"), true)
check('it uses the existing route and column', /fetch\('\/api\/intelligence'/.test(PAGE), true)
check('it runs once per visit', /seenBaselineRef\.current = true/.test(PAGE), true)
check('no new table or column is introduced',
  /(CREATE TABLE|ADD COLUMN)/i.test(PAGE + INTEL_ROUTE), false)

console.log('\nD. CREATOR REPORT — the build tracker, not the findings page')
// The report's job changed: insights belong to the Command Center, and this
// page tracks what CamCash still needs. These guards assert that SEPARATION,
// which is a stronger property than the old "does it narrate discoveries".
check('it uses the canonical unlock model', /lockedCapabilities\(/.test(REPORT), true)
check('it reads per-platform progress canonically', /platformProgress\(/.test(REPORT), true)
check('a header names the data range', /<ReportHeader/.test(REPORT), true)
check('the header states the source', /Built entirely from the data you have imported/.test(NARR), true)
check('it renders the progress tracker', /<UnlockProgress/.test(REPORT), true)
check('it no longer narrates discoveries', /<ReportDiscovery/.test(REPORT), false)
check('it no longer carries its own actions section', /<ReportActions/.test(REPORT), false)
check('it no longer carries a Pro pitch section', /<ReportPro/.test(REPORT), false)
check('it defines no requirement of its own — every number is read',
  /need:\s*\d|required\s*=\s*\d/.test(UNLOCK), false)
check('a locked capability drops out at the claimable floor',
  /rank\(insight\.state\) >= rank\(CLAIMABLE_FLOOR\)/.test(UNLOCK), true)
check('the detail sections are demoted, not deleted', /The numbers behind it/.test(REPORT), true)
check('no local confidence math returned', /calculateConfidence\(/.test(REPORT), false)

console.log('\nD2. COMMAND CENTER — where the insights and the unlocks live')
check('the conversion loop is mounted there', /<ConversionLoop/.test(PAGE), true)
check('unlocks are announced there, from the canonical diff',
  /newlyUnlocked\(changedSinceLastVisit\)/.test(PAGE), true)
check('an unlock is the engine\'s own isDiscovery, not a local rule',
  /p\.isDiscovery/.test(UNLOCK), true)
check('every rotating prompt is conditional, never unconditional',
  /if \(isPro\) return \[\]/.test(LOOP), true)
for (const bad of ['guaranteed', 'projected', 'you will earn', 'expected to earn']) {
  check(`the loop never says "${bad}"`, LOOP.toLowerCase().includes(bad), false)
}

console.log('\nE. ONBOARDING — the first aha is canonical')
check('it reads the intelligence route', /fetch\('\/api\/intelligence'/.test(ONB), true)
check('the aha is a component, mounted by onboarding', /<OnboardingAha/.test(ONB), true)
check('it leads with the actionable discovery, not merely the strongest',
  /data\?\.primaryDiscovery/.test(ONB), true)
check('it renders the canonical discovery', /discovery\.title/.test(AHA) && /discovery\.evidence/.test(AHA), true)
check('it claims only when the ladder allows', /!discovery \|\| !discovery\.claimable/.test(AHA), true)
check('below the floor it names the missing evidence', /discovery\.nextMilestone/.test(AHA), true)
check('it shows the fan connection when there is one', /fanCount > 0/.test(AHA), true)
check('it gives one next move', /Your next move/.test(AHA), true)
check('the unconfirmed preview hour is gone',
  /This import shows an early signal around/.test(ONB), false)
check('no staged fake progress', /(setTimeout\(\(\)=>setAha)/.test(ONB), false)
check('the flow up to loading is untouched',
  ONB.includes("setStep('loading')") && ONB.includes("setStep('paste')"), true)

console.log('\nF. IMPORT RESULT — result, proof, next move')
check('the headline states what was found',
  /CamCash found \$\{found\} new \$\{found === 1 \? "pattern" : "patterns"\} in your history/.test(IMP), true)
check('it no longer leads with an upload confirmation',
  /"Your data is in"/.test(IMP), false)
check('the count comes from the diff, never from optimism',
  /const found = discoveries\.length/.test(IMP), true)
check('a no-change import is told plainly',
  /No pattern crossed a threshold this time/.test(IMP), true)

console.log('\nG. ENTITLEMENT — actually enforced on every analytics path')
check('the dashboard filters before aggregating',
  PAGE.indexOf('filterEntitledRows(entitlement, allData)') < PAGE.indexOf('runEngine(allData'), true)
check('the intelligence route filters', /aggregateRows\(entitledTips, timezone\)/.test(INTEL_ROUTE), true)
check('the insights route filters', /filterEntitledRows\(/.test(INSIGHTS_ROUTE), true)
check('all three read the same profiles source of truth',
  [PAGE, INTEL_ROUTE, INSIGHTS_ROUTE].every(s => s.includes('primary_pro_platform')), true)
check('no second subscription system', /(CREATE TABLE|new Stripe\()/i.test(ENT + PAGE), false)
check('nothing is deleted to enforce it',
  /(\.delete\(\)|DELETE FROM)/.test(ENT), false)
check('the filter returns a new array, never mutating',
  /return rows\.filter\(/.test(ENT), true)
check('free plans are filtered by nothing',
  /if \(!entitlement\?\.isPro\) return \[\.\.\.rows\]/.test(ENT), true)

console.log('\nH. NOTHING ANALYTICAL MOVED')
check('session detection intact', read('lib/analytics/sessions.js').includes('3 * 60 * 60 * 1000'), true)
check('platform confidence gate intact',
  (read('lib/analytics.js').match(/const RANKABLE_CONFIDENCE = new Set\(\['Medium', 'High'\]\)/g) || []).length, 1)
check('claimable floor intact', /CLAIMABLE_FLOOR = INSIGHT_STATE\.SUPPORTED/.test(read('lib/intelligence/states.js')), true)
check('the mapper computes nothing', /(reduce\(|calcMedian|percentile)/.test(DISC), false)
check('D5 intact', read('app/dashboard/StreamPlanner.js').includes('tips.length < 20'), true)
check('no fabricated prediction anywhere in the new surfaces',
  ['likely to tip', 'will earn', 'projected', 'guaranteed', 'AI Prediction']
    .filter(p => (NBM + WC + NARR + DISC).toLowerCase().includes(p.toLowerCase())), [])

console.log(`\n  ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

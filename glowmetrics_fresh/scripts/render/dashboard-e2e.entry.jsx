// End-to-end production-readiness walk of the redesigned dashboard.
//
// One synthetic account is carried through the WHOLE journey the way a real
// creator meets it — import, aggregation, intelligence, each discovery, the
// contextual ask, the checkout payload, and the return — asserting at every
// hop that the numbers, the states and the copy agree. The per-feature suites
// prove each piece in isolation; this proves they compose.
//
// Nothing here touches the database, Stripe, or any stored row. Every figure
// comes from aggregateRows() over tips built in this process.

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { aggregateRows } from '../../lib/analytics'
import { computeIntelligence } from '../../lib/intelligence/readiness'
import { buildUpgradeContext, UPGRADE_SOURCE, UPGRADE_CONTEXT_KEYS } from '../../lib/upgradeContexts'
import { atLeast, CLAIMABLE_FLOOR } from '../../lib/intelligence/states'
import { resolveReadiness, gateOpen } from '../../lib/intelligence/locks'
import { resolvePlanType, resolvePriceId } from '../../lib/stripe-plans'

import CommandCenter from '../../app/dashboard/CommandCenter'
import Performance from '../../app/dashboard/Performance'
import Fans from '../../app/dashboard/Fans'
import CreatorReport from '../../app/dashboard/CreatorReport'
import WindowFanOverlap from '../../app/dashboard/WindowFanOverlap'
import PeakWindowPlan from '../../app/dashboard/PeakWindowPlan'
import PlatformOpportunity from '../../app/dashboard/PlatformOpportunity'
import ContextualUpgradeModal from '../../app/dashboard/ContextualUpgradeModal'

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`) }
}
const plain = (h) => h.replace(/<!-- -->/g, '')
const render = (el) => plain(renderToStaticMarkup(el))

// ── 1. IMPORT ───────────────────────────────────────────────────────────────
// Two platforms in their own hour blocks (detectSessions starts a new session
// on any platform change, so overlapping minutes would shred every session),
// a repeated weekday window, and a set of repeat fans.
const WEEKS = ['2026-01-07','2026-01-14','2026-01-21','2026-01-28','2026-02-04','2026-02-11','2026-02-18','2026-02-25','2026-03-04','2026-03-11']
const PLATFORM_HOURS = { Chaturbate: 20, BongaCams: 14 }
const tips = []
let n = 0
for (const day of WEEKS) {
  for (const [platform, baseHour] of Object.entries(PLATFORM_HOURS)) {
    for (let t = 0; t < 10; t++) {
      const minutes = t * 12
      tips.push({
        username: `fan${(n % 20) + 1}`,
        platform,
        tokens: 40 + (n % 6) * 15,
        usd: (platform === 'Chaturbate' ? 2.2 : 1.1) + (n % 6) * 0.4,
        date_time: `${day}T${String(baseHour + Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00Z`,
      })
      n++
    }
  }
}

console.log('\n1. IMPORT -> canonical aggregation')
const analytics = aggregateRows(tips, { timezone: 'UTC' })
check('tips are ingested', analytics.totalTips, tips.length)
check('sessions are detected and graded', analytics.meaningfulSessionCount > 0, true)
check('fans are identified', analytics.uniqueFanCount, 20)
check('both platforms are measured', (analytics.platforms || []).map(p => p.platform).sort(), ['BongaCams', 'Chaturbate'])
check('a best window is found', !!analytics.canonicalBestTimes?.bestWindow, true)

console.log('\n2. INTELLIGENCE -> one state per insight')
const intelligence = computeIntelligence({ analytics })
const st = (id) => intelligence.insights[id]?.state
check('calibration is a real percentage',
  Number.isFinite(intelligence.calibration.pct) && intelligence.calibration.pct > 0, true)
check('peak_window is graded', !!st('peak_window'), true)
check('cross_platform is graded', !!st('cross_platform'), true)
check('every catalogue insight has a state',
  Object.values(intelligence.insights).every(e => typeof e.state === 'string'), true)
check('readiness resolves from the ladder', typeof resolveReadiness(intelligence), 'string')
check('the planner gate agrees with peak_window claimability',
  gateOpen(intelligence, 'streamPlanner'), atLeast(st('peak_window'), CLAIMABLE_FLOOR))

console.log('\n3. DISCOVERY -> fan overlap')
const overlap = analytics.bestWindowFanOverlap
check('overlap is computed against the best window', !!overlap, true)
check('the Top Supporter count never exceeds the repeat-fan count',
  overlap.topSupporterCount <= overlap.count, true)
check('every named fan carries the canonical flag',
  (overlap.fans || []).every(f => typeof f.isTopSupporter === 'boolean'), true)
const overlapFree = render(<WindowFanOverlap analytics={analytics} intelligence={intelligence} isPro={false} onUpgrade={() => {}} />)
const overlapPro  = render(<WindowFanOverlap analytics={analytics} intelligence={intelligence} isPro onViewFans={() => {}} />)
check('free sees the overlap question', overlapFree.includes('Who shows up during it?'), true)
check('the rendered count matches the canonical count',
  overlapFree.includes(`${overlap.count} repeat fan`), true)
check('pro is not asked to upgrade there', overlapPro.includes('See these fans with Pro'), false)

console.log('\n4. DISCOVERY -> peak-window plan')
const planFree = render(<PeakWindowPlan analytics={analytics} intelligence={intelligence} isPro={false} onUpgrade={() => {}} onImport={() => {}} />)
const planPro  = render(<PeakWindowPlan analytics={analytics} intelligence={intelligence} isPro onOpenPlanner={() => {}} />)
const claimableWindow = atLeast(st('peak_window'), CLAIMABLE_FLOOR)
check('the card matches the ladder, not its own opinion',
  planFree.includes('strongest streaming window'), claimableWindow)
check('a claimable window offers the plan; a weak one does not',
  planFree.includes('Turn this pattern into a weekly plan'), claimableWindow)
check('pro is routed to the planner instead',
  planPro.includes('Open my weekly plan'), claimableWindow)
check('the rendered rate matches canonical',
  !claimableWindow || planFree.includes(`$${analytics.canonicalBestTimes.bestWindow.medianUsdPerHour}/hr`), true)

console.log('\n5. DISCOVERY -> platform opportunity')
const rankable = analytics.rankablePlatforms || []
const platFree = render(<PlatformOpportunity analytics={analytics} intelligence={intelligence} isPro={false} onUpgrade={() => {}} onImport={() => {}} />)
check('the card matches the rankable set, not its own gate',
  platFree.includes('performing differently'), rankable.length >= 2)
check('the lead platform is the canonical best by rate',
  rankable.length < 2 || rankable[0].platform === analytics.bestPlatformByRate.platform, true)
check('every rankable platform shows its own confidence label',
  rankable.every(p => !platFree.includes(p.platform) || platFree.includes(p.confidenceLabel)), true)

console.log('\n6. CONTEXTUAL UPGRADE -> every context builds and renders')
for (const key of UPGRADE_CONTEXT_KEYS) {
  const ctx = buildUpgradeContext(key, { analytics, trackedPlatformCount: 2 })
  const html = render(<ContextualUpgradeModal open onClose={() => {}} context={ctx} />)
  check(`${key}: renders with a CTA`, html.includes(ctx.primaryCta), true)
  check(`${key}: never claims a discovery it does not have`,
    ctx.hasDiscovery === (ctx.discovery.length > 0), true)
}
const fanCtx = buildUpgradeContext(UPGRADE_SOURCE.WINDOW_FAN_OVERLAP, { analytics })
check('the fan ask carries the same count the card showed',
  !fanCtx.hasDiscovery || fanCtx.discovery[0].startsWith(`${overlap.count} repeat fan`), true)
const proModal = render(<ContextualUpgradeModal open onClose={() => {}} context={fanCtx} isPro onProAction={() => {}} />)
check('an already-Pro creator is never sold to', proModal.includes('See full plan comparison'), false)

console.log('\n7. CHECKOUT -> real plans, no invented price')
for (const [sent, canonical] of [['standard_monthly', 'monthly'], ['standard_annual', 'annual']]) {
  check(`${sent} resolves to the ${canonical} plan`, resolvePlanType(sent), canonical)
  check(`${canonical} resolves a price id or names the env vars it needs`, (() => {
    const { priceId, searched } = resolvePriceId(canonical)
    return !!priceId || (Array.isArray(searched) && searched.length > 0)
  })(), true)
}
check('an unknown plan is refused, never guessed', resolvePlanType('mystery_plan'), null)

console.log('\n8. CHECKOUT RETURN -> the context comes back')
const CHECKOUT = readSrc('app/api/stripe/checkout/route.js')
const PAGE = readSrc('app/dashboard/page.js')
check('success carries plan and context', /success=true&plan=\$\{planType\}\$\{ctxParam\}/.test(CHECKOUT), true)
check('an in-dashboard cancel returns to the dashboard',
  /\/dashboard\?canceled=true&ctx=\$\{upgradeSource\}/.test(CHECKOUT), true)
check('the source is validated before entering a URL', /\^\[a-z0-9_\]\{1,40\}\$/.test(CHECKOUT), true)
check('the return re-opens the originating tab', /if \(tab\) \{ setActiveTab\(tab\)/.test(PAGE), true)
check('cancel shows no success state and no reopened modal',
  /params\.get\('canceled'\) === 'true'[\s\S]{0,400}setShowUpgradeModal\(false\)/.test(PAGE)
  && !/params\.get\('canceled'\) === 'true'[\s\S]{0,400}setShowUpgradeModal\(true\)/.test(PAGE), true)

console.log('\n9. FREE vs PRO -> free keeps the facts, pro gets the depth')
const ccFree = render(<CommandCenter analytics={analytics} intelligence={intelligence} isPro={false} nowActions={[]} onUpgrade={() => {}} />)
const ccPro  = render(<CommandCenter analytics={analytics} intelligence={intelligence} isPro nowActions={[]} onUpgrade={() => {}} />)
const perfFree = render(<Performance analytics={analytics} intelligence={intelligence} isPro={false} onUpgrade={() => {}} />)
const fansFree = render(<Fans analytics={analytics} intelligence={intelligence} isPro={false} onUpgrade={() => {}} />)
const reportFree = render(<CreatorReport analytics={analytics} tips={tips} intelligence={intelligence} isPro={false} timezone="UTC" onUpgrade={() => {}} />)
const SURFACES = { CommandCenter: ccFree, Performance: perfFree, Fans: fansFree, CreatorReport: reportFree }

for (const [name, html] of Object.entries(SURFACES)) {
  check(`${name} renders for a free creator`, html.length > 500, true)
}
check('free sees its real earnings total',
  ccFree.includes(`$${Math.round(analytics.totalUSD).toLocaleString('en-US')}`) || ccFree.includes(String(Math.round(analytics.totalUSD))), true)
check('free sees its session count', ccFree.includes(String(analytics.meaningfulSessionCount)), true)
check('free sees its fan count', ccFree.includes(String(analytics.uniqueFanCount)), true)
check('free sees the full fan roster, not a truncated one',
  (analytics.whales || []).every(f => fansFree.includes(f.username)), true)
check('pro sees the same factual totals as free',
  ccPro.includes(String(analytics.meaningfulSessionCount)), true)

console.log('\n10. NO FABRICATED PREDICTION OR EARNINGS CLAIM, ANYWHERE RENDERED')
const ALL_RENDERED = [ccFree, ccPro, perfFree, fansFree, reportFree, overlapFree, overlapPro, planFree, planPro, platFree, proModal,
  ...UPGRADE_CONTEXT_KEYS.map(k => render(<ContextualUpgradeModal open onClose={() => {}} context={buildUpgradeContext(k, { analytics })} />)),
].join('\n').toLowerCase()
const BANNED = [
  'ai prediction', 'predicted next tip', '30-day revenue forecast', 'engagement score',
  // 'will earn' is deliberately absent from this list: it is permitted inside
  // the sentence that denies it, and the paired count check below is the
  // precise guard for it.
  'likely to tip', 'usually online', 'you will make', 'guaranteed',
  'maximize your income', 'make more money', 'expected to make', 'earning potential',
  'is a creator pro feature', 'see what pro unlocks', 'unlock fan detail',
]
for (const phrase of BANNED) check(`nothing rendered says "${phrase}"`, ALL_RENDERED.includes(phrase), false)
// "will earn" is permitted only inside the sentence that denies it.
check('the only future-tense earnings phrase is a denial',
  (ALL_RENDERED.match(/will earn/g) || []).length,
  (ALL_RENDERED.match(/not a promise about what a future stream will earn/g) || []).length)

console.log('\n11. NO DUPLICATE OR GENERIC UPGRADE PATH WHERE A CONTEXTUAL ONE EXISTS')
const upgradeButtons = (html) => (html.match(/<button[^>]*>[^<]*(Pro|pro|Upgrade|upgrade)[^<]*<\/button>/g) || [])
for (const [name, html] of Object.entries(SURFACES)) {
  const generic = upgradeButtons(html).filter(b => /Upgrade to Pro<|See what Pro unlocks|Unlock this feature/.test(b))
  check(`${name} shows no generic upgrade button`, generic, [])
}
check('no rendered surface links a free creator straight to /pricing',
  Object.values(SURFACES).some(h => /href="\/pricing"/.test(h)), false)
check('the modal is the only place /pricing appears',
  /href="\/pricing"/.test(render(<ContextualUpgradeModal open onClose={() => {}} context={fanCtx} />)), true)

console.log(`\n  ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

function readSrc(rel) {
  // eslint-disable-next-line global-require
  const { readFileSync } = require('node:fs')
  const { join } = require('node:path')
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

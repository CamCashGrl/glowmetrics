import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CommandCenter from '../../app/dashboard/CommandCenter'
import Performance from '../../app/dashboard/Performance'
import Fans from '../../app/dashboard/Fans'
import StreamPlanner from '../../app/dashboard/StreamPlanner'
import AnalyticsCharts from '../../app/dashboard/AnalyticsCharts'
import CreatorReport from '../../app/dashboard/CreatorReport'
import ConfidenceBadge from '../../app/dashboard/ConfidenceBadge'
import WindowFanOverlap from '../../app/dashboard/WindowFanOverlap'
import ContextualUpgradeModal from '../../app/dashboard/ContextualUpgradeModal'
import PeakWindowPlan from '../../app/dashboard/PeakWindowPlan'
import PlatformOpportunity from '../../app/dashboard/PlatformOpportunity'
import { buildUpgradeContext, UPGRADE_SOURCE, UPGRADE_CONTEXT_KEYS } from '../../lib/upgradeContexts'
import { aggregateRows } from '../../lib/analytics'
import { computeIntelligence } from '../../lib/intelligence/readiness'

// ── Fixture: a synthetic account rich enough that every insight is graded,
// built from the same aggregateRows() the product uses. No stored data read.
const DAYS = ['2026-01-07','2026-01-14','2026-01-21','2026-01-28','2026-02-04','2026-02-11','2026-02-18','2026-03-04']
// Each platform streams in its OWN hour block. detectSessions() sorts every
// tip by time and starts a new session on any platform change, so two
// platforms sharing the same minutes would shred into one-tip sessions and the
// fixture would grade nothing.
const PLATFORM_HOURS = { Chaturbate: 20, BongaCams: 14 }
const tips = []
let n = 0
for (const d of DAYS) {
  for (const [plat, baseHour] of Object.entries(PLATFORM_HOURS)) {
    for (let t = 0; t < 9; t++) {
      const minutes = t * 12
      const hour = baseHour + Math.floor(minutes / 60)
      tips.push({
        username: `fan${(n % 24) + 1}`,
        platform: plat,
        tokens: 30 + (n % 7) * 10,
        usd: 1.5 + (n % 7) * 0.5,
        date_time: `${d}T${String(hour).padStart(2,'0')}:${String(minutes % 60).padStart(2,'0')}:00Z`,
      })
      n++
    }
  }
}

const analytics = aggregateRows(tips, { timezone: 'UTC' })
const intelligence = computeIntelligence({ analytics })

let pass = 0, fail = 0
function render(name, el) {
  try {
    const html = renderToStaticMarkup(el)
    if (typeof html !== 'string') throw new Error('no markup')
    pass++
    console.log(`  ✓ ${name} rendered (${html.length} bytes)`)
    return html
  } catch (e) {
    fail++
    console.log(`  ✗ ${name} THREW: ${e && e.message}`)
    return ''
  }
}

console.log('\nA. Every touched surface renders with real intelligence')
const withIntel = [
  ['CommandCenter',   <CommandCenter analytics={analytics} intelligence={intelligence} nowActions={[]} />],
  ['Performance',     <Performance analytics={analytics} intelligence={intelligence} />],
  ['Fans',            <Fans analytics={analytics} intelligence={intelligence} />],
  ['StreamPlanner',   <StreamPlanner tips={tips} analytics={analytics} timezone="UTC" />],
  ['AnalyticsCharts', <AnalyticsCharts analytics={analytics} intelligence={intelligence} />],
  ['CreatorReport',   <CreatorReport analytics={analytics} tips={tips} intelligence={intelligence} timezone="UTC" />],
]
const markup = {}
for (const [name, el] of withIntel) markup[name] = render(name, el)

console.log('\nB. Loading / null intelligence does not throw')
for (const [name, el] of [
  ['CommandCenter',   <CommandCenter analytics={analytics} intelligence={null} nowActions={[]} />],
  ['Performance',     <Performance analytics={analytics} intelligence={null} />],
  ['Fans',            <Fans analytics={analytics} intelligence={null} />],
  ['AnalyticsCharts', <AnalyticsCharts analytics={analytics} intelligence={null} />],
  ['CreatorReport',   <CreatorReport analytics={analytics} tips={tips} intelligence={null} timezone="UTC" />],
]) render(`${name} (intelligence=null)`, el)

console.log('\nC. Empty analytics does not throw')
const emptyAnalytics = aggregateRows([], { timezone: 'UTC' })
const emptyIntel = computeIntelligence({ analytics: emptyAnalytics })
for (const [name, el] of [
  ['CommandCenter',   <CommandCenter analytics={emptyAnalytics} intelligence={emptyIntel} nowActions={[]} />],
  ['Performance',     <Performance analytics={emptyAnalytics} intelligence={emptyIntel} />],
  ['Fans',            <Fans analytics={emptyAnalytics} intelligence={emptyIntel} />],
  ['AnalyticsCharts', <AnalyticsCharts analytics={emptyAnalytics} intelligence={emptyIntel} />],
]) render(`${name} (no data)`, el)

console.log('\nD. The badge behaves as specified')
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`) }
}
check('null intelligence renders literally nothing',
  renderToStaticMarkup(<ConfidenceBadge intelligence={null} insight="peak_window" />), '')
check('unknown insight renders literally nothing',
  renderToStaticMarkup(<ConfidenceBadge intelligence={intelligence} insight="nope" />), '')
const weak = renderToStaticMarkup(<ConfidenceBadge state="CALIBRATING" />)
check('CALIBRATING renders its word', weak.includes('Calibrating'), true)
const sup = renderToStaticMarkup(<ConfidenceBadge state="SUPPORTED" />)
check('SUPPORTED renders its word', sup.includes('Supported'), true)
check('ESTABLISHED is chrome-free', renderToStaticMarkup(<ConfidenceBadge state="ESTABLISHED" />).includes('border:none'), true)

// The missing-evidence line, driven only by the canonical nextMilestone.
const weakIntel = { insights: { peak_window: { state: 'EARLY_SIGNAL', nextMilestone: { label: '2 more sessions in this window' } } } }
const weakHtml = renderToStaticMarkup(<ConfidenceBadge intelligence={weakIntel} insight="peak_window" />)
check('weak state states what evidence is missing', weakHtml.includes('needs 2 more sessions in this window'), true)
const strongIntel = { insights: { peak_window: { state: 'HIGH_CONFIDENCE', nextMilestone: { label: '2 more sessions' } } } }
check('strong state does NOT nag about missing evidence',
  renderToStaticMarkup(<ConfidenceBadge intelligence={strongIntel} insight="peak_window" />).includes('needs'), false)

console.log('\nE. Canonical vocabulary actually reaches the surfaces')
const CANON = ['Calibrating', 'Early signal', 'Developing', 'Supported', 'High confidence', 'Established']
for (const name of ['CommandCenter', 'Performance', 'CreatorReport']) {
  check(`${name} prints a canonical confidence word`, CANON.some(w => markup[name].includes(w)), true)
}
const RETIRED_WORDS = ['Strong pattern', 'Supported pattern', 'Building Pattern', 'Pattern emerging']
for (const name of Object.keys(markup)) {
  check(`${name} prints no retired vocabulary`, RETIRED_WORDS.some(w => markup[name].includes(w)), false)
}

console.log('\nF. Discovery -> fan intelligence (2C-3) mounts in every plan/overlap state')
render('WindowFanOverlap (free, real data)',  <WindowFanOverlap analytics={analytics} intelligence={intelligence} isPro={false} onUpgrade={() => {}} />)
render('WindowFanOverlap (pro, real data)',   <WindowFanOverlap analytics={analytics} intelligence={intelligence} isPro onViewFans={() => {}} />)
render('WindowFanOverlap (intelligence=null)',<WindowFanOverlap analytics={analytics} intelligence={null} isPro={false} onUpgrade={() => {}} />)
render('WindowFanOverlap (empty account)',    <WindowFanOverlap analytics={emptyAnalytics} intelligence={emptyIntel} />)
check('no peak window renders literally nothing',
  renderToStaticMarkup(<WindowFanOverlap analytics={emptyAnalytics} intelligence={emptyIntel} />), '')

const freeHtml = renderToStaticMarkup(<WindowFanOverlap analytics={analytics} intelligence={intelligence} isPro={false} onUpgrade={() => {}} />)
const proHtml  = renderToStaticMarkup(<WindowFanOverlap analytics={analytics} intelligence={intelligence} isPro onViewFans={() => {}} />)
check('free sees the window',            /strongest streaming window/i.test(freeHtml), true)
check('free sees the fan question',      freeHtml.includes('Who shows up during it?'), true)
check('free sees a repeat-fan count',    /repeat fans? ha[sv]e? tipped|No repeat fan/.test(freeHtml), true)
check('free sees the Top Supporter line', /Top Supporters/.test(freeHtml), true)
check('free is never shown a lock',      /locked|🔒/i.test(freeHtml), false)
check('pro sees no upgrade CTA',         proHtml.includes('Unlock fan detail with Pro'), false)
check('free and pro see the SAME discovery text',
  freeHtml.includes('Highest median rate') && proHtml.includes('Highest median rate'), true)
for (const bad of ['likely to tip', 'usually online', 'prefers this time', 'will make you']) {
  check(`rendered output never says "${bad}"`, (freeHtml + proHtml).toLowerCase().includes(bad), false)
}

console.log('\nG. Contextual upgrade (2C-4) renders in every state')
const fanCtx = buildUpgradeContext(UPGRADE_SOURCE.WINDOW_FAN_OVERLAP, { analytics })
const peakCtx = buildUpgradeContext(UPGRADE_SOURCE.PEAK_WINDOW, { analytics })
const emptyCtx = buildUpgradeContext(UPGRADE_SOURCE.WINDOW_FAN_OVERLAP, { analytics: emptyAnalytics })
const bogusCtx = buildUpgradeContext('a_source_that_does_not_exist', { analytics })

render('modal (free, fan discovery)', <ContextualUpgradeModal open onClose={() => {}} context={fanCtx} />)
render('modal (free, peak window)',   <ContextualUpgradeModal open onClose={() => {}} context={peakCtx} />)
render('modal (already Pro)',         <ContextualUpgradeModal open onClose={() => {}} context={fanCtx} isPro onProAction={() => {}} />)
render('modal (no discovery)',        <ContextualUpgradeModal open onClose={() => {}} context={emptyCtx} />)
check('closed modal renders nothing',  renderToStaticMarkup(<ContextualUpgradeModal open={false} onClose={() => {}} context={fanCtx} />), '')
check('missing context renders nothing', renderToStaticMarkup(<ContextualUpgradeModal open onClose={() => {}} context={null} />), '')

const freeModal = renderToStaticMarkup(<ContextualUpgradeModal open onClose={() => {}} context={fanCtx} trialEligible />)
const proModal  = renderToStaticMarkup(<ContextualUpgradeModal open onClose={() => {}} context={fanCtx} isPro onProAction={() => {}} />)
const noDisc    = renderToStaticMarkup(<ContextualUpgradeModal open onClose={() => {}} context={emptyCtx} />)

check('every catalogue key builds a usable context',
  UPGRADE_CONTEXT_KEYS.every(k => {
    const c = buildUpgradeContext(k, { analytics })
    return !!c.headline && !!c.unlock && !!c.primaryCta
  }), true)
check('an unknown source falls back safely', bogusCtx.source, 'default')
check('an unknown source claims no discovery', bogusCtx.hasDiscovery, false)

check('the discovery reaches the rendered modal',
  freeModal.includes('repeat fans have tipped during your strongest window'), true)
check('the Top Supporter count reaches it too',
  freeModal.includes('among your Top Supporters'), true)
check('the contextual CTA is rendered, not a generic one',
  freeModal.includes('See these fans with Pro'), true)
check('free sees both billing options', freeModal.includes('Monthly') && freeModal.includes('Annual'), true)
check('free is offered the full comparison as secondary', freeModal.includes('See full plan comparison'), true)
check('an already-Pro creator is not sold to', proModal.includes('See full plan comparison'), false)
check('an already-Pro creator sees no billing options', proModal.includes('Annual'), false)
check('an already-Pro creator is told the plan is active', proModal.includes('Creator Pro is active'), true)
check('no discovery means no invented one', noDisc.includes('repeat fan'), false)
check('no discovery still explains the feature honestly', noDisc.includes('Creator Pro'), true)

check('dialog semantics are present', /role="dialog"/.test(freeModal) && /aria-modal="true"/.test(freeModal), true)
check('the dialog is labelled by its heading', /aria-labelledby="contextual-upgrade-title"/.test(freeModal), true)
check('the close control is labelled', /aria-label="Close"/.test(freeModal), true)
check('the plan switch exposes its state', /aria-checked="true"/.test(freeModal), true)
for (const bad of ['likely to tip', 'usually online', 'guarantee', 'make more money', 'maximize your income']) {
  check(`rendered upgrade never says "${bad}"`, (freeModal + proModal + noDisc).toLowerCase().includes(bad), false)
}

console.log('\nH. Discovery -> personalized plan (2C-5)')
const intelState = intelligence?.insights?.peak_window?.state
console.log(`  · fixture peak_window state: ${intelState}`)
render('plan card (free, real data)', <PeakWindowPlan analytics={analytics} intelligence={intelligence} isPro={false} onUpgrade={() => {}} onImport={() => {}} />)
render('plan card (pro, real data)',  <PeakWindowPlan analytics={analytics} intelligence={intelligence} isPro onOpenPlanner={() => {}} />)
render('plan card (intelligence=null)', <PeakWindowPlan analytics={analytics} intelligence={null} />)
render('plan card (empty account)',   <PeakWindowPlan analytics={emptyAnalytics} intelligence={emptyIntel} onImport={() => {}} />)
check('no measured window renders nothing',
  renderToStaticMarkup(<PeakWindowPlan analytics={emptyAnalytics} intelligence={emptyIntel} />), '')
check('loading intelligence renders nothing',
  renderToStaticMarkup(<PeakWindowPlan analytics={analytics} intelligence={null} />), '')

// Synthetic ladder states, so every branch is exercised regardless of what the
// fixture account happens to grade at.
const mkIntel = (state, extra = {}) => ({ insights: { peak_window: { state, comparedAlternatives: 20, ...extra } } })
const freePlan = renderToStaticMarkup(
  <PeakWindowPlan analytics={analytics} intelligence={mkIntel('SUPPORTED')} isPro={false} onUpgrade={() => {}} />)
const proPlan = renderToStaticMarkup(
  <PeakWindowPlan analytics={analytics} intelligence={mkIntel('HIGH_CONFIDENCE')} isPro onOpenPlanner={() => {}} />)
const weakPlan = renderToStaticMarkup(
  <PeakWindowPlan analytics={analytics} intelligence={mkIntel('EARLY_SIGNAL', { explanation: 'Two sessions so far.', nextMilestone: { label: '2 more sessions in this window' } })} isPro={false} onUpgrade={() => {}} onImport={() => {}} />)

check('SUPPORTED shows the discovery',       /strongest streaming window/i.test(freePlan), true)
check('SUPPORTED offers the free plan CTA',  freePlan.includes('Turn this pattern into a weekly plan'), true)
check('SUPPORTED states it is observed, not promised',
  freePlan.includes('not a promise about what a future stream will earn'), true)
check('Pro is offered the planner instead',  proPlan.includes('Open my weekly plan'), true)
check('Pro is not asked to upgrade',         proPlan.includes('Turn this pattern into a weekly plan'), false)
check('EARLY_SIGNAL shows the evidence state', weakPlan.includes('Finding your strongest window'), true)
check('EARLY_SIGNAL names the missing evidence', weakPlan.includes('2 more sessions in this window'), true)
check('EARLY_SIGNAL offers no upgrade',      weakPlan.includes('Turn this pattern into a weekly plan'), false)
check('EARLY_SIGNAL offers no planner',      weakPlan.includes('Open my weekly plan'), false)
check('EARLY_SIGNAL does not claim a strongest window',
  weakPlan.includes('strongest observed'), false)
for (const bad of ['will make', 'guaranteed', 'projected', 'expected to make', '7-day', '30-day']) {
  check(`rendered plan never says "${bad}"`, (freePlan + proPlan + weakPlan).toLowerCase().includes(bad), false)
}
// The one future-tense phrase is inside the disclaimer that denies it.
check('the only "will earn" is the denial',
  (freePlan.match(/will earn/g) || []).length === 1 &&
  freePlan.includes('not a promise about what a future stream will earn'), true)

const plannerCtx = buildUpgradeContext(UPGRADE_SOURCE.STREAM_PLANNER, { analytics })
check('the planner context carries the identified window',
  /You've identified .* as your strongest observed window\./.test(plannerCtx.discovery[0] || ''), true)
check('its CTA is the outcome', plannerCtx.primaryCta, 'Build My Weekly Plan')
check('it is keyed to peak_window', plannerCtx.insightId, 'peak_window')
const plannerModal = renderToStaticMarkup(
  <ContextualUpgradeModal open onClose={() => {}} context={plannerCtx} />)
check('the modal preserves the window context',
  /strongest observed window/.test(plannerModal), true)
check('the modal renders the plan CTA', plannerModal.includes('Build My Weekly Plan'), true)
check('no window means no planner discovery to sell',
  buildUpgradeContext(UPGRADE_SOURCE.STREAM_PLANNER, { analytics: emptyAnalytics }).hasDiscovery, false)

console.log('\nI. Cross-platform opportunity (2C-6)')
console.log(`  · fixture rankable platforms: ${(analytics.rankablePlatforms || []).map(p => `${p.platform} $${p.medianUsdPerHour}/hr (${p.confidenceLabel})`).join(', ') || 'none'}`)
render('platform card (free, real data)', <PlatformOpportunity analytics={analytics} intelligence={intelligence} isPro={false} onUpgrade={() => {}} onImport={() => {}} />)
render('platform card (pro, real data)',  <PlatformOpportunity analytics={analytics} intelligence={intelligence} isPro onComparePlatforms={() => {}} />)
render('platform card (intelligence=null)', <PlatformOpportunity analytics={analytics} intelligence={null} />)
check('no platforms renders nothing',
  renderToStaticMarkup(<PlatformOpportunity analytics={emptyAnalytics} intelligence={emptyIntel} />), '')

// Synthetic analytics so every branch is exercised regardless of the fixture.
const mkA = (rankablePlatforms, platforms = rankablePlatforms) => ({ rankablePlatforms, platforms })
const P = (platform, sessions, hours, medianUsdPerHour, totalUSD, confidenceLabel) =>
  ({ platform, sessions, hours, medianUsdPerHour, totalUSD, confidenceLabel })
const twoRankable = mkA([P('BongaCams', 99, 126.6, 3.89, 700, 'Strong pattern'), P('Stripchat', 12, 25, 2.10, 200, 'Likely pattern')])
const oneRankable = mkA([P('BongaCams', 99, 126.6, 3.89, 700, 'Strong pattern')],
                        [P('BongaCams', 99, 126.6, 3.89, 700, 'Strong pattern'), P('Chaturbate', 4, 3.8, 23.16, 90, 'Early signal')])
const noneRankable = mkA([], [P('Chaturbate', 4, 3.8, 23.16, 90, 'Early signal')])
const xpWeakIntel = { insights: { cross_platform: { state: 'EARLY_SIGNAL', explanation: 'Only one platform has enough sessions to measure so far.', nextMilestone: { label: '1 more platform with 3+ sessions' } } } }
const xpStrongIntel = { insights: { cross_platform: { state: 'SUPPORTED' } } }

const cmpFree = renderToStaticMarkup(<PlatformOpportunity analytics={twoRankable} intelligence={xpStrongIntel} isPro={false} onUpgrade={() => {}} />)
const cmpPro  = renderToStaticMarkup(<PlatformOpportunity analytics={twoRankable} intelligence={xpStrongIntel} isPro onComparePlatforms={() => {}} />)
const oneHtml = renderToStaticMarkup(<PlatformOpportunity analytics={oneRankable} intelligence={xpWeakIntel} isPro={false} onUpgrade={() => {}} onImport={() => {}} />)
const noneHtml= renderToStaticMarkup(<PlatformOpportunity analytics={noneRankable} intelligence={xpWeakIntel} isPro={false} onUpgrade={() => {}} />)

check('two rankable -> the comparison is shown', /performing differently/.test(cmpFree), true)
check('both platforms are named', cmpFree.includes('BongaCams') && cmpFree.includes('Stripchat'), true)
// react-dom/server inserts <!-- --> separators between adjacent text and
// expression nodes, so "$3.89/hr" arrives as "$<!-- -->3.89<!-- -->/hr".
// Stripped here; the browser renders the plain string.
const plain = (h) => h.replace(/<!-- -->/g, '')
// 2.10 is a JS number, so it renders as "2.1" — the fixture value, not a
// formatting bug. Asserted as rendered.
check('both rates are shown',
  plain(cmpFree).includes('$3.89/hr') && plain(cmpFree).includes('$2.1/hr'), true)
check('sessions, hours and earnings are shown too',
  /99 sessions/.test(cmpFree) && /127h streamed/.test(cmpFree) && /\$700 earned/.test(cmpFree), true)
check('each platform keeps its own confidence label',
  cmpFree.includes('Strong pattern') && cmpFree.includes('Likely pattern'), true)
check('the finding is stated as an observation',
  /show a stronger observed hourly rate on/.test(cmpFree), true)
check('free is offered the comparison CTA', cmpFree.includes('Compare my platforms'), true)
check('pro is offered it too, without the upsell line',
  cmpPro.includes('Compare my platforms') && !cmpPro.includes('Pro compares your platform'), true)

check('one rankable -> no comparison is claimed', /performing differently/.test(oneHtml), false)
check('one rankable -> the measured platform is still shown', oneHtml.includes('BongaCams'), true)
check('one rankable -> the weak platform is NOT crowned', oneHtml.includes('Chaturbate'), false)
check('one rankable -> no upgrade CTA', oneHtml.includes('Compare my platforms'), false)
check('one rankable -> names the missing evidence', oneHtml.includes('1 more platform with 3+ sessions'), true)
check('one rankable -> refuses to name a stronger platform',
  oneHtml.includes('will not name one as stronger'), true)
check('zero rankable -> still shows the evidence state, not a lock',
  /Comparing your platforms/.test(noneHtml) && !/Compare my platforms/.test(noneHtml), true)

for (const bad of ['you will make', 'guaranteed', 'projected', 'best platform', 'switch to', 'abandon']) {
  check(`rendered platform card never says "${bad}"`,
    (cmpFree + cmpPro + oneHtml + noneHtml).toLowerCase().includes(bad), false)
}

const platCtx = buildUpgradeContext(UPGRADE_SOURCE.PLATFORM_COMPARISON, { analytics: twoRankable })
check('the platform context states the observed difference',
  platCtx.discovery[0], 'Your recorded sessions show a stronger observed hourly rate on BongaCams than Stripchat.')
check('its CTA is the outcome', platCtx.primaryCta, 'Compare My Platforms')
check('one rankable platform yields no platform discovery',
  buildUpgradeContext(UPGRADE_SOURCE.PLATFORM_COMPARISON, { analytics: oneRankable }).hasDiscovery, false)
const platModal = renderToStaticMarkup(<ContextualUpgradeModal open onClose={() => {}} context={platCtx} />)
check('the modal preserves the platform discovery',
  /stronger observed hourly rate on BongaCams than Stripchat/.test(platModal), true)
check('the modal renders the platform CTA', platModal.includes('Compare My Platforms'), true)

console.log(`\n  ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

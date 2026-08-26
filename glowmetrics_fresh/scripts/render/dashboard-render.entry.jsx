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

console.log(`\n  ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

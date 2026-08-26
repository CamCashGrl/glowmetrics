// Standalone verification for 2C-3 — discovery -> fan intelligence.
//
// Two halves, same convention as the other verify-*.mjs scripts:
//   1. LOGIC — the canonical overlap enrichment and the component's wording
//      rules, mirrored and run against constructed fixtures.
//   2. SOURCE — assertions read the real files, because the property that
//      matters most here ("this surface never makes a predictive claim") is a
//      property of the source text, not of a return value.
//
// Cases covered (the 11 required by 2C-3):
//   1  zero fan overlap                     7  supported peak window
//   2  one repeat fan                       8  free users see the discovery
//   3  multiple repeat fans                 9  pro users see the deeper action
//   4  overlap with Top Supporters         10  no unsupported predictive language
//   5  no peak-window discovery            11  protected-account values consistent
//   6  early-signal peak window

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`) }
}

// Comments are stripped before any wording assertion. The file DOCUMENTS the
// phrases it must never render ("likely to tip", "usually online", ...), so a
// naive grep over the raw text would flag its own rulebook. What must be clean
// is the code that actually reaches a creator's screen.
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
const OVERLAP_RAW = read('app/dashboard/WindowFanOverlap.jsx')
const OVERLAP_SRC = stripComments(OVERLAP_RAW)
const ANALYTICS   = read('lib/analytics.js')
const FANS        = read('app/dashboard/Fans.js')
const CC          = read('app/dashboard/CommandCenter.js')

// ── mirrored from lib/analytics.js bestWindowFanOverlap ─────────────────────
// The repeat-fan filter (>=3 tips) and the Top Supporter flag are BOTH
// pre-existing. This mirror adds nothing; it exists so the enrichment's
// arithmetic can be exercised against fixtures.
const OVERLAP_MIN_TIPS = 3
function buildOverlap(bestWindow, fans, matchesWindow) {
  if (!bestWindow) return null
  const matches = fans.filter(f => f.tipCount >= OVERLAP_MIN_TIPS && matchesWindow(f))
  const sorted = [...matches].sort((a, b) => b.totalUSD - a.totalUSD)
  return {
    count: sorted.length,
    totalUSD: parseFloat(sorted.reduce((s, f) => s + (f.totalUSD || 0), 0).toFixed(2)),
    topSupporterCount: sorted.filter(f => f.isTopSupporter).length,
    windowUSD: parseFloat((bestWindow.totalUsd || 0).toFixed(2)),
    windowSessionCount: bestWindow.sessionCount || 0,
    fans: sorted.slice(0, 3).map(f => ({
      username: f.username, totalUSD: f.totalUSD, tipCount: f.tipCount,
      isTopSupporter: !!f.isTopSupporter,
    })),
    usernames: sorted.map(f => f.username.toLowerCase()),
  }
}

// ── mirrored from WindowFanOverlap.jsx: the sentence it builds ──────────────
function sentence(overlap) {
  const count = overlap?.count || 0
  const top = overlap?.topSupporterCount || 0
  const headline = count === 0
    ? 'No repeat fan has tipped during this window yet.'
    : `${count} repeat fan${count === 1 ? ' has' : 's have'} tipped during this window`
  const clause = count > 0 && top > 0
    ? `${top} ${top === 1 ? 'is' : 'are'} among your Top Supporters.`
    : count > 0 ? 'None of them rank among your Top Supporters yet.' : null
  return clause ? `${headline} — ${clause}` : headline
}

const WINDOW = { localDay: 'Wednesday', localHour: 17, medianUsdPerHour: 9.52, sessionCount: 4, totalUsd: 15.12, tier: 'supported' }
const inWindow = () => true
const fan = (username, tipCount, totalUSD, isTopSupporter = false) => ({ username, tipCount, totalUSD, isTopSupporter })

console.log('\n1. Zero fan overlap')
const zero = buildOverlap(WINDOW, [fan('a', 1, 5), fan('b', 2, 9)], inWindow)
check('nobody with fewer than 3 tips counts as a repeat fan', zero.count, 0)
check('no Top Supporters either', zero.topSupporterCount, 0)
check('states nothing was observed, and claims nothing', sentence(zero),
  'No repeat fan has tipped during this window yet.')
check('the discovery itself still stands (window figures intact)',
  [zero.windowUSD, zero.windowSessionCount], [15.12, 4])

console.log('\n2. One repeat fan')
const one = buildOverlap(WINDOW, [fan('solo', 4, 40)], inWindow)
check('counted', one.count, 1)
check('singular grammar', sentence(one),
  '1 repeat fan has tipped during this window — None of them rank among your Top Supporters yet.')
check('a repeat fan is not automatically a Top Supporter', one.topSupporterCount, 0)

console.log('\n3. Multiple repeat fans')
const many = buildOverlap(WINDOW, [fan('a', 5, 50), fan('b', 3, 30), fan('c', 9, 20), fan('d', 2, 99)], inWindow)
check('three qualify, the 2-tip fan does not', many.count, 3)
check('the $99 fan is excluded on tips, not value', many.usernames.includes('d'), false)
check('plural grammar', sentence(many).startsWith('3 repeat fans have tipped'), true)
check('only the top 3 are named', many.fans.length, 3)
check('named fans are ordered by lifetime value', many.fans.map(f => f.username), ['a', 'b', 'c'])

console.log('\n4. Overlap with Top Supporters')
const withTop = buildOverlap(WINDOW, [
  fan('a', 5, 50, true), fan('b', 3, 30, true), fan('c', 9, 20, true), fan('d', 4, 10, false), fan('e', 6, 8, false),
], inWindow)
check('five repeat fans observed', withTop.count, 5)
check('three of them are Top Supporters', withTop.topSupporterCount, 3)
check('the two counts are reported separately, never merged', sentence(withTop),
  '5 repeat fans have tipped during this window — 3 are among your Top Supporters.')
check('the Top Supporter flag is READ, never recomputed',
  /topSupporterCount: sorted\.filter\(f => f\.isTopSupporter\)\.length/.test(ANALYTICS), true)
check('exactly one Top Supporter reads as singular',
  sentence(buildOverlap(WINDOW, [fan('a', 3, 9, true)], inWindow)).endsWith('1 is among your Top Supporters.'), true)

console.log('\n5. No peak-window discovery')
check('no window means no overlap object', buildOverlap(null, [fan('a', 9, 90, true)], inWindow), null)
check('the component renders nothing without a window',
  /if \(!bestWindow\) return null/.test(OVERLAP_SRC), true)
check('it does not fabricate an empty fan state instead',
  /no fans yet/i.test(OVERLAP_SRC), false)

console.log('\n6/7. Early-signal vs supported peak window')
// The card never states the confidence itself — it delegates to the canonical
// badge, so an EARLY_SIGNAL window is labelled as such wherever it appears.
check('confidence comes from the canonical badge',
  /<ConfidenceBadge intelligence=\{intelligence\} insight="peak_window" \/>/.test(OVERLAP_SRC), true)
check('the card hardcodes no confidence word',
  /(Supported|Established|High confidence|Early signal|Strong pattern)/.test(
    OVERLAP_SRC.replace(/Top Supporters?/g, '')), false)
check('rate, volume and evidence are stated as three separate things',
  ['Highest median rate', 'measured over', 'earned in it so far'].every(t => OVERLAP_SRC.includes(t)), true)
check('the window rate is never described as revenue volume',
  /(highest[- ]earning|most of your (money|earnings|revenue))/i.test(OVERLAP_SRC), false)

console.log('\n8. Free users see the discovery, not a lock')
check('the window and both counts render before any plan check',
  OVERLAP_SRC.indexOf('Who shows up during it?') < OVERLAP_SRC.indexOf('!isPro'), true)
// The discovery — window, rate, evidence, both fan counts — is rendered
// before the first plan check, so a free creator sees all of it.
const firstPlanCheck = OVERLAP_SRC.indexOf('isPro && (')
check('both fan counts render before the first plan check',
  OVERLAP_SRC.indexOf('supporterClause') < firstPlanCheck
  && OVERLAP_SRC.indexOf('Highest median rate') < firstPlanCheck, true)
check('only two branches read the plan at all (Pro detail, free CTA)',
  (OVERLAP_SRC.match(/isPro &&/g) || []).length, 2)
check('there is no "locked" framing anywhere',
  /(🔒|locked|Locked)/.test(OVERLAP_SRC), false)
check('the free CTA names the discovery before it names Pro',
  OVERLAP_SRC.indexOf('See which fans are behind the pattern') < OVERLAP_SRC.indexOf('Unlock fan detail with Pro'), true)
check('the CTA only promises what the fan layer already produces',
  /tip cadence, last seen, and re-engagement timing/.test(OVERLAP_SRC), true)

console.log('\n9. Pro users see the deeper action')
check('Pro renders the individual fans', /isPro && \(/.test(OVERLAP_SRC), true)
check('Top Supporters are marked in the Pro list', /f\.isTopSupporter && '👑 '/.test(OVERLAP_SRC), true)
check('Pro is offered a route into the fan records', /Open these fans in Fans/.test(OVERLAP_SRC), true)
check('the free CTA is not shown to Pro', /count > 0 && !isPro && onUpgrade/.test(OVERLAP_SRC), true)

console.log('\n10. No unsupported predictive language')
// The exact claims 2C-3 forbids, plus the general shapes of them.
const FORBIDDEN = [
  'likely to tip', 'usually online', 'will make you', 'prefer this time',
  'prefers this time', 'probability', '% likely', 'expected to tip',
  'projected', 'guarantee', 'you could earn', 'you will earn',
]
for (const phrase of FORBIDDEN) {
  check(`never says "${phrase}"`, OVERLAP_SRC.toLowerCase().includes(phrase.toLowerCase()), false)
}
check('the observation is explicitly past tense',
  /tipped during this window/.test(OVERLAP_SRC) && sentence(withTop).includes('have tipped'), true)
check('it states outright what the count does NOT mean',
  /does not mean these fans are\s*\n?\s*online at this time or that they will tip again/.test(OVERLAP_SRC), true)
check('no dollar figure is attached to a future action',
  /(worth|earn|gain)[^\n]{0,24}\$\{/.test(OVERLAP_SRC), false)
check('tonightStream is not surfaced here', /tonightStream/.test(OVERLAP_SRC), false)

console.log('\n11. Protected-account shape stays consistent')
// Wednesday 5 AM, 4 sessions, $9.52/hr median, 5 repeat fans, 3 Top
// Supporters, ~$15.12 earned in the window — the measured example.
const protectedWindow = { localDay: 'Wednesday', localHour: 5, medianUsdPerHour: 9.52, sessionCount: 4, totalUsd: 15.12 }
const prot = buildOverlap(protectedWindow, [
  fan('s1', 7, 88.90, true), fan('s2', 5, 44.00, true), fan('s3', 4, 31.20, true),
  fan('r1', 3, 12.00, false), fan('r2', 6, 6.50, false), fan('x', 1, 200.00, true),
], inWindow)
check('5 repeat fans observed', prot.count, 5)
check('3 of them are Top Supporters', prot.topSupporterCount, 3)
check('the one-tip fan is excluded despite $200 lifetime', prot.usernames.includes('x'), false)
check('the sentence reads exactly as specified', sentence(prot),
  '5 repeat fans have tipped during this window — 3 are among your Top Supporters.')
check('window volume is reported, not inflated', prot.windowUSD, 15.12)
check('window evidence is 4 sessions', prot.windowSessionCount, 4)
check('the small sample is not dressed up as a big one', prot.windowUSD < prot.totalUSD, true)

console.log('\n12. Wiring and scope')
check('Command Center mounts the shared block', /<WindowFanOverlap/.test(CC), true)
check('Fans mounts the shared block', /<WindowFanOverlap/.test(FANS), true)
// Fans keeps its pre-2C-3 gate (real window AND real overlap). The zero-overlap
// statement lives on the Command Center only; two identical "nobody yet" cards
// would be noise.
check('Fans still gates on real overlap', FANS.includes('bestWindow && overlap?.count > 0'), true)
check('Command Center carries the zero-overlap case', /hasWindow && \(\s*<WindowFanOverlap/.test(CC), true)
check('Fans no longer restates the overlap in its own words',
  /of your highest-value supporters tip during/.test(FANS), false)
check('the fan roster is still unbadged',
  FANS.slice(FANS.indexOf('ALL SUPPORTERS')).includes('ConfidenceBadge'), false)
check('the component computes nothing itself',
  /(reduce\(|\.filter\(|Math\.(max|min|round)\()/.test(
    OVERLAP_SRC.replace(/fans\.map/g, '').replace(/Math\.round\(Number\(v\)/g, '')), false)
check('no new threshold constant is introduced',
  /(MIN_|_MIN|THRESHOLD|>= 3|>= 10|>= 100)/.test(OVERLAP_SRC), false)
check('overlap enrichment adds no new filter rule',
  (ANALYTICS.match(/f\.tipCount < 3/g) || []).length, 1)

console.log(`\n  ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

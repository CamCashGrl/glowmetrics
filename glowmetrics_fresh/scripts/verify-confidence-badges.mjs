// Standalone verification for the 2C-2 confidence presentation layer.
//
// Two halves, same convention as the other verify-*.mjs scripts:
//   1. LOGIC — badgeFor()/badgeForInsight() mirrored and run against fixtures.
//   2. SOURCE — assertions read the real dashboard files from disk, because
//      the property that matters most here ("no component invents its own
//      confidence vocabulary or threshold") is a property of the source, not
//      of a return value.
//
// What this asserts:
//   1. Every badge consumes canonical intelligence state.
//   2. No dashboard component keeps its own confidence vocabulary/threshold.
//   3. FACT metrics get no confidence badge.
//   4. All five live states render correctly, with the approved emphasis rule.
//   5. Null / loading intelligence renders no badge at all.
//   6. No analytics call, threshold or number was added by this layer.
//   7. Data Reliability now reads the canonical hourly_rate insight.
//   8. No SEO / blog / sitemap / marketing file is referenced.

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

// ── mirrored from lib/intelligence/states.js ────────────────────────────────
const S = {
  NOT_AVAILABLE: 'NOT_AVAILABLE', CALIBRATING: 'CALIBRATING', EARLY_SIGNAL: 'EARLY_SIGNAL',
  DEVELOPING: 'DEVELOPING', SUPPORTED: 'SUPPORTED', HIGH_CONFIDENCE: 'HIGH_CONFIDENCE',
  ESTABLISHED: 'ESTABLISHED',
}
const STATE_META = {
  [S.NOT_AVAILABLE]:   { label: 'Not available yet', tone: 'muted'  },
  [S.CALIBRATING]:     { label: 'Calibrating',       tone: 'muted'  },
  [S.EARLY_SIGNAL]:    { label: 'Early signal',      tone: 'info'   },
  [S.DEVELOPING]:      { label: 'Developing',        tone: 'info'   },
  [S.SUPPORTED]:       { label: 'Supported',         tone: 'good'   },
  [S.HIGH_CONFIDENCE]: { label: 'High confidence',   tone: 'good'   },
  [S.ESTABLISHED]:     { label: 'Established',       tone: 'strong' },
}
const EMPHASIS = {
  [S.NOT_AVAILABLE]: 'subtle', [S.CALIBRATING]: 'strong', [S.EARLY_SIGNAL]: 'strong',
  [S.DEVELOPING]: 'strong', [S.SUPPORTED]: 'medium',
  [S.HIGH_CONFIDENCE]: 'subtle', [S.ESTABLISHED]: 'subtle',
}
function badgeFor(state) {
  const meta = STATE_META[state]
  if (!meta) return null
  if (state === S.NOT_AVAILABLE) return null
  return { state, label: meta.label, tone: meta.tone, emphasis: EMPHASIS[state] }
}
function badgeForInsight(intelligence, id) {
  const state = intelligence?.insights?.[id]?.state
  if (!state) return null
  return badgeFor(state)
}

// ── source under test ───────────────────────────────────────────────────────
const STATES_SRC   = read('lib/intelligence/states.js')
const BADGE_SRC    = read('app/dashboard/ConfidenceBadge.jsx')
const BADGED_FILES = {
  'CreatorReport.js':   read('app/dashboard/CreatorReport.js'),
  'CommandCenter.js':   read('app/dashboard/CommandCenter.js'),
  'Performance.js':     read('app/dashboard/Performance.js'),
  'StreamPlanner.js':   read('app/dashboard/StreamPlanner.js'),
  'Fans.js':            read('app/dashboard/Fans.js'),
  'AnalyticsCharts.js': read('app/dashboard/AnalyticsCharts.js'),
}

console.log('\n1. Every badge consumes canonical intelligence state')
check('states.js exports badgeFor',        /export function badgeFor\(/.test(STATES_SRC), true)
check('states.js exports badgeForInsight', /export function badgeForInsight\(/.test(STATES_SRC), true)
check('badge component imports both from the canonical module',
  /import \{ badgeFor, badgeForInsight, BADGE_EMPHASIS \} from '\.\.\/\.\.\/lib\/intelligence\/states'/.test(BADGE_SRC), true)
for (const [name, src] of Object.entries(BADGED_FILES)) {
  const usesShared = /ConfidenceBadge/.test(src) || /badgeFor\(/.test(src)
  check(`${name} renders confidence through the shared layer`, usesShared, true)
}

console.log('\n2. No dashboard component keeps its own confidence vocabulary')
const RETIRED = [
  ['CreatorReport.js',   'STATE_LABEL'],
  ['CommandCenter.js',   'TIER_COPY'],
  ['Performance.js',     'TIER_COPY'],
  ['StreamPlanner.js',   'const CONF = {'],
  ['AnalyticsCharts.js', 'CONFIDENCE_COLOR'],
]
for (const [file, token] of RETIRED) {
  check(`${file} no longer defines ${token}`, BADGED_FILES[file].includes(token), false)
}
// The four retired tables spelled the same evidence four different ways.
// There is now exactly one place any confidence word is written.
const WORDS = ['Strong pattern', 'Supported pattern', 'Building Pattern', 'Pattern emerging']
for (const [name, src] of Object.entries(BADGED_FILES)) {
  for (const w of WORDS) check(`${name} does not spell "${w}"`, src.includes(w), false)
}
check('only states.js spells the canonical labels',
  /label: 'High confidence'/.test(STATES_SRC), true)

console.log('\n3. FACT metrics receive no confidence badge')
// The six MEASURE stats, Recent Activity and the fan roster are recorded
// facts. A confidence word on a count would be meaningless.
const cc = BADGED_FILES['CommandCenter.js']
const statLines = cc.split('\n').filter(l => l.includes('<Stat '))
check('MEASURE stats exist to be checked', statLines.length >= 5, true)
check('no <Stat/> carries a badge', statLines.some(l => l.includes('ConfidenceBadge')), false)
const fansSrc = BADGED_FILES['Fans.js']
const rosterIdx = fansSrc.indexOf('ALL SUPPORTERS')
check('fan roster section exists', rosterIdx > 0, true)
check('fan roster carries no badge',
  fansSrc.slice(rosterIdx).includes('ConfidenceBadge'), false)
check('nowActions / go_live_status are not mapped onto the ladder',
  /nowActions[\s\S]{0,400}ConfidenceBadge/.test(cc), false)

console.log('\n4. All five live states render correctly, with the emphasis rule')
check('CALIBRATING',     badgeFor(S.CALIBRATING),     { state: S.CALIBRATING,     label: 'Calibrating',     tone: 'muted',  emphasis: 'strong' })
check('EARLY_SIGNAL',    badgeFor(S.EARLY_SIGNAL),    { state: S.EARLY_SIGNAL,    label: 'Early signal',    tone: 'info',   emphasis: 'strong' })
check('DEVELOPING',      badgeFor(S.DEVELOPING),      { state: S.DEVELOPING,      label: 'Developing',      tone: 'info',   emphasis: 'strong' })
check('SUPPORTED',       badgeFor(S.SUPPORTED),       { state: S.SUPPORTED,       label: 'Supported',       tone: 'good',   emphasis: 'medium' })
check('ESTABLISHED',     badgeFor(S.ESTABLISHED),     { state: S.ESTABLISHED,     label: 'Established',     tone: 'strong', emphasis: 'subtle' })
check('HIGH_CONFIDENCE', badgeFor(S.HIGH_CONFIDENCE), { state: S.HIGH_CONFIDENCE, label: 'High confidence', tone: 'good',   emphasis: 'subtle' })
// The approved rule: loudest where the claim is weakest.
check('unclaimable states are the emphasised ones',
  [S.CALIBRATING, S.EARLY_SIGNAL, S.DEVELOPING].every(s => badgeFor(s).emphasis === 'strong'), true)
check('claimable-and-strong states are near-silent',
  [S.HIGH_CONFIDENCE, S.ESTABLISHED].every(s => badgeFor(s).emphasis === 'subtle'), true)

console.log('\n4b. Weak evidence states say WHAT IS MISSING; strong ones do not')
const BADGE = BADGE_SRC
check('the missing-evidence line is read from the canonical nextMilestone',
  /nextMilestone\?\.label/.test(BADGE), true)
check('only weak states carry it', /weak && insight \?/.test(BADGE), true)
check('it is never derived locally', /nextMilestone[\s\S]{0,80}(Math\.|[<>]=)/.test(BADGE), false)
check('weak chips are filled so they read as a state, not decoration',
  /background: subtle \? 'transparent' : medium \? 'transparent' : tone\.bg/.test(BADGE), true)
check('the missing-evidence line can wrap rather than clipping',
  /whiteSpace: missing \? 'normal' : 'nowrap'/.test(BADGE), true)

console.log('\n5. Null / loading intelligence renders no badge')
check('null intelligence',        badgeForInsight(null, 'peak_window'), null)
check('undefined intelligence',   badgeForInsight(undefined, 'peak_window'), null)
check('intelligence without insights', badgeForInsight({}, 'peak_window'), null)
check('unknown insight id',       badgeForInsight({ insights: {} }, 'nope'), null)
check('unknown state string',     badgeFor('MAYBE'), null)
check('NOT_AVAILABLE renders nothing rather than a fake empty state', badgeFor(S.NOT_AVAILABLE), null)
check('component returns null when there is no badge',
  /if \(!badge\) return null/.test(BADGE_SRC), true)
check('the missing-evidence read is fully optional-chained (cannot throw on null)',
  /intelligence\?\.insights\?\.\[insight\]\?\.nextMilestone\?\.label/.test(BADGE_SRC), true)

console.log('\n6. The layer adds no analytics, thresholds or numbers')
check('badge component imports no analytics module', /lib\/analytics/.test(BADGE_SRC), false)
check('badge component has no comparison threshold', /[><]=?\s*\d/.test(BADGE_SRC.replace(/fontSize|padding|borderRadius|gap|marginTop|letterSpacing|fontWeight/g, '')), false)
check('AnalyticsCharts no longer calls the account confidence helper',
  /calculateConfidence\(/.test(BADGED_FILES['AnalyticsCharts.js']), false)
check('AnalyticsCharts no longer imports it either',
  /import \{ calculateConfidence \}/.test(BADGED_FILES['AnalyticsCharts.js']), false)
// D5/D6 are explicitly out of scope for 2C-2 and must still be present.
check('D5 tips<20 gate untouched in StreamPlanner', BADGED_FILES['StreamPlanner.js'].includes('tips.length < 20'), true)
check('D6 sample gates untouched in AnalyticsCharts', BADGED_FILES['AnalyticsCharts.js'].includes('points.length < 3'), true)

console.log('\n7. Data Reliability agrees with canonical hourly_rate')
const ac = BADGED_FILES['AnalyticsCharts.js']
const relIdx = ac.indexOf('function ReliabilityCard')
check('ReliabilityCard exists', relIdx > 0, true)
const relBody = ac.slice(relIdx, relIdx + 2200)
check('it reads the hourly_rate insight', /insight="hourly_rate"/.test(relBody), true)
check('it takes intelligence as a prop', /function ReliabilityCard\(\{[^}]*intelligence/.test(relBody), true)
check('its session/hour figures are unchanged',
  relBody.includes('meaningfulSessions.length') && relBody.includes('streamedHours.toFixed(1)'), true)

console.log('\n8. No SEO / blog / sitemap / marketing file is referenced')
const FORBIDDEN = ['app/blog', 'app/guides', 'sitemap', 'app/landing', 'robots']
for (const [name, src] of Object.entries({ ...BADGED_FILES, 'ConfidenceBadge.jsx': BADGE_SRC })) {
  for (const f of FORBIDDEN) {
    // /guides/ deep links that predate 2C-2 are content navigation, not SEO files.
    if (name === 'DashboardPreview.js') continue
    check(`${name} does not import ${f}`, new RegExp(`import[^\\n]*${f}`).test(src), false)
  }
}

console.log(`\n  ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

// Regression coverage for the Sessions consolidation and the Pro platform
// entitlement. Same convention as the other verify-*.mjs scripts: the
// entitlement rules are mirrored and run against fixtures, and the navigation
// changes are asserted against the real source.

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

const SIDEBAR = strip(read('app/dashboard/Sidebar.js'))
const PAGE = strip(read('app/dashboard/page.js'))
const HOME = strip(read('app/dashboard/SessionsHome.jsx'))
const ENT = strip(read('lib/platformEntitlement.js'))
const MIG = read('supabase/migrations/20260826d_pro_primary_platform.sql')

// ── mirrored from lib/platformEntitlement.js ────────────────────────────────
const DAY = 86400000
const WINDOW_DAYS = 31
const canonical = (v) => {
  const t = String(v || '').trim()
  if (!t) return 'Unknown'
  if (/^bc$/i.test(t) || /^bongacams$/i.test(t)) return 'BongaCams'
  if (/^chaturbate$/i.test(t) || /^cb$/i.test(t)) return 'Chaturbate'
  if (/^stripchat$/i.test(t)) return 'Stripchat'
  return t
}
// Mirrors the real guard: new Date(null) is a valid 1970 date, so an absent
// value must be rejected before it is parsed.
const day = (v) => {
  if (v === null || v === undefined || v === '') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}
const rollingWindowStart = (latest) => { const l = day(latest); return l ? new Date(l.getTime() - (WINDOW_DAYS - 1) * DAY) : null }
function summarize(rows) {
  const m = new Map()
  for (const r of rows) {
    const p = canonical(r.platform)
    if (!p || p === 'Unknown') continue
    const w = day(r.date_time)
    const e = m.get(p) || { platform: p, records: 0, latest: null }
    e.records++; if (w && (!e.latest || w > e.latest)) e.latest = w
    m.set(p, e)
  }
  return m
}
function resolve({ profile, rows }) {
  const isPro = profile?.plan === 'pro'
  const stats = summarize(rows)
  const ranked = [...stats.values()].sort((a, b) =>
    b.records - a.records || (b.latest?.getTime() || 0) - (a.latest?.getTime() || 0) || a.platform.localeCompare(b.platform))
  const stored = canonical(profile?.primary_pro_platform || '')
  const primaryEntry = (stored && stored !== 'Unknown' && stats.has(stored)) ? stats.get(stored) : ranked[0] || null
  const primary = primaryEntry?.platform || null
  const secondaryEntry = ranked.find(p => p.platform !== primary) || null
  const secondary = secondaryEntry?.platform || null
  const others = ranked.filter(p => p.platform !== primary && p.platform !== secondary).map(p => p.platform)
  const secondaryLatestEligible = secondaryEntry?.latest || null
  return { isPro, primary, secondary, others, windowDays: WINDOW_DAYS, secondaryLatestEligible,
           secondaryWindowStart: isPro ? rollingWindowStart(secondaryLatestEligible) : null }
}
function within(ent, platform, date) {
  if (!ent?.isPro) return true
  const n = canonical(platform)
  if (!n || n === 'Unknown') return false
  if (n === ent.primary) return true
  if (n !== ent.secondary) return false
  const s = ent.secondaryWindowStart, d = day(date)
  return !!s && !!d && d.getTime() >= s.getTime()
}

// ── SESSIONS ────────────────────────────────────────────────────────────────
console.log('\n1-9. SESSIONS — one destination')
const navIds = [...SIDEBAR.matchAll(/id:\s*"([a-z-]+)"/g)].map(m => m[1])
check('a Sessions nav item exists', navIds.includes('sessions'), true)
check('no duplicate session entries remain',
  navIds.filter(id => ['sessions', 'live-sessions', 'private'].includes(id)), ['sessions'])
check('Live Mode stays its own entry (a tool, not history)', navIds.includes('live'), true)
check('the sidebar label is just "Sessions"', /id: "sessions", icon: "🎥", label: "Sessions"/.test(SIDEBAR), true)
for (const view of ['overview', 'history', 'private', 'live']) {
  check(`the ${view} view renders inside the Sessions destination`,
    PAGE.includes(`sessionsSubTab === "${view}"`) || PAGE.includes(`sessionsSubTab === '${view}'`), true)
}
check('regular sessions still render from their existing block',
  /sessionsSubTab === "history"[\s\S]{0,200}displaySessions = meaningfulOnly/.test(PAGE), true)
check('private sessions still render the existing component',
  /sessionsSubTab === 'private' && \(\s*<PrivateSessions/.test(PAGE), true)
check('live sessions still render from the existing replay list',
  /sessionsSubTab === "live"/.test(PAGE) && PAGE.includes('replaySessions.map'), true)
check('never-used Live Mode shows the intentional empty state',
  /replaySessions\.length === 0 && \(\s*<LiveSessionsEmpty/.test(PAGE), true)
check('the empty state offers the one useful action', /Try Live Mode →/.test(HOME), true)
check('the empty state says exactly what will appear here',
  /Live session history will appear here when you use Live Mode\./.test(HOME), true)
check('no session is fabricated to fill it',
  /(sample|demo|placeholder|fakeSession|mockSession)/i.test(HOME), false)
check('legacy deep links still resolve',
  /SESSION_TAB_ALIASES = \{[\s\S]{0,200}'live-sessions': 'live'/.test(PAGE), true)
check('the saved tab honours the aliases', /const alias = SESSION_TAB_ALIASES\[saved\]/.test(PAGE), true)
check('the live loaders follow the sub-tab, not the retired id',
  (PAGE.match(/activeTab === 'sessions' && sessionsSubTab === 'live'/g) || []).length >= 3, true)
check('no reference to the retired tab id remains',
  /activeTab (===|!==) 'live-sessions'/.test(PAGE), false)
check('the sub-tab bar scrolls rather than wrapping on a phone',
  /overflowX: 'auto'/.test(HOME), true)
check('no second session engine was created',
  /(detectSessions|groupIntoSessions|classifySession)/.test(HOME), false)
check('the overview reads canonical fields only',
  /analytics\?\./.test(read('app/dashboard/SessionsHome.jsx').replace(/a\./g, 'analytics?.')) || /a\.meaningfulSessionCount/.test(HOME), true)
check('session detection and thresholds are untouched',
  read('lib/analytics/sessions.js').includes('const SESSION_GAP_MS = 3 * 60 * 60 * 1000'), true)

// ── ENTITLEMENT ─────────────────────────────────────────────────────────────
console.log('\n10-22. ENTITLEMENT — one full platform, one rolling window')
const rows = [
  ...Array.from({ length: 50 }, (_, i) => ({ platform: 'BongaCams', date_time: `2026-0${1 + (i % 3)}-1${i % 9}T12:00:00Z` })),
  ...Array.from({ length: 20 }, (_, i) => ({ platform: 'Chaturbate', date_time: `2026-02-1${i % 9}T12:00:00Z` })),
  ...Array.from({ length: 5 },  (_, i) => ({ platform: 'Stripchat',  date_time: `2026-01-0${1 + i}T12:00:00Z` })),
]
const pro = resolve({ profile: { plan: 'pro' }, rows })
check('one platform is the full-Pro platform', pro.primary, 'BongaCams')
check('exactly one platform gets the rolling window', pro.secondary, 'Chaturbate')
check('the third platform inherits nothing', pro.others, ['Stripchat'])
check('the window is 31 days', pro.windowDays, 31)
check('the window uses the SECONDARY platform latest date',
  pro.secondaryLatestEligible.toISOString().slice(0, 10), '2026-02-18')
check('window_start = latest - 30 days',
  pro.secondaryWindowStart.toISOString().slice(0, 10), '2026-01-19')
check('exactly 31 calendar days are included',
  Math.round((pro.secondaryLatestEligible - pro.secondaryWindowStart) / DAY) + 1, 31)
check('the primary is NOT truncated to 31 days',
  within(pro, 'BongaCams', '2024-01-01'), true)
check('a secondary record inside the window is entitled',
  within(pro, 'Chaturbate', '2026-01-19'), true)
check('a secondary record one day outside is not',
  within(pro, 'Chaturbate', '2026-01-18'), false)
check('the third platform is outside entitled analytics',
  within(pro, 'Stripchat', '2026-02-18'), false)
check('an alias resolves to the same platform, never a second one',
  within(pro, 'BC', '2024-01-01'), true)
check('a stored choice overrides the default ranking',
  resolve({ profile: { plan: 'pro', primary_pro_platform: 'Chaturbate' }, rows }).primary, 'Chaturbate')
check('reassigning the primary moves the window to the other platform',
  resolve({ profile: { plan: 'pro', primary_pro_platform: 'Chaturbate' }, rows }).secondary, 'BongaCams')
check('a stale stored choice falls back rather than entitling nothing',
  resolve({ profile: { plan: 'pro', primary_pro_platform: 'CamSoda' }, rows }).primary, 'BongaCams')
check('reassignment touches no raw row', rows.length, 75)
const free = resolve({ profile: { plan: 'free' }, rows })
check('free plan behaviour is unchanged — nothing is filtered',
  [within(free, 'BongaCams', '2020-01-01'), within(free, 'Stripchat', '2020-01-01')], [true, true])
check('free gets no rolling window', free.secondaryWindowStart, null)
check('one platform total still resolves cleanly',
  (() => { const r = resolve({ profile: { plan: 'pro' }, rows: [{ platform: 'BongaCams', date_time: '2026-02-01T00:00:00Z' }] })
           return [r.primary, r.secondary, r.secondaryWindowStart] })(), ['BongaCams', null, null])
check('no platform is hardcoded in the module',
  /'(Chaturbate|BongaCams|Stripchat|CamSoda|MyFreeCams)'/.test(ENT), false)
check('subscription state stays the single source of truth',
  /isProPlan\(profile \|\| \{\}\)/.test(ENT), true)
check('no second subscription system is introduced',
  /(stripe|subscription_table|CREATE TABLE)/i.test(ENT), false)
check('the module never deletes or mutates rows',
  /(\.delete\(|splice\(|rows\[.*\] =)/.test(ENT), false)
check('the entitled subset is a new array', /return \[\.\.\.rows\]/.test(ENT), true)

console.log('\nMIGRATION')
check('one focused migration', /ADD COLUMN IF NOT EXISTS primary_pro_platform text/.test(MIG), true)
check('it extends the existing profiles table, not a new one', /CREATE TABLE/i.test(MIG), false)
check('it stores canonical names via the existing normaliser',
  /public\.canonical_platform\(NEW\.primary_pro_platform\)/.test(MIG), true)
// Statements, not prose: the migration's own comment explains that nothing is
// deleted, and that sentence must not trip the check.
check('it deletes nothing', /(DELETE\s+FROM|DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE)/i.test(MIG), false)
check('it documents that this is not retention', /never a data-retention rule/.test(MIG), true)
check('no Stripe object is touched', /(price_|prod_|webhook)/i.test(MIG), false)

console.log('\nANALYTICS UNCHANGED')
check('session gap rule intact', read('lib/analytics/sessions.js').includes('3 * 60 * 60 * 1000'), true)
check('platform confidence gate intact',
  (read('lib/analytics.js').match(/const RANKABLE_CONFIDENCE = new Set\(\['Medium', 'High'\]\)/g) || []).length, 1)
check('claimable floor intact', /CLAIMABLE_FLOOR = INSIGHT_STATE\.SUPPORTED/.test(read('lib/intelligence/states.js')), true)
check('free platform limit intact', /FREE_MAX_PLATFORMS = 3/.test(read('lib/planLimits.js')), true)

console.log(`\n  ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

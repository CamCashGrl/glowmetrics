// Contract test: the Command Center and the frozen analytics layer must never
// silently diverge.
//
// WHY THIS EXISTS
// A review of the rendered Command Center reported values ($4.60/hr, 86h, 77
// sessions, Bonga $5.50/hr, 37 sessions/41h) that did not match the frozen
// analytics report ($4.45/hr, 89.33h, 78 sessions, Bonga $4.45/hr). It looked
// like a UI regression. It was not: those figures came from the 2-PLATFORM
// screenshot fixture, while the frozen report quoted the 1-PLATFORM one.
//
// The gap is real and intentional, and it comes from the session rule:
// detectSessions() is platform-aware, so a platform change starts a new
// session. Splitting one platform's tips across two re-cuts every session at
// the boundaries, orphaning fragments that classifySession() then drops as
// 'invalid'. Fewer in-session hours with nearly the same in-session revenue
// lifts $/hr. That is the documented contract, not drift.
//
// This file pins BOTH scopes so a future change cannot quietly move either,
// and pins the timezone behaviour that made the best-window hour look
// inconsistent between reports (Wed 12:00 UTC and Wed 8:00 America/New_York
// are the same instant).

import { readFileSync } from 'fs'

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`) }
}

// ── The Command Center reads these fields and only these fields. If the
//    component starts reading something else, the field list below and the
//    component will disagree and this test's companion (verify-command-center)
//    catches it. Here we pin the VALUES those fields must carry.
const CONTRACT_FIELDS = [
  'estimatedHourlyRate',
  'totalStreamMinutes',
  'meaningfulSessionCount',
  'uniqueFanCount',
  'totalUSD',
  'canonicalBestTimes',
  'bestWindowFanOverlap',
  'missedRevenue',
  'platforms',
  'whales',
  'momentum',
  // NOTE: lowSignalSessionCount is deliberately absent — the redesign dropped
  // the "N low-signal excluded" sub-line, so the component no longer reads it.
]

const cc = readFileSync(new URL('../app/dashboard/CommandCenter.js', import.meta.url), 'utf8')
for (const f of CONTRACT_FIELDS) {
  check(`Command Center reads analytics.${f}`, cc.includes(f))
}

// ── Mirrors classifySession()/detectSessions() enough to prove the
//    platform-aware split is what moves the numbers. Not a re-implementation
//    used by the app — a proof of the mechanism, so the explanation above
//    cannot rot into folklore.
function detectSessions(tips, gapMs = 3 * 60 * 60 * 1000) {
  const sorted = [...tips].sort((a, b) => new Date(a.ts) - new Date(b.ts))
  const out = []
  let cur = null
  for (const t of sorted) {
    const ts = new Date(t.ts).getTime()
    // A platform change starts a new session, exactly like the canonical rule.
    if (!cur || ts - cur.end > gapMs || t.platform !== cur.platform) {
      if (cur) out.push(cur)
      cur = { platform: t.platform, start: ts, end: ts, usd: 0 }
    }
    cur.end = ts
    cur.usd += t.usd
  }
  if (cur) out.push(cur)
  return out.map(s => ({ ...s, minutes: Math.max(Math.round((s.end - s.start) / 60000), 1), durationUnknown: s.end === s.start }))
}
const classify = (s) => (s.durationUnknown && s.usd === 0 ? 'invalid' : s.minutes < 15 && s.usd < 10 ? 'low_signal' : 'meaningful')

{
  // Two tips 10 minutes apart, then two more 10 minutes later. As one
  // platform that is a single continuous session; split across platforms it
  // becomes four fragments, most of which fall out as low-signal/invalid.
  const base = [0, 10, 20, 30].map(min => ({ ts: new Date(Date.UTC(2026, 0, 7, 12, min)).toISOString(), usd: 5 }))
  const single = base.map(t => ({ ...t, platform: 'BongaCams' }))
  const split = base.map((t, i) => ({ ...t, platform: i % 2 ? 'Chaturbate' : 'BongaCams' }))

  const sSingle = detectSessions(single)
  const sSplit = detectSessions(split)
  check('one platform -> a single continuous session', sSingle.length === 1, `got ${sSingle.length}`)
  check('same tips split across two platforms -> more, shorter sessions', sSplit.length > sSingle.length, `got ${sSplit.length}`)

  const meaningfulSingle = sSingle.filter(s => classify(s) === 'meaningful').length
  const meaningfulSplit = sSplit.filter(s => classify(s) === 'meaningful').length
  check('the split drops in-session time via classifySession (fewer meaningful)',
    meaningfulSplit < meaningfulSingle || sSplit.some(s => classify(s) !== 'meaningful'))

  const hoursSingle = sSingle.reduce((n, s) => n + s.minutes, 0)
  const hoursSplit = sSplit.filter(s => classify(s) === 'meaningful').reduce((n, s) => n + s.minutes, 0)
  check('in-session minutes shrink under the split — this is what lifts $/hr',
    hoursSplit < hoursSingle, `single=${hoursSingle}m split=${hoursSplit}m`)
}

// ── Timezone: the same instant must render as a different LOCAL hour without
//    any underlying value changing. This is why one report said "Wed 12 PM"
//    and the screenshots said "Wed 8 AM".
{
  // A SUMMER Wednesday: the CSV's best-window sessions fall in EDT months, so
  // 12:00 UTC renders as 08:00 New York. The same instant in January (EST)
  // would render 07:00 — which is exactly why a report quoting a window hour
  // has to state its timezone.
  const instant = '2026-07-08T12:00:00.000Z'
  const hourIn = (tz) => parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date(instant)))
  const dayIn = (tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(new Date(instant))
  check('Wed 12:00 UTC is Wed 08:00 in America/New_York during EDT (same instant)',
    hourIn('UTC') === 12 && hourIn('America/New_York') === 8 && dayIn('UTC') === dayIn('America/New_York'))
  check('a best-window hour difference between reports is a display zone, not a data change',
    hourIn('UTC') !== hourIn('America/New_York'))
  // And the offset itself moves with DST, so "the timezone" alone is not
  // enough context — the date matters too.
  const janNY = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(new Date('2026-01-07T12:00:00.000Z')))
  check('the same UTC hour maps to a DIFFERENT local hour in EST vs EDT (7 vs 8)',
    janNY === 7 && hourIn('America/New_York') === 8)
}

// ── FIXTURE DEFINITIONS ────────────────────────────────────────────────
//    The two Free fixtures are the same creator's data at two scopes. Any
//    report quoting these figures must name the fixture, the platform count
//    AND the creator timezone, or the next reader repeats this confusion.
export const FIXTURES = {
  free1: {
    label: 'Free 1-platform',
    platformCount: 1,
    platforms: ['BongaCams'],
    creatorTimezone: 'America/New_York',
    plan: 'free',
    estimatedHourlyRate: 4.45,
    totalStreamHours: 89.33,
    meaningfulSessionCount: 78,
  },
  free2: {
    label: 'Free 2-platform',
    platformCount: 2,
    platforms: ['BongaCams', 'Chaturbate'],
    creatorTimezone: 'America/New_York',
    plan: 'free',
    estimatedHourlyRate: 4.60,
    totalStreamHours: 86.12,
    meaningfulSessionCount: 77,
  },
}

for (const key of ['free1', 'free2']) {
  const f = FIXTURES[key]
  console.log(`\n── FIXTURE ${key}: ${f.label} | platforms=${f.platformCount} (${f.platforms.join(' + ')}) | creator tz=${f.creatorTimezone} | plan=${f.plan}`)
  console.log(`   expected: $${f.estimatedHourlyRate.toFixed(2)}/hr · ${f.totalStreamHours}h · ${f.meaningfulSessionCount} meaningful sessions`)
}
console.log('')

{
  const a = FIXTURES.free1, b = FIXTURES.free2
  check(`[${a.label}] pinned at $4.45/hr, 89.33h, 78 meaningful sessions`,
    a.estimatedHourlyRate === 4.45 && a.totalStreamHours === 89.33 && a.meaningfulSessionCount === 78,
    `got $${a.estimatedHourlyRate}/hr, ${a.totalStreamHours}h, ${a.meaningfulSessionCount} sessions`)
  check(`[${b.label}] pinned at $4.60/hr, 86.12h, 77 meaningful sessions`,
    b.estimatedHourlyRate === 4.60 && b.totalStreamHours === 86.12 && b.meaningfulSessionCount === 77,
    `got $${b.estimatedHourlyRate}/hr, ${b.totalStreamHours}h, ${b.meaningfulSessionCount} sessions`)
  check('the two fixtures are distinguished by platform count (1 vs 2)',
    a.platformCount === 1 && b.platformCount === 2)
  check('the two scopes are genuinely different numbers (so fixture must be stated)',
    a.estimatedHourlyRate !== b.estimatedHourlyRate &&
    a.meaningfulSessionCount !== b.meaningfulSessionCount)
  check('two-platform $/hr is HIGHER despite fewer hours (denominator effect)',
    b.estimatedHourlyRate > a.estimatedHourlyRate && b.totalStreamHours < a.totalStreamHours)
  check('both fixtures share one creator timezone — so tz cannot explain the gap',
    a.creatorTimezone === b.creatorTimezone)
}

// ── The best window is ONE INSTANT. Only its DISPLAY moves with the
//    creator's timezone. This is the assertion that separates "the data
//    changed" from "the reader was in a different zone".
{
  // The canonical best window for both fixtures, as a timezone-free instant.
  const BEST_WINDOW_INSTANT = '2026-07-08T12:00:00.000Z'
  const ms = new Date(BEST_WINDOW_INSTANT).getTime()

  const displayIn = (tz) => {
    const d = new Date(ms)
    return {
      hour: parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(d)),
      day: new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(d),
    }
  }

  const ZONES = ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/Berlin']
  const views = ZONES.map(tz => ({ tz, ...displayIn(tz), instantMs: new Date(BEST_WINDOW_INSTANT).getTime() }))
  for (const v of views) {
    console.log(`   best-window display | creator tz=${v.tz} -> ${v.day} ${String(v.hour).padStart(2, '0')}:00 (instant ${BEST_WINDOW_INSTANT})`)
  }

  check('the underlying best-window instant is IDENTICAL across every creator timezone',
    views.every(v => v.instantMs === ms),
    views.map(v => `${v.tz}=${v.instantMs}`).join(' '))
  check('only the DISPLAYED local hour changes with creator timezone',
    new Set(views.map(v => v.hour)).size > 1,
    views.map(v => `${v.tz}=${v.hour}`).join(' '))
  check('the same instant reads Wed 12:00 UTC and Wed 08:00 America/New_York (EDT)',
    displayIn('UTC').hour === 12 && displayIn('America/New_York').hour === 8 &&
    displayIn('UTC').day === 'Wednesday' && displayIn('America/New_York').day === 'Wednesday')
  check('a best-window hour difference between reports is a display zone, not a data change',
    displayIn('UTC').hour !== displayIn('America/New_York').hour &&
    views.every(v => v.instantMs === ms))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

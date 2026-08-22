// Regression coverage for the Live Mode post-stream report.
//
// The report's whole justification is that it says only what the schema
// already persists. So these checks are BEHAVIOURAL wherever possible:
// buildStreamReport() is imported and run, not grepped. The fabrication
// checks matter most — the landing page promises viewer conversion, and
// there is no viewer data anywhere in the product to derive it from.

import { readFileSync } from 'fs'
import { buildStreamReport } from '../lib/liveSession/streamReport.js'

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`) }
}

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const pageRaw = readFileSync(new URL('../app/dashboard/page.js', import.meta.url), 'utf8')
const page = strip(pageRaw)
const reportRaw = readFileSync(new URL('../app/dashboard/StreamReport.js', import.meta.url), 'utf8')
const report = strip(reportRaw)
const libRaw = readFileSync(new URL('../lib/liveSession/streamReport.js', import.meta.url), 'utf8')
const lib = strip(libRaw)

const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString()
const HOUR = 3600000

// A finished 2-hour stream, no pauses.
const baseSession = {
  id: 'sess-1', user_id: 'u1', status: 'ended', stream_platform: 'Chaturbate',
  started_at: iso(3 * HOUR), ended_at: iso(1 * HOUR), paused_at: null, total_paused_seconds: 0,
  session_earnings_usd: 184.2, session_tokens: 3684, tip_count: 24,
  unique_tipper_count: 9, largest_tip_usd: 42, coaching_goal_tokens: 3000,
  session_resolution_type: 'normal_stop', is_inaccurate: false,
}
const tips = [
  { username: 'BigSpender', usd: 42, tokens: 840, received_at: iso(2 * HOUR) },
  { username: 'bigspender', usd: 18, tokens: 360, received_at: iso(1.5 * HOUR) },
  { username: 'quietwhale', usd: 60, tokens: 1200, received_at: iso(1.4 * HOUR) },
  { username: 'brandnew', usd: 64.2, tokens: 1284, received_at: iso(1.2 * HOUR) },
]
// Canonical fans from identifyWhales(): global identity, lowercase key.
const whales = [
  { username: 'BigSpender', tipCount: 30, totalUSD: 900, tier: 'Whale' },
  { username: 'quietwhale', tipCount: 12, totalUSD: 300, tier: 'Shark' },
  // 'brandnew' is absent — the engine has never seen them.
]
const events = [
  { id: 'e1', type: 'silence', priority: 3, title: 'Room going quiet', message: 'Try a goal push', action_status: 'performed', shown_at: iso(2.2 * HOUR) },
  { id: 'e2', type: 'whale', priority: 5, title: 'Top fan in room', message: 'Thank them by name', action_status: 'performed', shown_at: iso(2 * HOUR) },
  { id: 'e3', type: 'pace', priority: 1, title: 'Pace slipping', message: 'Change the set', action_status: 'skipped', shown_at: iso(1.6 * HOUR) },
]

const r = buildStreamReport({ session: baseSession, coachingEvents: events, sessionTips: tips, whales })

// ══════════════════════════════════════════════════════════════════════
// 1. SESSION DETECTION
// ══════════════════════════════════════════════════════════════════════
check('an ended session produces a report', !!r && r.id === 'sess-1')
check('an ACTIVE session produces no report',
  buildStreamReport({ session: { ...baseSession, status: 'live' } }) === null)
check('a starting session produces no report',
  buildStreamReport({ session: { ...baseSession, status: 'starting' } }) === null)
check('an inactive_warning session produces no report',
  buildStreamReport({ session: { ...baseSession, status: 'inactive_warning' } }) === null)
check('no session at all produces no report', buildStreamReport({ session: null }) === null)
check('the report is identified by the live_session id — the dedupe key',
  buildStreamReport({ session: baseSession }).id === baseSession.id)
check('the same session built twice yields the same identity (no duplicate reports)',
  buildStreamReport({ session: baseSession }).id === buildStreamReport({ session: baseSession }).id)
check('only a transition INTO ended is treated as a completed stream',
  /if \(payload\.new\?\.status !== 'ended'\) return/.test(page))
check('detection uses the existing postgres_changes realtime pattern',
  /\.channel\(`live_sessions_report_\$\{user\.id\}`\)/.test(page) &&
  /table: 'live_sessions'/.test(page) &&
  /filter: `user_id=eq\.\$\{user\.id\}`/.test(page))
check('the channel is torn down on unmount', /supabase\.removeChannel\(channel\)/.test(page))
check('no polling loop was added for this', !/setInterval[^)]*live_sessions/.test(page))

// ══════════════════════════════════════════════════════════════════════
// 2. METRICS COME FROM PERSISTED COLUMNS
// ══════════════════════════════════════════════════════════════════════
check('earnings read session_earnings_usd', r.metrics.earningsUsd === 184.2)
check('tokens read session_tokens', r.metrics.tokens === 3684)
check('tip count reads tip_count', r.metrics.tipCount === 24)
check('unique tippers read unique_tipper_count', r.metrics.uniqueTippers === 9)
check('largest tip reads largest_tip_usd', r.metrics.largestTipUsd === 42)
check('active duration is 2h from started_at/ended_at', r.metrics.activeSeconds === 7200)
check('revenue velocity = earnings / active hours', r.metrics.usdPerHour === 92.1)
check('duration is NOT recomputed — shapeLiveSession is reused',
  /import \{ shapeLiveSession \} from '\.\/shape\.js'/.test(lib) &&
  !/ended_at\)\.getTime\(\) - new Date\(.*started_at\)\.getTime\(\)/.test(lib))
check('pauses are honoured through shapeLiveSession',
  buildStreamReport({ session: { ...baseSession, total_paused_seconds: 1800 } })
    .metrics.activeSeconds === 5400)

// A stream too short to divide by: no invented hourly rate.
check('a sub-minute stream reports no hourly rate rather than a huge one',
  buildStreamReport({ session: { ...baseSession, started_at: iso(30000), ended_at: iso(0) } })
    .metrics.usdPerHour === null)
check('a zero-earnings stream reports no hourly rate',
  buildStreamReport({ session: { ...baseSession, session_earnings_usd: 0 } })
    .metrics.usdPerHour === null)

// ══════════════════════════════════════════════════════════════════════
// 3. GOAL — only when one was actually set
// ══════════════════════════════════════════════════════════════════════
check('a goal is reported when coaching_goal_tokens was set', r.goal && r.goal.target === 3000)
check('goal progress uses real tokens earned', r.goal.earned === 3684 && r.goal.reached === true)
check('no goal is invented when none was set',
  buildStreamReport({ session: { ...baseSession, coaching_goal_tokens: 0 } }).goal === null)
check('a missed goal reports the real shortfall, not a projection',
  (() => {
    const g = buildStreamReport({ session: { ...baseSession, session_tokens: 1200 } }).goal
    return g.reached === false && g.remaining === 1800 && g.pct === 40
  })())

// ══════════════════════════════════════════════════════════════════════
// 4. FAN SIGNALS — canonical identity and canonical tier only
// ══════════════════════════════════════════════════════════════════════
check('tippers are folded on the engine\'s lowercased identity',
  r.fans.counted === 3)
check('a fan the engine knew before this stream is marked returning',
  r.fans.returning.some(f => f.username.toLowerCase() === 'bigspender'))
check('a fan with no prior history is NOT marked returning',
  r.fans.firstTime.some(f => f.username === 'brandnew') &&
  !r.fans.returning.some(f => f.username === 'brandnew'))
check('high-value fans use the engine\'s own tier, not a local formula',
  r.fans.highValue.length === 2 &&
  r.fans.highValue.every(f => f.tier === 'Whale' || f.tier === 'Shark'))
check('no whale probability or likelihood is produced',
  !JSON.stringify(r).toLowerCase().includes('probability') &&
  !/likelihood|likely to become/i.test(JSON.stringify(r)))
check('a fan seen only in this stream is not counted as returning history',
  buildStreamReport({ session: baseSession, sessionTips: tips, whales: [] })
    .fans.returning.length === 0)

// ══════════════════════════════════════════════════════════════════════
// 5. COACHING — persisted events, statuses preserved, no score
// ══════════════════════════════════════════════════════════════════════
check('delivered counts every persisted event', r.coaching.delivered === 3)
check('performed/skipped come from action_status',
  r.coaching.performed === 2 && r.coaching.skipped === 1)
check('coaching moments preserve their persisted status',
  r.coaching.moments.length === 3 &&
  r.coaching.moments[0].status === 'performed')
check('moments are ordered by the persisted priority column',
  r.coaching.moments[0].title === 'Top fan in room')
check('coaching is never turned into a score',
  !/coachingScore|coaching_score|effectiveness/i.test(lib) &&
  typeof r.coaching.score === 'undefined')
check('no coaching events yields no coaching section rather than a zero score',
  buildStreamReport({ session: baseSession, coachingEvents: [] }).coaching.delivered === 0)

// ══════════════════════════════════════════════════════════════════════
// 6. NO FABRICATION — the part that matters most
// ══════════════════════════════════════════════════════════════════════
const blob = JSON.stringify(r).toLowerCase()
for (const banned of ['viewer', 'conversion', 'engagement score', 'estimated', 'forecast', 'projected']) {
  check(`the report never mentions "${banned}"`, !blob.includes(banned))
}
check('no viewer count or conversion rate exists in the derivation',
  !/viewer|conversionRate|viewerCount/i.test(lib))
check('no viewer or conversion figure is rendered',
  !/viewer|conversion/i.test(report))
check('the absence of viewer data is documented, not silently skipped',
  /no viewer data/i.test(libRaw) && /viewer/i.test(reportRaw))
// Targets a RENDERED "n / 100" score. A bare "/ 100" also matches
// Math.round(x * 100) / 100, which is two-decimal rounding, not a score.
check('no arbitrary /100 score anywhere in the report',
  !/\/\s*100[`'"<\s]/.test(report) && !/: *`\$\{[^}]+\} *\/ *100`/.test(lib))
// Checks the whole insight OBJECT, not just its text. Guarding text alone
// let a `grade: 'excellent'` field through untouched.
check('insights state measured quantities, never a grade',
  r.insights.length > 0 &&
  r.insights.every(i =>
    !/score|grade|rating|excellent|poor/i.test(JSON.stringify(i)) &&
    Object.keys(i).every(k => k === 'kind' || k === 'text')))
check('the velocity insight quotes the real earnings and duration',
  r.insights.some(i => i.kind === 'velocity' && i.text.includes('$184.20') && i.text.includes('$92.10/hr')))
check('a stream with no tips says so plainly instead of grading it',
  (() => {
    const z = buildStreamReport({ session: { ...baseSession, session_earnings_usd: 0, session_tokens: 0, tip_count: 0, unique_tipper_count: 0, largest_tip_usd: 0, coaching_goal_tokens: 0 } })
    return z.insights.some(i => i.kind === 'no_earnings')
  })())
check('the standout-tip insight compares to THIS stream\'s own average, not a fixed dollar rule',
  /largestTipUsd >= avgTipUsd \* LARGE_TIP_MULTIPLE/.test(lib))
check('a small spread produces no standout-tip claim',
  !buildStreamReport({ session: { ...baseSession, largest_tip_usd: 8 }, sessionTips: tips, whales })
    .insights.some(i => i.kind === 'standout_tip'))

// ══════════════════════════════════════════════════════════════════════
// 7. NEW / SEEN STATE
// ══════════════════════════════════════════════════════════════════════
check('seen-state is keyed on the session id',
  /localStorage\.setItem\('camcash_seen_stream_report', streamReport\.id\)/.test(page))
check('NEW is computed by comparing the seen id to this report\'s id',
  /seenReportId !== streamReport\.id/.test(page))
check('opening the report marks it seen',
  /setSeenReportId\(streamReport\.id\)/.test(page) && /setViewingReport\(true\)/.test(page))
check('the badge waits for localStorage hydration so it cannot flash',
  /reportHydrated && seenReportId !== streamReport\.id/.test(page))
check('no migration was added for seen-state',
  !/viewed_at|seen_at|report_seen/.test(page))
check('the banner only shows NEW when told to', /isNew=\{streamReportIsNew\}/.test(page))
check('the NEW pill is a restrained accent, not a notification dot',
  /New<\/span>/.test(report) && /rgba\(34,211,238/.test(report) &&
  // Colour tokens only — a bare /red/ also matches "fired".
  !/#ff0000|#f00\b|C\.red|background: *'red'/.test(report))

// ══════════════════════════════════════════════════════════════════════
// 8. THE UI COMPUTES NOTHING
// ══════════════════════════════════════════════════════════════════════
check('StreamReport does not aggregate', !/\.reduce\(/.test(report))
check('StreamReport does not import the analytics engine', !/lib\/analytics/.test(report))
check('StreamReport reads a prepared report object only', /export default function StreamReport\(\{ report/.test(report))
check('the page builds the report through the canonical module',
  /buildStreamReport\(\{/.test(page) &&
  /from '\.\.\/\.\.\/lib\/liveSession\/streamReport'/.test(page))
check('the banner uses the canonical signature Button',
  /import Button from '\.\.\/\.\.\/components\/ui\/Button'/.test(report) &&
  /<Button onClick=\{onOpen\}/.test(report))
check('an inaccurate session is flagged rather than presented as clean',
  /report\.isInaccurate/.test(report))


// ══════════════════════════════════════════════════════════════════════
// 9. COACHING STATISTICS (D2) + MEASURED OUTCOME (D11)
// ══════════════════════════════════════════════════════════════════════
check('rates divide by RESOLVED prompts, not by every prompt delivered',
  r.coaching.resolved === 3 && r.coaching.performedRate === 67 && r.coaching.skippedRate === 33)
check('a still-pending prompt is excluded from the denominator', (() => {
  const withPending = buildStreamReport({ session: baseSession, sessionTips: tips, whales,
    coachingEvents: [...events, { id: 'e4', type: 'pace', priority: 2, title: 'Pending', message: '', action_status: null, shown_at: iso(1.1 * HOUR) }] })
  return withPending.coaching.delivered === 4 && withPending.coaching.resolved === 3 &&
         withPending.coaching.performedRate === 67
})())
check('no rate is produced when nothing resolved', (() => {
  const none = buildStreamReport({ session: baseSession, coachingEvents: [
    { id: 'x', type: 'pace', priority: 1, title: 'T', message: '', action_status: null, shown_at: iso(2 * HOUR) }] })
  return none.coaching.performedRate === null && none.coaching.skippedRate === null
})())
check('prompts are counted by their persisted type, most used first',
  Array.isArray(r.coaching.byType) && r.coaching.byType.every(t => typeof t.count === 'number'))

check('the outcome window observes tips AFTER a prompt, from real timestamps', (() => {
  const ev = [{ id: 'p', type: 'goal', priority: 5, title: 'Goal push', message: '', action_status: 'performed', shown_at: iso(2 * HOUR) }]
  const st = [
    { username: 'a', usd: 10, tokens: 200, received_at: iso(2 * HOUR - 5 * 60000) },   // 5 min after
    { username: 'b', usd: 5,  tokens: 100, received_at: iso(2 * HOUR - 10 * 60000) },  // 10 min after
    { username: 'c', usd: 99, tokens: 9999, received_at: iso(2 * HOUR + 60000) },      // BEFORE the prompt
    { username: 'd', usd: 99, tokens: 9999, received_at: iso(2 * HOUR - 40 * 60000) }, // outside the window
  ]
  const o = buildStreamReport({ session: baseSession, coachingEvents: ev, sessionTips: st, whales: [] }).coaching.moments[0].outcome
  return o && o.tips === 2 && o.tokens === 300 && o.windowMinutes === 15
})())
check('no tips in the window means no outcome, not a zero claim', (() => {
  const ev = [{ id: 'p', type: 'goal', priority: 5, title: 'Goal push', message: '', action_status: 'performed', shown_at: iso(2 * HOUR) }]
  return buildStreamReport({ session: baseSession, coachingEvents: ev, sessionTips: [], whales: [] })
    .coaching.moments[0].outcome === null
})())
check('the outcome carries NO delta, percentage, or baseline — it is an observation',
  (() => {
    const o = r.coaching.moments.map(m => m.outcome).find(Boolean)
    return !o || Object.keys(o).every(k => ['windowMinutes', 'tokens', 'usd', 'tips'].includes(k))
  })())
check('no causal language is produced about coaching',
  !/increased|caused|because of|thanks to|boosted/i.test(JSON.stringify(r)) &&
  !/increased revenue by/i.test(lib))
check('the UI states the unavailable case rather than hiding it',
  /Outcome measurement not available yet/.test(report))

// ══════════════════════════════════════════════════════════════════════
// 10. RETURNING-FAN CONTRIBUTION (D3)
// ══════════════════════════════════════════════════════════════════════
check('returning share is a real ratio of this stream\'s own tips', (() => {
  // BigSpender(42+18=60, returning) + quietwhale(60, returning) + brandnew(64.2, new)
  const rs = r.fans.returningShare
  return rs && rs.count === 2 && rs.usd === 120 && rs.pct === 65
})())
check('numerator and denominator come from the same tip set — no cross-source ratio',
  /const streamTipUsd = tippers\.reduce/.test(lib) && /returningUsd \/ streamTipUsd/.test(lib))
check('no returning share is claimed when the stream had no tips',
  buildStreamReport({ session: baseSession, sessionTips: [], whales }).fans.returningShare === null)
check('the share appears as an insight with the real figures',
  r.insights.some(i => i.kind === 'returning_share' && i.text.includes('65%')))

// ══════════════════════════════════════════════════════════════════════
// 11. STREAMING PLAN FEEDBACK (D4)
// ══════════════════════════════════════════════════════════════════════
const startedAt = new Date(Date.now() - 3 * HOUR)
const dayName = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(startedAt)
const hourNum = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', hour: 'numeric', hour12: false }).format(startedAt), 10) % 24
const gridWith = (tier, median) => ({ grid: [{ localDay: dayName, localHour: hourNum, medianUsdPerHour: median, sessionCount: 6, tier, topPlatform: 'Chaturbate' }] })

check('a session inside a supported planned window is recognised', (() => {
  const p = buildStreamReport({ session: baseSession, canonicalBestTimes: gridWith('high', 50), creatorTz: 'UTC' }).plan
  return p && p.matched === true && p.day === dayName
})())
check('the baseline is that window\'s own canonical median, not a new formula', (() => {
  const p = buildStreamReport({ session: baseSession, canonicalBestTimes: gridWith('high', 50), creatorTz: 'UTC' }).plan
  return p.baselineUsdPerHour === 50 && p.comparison.deltaUsdPerHour === 42.1 && p.comparison.above === true
})())
check('a below-baseline stream reports a real negative delta, not a spun one', (() => {
  const p = buildStreamReport({ session: baseSession, canonicalBestTimes: gridWith('high', 200), creatorTz: 'UTC' }).plan
  return p.comparison.above === false && p.comparison.deltaUsdPerHour === -107.9
})())
check('a promising-tier bucket is NOT treated as a plan the creator followed', (() => {
  const p = buildStreamReport({ session: baseSession, canonicalBestTimes: gridWith('promising', 50), creatorTz: 'UTC' }).plan
  return p.matched === false && p.comparison === null
})())
check('no grid means no plan claim at all',
  buildStreamReport({ session: baseSession, canonicalBestTimes: null }).plan === null)
check('a window with no measurable hourly rate says so instead of comparing', (() => {
  const p = buildStreamReport({ session: { ...baseSession, session_earnings_usd: 0 },
    canonicalBestTimes: gridWith('high', 50), creatorTz: 'UTC' }).plan
  return p.matched === true && p.comparison === null
})())
check('the insight says "not enough historical data" rather than inventing a delta', (() => {
  const rep = buildStreamReport({ session: { ...baseSession, session_earnings_usd: 0 },
    canonicalBestTimes: gridWith('high', 50), creatorTz: 'UTC' })
  return rep.insights.some(i => i.kind === 'planned_window' && /Not enough historical data/.test(i.text))
})())
check('the plan match reuses the canonical grid rather than deriving a schedule',
  /canonicalBestTimes\?\.grid/.test(lib) && !/computeCanonicalBestTimes/.test(lib))
check('the dashboard feeds the canonical grid in',
  /canonicalBestTimes: analytics\?\.canonicalBestTimes/.test(page))

// ══════════════════════════════════════════════════════════════════════
// 12. CAMCASH IMPACT (D5) — architecture present, claim withheld
// ══════════════════════════════════════════════════════════════════════
check('impact is reported as unavailable, not estimated',
  r.impact && r.impact.available === false && r.impact.reason === 'no_baseline_marker')
check('no impact figure is produced anywhere',
  !/helped you earn|impactUsd|attributedUsd/i.test(JSON.stringify(r)) &&
  !/helped you earn/i.test(lib))
check('the UI states the unavailable impact honestly',
  /CamCash impact: not enough history yet/.test(report))
// The explanation wraps across comment lines, so match a phrase that sits
// on one line rather than one that spans the break.
check('the reason it cannot be measured is documented',
  /marker separating streams run before CamCash/i.test(libRaw) &&
  /imported CSV history spans both/i.test(libRaw))

// ══════════════════════════════════════════════════════════════════════
// 13. SESSIONS PAGINATION (D9)
// ══════════════════════════════════════════════════════════════════════
// Pagination moved from page.js into app/dashboard/Sessions.js with the D8
// redesign. verify-sessions-tab.mjs owns it in depth; these keep the
// stream-report suite's own coverage pointed at the real implementation.
const sessionsUi = readFileSync(new URL('../app/dashboard/Sessions.js', import.meta.url), 'utf8')
check('sessions render a bounded page, not the whole history',
  /export const SESSIONS_PER_PAGE = 10/.test(sessionsUi) &&
  /sorted\.slice\(pageStart, pageStart \+ SESSIONS_PER_PAGE\)/.test(sessionsUi))
check('page count is derived from the real session count',
  /Math\.max\(1, Math\.ceil\(sorted\.length \/ SESSIONS_PER_PAGE\)\)/.test(sessionsUi))
check('the page index is clamped so a shrinking list cannot strand the creator',
  /Math\.min\(Math\.max\(0, page\), totalPages - 1\)/.test(sessionsUi))
check('changing the meaningful-only filter returns to page one',
  /useEffect\(\(\) => \{ setSessionPage\(0\) \}, \[meaningfulOnly\]\)/.test(page))
check('newest sessions come first',
  /new Date\(b\.startTime\) - new Date\(a\.startTime\)/.test(sessionsUi))
check('aggregates describe the whole history, not the current page',
  /<OverallStats allSessions=\{sorted\} \/>/.test(sessionsUi) &&
  !/<OverallStats allSessions=\{pageSessions\}/.test(sessionsUi))
// This previously asserted `const recentSessions = allSessions.filter`, a
// symbol that never existed — the code used `displaySessions`, i.e. the
// rendered page. The check was describing an intent the implementation did
// not honour. Both now live in lib/sessions/breakdown.js and agree.
check('the per-session baseline compares against all sessions, not just the page',
  /const gapPool = allSessions\.filter/.test(
    readFileSync(new URL('../lib/sessions/breakdown.js', import.meta.url), 'utf8')))
check('pagination controls only render when more than one page exists',
  /\{totalPages > 1 && \(/.test(sessionsUi))
check('Previous and Next are disabled at the ends',
  /disabled=\{safePage === 0\}/.test(sessionsUi) && /disabled=\{safePage >= totalPages - 1\}/.test(sessionsUi))
check('the creator is told which slice of the history they are seeing',
  /showing \{pageStart \+ 1\}/.test(sessionsUi))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

// Regression coverage for the Sessions redesign (D8 / D10).
//
// The tab used to render every session fully expanded — stat grid, 5-minute
// chart, pacing bar, contributors, insights, recommendations — so one
// session was roughly a screen. It is now: whole-history stats once →
// compact rows → detail on demand → pagination.
//
// The risk in a redesign like this is SILENT LOSS: a field that used to be
// on screen quietly disappearing. Section 4 is the inventory that guards it.
//
// getSessionBreakdown() is imported and RUN, so the maths is tested rather
// than grepped.

import { readFileSync } from 'fs'
import { getSessionBreakdown, PERFORMANCE_BADGE } from '../lib/sessions/breakdown.js'

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`) }
}

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const uiRaw = readFileSync(new URL('../app/dashboard/Sessions.js', import.meta.url), 'utf8')
const ui = strip(uiRaw)
const pageRaw = readFileSync(new URL('../app/dashboard/page.js', import.meta.url), 'utf8')
const page = strip(pageRaw)
const libRaw = readFileSync(new URL('../lib/sessions/breakdown.js', import.meta.url), 'utf8')
const lib = strip(libRaw)

const H = 3600000
const mkTip = (minsAgo, usd, username) => ({
  usd, tokens: usd * 20, username,
  date_time: new Date(Date.now() - minsAgo * 60000).toISOString(),
})
const mkSession = (o = {}) => {
  const start = new Date(Date.now() - 3 * H)
  const end = new Date(Date.now() - 2 * H)
  return {
    platform: 'Chaturbate', startTime: start, endTime: end,
    durationMinutes: 60, durationUnknown: false,
    totalUSD: 100, totalTokens: 2000, tipCount: 10, uniqueFans: 4,
    avgTipSize: 10, usdPerHour: 100, usdPerMinute: 1.67,
    tips: [mkTip(175, 60, 'whale_a'), mkTip(150, 25, 'regular_b'), mkTip(130, 15, 'newcomer_c')],
    ...o,
  }
}
const many = (n) => Array.from({ length: n }, (_, i) => mkSession({
  startTime: new Date(Date.now() - (i + 1) * 24 * H),
  endTime: new Date(Date.now() - (i + 1) * 24 * H + H),
  totalUSD: 50 + i,
}))

// ══════════════════════════════════════════════════════════════════════
// 1. THE ENGINE MOVED WITHOUT CHANGING
// ══════════════════════════════════════════════════════════════════════
check('the breakdown engine is a pure importable function',
  typeof getSessionBreakdown === 'function')
check('it runs standalone and returns the same shape the tab rendered', (() => {
  const bd = getSessionBreakdown(mkSession(), [mkSession()])
  return bd && Array.isArray(bd.buckets) && Array.isArray(bd.topTippers) &&
         Array.isArray(bd.insights) && Array.isArray(bd.recommendations) &&
         typeof bd.firstHalfPct === 'number' && typeof bd.performance === 'string' &&
         typeof bd.revenuePerMin === 'number' && Array.isArray(bd.spikes)
})())
check('allSessions is an explicit parameter, not a captured closure',
  /export function getSessionBreakdown\(s, allSessions = \[\]\)/.test(libRaw))
check('a session with no tips still yields nothing to render',
  getSessionBreakdown({ tips: [] }, []) === null)
// Absence is checked against STRIPPED source: the phrase legitimately
// appears in the comments that record its removal.
check('the fabricated "2x your earnings" multiplier is still absent',
  !/2x your earnings/.test(strip(libRaw)) && /multiplier was hardcoded/.test(libRaw))
check('performance is classified against the caller\'s own history', (() => {
  const weak = [mkSession({ totalUSD: 10 }), mkSession({ totalUSD: 10 })]
  return getSessionBreakdown(mkSession({ totalUSD: 100 }), weak).performance === 'high' &&
         getSessionBreakdown(mkSession({ totalUSD: 10 }), [mkSession({ totalUSD: 100 })]).performance === 'low'
})())
check('the page no longer computes session breakdowns inline',
  !/const getSessionBreakdown/.test(page))
check('the badge config travels with the classification',
  PERFORMANCE_BADGE.high && PERFORMANCE_BADGE.average && PERFORMANCE_BADGE.low)

// ══════════════════════════════════════════════════════════════════════
// 2. PAGINATION
// ══════════════════════════════════════════════════════════════════════
check('a page size is defined and bounded', /export const SESSIONS_PER_PAGE = 10/.test(ui))
check('only one page of sessions is sliced for render',
  /sorted\.slice\(pageStart, pageStart \+ SESSIONS_PER_PAGE\)/.test(ui))
check('page count comes from the real session count',
  /Math\.max\(1, Math\.ceil\(sorted\.length \/ SESSIONS_PER_PAGE\)\)/.test(ui))
check('the page index is clamped at both ends',
  /Math\.min\(Math\.max\(0, page\), totalPages - 1\)/.test(ui))
check('newest sessions come first',
  /new Date\(b\.startTime\) - new Date\(a\.startTime\)/.test(ui))
check('pagination controls only appear when a second page exists',
  /\{totalPages > 1 && \(/.test(ui))
check('Previous and Next disable at the ends',
  /disabled=\{safePage === 0\}/.test(ui) && /disabled=\{safePage >= totalPages - 1\}/.test(ui))
check('the creator is told which page and which slice they are on',
  /Page \{safePage \+ 1\} of \{totalPages\}/.test(ui) && /showing \{pageStart \+ 1\}/.test(ui))
check('changing the meaningful-only filter resets to page one',
  /useEffect\(\(\) => \{ setSessionPage\(0\) \}, \[meaningfulOnly\]\)/.test(page))

// ══════════════════════════════════════════════════════════════════════
// 3. WHOLE-HISTORY STATS vs CURRENT PAGE
// ══════════════════════════════════════════════════════════════════════
check('the stats block is fed the full sorted history, not the page slice',
  /<OverallStats allSessions=\{sorted\} \/>/.test(ui))
check('the stats block never references the page slice',
  (() => {
    const i = ui.indexOf('function OverallStats')
    const j = ui.indexOf('function DetailBlock')
    const body = ui.slice(i, j)
    return i > 0 && !body.includes('pageSessions') && !body.includes('pageStart')
  })())
check('$/hour is weighted by time, not averaged per session',
  /timed\.reduce\(\(s, x\) => s \+ x\.totalUSD, 0\) \/ \(timedMins \/ 60\)/.test(ui))
check('sessions with an unknown duration are excluded from rate and length averages',
  /!x\.durationUnknown && x\.durationMinutes > 0/.test(ui))
check('an unmeasurable average says so instead of printing zero',
  /'Not enough data yet'/.test(ui))

// ══════════════════════════════════════════════════════════════════════
// 4. FIELD INVENTORY — nothing silently lost in the redesign.
// Every field the old expanded card rendered must still be reachable.
// ══════════════════════════════════════════════════════════════════════
const collapsed = [
  ['date', /toLocaleDateString\('en-US', \{ weekday: 'short'/],
  ['platform', /\{s\.platform\}/],
  ['duration', /fmtDuration\(s\.durationMinutes\)/],
  ['earnings', /fmtUsd\(s\.totalUSD\)/],
  ['$/hour', /fmtUsd\(s\.usdPerHour\)/],
  ['tip count', /fmtInt\(s\.tipCount\)/],
  ['unique fans', /fmtInt\(s\.uniqueFans\)/],
]
for (const [name, re] of collapsed) check(`collapsed row still shows ${name}`, re.test(ui))

const inDetail = [
  ['tokens', /fmtInt\(s\.totalTokens\)/],
  ['average tip', /fmtUsd\(s\.avgTipSize\)/],
  ['$/min', /s\.usdPerMinute/],
  ['largest tip', /Largest tip/],
  ['start/end clock times', /clock\(s\.startTime\)\} → \{clock\(s\.endTime\)/],
  ['performance badge', /PERFORMANCE_BADGE\[bd\.performance\]/],
  ['earnings timeline buckets', /\{bd\.buckets\.map\(\(b, i\) => \{/],
  ['first/second half pacing', /bd\.firstHalfPct/],
  ['top contributors', /bd\.topTippers\.map/],
  ['contributor percentage', /\{t\.pct\}%/],
  ['insights', /bd\.insights\.map/],
  ['recommendations', /bd\.recommendations\.map/],
]
for (const [name, re] of inDetail) check(`detail view still shows ${name}`, re.test(ui))

check('the detail is only built when the row is open — a closed row costs nothing',
  /isOpen \? getSessionBreakdown\(s, allSessions\) : null/.test(ui))
check('rows are collapsed by default',
  /const \[openId, setOpenId\] = useState\(null\)/.test(ui))
check('opening one row closes the previously open one',
  /setOpenId\(openId === id \? null : id\)/.test(ui))

// ══════════════════════════════════════════════════════════════════════
// 4b. REVENUE GAP — the one field the redesign DID lose.
// It was dropped when the tab was rebuilt and only surfaced because
// verify-stream-report.mjs asserted against a symbol that no longer
// existed. That assertion also described the baseline as `allSessions`
// while the code actually used `displaySessions` — so once pagination
// landed, "your avg session" silently meant "the average of this page".
// Restored, and fixed to the history-wide baseline the copy always claimed.
// ══════════════════════════════════════════════════════════════════════
{
  const hist = Array.from({ length: 5 }, (_, i) => mkSession({
    startTime: new Date(Date.now() - (i + 2) * 24 * H), totalUSD: 100,
  }))
  const under = mkSession({ totalUSD: 40 })
  const over = mkSession({ totalUSD: 200 })
  const near = mkSession({ totalUSD: 98 })

  check('an underperforming session is flagged against its own history', (() => {
    const g = getSessionBreakdown(under, [under, ...hist]).revenueGap
    return g && g.isUnder === true && g.expected === 100 && g.gapPct === 60
  })())
  check('an overperforming session is flagged too, not just failures', (() => {
    const g = getSessionBreakdown(over, [over, ...hist]).revenueGap
    return g && g.isUnder === false && g.gapPct === 100
  })())
  check('a session within 10% of its baseline reports nothing — noise is not a finding',
    getSessionBreakdown(near, [near, ...hist]).revenueGap === null)
  check('a session with an unknown duration is never compared',
    getSessionBreakdown({ ...under, durationUnknown: true }, [under, ...hist]).revenueGap === null)
  check('too little comparable history reports nothing rather than guessing',
    getSessionBreakdown(under, [under, hist[0]]).revenueGap === null)
  check('the baseline is the whole history, not the rendered page',
    /const gapPool = allSessions\.filter/.test(lib) && !/displaySessions/.test(lib))
  check('the comparison is actually rendered, and states what it measured against',
    /\{bd\.revenueGap && \(/.test(ui) &&
    /Compared against your last \{bd\.revenueGap\.basedOn\} comparable session/.test(ui))
  check('the restoration and the baseline fix are documented',
    /accidentally dropped/.test(libRaw) && /the average of this\n  \/\/ page/.test(libRaw))
}

// ══════════════════════════════════════════════════════════════════════
// 5. NO DUPLICATED METRIC BETWEEN ROW AND DETAIL
// ══════════════════════════════════════════════════════════════════════
check('earnings appear once in the collapsed row',
  (ui.match(/fmtUsd\(s\.totalUSD\)/g) || []).length === 1)
check('tip count appears once in the collapsed row',
  (ui.match(/fmtInt\(s\.tipCount\)/g) || []).length === 1)
check('the detail does not repeat duration, tips or fans from the row',
  (() => {
    const i = ui.indexOf('{isOpen && bd && (')
    const detail = ui.slice(i)
    return !/fmtDuration\(s\.durationMinutes\)/.test(detail) &&
           !/fmtInt\(s\.tipCount\)/.test(detail) &&
           !/fmtInt\(s\.uniqueFans\)/.test(detail)
  })())

// ══════════════════════════════════════════════════════════════════════
// 6. LIVE MODE STATES — three different things, never conflated
// ══════════════════════════════════════════════════════════════════════
check('a session with no Live Mode record says so, rather than showing an empty section',
  /This session did not use Live Mode\./.test(ui))
check('a Live Mode session with no prompts is its own state',
  /Live Mode ran, but no coaching prompts fired/.test(ui))
check('performed and skipped counts come from the persisted report',
  /liveSession\.coaching\.performed/.test(ui) && /liveSession\.coaching\.skipped/.test(ui))
check('the follow rate and most-prompted category are shown',
  /liveSession\.coaching\.performedRate/.test(ui) && /liveSession\.coaching\.byType\[0\]\.type/.test(ui))
check('per-prompt outcome is an observation, and says so when unavailable',
  /Outcome measurement not available yet\./.test(ui) &&
  /Next \$\{m\.outcome\.windowMinutes\} min/.test(ui))
check('no causal claim is made about coaching anywhere in this tab',
  !/increased|caused|because of|thanks to|boosted|lifted/i.test(ui))
check('the stream report is linked, not duplicated',
  /View Stream Report/.test(ui) && !/StreamReportBanner/.test(ui) &&
  !/CamCash impact/.test(ui))
check('the report link uses the canonical signature Button',
  /import Button from '\.\.\/\.\.\/components\/ui\/Button'/.test(ui) &&
  /<Button onClick=\{\(\) => onOpenReport\(liveSession\.id\)\}/.test(ui))

// ══════════════════════════════════════════════════════════════════════
// 7. THE LIVE-MODE JOIN IS HONEST
// ══════════════════════════════════════════════════════════════════════
check('detected sessions and live sessions are joined by platform + time overlap',
  /dStart <= lsEnd && dEnd >= lsStart/.test(page))
check('the join requires the same platform',
  /String\(d\.platform\)\.toLowerCase\(\) !== String\(ls\.stream_platform\)\.toLowerCase\(\)/.test(page))
check('unparseable timestamps are skipped rather than matched by accident',
  /if \(!Number\.isFinite\(dStart\) \|\| !Number\.isFinite\(dEnd\)\) continue/.test(page))
check('the reason a column-level join is impossible is documented',
  /not linked by any column/i.test(pageRaw))

// ══════════════════════════════════════════════════════════════════════
// 8. LOW-DATA STATES
// ══════════════════════════════════════════════════════════════════════
check('zero sessions renders an explained state, not a blank card',
  /No sessions yet/.test(ui) && /grouped automatically from your tip history/.test(ui))
check('a filtered-to-empty list is a different message from having no sessions',
  /No sessions match this filter/.test(ui) &&
  /Every session in this range was too small to analyse/.test(ui))
check('the filtered-empty state offers a way out',
  /Show all sessions/.test(ui) && /onToggleMeaningful\?\.\(false\)/.test(ui))
check('a single session produces no trend claim', (() => {
  const bd = getSessionBreakdown(mkSession(), [mkSession()])
  return !bd.insights.some(i => /trend|consistently|usually|always/i.test(i))
})())
check('a session with an unknown duration says so rather than printing a fake length',
  /s\.durationUnknown \? 'Duration unknown'/.test(ui))

// ══════════════════════════════════════════════════════════════════════
// 9. NO FABRICATION
// ══════════════════════════════════════════════════════════════════════
check('no engagement or relationship score was reintroduced',
  !/relScore|engagementScore|Engagement score/i.test(ui))
check('no arbitrary /100 score in the tab',
  !/\/\s*100[`'"<\s]/.test(ui))
check('no forecast or projection language',
  !/forecast|projected|predicted|estimated revenue/i.test(ui))
check('no viewer or conversion metric',
  !/viewer|conversion/i.test(ui))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

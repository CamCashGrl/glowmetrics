// Phase 6 regression: Live Mode is the execution layer, and it neither
// invents numbers nor keeps its own clock.
//
// Live Mode is the one surface that runs WHILE the creator works, so a wrong
// number here is acted on immediately rather than reviewed later. Three
// defects were found and fixed; these checks keep them closed.
//
// 1. TIMEZONE. The page bucketed its peak-hour window with `liveTimezone` —
//    a per-browser localStorage display preference — and compared it against
//    the browser's own getHours(). Both are wrong per the frozen timezone
//    contract (lib/timezone.js: profiles.timezone is the source of truth).
//    For any creator whose browser zone differs from their saved profile
//    zone, Live Mode named a different peak hour than the Command Center,
//    Performance and the Stream Planner all name for the same data — and the
//    "you're in your peak window" countdown could fire hours off.
//
// 2. FABRICATED PROBABILITY. The goal card rendered "Goal Push Probability"
//    at 30px from getGoalStrategy(), whose values are hardcoded literals
//    (100/85/72/25/50) with nothing deriving them. Replaced by
//    state.goalProgress, a real measured figure (totalTokens / goalTokens).
//
// 3. FABRICATED CONFIDENCE. Room health rendered "{n}% confidence" from
//    (liveOnlyCount/5)*60 + (elapsedMins/20)*40 — a hand-rolled score with
//    nothing calibrating it. Replaced by the observation behind it.
//
// Everything else in Live Mode was already canonical and is pinned here so
// it stays that way: the 9 coaching triggers live server-side in
// lib/coaching/triggers.js and are selected one at a time, and the state
// machine (offline/starting/live/inactive_warning/ending/offline) plus pause
// behaviour is untouched.

import { readFileSync } from 'fs'

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`) }
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const liveRaw = read('../app/live/page.js')
const live = strip(liveRaw)
const engineRaw = read('../app/live/useLiveSessionEngine.js')
const engine = strip(engineRaw)
const triggersRaw = read('../lib/coaching/triggers.js')
const triggers = strip(triggersRaw)
const roomHealth = read('../lib/analytics/roomHealth.js')
const sessionPhase = read('../lib/analytics/sessionPhase.js')
const page = strip(read('../app/dashboard/page.js'))

// ══════════════════════════════════════════════════════════════════════
// 1. STATE MACHINE — preserved, including pause.
// ══════════════════════════════════════════════════════════════════════
for (const phase of ['idle', 'starting', 'active', 'inactive_warning', 'justEnded', 'resolved']) {
  check(`the engine can enter the ${phase} phase`, engine.includes(`'${phase}'`))
  check(`the UI renders the ${phase} phase`, live.includes(`engine.phase === '${phase}'`))
}
check('pause is a substate of live, not a separate phase (pause behaviour preserved)',
  engine.includes("serverSession?.live_substate !== 'active'") &&
  live.includes("engine.serverSession?.live_substate === 'paused'"))
check('the heartbeat deliberately keeps running through a pause',
  engineRaw.includes('heartbeat interval is intentionally left running through the pause'))
check('resume is gated on actually being paused',
  engine.includes("serverSession?.live_substate !== 'paused'"))
check('only the four terminal resolutions end a session',
  engine.includes("'ended', 'end_at_last_heartbeat', 'choose_end_time', 'mark_invalid'"))
check("'still_live' returns to LIVE rather than ending", engineRaw.includes("preserving whatever live_substate"))
check('a duplicate resolve is a no-op rather than a double-end',
  engine.includes('if (actionPending) return'))

// ══════════════════════════════════════════════════════════════════════
// 2. COACHING TRIGGERS — canonical, server-side, one at a time.
// ══════════════════════════════════════════════════════════════════════
const TRIGGERS = ['dead_air_critical', 'goal_push', 'dead_air_high', 'pace_below',
  'stream_fatigue', 'pace_above', 'goal_hit', 'whale_prox', 'whale_dep']
for (const t of TRIGGERS) {
  check(`trigger ${t} is declared canonically`, triggers.includes(`'${t}'`) || triggers.includes(`${t}:`))
}
check('the page does not evaluate triggers locally',
  !live.includes('function getAlerts') && !live.includes('canFireAlert'))
check('the page fetches the single canonical prompt from the shared engine',
  live.includes("fetch('/api/live/coaching'"))
check('exactly one prompt is selected at a time', triggers.includes('export function selectPrimaryTrigger'))
check('the page holds one coaching prompt, not a list',
  live.includes('const [coachingPrompt, setCoachingPrompt]'))
check('trigger thresholds are not duplicated in the page',
  !live.includes('cooldownSeconds') && !live.includes('TRIGGER_RULE_ORDER'))
check('icon/level styling is imported from the canonical module, not redefined',
  live.includes("import { TRIGGER_LEVEL, TRIGGER_ICON } from '../../lib/coaching/triggers'"))

// ══════════════════════════════════════════════════════════════════════
// 3. NO FABRICATED PROBABILITIES.
// ══════════════════════════════════════════════════════════════════════
check('no "% confidence" is rendered', !live.includes('% confidence'))
check('no goal-push probability is rendered',
  !live.includes('Goal Push Probability') && !live.includes('goalStrategy.probability'))
check('the goal card shows measured goal progress instead',
  live.includes('Goal Progress') && live.includes('{state.goalProgress}%'))
check('goalProgress is a real ratio computed in the canonical trigger module',
  triggers.includes('Math.round((totalTokens / goalTokens) * 100)'))
check('room health shows the observation behind its score, not a percentage',
  live.includes('state?.liveOnlyCount ?? 0') && live.includes("state?.elapsedMins ?? 0"))
// The two fabricated fields still exist as internal branch labels; they must
// be documented as non-displayable so they are not re-rendered later.
check('getGoalStrategy documents that its probability is a hardcoded literal',
  sessionPhase.includes('hardcoded\n * literals') || sessionPhase.includes('hardcoded literals'))
check('getGoalStrategy documents that it is no longer displayed',
  sessionPhase.includes('NO LONGER DISPLAYED'))
check('roomHealth documents that its confidence is not calibrated',
  roomHealth.includes('NOT a calibrated confidence'))
// The qualitative guidance IS derived from real state and stays.
check('the qualitative goal suggestion is still shown', live.includes('goalStrategy.suggestion'))
check('the suggestion branches on real measured state',
  sessionPhase.includes('const { goalProgress, paceStatus } = state'))

// ══════════════════════════════════════════════════════════════════════
// 4. CREATOR-LOCAL TIME.
// ══════════════════════════════════════════════════════════════════════
check('the page resolves the canonical creator timezone',
  live.includes("import { resolveCreatorTimezone } from '../../lib/timezone'") &&
  live.includes('resolveCreatorTimezone(prof?.timezone).timezone'))
check('it reads profiles.timezone to do so', live.includes("from('profiles').select('timezone')"))
check('the peak-hour grid is bucketed in the creator zone, not the display zone',
  live.includes('computeCanonicalBestTimes(detectMeaningfulSessions(data), creatorTzRef.current)'))
check('the "are we in the peak window" check uses the creator zone',
  live.includes('toLocalHour(now.toISOString(), creatorTz)'))
check('per-hour revenue is bucketed in the creator zone',
  live.includes('toLocalHour(s.startTime, creatorTz)'))
check('no analytical bucket reads the browser clock',
  !/const h = new Date\([^)]*\)\.getHours\(\)/.test(live) && !/const nowH = now\.getHours\(\)/.test(live))
check('liveTimezone is documented as a display-only preference',
  liveRaw.includes('DISPLAY preference for session clock times'))
// The one remaining getHours() is a datetime-local input formatter, which
// must be browser-local — that is correct, not a defect.
check('the only remaining browser-clock use is the datetime-local input formatter',
  (live.match(/getHours\(\)/g) || []).length === 1 && live.includes('toDatetimeLocalValue'))

// The zones genuinely disagree, so this was a real defect.
{
  const instant = '2026-07-08T02:00:00.000Z'
  const hourIn = (tz) => parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date(instant)))
  check('a browser zone and a saved creator zone can name a different hour for one instant',
    hourIn('America/New_York') !== hourIn('Asia/Tokyo'),
    `NY=${hourIn('America/New_York')} Tokyo=${hourIn('Asia/Tokyo')}`)
}

// ══════════════════════════════════════════════════════════════════════
// 5. NO DUPLICATE ANALYTICS — Live Mode reuses the shared engines.
// ══════════════════════════════════════════════════════════════════════
check('best times come from the canonical module',
  live.includes("import { computeCanonicalBestTimes } from '../../lib/analytics/bestTimes'"))
check('the page defines no best-time calculation of its own',
  !live.includes('function bestWindows') && !live.includes('function computeBestTimes'))
check('room health is imported, not reimplemented', !live.includes('function computeRoomHealth'))
check('goal strategy is imported, not reimplemented', !live.includes('function getGoalStrategy'))
check('session detection is imported, not reimplemented',
  !live.includes('function detectSessions') && !live.includes('function detectMeaningfulSessions'))
check('the coaching state is computed server-side from session-scoped tips',
  triggers.includes('export function computeCoachingState'))

// ══════════════════════════════════════════════════════════════════════
// 6. CURRENT-SESSION METRICS are real measurements.
// ══════════════════════════════════════════════════════════════════════
check('elapsed time is recomputed from the server session, never written to the DB',
  engineRaw.includes('the live timer is recomputed from serverSession each tick, never written to the DB'))
check('pace is a measured first-half vs second-half delta, not a guess',
  triggers.includes('const paceDeltaPct = fUPM > 0 ? Math.round(((sUPM - fUPM) / fUPM) * 100) : null'))
check('pace status requires a minimum sample before it claims a direction',
  triggers.includes('if (tips.length >= 3 && elapsedMins >= 5)'))
check('revenue and tokens are summed from real live_tips rows',
  triggers.includes('totalRevenue += usd') && triggers.includes('totalTokens += Number(t.tokens) || 0'))

// ══════════════════════════════════════════════════════════════════════
// 7. FREE vs PRO — no surprise locks mid-session.
// ══════════════════════════════════════════════════════════════════════
check('Live Mode is Pro-gated before a session starts, not inside one',
  page.includes('activeTab === "live" && (isPro ? <LiveEnginePage embedded />'))
check('the lock is explained before starting, per the no-surprise-locks rule',
  read('../app/dashboard/page.js').includes('never discovered mid-stream'))
check('the Free preview is personalised from the creator\'s own real data',
  page.includes('analytics?.canonicalBestTimes?.bestWindow') && page.includes('whales.length > 0'))
check('the Free preview falls back to a generic line rather than fabricating one',
  read('../app/dashboard/page.js').includes('Live Mode tracks your session pace, room health, and fan activity in real time while you stream.'))
check('the Pro CTA is outcome-oriented, not a generic upgrade prompt',
  read('../app/dashboard/page.js').includes('Turn On Live Coaching') &&
  !read('../app/dashboard/page.js').includes('Upgrade to Pro — unlock Live Mode'))
check('there is exactly one Pro CTA on the Free preview',
  (page.match(/openUpgradeModal\('live_mode_locked'\)/g) || []).length === 1)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

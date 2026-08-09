// Standalone verification for the peak_window staleness fix:
//   1. evaluatePeakWindow()'s expiresInMinutes — derived from the same
//      startHour/nowHour/nowMinute already used for inPeak/approaching, not
//      a new threshold.
//   2. runPeakWindowPipeline() passes p_expires_at (computed from
//      expiresInMinutes) to the RPC without touching p_cooldown_seconds,
//      p_fingerprint, or any other existing param — dedup/cooldown
//      behavior must be provably unchanged.
//   3. The read-side expiry filter added to
//      app/api/dashboard/events/route.js and
//      app/api/dashboard/events/summary/route.js (expires_at.is.null OR
//      expires_at.gt.now) — mirrored here as a pure predicate since these
//      are Next.js route handlers, not plain-importable modules (same
//      limitation as every other verify-*.mjs in this repo).
//
// This repo has no test framework and files can't be `import`-ed directly
// by plain Node (extensionless relative imports) — this script mirrors the
// real logic. Keep in sync with lib/intelligence/peakWindow.js and the two
// route filters if they change.

const APPROACH_WINDOW_MINUTES = 60
const RELIABLE_CONFIDENCE_LEVELS = new Set(['Medium', 'High'])

function evaluatePeakWindow({ bestHour, confidenceLevel, nowHour, nowMinute, historicalSessionCount }) {
  if (!bestHour || bestHour.hour === undefined || bestHour.hour === null) return { event: null, reason: 'no_best_hour' }
  if (!RELIABLE_CONFIDENCE_LEVELS.has(confidenceLevel)) return { event: null, reason: 'insufficient_confidence' }
  if (!Number.isFinite(nowHour) || nowHour < 0 || nowHour > 23 || !Number.isFinite(nowMinute) || nowMinute < 0 || nowMinute > 59) {
    return { event: null, reason: 'invalid_current_time' }
  }
  const startHour = parseInt(bestHour.hour, 10)
  if (!Number.isFinite(startHour) || startHour < 0 || startHour > 23) return { event: null, reason: 'invalid_best_hour' }

  const inPeak = nowHour === startHour || nowHour === (startHour + 1) % 24
  const minutesUntilStart = ((startHour * 60 - (nowHour * 60 + nowMinute)) + 1440) % 1440
  const approaching = !inPeak && minutesUntilStart > 0 && minutesUntilStart <= APPROACH_WINDOW_MINUTES
  if (!inPeak && !approaching) return { event: null, reason: 'outside_trigger_window' }

  const avg = parseFloat(bestHour.avg) || 0
  const minutesUntilPeak = inPeak ? 0 : minutesUntilStart
  const windowEndHour = (startHour + 2) % 24
  const expiresInMinutes = ((windowEndHour * 60 - (nowHour * 60 + nowMinute)) + 1440) % 1440

  return {
    event: {
      priority: 'medium',
      title: inPeak ? "You're in your usual peak earning window" : 'Your peak earning window is coming up',
      message: 'mirrored — content not under test here',
      fingerprint: `peak_window:${startHour}`,
      metadata: {
        peak_hour: startHour, peak_hour_avg_usd: avg, confidence_level: confidenceLevel,
        minutes_until_peak: minutesUntilPeak, currently_in_peak: inPeak,
        historical_session_count: historicalSessionCount ?? bestHour.count ?? null,
      },
    },
    expiresInMinutes,
    reason: null,
  }
}

const COOLDOWN_SECONDS = 24 * 60 * 60

function makeFakeSupabase() {
  const events = new Map()
  let nextId = 1
  const calls = []
  return {
    _events: events,
    _calls: calls,
    rpc: async (name, params) => {
      calls.push(params)
      const key = params.p_fingerprint
      const existing = events.get(key)
      if (existing && Date.now() - existing._createdAtMs < COOLDOWN_SECONDS * 1000) {
        return { data: existing, error: null }
      }
      const row = { id: nextId++, status: 'new', _createdAtMs: Date.now(), ...params }
      events.set(key, row)
      return { data: row, error: null }
    },
  }
}

async function runPeakWindowPipeline({ supabase, bestHour, confidenceLevel, nowHour, nowMinute, historicalSessionCount }) {
  const evaluation = evaluatePeakWindow({ bestHour, confidenceLevel, nowHour, nowMinute, historicalSessionCount })
  if (!evaluation.event) return { event: null, evaluation }
  const { data } = await supabase.rpc('record_dashboard_event_if_new', {
    p_event_type: 'peak_window', p_source: 'analytics', p_priority: evaluation.event.priority,
    p_title: evaluation.event.title, p_message: evaluation.event.message,
    p_fingerprint: evaluation.event.fingerprint, p_metadata: evaluation.event.metadata,
    p_cooldown_seconds: COOLDOWN_SECONDS,
    p_expires_at: new Date(Date.now() + evaluation.expiresInMinutes * 60000).toISOString(),
  })
  return { event: data, evaluation }
}

// Mirrors the exact filter added to both route.js files:
// .or(`expires_at.is.null,expires_at.gt.${now}`)
function isCurrentlyListed(row, nowIso = new Date().toISOString()) {
  if (row.expires_at == null) return true
  return row.expires_at > nowIso
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

// 1. inPeak (nowHour === startHour): expiresInMinutes counts to the end of
//    the 2-hour window (startHour+2), i.e. 120 minutes minus minutes already
//    elapsed into the current hour.
{
  const r = evaluatePeakWindow({ bestHour: { hour: 9, avg: 5 }, confidenceLevel: 'High', nowHour: 9, nowMinute: 0, historicalSessionCount: 10 })
  check('1a. inPeak at exact start: expiresInMinutes is 120', r.expiresInMinutes, 120)
}
{
  const r = evaluatePeakWindow({ bestHour: { hour: 9, avg: 5 }, confidenceLevel: 'High', nowHour: 9, nowMinute: 45, historicalSessionCount: 10 })
  check('1b. inPeak 45min into window: expiresInMinutes is 75', r.expiresInMinutes, 75)
}
{
  const r = evaluatePeakWindow({ bestHour: { hour: 9, avg: 5 }, confidenceLevel: 'High', nowHour: 10, nowMinute: 55, historicalSessionCount: 10 })
  check('1c. inPeak, 5 min from window end (2nd hour): expiresInMinutes is 5', r.expiresInMinutes, 5)
}

// 2. approaching (60-min lead-in): expiresInMinutes still lands at the end
//    of the eventual 2-hour window, not the start.
{
  const r = evaluatePeakWindow({ bestHour: { hour: 9, avg: 5 }, confidenceLevel: 'High', nowHour: 8, nowMinute: 30, historicalSessionCount: 10 })
  check('2a. approaching 30min before start: expiresInMinutes is 150 (30 to start + 120 window)', r.expiresInMinutes, 150)
}

// 3. wraparound: startHour near midnight
{
  const r = evaluatePeakWindow({ bestHour: { hour: 23, avg: 5 }, confidenceLevel: 'High', nowHour: 23, nowMinute: 30, historicalSessionCount: 10 })
  check('3. wraparound (peak hour 23): expiresInMinutes computed without throwing', Number.isFinite(r.expiresInMinutes), true)
  check('3. wraparound (peak hour 23): expiresInMinutes is 90', r.expiresInMinutes, 90)
}

// 4. Pipeline: p_expires_at is set, p_cooldown_seconds/p_fingerprint untouched
{
  const supabase = makeFakeSupabase()
  const bestHour = { hour: 9, avg: 5 }
  ;(async () => {
    await runPeakWindowPipeline({ supabase, bestHour, confidenceLevel: 'High', nowHour: 9, nowMinute: 0, historicalSessionCount: 10 })
    const call = supabase._calls[0]
    check('4a. p_cooldown_seconds unchanged from existing 24h value', call.p_cooldown_seconds, COOLDOWN_SECONDS)
    check('4b. p_fingerprint unchanged shape', call.p_fingerprint, 'peak_window:9')
    check('4c. p_expires_at is present and is a valid ISO string', typeof call.p_expires_at === 'string' && !isNaN(Date.parse(call.p_expires_at)), true)
    check('4d. p_expires_at is in the future at call time (event still current)', new Date(call.p_expires_at).getTime() > Date.now(), true)

    // 5. Dedup/cooldown still intact — same fingerprint within cooldown
    //    returns the SAME row, exactly as before this change.
    const first = supabase._events.get('peak_window:9')
    const second = await runPeakWindowPipeline({ supabase, bestHour, confidenceLevel: 'High', nowHour: 9, nowMinute: 5, historicalSessionCount: 10 })
    check('5. repeated qualifying call within cooldown: same event id (dedup intact)', second.event?.id, first.id)
    check('5. repeated qualifying call within cooldown: only one RPC write occurred', supabase._events.size, 1)

    // 6. Read-side filter: a valid (not-yet-expired) peak_window row remains listed.
    const validRow = { event_type: 'peak_window', status: 'new', expires_at: new Date(Date.now() + 60000).toISOString() }
    check('6. valid/current peak_window event remains eligible to display', isCurrentlyListed(validRow), true)

    // 7. Read-side filter: an expired peak_window row is excluded even
    //    though its status is still 'new' (status/seen/dismissed untouched).
    const expiredRow = { event_type: 'peak_window', status: 'new', expires_at: new Date(Date.now() - 60000).toISOString() }
    check('7. expired peak_window event no longer presents as current NEW', isCurrentlyListed(expiredRow), false)
    check('7. expired row status is untouched (still "new" in the DB)', expiredRow.status, 'new')

    // 8. Other event types (no expires_at set) are completely unaffected —
    //    always pass the filter regardless of age.
    const otherTypes = ['new_whale_detected', 'platform_gap_detected', 'weekly_momentum_up', 'weekly_momentum_down', 'stream_below_baseline', 'stream_outperformed_baseline', 'import_completed']
    let allPass = true
    for (const t of otherTypes) {
      const row = { event_type: t, status: 'new', expires_at: null, created_at: new Date(Date.now() - 90 * 24 * 3600000).toISOString() }
      if (!isCurrentlyListed(row)) allPass = false
    }
    check('8. other event types with no expires_at are never filtered, regardless of age', allPass, true)

    console.log(`\n${pass} passed, ${fail} failed`)
    process.exit(fail > 0 ? 1 : 0)
  })()
}

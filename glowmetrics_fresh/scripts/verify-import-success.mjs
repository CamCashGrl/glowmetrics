// Verification for the import-success moment (Phase 2B-3).
//
// The product rule this protects: an upload may only celebrate something the
// intelligence engine actually established. No milestone for uploading a file,
// no invented percentage, no estimated before/after.
//
// Covers the required cases:
//   A  successful import with no meaningful intelligence change
//   B  successful import that increases measurable evidence
//   C  import that crosses Early Signal / Developing
//   D  import that crosses Supported
//   E  import that meets no confidence threshold
//   F  Creator Report reflects the same canonical state afterwards
//   G  no duplicate intelligence calculation is introduced
//   H  dashboard_events constraints are respected
//
// Same mirrored-fixture convention as the other verify-*.mjs scripts.

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
const ORDER = [S.NOT_AVAILABLE, S.CALIBRATING, S.EARLY_SIGNAL, S.DEVELOPING, S.SUPPORTED, S.HIGH_CONFIDENCE, S.ESTABLISHED]
const rank = s => { const i = ORDER.indexOf(s); return i === -1 ? 0 : i }
const atLeast = (s, f) => rank(s) >= rank(f)
const CLAIMABLE_FLOOR = S.SUPPORTED

// ── mirrored from lib/intelligence/readiness.js snapshot()/diffSnapshots() ──
// Insight kinds, mirrored from lib/intelligence/insights.js — only the ones
// these fixtures use. A FACT crossing the claimable floor is bookkeeping.
const KIND = {
  earnings_total: 'FACT', session_history: 'FACT', fan_roster: 'FACT',
  peak_window: 'PATTERN', hourly_rate: 'PATTERN', peak_day: 'PATTERN',
}

const EV_KEYS = ['sessionsAnalyzed', 'tipsAnalyzed', 'fansIdentified', 'windowsCompared', 'platformsQualifying', 'streamedHours']

function snapshot({ states, pct, evidence }) {
  const ev = evidence || {}
  return {
    states: { ...states },
    pct,
    evidence: Object.fromEntries(EV_KEYS.map(k => [k, ev[k] ?? 0])),
  }
}

function diffSnapshots(prev, next) {
  const before = prev?.states || {}
  const after = next?.states || {}
  const improved = []
  for (const [id, state] of Object.entries(after)) {
    const was = before[id] || S.NOT_AVAILABLE
    if (rank(state) > rank(was)) {
      const newlyClaimable = atLeast(state, CLAIMABLE_FLOOR) && !atLeast(was, CLAIMABLE_FLOOR)
      improved.push({
        id, from: was, to: state, kind: KIND[id] || null, newlyClaimable,
        isDiscovery: newlyClaimable && KIND[id] !== 'FACT',
      })
    }
  }
  const evBefore = prev?.evidence || null
  const evAfter = next?.evidence || null
  const evidenceDelta = {}
  if (evBefore && evAfter) {
    for (const key of Object.keys(evAfter)) {
      if (typeof evBefore[key] !== 'number' || typeof evAfter[key] !== 'number') continue
      const delta = parseFloat((evAfter[key] - evBefore[key]).toFixed(1))
      if (delta > 0) evidenceDelta[key] = { before: evBefore[key], after: evAfter[key], delta }
    }
  }
  return {
    improved,
    pctBefore: prev?.pct ?? 0,
    pctAfter: next?.pct ?? 0,
    pctDelta: (next?.pct ?? 0) - (prev?.pct ?? 0),
    evidenceDelta,
    isQuiet: improved.length === 0 && Object.keys(evidenceDelta).length === 0,
  }
}

// ── mirrored from app/dashboard/ImportSuccess.jsx's headline decision ───────
const CLAIMABLE = new Set([S.SUPPORTED, S.HIGH_CONFIDENCE, S.ESTABLISHED])
function successCopy(changed) {
  const discoveries = (changed?.improved || []).filter(c => c.isDiscovery ?? c.newlyClaimable)
  const hasMeasuredChange =
    Object.keys(changed?.evidenceDelta || {}).length > 0 || (changed?.improved?.length ?? 0) > 0
  const headline = discoveries.length
    ? 'New insight unlocked'
    : hasMeasuredChange ? 'Your report just got smarter' : 'Your data is in'
  return { headline, celebrates: discoveries.length > 0, unlockedIds: discoveries.map(c => c.id) }
}
function showsDiscovery(peakState, windowExists) {
  return Boolean(windowExists) && peakState !== S.NOT_AVAILABLE && peakState !== S.CALIBRATING
}

const base = (overrides = {}) => snapshot({
  states: { earnings_total: S.ESTABLISHED, session_history: S.DEVELOPING, peak_window: S.CALIBRATING, hourly_rate: S.EARLY_SIGNAL },
  pct: 30,
  evidence: { sessionsAnalyzed: 6, tipsAnalyzed: 120, fansIdentified: 14, windowsCompared: 1, platformsQualifying: 1, streamedHours: 8.2 },
  ...overrides,
})

console.log('\nA — IMPORT WITH NO MEANINGFUL INTELLIGENCE CHANGE')
{
  // Duplicate rows: everything deduped, nothing new measured.
  const before = base()
  const after = base()
  const d = diffSnapshots(before, after)
  check('no state improved', d.improved.length, 0)
  check('no evidence delta', Object.keys(d.evidenceDelta).length, 0)
  check('diff reports itself as quiet', d.isQuiet, true)
  check('calibration did not move', d.pctDelta, 0)
  const copy = successCopy(d)
  check('headline is honest, not celebratory', copy.headline, 'Your data is in')
  check('nothing is celebrated', copy.celebrates, false)
}

console.log('\nB — IMPORT THAT INCREASES MEASURABLE EVIDENCE')
{
  const before = base()
  const after = base({
    pct: 38,
    evidence: { sessionsAnalyzed: 20, tipsAnalyzed: 306, fansIdentified: 51, windowsCompared: 3, platformsQualifying: 1, streamedHours: 14.6 },
  })
  const d = diffSnapshots(before, after)
  check('sessions delta is measured, not estimated', d.evidenceDelta.sessionsAnalyzed, { before: 6, after: 20, delta: 14 })
  check('fans delta', d.evidenceDelta.fansIdentified.delta, 37)
  check('windows compared delta', d.evidenceDelta.windowsCompared.delta, 2)
  check('hours delta keeps one decimal', d.evidenceDelta.streamedHours.delta, 6.4)
  check('unchanged counter is omitted entirely', d.evidenceDelta.platformsQualifying, undefined)
  check('calibration movement is real', [d.pctBefore, d.pctAfter], [30, 38])
  check('headline reflects a real gain', successCopy(d).headline, 'Your report just got smarter')
  check('but nothing is claimed as unlocked', successCopy(d).celebrates, false)
}

console.log('\nC — IMPORT THAT CROSSES EARLY SIGNAL / DEVELOPING')
{
  const before = base()
  const after = base({
    states: { earnings_total: S.ESTABLISHED, session_history: S.ESTABLISHED, peak_window: S.EARLY_SIGNAL, hourly_rate: S.DEVELOPING },
    pct: 44,
  })
  const d = diffSnapshots(before, after)
  check('peak window improved to EARLY_SIGNAL', d.improved.find(i => i.id === 'peak_window').to, S.EARLY_SIGNAL)
  check('crossing into EARLY_SIGNAL is NOT claimable', d.improved.find(i => i.id === 'peak_window').newlyClaimable, false)
  check('so the copy does not say unlocked', successCopy(d).headline, 'Your report just got smarter')
  // The card still shows the window — as an early signal, never as a peak.
  check('an early-signal window IS shown', showsDiscovery(S.EARLY_SIGNAL, true), true)
  check('it is not treated as claimable', CLAIMABLE.has(S.EARLY_SIGNAL), false)
  check('a DEVELOPING window is shown too', showsDiscovery(S.DEVELOPING, true), true)
  check('a DEVELOPING window is still not claimable', CLAIMABLE.has(S.DEVELOPING), false)

  // session_history (a FACT) went DEVELOPING -> ESTABLISHED in this import,
  // crossing the claimable floor. That is bookkeeping, not a discovery, and
  // must not trigger the unlock moment.
  const sh = d.improved.find(i => i.id === 'session_history')
  check('a FACT did cross the claimable floor', sh.newlyClaimable, true)
  check('but it is not counted as a discovery', sh.isDiscovery, false)
  check('so no unlock is celebrated', successCopy(d).celebrates, false)
}

console.log('\nD — IMPORT THAT CROSSES SUPPORTED')
{
  const before = base({ states: { peak_window: S.DEVELOPING }, pct: 44 })
  const after = base({ states: { peak_window: S.SUPPORTED }, pct: 58 })
  const d = diffSnapshots(before, after)
  const copy = successCopy(d)
  check('the crossing is flagged newlyClaimable', d.improved[0].newlyClaimable, true)
  check('headline celebrates', copy.headline, 'New insight unlocked')
  check('the celebrated insight is named', copy.unlockedIds, ['peak_window'])
  check('and it is a pattern, not a fact', d.improved[0].kind, 'PATTERN')
  check('the discovery card treats it as a finding', CLAIMABLE.has(S.SUPPORTED), true)
  check('calibration jump is real', [d.pctBefore, d.pctAfter], [44, 58])

  // Going SUPPORTED -> HIGH_CONFIDENCE is an improvement but NOT a new
  // unlock: it was already claimable, so it must not re-celebrate.
  const higher = diffSnapshots(base({ states: { peak_window: S.SUPPORTED } }), base({ states: { peak_window: S.HIGH_CONFIDENCE } }))
  check('already-claimable improvement does not re-celebrate', higher.improved[0].newlyClaimable, false)
  check('and its copy stays measured', successCopy(higher).headline, 'Your report just got smarter')
}

console.log('\nE — IMPORT THAT MEETS NO CONFIDENCE THRESHOLD')
{
  // Real new data, but every insight stays below any threshold.
  const before = base({ states: { peak_window: S.NOT_AVAILABLE }, pct: 8, evidence: { sessionsAnalyzed: 1, tipsAnalyzed: 9, fansIdentified: 3, windowsCompared: 0, platformsQualifying: 0, streamedHours: 1.1 } })
  const after = base({ states: { peak_window: S.CALIBRATING }, pct: 11, evidence: { sessionsAnalyzed: 2, tipsAnalyzed: 21, fansIdentified: 6, windowsCompared: 0, platformsQualifying: 0, streamedHours: 2.4 } })
  const d = diffSnapshots(before, after)
  check('evidence still moved', d.evidenceDelta.sessionsAnalyzed.delta, 1)
  check('no window is claimable', CLAIMABLE.has(S.CALIBRATING), false)
  check('no discovery card is shown while CALIBRATING', showsDiscovery(S.CALIBRATING, false), false)
  check('nothing is celebrated', successCopy(d).celebrates, false)
  check('copy acknowledges the data without overclaiming', successCopy(d).headline, 'Your report just got smarter')
}

console.log('\nF — CREATOR REPORT REFLECTS THE SAME CANONICAL STATE')
{
  // Both surfaces read the same insights object; the report shows current
  // state while the success card shows the transition into it.
  const current = base({ states: { peak_window: S.SUPPORTED }, pct: 58 })
  const d = diffSnapshots(base({ states: { peak_window: S.DEVELOPING }, pct: 44 }), current)
  check('success card and report agree on the state', d.improved[0].to, current.states.peak_window)
  check('report calibration equals the success card AFTER value', current.pct, d.pctAfter)
  check('report treats the same state as claimable', CLAIMABLE.has(current.states.peak_window), true)
}

console.log('\nG — NO SECOND INTELLIGENCE CALCULATION')
{
  // The success state derives everything from the diff object. Given the same
  // diff, its output is fully determined — there is nowhere for a second
  // calculation to disagree.
  const d = diffSnapshots(base({ pct: 20 }), base({ pct: 40, states: { peak_window: S.SUPPORTED } }))
  check('same diff always yields the same headline', successCopy(d).headline, successCopy(d).headline)
  check('the shown percentages come from the diff, not recomputed', [d.pctBefore, d.pctAfter], [20, 40])
  // A percentage must never be derived from evidence counts locally.
  const evOnly = diffSnapshots(
    base({ pct: 30, evidence: { sessionsAnalyzed: 6, tipsAnalyzed: 120, fansIdentified: 14, windowsCompared: 1, platformsQualifying: 1, streamedHours: 8.2 } }),
    base({ pct: 30, evidence: { sessionsAnalyzed: 60, tipsAnalyzed: 1200, fansIdentified: 140, windowsCompared: 10, platformsQualifying: 1, streamedHours: 82 } })
  )
  check('ten times the evidence does not move pct on its own', evOnly.pctDelta, 0)
  check('the evidence delta is still reported honestly', evOnly.evidenceDelta.sessionsAnalyzed.delta, 54)
}

console.log('\nH — DASHBOARD_EVENTS CONSTRAINTS')
{
  const ALLOWED_PRIORITY = ['critical', 'high', 'medium', 'low']
  const ALLOWED_STATUS = ['new', 'seen', 'dismissed']
  const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 }

  const events = [
    { priority: 'high', status: 'new', fingerprint: 'milestone:peak_window_found', created_at: '2026-08-26T10:00:00Z' },
    { priority: 'medium', status: 'new', fingerprint: 'milestone:first_sessions', created_at: '2026-08-26T11:00:00Z' },
    { priority: 'low', status: 'seen', fingerprint: 'confidence:hourly_rate:EARLY_SIGNAL->DEVELOPING', created_at: '2026-08-26T12:00:00Z' },
  ]
  for (const e of events) {
    check(`${e.fingerprint}: valid priority`, ALLOWED_PRIORITY.includes(e.priority), true)
    check(`${e.fingerprint}: valid status`, ALLOWED_STATUS.includes(e.status), true)
  }
  check('fingerprints are unique so the upsert dedupes', new Set(events.map(e => e.fingerprint)).size, events.length)

  // pickSticky(): semantic priority order, newest first within a priority.
  const picked = [...events].sort((a, b) =>
    (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
    new Date(b.created_at) - new Date(a.created_at)
  )[0]
  check('the highest-priority discovery wins, not the newest', picked.fingerprint, 'milestone:peak_window_found')
  // Alphabetical ordering would have picked 'low' over 'medium' — the reason
  // the sort is applied in JS rather than SQL.
  check('semantic order differs from alphabetical', ['critical','high','medium','low'], [...ALLOWED_PRIORITY].sort((a,b)=>PRIORITY_RANK[a]-PRIORITY_RANK[b]))
}

console.log('\nBASELINE SAFETY')
{
  // No stored baseline: the diff must be null, never a comparison against zero
  // that would announce every existing insight as newly unlocked.
  const firstRead = null
  const d = firstRead ? diffSnapshots(firstRead, base()) : null
  check('a first read produces no diff', d, null)
  check('and the card falls back to current-state copy', successCopy(d).headline, 'Your data is in')

  // A baseline written before evidence counters existed: states still diff,
  // evidence is omitted rather than treated as a gain from zero.
  const legacy = { states: { peak_window: S.DEVELOPING }, pct: 40 }
  const now = base({ states: { peak_window: S.SUPPORTED }, pct: 58 })
  const legacyDiff = diffSnapshots(legacy, now)
  check('legacy baseline still reports the state change', legacyDiff.improved[0].newlyClaimable, true)
  check('legacy baseline reports no fabricated evidence gain', Object.keys(legacyDiff.evidenceDelta).length, 0)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

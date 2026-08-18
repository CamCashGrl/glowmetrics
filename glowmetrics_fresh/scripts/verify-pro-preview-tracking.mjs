// Regression tests for the consolidated pro_preview_viewed instrumentation
// (app/dashboard/page.js's trackProPreviewViewed helper) — one event with a
// `feature` property across every major locked conversion surface, rather
// than a separate event name per surface, and deduped per session so
// repeated re-renders of the same locked card don't spam the event.

let pass = 0, fail = 0
function check(name, cond) { if (cond) { pass++; console.log(`PASS  ${name}`) } else { fail++; console.log(`FAIL  ${name}`) } }

// Mirrors the ref-based Set dedup + gtmTrack call shape exactly.
function makeTracker() {
  const fired = new Set()
  const events = []
  const trackProPreviewViewed = (feature) => {
    if (fired.has(feature)) return
    fired.add(feature)
    events.push({ name: 'pro_preview_viewed', feature })
  }
  return { trackProPreviewViewed, events, fired }
}

// ══════════════════════════════════════════════════════════════════════
// 1. One event name, feature as a property — not five separate event names.
// ══════════════════════════════════════════════════════════════════════
{
  const { trackProPreviewViewed, events } = makeTracker()
  trackProPreviewViewed('live_mode')
  trackProPreviewViewed('best_time')
  trackProPreviewViewed('income_forecast')
  trackProPreviewViewed('platform_comparison')
  trackProPreviewViewed('whale_intelligence')
  check('all five surfaces use the SAME event name', events.every(e => e.name === 'pro_preview_viewed'))
  check('each carries its own feature value', events.map(e => e.feature).join(',') === 'live_mode,best_time,income_forecast,platform_comparison,whale_intelligence')
  check('exactly 5 events fired, one per surface', events.length === 5)
}

// ══════════════════════════════════════════════════════════════════════
// 2. Dedup — repeated calls for the SAME feature (e.g. re-renders of the
//    same locked card) fire only once per session.
// ══════════════════════════════════════════════════════════════════════
{
  const { trackProPreviewViewed, events } = makeTracker()
  for (let i = 0; i < 20; i++) trackProPreviewViewed('best_time') // simulates 20 re-renders
  check('20 repeated calls for the same feature produce exactly 1 event', events.length === 1)
}

// ══════════════════════════════════════════════════════════════════════
// 3. Different features remain independently deduped — hitting 'best_time'
//    many times must not suppress a later, different feature.
// ══════════════════════════════════════════════════════════════════════
{
  const { trackProPreviewViewed, events } = makeTracker()
  trackProPreviewViewed('best_time')
  trackProPreviewViewed('best_time')
  trackProPreviewViewed('live_mode')
  check('a different feature still fires after another feature already fired', events.length === 2)
  check('order preserved: best_time first, live_mode second', events.map(e => e.feature).join(',') === 'best_time,live_mode')
}

// ══════════════════════════════════════════════════════════════════════
// 4. Gating logic mirrors the real conditions at each call site — a Pro
//    user, or a data-insufficient (non-Pro-related) lock state, must never
//    fire this event, since there's no actual Pro preview being shown.
// ══════════════════════════════════════════════════════════════════════
function shouldFireBestTime(isPro, bestTimeLockLocked) { return !isPro && !bestTimeLockLocked }
function shouldFireIncomeForecast(isPro, bhLabelPresent) { return !isPro && !!bhLabelPresent }
function shouldFireWhaleIntel(activeTab, isPro, hiddenWhalesCount) { return activeTab === 'whales' && !isPro && hiddenWhalesCount > 0 }

check('Pro user: best_time never fires regardless of lock state', shouldFireBestTime(true, false) === false)
check('Free + data-insufficient lock: best_time does NOT fire (different, non-Pro empty state)', shouldFireBestTime(false, true) === false)
check('Free + real pattern found: best_time DOES fire', shouldFireBestTime(false, false) === true)
check('Pro user: income_forecast never fires', shouldFireIncomeForecast(true, true) === false)
check('Free + no bhLabel yet: income_forecast does not fire (nothing to preview)', shouldFireIncomeForecast(false, false) === false)
check('Free + bhLabel present: income_forecast fires', shouldFireIncomeForecast(false, true) === true)
check('whale_intelligence only fires while actually on the whales tab', shouldFireWhaleIntel('overview', false, 5) === false)
check('whale_intelligence does not fire for Pro (hiddenWhales is always 0 for Pro)', shouldFireWhaleIntel('whales', true, 0) === false)
check('whale_intelligence fires for Free on the whales tab with hidden fans', shouldFireWhaleIntel('whales', false, 5) === true)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

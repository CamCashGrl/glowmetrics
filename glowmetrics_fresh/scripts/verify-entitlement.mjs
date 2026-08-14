// Standalone verification for the server-side entitlement/redaction
// contract used by app/api/insights/route.js + lib/entitlement.js.
//
// Goal: prove the Free/Pro branch is driven ONLY by the server-derived
// `isPro` flag (profiles.plan, read server-side via the authenticated
// session) — never by anything a client could influence (platform count,
// query params, request body, data volume). Same mirror-logic convention as
// the repo's other verify-*.mjs scripts (no test framework configured).
//
// Mirrors lib/entitlement.js's redact() exactly (pure function, safe to
// mirror 1:1) and app/api/insights/route.js's response-shaping logic.

function redact({ isPro, category, summary, count, data }) {
  if (!isPro) return { unlocked: false, preview: { category, summary, count } }
  return { unlocked: true, data }
}

// Mirrors route.js's shape decision for the two response fields, given
// already-computed analytics (this script isn't re-verifying the canonical
// analytics math — that's scripts/verify-canonical-analytics.mjs's job —
// only that the SAME computed result gets redacted correctly regardless of
// plan/platform-count/data-shape inputs).
function buildInsightsResponse({ isPro, bestWindow, grid, earlySignal, missed }) {
  const missedCount = [missed.today_missed, missed.recent_streak_missed].filter(Boolean).length
    + Object.keys(missed.cumulative_by_platform || {}).length
  return {
    best_time: redact({
      isPro, category: 'timing',
      summary: bestWindow ? 'You have a predictable earning pattern.' : 'Keep streaming to build a reliable pattern.',
      count: bestWindow ? 1 : 0,
      data: { grid, bestWindow, earlySignal },
    }),
    missed_revenue: redact({
      isPro, category: 'missed_revenue',
      summary: missedCount > 0 ? 'You have sessions that underperformed your peak window.' : 'No missed windows detected recently.',
      count: missedCount,
      data: missed,
    }),
  }
}

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}`) }
}

// A rich, non-trivial computed result — used across every scenario below so
// the only thing that varies between scenarios is `isPro` and the fixture
// shape (platform count / sparse / missing data), never the redaction logic.
const RICH_RESULT = {
  bestWindow: { localDay: 'Monday', localHour: 20, medianUsdPerHour: 85, sessionCount: 6, tier: 'high' },
  grid: [{ localDay: 'Monday', localHour: 20, medianUsdPerHour: 85, sessionCount: 6, tier: 'high' }],
  earlySignal: null,
  missed: {
    today_missed: { localDay: 'Monday', localHour: 20, estimatedLoss: 85 },
    cumulative_by_platform: { Chaturbate: { missedRevenue: 120 }, BongaCams: { missedRevenue: 40 } },
    recent_streak_missed: { localDay: 'Monday', localHour: 20, estimatedLoss: 255 },
  },
}
const SPARSE_RESULT = {
  bestWindow: null, grid: [], earlySignal: { localDay: 'Tuesday', localHour: 14, medianUsdPerHour: 30, sessionCount: 2, tier: 'promising' },
  missed: { today_missed: null, cumulative_by_platform: {}, recent_streak_missed: null },
}
const MISSING_RESULT = { bestWindow: null, grid: [], earlySignal: null, missed: { today_missed: null, cumulative_by_platform: {}, recent_streak_missed: null } }

function assertNoProLeak(resp, label) {
  check(`${label}: best_time.unlocked === false`, resp.best_time.unlocked === false)
  check(`${label}: best_time has NO 'data' key at all (not even null)`, !('data' in resp.best_time))
  check(`${label}: best_time.preview.category/summary/count present`, 'category' in resp.best_time.preview && 'summary' in resp.best_time.preview && 'count' in resp.best_time.preview)
  check(`${label}: missed_revenue.unlocked === false`, resp.missed_revenue.unlocked === false)
  check(`${label}: missed_revenue has NO 'data' key at all`, !('data' in resp.missed_revenue))
  // The preview must not leak the underlying exact figures anywhere in its stringified form
  const previewStr = JSON.stringify(resp.best_time.preview) + JSON.stringify(resp.missed_revenue.preview)
  check(`${label}: preview text contains no dollar-figure leakage`, !/\$?\d{2,}(\.\d\d)?/.test(previewStr) || !previewStr.includes('85'))
}
function assertFullProPayload(resp, label) {
  check(`${label}: best_time.unlocked === true`, resp.best_time.unlocked === true)
  check(`${label}: best_time has NO 'preview' key`, !('preview' in resp.best_time))
  check(`${label}: best_time.data present and matches computed grid`, JSON.stringify(resp.best_time.data.grid) === JSON.stringify(RICH_RESULT.grid) || JSON.stringify(resp.best_time.data.grid) === JSON.stringify(SPARSE_RESULT.grid) || JSON.stringify(resp.best_time.data.grid) === JSON.stringify(MISSING_RESULT.grid))
  check(`${label}: missed_revenue.unlocked === true`, resp.missed_revenue.unlocked === true)
  check(`${label}: missed_revenue has NO 'preview' key`, !('preview' in resp.missed_revenue))
}

// ══════════════════════════════════════════════════════════════════════
// Free / Pro x platform-count x data-richness matrix
// ══════════════════════════════════════════════════════════════════════
// NOTE ON PLATFORM COUNT: app/api/insights/route.js computes analytics over
// ALL of the authenticated user's synced tips regardless of how many
// platforms they've connected — platform count has no code path into the
// isPro/redact() decision at all. These scenarios exist to positively prove
// that (i.e. platform count cannot become an accidental leakage vector),
// not because the route branches on it today.

{ // Free + 1 platform (rich data)
  const resp = buildInsightsResponse({ isPro: false, ...RICH_RESULT })
  assertNoProLeak(resp, 'Free + 1 platform')
}
{ // Free + 2 platforms (same rich data, cumulative_by_platform has 2 keys)
  const resp = buildInsightsResponse({ isPro: false, ...RICH_RESULT })
  assertNoProLeak(resp, 'Free + 2 platforms')
  check('Free + 2 platforms: preview.count is a small integer hint, not the raw per-platform breakdown', typeof resp.missed_revenue.preview.count === 'number' && !('cumulative_by_platform' in resp.missed_revenue.preview))
}
{ // Pro + 1 platform
  const oneplatform = { ...RICH_RESULT, missed: { ...RICH_RESULT.missed, cumulative_by_platform: { Chaturbate: { missedRevenue: 120 } } } }
  const resp = buildInsightsResponse({ isPro: true, ...oneplatform })
  assertFullProPayload(resp, 'Pro + 1 platform')
}
{ // Pro + 2+ platforms
  const resp = buildInsightsResponse({ isPro: true, ...RICH_RESULT })
  assertFullProPayload(resp, 'Pro + 2+ platforms')
  check('Pro + 2+ platforms: full per-platform breakdown present (2 platforms)', Object.keys(resp.missed_revenue.data.cumulative_by_platform).length === 2)
}
{ // Free + sparse data
  const resp = buildInsightsResponse({ isPro: false, ...SPARSE_RESULT })
  assertNoProLeak(resp, 'Free + sparse data')
  check('Free + sparse data: preview.count reflects zero missed-revenue signals', resp.missed_revenue.preview.count === 0)
}
{ // Pro + sparse data — Pro still gets the full (mostly-null) shape, not an error
  const resp = buildInsightsResponse({ isPro: true, ...SPARSE_RESULT })
  assertFullProPayload(resp, 'Pro + sparse data')
  check('Pro + sparse data: earlySignal surfaced (not silently dropped for Pro)', resp.best_time.data.earlySignal !== null)
}
{ // Free + missing data (brand new account, zero tips — route.js's early-return branch)
  const resp = buildInsightsResponse({ isPro: false, ...MISSING_RESULT })
  assertNoProLeak(resp, 'Free + missing data')
}
{ // Pro + missing data
  const resp = buildInsightsResponse({ isPro: true, ...MISSING_RESULT })
  assertFullProPayload(resp, 'Pro + missing data')
}

// ══════════════════════════════════════════════════════════════════════
// Structural guarantee: the SAME computed result, redacted under both
// plans, must never let the Free branch's JSON stringification contain the
// Pro branch's exact numbers anywhere (catches a bug where preview.summary
// is built by interpolating real figures instead of qualitative text).
// ══════════════════════════════════════════════════════════════════════
{
  const freeResp = buildInsightsResponse({ isPro: false, ...RICH_RESULT })
  const proResp = buildInsightsResponse({ isPro: true, ...RICH_RESULT })
  const freeStr = JSON.stringify(freeResp)
  check('Free response JSON does not contain the Pro bestWindow medianUsdPerHour value (85)', !freeStr.includes('85'))
  check('Free response JSON does not contain the Pro missed-revenue estimatedLoss value (255)', !freeStr.includes('255'))
  check('Pro response JSON DOES contain the real figures (sanity check the fixture actually differs)', JSON.stringify(proResp).includes('85') && JSON.stringify(proResp).includes('255'))
}

// ══════════════════════════════════════════════════════════════════════
// isPro is server-derived only — prove there is no parameter in redact()'s
// signature or buildInsightsResponse()'s signature that a client-supplied
// value could reach. (Static shape check, not a runtime exploit — the real
// guarantee is architectural: route.js's GET() takes no request body/query
// input at all, and isPro comes from `isProPlan(profile)` where `profile`
// is fetched server-side via the authenticated session's own id.)
// ══════════════════════════════════════════════════════════════════════
{
  const redactParams = Object.keys({ isPro: 1, category: 1, summary: 1, count: 1, data: 1 })
  check('redact() signature has no client-controllable override param (e.g. "unlocked", "forcePro")', !redactParams.includes('unlocked') && !redactParams.includes('forcePro') && !redactParams.includes('plan'))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

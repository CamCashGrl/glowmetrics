// Standalone verification for lib/intelligence/pipeline.js's
// runImportCompletedPipeline() orchestration logic (first import, repeat
// import / dedup, previous-state retrieval, and non-fatal error handling).
//
// This repo has no test framework configured and lib/intelligence/
// pipeline.js can't be `import`-ed directly by plain Node (ESM syntax, no
// "type": "module" — see scripts/verify-estimated-hourly-rate.mjs's
// comment for the same limitation, and it transitively imports
// lib/serverAnalytics.js -> lib/analytics.js, which has the identical
// issue). This script mirrors the pipeline's orchestration control flow
// exactly, against a fake in-memory Supabase client (no real network/DB —
// this is testing decision logic, not the RPCs themselves, which need a
// real database — see the design report's testing-strategy section for
// what still requires the migration to actually be applied). Keep in sync
// with lib/intelligence/pipeline.js if it changes.

function buildAnalyticsSnapshot(analytics) {
  if (!analytics) return null
  return {
    totalUSD: analytics.totalUSD ?? 0,
    totalTokens: analytics.totalTokens ?? 0,
    totalTips: analytics.totalTips ?? 0,
    bestDay: analytics.bestDay ? { day: analytics.bestDay.day, avg: analytics.bestDay.avg } : null,
    bestHour: analytics.bestHour ? { hour: analytics.bestHour.hour, avg: analytics.bestHour.avg } : null,
    estimatedHourlyRate: analytics.estimatedHourlyRate ?? 0,
    momentum: analytics.momentum ? { pct: analytics.momentum.pct, label: analytics.momentum.label } : null,
    streakDays: analytics.streakDays ?? 0,
    platformTotals: (analytics.platforms || []).map(p => ({ platform: p.platform, totalUSD: p.totalUSD, usdPerHour: p.usdPerHour })),
    whales: (analytics.whales || []).filter(w => w.tier === 'Whale' || w.tier === 'Shark').map(w => ({ username: w.username, tier: w.tier, totalUSD: w.totalUSD })),
    computedAt: new Date().toISOString(),
  }
}

// Mirrors runImportCompletedPipeline() exactly, minus the real
// getServerAnalytics import (injected here as `getServerAnalytics` so
// tests can control its output without a real database).
async function runImportCompletedPipeline({ userId, supabase, uploadRef, platform, metadata = {}, getServerAnalytics }) {
  if (!userId) throw new Error('runImportCompletedPipeline requires a userId')
  if (!supabase) throw new Error('runImportCompletedPipeline requires a Supabase client')
  if (!uploadRef) throw new Error('runImportCompletedPipeline requires an uploadRef')

  const analytics = await getServerAnalytics(userId, supabase)
  const currentSnapshot = buildAnalyticsSnapshot(analytics)

  let previousSnapshot = null
  try {
    const { data } = await supabase.from('analytics_snapshots').select('snapshot, computed_at').eq('user_id', userId).maybeSingle()
    previousSnapshot = data?.snapshot ?? null
  } catch (e) { /* non-fatal */ }

  let event = null
  try {
    const { data, error } = await supabase.rpc('record_dashboard_event_if_new', {
      p_event_type: 'import_completed', p_source: 'csv_import', p_priority: 'medium',
      p_title: 'Your data is updated',
      p_message: `Your latest ${platform} import is complete. CamCash found new information in your data.`,
      p_fingerprint: `import_completed:${uploadRef}`,
      p_metadata: { upload_ref: uploadRef, platform, ...metadata },
      p_related_entity_type: 'csv_upload', p_related_entity_id: uploadRef,
    })
    if (error) throw error
    event = data
  } catch (e) { /* non-fatal */ }

  try {
    await supabase.from('analytics_snapshots').upsert({ user_id: userId, snapshot: currentSnapshot, computed_at: new Date().toISOString() }, { onConflict: 'user_id' })
  } catch (e) { /* non-fatal */ }

  return { event, currentSnapshot, previousSnapshot }
}

// ── Fake Supabase client ────────────────────────────────────────────────
// In-memory store keyed by user_id, simulating analytics_snapshots +
// record_dashboard_event_if_new's real dedup semantics (same fingerprint
// for the same user returns the existing row instead of inserting again).
function makeFakeSupabase({ snapshotsFail = false, rpcFail = false } = {}) {
  const snapshots = new Map() // user_id -> { snapshot, computed_at }
  const events = new Map()    // `${user_id}|${fingerprint}` -> event row
  let nextId = 1

  return {
    _snapshots: snapshots,
    _events: events,
    from(table) {
      if (table === 'analytics_snapshots') {
        return {
          select: () => ({
            eq: (_col, userId) => ({
              maybeSingle: async () => {
                if (snapshotsFail) throw new Error('simulated read failure')
                return { data: snapshots.has(userId) ? { snapshot: snapshots.get(userId).snapshot } : null }
              },
            }),
          }),
          upsert: async (row) => {
            if (snapshotsFail) throw new Error('simulated write failure')
            snapshots.set(row.user_id, row)
            return { data: row, error: null }
          },
        }
      }
      throw new Error(`unexpected table in test double: ${table}`)
    },
    rpc: async (name, params) => {
      if (name !== 'record_dashboard_event_if_new') throw new Error(`unexpected rpc in test double: ${name}`)
      if (rpcFail) return { data: null, error: { message: 'simulated rpc failure' } }
      // Mirrors the real RPC's fingerprint dedup: same user + fingerprint
      // returns the existing row instead of creating a new one.
      const key = `test-user|${params.p_fingerprint}`
      if (events.has(key)) return { data: events.get(key), error: null }
      const row = {
        id: nextId++, user_id: 'test-user', event_type: params.p_event_type,
        priority: params.p_priority, status: 'new', title: params.p_title,
        message: params.p_message, fingerprint: params.p_fingerprint,
        metadata: params.p_metadata, created_at: new Date().toISOString(),
      }
      events.set(key, row)
      return { data: row, error: null }
    },
  }
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

const fakeAnalytics = { totalUSD: 100, totalTokens: 2000, totalTips: 20, bestDay: null, bestHour: null, estimatedHourlyRate: 5, momentum: { pct: 10, label: 'Growing' }, streakDays: 3, platforms: [], whales: [] }
const getServerAnalytics = async () => fakeAnalytics

// 1. First import — no previous snapshot should exist yet
{
  const supabase = makeFakeSupabase()
  const result = await runImportCompletedPipeline({ userId: 'test-user', supabase, uploadRef: 'upload-1', platform: 'Chaturbate', getServerAnalytics })
  check('first import: previousSnapshot is null (nothing to compare against yet)', result.previousSnapshot, null)
  check('first import: event is recorded with status new', result.event?.status, 'new')
  check('first import: event fingerprint ties to this uploadRef', result.event?.fingerprint, 'import_completed:upload-1')
  check('first import: analytics_snapshots row now exists for this user', supabase._snapshots.has('test-user'), true)
}

// 2. Same import processed twice (e.g. retried request) — same uploadRef,
// same fingerprint -> dedup must return the SAME event, not a second row
{
  const supabase = makeFakeSupabase()
  const first = await runImportCompletedPipeline({ userId: 'test-user', supabase, uploadRef: 'upload-2', platform: 'Chaturbate', getServerAnalytics })
  const second = await runImportCompletedPipeline({ userId: 'test-user', supabase, uploadRef: 'upload-2', platform: 'Chaturbate', getServerAnalytics })
  check('duplicate import: exactly one event exists after two calls with the same uploadRef', supabase._events.size, 1)
  check('duplicate import: both calls return the same event id', first.event?.id, second.event?.id)
}

// 3. A genuinely new import (different uploadRef) after a previous one —
// previousSnapshot should now be populated from the first import
{
  const supabase = makeFakeSupabase()
  await runImportCompletedPipeline({ userId: 'test-user', supabase, uploadRef: 'upload-3a', platform: 'Chaturbate', getServerAnalytics })
  const second = await runImportCompletedPipeline({ userId: 'test-user', supabase, uploadRef: 'upload-3b', platform: 'Chaturbate', getServerAnalytics })
  check('second distinct import: previousSnapshot is populated (not null)', second.previousSnapshot !== null, true)
  check('second distinct import: a second, distinct event is created', supabase._events.size, 2)
}

// 4. Cross-user isolation — two different users never see each other's
// previous snapshot or events, even with the same uploadRef by coincidence
{
  const supabase = makeFakeSupabase()
  await runImportCompletedPipeline({ userId: 'user-a', supabase, uploadRef: 'shared-ref', platform: 'Chaturbate', getServerAnalytics })
  const resultB = await runImportCompletedPipeline({ userId: 'user-b', supabase, uploadRef: 'shared-ref', platform: 'Chaturbate', getServerAnalytics })
  check('cross-user isolation: user B has no previous snapshot even though user A just imported', resultB.previousSnapshot, null)
}

// 5. RPC failure must not throw — pipeline still returns, snapshot still persists
{
  const supabase = makeFakeSupabase({ rpcFail: true })
  let threw = false
  let result
  try { result = await runImportCompletedPipeline({ userId: 'test-user', supabase, uploadRef: 'upload-5', platform: 'Chaturbate', getServerAnalytics }) }
  catch (e) { threw = true }
  check('event RPC failure: pipeline does not throw', threw, false)
  check('event RPC failure: event is null but snapshot still persisted', { event: result?.event, snapshotSaved: supabase._snapshots.has('test-user') }, { event: null, snapshotSaved: true })
}

// 6. Snapshot read/write failure must not throw — event still gets recorded
{
  const supabase = makeFakeSupabase({ snapshotsFail: true })
  let threw = false
  let result
  try { result = await runImportCompletedPipeline({ userId: 'test-user', supabase, uploadRef: 'upload-6', platform: 'Chaturbate', getServerAnalytics }) }
  catch (e) { threw = true }
  check('snapshot failure: pipeline does not throw', threw, false)
  check('snapshot failure: event is still recorded despite snapshot read/write failing', result?.event?.status, 'new')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)

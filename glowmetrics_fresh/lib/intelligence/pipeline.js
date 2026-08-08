// ============================================================
// CAMCASH DASHBOARD INTELLIGENCE — IMPORT PIPELINE (Phase 1)
// ============================================================
//
// Proves the full architecture end-to-end for exactly one event type
// (import_completed) before any diff-based event type is built:
//
//   import persisted successfully (caller's own gate)
//     -> getServerAnalytics()            [existing, unmodified]
//     -> buildAnalyticsSnapshot()         [new, pure, no engine changes]
//     -> fetch previous analytics_snapshots row
//     -> record_dashboard_event_if_new('import_completed')
//     -> upsert analytics_snapshots with the new snapshot
//
// import_completed itself does NOT branch on the previous/current diff —
// per the phase spec, it's a reliable presence-based trigger ("did this
// import persist new rows"), not a diff-based one. The diff is still
// computed and both snapshots are returned here so the next phase's
// diff-based event types (peak window, whale, pace, ...) plug into this
// exact call site without new plumbing.
//
// Never creates a second analytics engine: the only analytics computation
// here is the one call to getServerAnalytics(), which itself only calls
// aggregateRows(). Never touches coaching_events, get_user_insights, or
// PR #381's existing dashboard_events RPCs beyond the additive
// p_cooldown_seconds parameter (NULL here, preserving the exact permanent
// dedup behavior import_completed already used).

import { getServerAnalytics } from '../serverAnalytics'
import { buildAnalyticsSnapshot } from './snapshot'

// userId/supabase: same contract as getServerAnalytics — caller decides
// the Supabase client (RLS-scoped user client in the upload route today);
// this function never creates its own client or widens access.
export async function runImportCompletedPipeline({
  userId,
  supabase,
  uploadRef,
  platform,
  metadata = {},
}) {
  if (!userId) throw new Error('runImportCompletedPipeline requires a userId')
  if (!supabase) throw new Error('runImportCompletedPipeline requires a Supabase client')
  if (!uploadRef) throw new Error('runImportCompletedPipeline requires an uploadRef')

  // ── SERVER ANALYTICS ──────────────────────────────────────────────────
  const analytics = await getServerAnalytics(userId, supabase)
  const currentSnapshot = buildAnalyticsSnapshot(analytics)

  // ── PREVIOUS STATE ────────────────────────────────────────────────────
  // A missing row (first-ever import for this user) is not an error —
  // previousSnapshot stays null, which future diff-based event types must
  // treat as "nothing to compare against yet", never as "everything is a
  // new discovery."
  let previousSnapshot = null
  try {
    const { data } = await supabase
      .from('analytics_snapshots')
      .select('snapshot, computed_at')
      .eq('user_id', userId)
      .maybeSingle()
    previousSnapshot = data?.snapshot ?? null
  } catch (snapshotReadErr) {
    console.warn('[intelligence] Failed to read previous analytics_snapshots row:', snapshotReadErr.message)
  }

  // ── IMPORT_COMPLETED EVENT ────────────────────────────────────────────
  // Presence-based trigger — fires because the import succeeded, not
  // because of anything in the diff above. p_cooldown_seconds intentionally
  // omitted (NULL): permanent one-fingerprint-ever dedup, tied to this
  // specific uploadRef, exactly as before this pipeline existed.
  let event = null
  try {
    const { data, error } = await supabase.rpc('record_dashboard_event_if_new', {
      p_event_type: 'import_completed',
      p_source: 'csv_import',
      p_priority: 'medium',
      p_title: 'Your data is updated',
      p_message: `Your latest ${platform} import is complete. CamCash found new information in your data.`,
      p_fingerprint: `import_completed:${uploadRef}`,
      p_metadata: { upload_ref: uploadRef, platform, ...metadata },
      p_related_entity_type: 'csv_upload',
      p_related_entity_id: uploadRef,
    })
    if (error) throw error
    event = data
  } catch (eventErr) {
    // Non-fatal — the import itself already succeeded; a failed
    // dashboard-event write must never fail or roll back a successful import.
    console.warn('[intelligence] Failed to record import_completed event:', eventErr.message)
  }

  // ── PERSIST CURRENT STATE ─────────────────────────────────────────────
  // Becomes "previous state" for the next import/event check. Also
  // non-fatal for the same reason as above.
  try {
    await supabase.from('analytics_snapshots').upsert(
      { user_id: userId, snapshot: currentSnapshot, computed_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  } catch (snapshotWriteErr) {
    console.warn('[intelligence] Failed to persist analytics_snapshots row:', snapshotWriteErr.message)
  }

  return { event, currentSnapshot, previousSnapshot }
}

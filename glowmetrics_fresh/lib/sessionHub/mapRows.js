// ============================================================
// CAMCASH — DB ROW ↔ CAMELCASE SHAPE MAPPING
// Keeps snake_case Supabase rows out of components; single place to
// change if a column is renamed.
// ============================================================

export function mapStreamSessionRow(row) {
  return {
    id: row.id,
    platform: row.platform,
    startedAt: row.start_time,
    endedAt: row.end_time,
    completed: !!row.completed,
    pauseIntervals: row.pause_intervals || [],
    durationConfidence: row.duration_confidence || 'estimated',
    correctedStartedAt: row.corrected_started_at,
    correctedEndedAt: row.corrected_ended_at,
    correctedPauseIntervals: row.corrected_pause_intervals,
    correctedPlatform: row.corrected_platform,
    correctedCompleted: row.corrected_completed,
    coachingEnabled: row.coaching_enabled !== false,
    tokens: row.tokens || 0,
    usd: parseFloat(row.usd) || 0,
    tipCount: row.tip_count || 0,
  }
}

export function mapCoachingEventRow(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    type: row.type,
    category: row.category,
    priority: row.priority,
    dedupeKey: row.dedupe_key,
    title: row.title,
    message: row.message,
    compactMessage: row.compact_message,
    relatedTipId: row.related_tip_id,
    relatedTipperId: row.related_tipper_id,
    relatedTipperName: row.related_tipper_name,
    relatedAmountUsd: row.related_amount_usd !== null ? parseFloat(row.related_amount_usd) : null,
    createdAt: row.created_at,
    shownAt: row.shown_at,
    expiresAt: row.expires_at,
    dismissedAt: row.dismissed_at,
    actionStatus: row.action_status,
    actionRespondedAt: row.action_responded_at,
    updatedAt: row.updated_at,
  }
}

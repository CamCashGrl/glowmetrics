import { FINALIZED_SESSION_COLUMNS, PRIVATE_INTERVAL_COLUMNS, toShowSummary } from './postShow'

// Re-reads finalized sessions and their private intervals from the database
// (RLS-scoped to the caller) and rebuilds each show summary from that
// persisted data. Returns { shows, error }.
export async function loadFinalizedShows(supabase, userId, { ids = null, limit = 10 } = {}) {
  let q = supabase
    .from('live_sessions')
    .select(FINALIZED_SESSION_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'ended')
    .not('finalized_at', 'is', null)
    .order('ended_at', { ascending: false })
  q = ids ? q.in('id', ids) : q.limit(limit)
  const { data: rows, error } = await q
  if (error) return { shows: [], error }
  if (!rows?.length) return { shows: [], error: null }

  const { data: intervals, error: intervalError } = await supabase
    .from('live_private_intervals')
    .select(PRIVATE_INTERVAL_COLUMNS)
    .in('live_session_id', rows.map((r) => r.id))
  if (intervalError) return { shows: [], error: intervalError }

  return { shows: rows.map((r) => toShowSummary(r, intervals || [])).filter(Boolean), error: null }
}

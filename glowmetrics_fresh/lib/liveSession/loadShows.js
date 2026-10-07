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

// Closed private intervals of every finalized show (what final_private_usd
// sums), for the lifetime Total Earned. Paged so no show is dropped.
export async function loadFinalizedPrivateIntervals(supabase, userId, { pageSize = 1000 } = {}) {
  const ids = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('live_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'ended')
      .not('finalized_at', 'is', null)
      .order('ended_at', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) return { intervals: [], error }
    ids.push(...(data || []).map((r) => r.id))
    if (!data || data.length < pageSize) break
  }
  if (!ids.length) return { intervals: [], error: null }

  const intervals = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from('live_private_intervals')
      .select(PRIVATE_INTERVAL_COLUMNS)
      .in('live_session_id', ids.slice(i, i + 200))
      .not('ended_at', 'is', null)
    if (error) return { intervals: [], error }
    intervals.push(...(data || []))
  }
  return { intervals, error: null }
}

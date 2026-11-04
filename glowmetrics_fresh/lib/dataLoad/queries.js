// Page fetchers for the dashboard's two full-history tables.
// NEWEST FIRST with a unique tiebreaker: (date_time desc, id desc) is a total,
// stable order, so offset pages never duplicate or skip rows with equal
// timestamps. Newest-first means a partial failure loses the OLDEST rows, so
// the newest rows (and the Free 31-day window anchored to each platform's
// latest row) stay correct. Callers reverse the result back to ascending.

const pageFetcher = (supabase, table, uid) => (from, to, { wantCount } = {}) =>
  supabase.from(table)
    .select('*', wantCount ? { count: 'exact' } : undefined)
    .eq('user_id', uid)
    .order('date_time', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)

export const tipsPageFetcher = (supabase, uid) => pageFetcher(supabase, 'tips', uid)
export const paidSessionsPageFetcher = (supabase, uid) => pageFetcher(supabase, 'paid_sessions', uid)

// Rows come back newest-first; the rest of the app expects ascending.
export const toAscending = (rows) => [...rows].reverse()

// Server-side tip loading — the single implementation of "read every tip this
// authenticated user owns, in chronological order".
//
// Extracted from app/api/insights/route.js verbatim (paging, ordering and the
// structural ownership guarantee are unchanged) so app/api/intelligence/route.js
// reuses it instead of carrying a second copy that could drift on page size,
// ordering or — worse — the ownership filter.
//
// OWNERSHIP IS STRUCTURAL: the caller passes the server-derived auth user id,
// never a client-supplied one, so there is no IDOR surface here. Callers must
// not accept a user id from the request body.

const PAGE = 1000

/**
 * @param {object} supabase - a route client already bound to the request's session
 * @param {string} userId - the SERVER-DERIVED auth user id
 * @returns {Promise<Array>} tips, oldest first
 */
export async function loadUserTips(supabase, userId) {
  let tips = []
  const { data: firstPage, count } = await supabase
    .from('tips').select('*', { count: 'exact' }).eq('user_id', userId)
    .order('date_time', { ascending: true }).range(0, PAGE - 1)

  if (!firstPage) return tips
  tips = firstPage

  const total = count ?? firstPage.length
  if (total > PAGE) {
    const ranges = []
    for (let from = PAGE; from < total; from += PAGE) ranges.push(from)
    const pages = await Promise.all(ranges.map(from =>
      supabase.from('tips').select('*').eq('user_id', userId)
        .order('date_time', { ascending: true }).range(from, from + PAGE - 1)
    ))
    for (const { data } of pages) if (data?.length) tips = tips.concat(data)
  }
  return tips
}

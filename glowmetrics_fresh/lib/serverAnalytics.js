// ============================================================
// CAMCASH — SERVER-SIDE ANALYTICS ENTRY POINT
// ============================================================
//
// This is a THIN WRAPPER, not a second analytics engine. It does exactly
// three things: (1) load a user's own persisted `tips` rows and timezone
// via an already-authenticated Supabase client, (2) hand that data to the
// one canonical engine, (3) return its output unmodified.
//
// It performs NO calculation of its own. All analytics math — sessions,
// whales, peak windows, platforms, predictions, insights — lives in and
// only in `aggregateRows()` (lib/analytics.js). If that ever needs to
// change, change it there; never duplicate or reimplement any of it here.
//
// Mirrors the exact fetch pattern app/dashboard/page.js's loadData() already
// uses (same table, same columns via `select("*")`, same page size, same
// parallel-remaining-pages strategy) so the rows handed to aggregateRows()
// are identical in shape to what the client path has always passed it —
// raw `tips` table rows, not a client-side-normalized shape.
//
// Callers decide the Supabase client (RLS-scoped user client, or
// service-role for a trusted server context) — this file never creates its
// own client and never widens access beyond what it's given.

import { aggregateRows } from './analytics'

const PAGE_SIZE = 1000

async function loadAllTips(supabase, userId) {
  const { data: firstPage, count, error: firstErr } = await supabase
    .from('tips')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('date_time', { ascending: true })
    .range(0, PAGE_SIZE - 1)

  if (firstErr) throw firstErr

  let allTips = firstPage || []
  const total = count ?? allTips.length

  if (total > PAGE_SIZE) {
    const remainingRanges = []
    for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) remainingRanges.push(from)

    const pages = await Promise.all(remainingRanges.map(from =>
      supabase.from('tips').select('*').eq('user_id', userId)
        .order('date_time', { ascending: true }).range(from, from + PAGE_SIZE - 1)
    ))

    for (const { data, error } of pages) {
      if (error) throw error
      if (data?.length) allTips = allTips.concat(data)
    }
  }

  return allTips
}

// `profiles.timezone` exists in the schema but is never written by any
// current code path (client-side callers always compute the browser's
// timezone at call time via Intl and pass it directly — there is nothing
// to read here yet). Falls back to 'UTC' rather than the server process's
// own timezone: aggregateRows() itself falls back to
// `Intl.DateTimeFormat().resolvedOptions().timeZone` when no tz is passed,
// which on a server means the SERVER's timezone, not the creator's — a
// silent correctness bug if left to that default. Passing an explicit
// fallback here avoids ever hitting that branch server-side.
async function loadUserTimezone(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data?.timezone || 'UTC'
}

// getServerAnalytics(userId, supabase) -> same shape aggregateRows() already
// returns to the dashboard today. `supabase` must already be an
// authenticated client scoped to `userId` (RLS enforces this is the only
// data it can read) or a trusted service-role client used by a server
// context that has already verified the caller owns `userId` — this
// function does not perform that verification itself.
export async function getServerAnalytics(userId, supabase) {
  if (!userId) throw new Error('getServerAnalytics requires a userId')
  if (!supabase) throw new Error('getServerAnalytics requires a Supabase client')

  const [tips, timezone] = await Promise.all([
    loadAllTips(supabase, userId),
    loadUserTimezone(supabase, userId),
  ])

  // `tips` (the raw rows this function already loaded) is spliced onto
  // aggregateRows()'s own return object as an additive field — purely
  // additive, no existing field renamed or changed. aggregateRows() itself
  // never returns the raw array (only `totalTips`, a count), and some
  // intelligence evaluators (e.g. weekly momentum, which needs to see the
  // prior 7-14 day window aggregateRows() doesn't expose on its own) need
  // the raw rows without triggering a second loadAllTips() fetch.
  return { ...aggregateRows(tips, timezone), tips }
}

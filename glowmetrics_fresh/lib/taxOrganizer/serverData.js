// ============================================================
// CREATOR TAX ORGANIZER — SERVER-SIDE DATA ACCESS (Node runtime only)
// ============================================================
// Every function here takes an already-authenticated Supabase client (see
// authenticateRequest in ./serverAuth.js) whose queries are scoped by RLS
// to auth.uid() — never a service-role client, and never a client-supplied
// user_id. This mirrors app/api/upload/route.js's existing auth pattern.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const MS_PER_DAY = 24 * 60 * 60 * 1000

// ── AUTH ──────────────────────────────────────────────────────────────
// Returns { supabase, user } on success, or { errorResponse } on failure.
// The caller should `return result.errorResponse` immediately if present.
export async function authenticateRequest(req) {
  const auth = req.headers.get('Authorization')
  if (!auth) {
    return { errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const token = auth.replace('Bearer ', '')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return { errorResponse: NextResponse.json({ error: 'Invalid session' }, { status: 401 }) }
  }
  return { supabase, user }
}

// ── DATE RANGE -> PADDED UTC QUERY BOUNDS ────────────────────────────
// A local calendar date range doesn't line up with UTC. Padding by a full
// day on each side guarantees every row that could possibly localize into
// the requested range (in any real-world IANA zone, UTC-12 to UTC+14) is
// fetched — buildEarningsSummary() then applies the exact local-tz cut.
export function paddedUtcBounds(startDate, endDate) {
  if (!startDate && !endDate) return { gte: null, lte: null }
  const gte = startDate ? new Date(new Date(`${startDate}T00:00:00Z`).getTime() - MS_PER_DAY).toISOString() : null
  const lte = endDate ? new Date(new Date(`${endDate}T23:59:59.999Z`).getTime() + MS_PER_DAY).toISOString() : null
  return { gte, lte }
}

// ── FETCH RAW ROWS FOR A USER, WITHIN A PADDED DATE WINDOW ───────────
// Hard row cap protects against a single request pulling a user's entire
// multi-year ledger into memory — the UI paginates/filters by year, so a
// well-formed request should never approach this. If it's hit, the caller
// surfaces a "data too large" error rather than silently truncating.
const MAX_ROWS_PER_TABLE = 60000

export async function fetchEarningsRows(supabase, userId, { startDate, endDate } = {}) {
  const { gte, lte } = paddedUtcBounds(startDate, endDate)

  let tipsQuery = supabase.from('tips').select('id, date_time, platform, username, tip_type, tokens, usd, upload_id, tip_ref, session_id, tip_note').eq('user_id', userId)
  let paidQuery = supabase.from('paid_sessions').select('id, date_time, platform, username, session_type, tokens, usd, upload_id, session_ref').eq('user_id', userId)

  if (gte) { tipsQuery = tipsQuery.gte('date_time', gte); paidQuery = paidQuery.gte('date_time', gte) }
  if (lte) { tipsQuery = tipsQuery.lte('date_time', lte); paidQuery = paidQuery.lte('date_time', lte) }

  tipsQuery = tipsQuery.order('date_time', { ascending: true }).limit(MAX_ROWS_PER_TABLE + 1)
  paidQuery = paidQuery.order('date_time', { ascending: true }).limit(MAX_ROWS_PER_TABLE + 1)

  const [tipsRes, paidRes] = await Promise.all([tipsQuery, paidQuery])
  if (tipsRes.error) throw new Error('Failed to load tips')
  if (paidRes.error) throw new Error('Failed to load paid sessions')

  const tipsRows = tipsRes.data || []
  const paidSessionRows = paidRes.data || []

  const tooLarge = tipsRows.length > MAX_ROWS_PER_TABLE || paidSessionRows.length > MAX_ROWS_PER_TABLE
  return {
    tipsRows: tipsRows.slice(0, MAX_ROWS_PER_TABLE),
    paidSessionRows: paidSessionRows.slice(0, MAX_ROWS_PER_TABLE),
    tooLarge,
  }
}

// ── AVAILABLE TAX YEARS ───────────────────────────────────────────────
// Cheap min/max lookups (indexed, single-row results) rather than pulling
// the whole ledger just to know which years have any data at all.
export async function getAvailableYearRange(supabase, userId) {
  const earliestQueries = [
    supabase.from('tips').select('date_time').eq('user_id', userId).order('date_time', { ascending: true }).limit(1),
    supabase.from('paid_sessions').select('date_time').eq('user_id', userId).order('date_time', { ascending: true }).limit(1),
  ]
  const latestQueries = [
    supabase.from('tips').select('date_time').eq('user_id', userId).order('date_time', { ascending: false }).limit(1),
    supabase.from('paid_sessions').select('date_time').eq('user_id', userId).order('date_time', { ascending: false }).limit(1),
  ]
  const [earliestResults, latestResults] = await Promise.all([
    Promise.all(earliestQueries),
    Promise.all(latestQueries),
  ])

  const dates = []
  for (const res of [...earliestResults, ...latestResults]) {
    if (res.error) continue
    const row = res.data && res.data[0]
    if (row?.date_time) dates.push(new Date(row.date_time))
  }
  if (dates.length === 0) return { hasData: false, years: [] }

  const minYear = Math.min(...dates.map(d => d.getUTCFullYear()))
  const maxYear = Math.max(...dates.map(d => d.getUTCFullYear()))
  const years = []
  // Pad one year on each side — local timezone can shift a record's year
  // by at most one relative to its UTC year.
  for (let y = maxYear + 1; y >= minYear - 1; y--) years.push(y)
  return { hasData: true, years }
}

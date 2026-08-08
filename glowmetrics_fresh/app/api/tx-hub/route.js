import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '../../../lib/supabase-server'
import { isProPlan } from '../../../lib/plan'
import {
  mergeTransactions, attachSessionLabels, filterTransactions, sortTransactions,
  computeKpis, computePlatformBreakdown, computeEarningsBreakdown, computeTopFans,
  computeChartSeries, computeCalendar, pickGranularity, distinctPlatforms,
} from '../../../lib/txHub'

const FREE_HISTORY_DAYS = 30
const FREE_MAX_ROWS = 25
const MAX_PAGE_SIZE = 200

function startOfDay(d) { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x }
function endOfDay(d) { const x = new Date(d); x.setUTCHours(23, 59, 59, 999); return x }

export async function GET(req) {
  const supabase = createSupabaseRouteClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', user.id)
    .maybeSingle()
  const isPro = isProPlan(profile)

  const url = new URL(req.url)
  const qp = url.searchParams

  const now = new Date()
  let dateTo = qp.get('to') ? endOfDay(qp.get('to')) : endOfDay(now)
  let dateFrom = qp.get('from') ? startOfDay(qp.get('from')) : startOfDay(new Date(now.getTime() - 29 * 86400000))
  if (dateFrom > dateTo) [dateFrom, dateTo] = [dateTo, dateFrom]

  // Free plan: transaction history is capped to the most recent 30 days,
  // regardless of what range was requested (see payment-gating skill —
  // "Free users: limited transaction history").
  if (!isPro) {
    const earliestAllowed = startOfDay(new Date(now.getTime() - (FREE_HISTORY_DAYS - 1) * 86400000))
    if (dateFrom < earliestAllowed) dateFrom = earliestAllowed
    if (dateTo > endOfDay(now)) dateTo = endOfDay(now)
  }

  const rangeMs = dateTo.getTime() - dateFrom.getTime()
  const prevTo = new Date(dateFrom.getTime() - 1)
  const prevFrom = new Date(prevTo.getTime() - rangeMs)

  // Fetch current + previous period in one round trip per table by querying
  // the union window, then splitting in memory — avoids 4 separate queries.
  const fetchFrom = isPro ? prevFrom.toISOString() : dateFrom.toISOString()
  const fetchTo = dateTo.toISOString()

  const [tipsRes, paidRes] = await Promise.all([
    supabase.from('tips')
      .select('id, date_time, platform, username, tip_type, tokens, usd')
      .eq('user_id', user.id)
      .gte('date_time', fetchFrom)
      .lte('date_time', fetchTo)
      .order('date_time', { ascending: false })
      .limit(20000),
    supabase.from('paid_sessions')
      .select('id, date_time, platform, username, session_type, tokens, usd')
      .eq('user_id', user.id)
      .gte('date_time', fetchFrom)
      .lte('date_time', fetchTo)
      .order('date_time', { ascending: false })
      .limit(20000),
  ])

  if (tipsRes.error) {
    return NextResponse.json({ error: 'Failed to load transactions.' }, { status: 500 })
  }
  const tipRows = tipsRes.data || []
  // paid_sessions is treated as optional — some environments/older installs
  // may not have it; never fail the whole TX Hub because of it.
  const paidRows = paidRes.error ? [] : (paidRes.data || [])

  let allTxs = mergeTransactions(tipRows, paidRows)
  allTxs = attachSessionLabels(allTxs, tipRows)

  const inRange = (t, from, to) => {
    const d = new Date(t.dateTime)
    return d >= from && d <= to
  }
  const currentAll = allTxs.filter(t => inRange(t, dateFrom, dateTo))
  const previousAll = isPro ? allTxs.filter(t => inRange(t, prevFrom, prevTo)) : []

  const availablePlatforms = distinctPlatforms(currentAll)

  // ── Filters (search / type / amount / platform) — Pro only server-side;
  // free requests silently ignore these params rather than 403ing, so the
  // free preview always renders something sensible.
  const platform = qp.get('platform') || 'all'
  const typesParam = qp.get('types')
  const types = typesParam ? typesParam.split(',').filter(Boolean) : null
  const search = qp.get('search') || ''
  const amountMin = qp.get('amountMin') ? Number(qp.get('amountMin')) : null
  const amountMax = qp.get('amountMax') ? Number(qp.get('amountMax')) : null

  const filters = isPro
    ? { platform, types, search, amountMin, amountMax }
    : { platform: platform !== 'all' ? platform : null }

  const filteredCurrent = filterTransactions(currentAll, filters)

  const sortBy = qp.get('sortBy') || 'date'
  const sortDir = qp.get('sortDir') || 'desc'
  const sorted = sortTransactions(filteredCurrent, sortBy, sortDir)

  const requestedPageSize = Math.min(Number(qp.get('pageSize')) || 25, MAX_PAGE_SIZE)
  const pageSize = isPro ? requestedPageSize : Math.min(requestedPageSize, FREE_MAX_ROWS)
  const page = Math.max(Number(qp.get('page')) || 1, 1)
  const pageStart = (page - 1) * pageSize
  const pageRows = sorted.slice(pageStart, pageStart + pageSize)

  const kpis = computeKpis(filteredCurrent, previousAll)

  const rangeDays = Math.max(1, Math.round(rangeMs / 86400000))
  const granularity = pickGranularity(rangeDays)
  const tz = qp.get('tz') || 'UTC'

  const payload = {
    range: { from: dateFrom.toISOString(), to: dateTo.toISOString(), days: rangeDays },
    isPro,
    capabilities: {
      fullHistory: isPro,
      search: isPro,
      advancedFilters: isPro,
      export: isPro,
      platformBreakdown: isPro,
      topFans: isPro,
      earningsBreakdown: isPro,
      calendar: isPro,
      comparison: isPro,
    },
    availablePlatforms,
    kpis,
    chart: {
      granularity,
      series: computeChartSeries(filteredCurrent, granularity, tz),
    },
    transactions: {
      rows: pageRows,
      total: sorted.length,
      page,
      pageSize,
      totalUnfiltered: currentAll.length,
    },
    platformBreakdown: isPro ? computePlatformBreakdown(filteredCurrent) : [],
    topFans: isPro ? computeTopFans(filteredCurrent) : [],
    earningsBreakdown: isPro ? computeEarningsBreakdown(filteredCurrent) : [],
    calendar: isPro ? computeCalendar(filteredCurrent, tz) : [],
  }

  return NextResponse.json(payload)
}

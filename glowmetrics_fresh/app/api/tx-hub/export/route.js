import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '../../../../lib/supabase-server'
import { isProPlan } from '../../../../lib/plan'
import { mergeTransactions, attachSessionLabels, filterTransactions, sortTransactions, toCsv } from '../../../../lib/txHub'

function startOfDay(d) { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x }
function endOfDay(d) { const x = new Date(d); x.setUTCHours(23, 59, 59, 999); return x }

// CSV export is a Pro-only capability (see payment-gating skill). Enforced
// here server-side — the UI hides/disables the button, but that's not
// security, this check is.
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
  if (!isProPlan(profile)) {
    return NextResponse.json({ error: 'Export is a Creator Pro feature.', code: 'requires_pro' }, { status: 403 })
  }

  const url = new URL(req.url)
  const qp = url.searchParams

  const now = new Date()
  const dateTo = qp.get('to') ? endOfDay(qp.get('to')) : endOfDay(now)
  const dateFrom = qp.get('from') ? startOfDay(qp.get('from')) : startOfDay(new Date(now.getTime() - 29 * 86400000))

  const [tipsRes, paidRes] = await Promise.all([
    supabase.from('tips')
      .select('id, date_time, platform, username, tip_type, tokens, usd')
      .eq('user_id', user.id)
      .gte('date_time', dateFrom.toISOString())
      .lte('date_time', dateTo.toISOString())
      .limit(50000),
    supabase.from('paid_sessions')
      .select('id, date_time, platform, username, session_type, tokens, usd')
      .eq('user_id', user.id)
      .gte('date_time', dateFrom.toISOString())
      .lte('date_time', dateTo.toISOString())
      .limit(50000),
  ])

  if (tipsRes.error) {
    return NextResponse.json({ error: 'Failed to load transactions.' }, { status: 500 })
  }
  const tipRows = tipsRes.data || []
  const paidRows = paidRes.error ? [] : (paidRes.data || [])

  let txs = mergeTransactions(tipRows, paidRows)
  txs = attachSessionLabels(txs, tipRows)

  const platform = qp.get('platform') || 'all'
  const typesParam = qp.get('types')
  const types = typesParam ? typesParam.split(',').filter(Boolean) : null
  const search = qp.get('search') || ''
  const amountMin = qp.get('amountMin') ? Number(qp.get('amountMin')) : null
  const amountMax = qp.get('amountMax') ? Number(qp.get('amountMax')) : null

  txs = filterTransactions(txs, { platform, types, search, amountMin, amountMax, dateFrom, dateTo })
  txs = sortTransactions(txs, qp.get('sortBy') || 'date', qp.get('sortDir') || 'desc')

  const csv = toCsv(txs)
  const filename = `camcash-transactions_${dateFrom.toISOString().slice(0, 10)}_${dateTo.toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

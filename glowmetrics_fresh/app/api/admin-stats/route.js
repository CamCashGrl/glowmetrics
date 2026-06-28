import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET(req) {
  if (!req.headers.get('cookie')?.includes('gm_admin=')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const sb = adminClient()

  const results = await Promise.all([
    sb.from('profiles').select('*', { count:'exact', head:true }),
    sb.from('tips').select('*', { count:'exact', head:true }),
    sb.from('profiles').select('*', { count:'exact', head:true }).gte('created_at', new Date(Date.now() - 30*86400000).toISOString()),
    sb.from('tips').select('platform, tokens, usd'),
    sb.from('tips').select('date_time, usd').order('date_time', { ascending:false }).limit(500),
  ])

  const errors = results.map(r => r.error).filter(Boolean)
  if (errors.length) {
    console.error('admin-stats supabase errors:', errors.map(e => e.message))
    return NextResponse.json({ error: 'Failed to load stats. Check SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
  }

  const [
    { count: totalUsers },
    { count: totalTips },
    { count: newUsers },
    { data: platformData },
    { data: recentTips },
  ] = results

  // Platform aggregation
  const platforms = {}
  for (const r of platformData || []) {
    if (!platforms[r.platform]) platforms[r.platform] = { tokens:0, usd:0, count:0 }
    platforms[r.platform].tokens += r.tokens
    platforms[r.platform].usd    = +(platforms[r.platform].usd + r.usd).toFixed(2)
    platforms[r.platform].count++
  }

  // Daily totals for last 30 days (no user info)
  const daily = {}
  for (const r of recentTips || []) {
    const d = r.date_time.slice(0,10)
    daily[d] = daily[d] || { date:d, usd:0, count:0 }
    daily[d].usd   = +(daily[d].usd + r.usd).toFixed(2)
    daily[d].count++
  }

  return NextResponse.json({
    totalUsers: totalUsers || 0,
    totalTips:  totalTips  || 0,
    newUsers:   newUsers   || 0,
    platforms,
    recentActivity: Object.values(daily).sort((a,b)=>a.date<b.date?-1:1).slice(-30),
    generatedAt: new Date().toISOString(),
  })
}

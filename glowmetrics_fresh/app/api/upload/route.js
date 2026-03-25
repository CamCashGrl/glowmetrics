import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { dedupeTips, parseCSV } from '../../../lib/analytics'

export async function POST(req) {
  const auth = req.headers.get('Authorization')
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = auth.replace('Bearer ', '')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: ue } = await supabase.auth.getUser(token)
  if (ue || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const fd = await req.formData()
  const file = fd.get('file')
  const replace = fd.get('replace') === 'true'
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const rows = dedupeTips(parseCSV(await file.text())).map((row) => {
    const tokens = row.tokens || 0
    const usd = row.usd && row.usd > 0 ? row.usd : parseFloat((tokens * 0.05).toFixed(2))
    return {
      date_time: row.dateRaw || row.date_time,
      platform: row.platform || 'Unknown',
      username: row.username,
      tip_type: row.tip_type || 'Tip',
      tip_note: row.tip_note || row.message || row.note || '',
      tokens,
      usd: parseFloat(usd.toFixed(2)),
    }
  })
  if (!rows.length) return NextResponse.json({ error: 'No valid rows found. Check CSV format.' }, { status: 400 })

  if (replace) await supabase.from('tips').delete().eq('user_id', user.id)

  let inserted = 0
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500).map(r => ({ ...r, user_id: user.id }))
    const { error } = await supabase.from('tips').insert(batch)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    inserted += batch.length
  }

  return NextResponse.json({ ok: true, inserted, total: rows.length })
}

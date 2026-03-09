import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].match(/(".*?"|[^,]+)(?=,|$)/g) || []
    const obj = {}
    headers.forEach((h, j) => { obj[h] = (vals[j] || '').replace(/"/g, '').trim() })
    if (obj.date_time && obj.username && obj.tokens) {
      const tokens = parseInt(obj.tokens)
      const usd = parseFloat(obj.usd) || tokens * 0.05
      if (tokens > 0) rows.push({
        date_time: new Date(obj.date_time).toISOString(),
        platform: obj.platform || 'Chaturbate',
        username: obj.username,
        tip_type: obj.tip_type || 'Tip',
        tokens, usd: parseFloat(usd.toFixed(2)),
      })
    }
  }
  return rows
}

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

  const rows = parseCSV(await file.text())
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

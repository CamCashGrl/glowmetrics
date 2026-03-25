import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { dedupeTips, parseCSV } from '../../../lib/analytics'

export async function POST(req) {
  const auth = req.headers.get('Authorization')
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = auth.replace('Bearer ', '')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: ue } = await supabase.auth.getUser(token)

  if (ue || !user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const fd = await req.formData()
  const file = fd.get('file')
  const replace = fd.get('replace') === 'true'

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  // 🔥 PARSE + NORMALIZE
  const raw = await file.text()
  const parsed = parseCSV(raw)

  const deduped = dedupeTips(parsed)

  const rows = deduped.map((row) => {
    const tokens = Number(row.tokens) || 0

    // SINGLE SOURCE OF TRUTH
    const usd = tokens > 0
      ? parseFloat((tokens * 0.05).toFixed(2))
      : Number(row.usd) || 0

    return {
      date_time: row.dateRaw || row.date_time || null,
      platform: row.platform || 'Unknown',
      username: row.username || 'Unknown',

      tip_type: row.tip_type || 'Tip',

      // normalize notes safely
      tip_note:
        row.tip_note ||
        row.message ||
        row.note ||
        '',

      tokens,
      usd,

      user_id: user.id,
    }
  })

  if (!rows.length) {
    return NextResponse.json(
      { error: 'No valid rows found. Check CSV format.' },
      { status: 400 }
    )
  }

  // 🔥 OPTIONAL FULL REPLACE
  if (replace) {
    const { error } = await supabase
      .from('tips')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // 🔥 BATCH INSERT (SAFE)
  let inserted = 0

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)

    const { error } = await supabase
      .from('tips')
      .insert(batch)

    if (error) {
      console.error('[UPLOAD ERROR]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    inserted += batch.length
  }

  console.log('[upload] parsed rows:', parsed.length)
  console.log('[upload] deduped rows:', deduped.length)
  console.log('[upload] inserted rows:', inserted)

  return NextResponse.json({
    ok: true,
    inserted,
    total: rows.length,
  })
}

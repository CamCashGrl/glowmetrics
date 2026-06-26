import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseCSV } from '../../../lib/analytics'

const BATCH_SIZE = 250 // Safe batch size — never hit Supabase limits

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

  // ── PARSE + NORMALIZE ──────────────────────────────────────────────────
  const raw = await file.text()
  const parsed = parseCSV(raw)

  const rows = parsed.map((row) => {
    const tokens = Number(row.tokens) || 0
    const rawUsd = Number(row.usd) || 0
    const usd = rawUsd > 0
      ? parseFloat(rawUsd.toFixed(2))
      : parseFloat((tokens * 0.05).toFixed(2))

    return {
      user_id:   user.id,
      date_time: row.dateRaw || row.date_time || null,
      platform:  row.platform  || 'Unknown',
      username:  row.username  || 'Unknown',
      tip_type:  row.tip_type  || 'Tip',
      tip_note:  row.tip_note  || row.note || row.message || '',
      tokens,
      usd,
    }
  }).filter(r =>
    r.date_time &&
    r.username !== 'Unknown' &&
    (r.tokens > 0 || r.usd > 0)
  )

  if (!rows.length) {
    return NextResponse.json(
      { error: 'No valid rows found. Check CSV format.' },
      { status: 400 }
    )
  }

  // ── OPTIONAL FULL REPLACE ──────────────────────────────────────────────
  if (replace) {
    const { error } = await supabase
      .from('tips')
      .delete()
      .eq('user_id', user.id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // ── DETECT PLATFORM ─────────────────────────────────────────────────────
  // Use the most common platform from parsed rows
  const platformCounts = {}
  rows.forEach(r => {
    platformCounts[r.platform] = (platformCounts[r.platform] || 0) + 1
  })
  const detectedPlatform = Object.entries(platformCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'
  // Stamp detected platform back onto every row that has Unknown
  rows.forEach(r => { if (!r.platform || r.platform === 'Unknown') r.platform = detectedPlatform })

  // ── BATCH INSERT via dedup RPC ─────────────────────────────────────────
  let inserted = 0
  let skipped  = 0
  const errors = []
  const totalBatches = Math.ceil(rows.length / BATCH_SIZE)

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch    = rows.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1

    const { data, error } = await supabase.rpc('insert_tips_dedup', {
      tips: batch
    })

    if (error) {
      console.error(`[UPLOAD] Batch ${batchNum}/${totalBatches} error:`, error.message)
      errors.push({ batch: batchNum, error: error.message })
      continue
    }

    inserted += data?.inserted || 0
    skipped  += data?.skipped  || 0

    console.log(`[UPLOAD] Batch ${batchNum}/${totalBatches} — inserted: ${data?.inserted}, skipped: ${data?.skipped}`)
  }

  // ── LOG TO csv_uploads ─────────────────────────────────────────────────
  try {
    const dates = rows.map(r => new Date(r.date_time)).filter(d => !isNaN(d))
    const dateFrom = dates.length ? new Date(Math.min(...dates)) : null
    const dateTo   = dates.length ? new Date(Math.max(...dates)) : null

    // Build sorted array of unique "YYYY-MM" strings covered
    const monthsSet = new Set(
      dates.map(d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
    )
    const monthsCovered = [...monthsSet].sort()

    const totalUsd = rows.reduce((sum, r) => sum + (r.usd || 0), 0)
    const totalTokens = rows.reduce((sum, r) => sum + (r.tokens || 0), 0)

    await supabase.from('csv_uploads').insert({
      user_id:        user.id,
      upload_ref:     crypto.randomUUID(),
      platform:       detectedPlatform,
      file_name:      file.name || 'upload.csv',
      date_from:      dateFrom,
      date_to:        dateTo,
      months_covered: monthsCovered,
      total_rows:     rows.length,
      inserted_rows:  inserted,
      skipped_rows:   skipped,
      total_usd:      parseFloat(totalUsd.toFixed(2)),
      total_tokens:   totalTokens,
      status:         errors.length > 0 ? 'partial' : 'complete',
    })
    console.log(`[UPLOAD] Logged csv_upload record for ${detectedPlatform} — ${monthsCovered.length} months covered`)
  } catch (logErr) {
    // Non-fatal — don't fail the whole upload if logging fails
    console.warn('[UPLOAD] Failed to log csv_upload record:', logErr.message)
  }

  // ── RESPONSE ───────────────────────────────────────────────────────────
  const response = {
    ok:        errors.length === 0,
    inserted,
    skipped,
    total:     rows.length,
    batches:   totalBatches,
    batchSize: BATCH_SIZE,
    platform:  detectedPlatform, // ← used by dashboard toast
  }

  if (errors.length > 0) {
    response.warnings = errors
    response.message  = `${errors.length} batch(es) had errors but upload continued. ${inserted} of ${rows.length} rows inserted.`
    console.warn('[UPLOAD] Completed with errors:', errors)
  } else {
    response.message = `All ${inserted} tips inserted successfully (${skipped} duplicates skipped).`
    console.log('[UPLOAD] Complete:', response.message)
  }

  // ── FOUNDER NOTIFICATION (non-blocking) ───────────────────────────────
  if (errors.length === 0) {
    try {
      const origin = new URL(req.url).origin
      fetch(`${origin}/api/notify/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          platform: detectedPlatform,
          tip_count: inserted,
          user_id: user.id,
        }),
      }).catch(err => console.error('[upload] notify failed:', err.message))
    } catch (_) {}
  }

  return NextResponse.json(response)
}

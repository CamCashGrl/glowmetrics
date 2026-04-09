import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseCSV } from '../../../lib/analytics'

const BATCH_SIZE = 250

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
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  // ── PARSE ────────────────────────────────────────────────────────────────
  const raw = await file.text()
  const parsed = parseCSV(raw)

  const rows = parsed.map((row) => {
    const tokens = Number(row.tokens) || 0
    const rawUsd = Number(row.usd) || 0
    // Use real USD from CSV first — never override BongaCams actual payout values
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

  // ── OPTIONAL FULL REPLACE ────────────────────────────────────────────────
  if (replace) {
    const { error } = await supabase
      .from('tips')
      .delete()
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── BUILD UPLOAD METADATA ────────────────────────────────────────────────
  const dates    = rows.map(r => new Date(r.date_time)).filter(d => !isNaN(d))
  const dateFrom = new Date(Math.min(...dates))
  const dateTo   = new Date(Math.max(...dates))
  const platform = rows[0]?.platform || 'Unknown'
  const totalUsd = rows.reduce((s, r) => s + (r.usd || 0), 0)
  const totalTok = rows.reduce((s, r) => s + (r.tokens || 0), 0)

  const monthSet = new Set()
  dates.forEach(d => monthSet.add(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  ))
  const monthsCovered = [...monthSet].sort()

  // ── CREATE UPLOAD RECORD ─────────────────────────────────────────────────
  const { data: uploadRecord, error: uploadErr } = await supabase
    .from('csv_uploads')
    .insert({
      user_id:        user.id,
      upload_ref:     `${platform.substring(0, 2).toUpperCase()}-${monthsCovered[0]}-${Date.now().toString().slice(-4)}`,
      platform,
      file_name:      file.name || 'unknown.csv',
      date_from:      dateFrom.toISOString(),
      date_to:        dateTo.toISOString(),
      months_covered: monthsCovered,
      total_rows:     rows.length,
      total_usd:      parseFloat(totalUsd.toFixed(2)),
      total_tokens:   totalTok,
      status:         'processing',
    })
    .select()
    .single()

  if (uploadErr) {
    console.error('[UPLOAD] Failed to create upload record:', uploadErr.message)
    // Don't block the upload if tracking fails — continue anyway
  }

  const uploadId = uploadRecord?.id || null

  // ── BATCH INSERT via dedup RPC ───────────────────────────────────────────
  // Sends ALL batches — never stops early on error
  // insert_tips_dedup handles:
  //   1. Dedup WITHIN batch (DISTINCT ON)
  //   2. Skips rows already in DB (ON CONFLICT DO NOTHING)
  //   3. Never crashes on duplicates

  let inserted = 0
  let skipped  = 0
  const errors = []
  const totalBatches = Math.ceil(rows.length / BATCH_SIZE)

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch    = rows.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1

    const { data, error } = await supabase.rpc('insert_tips_dedup', {
      tips:        batch,
      p_upload_id: uploadId,
    })

    if (error) {
      console.error(`[UPLOAD] Batch ${batchNum}/${totalBatches} error:`, error.message)
      errors.push({ batch: batchNum, error: error.message })
      continue // ← NEVER return early — always finish every batch
    }

    inserted += data?.inserted || 0
    skipped  += data?.skipped  || 0
    console.log(`[UPLOAD] Batch ${batchNum}/${totalBatches} — inserted: ${data?.inserted}, skipped: ${data?.skipped}`)
  }

  // ── FINALIZE UPLOAD RECORD ───────────────────────────────────────────────
  if (uploadId) {
    await supabase
      .from('csv_uploads')
      .update({
        inserted_rows: inserted,
        skipped_rows:  skipped,
        status:        errors.length > 0 ? 'partial' : 'complete',
      })
      .eq('id', uploadId)
  }

  // ── RESPONSE — always full report, never silent ──────────────────────────
  return NextResponse.json({
    ok:             errors.length === 0,
    upload_id:      uploadId,
    upload_ref:     uploadRecord?.upload_ref,
    platform,
    months_covered: monthsCovered,
    date_from:      dateFrom.toISOString(),
    date_to:        dateTo.toISOString(),
    inserted,
    skipped,
    total:          rows.length,
    batches:        totalBatches,
    message:        errors.length > 0
      ? `${errors.length} batch(es) had errors. ${inserted} of ${rows.length} rows inserted.`
      : `All ${inserted} tips inserted (${skipped} duplicates skipped).`,
    ...(errors.length > 0 && { warnings: errors }),
  })
}

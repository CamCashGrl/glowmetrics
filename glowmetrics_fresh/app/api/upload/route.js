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
    // Use actual USD from CSV if present — do NOT override with token math
    // if the platform provides real USD values (BongaCams does)
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

  // ── BATCH INSERT via dedup RPC ─────────────────────────────────────────
  // Uses insert_tips_dedup RPC which:
  //   1. Deduplicates WITHIN each batch (DISTINCT ON)
  //   2. Skips rows already in DB (ON CONFLICT DO NOTHING)
  //   3. Never crashes on duplicates — silently skips them
  //
  // CRITICAL: ALL batches are sent regardless of individual results.
  // A skipped-duplicate batch is NOT an error — it's expected behavior.
  // We only log real DB errors and continue to the next batch.

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
      // Log but KEEP GOING — never abandon remaining batches
      console.error(`[UPLOAD] Batch ${batchNum}/${totalBatches} error:`, error.message)
      errors.push({ batch: batchNum, error: error.message })
      continue // ← always finish all batches
    }

    inserted += data?.inserted || 0
    skipped  += data?.skipped  || 0

    console.log(`[UPLOAD] Batch ${batchNum}/${totalBatches} — inserted: ${data?.inserted}, skipped: ${data?.skipped}`)
  }

  // ── RESPONSE ───────────────────────────────────────────────────────────
  const response = {
    ok:        errors.length === 0,
    inserted,
    skipped,
    total:     rows.length,
    batches:   totalBatches,
    batchSize: BATCH_SIZE,
  }

  if (errors.length > 0) {
    response.warnings = errors
    response.message  = `${errors.length} batch(es) had errors but upload continued. ${inserted} of ${rows.length} rows inserted.`
    console.warn('[UPLOAD] Completed with errors:', errors)
  } else {
    response.message = `All ${inserted} tips inserted successfully (${skipped} duplicates skipped).`
    console.log('[UPLOAD] Complete:', response.message)
  }

  return NextResponse.json(response)
}

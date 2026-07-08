import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseCSV, detectPlatform } from '../../../lib/analytics'

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
  // Prefer the platform the user explicitly selected in the UI — text-based
  // detection is a fallback for callers that don't pass one, and can't find
  // any platform keywords in a clean, already-normalized CSV (e.g. the
  // onboarding paste flow, which sends parsed rows rather than raw text).
  const explicitPlatform = (fd.get('platform') || '').toString().trim()
  const textDetectedPlatform = explicitPlatform || detectPlatform(raw)
  const parsed = parseCSV(raw)

  const rows = parsed.map((row) => {
    const tokens = Number(row.tokens) || 0
    const usd = parseFloat((Number(row.usd) || 0).toFixed(2))

    return {
      user_id:   user.id,
      date_time: row.dateRaw || row.date_time || null,
      platform:  row.platform && row.platform !== 'Unknown' ? row.platform : textDetectedPlatform,
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
  const detectedPlatform = textDetectedPlatform
  rows.forEach(r => { if (!r.platform || r.platform === 'Unknown') r.platform = detectedPlatform })

  // ── ASSIGN DEDUP SEQUENCE ACROSS THE WHOLE FILE ─────────────────────────
  // Two rows can legitimately share the same (user, username, tokens, usd,
  // date_time) — e.g. the same fan tipping the same amount at the same
  // recorded minute — and insert_tips_dedup relies on tip_seq to tell them
  // apart instead of dropping the second one as a duplicate. That sequence
  // has to be assigned here, over the full file, rather than inside the RPC:
  // the RPC is called once per BATCH_SIZE-row chunk below, so a duplicate-key
  // group split across a batch boundary would otherwise get renumbered from 1
  // in the second batch and collide with the first batch's already-inserted
  // rows, silently dropping real tips.
  const dedupSeq = new Map()
  rows.forEach(r => {
    const key = `${r.user_id}|${r.username.toLowerCase()}|${r.tokens}|${r.usd.toFixed(2)}|${r.date_time}`
    const next = (dedupSeq.get(key) || 0) + 1
    dedupSeq.set(key, next)
    r.tip_seq = next
  })

  // ── LOG TO csv_uploads ─────────────────────────────────────────────────
  // Shared by the success path below and the platform-limit block path, so a
  // blocked attempt still leaves an audit row instead of vanishing entirely.
  const logCsvUpload = async (status) => {
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
        status,
      })
      console.log(`[UPLOAD] Logged csv_upload record (${status}) for ${detectedPlatform} — ${monthsCovered.length} months covered`)
    } catch (logErr) {
      // Non-fatal — don't fail the whole upload if logging fails
      console.warn('[UPLOAD] Failed to log csv_upload record:', logErr.message)
    }
  }

  // ── BUMP beta_users.csv_upload_count ────────────────────────────────────
  // Only counts uploads that actually landed rows — a request that inserted
  // nothing (all duplicates, or blocked before any batch succeeded) isn't a
  // real upload event.
  const bumpCsvUploadCount = async () => {
    if (inserted <= 0) return
    try {
      const { data: betaRow } = await supabase.from('beta_users').select('csv_upload_count').eq('user_id', user.id).maybeSingle()
      await supabase.from('beta_users').upsert({
        user_id: user.id,
        email: user.email,
        csv_upload_count: (betaRow?.csv_upload_count || 0) + 1,
      }, { onConflict: 'user_id' })
    } catch (bumpErr) {
      // Non-fatal — don't fail the whole upload if this counter update fails
      console.warn('[UPLOAD] Failed to bump csv_upload_count:', bumpErr.message)
    }
  }

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

    // insert_tips_dedup catches its own exceptions and returns them inside the
    // jsonb payload (data.error) rather than as a PostgREST-level error, so a
    // failed batch can otherwise look like a clean { inserted: 0, skipped: 0 }.
    if (error || data?.error) {
      const message = error?.message || data?.error
      console.error(`[UPLOAD] Batch ${batchNum}/${totalBatches} error:`, message)

      if (message?.includes('PLATFORM_LIMIT_REACHED')) {
        // Log the attempt — including any rows earlier batches in this same
        // request already inserted — before returning. Without this, a
        // correctly-rejected upload leaves zero trace in csv_uploads,
        // indistinguishable from a request that never ran at all.
        await logCsvUpload('blocked')
        await bumpCsvUploadCount()
        return NextResponse.json({
          error: `You're on the free plan, which tracks one platform. Upgrade to add ${detectedPlatform} alongside your existing platform data.`,
          code: 'platform_limit_reached',
          upgradeUrl: '/pricing',
        }, { status: 402 })
      }

      errors.push({ batch: batchNum, error: message })
      continue
    }

    inserted += data?.inserted || 0
    skipped  += data?.skipped  || 0

    console.log(`[UPLOAD] Batch ${batchNum}/${totalBatches} — inserted: ${data?.inserted}, skipped: ${data?.skipped}`)
  }

  await logCsvUpload(errors.length > 0 ? 'partial' : 'complete')
  await bumpCsvUploadCount()

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

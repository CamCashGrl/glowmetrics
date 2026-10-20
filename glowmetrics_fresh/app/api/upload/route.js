import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseCSV, detectPlatform, detectDateOrder, computeSnapshotStats } from '../../../lib/analytics'
import { platformLimitMessage } from '../../../lib/planLimits'
import { canonicalPlatform, PLATFORM_TOKEN_RATES } from '../../../lib/constants'

const KNOWN_PLATFORMS = Object.keys(PLATFORM_TOKEN_RATES)
import { analyzeFormat } from '../../../lib/parseTracking'

const BATCH_SIZE = 250 // Safe batch size — never hit Supabase limits
const LIVE_DEDUP_PAGE_SIZE = 1000

function minuteBucket(value) {
  const ms = new Date(value).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.floor(ms / 60000)
}

function crossSourceTipKey(row) {
  const bucket = minuteBucket(row.date_time)
  if (bucket === null) return null
  const platform = canonicalPlatform(row.platform || 'Unknown') || 'Unknown'
  const username = String(row.username || '').trim().toLowerCase().replace(/^@+/, '')
  const tokens = Number(row.tokens) || 0
  // Tokens are the stable cross-source amount for supported cam platforms.
  // Keep USD out of this key because historical rows can carry slightly
  // different rounded USD values after token-rate fixes while still
  // representing the exact same real tip.
  return `${platform.toLowerCase()}|${username}|${tokens}|${bucket}`
}

async function loadExistingLiveTipCounts(supabase, userId, tipRows) {
  if (!tipRows.length) return new Map()

  const dated = tipRows
    .map((row) => new Date(row.date_time))
    .filter((d) => Number.isFinite(d.getTime()))
  if (!dated.length) return new Map()

  // Give the query one minute of padding on each side so a second-level Live
  // timestamp and a minute-rounded CSV timestamp still land in the candidate
  // set. The final key remains exact to the UTC minute and occurrence-counted.
  const minMs = Math.min(...dated.map((d) => d.getTime())) - 60000
  const maxMs = Math.max(...dated.map((d) => d.getTime())) + 60000
  const counts = new Map()

  for (let from = 0; ; from += LIVE_DEDUP_PAGE_SIZE) {
    const to = from + LIVE_DEDUP_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('tips')
      .select('platform,username,tokens,date_time,source')
      .eq('user_id', userId)
      .eq('source', 'extension')
      .gte('date_time', new Date(minMs).toISOString())
      .lte('date_time', new Date(maxMs).toISOString())
      .order('date_time', { ascending: true })
      .range(from, to)

    if (error) {
      // Dedup lookup failure must never make the upload destructive or silently
      // discard rows. Fall back to the existing exact insert_tips_dedup RPC and
      // surface a server log so we can investigate.
      console.error('[UPLOAD] Live-tip reconciliation lookup failed:', error.message)
      return new Map()
    }

    for (const row of data || []) {
      const key = crossSourceTipKey(row)
      if (!key) continue
      const bucket = counts.get(key) || { remaining: 0, exact: new Map() }
      const instant = new Date(row.date_time).getTime()
      bucket.remaining++
      bucket.exact.set(instant, (bucket.exact.get(instant) || 0) + 1)
      counts.set(key, bucket)
    }

    if (!data || data.length < LIVE_DEDUP_PAGE_SIZE) break
  }

  return counts
}

function reconcileCsvAgainstLiveTips(tipRows, liveCounts) {
  if (!tipRows.length || !liveCounts.size) {
    return { rows: tipRows, skipped: 0 }
  }

  const rows = []
  let skipped = 0

  // Reserve exact timestamp matches before using minute-rounded matches.
  // Otherwise an earlier, distinct CSV tip can consume a later Live match,
  // leaving that later CSV row to collide with the DB's exact dedupe key.
  const exactMatches = new Set()
  tipRows.forEach((row, index) => {
    const bucket = liveCounts.get(crossSourceTipKey(row))
    const instant = new Date(row.date_time).getTime()
    const remaining = bucket?.exact.get(instant) || 0
    if (remaining > 0) {
      bucket.exact.set(instant, remaining - 1)
      bucket.remaining--
      exactMatches.add(index)
    }
  })

  for (const [index, row] of tipRows.entries()) {
    const key = crossSourceTipKey(row)
    const bucket = key ? liveCounts.get(key) : null
    if (exactMatches.has(index) || bucket?.remaining > 0) {
      if (!exactMatches.has(index)) bucket.remaining--
      skipped++
      continue
    }
    rows.push(row)
  }

  return { rows, skipped }
}

// Rows are inserted in sequential BATCH_SIZE chunks, one Supabase round-trip
// each, so a large export takes far longer than Vercel's 10s default. When the
// function was killed mid-run the client received a truncated body and
// res.json() threw "Unexpected end of JSON input" — which looked like a parse
// error but was really a timeout. 60s is the Hobby-plan ceiling.
export const maxDuration = 60

// Any throw below would otherwise produce a response the client cannot parse,
// surfacing as the same misleading JSON error. Every failure path must return
// real JSON so the UI can show the actual reason.
export async function POST(req) {
  try {
    return await handleUpload(req)
  } catch (err) {
    console.error('[UPLOAD] Unhandled error:', err)
    return NextResponse.json(
      { error: err?.message || 'Upload failed unexpectedly. Please try again.' },
      { status: 500 }
    )
  }
}

async function handleUpload(req) {
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

  // ── VALIDATE FORMAT ────────────────────────────────────────────────────
  const raw = await file.text()

  // ── PARSE + NORMALIZE ──────────────────────────────────────────────────
  const explicitPlatform = canonicalPlatform((fd.get('platform') || '').toString().trim()) || ''
  if (explicitPlatform && !KNOWN_PLATFORMS.includes(explicitPlatform)) {
    return NextResponse.json({ error: `Unsupported platform: ${explicitPlatform}`, code: 'platform_required' }, { status: 400 })
  }
  const contentPlatform = detectPlatform(raw)
  let textDetectedPlatform = explicitPlatform || contentPlatform
  if (textDetectedPlatform === 'Unknown') textDetectedPlatform = detectPlatform((file.name || '').toString())
  if (!KNOWN_PLATFORMS.includes(textDetectedPlatform)) {
    return NextResponse.json({
      error: "We couldn't tell which platform this file is from. Choose the platform in the Platform menu and upload again.",
      code: 'platform_required',
    }, { status: 400 })
  }

  const fileDateOrder = detectDateOrder(raw)
  const chosenDateOrder = ['MDY', 'DMY'].includes(fd.get('date_order')) ? fd.get('date_order') : null
  if (fileDateOrder === 'conflict') {
    return NextResponse.json({
      error: 'This file mixes month-first and day-first dates, so its dates cannot be read reliably. Export it again in a single date format.',
      code: 'date_order_conflict',
    }, { status: 400 })
  }
  if (fileDateOrder === 'ambiguous' && !chosenDateOrder) {
    return NextResponse.json({
      error: 'Every date in this file could be month-first or day-first (e.g. 06/11/2024). Choose the date format and upload again.',
      code: 'date_order_required',
    }, { status: 400 })
  }
  if (chosenDateOrder && (fileDateOrder === 'MDY' || fileDateOrder === 'DMY') && chosenDateOrder !== fileDateOrder) {
    return NextResponse.json({
      error: `The dates in this file are ${fileDateOrder === 'DMY' ? 'day-first (DD/MM/YYYY)' : 'month-first (MM/DD/YYYY)'}, which does not match the format you chose.`,
      code: 'date_order_mismatch',
    }, { status: 400 })
  }
  const dateOrder = fileDateOrder === 'ambiguous' ? chosenDateOrder : (fileDateOrder || null)

  const parsed = parseCSV(raw, contentPlatform !== 'Unknown' ? contentPlatform : textDetectedPlatform, { dateOrder })

  const formatAnalysis = analyzeFormat(raw)
  try {
    await supabase.rpc('log_paste_parse_attempt', {
      p_user_id: user.id,
      p_source: 'dashboard',
      p_attempted_platform: textDetectedPlatform,
      p_claimed_platform: explicitPlatform || null,
      p_supported: ['Chaturbate', 'BongaCams', 'MyFreeCams'].includes(textDetectedPlatform),
      p_raw_text: raw.substring(0, 500),
      p_line_count: formatAnalysis.line_count || null,
      p_has_tabs: formatAnalysis.has_tabs || null,
      p_has_commas: formatAnalysis.has_commas || null,
      p_top_shapes: formatAnalysis.top_shapes || null,
      p_parse_success: parsed.length > 0,
      p_error_reason: parsed.length > 0 ? null : 'CSV parsing returned no rows',
      p_error_details: formatAnalysis,
    })
  } catch (err) {
    console.error('Failed to log parse attempt:', err)
  }

  const rows = parsed.map((row) => {
    const tokens = Number(row.tokens) || 0
    const usd = parseFloat((Number(row.usd) || 0).toFixed(2))

    return {
      user_id: user.id,
      date_time: row.dateRaw || row.date_time || null,
      platform: row.platform && row.platform !== 'Unknown' ? row.platform : textDetectedPlatform,
      username: row.username || 'Unknown',
      tip_type: row.tip_type || 'Tip',
      tip_note: row.tip_note || row.note || row.message || '',
      tokens,
      usd,
      is_paid_session: row.is_paid_session === true,
      session_type: row.session_type || null,
    }
  }).filter(r =>
    r.date_time &&
    r.username !== 'Unknown' &&
    (r.tokens > 0 || r.usd > 0)
  )

  if (!rows.length) {
    return NextResponse.json({ error: 'No valid rows found. Check CSV format.' }, { status: 400 })
  }

  // Existing legacy option. Do not expand this path; normal uploads should
  // always rely on dedup rather than destructive replacement.
  if (replace) {
    const { error } = await supabase.from('tips').delete().eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const detectedPlatform = textDetectedPlatform
  rows.forEach(r => { if (!r.platform || r.platform === 'Unknown') r.platform = detectedPlatform })
  rows.forEach(r => { r.platform = canonicalPlatform(r.platform) })
  rows.forEach(r => { if (!KNOWN_PLATFORMS.includes(r.platform)) r.platform = detectedPlatform })

  let tipRows = rows.filter(r => !r.is_paid_session)
  const paidSessionRows = rows.filter(r => r.is_paid_session)

  if ((textDetectedPlatform === 'BongaCams' || detectedPlatform === 'BongaCams') &&
      rows.length > 0 && paidSessionRows.length === 0) {
    console.warn('[UPLOAD] BongaCams detected but no paid sessions found. CSV may be missing "Chat Type" column.')
  }

  // Assign exact-key identities across the original file before reconciliation
  // removes any occurrences. Surviving rows must keep their original tip_seq.
  const dedupSeq = new Map()
  tipRows.forEach(r => {
    const key = `${r.user_id}|${r.username.toLowerCase()}|${r.tokens}|${r.usd.toFixed(2)}|${r.date_time}`
    const next = (dedupSeq.get(key) || 0) + 1
    dedupSeq.set(key, next)
    r.tip_seq = next
  })

  // ── CROSS-SOURCE LIVE MODE → CSV RECONCILIATION ────────────────────────
  // A creator may use Live Mode first and later upload the platform CSV that
  // contains the same real tips. The normal exact CSV unique key cannot always
  // catch this because Live Mode captures seconds while many exports round to
  // the minute. Match only already-persisted extension tips, one occurrence at
  // a time, by canonical platform + normalized fan + token amount + minute.
  // This preserves legitimate repeated identical tips: existing Live count 1
  // plus CSV count 2 skips exactly one and still inserts the second.
  const liveCounts = await loadExistingLiveTipCounts(supabase, user.id, tipRows)
  const reconciled = reconcileCsvAgainstLiveTips(tipRows, liveCounts)
  tipRows = reconciled.rows
  const crossSourceSkipped = reconciled.skipped
  if (crossSourceSkipped > 0) {
    console.log(`[UPLOAD] Cross-source reconciliation skipped ${crossSourceSkipped} tip(s) already captured by Live Mode`)
  }

  const summaryDates = tipRows.map(r => new Date(r.date_time)).filter(d => !isNaN(d))
  const summaryDateFrom = summaryDates.length ? new Date(Math.min(...summaryDates)) : null
  const summaryDateTo = summaryDates.length ? new Date(Math.max(...summaryDates)) : null
  const summaryTotalUsd = parseFloat(tipRows.reduce((sum, r) => sum + (r.usd || 0), 0).toFixed(2))
  const summaryTotalTokens = tipRows.reduce((sum, r) => sum + (r.tokens || 0), 0)
  const snapshot = computeSnapshotStats(
    tipRows.map(r => ({ date: r.date_time, tokens: r.tokens, usd: r.usd })),
    31
  )

  let inserted = 0
  let skipped = crossSourceSkipped
  const errors = []
  const totalBatches = Math.ceil(tipRows.length / BATCH_SIZE)
  const uploadRef = crypto.randomUUID()

  const logCsvUpload = async (status) => {
    try {
      const monthsSet = new Set(
        summaryDates.map(d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
      )
      const monthsCovered = [...monthsSet].sort()

      const { error: logInsertError } = await supabase.from('csv_uploads').insert({
        user_id: user.id,
        upload_ref: uploadRef,
        platform: detectedPlatform,
        file_name: file.name || 'upload.csv',
        date_from: summaryDateFrom,
        date_to: summaryDateTo,
        months_covered: monthsCovered,
        total_rows: tipRows.length + crossSourceSkipped,
        inserted_rows: inserted,
        skipped_rows: skipped,
        total_usd: summaryTotalUsd,
        total_tokens: summaryTotalTokens,
        status,
      })
      if (logInsertError) {
        console.error('[UPLOAD] Failed to log csv_upload record:', logInsertError.message)
      } else {
        console.log(`[UPLOAD] Logged csv_upload record (${status}) for ${detectedPlatform} — ${monthsCovered.length} months covered`)
      }
    } catch (logErr) {
      console.error('[UPLOAD] Failed to log csv_upload record:', logErr.message)
    }
  }

  for (let i = 0; i < tipRows.length; i += BATCH_SIZE) {
    const batch = tipRows.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1

    const { data, error } = await supabase.rpc('insert_tips_dedup', { tips: batch })

    if (error || data?.error) {
      const message = error?.message || data?.error
      console.error(`[UPLOAD] Batch ${batchNum}/${totalBatches} error:`, message)

      if (message?.includes('PLATFORM_LIMIT_REACHED')) {
        await logCsvUpload('blocked')
        return NextResponse.json({
          error: platformLimitMessage(),
          code: 'platform_limit_reached',
          upgradeUrl: '/pricing',
        }, { status: 402 })
      }

      errors.push({ batch: batchNum, error: message })
      continue
    }

    inserted += data?.inserted || 0
    skipped += data?.skipped || 0
    console.log(`[UPLOAD] Batch ${batchNum}/${totalBatches} — inserted: ${data?.inserted}, skipped: ${data?.skipped}`)
  }

  if (inserted > 0) {
    try {
      const { data: validationResult, error: validationError } = await supabase.rpc(
        'validate_imported_tips',
        { p_user_id: user.id }
      )
      if (validationError) {
        console.warn('[UPLOAD] Data validation RPC failed:', validationError.message)
      } else if (validationResult?.violation_count > 0) {
        console.log(`[UPLOAD] Validation found ${validationResult.violation_count} issues:`, validationResult.violations)
      }
    } catch (validationErr) {
      console.warn('[UPLOAD] Data validation error:', validationErr.message)
    }
  }

  await logCsvUpload(errors.length > 0 ? 'partial' : 'complete')

  let paidInserted = 0
  let paidSkipped = 0
  const paidErrors = []
  const paidTotalBatches = Math.ceil(paidSessionRows.length / BATCH_SIZE)

  for (let i = 0; i < paidSessionRows.length; i += BATCH_SIZE) {
    const batch = paidSessionRows.slice(i, i + BATCH_SIZE).map(r => ({
      user_id: r.user_id,
      date_time: r.date_time,
      platform: r.platform,
      username: r.username,
      session_type: r.session_type,
      tokens: r.tokens,
      usd: r.usd,
    }))
    const batchNum = Math.floor(i / BATCH_SIZE) + 1

    const { data, error } = await supabase.rpc('insert_paid_sessions_dedup', { sessions: batch })

    if (error) {
      console.error(`[UPLOAD] Paid-session batch ${batchNum}/${paidTotalBatches} error:`, error.message)
      if (error.message?.includes('PLATFORM_LIMIT_REACHED')) {
        return NextResponse.json({
          error: platformLimitMessage(),
          code: 'platform_limit_reached',
          upgradeUrl: '/pricing',
        }, { status: 402 })
      }
      paidErrors.push({ batch: batchNum, error: error.message })
      continue
    }

    paidInserted += data?.inserted || 0
    paidSkipped += data?.skipped || 0
    console.log(`[UPLOAD] Paid-session batch ${batchNum}/${paidTotalBatches} — inserted: ${data?.inserted}, skipped: ${data?.skipped}`)
  }

  const response = {
    ok: errors.length === 0,
    inserted,
    skipped,
    crossSourceSkipped,
    total: tipRows.length + crossSourceSkipped,
    batches: totalBatches,
    batchSize: BATCH_SIZE,
    platform: detectedPlatform,
    totalUsd: summaryTotalUsd,
    dateFrom: summaryDateFrom ? summaryDateFrom.toISOString() : null,
    dateTo: summaryDateTo ? summaryDateTo.toISOString() : null,
    paidSessionsInserted: paidInserted,
    paidSessionsSkipped: paidSkipped,
    snapshot,
  }

  if (errors.length > 0) {
    response.warnings = errors
    response.message = `${errors.length} batch(es) had errors but upload continued. ${inserted} new tips inserted; ${skipped} duplicates/already-captured tips skipped.`
    console.warn('[UPLOAD] Completed with errors:', errors)
  } else {
    response.message = `${inserted} new tips inserted successfully (${skipped} duplicates/already-captured tips skipped).`
    console.log('[UPLOAD] Complete:', response.message)
  }

  if (paidErrors.length > 0) {
    response.paidSessionsWarnings = paidErrors
    console.warn('[UPLOAD] Paid-session batches completed with errors:', paidErrors)
  }

  if (detectedPlatform === 'BongaCams' && paidSessionRows.length === 0 && tipRows.length > 0) {
    response.bongaCamsWarning = 'No private/group/spy sessions detected. If your BongaCams export includes private chat sessions, verify it contains a session-type column (e.g., "Chat Type", "Session Type", "Activity Type").'
    console.warn('[UPLOAD] BongaCams detected but no paid sessions found. CSV may be missing a session-type column.')
  }

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

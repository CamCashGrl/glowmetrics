import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseCSV, detectPlatform } from '../../../lib/analytics'
import { FREE_MAX_PLATFORMS, isPaidPlan, normalizePlatform, splitFreeHistory, splitFreePlatforms, summarizeRows } from '../../../lib/planLimits'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .maybeSingle()
  const isPro = isPaidPlan(profile?.plan)

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
      // Private-chat/spy-mode/group-chat rows (any of the 3 platforms) are
      // flagged by parseCSV() (see lib/analytics.js's
      // PAID_SESSION_TYPE_PATTERNS/detectPaidSessionType) so they can be
      // routed to paid_sessions below instead of tips.
      is_paid_session: row.is_paid_session === true,
      session_type:    row.session_type || null,
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

  // ── DETECT PLATFORM ─────────────────────────────────────────────────────
  // Resolved up front (moved from later in the file) so every row.platform
  // is final before the Free-plan classification below runs on it.
  const detectedPlatform = textDetectedPlatform
  rows.forEach(r => { if (!r.platform || r.platform === 'Unknown') r.platform = detectedPlatform })

  // ── FREE-PLAN IMPORT BOUNDARIES ────────────────────────────────────────
  // Free can track up to 3 platforms and a 31-day analytics history window.
  // IMPORTANT: this is a classification step, not a rejection step. Every
  // row from the uploaded file gets imported — the CSV itself is never
  // partially or fully thrown out because parts of it fall outside what
  // Free can currently show. Rows outside Free's boundaries are summarized
  // (real numbers, computed from this exact file) and returned to the
  // dashboard as a locked preview, instead of a 402 that discards them.
  let existingPlatformRows = []
  try {
    const [tipPlatforms, livePlatforms, paidPlatforms] = await Promise.all([
      supabase.from('tips').select('platform').eq('user_id', user.id),
      supabase.from('live_tips').select('platform').eq('user_id', user.id),
      supabase.from('paid_sessions').select('platform').eq('user_id', user.id),
    ])
    existingPlatformRows = [
      ...(tipPlatforms.data || []),
      ...(livePlatforms.data || []),
      ...(paidPlatforms.data || []),
    ]
  } catch (_) {}

  const existingPlatforms = [...new Set(
    existingPlatformRows.map(r => normalizePlatform(r.platform)).filter(Boolean)
  )]
  const incomingPlatforms = [...new Set(
    rows.map(r => normalizePlatform(r.platform || detectedPlatform)).filter(Boolean)
  )]
  const combinedPlatforms = [...new Set([...existingPlatforms, ...incomingPlatforms])]

  const originalRowCount = rows.length
  let historyRemovedCount = 0
  let historyWindowStart = null
  let historyWindowEnd = null
  let excludedHistory = null
  let excludedPlatforms = []
  let platformsTracked = combinedPlatforms

  if (!isPro) {
    // Platform cap: classify, don't reject. Rows for platforms beyond the
    // Free cap are pulled out (and summarized below) rather than sent to
    // insert_tips_dedup, since that RPC enforces the same cap at the DB
    // level — pre-filtering here avoids a batch failing there.
    const platformSplit = splitFreePlatforms(rows, existingPlatforms)
    platformsTracked = platformSplit.allowedPlatforms

    if (platformSplit.excluded.length) {
      const byPlatform = new Map()
      for (const row of platformSplit.excluded) {
        const key = normalizePlatform(row.platform) || 'unknown'
        if (!byPlatform.has(key)) byPlatform.set(key, [])
        byPlatform.get(key).push(row)
      }
      excludedPlatforms = [...byPlatform.entries()].map(([platform, platformRows]) => ({
        platform,
        ...summarizeRows(platformRows),
      }))
    }

    // History window: same principle — classify the platform-allowed rows,
    // don't drop the file to zero just because all of it is older than 31
    // days. `rows` becomes only the Free-visible half for insertion below;
    // the excluded half is summarized for the locked preview.
    const historySplit = splitFreeHistory(platformSplit.visible)
    rows.splice(0, rows.length, ...historySplit.visible)
    historyRemovedCount = historySplit.excluded.length
    historyWindowStart = historySplit.windowStart
    historyWindowEnd = historySplit.windowEnd
    if (historySplit.excluded.length) {
      excludedHistory = summarizeRows(historySplit.excluded)
    }
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

  // ── SPLIT TIPS FROM PAID CHAT / SPY-MODE SESSIONS ───────────────────────
  // Paid-chat/spy-mode rows (flagged above) never go into tips — they go to
  // paid_sessions via insert_paid_sessions_dedup, same as the onboarding
  // paste flow's separate /api/upload-paid-sessions call. Keeping the split
  // here (rather than filtering in lib/analytics.js) lets parseCSV() keep
  // returning one flat array, which app/dashboard/page.js's own parseCSV
  // caller still relies on.
  const tipRows = rows.filter(r => !r.is_paid_session)
  const paidSessionRows = rows.filter(r => r.is_paid_session)

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
  // Only tipRows get a tip_seq — insert_paid_sessions_dedup has no client_seq
  // concept (it dedups per-row against paid_sessions_dedup_unique instead).
  const dedupSeq = new Map()
  tipRows.forEach(r => {
    const key = `${r.user_id}|${r.username.toLowerCase()}|${r.tokens}|${r.usd.toFixed(2)}|${r.date_time}`
    const next = (dedupSeq.get(key) || 0) + 1
    dedupSeq.set(key, next)
    r.tip_seq = next
  })

  // ── SUMMARY STATS ────────────────────────────────────────────────────────
  // Computed once, shared by the csv_uploads audit log and the JSON response
  // (the response uses these so the importer UI can show a real summary —
  // rows/earnings/platform/date range — instead of just a row count).
  // Tip-only, same as csv_uploads' columns (which log the tip import, not
  // paid sessions) and the response fields the importer UI already reads.
  const summaryDates = tipRows.map(r => new Date(r.date_time)).filter(d => !isNaN(d))
  const summaryDateFrom = summaryDates.length ? new Date(Math.min(...summaryDates)) : null
  const summaryDateTo   = summaryDates.length ? new Date(Math.max(...summaryDates)) : null
  const summaryTotalUsd = parseFloat(tipRows.reduce((sum, r) => sum + (r.usd || 0), 0).toFixed(2))
  const summaryTotalTokens = tipRows.reduce((sum, r) => sum + (r.tokens || 0), 0)

  // ── LOG TO csv_uploads ─────────────────────────────────────────────────
  // Shared by the success path below and the platform-limit block path, so a
  // blocked attempt still leaves an audit row instead of vanishing entirely.
  const logCsvUpload = async (status) => {
    try {
      // Build sorted array of unique "YYYY-MM" strings covered
      const monthsSet = new Set(
        summaryDates.map(d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
      )
      const monthsCovered = [...monthsSet].sort()

      await supabase.from('csv_uploads').insert({
        user_id:        user.id,
        upload_ref:     crypto.randomUUID(),
        platform:       detectedPlatform,
        file_name:      file.name || 'upload.csv',
        date_from:      summaryDateFrom,
        date_to:        summaryDateTo,
        months_covered: monthsCovered,
        total_rows:     tipRows.length,
        inserted_rows:  inserted,
        skipped_rows:   skipped,
        total_usd:      summaryTotalUsd,
        total_tokens:   summaryTotalTokens,
        status,
      })
      console.log(`[UPLOAD] Logged csv_upload record (${status}) for ${detectedPlatform} — ${monthsCovered.length} months covered`)
    } catch (logErr) {
      // Non-fatal — don't fail the whole upload if logging fails
      console.warn('[UPLOAD] Failed to log csv_upload record:', logErr.message)
    }
  }

  // ── BATCH INSERT via dedup RPC ─────────────────────────────────────────
  let inserted = 0
  let skipped  = 0
  const errors = []
  const totalBatches = Math.ceil(tipRows.length / BATCH_SIZE)

  for (let i = 0; i < tipRows.length; i += BATCH_SIZE) {
    const batch    = tipRows.slice(i, i + BATCH_SIZE)
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
        return NextResponse.json({
          error: `You're on the free plan, which tracks up to ${FREE_MAX_PLATFORMS} platforms. Upgrade to add more platforms and compare them.`,
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

  // ── BATCH INSERT PAID CHAT / SPY-MODE SESSIONS ──────────────────────────
  // Same RPC the onboarding paste flow's /api/upload-paid-sessions uses, so
  // rows flagged by parseCSV() (detectPaidSessionType, lib/analytics.js) land
  // in paid_sessions instead of tips regardless of which import path sent them.
  let paidInserted = 0
  let paidSkipped  = 0
  const paidErrors = []
  const paidTotalBatches = Math.ceil(paidSessionRows.length / BATCH_SIZE)

  for (let i = 0; i < paidSessionRows.length; i += BATCH_SIZE) {
    const batch = paidSessionRows.slice(i, i + BATCH_SIZE).map(r => ({
      user_id:      r.user_id,
      date_time:    r.date_time,
      platform:     r.platform,
      username:     r.username,
      session_type: r.session_type,
      tokens:       r.tokens,
      usd:          r.usd,
    }))
    const batchNum = Math.floor(i / BATCH_SIZE) + 1

    const { data, error } = await supabase.rpc('insert_paid_sessions_dedup', {
      sessions: batch
    })

    if (error) {
      console.error(`[UPLOAD] Paid-session batch ${batchNum}/${paidTotalBatches} error:`, error.message)

      if (error.message?.includes('PLATFORM_LIMIT_REACHED')) {
        // Tips (if any) already inserted and logged above — this only blocks
        // the paid-session half, same as onboarding's two independent
        // requests would behave if the paid-sessions call failed on its own.
        return NextResponse.json({
          error: `You're on the free plan, which tracks up to ${FREE_MAX_PLATFORMS} platforms. Upgrade to add more platforms and compare them.`,
          code: 'platform_limit_reached',
          upgradeUrl: '/pricing',
        }, { status: 402 })
      }

      paidErrors.push({ batch: batchNum, error: error.message })
      continue
    }

    paidInserted += data?.inserted || 0
    paidSkipped  += data?.skipped  || 0

    console.log(`[UPLOAD] Paid-session batch ${batchNum}/${paidTotalBatches} — inserted: ${data?.inserted}, skipped: ${data?.skipped}`)
  }

  // ── RESPONSE ───────────────────────────────────────────────────────────
  const response = {
    ok:        errors.length === 0,
    inserted,
    skipped,
    total:     tipRows.length,
    batches:   totalBatches,
    batchSize: BATCH_SIZE,
    platform:  detectedPlatform, // ← used by dashboard toast
    totalUsd:  summaryTotalUsd,
    dateFrom:  summaryDateFrom ? summaryDateFrom.toISOString() : null,
    dateTo:    summaryDateTo ? summaryDateTo.toISOString() : null,
    paidSessionsInserted: paidInserted,
    paidSessionsSkipped:  paidSkipped,
    historyLimited: !isPro,
    historyDays: !isPro ? 31 : null,
    historyRemovedCount,
    historyOriginalRows: originalRowCount,
    historyWindowStart,
    historyWindowEnd,
    platformsTracked,
    freePlatformLimit: !isPro ? FREE_MAX_PLATFORMS : null,
    // Real, computed-from-this-file numbers for anything Free couldn't show —
    // used by the dashboard's locked-preview UI. null/[] when everything was
    // visible, or when the user is already Pro (nothing is excluded for Pro).
    excludedHistory,
    excludedPlatforms,
  }

  if (errors.length > 0) {
    response.warnings = errors
    response.message  = `${errors.length} batch(es) had errors but upload continued. ${inserted} of ${tipRows.length} rows inserted.`
    console.warn('[UPLOAD] Completed with errors:', errors)
  } else {
    response.message = `All ${inserted} tips inserted successfully (${skipped} duplicates skipped).`
    console.log('[UPLOAD] Complete:', response.message)
  }

  if (paidErrors.length > 0) {
    response.paidSessionsWarnings = paidErrors
    console.warn('[UPLOAD] Paid-session batches completed with errors:', paidErrors)
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

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseCSV, detectPlatform, aggregateRows } from '../../../lib/analytics'
import { FREE_MAX_PLATFORMS, filterFreeHistory, isPaidPlan, normalizePlatform } from '../../../lib/planLimits'
import { isSupportedPlatform } from '../../../lib/constants'

const BATCH_SIZE = 250 // Safe batch size — never hit Supabase limits

// Real, non-fabricated summary stats for a subset of rows — reuses the
// canonical aggregateRows() pipeline (lib/analytics.js) instead of a second
// earnings/session/fan-count implementation, per the conversion-boundary
// spec's "do not duplicate analytics" requirement. Only pulls the handful
// of primitive fields the locked-preview UI needs; never invents a number
// aggregateRows didn't itself compute.
function summarizeRows(rows) {
  if (!rows.length) {
    return { tips: 0, totalUsd: 0, sessions: 0, fans: 0, dateFrom: null, dateTo: null }
  }
  const a = aggregateRows(rows)
  const dates = rows.map(r => new Date(r.date_time)).filter(d => !isNaN(d))
  return {
    tips: rows.length,
    totalUsd: a.totalUSD,
    sessions: a.meaningfulSessionCount,
    fans: a.uniqueFanCount,
    dateFrom: dates.length ? new Date(Math.min(...dates)).toISOString() : null,
    dateTo: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
  }
}

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
  // Declared immediately — everything below (row mapping, platform-set
  // computation) depends on this, and a `const` referenced before this line
  // executes throws (temporal dead zone), which previously crashed every
  // upload where per-row platform detection came back empty.
  const detectedPlatform = textDetectedPlatform || 'Unknown'
  const parsed = parseCSV(raw)

  const rows = parsed.map((row) => {
    const tokens = Number(row.tokens) || 0
    const usd = parseFloat((Number(row.usd) || 0).toFixed(2))

    return {
      user_id:   user.id,
      date_time: row.dateRaw || row.date_time || null,
      platform:  row.platform && row.platform !== 'Unknown' ? row.platform : detectedPlatform,
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

  // ── FULL-FILE ANALYSIS (before any Free-plan boundary is applied) ──────
  // Computed on the complete parsed file so the response can always tell the
  // user the truth about what was in their CSV, even for the portion Free
  // can't show. Never recomputed piecemeal later — every "locked preview"
  // number below is a subset of this same real data.
  const fullFileSummary = summarizeRows(rows)

  // ── FREE-PLAN PLATFORM BOUNDARY ─────────────────────────────────────────
  // Free can track up to FREE_MAX_PLATFORMS platforms. This used to be an
  // all-or-nothing gate that rejected the entire CSV the moment a 4th
  // platform showed up. Now: platforms the account already has stay
  // allowed; new platforms fill any remaining free slots; anything beyond
  // that is still not inserted for Free (the insert_tips_dedup /
  // insert_paid_sessions_dedup RPCs enforce this same cap independently on
  // their own, so rows for a genuinely blocked platform would be rejected
  // at the database layer even if this route tried to insert them) — but
  // instead of silently discarding it, we compute a real preview of what's
  // in it so the user can see exactly what upgrading would unlock.
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

  // Only SUPPORTED platforms occupy a Free slot. The parser's 'Unknown'
  // bucket is an absence of a platform, not a platform — counting it spent a
  // real slot on unattributed rows (13 of 7,649 on the owner's own account).
  const existingPlatforms = [...new Set(
    existingPlatformRows
      .map(r => normalizePlatform(r.platform))
      .filter(p => p && isSupportedPlatform(p))
  )]
  // First-seen order within this upload, so which platform "wins" a free
  // slot is deterministic and matches the order rows appear in the file.
  const incomingPlatformsInOrder = [...new Set(
    rows
      .map(r => normalizePlatform(r.platform))
      .filter(p => p && isSupportedPlatform(p))
  )]

  let allowedPlatforms = existingPlatforms
  let blockedPlatforms = []
  if (!isPro) {
    const slotsLeft = () => Math.max(0, FREE_MAX_PLATFORMS - allowedPlatforms.length)
    const newlyAllowed = []
    incomingPlatformsInOrder.forEach(p => {
      if (allowedPlatforms.includes(p) || newlyAllowed.includes(p)) return
      if (slotsLeft() - newlyAllowed.length > 0) newlyAllowed.push(p)
      else blockedPlatforms.push(p)
    })
    allowedPlatforms = [...allowedPlatforms, ...newlyAllowed]
  } else {
    allowedPlatforms = [...new Set([...existingPlatforms, ...incomingPlatformsInOrder])]
  }

  const platformAllowedRows = rows.filter(r => !blockedPlatforms.includes(normalizePlatform(r.platform)))
  const platformBlockedRows = rows.filter(r => blockedPlatforms.includes(normalizePlatform(r.platform)))

  // Real per-platform preview of what's blocked — grouped so the UI can
  // show "Stripchat: 312 tips, $428.17, 9 sessions" instead of one lump sum
  // across every locked platform.
  const lockedPlatformPreview = blockedPlatforms.map(p => {
    const platRows = platformBlockedRows.filter(r => normalizePlatform(r.platform) === p)
    return { platform: platRows[0]?.platform || p, ...summarizeRows(platRows) }
  })

  if (!platformAllowedRows.length && platformBlockedRows.length) {
    // Every row in this file belongs to a platform beyond the Free cap.
    // Nothing to insert, but the user still gets a real preview instead of
    // a bare rejection.
    return NextResponse.json({
      error: `Free supports up to ${FREE_MAX_PLATFORMS} platforms. Upgrade to Pro to add ${blockedPlatforms.length > 1 ? 'these platforms' : 'this platform'} and compare them.`,
      code: 'platform_limit_reached',
      maxPlatforms: FREE_MAX_PLATFORMS,
      currentPlatforms: existingPlatforms,
      lockedPlatformPreview,
      fullFileSummary,
      upgradeUrl: '/pricing',
    }, { status: 402 })
  }

  // ── FREE-PLAN HISTORY BOUNDARY ──────────────────────────────────────────
  // IMPORTANT: this no longer removes rows before insertion. The 31-day
  // window is a Free *analytics/presentation* boundary (enforced client-side
  // in app/dashboard/page.js, same as it already was) — not a reason to
  // throw away source data. Every allowed-platform row gets inserted; we
  // only use filterFreeHistory() here to calculate what falls outside the
  // Free-visible window, for the response.
  let historyExcludedRows = []
  let historyWindowStart = null
  let historyWindowEnd = null
  if (!isPro) {
    const historyResult = filterFreeHistory(platformAllowedRows)
    // filterFreeHistory() returns the same row objects it was given (not
    // copies), so reference equality correctly identifies which original
    // rows survived the window filter.
    const keptRows = new Set(historyResult.rows)
    historyExcludedRows = platformAllowedRows.filter(r => !keptRows.has(r))
    historyWindowStart = historyResult.windowStart
    historyWindowEnd = historyResult.windowEnd
  }
  const historyExcludedSummary = summarizeRows(historyExcludedRows)
  // Everything Free can actually see right now from this upload.
  const excludedRowSet = new Set(historyExcludedRows)
  const freeVisibleRows = isPro
    ? platformAllowedRows
    : platformAllowedRows.filter(r => !excludedRowSet.has(r))
  const freeResultsSummary = summarizeRows(freeVisibleRows)

  // Rows that actually go to the database — always the full allowed-platform
  // set, regardless of plan. Nothing derived above ever mutates this.
  const rowsToInsert = platformAllowedRows

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
  const tipRows = rowsToInsert.filter(r => !r.is_paid_session)
  const paidSessionRows = rowsToInsert.filter(r => r.is_paid_session)

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
        // The database-level RPC enforces the same platform cap
        // independently of the pre-check above (e.g. a platform this route
        // considered "allowed" based on a stale existingPlatforms read can
        // still be rejected here under concurrent uploads). Log the
        // attempt — including any rows earlier batches in this same request
        // already inserted — before returning, so a correctly-rejected
        // upload leaves a trace in csv_uploads instead of vanishing.
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

    // ── Free-plan conversion boundary data — all real, derived from this
    // upload, never fabricated. See summarizeRows()/aggregateRows() above.
    historyLimited: !isPro,
    historyDays: !isPro ? 31 : null,
    historyWindowStart,
    historyWindowEnd,
    // Section A — what Free can actually see right now.
    freeResults: !isPro ? freeResultsSummary : null,
    // Section B — real totals for data that exists but falls outside the
    // Free history window. historyRemovedCount kept for backward
    // compatibility with UI already reading it as a row count.
    historyRemovedCount: historyExcludedRows.length,
    excludedHistory: !isPro && historyExcludedRows.length ? historyExcludedSummary : null,
    // Section B (continued) — real per-platform totals for platforms this
    // upload contained that Free can't add right now.
    lockedPlatformPreview: !isPro && lockedPlatformPreview.length ? lockedPlatformPreview : null,
    // The complete picture, so the UI never has to guess what "everything"
    // would have looked like.
    fullFileSummary,

    platformsTracked: allowedPlatforms,
    freePlatformLimit: !isPro ? FREE_MAX_PLATFORMS : null,
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

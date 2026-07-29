// ============================================================
// CREATOR TAX ORGANIZER — SHARED EARNINGS SUMMARY
// ============================================================
// This is the ONE place Tax Organizer computes totals. The on-screen
// summary cards, monthly breakdown, platform breakdown, CSV export, and
// PDF export all call buildEarningsSummary() and render its output — none
// of them may recompute a total independently. See CLAUDE-facing repo
// notes (basic-requirments / formula-requirments skills) for why: every
// number must have exactly one source of truth.
//
// Deliberately NOT reused from here: lib/analytics.js `aggregateRows()`.
// That function's per-platform totals only sum "meaningful" sessions
// (excludes short/low-tip sessions) for behavioral-analytics purposes —
// correct for "when should I stream," wrong for "how much did I earn."
// Tax Organizer includes every recorded row in the selected period, full
// stop, per product decision.
//
// Two data sources are combined here, per product decision:
//   - `tips` rows        -> "Tips & imported earnings"
//   - `paid_sessions` rows -> "Paid/private session earnings" (BongaCams)
// A repo-wide investigation (join on user_id + username + tokens + usd +
// date_time within a 5-minute window) found zero overlapping rows between
// these two tables for any user who has both — they are populated by
// separate upload endpoints with no cross-insertion path. They are summed
// additively. This module still runs a defensive near-duplicate check
// (see detectCrossSourceDuplicates) and *surfaces* any future collision
// as a data-quality warning rather than silently deleting anything.
//
// Money is never handled as floating point beyond the DB's own `numeric`
// precision: all sums are done in integer cents and divided back down at
// the end. Supabase returns `numeric` columns as strings — this module
// always parses explicitly and never assumes a JS number.
// ============================================================

import { tokenRate, PLATFORM_TOKEN_RATES } from '../constants'
import { toLocalDateStr } from '../analytics'
import { resolveTimezone } from './timezone'

const KNOWN_PLATFORMS = Object.keys(PLATFORM_TOKEN_RATES)

function toCents(usd) {
  return Math.round((Number(usd) || 0) * 100)
}
function fromCents(cents) {
  return Math.round(cents) / 100
}

function localDateStr(dateTime, tz) {
  return toLocalDateStr(dateTime, tz)
}
function localYear(dateTime, tz) {
  return parseInt(localDateStr(dateTime, tz).slice(0, 4), 10)
}
function localYearMonth(dateTime, tz) {
  return localDateStr(dateTime, tz).slice(0, 7)
}

// Groups case-variant platform strings ("Chaturbate" / "chaturbate") into
// one bucket for display and filtering. Never writes this back to the DB —
// display/filter concern only, per product decision.
function normalizePlatformDisplay(rawPlatform) {
  if (!rawPlatform || typeof rawPlatform !== 'string' || !rawPlatform.trim()) return 'Unknown platform'
  const trimmed = rawPlatform.trim()
  if (trimmed.toLowerCase() === 'unknown') return 'Unknown platform'
  const known = KNOWN_PLATFORMS.find(p => p.toLowerCase() === trimmed.toLowerCase())
  return known || trimmed
}
function platformGroupKey(rawPlatform) {
  return normalizePlatformDisplay(rawPlatform).toLowerCase()
}

// ------------------------------------------------------------
// METRIC: row-level USD amount + conversion-method disclosure.
// Definition: the amount attributed to a single tip/session record.
// Formula:
//   - stored `usd` > 0                -> use it as-is ("Stored USD value").
//     We never know, and never claim to know, whether that stored value
//     originally came from an imported USD column or a token conversion
//     performed at import time — that provenance was never persisted
//     anywhere in this schema. This is a deliberate, documented gap.
//   - stored `usd` is 0 and tokens>0  -> derive usd = tokens * tokenRate()
//     for display only ("Token conversion (display-time fallback)"),
//     never written back to the row.
//   - both 0                          -> "Conversion method not recorded".
// Included: every row passed in. Excluded: none — Tax Organizer never
// drops rows based on data quality; it flags them instead.
// Min data requirement: none (deterministic per-row rule, not a
// confidence-scored analytics metric).
// Source: computeRowAmount() below. Test: earningsSummary.test.js.
// ------------------------------------------------------------
function computeRowAmount(rawUsd, rawTokens, platform) {
  const usd = Number(rawUsd) || 0
  const tokens = Number(rawTokens) || 0
  if (usd > 0) {
    return { usd, tokens, conversionMethod: 'Stored USD value', usedFallback: false, impliedRate: tokens > 0 ? usd / tokens : null }
  }
  if (tokens > 0) {
    const rate = tokenRate(platform)
    const derivedUsd = fromCents(toCents(tokens * rate))
    return {
      usd: derivedUsd,
      tokens,
      conversionMethod: `Token conversion (display-time fallback, $${rate}/token — original USD amount was not recorded)`,
      usedFallback: true,
      impliedRate: rate,
    }
  }
  return { usd: 0, tokens: 0, conversionMethod: 'Conversion method not recorded', usedFallback: false, impliedRate: null }
}

// Normalizes one raw `tips` or `paid_sessions` row into a common shape
// used everywhere downstream (screen table, CSV, PDF).
export function normalizeRecord(row, source, tz) {
  const platform = source === 'tips' ? row.platform : row.platform
  const { usd, tokens, conversionMethod, usedFallback, impliedRate } = computeRowAmount(row.usd, row.tokens, platform)

  return {
    id: `${source}:${row.id}`,
    rawId: row.id,
    source, // 'tips' | 'paid_sessions'
    dateTimeRaw: row.date_time,
    localDate: localDateStr(row.date_time, tz),
    localYear: localYear(row.date_time, tz),
    localMonth: localYearMonth(row.date_time, tz),
    platformRaw: platform || '',
    platformDisplay: normalizePlatformDisplay(platform),
    platformKey: platformGroupKey(platform),
    incomeType: source === 'tips' ? (row.tip_type || 'Tip') : (row.session_type || 'Unknown'),
    username: row.username || '',
    tokens,
    usd,
    conversionMethod,
    usedFallback,
    impliedRate,
    uploadId: row.upload_id || null,
    sessionId: source === 'tips' ? (row.session_id || null) : null,
    recordRef: source === 'tips' ? (row.tip_ref || null) : (row.session_ref || null),
    note: source === 'tips' ? (row.tip_note || '') : '',
    warnings: [],
  }
}

// ------------------------------------------------------------
// Filters normalized records to the requested local-tz date range and
// platform list. This is the ONLY place the local-tz year/tax-year
// boundary decision is made — screen, CSV, and PDF all call this, so a
// transaction near midnight can never land in one year on screen and a
// different year in an export.
// ------------------------------------------------------------
export function filterRecords(records, { startDate, endDate, platforms }) {
  const platformSet = platforms && platforms.length ? new Set(platforms.map(p => p.toLowerCase())) : null
  return records.filter(r => {
    if (startDate && r.localDate < startDate) return false
    if (endDate && r.localDate > endDate) return false
    if (platformSet && !platformSet.has(r.platformKey)) return false
    return true
  })
}

// Defensive, non-destructive check for possible duplication between the
// two source tables. Investigation found no real overlap today, but this
// still surfaces any future near-match as a warning — it never removes
// or merges records automatically (per product decision: no fuzzy dedup).
function detectCrossSourceDuplicates(tipRecords, paidSessionRecords) {
  const warnings = []
  const paidByKey = new Map()
  paidSessionRecords.forEach(r => {
    const key = `${r.username.toLowerCase()}|${r.tokens}|${r.usd.toFixed(2)}`
    if (!paidByKey.has(key)) paidByKey.set(key, [])
    paidByKey.get(key).push(r)
  })
  tipRecords.forEach(tip => {
    const key = `${tip.username.toLowerCase()}|${tip.tokens}|${tip.usd.toFixed(2)}`
    const candidates = paidByKey.get(key)
    if (!candidates) return
    const tipTime = new Date(tip.dateTimeRaw).getTime()
    const match = candidates.find(c => Math.abs(new Date(c.dateTimeRaw).getTime() - tipTime) <= 5 * 60 * 1000)
    if (match) {
      warnings.push({
        type: 'possible_cross_source_duplicate',
        message: `A tips record and a paid/private session record share the same username, token amount, and USD amount within 5 minutes of each other (${tip.localDate}, ${tip.username}). Both are included in your totals — review before export if this looks like the same event recorded twice.`,
        recordIds: [tip.id, match.id],
      })
    }
  })
  return warnings
}

function sumCents(records) {
  return records.reduce((sum, r) => sum + toCents(r.usd), 0)
}

function buildPlatformBreakdown(tipRecords, paidSessionRecords) {
  const groups = new Map()
  const touch = (key, display) => {
    if (!groups.has(key)) {
      groups.set(key, { platformKey: key, platformDisplay: display, tipsUSDCents: 0, paidSessionUSDCents: 0, recordCount: 0, tokens: 0, rateCounts: new Map() })
    }
    return groups.get(key)
  }
  tipRecords.forEach(r => {
    const g = touch(r.platformKey, r.platformDisplay)
    g.tipsUSDCents += toCents(r.usd)
    g.recordCount += 1
    g.tokens += r.tokens
    if (r.impliedRate != null && r.tokens > 0) {
      const rounded = Math.round(r.impliedRate * 1000) / 1000
      g.rateCounts.set(rounded, (g.rateCounts.get(rounded) || 0) + 1)
    }
  })
  paidSessionRecords.forEach(r => {
    const g = touch(r.platformKey, r.platformDisplay)
    g.paidSessionUSDCents += toCents(r.usd)
    g.recordCount += 1
    g.tokens += r.tokens
    if (r.impliedRate != null && r.tokens > 0) {
      const rounded = Math.round(r.impliedRate * 1000) / 1000
      g.rateCounts.set(rounded, (g.rateCounts.get(rounded) || 0) + 1)
    }
  })

  const totalCents = [...groups.values()].reduce((s, g) => s + g.tipsUSDCents + g.paidSessionUSDCents, 0)

  return [...groups.values()]
    .map(g => {
      // Only count a rate as "in use" if it shows up on 2+ rows — a single
      // 1-token tip produces a noisy implied rate that isn't a real signal.
      const significantRates = [...g.rateCounts.entries()].filter(([, count]) => count >= 2).map(([rate]) => rate).sort((a, b) => a - b)
      const totalUSD = fromCents(g.tipsUSDCents + g.paidSessionUSDCents)
      return {
        platform: g.platformDisplay,
        tipsUSD: fromCents(g.tipsUSDCents),
        paidSessionUSD: fromCents(g.paidSessionUSDCents),
        totalUSD,
        pctOfPeriod: totalCents > 0 ? Math.round(((g.tipsUSDCents + g.paidSessionUSDCents) / totalCents) * 1000) / 10 : 0,
        recordCount: g.recordCount,
        tokens: g.tokens,
        currentDefaultRate: KNOWN_PLATFORMS.some(p => p.toLowerCase() === g.platformKey) ? tokenRate(g.platformDisplay) : null,
        ratesObservedInPeriod: significantRates,
        multipleRatesObserved: significantRates.length > 1,
      }
    })
    .sort((a, b) => b.totalUSD - a.totalUSD)
}

function buildMonthlyBreakdown(tipRecords, paidSessionRecords) {
  const months = new Map()
  const touch = (key) => {
    if (!months.has(key)) months.set(key, { month: key, tipsUSDCents: 0, paidSessionUSDCents: 0, recordCount: 0 })
    return months.get(key)
  }
  tipRecords.forEach(r => {
    const m = touch(r.localMonth)
    m.tipsUSDCents += toCents(r.usd)
    m.recordCount += 1
  })
  paidSessionRecords.forEach(r => {
    const m = touch(r.localMonth)
    m.paidSessionUSDCents += toCents(r.usd)
    m.recordCount += 1
  })
  return [...months.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({
      month: m.month,
      tipsUSD: fromCents(m.tipsUSDCents),
      paidSessionUSD: fromCents(m.paidSessionUSDCents),
      totalUSD: fromCents(m.tipsUSDCents + m.paidSessionUSDCents),
      recordCount: m.recordCount,
    }))
}

function buildDataQualityIssues({ tipRecords, paidSessionRecords, allRecords, tz, requestedTimezoneWasInvalid }) {
  const issues = []

  if (requestedTimezoneWasInvalid) {
    issues.push({
      type: 'invalid_timezone_fallback',
      severity: 'warning',
      message: `The timezone your browser reported wasn't a recognized timezone, so results below use UTC instead. Some records near a year boundary may be organized differently than if your real local timezone were used.`,
    })
  }

  const fallbackRows = allRecords.filter(r => r.usedFallback)
  if (fallbackRows.length > 0) {
    const amount = fromCents(sumCents(fallbackRows))
    issues.push({
      type: 'fallback_conversion_used',
      severity: 'warning',
      message: `${fallbackRows.length} record(s) totaling $${amount.toFixed(2)} had no stored USD amount, so a token-based conversion was applied for display only (using the current platform rate). The original USD amount for these rows was never recorded.`,
      recordIds: fallbackRows.map(r => r.id),
    })
  }

  const unrecordedRows = allRecords.filter(r => r.conversionMethod === 'Conversion method not recorded')
  if (unrecordedRows.length > 0) {
    issues.push({
      type: 'conversion_method_unknown',
      severity: 'info',
      message: `${unrecordedRows.length} record(s) have no USD amount and no token amount to convert from — they are included with $0 and cannot be organized further.`,
      recordIds: unrecordedRows.map(r => r.id),
    })
  }

  const unknownPlatformRows = allRecords.filter(r => r.platformDisplay === 'Unknown platform')
  if (unknownPlatformRows.length > 0) {
    issues.push({
      type: 'unknown_platform',
      severity: 'warning',
      message: `${unknownPlatformRows.length} record(s) totaling $${fromCents(sumCents(unknownPlatformRows)).toFixed(2)} have no identifiable platform on file and are grouped as "Unknown platform."`,
      recordIds: unknownPlatformRows.map(r => r.id),
    })
  }

  // Duplicate-looking rows: same source table, same username/tokens/usd
  // within the same minute. Surfaced only — never removed.
  const byBucket = new Map()
  allRecords.forEach(r => {
    const minuteBucket = r.dateTimeRaw ? new Date(r.dateTimeRaw).toISOString().slice(0, 16) : 'unknown'
    const key = `${r.source}|${r.username.toLowerCase()}|${r.tokens}|${r.usd.toFixed(2)}|${minuteBucket}`
    if (!byBucket.has(key)) byBucket.set(key, [])
    byBucket.get(key).push(r)
  })
  const duplicateLooking = [...byBucket.values()].filter(group => group.length > 1)
  if (duplicateLooking.length > 0) {
    const recordIds = duplicateLooking.flat().map(r => r.id)
    issues.push({
      type: 'duplicate_looking_records',
      severity: 'warning',
      message: `${duplicateLooking.length} group(s) of records (${recordIds.length} records total) share the same username, token amount, USD amount, and minute. These may be duplicate entries or may be genuinely separate events (e.g. the same fan tipping twice in one minute) — nothing has been removed automatically.`,
      recordIds,
    })
  }

  const crossSourceWarnings = detectCrossSourceDuplicates(tipRecords, paidSessionRecords)
  issues.push(...crossSourceWarnings)

  // Platform rate mixing — surfaced per-platform in the breakdown too, but
  // also called out here so it isn't missed on the summary screen.
  const platformRates = new Map()
  allRecords.forEach(r => {
    if (r.impliedRate == null || r.tokens <= 0) return
    if (!platformRates.has(r.platformKey)) platformRates.set(r.platformKey, new Map())
    const rateCounts = platformRates.get(r.platformKey)
    const rounded = Math.round(r.impliedRate * 1000) / 1000
    rateCounts.set(rounded, (rateCounts.get(rounded) || 0) + 1)
  })
  platformRates.forEach((rateCounts, key) => {
    const significant = [...rateCounts.entries()].filter(([, count]) => count >= 2)
    if (significant.length > 1) {
      const display = allRecords.find(r => r.platformKey === key)?.platformDisplay || key
      issues.push({
        type: 'multiple_rates_used',
        severity: 'warning',
        message: `${display} records in this period use more than one token-to-USD rate (${significant.map(([r]) => `$${r}`).join(', ')} per token). This can happen with legitimate rate changes over time or mixed import sources — review before export.`,
      })
    }
  })

  return issues
}

// Per-record short warning labels are derived from the same issues list —
// screen table, CSV, and PDF all show the identical "Warning status" for a
// given record because this runs once, here, not independently per view.
const RECORD_WARNING_LABELS = {
  fallback_conversion_used: 'Token conversion used (USD not recorded)',
  unknown_platform: 'Unknown platform',
  duplicate_looking_records: 'Possible duplicate',
  possible_cross_source_duplicate: 'Possible duplicate across tips/paid sessions',
}

function tagRecordWarnings(allRecords, issues) {
  const byId = new Map(allRecords.map(r => [r.id, r]))
  issues.forEach(issue => {
    const label = RECORD_WARNING_LABELS[issue.type]
    if (!label || !issue.recordIds) return
    issue.recordIds.forEach(id => {
      const record = byId.get(id)
      if (record && !record.warnings.includes(label)) record.warnings.push(label)
    })
  })
}

// ------------------------------------------------------------
// MAIN ENTRY POINT.
// tipsRows / paidSessionRows: raw rows already scoped to the authenticated
// user by the caller's Supabase query (RLS-backed) and broadly date-padded
// (see app/api/tax-organizer/summary/route.js for why padding is needed —
// local-tz boundaries don't align with UTC query boundaries).
// requestedTimezone: raw string from the client; validated here.
// startDate/endDate: 'YYYY-MM-DD' local-date strings (inclusive), or null
// for "all available data."
// platforms: optional array of platform display names to filter by.
// ------------------------------------------------------------
export function buildEarningsSummary({
  tipsRows = [],
  paidSessionRows = [],
  requestedTimezone,
  startDate = null,
  endDate = null,
  platforms = null,
}) {
  const timezone = resolveTimezone(requestedTimezone)
  const requestedTimezoneWasInvalid = requestedTimezone && timezone !== requestedTimezone

  const allTipRecords = tipsRows.map(r => normalizeRecord(r, 'tips', timezone))
  const allPaidSessionRecords = paidSessionRows.map(r => normalizeRecord(r, 'paid_sessions', timezone))

  const tipRecords = filterRecords(allTipRecords, { startDate, endDate, platforms })
  const paidSessionRecords = filterRecords(allPaidSessionRecords, { startDate, endDate, platforms })
  const allRecords = [...tipRecords, ...paidSessionRecords].sort((a, b) => new Date(a.dateTimeRaw) - new Date(b.dateTimeRaw))

  const tipsUSDCents = sumCents(tipRecords)
  const paidSessionUSDCents = sumCents(paidSessionRecords)
  const totalUSDCents = tipsUSDCents + paidSessionUSDCents

  const platformsIncluded = new Set(allRecords.map(r => r.platformKey))

  const totals = {
    tipsAndImportedUSD: fromCents(tipsUSDCents),
    paidSessionUSD: fromCents(paidSessionUSDCents),
    totalGrossUSD: fromCents(totalUSDCents),
    recordCount: allRecords.length,
    platformCount: platformsIncluded.size,
    earliestDate: allRecords.length ? allRecords[0].localDate : null,
    latestDate: allRecords.length ? allRecords[allRecords.length - 1].localDate : null,
    hasPaidSessionData: paidSessionRecords.length > 0,
  }

  const issues = buildDataQualityIssues({ tipRecords, paidSessionRecords, allRecords, tz: timezone, requestedTimezoneWasInvalid })
  tagRecordWarnings(allRecords, issues)

  return {
    timezone,
    requestedTimezoneWasInvalid: Boolean(requestedTimezoneWasInvalid),
    filters: { startDate, endDate, platforms: platforms || null },
    totals,
    monthly: buildMonthlyBreakdown(tipRecords, paidSessionRecords),
    platforms: buildPlatformBreakdown(tipRecords, paidSessionRecords),
    dataQuality: { issues },
    dataAvailability: {
      platformFeesRecorded: false,
      processingFeesRecorded: false,
      refundsAndChargebacksRecorded: false,
      confirmedPayoutsRecorded: false,
    },
    records: allRecords,
  }
}

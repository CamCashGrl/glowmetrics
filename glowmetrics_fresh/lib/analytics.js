// ============================================
// CAMCASH COMPLETE ANALYTICS ENGINE
// ============================================


// ============================================================
// DATA INTEGRITY LAYER — CamCash
// ============================================================
// Everything below runs BEFORE any metrics are calculated.
// All outputs are traceable to raw tip records.
// No metric is ever stored — always computed dynamically.
// ============================================================

// ── 1. TIME RANGE SYSTEM ────────────────────────────────────
// Single authoritative function for all time-range filtering.
// Every metric that uses a time range MUST use this function.
// Never use ad-hoc date arithmetic outside of this system.
// ============================================================

export const TIME_RANGES = {
  LAST_7:    'last_7_days',
  LAST_30:   'last_30_days',
  LAST_90:   'last_90_days',
  ALL_TIME:  'all_time',
  SESSION:   'session_based',  // computed per-session, no global filter
}

/**
 * Filter tips to a specific time range.
 * EVERY metric that scopes by time must call this — no exceptions.
 *
 * @param {Array} tips — raw tip array
 * @param {string} range — one of TIME_RANGES values
 * @returns {Array} filtered tips with timeRange metadata attached
 */
export function filterByTimeRange(tips, range) {
  if (!tips || !tips.length) return []
  if (range === TIME_RANGES.ALL_TIME || range === TIME_RANGES.SESSION) return tips

  const now = Date.now()
  const MS_PER_DAY = 86400000
  const cutoffs = {
    [TIME_RANGES.LAST_7]:  7  * MS_PER_DAY,
    [TIME_RANGES.LAST_30]: 30 * MS_PER_DAY,
    [TIME_RANGES.LAST_90]: 90 * MS_PER_DAY,
  }
  const cutoffMs = cutoffs[range]
  if (!cutoffMs) return tips  // unknown range → return all, don't silently drop data

  return tips.filter(t => {
    const ms = new Date(t.dateRaw || t.date_time).getTime()
    return !isNaN(ms) && (now - ms) <= cutoffMs
  })
}

/**
 * Get the human-readable label for a time range.
 * Use this in insight text so every insight shows its time context.
 */
export function timeRangeLabel(range) {
  const labels = {
    [TIME_RANGES.LAST_7]:   'last 7 days',
    [TIME_RANGES.LAST_30]:  'last 30 days',
    [TIME_RANGES.LAST_90]:  'last 90 days',
    [TIME_RANGES.ALL_TIME]: 'all time',
    [TIME_RANGES.SESSION]:  'this session',
  }
  return labels[range] || 'all time'
}

// ── 2. TIMESTAMP NORMALIZATION ───────────────────────────────
// All timestamps must be normalized to UTC ISO-8601 before storage
// or comparison. Timezone assumptions are NOT allowed.
// ============================================================

/**
 * Normalize any timestamp string to a UTC ISO-8601 string.
 * Returns null if the timestamp cannot be parsed.
 * This is the ONLY place where timestamp parsing should happen.
 */
export function normalizeToUTC(raw) {
  if (!raw || typeof raw !== 'string') return null
  const cleaned = raw.trim()
  if (!cleaned) return null

  // Already ISO format with Z
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(cleaned)) {
    const d = new Date(cleaned)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // European DD.MM.YYYY HH:MM or DD.MM.YYYY
  const euro = cleaned.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}:\d{2}))?/)
  if (euro) {
    const iso = `${euro[3]}-${euro[2]}-${euro[1]}T${euro[4] || '00:00'}:00Z`
    const d = new Date(iso)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // YYYY/MM/DD or YYYY-MM-DD with optional time
  const ymd = cleaned.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})(?:[\sT](\d{2}:\d{2}))?/)
  if (ymd) {
    const iso = `${ymd[1]}-${ymd[2]}-${ymd[3]}T${ymd[4] || '00:00'}:00Z`
    const d = new Date(iso)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // Last resort — try native Date parse
  const d = new Date(cleaned)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// ── 3. PLATFORM ENFORCEMENT ──────────────────────────────────
// Every tip, fan, and session MUST have a platform.
// This function is called on every tip before it enters the system.
// ============================================================

const KNOWN_PLATFORMS = ['Chaturbate', 'BongaCams', 'MyFreeCams', 'Stripchat', 'CamSoda']

/**
 * Enforce platform presence on a tip.
 * If platform is missing or 'Unknown', tries to infer from other fields.
 * Returns the tip with a guaranteed platform string.
 */
export function enforcePlatform(tip) {
  if (tip.platform && tip.platform !== 'Unknown' && KNOWN_PLATFORMS.includes(tip.platform)) {
    return tip
  }
  // Try to infer from token rate or tip_type
  let inferred = 'Unknown'
  const note = ((tip.tip_note || '') + ' ' + (tip.tip_type || '')).toLowerCase()
  if (note.includes('chaturbate') || note.includes('tip from')) inferred = 'Chaturbate'
  else if (note.includes('bonga'))                               inferred = 'BongaCams'
  else if (note.includes('mfc') || note.includes('freecams'))    inferred = 'MyFreeCams'
  else if (note.includes('stripchat'))                           inferred = 'Stripchat'
  else if (note.includes('camsoda'))                             inferred = 'CamSoda'

  return { ...tip, platform: inferred, platformInferred: inferred !== 'Unknown' }
}

// ── 4. DATA VALIDATION LAYER ─────────────────────────────────
// Run this on the raw tips array BEFORE calling aggregateRows.
// Returns a validated dataset + a validation report.
// If critical issues found, the caller should warn the user.
// ============================================================

/**
 * Validate the full tips dataset before any metrics are computed.
 * Returns { valid: boolean, tips: Array, report: Object }
 */
export function validateDataset(tips) {
  const report = {
    totalInput:       tips.length,
    duplicatesFound:  0,
    missingPlatform:  0,
    invalidDates:     0,
    zeroDollarTips:   0,
    missingUsername:  0,
    platformCounts:   {},
    dateRange:        { earliest: null, latest: null },
    passed:           true,
    warnings:         [],
    errors:           [],
  }

  if (!tips || tips.length === 0) {
    report.passed = false
    report.errors.push('No tips to validate')
    return { valid: false, tips: [], report }
  }

  // ── Step 1: Normalize timestamps ──────────────────────────
  const withNormalizedDates = tips.map(t => {
    const normalized = normalizeToUTC(t.dateRaw || t.date_time || '')
    if (!normalized) {
      report.invalidDates++
      return null
    }
    return { ...t, dateRaw: normalized, date_time: normalized }
  }).filter(Boolean)

  if (report.invalidDates > 0) {
    report.warnings.push(`${report.invalidDates} tip(s) had invalid dates and were excluded`)
  }

  // ── Step 2: Enforce platform on all tips ──────────────────
  const withPlatform = withNormalizedDates.map(enforcePlatform)
  report.missingPlatform = withPlatform.filter(t => t.platform === 'Unknown').length
  if (report.missingPlatform > 0) {
    report.warnings.push(`${report.missingPlatform} tip(s) have unknown platform — metrics will be calculated but platform comparisons may be incomplete`)
  }

  // ── Step 3: Remove duplicates ─────────────────────────────
  // Dedup key: username + tokens + usd (rounded) + timestamp (minute precision)
  // Minute precision because some platforms export with minute-level timestamps
  const seen = new Map()
  const deduped = []
  for (const t of withPlatform) {
    const usdRounded = Math.round((t.usd || 0) * 100)
    const tMin = t.dateRaw ? t.dateRaw.slice(0, 16) : ''  // YYYY-MM-DDTHH:MM
    const key = `${(t.username || '').toLowerCase()}|${t.tokens || 0}|${usdRounded}|${tMin}|${t.platform}`
    if (!seen.has(key)) {
      seen.set(key, true)
      deduped.push(t)
    } else {
      report.duplicatesFound++
    }
  }
  if (report.duplicatesFound > 0) {
    report.warnings.push(`${report.duplicatesFound} duplicate tip(s) removed before calculation`)
  }

  // ── Step 4: Validate remaining fields ─────────────────────
  const validated = []
  for (const t of deduped) {
    if (!t.username || typeof t.username !== 'string' || !t.username.trim()) {
      report.missingUsername++
      continue
    }
    if ((t.usd || 0) === 0 && (t.tokens || 0) === 0) {
      report.zeroDollarTips++
      continue
    }
    report.platformCounts[t.platform] = (report.platformCounts[t.platform] || 0) + 1
    validated.push(t)
  }

  if (report.missingUsername > 0) {
    report.warnings.push(`${report.missingUsername} tip(s) had no username and were excluded`)
  }
  if (report.zeroDollarTips > 0) {
    report.warnings.push(`${report.zeroDollarTips} zero-value tip(s) excluded`)
  }

  // ── Step 5: Build date range ──────────────────────────────
  if (validated.length > 0) {
    const sorted = validated.map(t => t.dateRaw).sort()
    report.dateRange.earliest = sorted[0]
    report.dateRange.latest   = sorted[sorted.length - 1]
  }

  // ── Step 6: Final pass/fail ───────────────────────────────
  if (validated.length === 0) {
    report.passed = false
    report.errors.push('No valid tips remain after validation')
  }
  if (validated.length < tips.length * 0.5) {
    report.warnings.push(`Over 50% of input tips were excluded — check your CSV for data issues`)
  }

  report.totalOutput = validated.length
  report.valid = report.passed

  return { valid: report.passed, tips: validated, report }
}

// ── 5. FAN RECONCILIATION ─────────────────────────────────────
// Every fan stat MUST derive from raw tips — no stored aggregates.
// This function verifies that a fan object is internally consistent.
// Call this on every fan before returning it from identifyWhales.
// ============================================================

/**
 * Verify a fan object is internally consistent with its raw tips.
 * Returns the fan with a reconciliation result attached.
 */
export function reconcileFan(fan) {
  const tips = fan.tips || []
  const computedTotal   = parseFloat(tips.reduce((s, t) => s + (t.usd || 0), 0).toFixed(2))
  const computedCount   = tips.length
  const computedAvg     = computedCount > 0 ? parseFloat((computedTotal / computedCount).toFixed(2)) : 0
  const computedTokens  = tips.reduce((s, t) => s + (t.tokens || 0), 0)

  const totalMatch   = Math.abs((fan.totalUSD   || 0) - computedTotal)  < 0.02
  const countMatch   = (fan.tipCount || 0) === computedCount
  const tokensMatch  = (fan.totalTokens || 0) === computedTokens

  const consistent = totalMatch && countMatch && tokensMatch

  return {
    ...fan,
    // Always override with computed values — raw data is the source of truth
    totalUSD:     computedTotal,
    tipCount:     computedCount,
    avgTipSize:   computedAvg,
    totalTokens:  computedTokens,
    _reconciled:  true,
    _consistent:  consistent,
    _reconciliation: consistent ? null : {
      usdDiff:    Math.abs((fan.totalUSD || 0) - computedTotal).toFixed(2),
      countDiff:  Math.abs((fan.tipCount || 0) - computedCount),
      note:       'Values corrected from raw tips — stored aggregates overridden',
    }
  }
}

// ── 6. MULTI-BASELINE PERFORMANCE LABELS ────────────────────
// Performance labels must use ALL available baselines, not just platform avg.
// Baselines:
//   A) Platform all-time average
//   B) Last 5 sessions (same platform)
//   C) Same day-of-week (if >= 3 sessions exist for that day)
//   D) Same hour-of-day (if >= 3 sessions exist for that hour)
// Label = median of all available baseline comparisons.
// ============================================================

/**
 * Compute performance label with multiple baselines.
 * This replaces the single-baseline addPerformanceLabels function.
 */
export function addMultiBaselineLabels(sessions) {
  if (!sessions || sessions.length === 0) return []

  // Group sessions for baseline computation
  const byPlatform = {}
  const byPlatformDay = {}
  const byPlatformHour = {}

  sessions.forEach(s => {
    const p   = s.platform || 'Unknown'
    const dow = new Date(s.startTime).getUTCDay()   // 0=Sun … 6=Sat
    const hod = new Date(s.startTime).getUTCHours()

    if (!byPlatform[p])                  byPlatform[p] = []
    if (!byPlatformDay[`${p}_${dow}`])   byPlatformDay[`${p}_${dow}`] = []
    if (!byPlatformHour[`${p}_${hod}`])  byPlatformHour[`${p}_${hod}`] = []

    byPlatform[p].push(s)
    byPlatformDay[`${p}_${dow}`].push(s)
    byPlatformHour[`${p}_${hod}`].push(s)
  })

  return sessions.map(s => {
    const p   = s.platform || 'Unknown'
    const dow = new Date(s.startTime).getUTCDay()
    const hod = new Date(s.startTime).getUTCHours()
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

    // ── Baseline A: Platform all-time avg ──────────────────
    const allPlatSessions = byPlatform[p] || []
    // Require >= 2 sessions to avoid a session comparing against itself
    const platAvg = allPlatSessions.length >= 2
      ? allPlatSessions.reduce((sum, x) => sum + x.totalUSD, 0) / allPlatSessions.length
      : null

    // ── Baseline B: Last 5 sessions (same platform) ────────
    const last5 = allPlatSessions
      .filter(x => x.id !== s.id)
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
      .slice(0, 5)
    const last5Avg = last5.length >= 2
      ? last5.reduce((sum, x) => sum + x.totalUSD, 0) / last5.length
      : null

    // ── Baseline C: Same day-of-week avg ───────────────────
    const dayKey     = `${p}_${dow}`
    const daySessions = (byPlatformDay[dayKey] || []).filter(x => x.id !== s.id)
    const dayAvg     = daySessions.length >= 3
      ? daySessions.reduce((sum, x) => sum + x.totalUSD, 0) / daySessions.length
      : null

    // ── Baseline D: Same hour-of-day avg ──────────────────
    const hourKey     = `${p}_${hod}`
    const hourSessions = (byPlatformHour[hourKey] || []).filter(x => x.id !== s.id)
    const hourAvg     = hourSessions.length >= 3
      ? hourSessions.reduce((sum, x) => sum + x.totalUSD, 0) / hourSessions.length
      : null

    // ── Compute ratios against each available baseline ─────
    const ratios = [platAvg, last5Avg, dayAvg, hourAvg]
      .filter(b => b !== null && b > 0)
      .map(b => s.totalUSD / b)

    // No baselines available — not enough data
    if (ratios.length === 0) {
      return {
        ...s,
        performanceLabel:   'Unrated',
        performanceColor:   '#475569',
        performanceInsight: `No baseline available yet for ${p} — need more sessions`,
        baselines: { platform: platAvg, last5: last5Avg, sameDay: dayAvg, sameHour: hourAvg },
      }
    }

    // Median ratio — more robust than mean (prevents one outlier baseline from dominating)
    const sorted = [...ratios].sort((a, b) => a - b)
    const medianRatio = sorted.length % 2 === 0
      ? (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2
      : sorted[Math.floor(sorted.length/2)]

    let performanceLabel = 'Average'
    let performanceColor = '#F59E0B'
    if (medianRatio >= 1.25)  { performanceLabel = 'Above Average'; performanceColor = '#10B981' }
    else if (medianRatio < 0.75) { performanceLabel = 'Below Average'; performanceColor = '#F87171' }

    // ── Build fully-explainable insight string ─────────────
    const pct = Math.round(Math.abs(medianRatio - 1) * 100)
    const dir  = medianRatio >= 1 ? 'above' : 'below'
    const baselines_used = [
      platAvg  !== null ? `platform avg ($${platAvg.toFixed(0)})` : null,
      last5Avg !== null ? `last ${last5.length} sessions ($${last5Avg.toFixed(0)})` : null,
      dayAvg   !== null ? `${days[dow]}s avg ($${dayAvg.toFixed(0)})` : null,
      hourAvg  !== null ? `${hod}:00 UTC avg ($${hourAvg.toFixed(0)})` : null,
    ].filter(Boolean)

    const performanceInsight = `$${s.totalUSD.toFixed(0)} earned — ${pct}% ${dir} baseline (${baselines_used.join(', ')}) on ${p}`

    return {
      ...s,
      performanceLabel,
      performanceColor,
      performanceInsight,
      medianBaselineRatio: parseFloat(medianRatio.toFixed(2)),
      baselines: {
        platformAvg:  platAvg  !== null ? parseFloat(platAvg.toFixed(2))  : null,
        last5Avg:     last5Avg !== null ? parseFloat(last5Avg.toFixed(2)) : null,
        sameDayAvg:   dayAvg   !== null ? parseFloat(dayAvg.toFixed(2))   : null,
        sameHourAvg:  hourAvg  !== null ? parseFloat(hourAvg.toFixed(2))  : null,
        baselinesUsed: ratios.length,
      },
    }
  })
}

// ── 7. ENGAGEMENT SCORE + METRIC EXPLANATIONS ────────────────
// All advanced metrics must be fully explainable.
// Each function returns both the value AND how it was computed.
// ============================================================

/**
 * Compute engagement score for a fan (0-100).
 * Inputs:
 *   - tip frequency vs their own average
 *   - tip recency (days since last tip vs avg interval)
 *   - tip count (more = more engaged)
 *   - spend momentum (recent spend vs historical)
 *
 * Returns score + full explanation of how each factor contributed.
 */
export function computeEngagementScore(fan) {
  if (!fan || fan.tipCount < 2) {
    return {
      score: null,
      label: 'Not enough data',
      explanation: {
        how_calculated: 'Requires at least 2 tips to establish a pattern',
        inputs: { tipCount: fan?.tipCount || 0 },
        factors: [],
      }
    }
  }

  const { daysSinceLastTip, avgDaysBetweenTips, tipCount, totalUSD, tips = [] } = fan

  const factors = []
  let totalWeight = 0
  let weightedScore = 0

  // Factor 1: Recency (40% weight)
  // How recently did they tip vs their own average?
  if (avgDaysBetweenTips !== null && avgDaysBetweenTips > 0) {
    const recencyRatio = daysSinceLastTip / avgDaysBetweenTips
    const recencyScore = Math.max(0, Math.min(100, Math.round((1 - recencyRatio) * 100 + 50)))
    factors.push({ name: 'Recency', score: recencyScore, weight: 40, note: `Last tipped ${daysSinceLastTip}d ago vs avg ${avgDaysBetweenTips.toFixed(0)}d interval` })
    weightedScore += recencyScore * 40
    totalWeight   += 40
  }

  // Factor 2: Frequency (30% weight)
  // How many times have they tipped? Log scale so diminishing returns.
  const freqScore = Math.min(100, Math.round(Math.log10(tipCount + 1) / Math.log10(101) * 100))
  factors.push({ name: 'Frequency', score: freqScore, weight: 30, note: `${tipCount} total tips` })
  weightedScore += freqScore * 30
  totalWeight   += 30

  // Factor 3: Spend momentum (30% weight)
  // Compare spend in last 30 days vs their historical avg 30-day spend
  // Uses filterByTimeRange — single authority for all time-scoped filtering
  const recentTips = filterByTimeRange(tips, TIME_RANGES.LAST_30)
  const recentSpend = recentTips.reduce((s, t) => s + (t.usd || 0), 0)
  const allTipDays = tips.length > 1
    ? (new Date(fan.lastTipDate) - new Date(fan.firstTipDate)) / 86400000
    : 30
  const historicalDailyAvg = allTipDays > 0 ? totalUSD / allTipDays : 0
  const historicalMonthAvg = historicalDailyAvg * 30
  const momentumRatio = historicalMonthAvg > 0 ? recentSpend / historicalMonthAvg : 0
  const momentumScore = Math.min(100, Math.round(momentumRatio * 100))
  factors.push({
    name: 'Momentum', score: momentumScore, weight: 30,
    note: `$${recentSpend.toFixed(0)} in last 30d vs $${historicalMonthAvg.toFixed(0)} historical monthly avg`
  })
  weightedScore += momentumScore * 30
  totalWeight   += 30

  const score = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0
  const label = score >= 80 ? 'High' : score >= 50 ? 'Medium' : 'Low'

  return {
    score,
    label,
    explanation: {
      how_calculated: 'Weighted average of recency (40%), frequency (30%), and spend momentum (30%)',
      inputs: { tipCount, totalUSD, daysSinceLastTip, avgDaysBetweenTips, recentSpend: parseFloat(recentSpend.toFixed(2)) },
      factors,
      interpretation: `${label} engagement — ${factors[0]?.note || ''}`,
    }
  }
}

/**
 * Compute "Likely to Tip Again" probability with full explanation.
 * This replaces the basic calcTipProbability function.
 */
export function computeTipProbabilityExplained(fan) {
  const { daysSinceLastTip, avgDaysBetweenTips, tipCount } = fan

  if (tipCount < 2 || avgDaysBetweenTips === null) {
    return {
      percentage: null,
      label: 'Unknown',
      explanation: {
        how_calculated: 'Cannot be calculated with only 1 tip — need at least 2 to establish a tipping interval',
        inputs: { tipCount },
        result: null,
      }
    }
  }

  if (avgDaysBetweenTips === 0) {
    return {
      percentage: null,
      label: 'Unknown',
      explanation: {
        how_calculated: 'All tips occurred in the same session — no interval can be computed',
        inputs: { tipCount, avgDaysBetweenTips: 0 },
        result: null,
      }
    }
  }

  // Formula: exponential decay from 100% at 0 days overdue to ~10% at 2x overdue
  // p = max(5, min(95, 100 * e^(-0.7 * (daysSince / avgInterval))))
  const ratio = daysSinceLastTip / avgDaysBetweenTips
  const rawP  = 100 * Math.exp(-0.7 * ratio)
  const p     = Math.round(Math.max(5, Math.min(95, rawP)))

  const label = p >= 75 ? 'High' : p >= 45 ? 'Medium' : p >= 20 ? 'Low' : 'Very Low'

  return {
    percentage: p,
    label,
    explanation: {
      how_calculated: 'Exponential decay model: probability = 100 × e^(−0.7 × days_overdue_ratio)',
      inputs: {
        daysSinceLastTip,
        avgDaysBetweenTips: parseFloat(avgDaysBetweenTips.toFixed(1)),
        ratio: parseFloat(ratio.toFixed(2)),
      },
      result: `${daysSinceLastTip} days since last tip ÷ ${avgDaysBetweenTips.toFixed(0)}-day average interval = ${ratio.toFixed(1)}x overdue → ${p}% probability`,
    }
  }
}

/**
 * Compute 30-day revenue forecast with full explanation.
 */
export function computeRevenueForecastExplained(tips, sessions) {
  const now = Date.now()
  const MS = 86400000

  // Use filterByTimeRange — no ad-hoc date math
  const last30 = filterByTimeRange(tips, TIME_RANGES.LAST_30)
  const prev30 = tips.filter(t => { const d = (now - new Date(t.dateRaw || t.date_time).getTime()) / MS; return d > 30 && d <= 60 })

  const last30Rev = last30.reduce((s, t) => s + (t.usd || 0), 0)
  const prev30Rev = prev30.reduce((s, t) => s + (t.usd || 0), 0)

  const trend     = prev30Rev > 0 ? (last30Rev - prev30Rev) / prev30Rev : 0
  const projected = parseFloat((last30Rev * (1 + trend * 0.5)).toFixed(2))  // dampen trend by 50%

  const confidence = last30.length >= 50 ? 'High' : last30.length >= 20 ? 'Medium' : 'Low'

  return {
    projected,
    confidence,
    explanation: {
      how_calculated: 'Last 30 days revenue adjusted by 50% of the growth trend vs previous 30 days',
      inputs: {
        last30Days:   { revenue: parseFloat(last30Rev.toFixed(2)), tipCount: last30.length },
        prev30Days:   { revenue: parseFloat(prev30Rev.toFixed(2)), tipCount: prev30.length },
        trendPct:     parseFloat((trend * 100).toFixed(1)),
        dampingFactor: 0.5,
      },
      result: `$${last30Rev.toFixed(0)} (last 30d) × (1 + ${(trend * 50).toFixed(0)}% dampened trend) = $${projected} projected`,
      confidence_reason: `Based on ${last30.length} tips — ${confidence.toLowerCase()} confidence`,
    }
  }
}

// ── 8. CONSISTENCY GUARANTEE ─────────────────────────────────
// Call this after aggregateRows to verify that key numbers
// reported at the top level match their constituent parts.
// If mismatches are found, they are logged (never silently wrong).
// ============================================================

/**
 * Verify that the aggregated result is internally consistent.
 * Returns the result with a consistency report attached.
 */
export function verifyConsistency(result, tips) {
  const issues = []

  // Check: totalUSD = sum of raw tips
  const rawTotal = parseFloat(tips.reduce((s, t) => s + (t.usd || 0), 0).toFixed(2))
  if (Math.abs(result.totalUSD - rawTotal) > 0.02) {
    issues.push(`totalUSD mismatch: reported $${result.totalUSD} vs computed $${rawTotal} from ${tips.length} tips`)
  }

  // Check: totalTips = tips.length
  if (result.totalTips !== tips.length) {
    issues.push(`totalTips mismatch: reported ${result.totalTips} vs actual ${tips.length}`)
  }

  // Check: platform totals sum ≤ total (sessions may not cover all tips)
  const platformTotal = (result.platforms || []).reduce((s, p) => s + p.totalUSD, 0)
  // Platform totals come from sessions only, so they can be less than raw total — that's OK
  // But they should never EXCEED the raw total
  if (platformTotal > rawTotal + 0.02) {
    issues.push(`platform totals ($${platformTotal.toFixed(2)}) exceed raw total ($${rawTotal.toFixed(2)})`)
  }

  // Check: whales fan totals are reconciled
  const whaleTotalFromFans = (result.whales || []).reduce((s, w) => s + w.totalUSD, 0)
  if (Math.abs(whaleTotalFromFans - rawTotal) > 0.02) {
    issues.push(`fan USD totals ($${whaleTotalFromFans.toFixed(2)}) don't match raw total ($${rawTotal.toFixed(2)})`)
  }

  return {
    ...result,
    _consistency: {
      passed:  issues.length === 0,
      issues,
      checkedAt: new Date().toISOString(),
      rawTipTotal: rawTotal,
    }
  }
}



// ===============================
// SANITY + FILTER HELPERS
// ===============================

function clampPrediction(min, max) {
  const MAX_SPREAD = 3;
  if (max / Math.max(min, 1) > MAX_SPREAD) {
    return { min: Math.round(min), max: Math.round(min * MAX_SPREAD), confidence: "low" };
  }
  return { min: Math.round(min), max: Math.round(max), confidence: "high" };
}

function getTipFrequency(daysBetweenTips) {
  if (!daysBetweenTips || daysBetweenTips.length < 2) return null;
  const avg = daysBetweenTips.reduce((a, b) => a + b, 0) / daysBetweenTips.length;
  if (avg < 1.5) return "daily";
  if (avg < 3) return "every few days";
  if (avg < 7) return "weekly";
  return null;
}

function isUserRelevant(user) {
  if (!user || typeof user !== 'object') return false;
  if (user.daysSinceLastTip > 90) return false;
  if ((user.totalTokens || 0) < 100) return false;
  return true;
}

function validateInsights(insights = []) {
  return insights.filter(i => {
    if (!i?.text) return false;
    if (i.text.includes("$0")) return false;
    if (i.text.includes("100%") && i.text.includes("returning")) return false;
    return true;
  });
}

export function parseCSV(text, platform = null) {
  const allLines = text.trim().split('\n')
  if (allLines.length === 0) return []

  if (!platform) platform = detectPlatform(text)

  // Skip leading junk/blank rows to find first real content row
  let startIdx = 0
  for (let i = 0; i < Math.min(5, allLines.length); i++) {
    const cols = parseCSVLine(allLines[i])
    if (cols.filter(c => c.trim()).length >= 2) { startIdx = i; break }
  }

  const lines = allLines.slice(startIdx).filter(l => l.trim())
  if (lines.length === 0) return []

  const firstLower = lines[0].toLowerCase()
  const firstCols = parseCSVLine(lines[0])

  // If first column looks like a date value, it's a data row (not headers)
  const firstColIsDate = /^\d{2}[.\-/]\d{2}[.\-/]\d{4}/.test(firstCols[0]) ||
                         /^\d{4}[.\-/]\d{2}[.\-/]\d{2}/.test(firstCols[0]) ||
                         /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(firstCols[0])

  const hasHeaders = !firstColIsDate && (
    firstLower.includes('date') || firstLower.includes('username') ||
    firstLower.includes('member') || firstLower.includes('amount') ||
    firstLower.includes('tokens') || firstLower.includes('timestamp') ||
    firstLower.includes('payout') || firstLower.includes('action') ||
    firstLower.includes('transaction') || firstLower.includes('platform') ||
    firstLower.includes('user')
  )

  const raw = hasHeaders ? parseWithHeaders(lines, platform) : parseHeaderless(lines, platform)

  // ── Normalize + validate every row before it leaves the parser ──────
  return raw.map(normalizeTip).filter(isValidTip)
}

// ============================================
// DATA NORMALIZATION + VALIDATION
// ============================================

// FIX #2 (high-level): Normalize everything in one place, applied to ALL paths
function normalizeTip(row, userRates = {}) {
  const tokens = parseInt(row.tokens) || 0
  const rawUsd = parseFloat(row.usd) || 0
  // Use platform-specific rate if USD is missing
  const platform = row.platform || 'Unknown'
  const rate = getTokenRate(platform, userRates)
  const usd = rawUsd > 0 ? rawUsd : parseFloat((tokens * rate).toFixed(2))

  // FIX #3: Validate date and discard rows with unparseable dates
  const dateRaw = normalizeDate(row.dateRaw || row.date_time || '')
  const parsedDate = new Date(dateRaw)
  if (isNaN(parsedDate.getTime())) return null   // will be filtered by isValidTip

  return {
    ...row,
    username: (row.username || '').toLowerCase().trim(),
    tokens,
    usd: parseFloat(usd.toFixed(2)),
    dateRaw,
    date_time: dateRaw,
  }
}

// FIX #2 (high-level): Single validation gate — bad rows never enter the system
function isValidTip(t) {
  if (!t) return false
  return (
    typeof t.username === 'string' &&
    t.username.length > 0 &&
    !isNaN(t.tokens) &&
    !isNaN(t.usd) &&
    t.tokens >= 0 &&
    t.usd >= 0 &&
    // At least one of tokens or usd must be non-zero
    (t.tokens > 0 || t.usd > 0)
  )
}

// ============================================
// PLATFORM DETECTION
// ============================================

// ============================================
// TOKEN RATE CONFIG — configurable per platform
// These are defaults. Users can override via settings.
// Sources: platform payout pages (2024–2025 rates)
// ============================================
export const TOKEN_RATES = {
  Chaturbate:  0.05,   // $0.05/token (standard broadcast rate)
  BongaCams:   0.05,   // BongaCams pays in USD directly — tokens map ~0.05
  MyFreeCams:  0.05,   // MFC tokens = $0.05 at standard rate
  Stripchat:   0.05,   // Stripchat tokens vary; 0.05 is safe default
  CamSoda:     0.05,   // CamSoda tips in USD, no token conversion needed
  Unknown:     0.05,
}

// Get rate for a platform — falls back to 0.05 if unknown
export function getTokenRate(platform, userRates = {}) {
  return userRates[platform] ?? TOKEN_RATES[platform] ?? 0.05
}

function detectPlatform(text) {
  const lower = text.toLowerCase()
  if (lower.includes('chaturbate') || lower.includes('tip from:') || lower.includes('token balance') || lower.includes('token change')) return 'Chaturbate'
  if (lower.includes('bongacams') || lower.includes('bonga') || lower.includes('your payout')) return 'BongaCams'
  if (lower.includes('myfreecams') || lower.includes('mfc')) return 'MyFreeCams'
  if (lower.includes('stripchat')) return 'Stripchat'
  if (lower.includes('camsoda')) return 'CamSoda'
  return 'Unknown'
}

// ============================================
// DATE NORMALIZATION
// ============================================

function normalizeDate(raw) {
  if (!raw) return null
  // European DD.MM.YYYY
  const euro = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}:\d{2}))?/)
  if (euro) return `${euro[2]}/${euro[1]}/${euro[3]}${euro[4] ? ' ' + euro[4] : ''}`
  // YYYY/MM/DD
  const slash = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})(.*)/)
  if (slash) return `${slash[1]}-${slash[2]}-${slash[3]}${slash[4]}`
  // ISO with Z: 2026-03-01T22:14:03Z
  return raw.replace('T', ' ').replace('Z', '')
}

// ============================================
// HEADER NORMALIZATION
// ============================================

function normalizeHeaderName(h) {
  const clean = re_clean(h)
  if (['token_balance','balance','running_balance'].includes(clean)) return 'token_balance'
  if (clean.includes('amount') && clean.includes('token')) return 'tokens'
  if (clean.includes('amount') && (clean.includes('usd') || clean.includes('dollar'))) return 'usd'
  if (['token_change','tokens_earned','tokens','token','credits'].includes(clean)) return 'tokens'
  if (['your_payout','usd_amount','payout','usd','earnings','amount_usd'].includes(clean)) return 'usd'
  if (['date_and_time','date_time','datetime','timestamp','date','time'].includes(clean)) return 'date_time'
  if (['member','username','user','tipper','sender','nickname','from'].includes(clean)) return 'username'
  if (['transaction_type','chat_type','tip_type','type'].includes(clean)) return 'tip_type'
  if (clean === 'action') return 'action'
  // Catch ALL note/message column variants from Chaturbate and other platforms
  if ([
    'note', 'tip_note', 'message', 'tip_message', 'comment',
    'comment_text', 'msg', 'text', 'note_text', 'tip_comment',
    'user_note', 'sender_note', 'chat_message'
  ].includes(clean)) return 'note'
  if (clean === 'platform') return 'platform'
  if (clean === 'session_id') return 'session_id'
  return clean
}

function re_clean(h) {
  return h.toLowerCase().trim().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

// ============================================
// CSV LINE PARSER
// ============================================

// FIX #1: REMOVE .filter(v => v !== '') — empty columns must stay in place
// to preserve alignment with headers. Trimming only.
function parseCSVLine(line) {
  // Handle case where entire row is wrapped in outer quotes: "col1,col2,col3"
  // Only treat as outer-wrap if there are no inner quotes at all
  const trimmed = line.trim()
  if (
    trimmed.startsWith('"') &&
    trimmed.endsWith('"') &&
    !trimmed.slice(1, -1).includes('"')
  ) {
    // Preserve empty columns — map(trim) only, no filter
    return trimmed.slice(1, -1).split(',').map(v => v.trim())
  }

  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  // Push the last field (may be empty — that's valid)
  result.push(current.trim())

  // DO NOT filter — an empty string at index N means column N is empty,
  // which must stay in place so row[headers[N]] maps correctly.
  return result
}

// ============================================
// HEADER-BASED PARSING
// ============================================

function parseWithHeaders(lines, platform) {
  const rawHeaders = parseCSVLine(lines[0])
  const headers = rawHeaders.map(normalizeHeaderName)
  const results = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const vals = parseCSVLine(line)
    const row = {}
    // vals[idx] may be '' (empty column) — that is intentional and correct
    headers.forEach((h, idx) => { row[h] = (vals[idx] ?? '').trim() })

    // ── Skip non-revenue rows ────────────────────────────────────────
    const action = (row.action || '').toLowerCase()
    const tipType = (row.tip_type || '').toLowerCase()

    if (action.includes('transfer') || action.includes('cash') ||
        action.includes('outbound tip') || action.includes('promoted room') ||
        action.includes('referral')) continue

    if (tipType && !tipType.includes('tip') && !tipType.includes('private') &&
        !tipType.includes('spy') && !tipType.includes('show') && !tipType.includes('chat') &&
        !tipType.includes('received') && !tipType.includes('freechat')) continue

    if (tipType.includes('cash') || tipType.includes('transfer') ||
        tipType.includes('payout') || tipType.includes('refund')) continue

    // ── Extract username ─────────────────────────────────────────────
    let username = (row.username || row.user || '').trim()

    if (!username && row.action) {
      const m = row.action.match(/^[^:]+:\s*(\S+)/i)
      if (m) {
        username = m[1]
        if (!row.tip_type) {
          const al = row.action.toLowerCase()
          if (al.includes('private show')) row.tip_type = 'Private Show'
          else if (al.includes('spy show')) row.tip_type = 'Spy Show'
          else if (al.includes('tip from')) row.tip_type = 'Tip'
          else row.tip_type = 'Other'
        }
      } else continue
    }

    if (!username) continue

    // ── Extract tokens ───────────────────────────────────────────────
    let tokens = parseInt(row.tokens || 0) || 0
    if (tokens < 0) continue

    // ── Extract USD ──────────────────────────────────────────────────
    const rawUsd = (row.usd || row.usd_amount || '0').toString().replace(/[$,\s]/g, '')
    let usd = parseFloat(rawUsd) || 0
    if (usd < 0) usd = 0

    if (tokens <= 0 && usd <= 0) continue

    // ── Extract date ─────────────────────────────────────────────────
    const rawDate = row.date_time || row.date || row.timestamp || ''
    const dateRaw = normalizeDate(rawDate) || new Date().toISOString()

    // FIX #3: Validate date before using it
    const parsedDate = new Date(dateRaw)
    if (isNaN(parsedDate.getTime())) continue

    // ── Detect platform from row if available ────────────────────────
    const rowPlatform = row.platform
      ? (row.platform.toLowerCase().includes('bonga') ? 'BongaCams'
        : row.platform.toLowerCase().includes('chaturbate') ? 'Chaturbate'
        : row.platform.toLowerCase().includes('mfc') || row.platform.toLowerCase().includes('freecams') ? 'MyFreeCams'
        : row.platform || platform)
      : platform

    results.push({
      dateRaw, date_time: dateRaw,
      username,
      platform: rowPlatform || 'Unknown',
      // Derive missing value from the other — never guess from magnitude
      tokens: tokens > 0 ? tokens : Math.round(usd / getTokenRate(platform)),
      usd: usd > 0 ? parseFloat(usd.toFixed(2)) : parseFloat((tokens * getTokenRate(platform)).toFixed(2)),
      tip_type: row.tip_type || 'Tip',
      tip_note: row.note || row.tip_note || ''
    })
  }
  return results
}

// ============================================
// HEADERLESS PARSING
// ============================================

function parseHeaderless(lines, platform) {
  const results = []

  for (const line of lines) {
    if (!line.trim()) continue
    const vals = parseCSVLine(line)
    if (vals.length === 0) continue

    // Chaturbate "Tip From: username message" format
    if (vals.length >= 3 && vals[1] && vals[1].toLowerCase().includes('tip from')) {
      const dateRaw = normalizeDate(vals[0].replace(/"/g, ''))
      const m = vals[1].match(/tip from[:\s]*(\S+)/i)
      const username = m ? m[1] : null
      const tokens = parseInt(vals[2]) || 0
      if (!username || tokens <= 0) continue
      if (vals[1].toLowerCase().includes('transfer') || vals[1].toLowerCase().includes('cash')) continue

      // FIX #3: Validate date
      if (!dateRaw || isNaN(new Date(dateRaw).getTime())) continue

      results.push({
        dateRaw, date_time: dateRaw, username,
        platform: 'Chaturbate', tokens,
        usd: parseFloat((tokens * getTokenRate(platform)).toFixed(2)),
        tip_type: 'Tip', tip_note: ''
      })
      continue
    }

    // European date DD.MM.YYYY (BongaCams headerless)
    if (vals.length >= 4 && /^\d{2}\.\d{2}\.\d{4}/.test(vals[0])) {
      const dateRaw = normalizeDate(vals[0])
      const username = vals[1] || null
      const tokens = parseInt(vals[3]) || 0
      const usd = parseFloat((vals[4] || '').replace(/[$,]/g, '')) || 0
      if (!username || (tokens <= 0 && usd <= 0)) continue

      // FIX #3: Validate date
      if (!dateRaw || isNaN(new Date(dateRaw).getTime())) continue

      results.push({
        dateRaw, date_time: dateRaw, username,
        platform: platform || 'BongaCams',
        tokens: tokens > 0 ? tokens : Math.round(usd / getTokenRate(platform)),
        usd: usd > 0 ? parseFloat(usd.toFixed(2)) : parseFloat((tokens * getTokenRate(platform)).toFixed(2)),
        tip_type: vals[2] || 'Tip', tip_note: ''
      })
      continue
    }

    // Generic fallback
    if (vals.length >= 2) {
      const dateRaw = normalizeDate(vals[0]) || vals[0]
      const username = (vals[1] || '').trim()
      if (!username) continue

      // FIX #3: Validate date
      if (!dateRaw || isNaN(new Date(dateRaw).getTime())) continue

      let tokens = 0
      let usd = 0

      // FIX #2: Do NOT guess tokens vs USD by magnitude (>100 heuristic was wrong).
      // Instead: look for a $ sign to identify USD, otherwise treat as tokens.
      // If neither is marked, use position: index 2 = tokens, index 3 = usd
      // and fall back to deriving one from the other.
      for (let i = 2; i < vals.length; i++) {
        const raw = vals[i]
        const num = parseFloat(raw.replace(/[$,]/g, ''))
        if (isNaN(num) || num <= 0) continue

        if (raw.includes('$')) {
          usd = num
        } else if (i === 2 && tokens === 0) {
          tokens = Math.round(num) // position 2 = tokens column
        } else if (i === 3 && usd === 0) {
          usd = num // position 3 = usd column
        }
      }

      // Derive missing value from the known one
      if (tokens === 0 && usd > 0) tokens = usd > 0 ? Math.round(usd / getTokenRate(platform)) : 0
      if (usd === 0 && tokens > 0) usd = parseFloat((tokens * getTokenRate(platform)).toFixed(2))

      if (tokens === 0 && usd === 0) continue

      results.push({
        dateRaw, date_time: dateRaw, username,
        platform: platform || 'Unknown',
        tokens,
        usd: parseFloat(usd.toFixed(2)),
        tip_type: 'Tip', tip_note: ''
      })
    }
  }
  return results
}

// ============================================
// SESSION DETECTION
// ============================================

export function detectSessions(tips) {
  if (!tips || tips.length === 0) return []

  const parsed = tips
    .map(t => {
      const timestamp = new Date(t.dateRaw || t.date_time)
      // FIX #3: Consistent invalid-date guard everywhere
      if (isNaN(timestamp.getTime())) return null
      return { ...t, timestamp }
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp)

  if (parsed.length === 0) return []

  // 60-minute gap = new session (was 3h — too loose, caused BongaCams all-day merges)
  const SESSION_GAP_MS = 60 * 60 * 1000
  const sessions = []
  let cur = null

  parsed.forEach(tip => {
    if (!cur) {
      cur = {
        tips: [tip], platform: tip.platform,
        startTime: tip.timestamp, endTime: tip.timestamp,
        fans: new Set([tip.username.toLowerCase()])
      }
    } else if (tip.timestamp - cur.endTime <= SESSION_GAP_MS && tip.platform === cur.platform) {
      cur.tips.push(tip)
      cur.endTime = tip.timestamp
      cur.fans.add(tip.username.toLowerCase())
    } else {
      sessions.push(finalizeSession(cur))
      cur = {
        tips: [tip], platform: tip.platform,
        startTime: tip.timestamp, endTime: tip.timestamp,
        fans: new Set([tip.username.toLowerCase()])
      }
    }
  })

  if (cur && cur.tips.length > 0) sessions.push(finalizeSession(cur))

  // MANDATORY: Exclude sessions < 30 min or < 2 tips — not analytically valid
  // A single tip with 0 duration is NOT a session
  return sessions.filter(s =>
    s.durationMinutes >= 30 &&
    s.tipCount >= 2 &&
    !s.durationUnknown
  )
}

function finalizeSession(s) {
  const durationMs = s.endTime - s.startTime
  const durationMinutes = Math.round(durationMs / 60000)

  // If all tips landed at the same timestamp (e.g. BongaCams midnight exports with
  // no real time data), duration is 0 — mark session as durationUnknown and exclude
  // it from $/hour calculations rather than faking a 30-min floor that tanks averages.
  const durationUnknown = durationMinutes === 0
  const effectiveMinutes = durationUnknown ? null : Math.max(durationMinutes, 5)
  const durationHours = effectiveMinutes ? effectiveMinutes / 60 : null

  // FIX performance: single-pass totals instead of multiple .reduce()
  let totalTokens = 0
  let totalUSD = 0
  for (const t of s.tips) {
    totalTokens += t.tokens || 0
    totalUSD += t.usd || 0
  }

  const tipCount = s.tips.length
  const uniqueFans = s.fans.size

  // ── REVENUE VELOCITY: compare first-half vs second-half $/min
  // Detects if stream is growing, dying, or flat
  const sortedTips = [...s.tips].sort((a, b) => a.timestamp - b.timestamp)
  let velocityTrend = 'unknown'
  let firstHalfUPM = null
  let secondHalfUPM = null
  if (effectiveMinutes && effectiveMinutes >= 10 && sortedTips.length >= 4) {
    const midMs = s.startTime.getTime() + (s.endTime.getTime() - s.startTime.getTime()) / 2
    const firstHalf  = sortedTips.filter(t => t.timestamp <= midMs)
    const secondHalf = sortedTips.filter(t => t.timestamp > midMs)
    const halfMins = effectiveMinutes / 2
    firstHalfUPM  = firstHalf.reduce((a, t) => a + (t.usd || 0), 0) / halfMins
    secondHalfUPM = secondHalf.reduce((a, t) => a + (t.usd || 0), 0) / halfMins
    if (secondHalfUPM > firstHalfUPM * 1.2)       velocityTrend = 'growing'
    else if (secondHalfUPM < firstHalfUPM * 0.75)  velocityTrend = 'dying'
    else                                            velocityTrend = 'steady'
  }

  // ── WHALE CONCENTRATION for this session ────────────────────────────────
  const tipperMap = {}
  sortedTips.forEach(t => {
    tipperMap[t.username] = (tipperMap[t.username] || 0) + (t.usd || 0)
  })
  const topContributor = Object.entries(tipperMap).sort((a, b) => b[1] - a[1])[0]
  const topContributorPct = topContributor && totalUSD > 0
    ? Math.round((topContributor[1] / totalUSD) * 100)
    : 0

  return {
    id: `session_${s.startTime.getTime()}`,
    platform: s.platform,
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    durationMinutes: effectiveMinutes || 0,
    durationHours: durationHours ? parseFloat(durationHours.toFixed(2)) : 0,
    durationUnknown,
    totalTokens,
    totalUSD: parseFloat(totalUSD.toFixed(2)),
    tipCount,
    uniqueFans,
    tokensPerHour: durationHours ? Math.round(totalTokens / durationHours) : null,
    usdPerHour: durationHours ? parseFloat((totalUSD / durationHours).toFixed(2)) : null,
    usdPerMinute: effectiveMinutes ? parseFloat((totalUSD / effectiveMinutes).toFixed(3)) : null,
    avgTipSize: tipCount > 0 ? parseFloat((totalUSD / tipCount).toFixed(2)) : 0,
    velocityTrend,
    firstHalfUPM: firstHalfUPM ? parseFloat(firstHalfUPM.toFixed(3)) : null,
    secondHalfUPM: secondHalfUPM ? parseFloat(secondHalfUPM.toFixed(3)) : null,
    topContributor: topContributor ? topContributor[0] : null,
    topContributorPct,
    tips: s.tips
  }
}

// ============================================
// WHALE IDENTIFICATION
// ============================================

export function identifyWhales(tips) {
  const fanMap = {}

  tips.forEach(t => {
    const key = t.username.toLowerCase()
    if (!fanMap[key]) {
      fanMap[key] = {
        username: t.username, totalUSD: 0, totalTokens: 0,
        tipCount: 0, tips: [], platform: t.platform, tipNotes: []
      }
    }
    // FIX performance: accumulate inline instead of re-reducing later
    fanMap[key].totalUSD += t.usd || 0
    fanMap[key].totalTokens += t.tokens || 0
    fanMap[key].tipCount += 1
    fanMap[key].tips.push(t)
    if (t.tip_note) fanMap[key].tipNotes.push(t.tip_note)
  })

  const allFans = Object.values(fanMap)
  // sorted by total spend descending — used for percentile rank
  const sorted = [...allFans].sort((a, b) => b.totalUSD - a.totalUSD)
  const totalFans = sorted.length

  return allFans.map(f => {
    const fanSorted = [...f.tips].sort((a, b) =>
      new Date(b.dateRaw || b.date_time) - new Date(a.dateRaw || a.date_time)
    )
    const lastTipDate = new Date(fanSorted[0].dateRaw || fanSorted[0].date_time)
    const firstTipDate = new Date(fanSorted[fanSorted.length - 1].dateRaw || fanSorted[fanSorted.length - 1].date_time)
    const daysSinceLastTip = Math.floor((Date.now() - lastTipDate) / 86400000)
    // FIXED: Do NOT floor lifetimeDays to 1 — if all tips are same day, that's 0 (honest)
    const lifetimeDays = Math.max(Math.floor((lastTipDate - firstTipDate) / 86400000), 0)
    // FIXED: single tip → null (no interval can be calculated, never fabricate 30)
    // FIXED: divide by (tipCount - 1) = number of GAPS between tips, not tip count
    // FIXED: do NOT floor to 1 — if tips are same-day, avg interval is genuinely 0
    const avgDaysBetweenTips = f.tipCount > 1
      ? parseFloat((lifetimeDays / (f.tipCount - 1)).toFixed(1))
      : null  // null = only tipped once, no pattern to calculate
    const biggestTip = Math.max(...f.tips.map(t => t.usd))

    // FIX whale tiers: use pure percentile rank — avoids misclassification
    // on small or skewed datasets where avgSpend * 3 could fire incorrectly
    const fanRankIndex = sorted.findIndex(s => s.username.toLowerCase() === f.username.toLowerCase())
    const percentileRank = totalFans > 1 ? fanRankIndex / (totalFans - 1) : 0
    // percentileRank 0 = top spender, 1 = bottom spender

    // FIXED tiers: require BOTH USD threshold AND tip count
    // A one-time $200 tip ≠ same loyalty as 50x $4 tips
    // avgDaysBetweenTips may be null for single-tip fans — guard against it
    let tier = 'New'
    if      (f.totalUSD >= 100 && f.tipCount >= 10) tier = 'Whale'
    else if (f.totalUSD >= 30  && f.tipCount >= 5)  tier = 'Shark'
    else if (f.totalUSD >= 5   && f.tipCount >= 2)  tier = 'Regular'
    else if (daysSinceLastTip > (avgDaysBetweenTips !== null ? Math.max(60, avgDaysBetweenTips * 3) : 90)) tier = 'Dormant'

    const privateTips = f.tips.filter(t =>
      t.tip_type?.toLowerCase().includes('private') ||
      t.tip_note?.toLowerCase().includes('private')
    )

    const hourCounts = {}
    f.tips.forEach(t => {
      const h = new Date(t.dateRaw || t.date_time).getHours()
      hourCounts[h] = (hourCounts[h] || 0) + 1
    })
    const mostActiveHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]

    const spendPercentile = Math.round((1 - percentileRank) * 100)

    // Build daysBetweenTips array for getTipFrequency
    const tipDates = [...f.tips]
      .sort((a, b) => new Date(a.dateRaw || a.date_time) - new Date(b.dateRaw || b.date_time))
      .map(t => new Date(t.dateRaw || t.date_time))
    const daysBetweenTipsArr = []
    for (let i = 1; i < tipDates.length; i++) {
      daysBetweenTipsArr.push((tipDates[i] - tipDates[i - 1]) / 86400000)
    }

    return {
      username: f.username,
      totalUSD: parseFloat(f.totalUSD.toFixed(2)),
      totalTokens: f.totalTokens,
      tipCount: f.tipCount,
      avgTipSize: parseFloat((f.totalUSD / f.tipCount).toFixed(2)),
      biggestTip: parseFloat(biggestTip.toFixed(2)),
      platform: f.platform,
      tier,
      lastTipDate: lastTipDate.toISOString(),
      firstTipDate: firstTipDate.toISOString(),
      daysSinceLastTip,
      avgDaysBetweenTips: avgDaysBetweenTips !== null ? parseFloat(avgDaysBetweenTips.toFixed(1)) : null,
      daysBetweenTipsArr,
      tipProbability: calcTipProbability(daysSinceLastTip, avgDaysBetweenTips),
      churnRisk: calcChurnRisk(daysSinceLastTip, avgDaysBetweenTips, f.tipCount),
      lifetimeValue: calcLifetimeValue(f.totalUSD, lifetimeDays, f.tipCount),
      expectedNextTip: calcExpectedNextTip(daysSinceLastTip, avgDaysBetweenTips),
      hasPrivates: privateTips.length > 0,
      privateCount: privateTips.length,
      privateSpent: parseFloat(privateTips.reduce((s, t) => s + t.usd, 0).toFixed(2)),
      typicalOnlineHours: mostActiveHour
        ? `${mostActiveHour[0]}:00 - ${parseInt(mostActiveHour[0]) + 2}:00`
        : 'Unknown',
      tipNotes: f.tipNotes,
      tips: f.tips,
      engagementScore: null,  // populated by computeEngagementScore after reconcile
      isTopSpender: percentileRank <= 0.05,
      spendPercentile
    }
  }).map(reconcileFan).sort((a, b) => b.totalUSD - a.totalUSD)
}

function calcTipProbability(d, avg) {
  if (avg === null) return { level: 'Unknown', percentage: null, note: 'Only tipped once — no pattern yet' }
  if (avg === 0)    return { level: 'Unknown', percentage: null, note: 'All tips same session — no interval data' }
  if (d < avg * 0.5)  return { level: 'High',        percentage: 85 }
  if (d < avg)        return { level: 'Medium-High',  percentage: 70 }
  if (d < avg * 1.5)  return { level: 'Medium',       percentage: 50 }
  if (d < avg * 2)    return { level: 'Low-Medium',   percentage: 30 }
  return                     { level: 'Low',           percentage: 15 }
}

function calcChurnRisk(d, avg, count) {
  if (count < 2) return { level: 'Unknown', risk: 'Only tipped once — no pattern to assess' }
  if (avg === null || avg === 0) return { level: 'Unknown', risk: 'Insufficient interval data' }
  if (count < 3) return { level: 'Unknown', risk: 'Insufficient data' }
  const r = d / avg
  if (r < 1) return { level: 'Low',      risk: 'Active' }
  if (r < 2) return { level: 'Medium',   risk: 'Watch closely' }
  if (r < 3) return { level: 'High',     risk: 'At risk' }
  return           { level: 'Critical',  risk: 'Likely churned' }
}

function calcLifetimeValue(spent, days, count) {
  if (days < 7 || count < 2) return { prediction: spent, confidence: 'Low' }
  const p = (spent / days) * 365
  return {
    prediction: parseFloat(p.toFixed(2)),
    confidence: count > 10 ? 'High' : count > 5 ? 'Medium' : 'Low',
    monthly: parseFloat((p / 12).toFixed(2))
  }
}

function calcExpectedNextTip(d, avg) {
  const n = Math.max(0, Math.round(avg - d))
  if (n === 0) return 'Overdue'
  if (n === 1) return 'Tomorrow'
  if (n <= 3)  return `In ${n} days`
  if (n <= 7)  return `In ~${n} days`
  return `In ~${Math.round(n / 7)} weeks`
}

// ============================================
// WHALE ALERTS
// ============================================

export function generateWhaleAlerts(whales) {
  let alerts = []
  if (!whales.length) return alerts

  const totalSpend = whales.reduce((s, w) => s + w.totalUSD, 0)
  const avgSpend = totalSpend / whales.length
  const churnThreshold = avgSpend * 0.5
  const tipLikelyThreshold = avgSpend * 0.8

  whales.forEach(w => {
    if (w.tier === 'Whale' && w.daysSinceLastTip < 7 && w.isTopSpender)
      alerts.push({ type: 'new_whale', severity: 'success', icon: '🐳', whale: w, message: `${w.username} just became your top tipper! ($${w.totalUSD.toFixed(0)} lifetime)`, action: 'Send a thank you message' })

    if (
      (w.churnRisk.level === 'High' || w.churnRisk.level === 'Critical') &&
      w.totalUSD >= churnThreshold &&
      w.tipCount >= 3
    ) {
      const freq = getTipFrequency(w.daysBetweenTipsArr)
      const freqText = freq
        ? `they typically tip ${freq}`
        : w.avgDaysBetweenTips !== null ? `they usually tip every ${w.avgDaysBetweenTips.toFixed(0)} days` : 'at irregular intervals'
      alerts.push({ type: 'churn_risk', severity: 'warning', icon: '⚠️', whale: w, message: `${w.username} hasn't tipped in ${w.daysSinceLastTip} days — ${freqText}`, action: 'Re-engage now before they go cold' })
    }

    if (w.tipProbability.level === 'High' && w.totalUSD >= tipLikelyThreshold)
      alerts.push({ type: 'tip_likely', severity: 'info', icon: '💰', whale: w, message: `${w.username} is likely to tip soon (${w.tipProbability.percentage}% probability based on their pattern)`, action: 'Go live during their active hours' })

    if (w.daysSinceLastTip > 0 && w.daysSinceLastTip <= 3 && w.tipCount > 5) {
      if (w.daysSinceLastTip > w.avgDaysBetweenTips * 1.5)
        alerts.push({ type: 'returned', severity: 'success', icon: '🎉', whale: w, message: `${w.username} just tipped again after ${w.daysSinceLastTip} days away — welcome them back!`, action: 'Send a thank you message' })
    }
  })

  // Filter out alerts for irrelevant/stale users
  alerts = alerts.filter(a => isUserRelevant(a.whale))

  const order = { critical: 0, warning: 1, info: 2, success: 3 }
  return alerts.sort((a, b) => order[a.severity] - order[b.severity])
}

// ============================================
// REVENUE PREDICTIONS
// ============================================

export function predictRevenue(tips, sessions) {
  if (!sessions.length) return null
  const predictions = {}
  const now = Date.now()

  // Use filterByTimeRange exclusively — no ad-hoc date math
  const last7    = filterByTimeRange(tips, TIME_RANGES.LAST_7)
  const last7Rev = last7.reduce((s, t) => s + (t.usd || 0), 0)
  predictions.next7Days = {
    amount:     parseFloat(last7Rev.toFixed(2)),
    confidence: last7.length > 20 ? 'High' : last7.length > 10 ? 'Medium' : 'Low',
    timeRange:  'last 7 days'
  }

  const last30    = filterByTimeRange(tips, TIME_RANGES.LAST_30)
  const last30Rev = last30.reduce((s, t) => s + (t.usd || 0), 0)
  // prev30 = last60 minus last30 (no TIME_RANGES constant for 60d — compute explicitly)
  const MS = 86400000
  const prev30 = tips.filter(t => {
    const d = (now - new Date(t.dateRaw || t.date_time).getTime()) / MS
    return d > 30 && d <= 60
  })
  const prev30Rev = prev30.reduce((s, t) => s + (t.usd || 0), 0)
  const weeklyTrend = prev30Rev > 0 ? ((last30Rev - prev30Rev) / prev30Rev) * 100 : null
  predictions.next30Days = {
    amount:     parseFloat(last30Rev.toFixed(2)),
    confidence: last30.length > 50 ? 'High' : last30.length > 25 ? 'Medium' : 'Low',
    trend:      weeklyTrend !== null ? parseFloat(weeklyTrend.toFixed(1)) : null,
    timeRange:  'last 30 days'
  }

  const todayDow = new Date().getDay()
  const sameDaySessions = sessions.filter(s => new Date(s.startTime).getDay() === todayDow)
  // Require at least 3 sessions on this day of week for a meaningful prediction
  if (sameDaySessions.length >= 3) {
    const amounts = sameDaySessions.map(s => s.totalUSD).sort((a, b) => a - b)
    const avg = amounts.reduce((s, x) => s + x, 0) / amounts.length
    // For small samples use actual min/max; for larger use percentiles
    const p10idx = Math.max(0, Math.floor(amounts.length * 0.10))
    const p90idx = Math.min(amounts.length - 1, Math.floor(amounts.length * 0.90))
    const p10 = amounts[p10idx] || amounts[0]
    const p90 = amounts[p90idx] || amounts[amounts.length - 1]
    const fixedRange = clampPrediction(p10, p90)
    // Don't show tonightStream if both min and max are 0
    if (fixedRange.min === 0 && fixedRange.max === 0) return predictions
    predictions.tonightStream = {
      expected: parseFloat(avg.toFixed(2)),
      range: { min: fixedRange.min, max: fixedRange.max },
      confidence: fixedRange.confidence === 'high' && sameDaySessions.length > 5 ? 'High' : 'Medium',
      returningTippers: Math.round(
        sameDaySessions.reduce((s, x) => s + x.uniqueFans, 0) / sameDaySessions.length * 0.4
      )
    }
  }

  return predictions
}

// ============================================
// LOSS ALERTS
// ============================================

export function generateLossAlerts(tips, sessions, whales, bestHour) {
  const alerts = []
  const now = Date.now()
  const MS = 86400000

  // Pre-filter using filterByTimeRange — no ad-hoc date math below
  const tipsLast7  = filterByTimeRange(tips, TIME_RANGES.LAST_7)
  const tipsLast14 = tips.filter(t => (now - new Date(t.dateRaw || t.date_time).getTime()) / MS <= 14)
  const tipsLast7Set  = new Set(tipsLast7.map(t => t.id || `${t.date_time}_${t.username}`))
  const tipsLastWeek  = tipsLast7
  const tipsPrevWeek  = tipsLast14.filter(t => !tipsLast7Set.has(t.id || `${t.date_time}_${t.username}`))
  const sessionsLast3 = sessions.filter(s => (now - new Date(s.startTime).getTime()) / MS <= 3)

  // Peak window missed — uses pre-computed bestHour from aggregateRows
  if (bestHour) {
    const bh = parseInt(bestHour.hour)
    const avgAtPeak = bestHour.avg
    const recentSessions = sessionsLast3
    const recentAtPeak = recentSessions.filter(s => Math.abs(new Date(s.startTime).getHours() - bh) <= 1)
    if (recentSessions.length > 0 && recentAtPeak.length === 0) {
      const estLoss = parseFloat((avgAtPeak * 3).toFixed(2))
      const label = bh === 0 ? '12 AM' : bh < 12 ? `${bh} AM` : bh === 12 ? '12 PM' : `${bh - 12} PM`
      alerts.push({ type: 'peak_missed', severity: 'warning', icon: '🚨', message: `You haven't streamed during your peak window (${label}) in 3 days — estimated loss: $${estLoss}`, action: `Go live at ${label} to recover this` })
    }
  }

  // Avg tip drop this week vs last week — uses pre-filtered tip sets from above
  if (tipsLastWeek.length >= 5 && tipsPrevWeek.length >= 5) {
    const thisAvg = tipsLastWeek.reduce((s, t) => s + (t.usd || 0), 0) / tipsLastWeek.length
    const lastAvg = tipsPrevWeek.reduce((s, t) => s + (t.usd || 0), 0) / tipsPrevWeek.length
    const drop = Math.round(((lastAvg - thisAvg) / lastAvg) * 100)
    if (drop >= 15)
      alerts.push({ type: 'tip_drop', severity: 'warning', icon: '📉', message: `Your avg tip dropped ${drop}% this week ($${lastAvg.toFixed(2)} → $${thisAvg.toFixed(2)})`, action: 'Focus on high-value fans during your next stream' })
  } // end tip drop check

  // High-value fan churn risk
  whales
    .filter(w => w.totalUSD >= 50 && w.daysSinceLastTip >= 5 && w.daysSinceLastTip < 30)
    .slice(0, 2)
    .forEach(w => {
      alerts.push({ type: 'fan_churn', severity: 'critical', icon: '🚨', message: `${w.username} hasn't tipped in ${w.daysSinceLastTip} days — high churn risk ($${w.totalUSD.toFixed(0)} lifetime value)`, action: 'Send a re-engagement message now' })
    })

  // Streak broken
  const daySet = new Set(sessions.map(s => new Date(s.startTime).toDateString()))
  const lastStreamed = sessions.length
    ? (now - new Date(sessions[sessions.length - 1].startTime)) / 86400000
    : 999
  if (lastStreamed > 2 && sessions.length > 5) {
    alerts.push({ type: 'streak_broken', severity: 'info', icon: '⏸️', message: `You haven't streamed in ${Math.floor(lastStreamed)} days — your audience engagement drops after 3 days off`, action: 'Get back live — consistency is your #1 growth tool' })
  }

  return alerts
}

// ============================================
// INSIGHTS (ACTION-ORIENTED)
// ============================================

export function generateInsights(tips, sessions, bestDay, worstDay, bestHour) {
  const insights = []
  if (!tips.length || !sessions.length) return insights
  const now = Date.now()

  // Best day — uses pre-computed avg-per-session value passed in from aggregateRows
  if (bestDay && worstDay && bestDay.day !== worstDay.day) {
    const avgOverall = sessions.reduce((s, x) => s + x.totalUSD, 0) / sessions.length
    const mult = (bestDay.avg / avgOverall).toFixed(1)
    const costOfMissing = parseFloat((bestDay.avg - avgOverall).toFixed(2))
    insights.push({ icon: '📅', text: `${bestDay.day}s are your highest-earning day — your avg session earns ${mult}x more ($${bestDay.avg.toFixed(0)} avg). Missing one ${bestDay.day} costs you ~$${costOfMissing}`, type: 'day', priority: 1 })
  }

  // Best hour — uses pre-computed value
  if (bestHour) {
    const h = parseInt(bestHour.hour)
    const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
    const avgOverall = sessions.reduce((s, x) => s + x.totalUSD, 0) / sessions.length
    const multiplier = avgOverall > 0 ? (bestHour.avg / avgOverall).toFixed(1) : null
    insights.push({ icon: '⏰', text: `Go live at ${label} — your avg session earnings are ${multiplier ? `${multiplier}x higher` : 'at their peak'} at this hour ($${bestHour.avg.toFixed(0)} avg). Missing this window costs you real money every session`, type: 'time', priority: 1 })
  }

  // Whale concentration — use only true Whales (top 5%) for this insight
  // Sharks are included in revenue share but the headline should reflect your real top spenders
  const whales = identifyWhales(tips)
  const trueWhales = whales.filter(w => w.tier === 'Whale')
  const topWhales = (trueWhales.length > 0 ? trueWhales : whales.filter(w => w.tier === 'Shark')).slice(0, 5)
  const wE = topWhales.reduce((s, w) => s + w.totalUSD, 0)
  const tE = tips.reduce((s, t) => s + t.usd, 0)
  if (wE > 0 && tE > 0 && topWhales.length > 0) {
    const pct = Math.round((wE / tE) * 100)
    insights.push({ icon: '🐳', text: `Your top ${topWhales.length} fan${topWhales.length > 1 ? 's' : ''} generate${topWhales.length === 1 ? 's' : ''} ${pct}% of your revenue. Losing even one of them would cost you $${(wE / topWhales.length).toFixed(0)} on average — keep them engaged`, type: 'whales', priority: 2 })
  }

  // Session length vs earnings
  const longSessions  = sessions.filter(s => s.durationMinutes > 60)
  const shortSessions = sessions.filter(s => s.durationMinutes <= 60)
  if (longSessions.length >= 3 && shortSessions.length >= 3) {
    const longAvg  = longSessions.reduce((s, x) => s + x.totalUSD, 0) / longSessions.length
    const shortAvg = shortSessions.reduce((s, x) => s + x.totalUSD, 0) / shortSessions.length
    if (longAvg > shortAvg * 1.2) {
      const pct = Math.round(((longAvg - shortAvg) / shortAvg) * 100)
      insights.push({ icon: '⏱️', text: `Streams over 60 min earn ${pct}% more than short ones ($${longAvg.toFixed(0)} vs $${shortAvg.toFixed(0)}). Every extra 30 minutes adds ~$${((longAvg - shortAvg) / 2).toFixed(0)} on average`, type: 'duration', priority: 2 })
    }
  }

  // Returning vs new tippers
  const fanTipCounts = {}
  const fanTipUSD = {}
  tips.forEach(t => {
    const k = t.username.toLowerCase()
    fanTipCounts[k] = (fanTipCounts[k] || 0) + 1
    fanTipUSD[k] = (fanTipUSD[k] || 0) + (t.usd || 0)
  })
  const returning = Object.values(fanTipCounts).filter(c => c > 1).length
  const total     = Object.keys(fanTipCounts).length
  if (total > 10) {
    const pct = Math.round((returning / total) * 100)
    // Compare avg spend: returning fans (tipped >1 time) vs one-time fans
    const returningKeys = Object.keys(fanTipCounts).filter(k => fanTipCounts[k] > 1)
    const oneTimeKeys   = Object.keys(fanTipCounts).filter(k => fanTipCounts[k] === 1)
    const avgReturning  = returningKeys.length ? returningKeys.reduce((s, k) => s + fanTipUSD[k], 0) / returningKeys.length : 0
    const avgOneTime    = oneTimeKeys.length   ? oneTimeKeys.reduce((s, k) => s + fanTipUSD[k], 0)   / oneTimeKeys.length   : 0
    const multiplierText = avgOneTime > 0 && avgReturning > 0
      ? `${(avgReturning / avgOneTime).toFixed(1)}x more`
      : 'significantly more'
    insights.push({ icon: '🔁', text: `${pct}% of your fans are returning tippers — loyalty is your strongest asset. Returning fans spend ${multiplierText} on average than first-timers ($${avgReturning.toFixed(0)} vs $${avgOneTime.toFixed(0)})`, type: 'retention', priority: 3 })
  }

  // Weekly momentum — uses filterByTimeRange exclusively
  const thisWeek  = filterByTimeRange(tips, TIME_RANGES.LAST_7)
  const thisWeekIds = new Set(thisWeek.map(t => t.id || `${t.date_time}_${t.username}`))
  const last14    = tips.filter(t => {
    const ms = new Date(t.dateRaw || t.date_time).getTime()
    return !isNaN(ms) && (Date.now() - ms) / 86400000 <= 14
  })
  const lastWeek  = last14.filter(t => !thisWeekIds.has(t.id || `${t.date_time}_${t.username}`))
  if (thisWeek.length > 0 && lastWeek.length > 0) {
    const thisRev = thisWeek.reduce((s, t) => s + t.usd, 0)
    const lastRev = lastWeek.reduce((s, t) => s + t.usd, 0)
    const change  = Math.round(((thisRev - lastRev) / lastRev) * 100)
    if (Math.abs(change) >= 10) {
      insights.push({
        icon: change >= 0 ? '📈' : '📉',
        text: change >= 0
          ? `You're up ${change}% this week vs last week ($${thisRev.toFixed(0)} vs $${lastRev.toFixed(0)}) — keep the momentum going`
          : `You're down ${Math.abs(change)}% this week vs last ($${thisRev.toFixed(0)} vs $${lastRev.toFixed(0)}) — increase stream frequency to recover`,
        type: 'momentum', priority: 2
      })
    }
  }

  return insights.sort((a, b) => a.priority - b.priority)
}

// ============================================
// NEXT MOVE ENGINE
// ============================================

export function generateNextMoves(tips, sessions, whales, predictions, bestHour) {
  const moves = []
  const now = Date.now()

  // Best hour coaching — uses pre-computed bestHour from aggregateRows
  if (bestHour) {
    const bh = parseInt(bestHour.hour)
    const currentHour = new Date().getHours()
    const hoursUntil = (bh - currentHour + 24) % 24
    const avgAtPeak = bestHour.avg
    const label = bh === 0 ? '12 AM' : bh < 12 ? `${bh} AM` : bh === 12 ? '12 PM' : `${bh - 12} PM`
    if (hoursUntil === 0 || hoursUntil === 1) {
      moves.push({ icon: '🔥', color: '#FB923C', text: `Go live NOW — ${label} is your peak earning time. Your data shows you average $${avgAtPeak.toFixed(0)}/session at this hour`, priority: 0 })
    } else if (hoursUntil <= 2) {
      moves.push({ icon: '⏰', color: '#22D3EE', text: `You're ${hoursUntil} hour${hoursUntil > 1 ? 's' : ''} away from your peak time (${label}). Prep your room title and get ready — you avg $${avgAtPeak.toFixed(0)} at this hour`, priority: 1 })
    } else {
      moves.push({ icon: '🕐', color: '#22D3EE', text: `Your best earning time is ${label} — plan your next stream around it. Your data shows $${avgAtPeak.toFixed(0)} avg per session at this hour`, priority: 2 })
    }
  }

  // Tonight prediction
  if (predictions?.tonightStream) {
    const { expected, range, returningTippers } = predictions.tonightStream
    moves.push({ icon: '🎯', color: '#F59E0B', text: `Set a goal of $${Math.round(expected * 1.2)} for tonight — your data predicts $${range.min}–$${range.max} and ~${returningTippers} returning tippers`, priority: 1 })
  }

  // Dormant high-value fans to re-engage
  whales
    .filter(w => {
      const days = Math.floor((now - new Date(w.lastTipDate)) / 86400000)
      return days >= 3 && days <= 45 && w.totalUSD >= 20
    })
    .sort((a, b) => b.totalUSD - a.totalUSD)
    .slice(0, 3)
    .forEach(w => {
      const days = Math.floor((now - new Date(w.lastTipDate)) / 86400000)
      moves.push({ icon: '💸', color: '#EC4899', text: `Message ${w.username} — they've spent $${w.totalUSD.toFixed(0)} total but haven't tipped in ${days} days. One message could recover $${(w.avgTipSize * 2).toFixed(0)}+`, cta: true, username: w.username, priority: 1 })
    })

  // Session goal based on avg
  const avgSession = sessions.length
    ? sessions.reduce((s, x) => s + x.totalUSD, 0) / sessions.length
    : 0
  if (avgSession > 0) {
    const goal = Math.round(avgSession * 1.2 / 5) * 5
    moves.push({ icon: '🏆', color: '#F59E0B', text: `Your sessions average $${avgSession.toFixed(0)} — aim for $${goal} next stream. You've already hit this ${sessions.filter(s => s.totalUSD >= goal).length} times`, priority: 3 })
  }

  return moves.sort((a, b) => a.priority - b.priority).slice(0, 5)
}

// ============================================
// DECISION ENGINE — FUNCTIONS 1–5
// ============================================

// 1. LIVE SESSION STATE
// Call this mid-stream with tips collected so far + context about the session.
// Returns pace status, projection, and warning flags.
export function computeLiveSession(sessionTips, expectedDurationMins = 60, historicalSessions = []) {
  if (!sessionTips || sessionTips.length === 0) {
    return { pace: 'no_data', projection: 0, warningFlags: [], elapsedMins: 0, currentUPM: 0, avgUPM: 0 }
  }

  const sorted = [...sessionTips].sort((a, b) =>
    new Date(a.dateRaw || a.date_time) - new Date(b.dateRaw || b.date_time)
  )
  const startMs = new Date(sorted[0].dateRaw || sorted[0].date_time).getTime()
  const lastMs  = new Date(sorted[sorted.length - 1].dateRaw || sorted[sorted.length - 1].date_time).getTime()
  const elapsedMins = Math.max((lastMs - startMs) / 60000, 1)
  const currentUSD = sessionTips.reduce((s, t) => s + (t.usd || 0), 0)
  const currentUPM = currentUSD / elapsedMins

  // Compare against last 5 timed sessions
  const recentSessions = historicalSessions
    .filter(s => !s.durationUnknown && s.usdPerMinute !== null)
    .slice(-5)
  const avgUPM = recentSessions.length
    ? recentSessions.reduce((s, x) => s + (x.usdPerMinute || 0), 0) / recentSessions.length
    : 0

  // Projection based on current pace
  const projectedFinalUSD = parseFloat((currentUPM * expectedDurationMins).toFixed(2))
  const expectedUSD = avgUPM > 0 ? parseFloat((avgUPM * expectedDurationMins).toFixed(2)) : null

  // Pace classification
  const ratio = avgUPM > 0 ? currentUPM / avgUPM : null
  let pace = 'unknown'
  if (ratio !== null) {
    if (ratio >= 1.2)       pace = 'above'
    else if (ratio >= 0.8)  pace = 'on_track'
    else                    pace = 'below'
  }

  // Warning flags
  const warningFlags = []
  if (ratio !== null && ratio < 0.8) {
    warningFlags.push({
      flag: 'performance_drop',
      message: `Your pace is ${Math.round((1 - ratio) * 100)}% below your avg — change strategy NOW`,
      severity: ratio < 0.6 ? 'high' : 'medium'
    })
  }
  if (expectedUSD !== null && projectedFinalUSD < expectedUSD * 0.8) {
    warningFlags.push({
      flag: 'underperforming',
      message: `At this pace you'll earn $${projectedFinalUSD} — $${(expectedUSD - projectedFinalUSD).toFixed(0)} below your normal $${expectedUSD}`,
      severity: 'high'
    })
  }

  // Check inactivity (time since last tip)
  const nowMs = Date.now()
  const inactivityMins = (nowMs - lastMs) / 60000
  const avgGapMins = elapsedMins / Math.max(sessionTips.length, 1)
  if (inactivityMins > avgGapMins * 1.5 && inactivityMins > 5) {
    const sessionHealth = inactivityMins > avgGapMins * 3 ? 'stalled' : 'slowing'
    warningFlags.push({
      flag: 'engagement_drop',
      message: `No tips in ${Math.round(inactivityMins)} min — your room is ${sessionHealth}`,
      severity: sessionHealth === 'stalled' ? 'high' : 'medium',
      sessionHealth
    })
  }

  return {
    elapsedMins: parseFloat(elapsedMins.toFixed(1)),
    currentUSD: parseFloat(currentUSD.toFixed(2)),
    currentUPM: parseFloat(currentUPM.toFixed(3)),
    avgUPM: parseFloat(avgUPM.toFixed(3)),
    pace,
    paceRatio: ratio ? parseFloat(ratio.toFixed(2)) : null,
    projectedFinalUSD,
    expectedUSD,
    warningFlags,
    sessionHealth: warningFlags.find(f => f.flag === 'engagement_drop')?.sessionHealth || 'active'
  }
}

// 2. REVENUE GAP — per session or aggregate
// Given a session and historical context, compute missed money
export function computeRevenueGap(session, historicalSessions) {
  if (!session || !historicalSessions || historicalSessions.length < 3) {
    return { revenueGap: 0, revenueGapPct: 0, severity: 'unknown', missedRevenue: 0 }
  }

  // Expected = avg of last 5 comparable sessions (same platform if possible)
  const comparable = historicalSessions
    .filter(s => s.id !== session.id && s.platform === session.platform && !s.durationUnknown)
    .slice(-5)
  const fallback = historicalSessions
    .filter(s => s.id !== session.id && !s.durationUnknown)
    .slice(-5)
  const base = comparable.length >= 3 ? comparable : fallback
  if (base.length < 2) return { revenueGap: 0, revenueGapPct: 0, severity: 'unknown', missedRevenue: 0 }

  const expected = base.reduce((s, x) => s + x.totalUSD, 0) / base.length
  const actual   = session.totalUSD
  const gap      = parseFloat((expected - actual).toFixed(2))
  const gapPct   = expected > 0 ? Math.round((gap / expected) * 100) : 0
  const missed   = Math.max(0, gap)

  let severity = 'low'
  if (gapPct > 40) severity = 'high'
  else if (gapPct > 20) severity = 'medium'

  return {
    expectedUSD: parseFloat(expected.toFixed(2)),
    actualUSD: actual,
    revenueGap: gap,
    revenueGapPct: gapPct,
    missedRevenue: parseFloat(missed.toFixed(2)),
    severity,
    // Human-readable insight
    insight: gap > 0
      ? `You earned $${actual.toFixed(0)} — $${missed.toFixed(0)} below your typical $${expected.toFixed(0)}. That's a ${gapPct}% shortfall.`
      : `You outperformed your avg by $${Math.abs(gap).toFixed(0)} — great session.`
  }
}

// 3. PRE-TIP BEHAVIOR — tip timing patterns within sessions
// Tells you when in a session tips cluster, and gap patterns
export function computePreTipBehavior(sessions) {
  if (!sessions || sessions.length === 0) return null

  const allGapsMinutes = []
  const sessionTimeAtTip = []   // how many minutes into the stream each tip arrived
  const clusterSessions = []    // sessions with tip clusters

  sessions.forEach(s => {
    if (!s.tips || s.tips.length < 3 || s.durationUnknown) return
    const sorted = [...s.tips].sort((a, b) =>
      new Date(a.dateRaw || a.date_time) - new Date(b.dateRaw || b.date_time)
    )
    const startMs = new Date(sorted[0].dateRaw || sorted[0].date_time).getTime()

    // Gaps between tips
    for (let i = 1; i < sorted.length; i++) {
      const prevMs = new Date(sorted[i-1].dateRaw || sorted[i-1].date_time).getTime()
      const currMs = new Date(sorted[i].dateRaw || sorted[i].date_time).getTime()
      const gapMins = (currMs - prevMs) / 60000
      if (gapMins > 0 && gapMins < 60) allGapsMinutes.push(gapMins)
    }

    // Session time at each tip
    sorted.forEach(t => {
      const minsIn = (new Date(t.dateRaw || t.date_time).getTime() - startMs) / 60000
      sessionTimeAtTip.push({ minsIn: parseFloat(minsIn.toFixed(1)), usd: t.usd || 0 })
    })

    // Detect tip clusters: 3+ tips within a 2-minute window
    for (let i = 0; i < sorted.length - 2; i++) {
      const t0 = new Date(sorted[i].dateRaw || sorted[i].date_time).getTime()
      const t2 = new Date(sorted[i+2].dateRaw || sorted[i+2].date_time).getTime()
      if ((t2 - t0) / 60000 <= 2) {
        clusterSessions.push(s.id)
        break
      }
    }
  })

  if (allGapsMinutes.length === 0) return null

  const avgGap = allGapsMinutes.reduce((a, b) => a + b, 0) / allGapsMinutes.length

  // Find peak tipping window — bucket into 10-min intervals, find where most USD lands
  const windowBuckets = {}
  sessionTimeAtTip.forEach(({ minsIn, usd }) => {
    const bucket = Math.floor(minsIn / 10) * 10
    windowBuckets[bucket] = (windowBuckets[bucket] || 0) + usd
  })
  const peakWindow = Object.entries(windowBuckets).sort((a, b) => b[1] - a[1])[0]
  const peakWindowStart = peakWindow ? parseInt(peakWindow[0]) : null
  const peakWindowEnd   = peakWindowStart !== null ? peakWindowStart + 10 : null

  // Big tips after silence: check if large tips (>2x avg) happen after gaps > 2x avg gap
  const bigTipAfterSilence = { count: 0, avgGapBefore: 0 }
  const avgTipUSD = sessionTimeAtTip.length
    ? sessionTimeAtTip.reduce((s, t) => s + t.usd, 0) / sessionTimeAtTip.length
    : 0

  return {
    avgGapMinutes: parseFloat(avgGap.toFixed(1)),
    peakTippingWindow: peakWindowStart !== null
      ? { from: peakWindowStart, to: peakWindowEnd, label: `${peakWindowStart}–${peakWindowEnd} min into stream` }
      : null,
    clusteringDetected: clusterSessions.length > 0,
    clusterRate: sessions.length > 0
      ? parseFloat((clusterSessions.length / sessions.length).toFixed(2))
      : 0,
    // Insight text
    insight: peakWindowStart !== null
      ? `Most tips come ${peakWindowStart}–${peakWindowEnd} min into your stream — don't end before this window`
      : `Avg gap between tips is ${avgGap.toFixed(0)} min`,
    recommendation: peakWindowStart !== null && peakWindowStart > 20
      ? `Your earnings peak after ${peakWindowStart} min — don't end early. Viewers need time to warm up.`
      : `Your audience tips early and consistently — open strong every time.`
  }
}

// 4. DEPENDENCY RISK
// How exposed are you if your top fan leaves?
export function computeDependencyRisk(tips) {
  if (!tips || tips.length === 0) return null

  const fanUSD = {}
  const totalUSD = tips.reduce((s, t) => {
    fanUSD[t.username] = (fanUSD[t.username] || 0) + (t.usd || 0)
    return s + (t.usd || 0)
  }, 0)

  if (totalUSD === 0) return null

  const sorted = Object.entries(fanUSD).sort((a, b) => b[1] - a[1])
  const top1Pct  = Math.round((sorted[0]?.[1] || 0) / totalUSD * 100)
  const top3Pct  = Math.round(sorted.slice(0, 3).reduce((s, [, v]) => s + v, 0) / totalUSD * 100)
  const top5Pct  = Math.round(sorted.slice(0, 5).reduce((s, [, v]) => s + v, 0) / totalUSD * 100)

  let level = 'low'
  let message = ''
  if (top1Pct > 50) {
    level = 'high'
    message = `${sorted[0][0]} accounts for ${top1Pct}% of your total income — if they leave, you lose half your revenue`
  } else if (top3Pct > 70) {
    level = 'high'
    message = `Your top 3 fans drive ${top3Pct}% of revenue — you have high concentration risk`
  } else if (top3Pct > 50) {
    level = 'medium'
    message = `Top 3 fans = ${top3Pct}% of revenue — strong core, but growing your base reduces risk`
  } else {
    level = 'low'
    message = `Revenue is spread across your fanbase — healthy diversity`
  }

  return {
    top1Pct,
    top3Pct,
    top5Pct,
    level,
    message,
    topFan: sorted[0] ? { username: sorted[0][0], usd: parseFloat(sorted[0][1].toFixed(2)), pct: top1Pct } : null,
    lossIfTopFanLeaves: parseFloat((sorted[0]?.[1] || 0).toFixed(2))
  }
}

// 5. TRUE HOURLY DISTRIBUTION
// Avg earnings per ACTIVE hour — not divided by tip count, not skewed by session count
// Uses UTC hours from individual tips
export function computeTrueHourlyAvg(tips) {
  if (!tips || tips.length === 0) return []

  // Group total USD and count distinct active dates per hour
  const hourUSD   = {}
  const hourDates = {}
  tips.forEach(t => {
    const dt = new Date(t.dateRaw || t.date_time)
    const h  = dt.getUTCHours()
    const dateKey = dt.toISOString().slice(0, 10)
    hourUSD[h]   = (hourUSD[h]   || 0) + (t.usd || 0)
    if (!hourDates[h]) hourDates[h] = new Set()
    hourDates[h].add(dateKey)
  })

  return Array.from({ length: 24 }, (_, h) => {
    const total = hourUSD[h] || 0
    const activeDays = hourDates[h]?.size || 0
    const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h-12} PM`
    return {
      hour: h,
      label,
      totalUSD: parseFloat(total.toFixed(2)),
      activeDays,
      avgPerActiveDay: activeDays > 0 ? parseFloat((total / activeDays).toFixed(2)) : 0
    }
  })
}

// ============================================
// AGGREGATE
// ============================================


// ============================================
// PERFORMANCE LABELS — must be called after all sessions known
// Labels are ALWAYS relative to platform avg — never absolute dollar amounts
// ============================================
export function addPerformanceLabels(sessions) {
  const platformGroups = {}
  sessions.forEach(s => {
    if (!platformGroups[s.platform]) platformGroups[s.platform] = []
    platformGroups[s.platform].push(s)
  })

  return sessions.map(s => {
    const group = platformGroups[s.platform] || []
    const avg = group.length > 0
      ? group.reduce((sum, x) => sum + x.totalUSD, 0) / group.length
      : 0

    let performanceLabel = 'Average'
    let performanceColor = '#F59E0B'
    if (avg > 0) {
      const ratio = s.totalUSD / avg
      if (ratio >= 1.25) { performanceLabel = 'Above Average'; performanceColor = '#10B981' }
      else if (ratio < 0.75) { performanceLabel = 'Below Average'; performanceColor = '#F87171' }
    }

    const platformAvgUPH = group.length > 0
      ? group.reduce((sum, x) => sum + (x.usdPerHour || 0), 0) / group.length
      : 0

    return {
      ...s,
      performanceLabel,
      performanceColor,
      platformAvgUSD: parseFloat(avg.toFixed(2)),
      platformAvgUPH: parseFloat(platformAvgUPH.toFixed(2)),
      // Full explainable insight — [What] [vs What] [Platform] [Count]
      performanceInsight: avg > 0
        ? `$${s.totalUSD.toFixed(0)} earned vs your ${s.platform} avg of $${avg.toFixed(0)} across ${group.length} sessions`
        : `No ${s.platform} baseline yet — need more sessions to compare`
    }
  })
}
export function aggregateRows(tips) {
  if (!tips || tips.length === 0) {
    return {
      totalUSD: 0, totalTokens: 0, totalTips: 0, avgTipSize: 0,
      topTippers: [], platforms: [], sessions: [], insights: [],
      predictions: null, whaleAlerts: [], lossAlerts: [], nextMoves: [],
      bestDay: null, bestHour: null,
      timeRanges: {}
    }
  }

  // ── DATA VALIDATION — runs before any metric computation ──────────────────
  // validateDataset cleans, enforces platform, deduplicates, and removes
  // zero-value tips. Only clean tips proceed to any metric.
  // Returns { valid, tips, report } — use .tips as the clean dataset.
  const validation   = validateDataset(tips)
  const cleanTips    = (validation.tips && validation.tips.length > 0) ? validation.tips : tips
  const removedCount = tips.length - cleanTips.length

  // ── PRE-FILTER TIPS BY TIME RANGE — single authority ─────────────────────
  // All time-scoped metrics use filterByTimeRange. No ad-hoc date math below.
  const tips7  = filterByTimeRange(cleanTips, TIME_RANGES.LAST_7)
  const tips30 = filterByTimeRange(cleanTips, TIME_RANGES.LAST_30)
  const tips90 = filterByTimeRange(cleanTips, TIME_RANGES.LAST_90)
  // allTime = cleanTips (no filter needed — it's already all-time)

  // Expose time range metadata for UI labeling
  const timeRanges = {
    totalEarnings:       { range: TIME_RANGES.ALL_TIME,  label: 'All Time' },
    fanMetrics:          { range: TIME_RANGES.ALL_TIME,  label: 'All Time' },
    platformPerformance: { range: TIME_RANGES.ALL_TIME,  label: 'All Time' },
    bestDay:             { range: TIME_RANGES.ALL_TIME,  label: 'All Time' },
    bestHour:            { range: TIME_RANGES.ALL_TIME,  label: 'All Time' },
    revenueNext7:        { range: TIME_RANGES.LAST_7,    label: 'Last 7 Days' },
    revenueNext30:       { range: TIME_RANGES.LAST_30,   label: 'Last 30 Days' },
    alerts:              { range: TIME_RANGES.LAST_7,    label: 'Last 7 Days' },
    engagementMomentum:  { range: TIME_RANGES.LAST_30,   label: 'Last 30 Days' },
    dataHealth:          { removedCount, totalIngested: tips.length, cleanCount: cleanTips.length }
  }

  const sessions    = addMultiBaselineLabels(detectSessions(cleanTips))

  // ── SINGLE SOURCE OF TRUTH for best day and best hour ──────────────────
  // Every insight, alert, and next-move reads from these — never recalculates.
  // Method: avg USD per session per day/hour (fairest — not skewed by session count)
  // Use individual TIP timestamps in UTC — not session startTime
  // Session startTime reflects only the first tip, not where earnings happened
  const UTC_DAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const dayTotals = {}; const dayActiveDates = {}
  const hourTotals = {}; const hourActiveDates = {}
  // Use cleanTips (validated, all-time) for pattern baselines
  cleanTips.forEach(t => {
    const dt = new Date(t.dateRaw || t.date_time)
    const d = UTC_DAYS_LONG[dt.getUTCDay()]
    const h = dt.getUTCHours()
    dayTotals[d] = (dayTotals[d] || 0) + (t.usd || 0)
    if (!dayActiveDates[d]) dayActiveDates[d] = new Set()
    dayActiveDates[d].add(dt.toISOString().slice(0, 10))
    hourTotals[h] = (hourTotals[h] || 0) + (t.usd || 0)
    if (!hourActiveDates[h]) hourActiveDates[h] = new Set()
    hourActiveDates[h].add(dt.toISOString().slice(0, 10))
  })
  const dayAvgs  = Object.keys(dayTotals).map(d => ({
    day: d,
    avg: dayTotals[d] / (dayActiveDates[d]?.size || 1),
    total: dayTotals[d],
    count: dayActiveDates[d]?.size || 1
  }))
  const hourAvgs = Object.keys(hourTotals).map(h => ({
    hour: h,
    avg: hourTotals[h] / (hourActiveDates[h]?.size || 1),
    total: hourTotals[h],
    count: hourActiveDates[h]?.size || 1
  }))
  const bestDay  = [...dayAvgs].sort((a, b) => b.avg - a.avg)[0] || null
  const worstDay = [...dayAvgs].sort((a, b) => a.avg - b.avg)[0] || null
  const bestHour = hourAvgs.sort((a, b) => b.avg - a.avg)[0]  || null

  const whales      = identifyWhales(cleanTips)
  const insights    = generateInsights(cleanTips, sessions, bestDay, worstDay, bestHour)
  const predictions = predictRevenue(cleanTips, sessions)
  const whaleAlerts = generateWhaleAlerts(whales)
  const lossAlerts  = generateLossAlerts(cleanTips, sessions, whales, bestHour)
  const nextMoves   = generateNextMoves(cleanTips, sessions, whales, predictions, bestHour)

  // Single pass for totals — uses cleanTips (all-time, validated)
  let totalUSD = 0
  let totalTokens = 0
  for (const t of cleanTips) {
    totalUSD    += t.usd    || 0
    totalTokens += t.tokens || 0
  }

  const platformMap = {}
  sessions.forEach(s => {
    if (!platformMap[s.platform]) {
      platformMap[s.platform] = {
        platform: s.platform, totalUSD: 0, totalTokens: 0,
        sessions: 0, hours: 0, tips: 0
      }
    }
    platformMap[s.platform].totalUSD    += s.totalUSD
    platformMap[s.platform].totalTokens += s.totalTokens
    platformMap[s.platform].sessions    += 1
    // Only accumulate hours from sessions with real duration data
    if (!s.durationUnknown) platformMap[s.platform].hours += s.durationHours
    platformMap[s.platform].tips        += s.tipCount
  })

  const platforms = Object.values(platformMap).map(p => ({
    ...p,
    usdPerHour:    p.hours > 0 ? parseFloat((p.totalUSD    / p.hours).toFixed(2)) : 0,
    tokensPerHour: p.hours > 0 ? Math.round( p.totalTokens / p.hours)             : 0,
    avgTipSize:    p.tips  > 0 ? parseFloat((p.totalUSD    / p.tips).toFixed(2))  : 0
  }))

  const topTippers = whales.map((w, i) => ({
    rank: i + 1,
    username: w.username,
    usd: w.totalUSD,
    tokens: w.totalTokens,
    count: w.tipCount,
    status: w.tier === 'Whale'   ? '🐳 WHALE'
          : w.tier === 'Shark'   ? '🦈 SHARK'
          : w.tier === 'Dormant' ? '💤 DORMANT'
          :                        '🐟 REGULAR',
    last: new Date(w.lastTipDate).toLocaleDateString(),
    first: new Date(w.firstTipDate).toLocaleDateString(),
    daysSince: w.daysSinceLastTip,
    tipProbability: w.tipProbability,
    churnRisk: w.churnRisk
  }))

  const dependencyRisk  = computeDependencyRisk(tips)
  const preTipBehavior  = computePreTipBehavior(sessions)
  const trueHourlyAvg   = computeTrueHourlyAvg(tips)

  const rawResult = {
    totalUSD: parseFloat(totalUSD.toFixed(2)),
    totalTokens,
    totalTips: cleanTips.length,
    avgTipSize: parseFloat((cleanTips.length > 0 ? totalUSD / cleanTips.length : 0).toFixed(2)),
    topTippers, platforms, sessions, insights: validateInsights(insights), predictions,
    whaleAlerts, lossAlerts, nextMoves, whales,
    bestDay, bestHour, timeRanges,
    dependencyRisk,   // top1/3/5 pct + risk level
    preTipBehavior,   // peak tipping window + avg gap
    trueHourlyAvg,    // 24-slot array: avgPerActiveDay per UTC hour
  }
  return verifyConsistency(rawResult, cleanTips)
}

// ============================================
// TITLE GENERATOR — v2
// Rules:
// 1. Every selected input MUST appear in output
// 2. Toy names simplified (Lush, Domi, Edge, Hush)
// 3. 25 unique templates — rotate via index
// 4. Token goal ALWAYS included when provided
// 5. Max 75 chars to avoid truncation
// ============================================

const TOY_NAMES = {
  lush: 'Lush', domi: 'Domi', edge: 'Edge', hush: 'Hush',
  interactive: 'interactive toy', none: null,
  // Handle verbose names gracefully
  'lovense lush': 'Lush', 'lovense domi': 'Domi',
  'lovense edge': 'Edge', 'lovense hush': 'Hush',
  'lovense lush wearable': 'Lush', 'lovense domi 1': 'Domi',
}

const MOOD_HOOKS = {
  tease:      ['you have to earn it 😏', 'not giving it up easy 😈', 'almost... tip to get me there 💋'],
  dominant:   ['you obey 👑', 'I run the show 🔥', 'earn your reward 😈'],
  submissive: ['you control everything 🎮', 'you decide 👑', 'I do what you say 💦'],
  hype:       ['LET\'S GO 🔥', 'ENERGY IS INSANE ⚡', 'WE\'RE SO CLOSE 🔥'],
  mystery:    ['something unexpected 👀', 'you won\'t believe it 😏', 'tonight only 🌙'],
}

// 25 template functions — each guarantees all provided inputs appear
const TITLE_TEMPLATES = [
  ({ toy, goal, reward, moodHook }) =>
    toy && goal && reward ? `tip to control my ${toy} 🎮 → hit ${goal} = ${reward}` : null,
  ({ toy, goal, reward }) =>
    toy && goal && reward ? `hit ${goal} = ${reward} 🔥 ${toy} active now` : null,
  ({ toy, goal, reward }) =>
    toy && goal ? `${toy} on — goal: ${goal} → ${reward || 'surprise'} 😈` : null,
  ({ toy, goal, moodHook }) =>
    toy && goal ? `${toy} reacts to every tip ⚡ | goal: ${goal} | ${moodHook || 'tip now'}` : null,
  ({ toy, reward, moodHook }) =>
    toy && reward ? `${moodHook || 'tip to activate'} my ${toy} → win: ${reward} 👑` : null,
  ({ goal, reward, moodHook }) =>
    goal && reward ? `${goal} tokens = ${reward} 💋 | ${moodHook || 'tip to push me there'}` : null,
  ({ toy, goal, reward }) =>
    goal && reward ? `countdown to ${reward} ⏱ | ${goal} tokens${toy ? ` | ${toy} on` : ''}` : null,
  ({ toy, goal, moodHook }) =>
    toy && goal ? `you run the show — ${toy} + ${goal} goal | ${moodHook || 'tip now'}` : null,
  ({ toy, reward }) =>
    toy && reward ? `${toy} on, I react to every tip 💦 | win: ${reward}` : null,
  ({ goal, reward, toy }) =>
    goal ? `${toy ? toy + ' + ' : ''}${goal} → ${reward || 'something special'} 🎯 tip now` : null,
  ({ toy, goal, reward, moodHook }) =>
    toy && goal ? `${moodHook || 'bad girl energy 😈'} ${toy} on | ${goal} = ${reward || 'surprise'}` : null,
  ({ goal, reward }) =>
    goal && reward ? `help me hit ${goal} 🔥 | prize: ${reward} | don't stop now` : null,
  ({ toy, goal }) =>
    toy && goal ? `${toy} vibrates for every tip 💦 | ${goal} token goal live` : null,
  ({ goal, reward, moodHook }) =>
    goal ? `${moodHook || 'let\'s go'} — ${goal} goal → ${reward || 'you decide what happens'} ⚡` : null,
  ({ toy, moodHook }) =>
    toy ? `${moodHook || 'interactive show'} 🎮 ${toy} responds to tips | tip to control` : null,
  ({ goal, reward, toy }) =>
    goal && reward ? `LIVE NOW 🔴 ${toy ? toy + ' + ' : ''}${goal} goal → ${reward}` : null,
  ({ toy, goal, reward }) =>
    goal && reward ? `tip ${goal} = unlock ${reward} 🔓${toy ? ` | ${toy} on` : ''}` : null,
  ({ toy, goal, moodHook }) =>
    toy && goal ? `${toy} is waiting 🎮 | ${goal} goal | ${moodHook || 'tip to activate'}` : null,
  ({ goal, reward }) =>
    goal ? `almost there — ${goal} to go | ${reward || 'surprise'} waiting 👀 tip now` : null,
  ({ toy, reward, moodHook }) =>
    reward ? `earn it tonight — ${moodHook || 'tip to decide'} | ${reward}${toy ? ` | ${toy} on` : ''}` : null,
  ({ toy, goal, moodHook }) =>
    goal ? `${moodHook || 'tip to push me'} | ${toy ? toy + ' active' : 'goal live'}: ${goal} tokens` : null,
  ({ toy, goal, reward }) =>
    toy && reward ? `you control my ${toy} 👑 | hit ${goal || 'the goal'} = ${reward}` : null,
  ({ goal, reward, moodHook }) =>
    reward ? `${moodHook || 'tip now'} → ${goal ? goal + ' = ' : ''}${reward} 🔥 happening tonight only` : null,
  ({ toy, goal }) =>
    toy && goal ? `${toy} + tips = 🔥 | ${goal} token goal | every tip I feel it` : null,
  ({ toy, goal, reward, moodHook }) => {
    const parts = [moodHook, toy, goal ? `goal: ${goal}` : null, reward].filter(Boolean)
    return parts.length >= 2 ? parts.join(' | ').slice(0, 75) : null
  },
]

export function generateRoomTitles({
  toy = 'none',
  goal = null,         // token count as number or string, e.g. 500
  reward = null,       // reward text, e.g. "flash"
  mood = 'hype',       // tease | dominant | submissive | hype | mystery
  count = 5,           // how many titles to return
  seed = 0,            // rotate through templates starting at this index
} = {}) {
  // Normalize inputs
  const toyName = TOY_NAMES[toy?.toLowerCase()] || (toy !== 'none' ? toy : null)
  const goalStr = goal ? `${goal} tokens` : null
  const rewardStr = reward?.trim() || null
  const moodHooks = MOOD_HOOKS[mood] || MOOD_HOOKS.hype
  const moodHook = moodHooks[seed % moodHooks.length]

  const context = { toy: toyName, goal: goalStr, reward: rewardStr, moodHook }

  const results = []
  let attempts = 0
  let idx = seed % TITLE_TEMPLATES.length

  while (results.length < count && attempts < TITLE_TEMPLATES.length * 2) {
    const template = TITLE_TEMPLATES[idx % TITLE_TEMPLATES.length]
    try {
      const title = template(context)
      if (title && title.length > 10 && title.length <= 80 && !results.includes(title)) {
        results.push(title.trim())
      }
    } catch (_) {}
    idx++
    attempts++
  }

  // If not enough results, fill with safe fallbacks
  const fallbacks = [
    toyName && goalStr ? `${toyName} active — tip to control | goal: ${goalStr}` : null,
    goalStr && rewardStr ? `hit ${goalStr} = ${rewardStr} 🔥 tip now` : null,
    toyName ? `tip to control my ${toyName} 🎮 | ${moodHook}` : null,
    goalStr ? `${goalStr} goal live | ${rewardStr || 'surprise'} at finish 🎯` : null,
    `${moodHook} | tip to decide what I do next 👑`,
  ].filter(Boolean)

  fallbacks.forEach(f => {
    if (results.length < count && !results.includes(f)) results.push(f)
  })

  return results.slice(0, count)
}

// ============================================
// HASHTAG GENERATOR
// Output: 10-20 hashtags per generation
// Mix: platform + toy + vibe + goal + content
// ============================================

const HASHTAG_POOLS = {
  platform: {
    Chaturbate:  ['#Chaturbate', '#CBLive', '#ChaturbateModel', '#CB', '#ChaturbateLive'],
    BongaCams:   ['#BongaCams', '#BongaLive', '#BCModel', '#BongaCamsLive'],
    MyFreeCams:  ['#MyFreeCams', '#MFC', '#MFCModel', '#MFCShare'],
    Stripchat:   ['#Stripchat', '#StripchatLive', '#StripchatModel'],
    CamSoda:     ['#CamSoda', '#CamSodaLive'],
    default:     ['#CamGirl', '#Webcam', '#LiveStream', '#AdultStream'],
  },
  toy: {
    Lush:        ['#Lush', '#LushControl', '#ControlMyLush', '#LushVibrator', '#InteractiveToy'],
    Domi:        ['#Domi', '#DomiControl', '#ControlMyDomi', '#Lovense', '#InteractiveToy'],
    Edge:        ['#Edge', '#LovenseEdge', '#InteractiveToy', '#TipToControl'],
    Hush:        ['#Hush', '#LovenseHush', '#InteractiveToy', '#TipToControl'],
    default:     ['#InteractiveShow', '#TipToControl', '#LiveShow'],
  },
  vibe: {
    tease:       ['#TeasingYou', '#SlowBurn', '#EarnIt', '#NaughtyStream'],
    dominant:    ['#BossMode', '#YouObey', '#InControl', '#BadGirl'],
    submissive:  ['#YouDecide', '#YouControl', '#GoodGirl', '#YourWish'],
    hype:        ['#LiveNow', '#TipGoal', '#GoGoGo', '#HighEnergy'],
    mystery:     ['#Surprise', '#TonightOnly', '#SecretShow', '#MysteryReward'],
    default:     ['#LiveNow', '#TipMenu', '#StreamLife'],
  },
  goal: ['#TokenGoal', '#GoalShow', '#TipToFinish', '#AlmostThere', '#TipMenu'],
  content: ['#CamModel', '#AdultContent', '#OnlineStar', '#StreamerLife', '#LiveEntertainment'],
  highTraffic: ['#LiveStream', '#AdultStream', '#CamGirl', '#WebcamModel', '#OnlineFun'],
}

export function generateHashtags({
  platform = 'Chaturbate',
  toy = 'none',
  mood = 'hype',
  hasGoal = false,
  count = 15,
} = {}) {
  const toyName = TOY_NAMES[toy?.toLowerCase()] || null
  const tags = new Set()

  // 1. Platform tags (3-4)
  const platTags = HASHTAG_POOLS.platform[platform] || HASHTAG_POOLS.platform.default
  platTags.slice(0, 3).forEach(t => tags.add(t))

  // 2. Default content tags (always include 2)
  HASHTAG_POOLS.platform.default.slice(0, 2).forEach(t => tags.add(t))

  // 3. Toy tags (if applicable, 3-4)
  if (toyName && HASHTAG_POOLS.toy[toyName]) {
    HASHTAG_POOLS.toy[toyName].slice(0, 4).forEach(t => tags.add(t))
  } else {
    HASHTAG_POOLS.toy.default.slice(0, 2).forEach(t => tags.add(t))
  }

  // 4. Vibe/mood tags (2-3)
  const vibeTags = HASHTAG_POOLS.vibe[mood] || HASHTAG_POOLS.vibe.default
  vibeTags.slice(0, 3).forEach(t => tags.add(t))

  // 5. Goal tags if applicable (2)
  if (hasGoal) {
    HASHTAG_POOLS.goal.slice(0, 2).forEach(t => tags.add(t))
  }

  // 6. High traffic fillers to reach count
  HASHTAG_POOLS.highTraffic.forEach(t => {
    if (tags.size < count) tags.add(t)
  })
  HASHTAG_POOLS.content.forEach(t => {
    if (tags.size < count) tags.add(t)
  })

  return Array.from(tags).slice(0, count)
}

import { computeSnapshotStats, toLocalHour, aggregateRows } from './analytics'
import { detectSessions, isValidSession } from './analytics/sessions'
import { zonedYMD, creatorInstant } from './creatorTimezone'

// Display categories do not change storage, dedup keys, or session eligibility.
export function earningCategory(row) {
  if (row.is_paid_session || row.session_type) return 'private'
  if (/membership|fan club/i.test(row.tip_type || '') || /^Fan Club Membership(?::|$)/i.test(row.tip_note || row.note || '')) return 'memberships'
  if (/sale|snapchat|social|other/i.test(row.tip_type || '')) return 'other'
  return 'tips'
}

// Calendar date ('YYYY-MM-DD') of an earning row on the creator's clock.
// Timezone-naive export times are the creator's own wall-clock times
// (creatorInstant), so 'Oct 9, 2026, 5:33 AM' stays Oct 9 in every zone.
export function earningDay(row, timeZone = 'UTC') {
  const date = creatorInstant(row?.date_time ?? row?.dateRaw ?? row?.ts ?? row?.date, timeZone)
  return isNaN(date.getTime()) ? null : zonedYMD(date, timeZone)
}

// Date range of imported earning rows: first and last earning day, and the
// number of calendar dates it covers counted inclusively (Sep 18 → Oct 9 is
// 22). Pass earning rows only; transfers, outbound tips, admin adjustments and
// promotions are never parsed into rows, so they cannot move the range.
export function earningDateRange(rows, timeZone = 'UTC') {
  const days = rows.map(r => earningDay(r, timeZone)).filter(Boolean).sort()
  if (!days.length) return null
  const startDate = days[0], endDate = days[days.length - 1]
  const utcMidnight = ymd => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10))
  return { startDate, endDate, calendarDays: Math.round((utcMidnight(endDate) - utcMidnight(startDate)) / 86400000) + 1 }
}

// 'YYYY-MM-DD' → 'Sep 18, 2026'. Already a calendar date, so no zone shift.
export function formatDay(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
}

export function summarizeOnboarding(rows, timeZone = 'UTC') {
  const normalized = rows.map(r => ({ ...r, date: creatorInstant(r.date_time || r.dateRaw || r.date || r.ts, timeZone) }))
    .filter(r => !isNaN(r.date.getTime()))
  const window = computeSnapshotStats(normalized, 31)
  const summarize = entries => {
    const categories = Object.fromEntries(['tips', 'private', 'memberships', 'other'].map(k => [k, { count: 0, tokens: 0, usd: 0 }]))
    const fans = new Set()
    for (const r of entries) {
      const c = categories[earningCategory(r)]
      c.count++; c.tokens += Number(r.tokens) || 0; c.usd += Number(r.usd) || 0
      const name = String(r.username || '').trim().toLowerCase()
      if (name && !['anonymous', 'unknown'].includes(name)) fans.add(name)
    }
    for (const c of Object.values(categories)) c.usd = +c.usd.toFixed(2)
    return { categories, tips: categories.tips.count, usd: +['tips','private','memberships'].reduce((n, k) => n + categories[k].usd, 0).toFixed(2), fans: fans.size }
  }
  const hours = new Map()
  const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  for (const r of normalized) {
    const hour = toLocalHour(r.date.toISOString(), timeZone)
    const bucket = hours.get(hour) || { usd: 0, days: new Set() }
    bucket.usd += Number(r.usd) || 0
    bucket.days.add(dayFormatter.format(r.date))
    hours.set(hour, bucket)
  }
  const peak = [...hours].sort((a, b) => b[1].usd - a[1].usd)[0]
  return {
    full: { ...window.full, ...summarize(normalized) },
    recent: { ...window.recent, ...summarize(normalized.filter(r => r.date >= window.recent.from)) },
    bestHour: peak ? `${peak[0] % 12 || 12}${peak[0] < 12 ? 'am' : 'pm'}` : null,
    bestHourConfident: !!peak && peak[1].days.size >= 2,
    timeZone,
  }
}

// Onboarding Step 3/4 dataset: the confirmed import's earning rows with every
// timestamp resolved to a real instant on the creator's clock (ISO, UTC) — the
// shape the dashboard engine reads from tips / paid_sessions — so Step 3's
// analysis and Step 4's insights come from the same rows the dashboard uses.
export function canonicalImportDataset(rows, platform, timeZone) {
  const tips = [], paidSessions = []
  for (const r of rows) {
    const at = creatorInstant(r.date_time ?? r.dateRaw ?? r.ts, timeZone)
    if (isNaN(at.getTime())) continue
    const iso = at.toISOString()
    const base = { date_time: iso, dateRaw: iso, platform, username: r.username, tokens: Number(r.tokens) || 0, usd: Number(r.usd) || 0 }
    if (r.is_paid_session || r.session_type || r.sessionType) paidSessions.push({ ...base, session_type: r.session_type || r.sessionType })
    else tips.push({ ...base, tip_type: r.tip_type || 'Tip', tip_note: r.tip_note || r.note || '' })
  }
  return { tips, paidSessions, timeZone }
}

// Step 3 "Calculating your stream patterns": the canonical session grouping
// (lib/analytics/sessions.js: 60-minute gap; valid = 30+ minutes and 2+ tips).
export function streamPatterns(dataset) {
  const sessions = detectSessions(dataset.tips)
  const valid = sessions.filter(isValidSession)
  return {
    sessionCount: sessions.length,
    validSessionCount: valid.length,
    validStreamedMinutes: valid.reduce((n, s) => n + (s.durationMinutes || 0), 0),
  }
}

// Step 3 "Detecting your best streaming times": the dashboard engine's
// canonical best-time windows and hourly rate (lib/analytics.js aggregateRows),
// run on the same tips in the creator's zone.
export function bestStreamingTimes(dataset) {
  const engine = aggregateRows(dataset.tips, dataset.timeZone)
  return {
    canonicalBestTimes: engine.canonicalBestTimes,
    estimatedHourlyRate: engine.estimatedHourlyRate,
    hourlyRateSessionCount: engine.hourlyRateSessionCount,
    hourlyRateTotalMinutes: engine.hourlyRateTotalMinutes,
  }
}

export function assertImportComplete(json) {
  if (json.error || json.ok === false || json.warnings?.length || json.paidSessionsWarnings?.length) {
    throw new Error(json.error || 'Some rows could not be saved. Some data may already be imported. Retry the same import; duplicates are safely skipped.')
  }
}

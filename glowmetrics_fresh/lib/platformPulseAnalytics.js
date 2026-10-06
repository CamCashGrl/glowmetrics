// ============================================
// PLATFORM PULSE — CURRENT-PERIOD DERIVATION
//
// This module does not reimplement sessionization, hourly-rate eligibility,
// platform normalization, or best-time formulas. Period slices are fed back
// through aggregateRows(), the canonical analytics engine.
//
// Raw period totals (earnings / tips / supporters) intentionally use every
// canonical revenue row in the slice, while rate/session fields come from the
// engine's meaningful/timed-session rules. The UI labels hourly figures as
// estimated wherever the underlying engine does.
// ============================================

import { aggregateRows } from './analytics'

const DAY_MS = 24 * 60 * 60 * 1000
const round2 = (n) => parseFloat((Number(n) || 0).toFixed(2))

function resolvedTz(tz) {
  if (tz) return tz
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function localDateKey(dateLike, tz = null) {
  const zone = resolvedTz(tz)
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike)
  if (Number.isNaN(date.getTime())) return null
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

function rowDate(row) {
  return row?.dateRaw || row?.date_time || row?.received_at || null
}

function shiftCalendarDate(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString().slice(0, 10)
}

export function filterTipsByLocalDateRange(tips = [], { startDate, endDate, tz = null }) {
  if (!startDate || !endDate) return []
  return tips.filter(row => {
    const key = localDateKey(rowDate(row), tz)
    return Boolean(key && key >= startDate && key <= endDate)
  })
}

function rawPlatformTotals(tips = []) {
  const map = new Map()
  tips.forEach(t => {
    const platform = (t?.platform || 'Unknown').trim() || 'Unknown'
    const username = (t?.username || '').trim().toLowerCase()
    const current = map.get(platform) || {
      platform,
      earnings: 0,
      tips: 0,
      supporters: new Set(),
      latestAt: null,
    }
    current.earnings += Number(t?.usd) || 0
    current.tips += 1
    if (username) current.supporters.add(`${platform.toLowerCase()}:${username}`)
    const rawDate = rowDate(t)
    const ts = rawDate ? new Date(rawDate).getTime() : NaN
    if (!Number.isNaN(ts) && (!current.latestAt || ts > current.latestAt)) current.latestAt = ts
    map.set(platform, current)
  })

  return [...map.values()].map(p => ({
    platform: p.platform,
    earnings: round2(p.earnings),
    tips: p.tips,
    supporters: p.supporters.size,
    latestAt: p.latestAt ? new Date(p.latestAt).toISOString() : null,
  }))
}

function enginePlatformMap(tips, tz) {
  if (!tips.length) return new Map()
  const analytics = aggregateRows(tips, resolvedTz(tz))
  return new Map((analytics?.platforms || []).map(p => [p.platform, p]))
}

function pctChange(current, baseline) {
  if (!(baseline > 0)) return null
  return Math.round(((current - baseline) / baseline) * 100)
}

function buildPeriodRows(tips, tz) {
  const raw = rawPlatformTotals(tips)
  const engine = enginePlatformMap(tips, tz)
  return raw.map(p => {
    const e = engine.get(p.platform) || null
    return {
      ...p,
      sessions: e?.sessions || 0,
      hours: e?.hours || 0,
      rateHours: e?.rateHours || 0,
      rateUSD: e?.rateUSD || 0,
      usdPerHour: e?.usdPerHour ?? null,
      avgTipSize: p.tips > 0 ? round2(p.earnings / p.tips) : null,
    }
  })
}

export function buildPlatformPulse(tips = [], tz = null, now = new Date()) {
  const zone = resolvedTz(tz)
  const todayKey = localDateKey(now, zone)
  if (!todayKey) return null

  const yesterdayKey = shiftCalendarDate(todayKey, -1)
  const baselineStart = shiftCalendarDate(todayKey, -7)
  const baselineEnd = yesterdayKey

  const todayTips = filterTipsByLocalDateRange(tips, { startDate: todayKey, endDate: todayKey, tz: zone })
  const yesterdayTips = filterTipsByLocalDateRange(tips, { startDate: yesterdayKey, endDate: yesterdayKey, tz: zone })
  const baselineTips = filterTipsByLocalDateRange(tips, { startDate: baselineStart, endDate: baselineEnd, tz: zone })

  const today = buildPeriodRows(todayTips, zone)
  const yesterday = new Map(buildPeriodRows(yesterdayTips, zone).map(p => [p.platform, p]))
  const baseline = new Map(buildPeriodRows(baselineTips, zone).map(p => [p.platform, p]))
  const baselineActiveDays = new Map()

  baselineTips.forEach(t => {
    const platform = (t?.platform || 'Unknown').trim() || 'Unknown'
    const key = localDateKey(rowDate(t), zone)
    if (!baselineActiveDays.has(platform)) baselineActiveDays.set(platform, new Set())
    if (key) baselineActiveDays.get(platform).add(key)
  })

  const ranked = today
    .map(row => {
      const y = yesterday.get(row.platform) || null
      const b = baseline.get(row.platform) || null
      const activeDays = baselineActiveDays.get(row.platform)?.size || 0
      const baselineDailyEarnings = activeDays > 0 ? round2((b?.earnings || 0) / activeDays) : null

      return {
        ...row,
        yesterdayEarnings: y?.earnings ?? null,
        vsYesterdayEarningsPct: pctChange(row.earnings, y?.earnings),
        baselineActiveDays: activeDays,
        baselineDailyEarnings,
        vsBaselineDailyEarningsPct: baselineDailyEarnings > 0
          ? pctChange(row.earnings, baselineDailyEarnings)
          : null,
        baselineUsdPerHour: b?.usdPerHour ?? null,
        vsBaselineUsdPerHourPct: row.usdPerHour !== null && b?.usdPerHour > 0
          ? pctChange(row.usdPerHour, b.usdPerHour)
          : null,
      }
    })
    .sort((a, b) => b.earnings - a.earnings)
    .map((row, index) => ({ ...row, rank: index + 1 }))

  const latestAt = ranked.reduce((latest, p) => {
    if (!p.latestAt) return latest
    const ts = new Date(p.latestAt).getTime()
    return !latest || ts > latest ? ts : latest
  }, null)

  return {
    timezone: zone,
    todayKey,
    yesterdayKey,
    baselineStart,
    baselineEnd,
    hasActivityToday: ranked.length > 0,
    latestAt: latestAt ? new Date(latestAt).toISOString() : null,
    platforms: ranked,
    winner: ranked[0] || null,
  }
}

export function buildPlatformPulseInsights(pulse) {
  if (!pulse?.platforms?.length) return []
  const insights = []
  const winner = pulse.platforms[0]

  if (pulse.platforms.length > 1) {
    insights.push(`${winner.platform} is #1 today with $${winner.earnings.toFixed(2)} tracked earnings.`)
  }

  if (winner.vsBaselineUsdPerHourPct !== null && Math.abs(winner.vsBaselineUsdPerHourPct) >= 10) {
    const direction = winner.vsBaselineUsdPerHourPct > 0 ? 'above' : 'below'
    insights.push(`${winner.platform} is running ${Math.abs(winner.vsBaselineUsdPerHourPct)}% ${direction} its recent estimated hourly-rate baseline.`)
  } else if (winner.vsBaselineDailyEarningsPct !== null && Math.abs(winner.vsBaselineDailyEarningsPct) >= 15) {
    const direction = winner.vsBaselineDailyEarningsPct > 0 ? 'above' : 'below'
    insights.push(`${winner.platform} is ${Math.abs(winner.vsBaselineDailyEarningsPct)}% ${direction} its recent active-day earnings baseline.`)
  }

  const mover = pulse.platforms
    .filter(p => p.vsYesterdayEarningsPct !== null)
    .sort((a, b) => Math.abs(b.vsYesterdayEarningsPct) - Math.abs(a.vsYesterdayEarningsPct))[0]
  if (mover && Math.abs(mover.vsYesterdayEarningsPct) >= 20) {
    insights.push(`${mover.platform} is ${Math.abs(mover.vsYesterdayEarningsPct)}% ${mover.vsYesterdayEarningsPct > 0 ? 'ahead of' : 'behind'} yesterday's earnings.`)
  }

  return insights.slice(0, 3)
}

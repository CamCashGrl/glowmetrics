// Shared local-timezone + median primitives, used by lib/analytics.js and by
// lib/analytics/bestTimes.js + lib/analytics/missedRevenue.js. Extracted to
// this leaf module (no imports of its own) specifically so bestTimes.js can
// depend on these without creating a lib/analytics.js <-> lib/analytics/
// bestTimes.js circular import (lib/analytics.js's platforms calculation
// needs to call into bestTimes.js; bestTimes.js needs these primitives —
// putting them here means neither file imports the other).

export function calcMedian(arr) {
  if (!arr || arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export function toLocalHour(dateStr, tz) {
  try {
    const date = new Date(dateStr)
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false
    }).format(date)
    const h = parseInt(formatted)
    return isNaN(h) ? 0 : h === 24 ? 0 : h
  } catch { return new Date(dateStr).getUTCHours() }
}

export function toLocalDow(dateStr, tz) {
  try {
    const date = new Date(dateStr)
    const dayName = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long'
    }).format(date)
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
      .indexOf(dayName)
  } catch { return new Date(dateStr).getUTCDay() }
}

export function toLocalDateStr(dateStr, tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz
    }).format(new Date(dateStr)) // returns YYYY-MM-DD
  } catch { return new Date(dateStr).toISOString().slice(0, 10) }
}

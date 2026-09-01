// ============================================================
// TX HUB — shared server-side transaction logic
// Single source of truth for merging tips + paid_sessions into a unified
// "transaction" ledger and every TX Hub calculation (KPIs, chart series,
// platform/type breakdowns, top fans, calendar). Reused by both
// app/api/tx-hub/route.js and app/api/tx-hub/export/route.js — never copy
// this logic into either route file.
//
// Formula source of truth notes:
//   - USD: trusted DB `usd` value wins; tokens * tokenRate(platform) is only
//     a fallback when usd is missing (see lib/constants.js tokenRate()).
//   - Sessions: reuses detectSessions() from lib/analytics/sessions.js —
//     never re-implement session grouping here.
//   - "Status" is always 'completed' — tips/paid_sessions only ever record
//     transactions that already happened. There is no payout/pending/failed
//     column in the schema, so those states are never fabricated.
// ============================================================

import { tokenRate } from './constants'
import { classifyPaidSessionStream } from './analytics/revenueMix'
import { detectSessions } from './analytics/sessions'

// Keys are the canonical revenue-stream keys from lib/analytics/revenueMix.js
// (plus 'tip' and 'other', which are TX-Hub-only). They used to be an
// independent 5-value taxonomy that collapsed Full-Private into Private,
// so the same paid session read "Private" here and "Full-Private" on the
// Sessions tab. Keep these aligned with REVENUE_STREAMS.
export const TX_TYPES = ['tip', 'private_chat', 'full_private', 'group_chat', 'spy_mode', 'other']

export const TX_TYPE_LABELS = {
  tip: 'Tip',
  private_chat: 'Private',
  full_private: 'Full-Private',
  group_chat: 'Group',
  spy_mode: 'Spy',
  other: 'Other',
}

function usdFor(row) {
  const tokens = Number(row.tokens) || 0
  const hasUsd = row.usd !== null && row.usd !== undefined && !Number.isNaN(Number(row.usd))
  return hasUsd ? Number(row.usd) : parseFloat((tokens * tokenRate(row.platform)).toFixed(2))
}

// Both classifiers now defer to the one canonical implementation rather than
// re-deriving the rules with their own substring checks in their own order.
function classifyTipType(rawType) {
  // A tips-table row whose tip_type names a paid format (imports predating
  // the paid_sessions split, or a label the importer's regex missed) is
  // still surfaced under that stream, not as an open-chat tip.
  const stream = classifyPaidSessionStream(rawType)
  if (stream) return stream
  const lower = (rawType || 'Tip').toLowerCase()
  if (lower === 'tip' || lower.includes('tip')) return 'tip'
  return 'other'
}

function classifySessionType(rawType) {
  // Unrecognised labels fall through to 'other'. This previously defaulted to
  // 'private', which quietly inflated Private with anything unclassifiable.
  return classifyPaidSessionStream(rawType) || 'other'
}

export function normalizeTipRow(row) {
  const type = classifyTipType(row.tip_type)
  return {
    id: `tip:${row.id}`,
    rowId: row.id,
    source: 'tip',
    dateTime: row.date_time,
    platform: row.platform || 'Unknown',
    username: row.username || 'Unknown',
    type,
    typeLabel: TX_TYPE_LABELS[type],
    rawType: row.tip_type || 'Tip',
    tokens: Number(row.tokens) || 0,
    usd: usdFor(row),
    status: 'completed',
    sessionId: null,
    sessionLabel: null,
  }
}

export function normalizePaidSessionRow(row) {
  const type = classifySessionType(row.session_type)
  return {
    id: `ps:${row.id}`,
    rowId: row.id,
    source: 'paid_session',
    dateTime: row.date_time,
    platform: row.platform || 'Unknown',
    username: row.username || 'Unknown',
    type,
    typeLabel: TX_TYPE_LABELS[type],
    rawType: row.session_type || 'Private Chat',
    tokens: Number(row.tokens) || 0,
    usd: usdFor(row),
    status: 'completed',
    sessionId: null,
    sessionLabel: null,
  }
}

// Attaches a derived "session #" label to tip-sourced transactions by
// reusing detectSessions() (lib/analytics/sessions.js) over the raw tip
// rows in this response window. Paid sessions are intentionally left
// unlinked — they are not part of the tips-based session grouping the rest
// of the app already uses, and we don't invent a relationship the data
// doesn't support.
export function attachSessionLabels(transactions, tipRows) {
  if (!tipRows.length) return transactions
  const sessions = detectSessions(tipRows)
  const idToSession = new Map()
  sessions.forEach((session, idx) => {
    session.tips.forEach(t => { if (t.id != null) idToSession.set(t.id, idx + 1) })
  })
  return transactions.map(tx => {
    if (tx.source !== 'tip') return tx
    const n = idToSession.get(tx.rowId)
    if (!n) return tx
    return { ...tx, sessionId: `session_${n}`, sessionLabel: `Session #${n}` }
  })
}

export function mergeTransactions(tipRows, paidSessionRows) {
  const txs = [
    ...tipRows.map(normalizeTipRow),
    ...paidSessionRows.map(normalizePaidSessionRow),
  ]
  txs.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
  return txs
}

export function filterTransactions(txs, filters = {}) {
  const { platform, types, amountMin, amountMax, search, dateFrom, dateTo } = filters
  const q = search ? search.trim().toLowerCase() : ''
  return txs.filter(t => {
    if (platform && platform !== 'all' && t.platform.toLowerCase() !== platform.toLowerCase()) return false
    if (types && types.length && !types.includes(t.type)) return false
    if (amountMin != null && t.usd < amountMin) return false
    if (amountMax != null && t.usd > amountMax) return false
    if (dateFrom && new Date(t.dateTime) < new Date(dateFrom)) return false
    if (dateTo && new Date(t.dateTime) > new Date(dateTo)) return false
    if (q) {
      const hay = `${t.username} ${t.platform} ${t.typeLabel} ${t.rowId} ${t.usd}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export function sortTransactions(txs, sortBy = 'date', sortDir = 'desc') {
  const dir = sortDir === 'asc' ? 1 : -1
  const sorted = [...txs]
  sorted.sort((a, b) => {
    switch (sortBy) {
      case 'amount': return (a.usd - b.usd) * dir
      case 'platform': return a.platform.localeCompare(b.platform) * dir
      case 'username': return a.username.localeCompare(b.username) * dir
      case 'type': return a.typeLabel.localeCompare(b.typeLabel) * dir
      case 'date':
      default: return (new Date(a.dateTime) - new Date(b.dateTime)) * dir
    }
  })
  return sorted
}

function sum(arr, key) { return arr.reduce((s, x) => s + (Number(x[key]) || 0), 0) }
export function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100 }
export function round1(n) { return Math.round((n + Number.EPSILON) * 10) / 10 }

// prev === null means "no prior-period data at all" — the caller must
// render that as no comparison, never as a fabricated 0%/∞% swing.
function pctChange(curr, prev) {
  if (prev == null || prev === 0) return null
  return round1(((curr - prev) / prev) * 100)
}

export function computeKpis(currentTxs, previousTxs) {
  const totalEarned = round2(sum(currentTxs, 'usd'))
  const totalCount = currentTxs.length
  const avg = totalCount ? round2(totalEarned / totalCount) : 0
  const largest = currentTxs.reduce((max, t) => (max == null || t.usd > max.usd ? t : max), null)

  const havePrev = previousTxs.length > 0
  const prevTotal = havePrev ? round2(sum(previousTxs, 'usd')) : null
  const prevCount = havePrev ? previousTxs.length : null

  return {
    totalEarned,
    totalEarnedChangePct: havePrev ? pctChange(totalEarned, prevTotal) : null,
    totalTransactions: totalCount,
    totalTransactionsChangePct: havePrev ? pctChange(totalCount, prevCount) : null,
    averageTransaction: avg,
    largestTransaction: largest
      ? { usd: largest.usd, platform: largest.platform, dateTime: largest.dateTime, username: largest.username }
      : null,
  }
}

export function computePlatformBreakdown(txs) {
  const map = new Map()
  let total = 0
  for (const t of txs) {
    total += t.usd
    map.set(t.platform, (map.get(t.platform) || 0) + t.usd)
  }
  return [...map.entries()]
    .map(([platform, usd]) => ({ platform, usd: round2(usd), pct: total ? round1((usd / total) * 100) : 0 }))
    .sort((a, b) => b.usd - a.usd)
}

export function computeEarningsBreakdown(txs) {
  const map = new Map()
  let total = 0
  for (const t of txs) {
    total += t.usd
    map.set(t.type, (map.get(t.type) || 0) + t.usd)
  }
  return [...map.entries()]
    .map(([type, usd]) => ({ type, label: TX_TYPE_LABELS[type] || type, usd: round2(usd), pct: total ? round1((usd / total) * 100) : 0 }))
    .sort((a, b) => b.usd - a.usd)
}

export function computeTopFans(txs, limit = 25) {
  const map = new Map()
  for (const t of txs) {
    // Fans are keyed per-platform — never merge the same username across
    // platforms into one fan (see formula-requirments: FAN IDENTITY).
    const key = `${t.platform}:${t.username}`.toLowerCase()
    if (!map.has(key)) map.set(key, { username: t.username, platform: t.platform, usd: 0, count: 0, lastDate: t.dateTime })
    const f = map.get(key)
    f.usd += t.usd
    f.count += 1
    if (new Date(t.dateTime) > new Date(f.lastDate)) f.lastDate = t.dateTime
  }
  return [...map.values()]
    .map(f => ({ ...f, usd: round2(f.usd), avg: round2(f.usd / f.count) }))
    .sort((a, b) => b.usd - a.usd)
    .slice(0, limit)
}

export function pickGranularity(rangeDays) {
  if (rangeDays <= 2) return 'hourly'
  if (rangeDays <= 60) return 'daily'
  if (rangeDays <= 365) return 'weekly'
  return 'monthly'
}

function bucketKey(dateTime, granularity, tz) {
  const d = new Date(dateTime)
  const zone = tz || 'UTC'
  if (granularity === 'hourly') {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(d)
    const get = (t) => parts.find(p => p.type === t)?.value
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:00`
  }
  if (granularity === 'weekly') {
    // Bucket to the Sunday that starts the local week.
    const local = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
    const day = new Date(`${local}T00:00:00Z`)
    const dow = day.getUTCDay()
    day.setUTCDate(day.getUTCDate() - dow)
    return day.toISOString().slice(0, 10)
  }
  if (granularity === 'monthly') {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit' }).format(d)
  }
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export function computeChartSeries(txs, granularity, tz) {
  const buckets = new Map()
  for (const t of txs) {
    const key = bucketKey(t.dateTime, granularity, tz)
    if (!buckets.has(key)) buckets.set(key, { key, usd: 0, tips: 0, count: 0 })
    const b = buckets.get(key)
    b.usd += t.usd
    b.count += 1
    if (t.type === 'tip') b.tips += t.usd
  }
  return [...buckets.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(b => ({ date: b.key, usd: round2(b.usd), tips: round2(b.tips), count: b.count, avg: b.count ? round2(b.usd / b.count) : 0 }))
}

export function computeCalendar(txs, tz) {
  const map = new Map()
  for (const t of txs) {
    const key = bucketKey(t.dateTime, 'daily', tz)
    map.set(key, (map.get(key) || 0) + t.usd)
  }
  return [...map.entries()]
    .map(([date, usd]) => ({ date, usd: round2(usd) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function distinctPlatforms(txs) {
  return [...new Set(txs.map(t => t.platform))].sort()
}

// Builds the CSV export the spec calls for — deliberately excludes any raw
// internal DB fields (row ids, user_id, etc.) beyond the public-safe columns.
export function toCsv(txs) {
  const header = ['transaction_id', 'date', 'time', 'platform', 'username', 'transaction_type', 'tokens', 'usd', 'status', 'session_id']
  const escape = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [header.join(',')]
  for (const t of txs) {
    const d = new Date(t.dateTime)
    const date = isNaN(d) ? '' : d.toISOString().slice(0, 10)
    const time = isNaN(d) ? '' : d.toISOString().slice(11, 19)
    lines.push([
      t.id, date, time, t.platform, t.username, t.typeLabel, t.tokens, t.usd.toFixed(2), t.status, t.sessionLabel || '',
    ].map(escape).join(','))
  }
  return lines.join('\n')
}

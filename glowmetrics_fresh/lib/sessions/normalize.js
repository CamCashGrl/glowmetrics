// One session history for the Sessions tab, built from the persisted sources
// only. Each source keeps its own meaning; nothing here re-derives earnings:
//
//   live       → finalized live_sessions (toShowSummary): public from canonical
//                tips linked by tips.live_session_id, private from
//                live_private_intervals. Exact start/end.
//   free_chat  → canonical tips NOT linked to a Live show, grouped by the shared
//   imported     detectSessions() (lib/analytics/sessions.js). Durations are
//                first-to-last tip, so always labeled estimated. "free_chat"
//                when the session holds extension-captured tips, "imported"
//                when every tip came from an upload.
//   private    → paid_sessions rows (imported private/group/spy). Never manual
//                tips. paid_sessions has no duration column, so private time
//                from imports is unknown and is not counted.
//
// live_tips (the Live Mode UI stream) is never read here, so it can never be
// added to tips.

import { detectSessions, isValidSession } from '../analytics/sessions'
import { freeWindowStartByPlatform } from '../analytics'

export { isValidSession }

export const SUPPORTED_PLATFORMS = ['chaturbate', 'bongacams', 'myfreecams']

const money = (v) => Math.round((Number(v) || 0) * 100) / 100
const norm = (s) => String(s || '').trim().toLowerCase()

// Fans are never merged across platforms by username alone.
export const fanKey = (platform, username) => `${norm(platform)}:${norm(username)}`

// YYYY-MM-DD of an instant in the creator's timezone.
export function localDayKey(at, tz) {
  const d = at instanceof Date ? at : new Date(at)
  if (isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

function liveEntry(show) {
  const breakdown = (show.platformRevenue || []).map((p) => ({ platform: norm(p.platform), usd: money(p.usd), tips: p.tips || 0 }))
  const platforms = breakdown.length ? breakdown.map((p) => p.platform) : [norm(show.platform)].filter(Boolean)
  const durationMinutes = (Number(show.durationSeconds) || 0) / 60
  return {
    id: `live:${show.id}`,
    sourceId: show.id,
    type: 'live',
    platforms,
    platformBreakdown: breakdown,
    startTime: show.startedAt,
    endTime: show.endedAt,
    durationMinutes,
    durationEstimated: false,
    publicUSD: money(show.publicUsd),
    privateUSD: money(show.privateUsd),
    totalUSD: money(show.totalUsd),
    privateMinutes: (Number(show.privateSeconds) || 0) / 60,
    privateIntervals: show.privateIntervals || [],
    tipCount: show.tipCount || 0,
    uniqueTippers: show.uniqueTippers || 0,
    topTipper: show.topTipper || null,
    isNew: !!show.isNew,
    isValid: true,
    show,
  }
}

function tipSessionEntry(s) {
  const fromExtension = (s.tips || []).some((t) => t.source === 'extension')
  const platform = norm(s.platform)
  const tippers = new Map()
  for (const t of s.tips || []) {
    const k = fanKey(t.platform, t.username)
    const cur = tippers.get(k) || { username: t.username, usd: 0 }
    cur.usd += Number(t.usd) || 0
    tippers.set(k, cur)
  }
  const top = [...tippers.values()].sort((a, b) => b.usd - a.usd || norm(a.username).localeCompare(norm(b.username)))[0]
  return {
    id: `tips:${s.id}:${platform}`,
    sourceId: s.id,
    type: fromExtension ? 'free_chat' : 'imported',
    platforms: [platform],
    platformBreakdown: [{ platform, usd: money(s.totalUSD), tips: s.tipCount }],
    startTime: s.startTime,
    endTime: s.endTime,
    durationMinutes: s.durationUnknown ? 0 : s.durationMinutes,
    durationEstimated: true,
    durationUnknown: !!s.durationUnknown,
    publicUSD: money(s.totalUSD),
    privateUSD: 0,
    totalUSD: money(s.totalUSD),
    privateMinutes: 0,
    tipCount: s.tipCount,
    uniqueTippers: tippers.size,
    topTipper: top ? { username: top.username, usd: money(top.usd) } : null,
    isNew: false,
    isValid: isValidSession(s),
    session: s,
  }
}

function privateEntry(p) {
  const platform = norm(p.platform)
  const usd = money(p.usd)
  return {
    id: `private:${p.id}`,
    sourceId: p.id,
    type: 'private',
    sessionType: p.session_type || null,
    platforms: [platform],
    platformBreakdown: [{ platform, usd, tips: 0 }],
    startTime: p.date_time,
    endTime: p.date_time,
    durationMinutes: null,
    durationEstimated: false,
    durationUnknown: true,
    publicUSD: 0,
    privateUSD: usd,
    totalUSD: usd,
    privateMinutes: null,
    tipCount: 0,
    uniqueTippers: p.username ? 1 : 0,
    topTipper: null,
    fan: p.username || null,
    isNew: false,
    isValid: true,
  }
}

// Tips linked to a Live show belong to that show only; they are removed
// before inferred grouping so no tip is shown in two sessions.
export function unlinkedTips(tips) {
  return (tips || []).filter((t) => !t.live_session_id)
}

export function buildSessionHistory({ tips = [], shows = [], paidSessions = [] } = {}) {
  const entries = [
    ...shows.filter((s) => s?.id && s.endedAt).map(liveEntry),
    ...detectSessions(unlinkedTips(tips)).map(tipSessionEntry),
    ...paidSessions.filter((p) => p?.id && p.date_time).map(privateEntry),
  ]
  return entries.sort((a, b) => new Date(b.startTime) - new Date(a.startTime) || (a.id < b.id ? 1 : -1))
}

export function filterSessionHistory(history, { type = 'all', platform = 'all' } = {}) {
  return (history || []).filter((e) =>
    (type === 'all' || e.type === type)
    && (platform === 'all' || e.platforms.includes(platform)))
}

function emptyBucket() {
  return {
    totalUSD: 0, publicUSD: 0, privateUSD: 0, tipCount: 0,
    fanKeys: new Set(), streamedMinutes: 0, streamedEstimated: false,
    privateMinutes: 0, completedSessions: 0,
  }
}

function finishBucket(b) {
  const { fanKeys, ...rest } = b
  return {
    ...rest,
    totalUSD: money(b.publicUSD + b.privateUSD),
    publicUSD: money(b.publicUSD),
    privateUSD: money(b.privateUSD),
    uniqueTippers: fanKeys.size,
  }
}

// Daily KPIs for one local day.
//   public   = Σ canonical tips.usd that day (Live-linked and unlinked)
//   private  = Σ Live final_private_usd (shows started that day)
//              + Σ paid_sessions.usd that day
//   total    = public + private
//   tips     = count of canonical tips that day
//   unique   = distinct platform:username over those tips
//   streamed = Live active minutes + estimated free-chat/imported minutes
//   private time = Live private-interval minutes (imports carry no duration)
//   completed = finalized Live shows + valid inferred sessions
//   best platform = highest total USD that day (null when no revenue)
// A show or inferred session belongs to the day it started.
export function dailySessionStats({ tips = [], history = [], paidSessions = [], tz = 'UTC', now = new Date() } = {}) {
  const day = localDayKey(now, tz)
  const overall = emptyBucket()
  const byPlatform = new Map()
  const bucketFor = (p) => {
    const k = norm(p) || 'unknown'
    if (!byPlatform.has(k)) byPlatform.set(k, emptyBucket())
    return byPlatform.get(k)
  }

  for (const t of tips) {
    if (localDayKey(t.date_time || t.dateRaw, tz) !== day) continue
    const usd = Number(t.usd) || 0
    const key = fanKey(t.platform, t.username)
    for (const b of [overall, bucketFor(t.platform)]) {
      b.publicUSD += usd
      b.tipCount += 1
      b.fanKeys.add(key)
    }
  }

  for (const p of paidSessions) {
    if (localDayKey(p.date_time, tz) !== day) continue
    const usd = Number(p.usd) || 0
    overall.privateUSD += usd
    bucketFor(p.platform).privateUSD += usd
  }

  for (const e of history) {
    if (e.type === 'private') continue
    if (localDayKey(e.startTime, tz) !== day) continue
    overall.streamedMinutes += e.durationMinutes || 0
    if (e.durationEstimated) overall.streamedEstimated = true
    if (e.type === 'live') {
      overall.privateUSD += e.privateUSD
      overall.privateMinutes += e.privateMinutes || 0
      overall.completedSessions += 1
      for (const iv of e.privateIntervals || []) {
        const b = bucketFor(iv.platform)
        b.privateUSD += Number(iv.earningsUsd) || 0
        if (iv.startedAt && iv.endedAt) b.privateMinutes += (new Date(iv.endedAt) - new Date(iv.startedAt)) / 60000
      }
    } else if (e.isValid) {
      overall.completedSessions += 1
      bucketFor(e.platforms[0]).completedSessions += 1
    }
  }

  const platforms = [...byPlatform.entries()]
    .map(([platform, b]) => ({ platform, ...finishBucket(b) }))
    .sort((a, b) => b.totalUSD - a.totalUSD || a.platform.localeCompare(b.platform))
  const best = platforms.find((p) => p.totalUSD > 0)

  return {
    day,
    ...finishBucket(overall),
    bestPlatform: best ? best.platform : null,
    platforms,
  }
}

// ── TOTAL EARNED ────────────────────────────────────────────────────────
// Canonical: Total Earned = public tip earnings + private earnings.
//   public  = Σ canonical tips.usd in scope (the engine's totalUSD)
//   private = Σ paid_sessions.usd (imported private/group/spy)
//           + Σ closed live_private_intervals.estimated_earnings_usd of
//             finalized Live shows (= Σ live_sessions.final_private_usd)
// live_tips is never part of either term.

// Private earnings as dated rows, one per paid session or Live private interval.
export function privateEarningRows({ paidSessions = [], liveIntervals = [] } = {}) {
  return [
    ...paidSessions.map((p) => ({ date_time: p.date_time, platform: p.platform, usd: Number(p.usd) || 0, source: 'paid_session' })),
    ...liveIntervals.map((i) => ({ date_time: i.ended_at, platform: i.platform, usd: Number(i.estimated_earnings_usd) || 0, source: 'live_private' })),
  ].filter((r) => r.date_time && !isNaN(new Date(r.date_time).getTime()))
}

// windowStarts: optional { [platform]: Date } — the free-tier window computed
// from the tips (freeWindowStartByPlatform), so private earnings are scoped to
// exactly the same window as the public total. Platforms are matched
// case-insensitively; a platform with private earnings but no tips is
// windowed on its own latest private row, the same rule the tips use.
export function totalEarned({ publicUSD = 0, privateRows = [], windowStarts = null, windowDays = 31 } = {}) {
  let starts = null
  if (windowStarts) {
    starts = {}
    for (const [p, d] of Object.entries(freeWindowStartByPlatform(privateRows, { windowDays }))) starts[norm(p)] = d
    for (const [p, d] of Object.entries(windowStarts)) starts[norm(p)] = d
  }
  let privateUSD = 0
  for (const r of privateRows) {
    if (starts) {
      const start = starts[norm(r.platform)]
      if (!start || new Date(r.date_time) < start) continue
    }
    privateUSD += r.usd
  }
  const pub = money(publicUSD)
  const priv = money(privateUSD)
  return { publicUSD: pub, privateUSD: priv, totalUSD: money(pub + priv) }
}

// ── FRESHEST PERFORMANCE / TODAY CONTEXT ─────────────────────────────────

function splitByPlatform(tips) {
  const by = new Map()
  for (const t of tips) {
    const p = norm(t.platform) || 'unknown'
    const cur = by.get(p) || { platform: p, usd: 0, tips: 0 }
    cur.usd += Number(t.usd) || 0
    cur.tips += 1
    by.set(p, cur)
  }
  const total = [...by.values()].reduce((s, x) => s + x.usd, 0)
  return [...by.values()]
    .map((x) => ({ ...x, usd: money(x.usd), share: total > 0 ? Math.round((x.usd / total) * 100) : 0 }))
    .sort((a, b) => b.usd - a.usd || a.platform.localeCompare(b.platform))
}

// Running Live Mode show, from canonical tips linked to it (tips.live_session_id)
// — never live_tips. Private earnings of a running show are only final at Stop
// (closed intervals → final_private_usd), so only the open interval's time is
// reported here, not an estimated dollar figure.
export function liveSessionSnapshot({ session, tips = [], privateInterval = null, now = new Date() } = {}) {
  if (!session?.id) return null
  const own = tips.filter((t) => t.live_session_id === session.id)
  const fans = new Map()
  let largest = 0
  let lastAt = null
  for (const t of own) {
    const usd = Number(t.usd) || 0
    const k = fanKey(t.platform, t.username)
    const f = fans.get(k) || { username: t.username, platform: norm(t.platform), usd: 0 }
    f.usd += usd
    fans.set(k, f)
    if (usd > largest) largest = usd
    const at = new Date(t.date_time || t.dateRaw)
    if (!isNaN(at.getTime()) && (!lastAt || at > lastAt)) lastAt = at
  }
  const top = [...fans.values()].sort((a, b) => b.usd - a.usd || norm(a.username).localeCompare(norm(b.username)))[0]
  const publicUSD = money(own.reduce((s, t) => s + (Number(t.usd) || 0), 0))
  return {
    id: session.id,
    status: session.status,
    paused: session.live_substate === 'paused' || !!session.paused_at,
    startedAt: session.started_at,
    durationSeconds: Number(session.active_duration_seconds) || 0,
    publicUSD,
    tipCount: own.length,
    uniqueTippers: fans.size,
    topTipper: top ? { username: top.username, platform: top.platform, usd: money(top.usd) } : null,
    largestTipUSD: money(largest),
    platformSplit: splitByPlatform(own),
    privateNow: privateInterval?.started_at
      ? {
          platform: norm(privateInterval.platform),
          minutes: Math.max(0, (new Date(now) - new Date(privateInterval.started_at)) / 60000),
          ratePerMinute: Number(privateInterval.rate_per_minute) || null,
        }
      : null,
    lastUpdated: lastAt ? lastAt.toISOString() : null,
  }
}

// Most recently finished performance: the newest finalized Live show, else
// the newest inferred tip session. Private imports are not "performances".
export function latestPerformance(history = []) {
  const candidates = history.filter((e) => e.type !== 'private' && e.endTime)
  if (!candidates.length) return null
  return [...candidates].sort((a, b) => new Date(b.endTime) - new Date(a.endTime))[0]
}

// Share of today's total per platform, plus daily $/hr only when every
// streamed minute today is exact (Live Mode) — never from estimated time.
export function withTodayDerived(today) {
  const platforms = today.platforms.map((p) => ({
    ...p,
    share: today.totalUSD > 0 ? Math.round((p.totalUSD / today.totalUSD) * 100) : 0,
  }))
  const exactHours = !today.streamedEstimated && today.streamedMinutes > 0 ? today.streamedMinutes / 60 : null
  return { ...today, platforms, usdPerHour: exactHours ? money(today.totalUSD / exactHours) : null }
}

// One truthful sentence about today, or null.
export function todaySignal(today, displayName = (p) => p) {
  const earning = (today.platforms || []).filter((p) => p.totalUSD > 0)
  if (!earning.length || today.totalUSD <= 0) return null
  const lead = earning[0]
  const share = Math.round((lead.totalUSD / today.totalUSD) * 100)
  if (earning.length === 1) return `All of today's earnings so far came from ${displayName(lead.platform)}.`
  return `${displayName(lead.platform)} is leading today with ${share}% of your earnings.`
}

function localParts(at, tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(at)
  const get = (t) => parts.find((p) => p.type === t)?.value
  return { day: `${get('year')}-${get('month')}-${get('day')}`, minute: Number(get('hour')) * 60 + Number(get('minute')), weekday: get('weekday') }
}

// Public tips today vs the median of the same weekday's public tips up to the
// same local time, over the previous `weeks` weeks. Only weekdays that had
// earnings count; needs at least `minDays` of them, else null (no comparison
// is shown rather than an invented one).
export function typicalSameWeekdayByNow({ tips = [], tz = 'UTC', now = new Date(), weeks = 12, minDays = 3 } = {}) {
  const nowP = localParts(now, tz)
  const earliest = new Date(now).getTime() - (weeks * 7 + 1) * 86400000
  const byDay = new Map()
  let today = 0
  for (const t of tips) {
    const at = new Date(t.date_time || t.dateRaw)
    const ms = at.getTime()
    if (isNaN(ms) || ms < earliest || ms > new Date(now).getTime()) continue
    const p = localParts(at, tz)
    if (p.weekday !== nowP.weekday || p.minute > nowP.minute) continue
    const usd = Number(t.usd) || 0
    if (p.day === nowP.day) { today += usd; continue }
    byDay.set(p.day, (byDay.get(p.day) || 0) + usd)
  }
  const past = [...byDay.values()].filter((v) => v > 0).sort((a, b) => a - b)
  if (past.length < minDays) return null
  const mid = Math.floor(past.length / 2)
  const typical = past.length % 2 ? past[mid] : (past[mid - 1] + past[mid]) / 2
  return {
    weekday: nowP.weekday,
    todayUSD: money(today),
    typicalUSD: money(typical),
    days: past.length,
    deltaPct: typical > 0 ? Math.round(((today - typical) / typical) * 100) : null,
  }
}

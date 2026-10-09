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

import { detectSessions, isValidSession, SESSION_GAP_MS } from '../analytics/sessions'
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

// Imported private/spy/group revenue arrives as one paid_sessions row per
// billing charge (Chaturbate bills private shows per minute: ~$0.38 rows).
// One fan's consecutive charges of the same type on the same platform form
// one private session, split by the same SESSION_GAP_MS as tip sessions.
// Length is not in the import, so only the first-to-last charge span is
// shown, labeled as such. Totals are unaffected (they sum the raw rows).
export function groupPaidSessions(rows = []) {
  const sorted = rows
    .filter((p) => p?.id && p.date_time && !isNaN(new Date(p.date_time).getTime()))
    .sort((a, b) => new Date(a.date_time) - new Date(b.date_time))
  const open = new Map()
  const groups = []
  for (const p of sorted) {
    const key = `${norm(p.platform)}|${norm(p.username_lower || p.username)}|${norm(p.session_type)}`
    const ms = new Date(p.date_time).getTime()
    const cur = open.get(key)
    if (cur && ms - cur.endMs <= SESSION_GAP_MS) {
      cur.rows.push(p); cur.endMs = ms
    } else {
      const g = { key, rows: [p], startMs: ms, endMs: ms }
      groups.push(g); open.set(key, g)
    }
  }
  return groups
}

function privateEntry(g) {
  const first = g.rows[0]
  const platform = norm(first.platform)
  const usd = money(g.rows.reduce((s, r) => s + (Number(r.usd) || 0), 0))
  const spanMinutes = (g.endMs - g.startMs) / 60000
  return {
    id: `private:${first.id}`,
    sourceId: first.id,
    type: 'private',
    sessionType: first.session_type || null,
    platforms: [platform],
    platformBreakdown: [{ platform, usd, tips: 0 }],
    startTime: new Date(g.startMs).toISOString(),
    endTime: new Date(g.endMs).toISOString(),
    durationMinutes: null,
    chargeSpanMinutes: g.rows.length > 1 ? spanMinutes : null,
    chargeCount: g.rows.length,
    charges: g.rows.map((r) => ({ date_time: r.date_time, usd: Number(r.usd) || 0 })),
    durationEstimated: false,
    durationUnknown: true,
    publicUSD: 0,
    privateUSD: usd,
    totalUSD: usd,
    privateMinutes: null,
    tipCount: 0,
    uniqueTippers: first.username ? 1 : 0,
    topTipper: null,
    fan: first.username || null,
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
    ...groupPaidSessions(paidSessions).map(privateEntry),
  ]
  return entries.sort((a, b) => new Date(b.startTime) - new Date(a.startTime) || (a.id < b.id ? 1 : -1))
}

// Tip groupings that fail the valid-session rule (< 30 min or < 2 tips, e.g.
// a lone $0.50 tip with no measurable length) are not sessions; they are
// hidden unless includeShort. Live shows and private imports always show.
// Their money is still in every daily/platform total.
export const isShortTipSession = (e) => (e.type === 'free_chat' || e.type === 'imported') && !e.isValid

export function filterSessionHistory(history, { type = 'all', platform = 'all', includeShort = false } = {}) {
  return (history || []).filter((e) =>
    (includeShort || !isShortTipSession(e))
    && (type === 'all' || e.type === type)
    && (platform === 'all' || e.platforms.includes(platform)))
}

function emptyBucket() {
  return {
    totalUSD: 0, publicUSD: 0, privateUSD: 0, tipCount: 0,
    fanKeys: new Set(), streamedMinutes: 0, streamedEstimated: false, activitySpanMinutes: 0,
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
//   streamed = Live active minutes only (exact). First-to-last tip spans of
//              free-chat/imported groups are NOT stream time; they are kept
//              apart as activitySpanMinutes and always labeled estimated.
//   private time = Live private-interval minutes (imports carry no duration)
//   completed = finalized Live shows + valid inferred sessions
//   best platform = highest total USD that day (null when no revenue)
// A show or inferred session belongs to the day it started.
// `days` widens the same formulas to the last N creator-local days ending
// today (1 = today, 7, 30). Nothing else changes.
export function localDayKeysBack(now, tz, days = 1) {
  const keys = new Set()
  const base = new Date(now).getTime()
  for (let i = 0; keys.size < days && i < days + 3; i++) keys.add(localDayKey(new Date(base - i * 86400000), tz))
  return keys
}

export function dailySessionStats({ tips = [], history = [], paidSessions = [], tz = 'UTC', now = new Date(), days = 1 } = {}) {
  const day = localDayKey(now, tz)
  const inRange = localDayKeysBack(now, tz, days)
  const overall = emptyBucket()
  const byPlatform = new Map()
  const bucketFor = (p) => {
    const k = norm(p) || 'unknown'
    if (!byPlatform.has(k)) byPlatform.set(k, emptyBucket())
    return byPlatform.get(k)
  }

  for (const t of tips) {
    if (!inRange.has(localDayKey(t.date_time || t.dateRaw, tz))) continue
    const usd = Number(t.usd) || 0
    const key = fanKey(t.platform, t.username)
    for (const b of [overall, bucketFor(t.platform)]) {
      b.publicUSD += usd
      b.tipCount += 1
      b.fanKeys.add(key)
    }
  }

  for (const p of paidSessions) {
    if (!inRange.has(localDayKey(p.date_time, tz))) continue
    const usd = Number(p.usd) || 0
    overall.privateUSD += usd
    bucketFor(p.platform).privateUSD += usd
  }

  for (const e of history) {
    if (e.type === 'private') continue
    if (!inRange.has(localDayKey(e.startTime, tz))) continue
    if (e.type === 'live') overall.streamedMinutes += e.durationMinutes || 0
    else { overall.activitySpanMinutes += e.durationMinutes || 0; overall.streamedEstimated = true }
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
    days,
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
  const candidates = history.filter((e) => e.type !== 'private' && e.endTime && !isShortTipSession(e))
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

// ── FRESHNESS (all from real timestamps; nothing synthesized) ────────────

// Canonical tips (public) in the last `minutes` before `now`.
export function recentActivity({ tips = [], now = new Date(), minutes = 10 } = {}) {
  const end = new Date(now).getTime()
  const start = end - minutes * 60000
  let usd = 0, count = 0, lastAt = null
  for (const t of tips) {
    const ms = new Date(t.date_time || t.dateRaw).getTime()
    if (isNaN(ms) || ms > end) continue
    if (!lastAt || ms > lastAt) lastAt = ms
    if (ms < start) continue
    usd += Number(t.usd) || 0
    count += 1
  }
  return { minutes, usd: money(usd), count, lastTipAt: lastAt ? new Date(lastAt).toISOString() : null }
}

// Today's leading platform now vs `minutes` ago (same daily formula applied to
// only the data that existed then). Returns { platform } only when the leader
// actually changed and earned something; otherwise null.
export function leaderShift({ tips = [], history = [], paidSessions = [], tz = 'UTC', now = new Date(), minutes = 10 } = {}) {
  const cutoff = new Date(new Date(now).getTime() - minutes * 60000)
  const before = (iso) => new Date(iso).getTime() <= cutoff.getTime()
  const nowStats = dailySessionStats({ tips, history, paidSessions, tz, now })
  if (!nowStats.bestPlatform) return null
  if (localDayKey(cutoff, tz) !== nowStats.day) return null
  const then = dailySessionStats({
    tips: tips.filter((t) => before(t.date_time || t.dateRaw)),
    history: history.filter((e) => e.endTime && before(e.endTime)),
    paidSessions: paidSessions.filter((p) => before(p.date_time)),
    tz, now: cutoff,
  })
  if (then.bestPlatform === nowStats.bestPlatform) return null
  return { platform: nowStats.bestPlatform, previous: then.bestPlatform, minutes }
}

// Public tips per local hour today (0–23), for a sparkline.
export function todayHourly({ tips = [], tz = 'UTC', now = new Date() } = {}) {
  const day = localDayKey(now, tz)
  const hours = Array(24).fill(0)
  for (const t of tips) {
    const at = new Date(t.date_time || t.dateRaw)
    if (isNaN(at.getTime())) continue
    const p = localParts(at, tz)
    if (p.day !== day) continue
    hours[Math.floor(p.minute / 60)] += Number(t.usd) || 0
  }
  return hours.map(money)
}

export function timeAgo(iso, now = new Date()) {
  if (!iso) return null
  const s = Math.max(0, Math.round((new Date(now) - new Date(iso)) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m ago`
  return `${Math.floor(h / 24)}d ago`
}

// Public tips today up to now vs yesterday up to the same local time.
// Null unless yesterday had public tips by then (no comparison is invented).
export function vsYesterdayByNow({ tips = [], tz = 'UTC', now = new Date() } = {}) {
  const nowP = localParts(new Date(now), tz)
  const yKey = localDayKey(new Date(new Date(now).getTime() - 86400000), tz)
  let today = 0, yesterday = 0
  for (const t of tips) {
    const at = new Date(t.date_time || t.dateRaw)
    if (isNaN(at.getTime()) || at > new Date(now)) continue
    const p = localParts(at, tz)
    if (p.minute > nowP.minute) continue
    if (p.day === nowP.day) today += Number(t.usd) || 0
    else if (p.day === yKey) yesterday += Number(t.usd) || 0
  }
  if (yesterday <= 0) return null
  return { todayUSD: money(today), yesterdayUSD: money(yesterday), deltaPct: Math.round(((today - yesterday) / yesterday) * 100) }
}

// Cumulative public tips by local hour today (for the hero trend line).
export function todayCumulative({ tips = [], tz = 'UTC', now = new Date() } = {}) {
  const hourly = todayHourly({ tips, tz, now })
  const nowHour = Math.floor(localParts(new Date(now), tz).minute / 60)
  let run = 0
  return hourly.slice(0, nowHour + 1).map((v) => money((run += v)))
}

// Earnings over one session's real span, in `count` equal buckets.
//  public  = canonical tips at their times
//  private = Live private intervals spread over their real start→end (rate is
//            per minute), or imported private charges at their charge times
//  tips    = tip events per bucket
// Null when there is nothing time-resolved to plot.
export function sessionTimeline(entry, { tips = [], count = 24 } = {}) {
  if (!entry) return null
  let events = []
  let privates = []
  if (entry.type === 'live') {
    events = tips.filter((t) => t.live_session_id === entry.sourceId)
    privates = (entry.privateIntervals || []).filter((iv) => iv.startedAt && iv.endedAt)
      .map((iv) => ({ start: new Date(iv.startedAt).getTime(), end: new Date(iv.endedAt).getTime(), usd: Number(iv.earningsUsd) || 0 }))
  } else if (entry.type === 'private') {
    privates = (entry.charges || []).map((c) => { const ms = new Date(c.date_time).getTime(); return { start: ms, end: ms, usd: Number(c.usd) || 0 } })
  } else {
    events = entry.session?.tips || []
  }
  const times = [
    ...events.map((t) => new Date(t.date_time || t.dateRaw).getTime()),
    ...privates.flatMap((p) => [p.start, p.end]),
  ].filter((x) => !isNaN(x))
  const start = Math.min(new Date(entry.startTime).getTime(), ...times)
  const end = Math.max(new Date(entry.endTime || entry.startTime).getTime(), ...times)
  if (!isFinite(start) || !isFinite(end) || end <= start || (events.length + privates.length) < 2) return null
  const width = (end - start) / count
  const buckets = Array.from({ length: count }, (_, i) => ({ t: new Date(start + i * width).toISOString(), public: 0, private: 0, tips: 0 }))
  const at = (ms) => Math.min(count - 1, Math.max(0, Math.floor((ms - start) / width)))
  for (const t of events) {
    const b = buckets[at(new Date(t.date_time || t.dateRaw).getTime())]
    b.public += Number(t.usd) || 0
    b.tips += 1
  }
  for (const p of privates) {
    if (p.end <= p.start) { buckets[at(p.start)].private += p.usd; continue }
    for (let i = at(p.start); i <= at(p.end); i++) {
      const bs = start + i * width, be = bs + width
      const overlap = Math.max(0, Math.min(be, p.end) - Math.max(bs, p.start))
      buckets[i].private += p.usd * (overlap / (p.end - p.start))
    }
  }
  for (const b of buckets) { b.public = money(b.public); b.private = money(b.private) }
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString(), buckets }
}

// ── ADAPTIVE SESSIONS (CSV / single-platform / mixed) ───────────────────

// Which data the creator has, so the Sessions tab can adapt its content:
//   none  → no tips, shows or private rows
//   csv   → imported data only (uploads / paid_sessions), no Live Mode
//   live  → Live Mode / extension data only
//   mixed → both
// platforms = supported platforms that actually have data.
export function sessionsMode({ tips = [], shows = [], paidSessions = [], live = false } = {}) {
  const liveTip = (t) => t.source === 'extension' || !!t.live_session_id
  const hasLive = !!live || shows.length > 0 || tips.some(liveTip)
  const hasImported = tips.some((t) => !liveTip(t)) || paidSessions.length > 0
  const seen = new Set()
  for (const t of tips) seen.add(norm(t.platform))
  for (const p of paidSessions) seen.add(norm(p.platform))
  for (const sh of shows) {
    seen.add(norm(sh.platform))
    for (const r of sh.platformRevenue || []) seen.add(norm(r.platform))
  }
  const platforms = SUPPORTED_PLATFORMS.filter((p) => seen.has(p))
  const kind = hasLive && hasImported ? 'mixed' : hasLive ? 'live' : hasImported ? 'csv' : 'none'
  return { kind, hasLive, hasImported, platforms, singlePlatform: platforms.length <= 1 }
}

// Meaningful sessions: finalized Live shows + inferred tip sessions that pass
// isValidSession (>= 30 min AND >= 2 tips). Imported private charges are
// private earnings, not tip sessions, and are not counted here.
export const isMeaningfulSession = (e) => e.type === 'live' || ((e.type === 'free_chat' || e.type === 'imported') && e.isValid)

const median = (xs) => {
  if (!xs.length) return null
  const v = [...xs].sort((a, b) => a - b)
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

// Overall performance over everything passed in (the caller passes the
// plan-gated dataset, so Free history limits already apply).
//   public   = Σ tips.usd
//   private  = Σ paid_sessions.usd + Σ finalized Live private (show.privateUsd)
//   total    = public + private
//   tips / unique tippers (platform:username) / top tipper / largest tip use
//   tips only (manual tips, never private revenue).
//   meaningful sessions, avg and median per-session total use
//   isMeaningfulSession. No $/hr and no streamed time: imported history has
//   no true stream duration.
export function overallSessionStats({ tips = [], history = [], paidSessions = [] } = {}) {
  let publicUSD = 0
  let largest = null
  const fans = new Map()
  const dates = []
  for (const t of tips) {
    const usd = Number(t.usd) || 0
    publicUSD += usd
    const k = fanKey(t.platform, t.username)
    const f = fans.get(k) || { username: t.username, platform: norm(t.platform), usd: 0 }
    f.usd += usd
    fans.set(k, f)
    if (!largest || usd > largest.usd) largest = { usd: money(usd), username: t.username, platform: norm(t.platform) }
    const d = t.date_time || t.dateRaw
    if (d && !isNaN(new Date(d).getTime())) dates.push(new Date(d).getTime())
  }
  let privateUSD = 0
  for (const p of paidSessions) {
    privateUSD += Number(p.usd) || 0
    if (p.date_time && !isNaN(new Date(p.date_time).getTime())) dates.push(new Date(p.date_time).getTime())
  }
  for (const e of history) if (e.type === 'live') privateUSD += e.privateUSD || 0

  const ranked = [...fans.values()].sort((a, b) => b.usd - a.usd || norm(a.username).localeCompare(norm(b.username)))
  const meaningful = history.filter(isMeaningfulSession)
  const totals = meaningful.map((e) => e.totalUSD)
  const top3 = ranked.slice(0, 3).map((f) => ({ ...f, usd: money(f.usd) }))
  const top3USD = top3.reduce((a, f) => a + f.usd, 0)
  return {
    totalUSD: money(publicUSD + privateUSD),
    publicUSD: money(publicUSD),
    privateUSD: money(privateUSD),
    tipCount: tips.length,
    uniqueTippers: fans.size,
    meaningfulSessions: meaningful.length,
    avgSessionUSD: totals.length ? money(totals.reduce((a, b) => a + b, 0) / totals.length) : null,
    medianSessionUSD: totals.length ? money(median(totals)) : null,
    topTipper: ranked[0] ? { username: ranked[0].username, platform: ranked[0].platform, usd: money(ranked[0].usd) } : null,
    largestTip: largest && largest.usd > 0 ? largest : null,
    topFans: top3,
    topFansSharePct: publicUSD > 0 && top3.length ? Math.round((top3USD / publicUSD) * 100) : null,
    firstAt: dates.length ? new Date(Math.min(...dates)).toISOString() : null,
    lastAt: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
  }
}

// Session Performance cards (replace platform comparison when there is one
// platform, and in the Overall scope). Built from meaningful sessions only.
//   typical  : median per-session total and median tips per session.
//              < 3 sessions → null ("Not enough data yet"); 3–4 → early signal.
//   momentum : average of the most recent N sessions vs the N before them,
//              N = min(5, floor(count / 2)); needs >= 6 sessions.
//   audience : unique tippers, repeat fans (tipped in >= 2 meaningful
//              sessions), top 3 fans and their share of public tips.
export function sessionPerformance({ history = [], tips = [], overall = null } = {}) {
  const meaningful = history.filter(isMeaningfulSession).sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
  const n = meaningful.length
  const typical = n >= 3 ? {
    sessions: n,
    medianUSD: money(median(meaningful.map((e) => e.totalUSD))),
    medianTips: Math.round(median(meaningful.map((e) => e.tipCount || 0))),
    early: n < 5,
  } : null

  const k = Math.min(5, Math.floor(n / 2))
  let momentum = null
  if (n >= 6) {
    const avg = (xs) => xs.reduce((a, e) => a + e.totalUSD, 0) / xs.length
    const recent = avg(meaningful.slice(0, k))
    const prior = avg(meaningful.slice(k, 2 * k))
    momentum = { window: k, recentAvgUSD: money(recent), priorAvgUSD: money(prior), deltaPct: prior > 0 ? Math.round(((recent - prior) / prior) * 100) : null }
  }

  // Which meaningful sessions each fan tipped in.
  const byFan = new Map()
  const tipsByShow = new Map()
  for (const t of tips) if (t.live_session_id) {
    if (!tipsByShow.has(t.live_session_id)) tipsByShow.set(t.live_session_id, [])
    tipsByShow.get(t.live_session_id).push(t)
  }
  for (const e of meaningful) {
    const sessionTips = e.type === 'live' ? (tipsByShow.get(e.sourceId) || []) : (e.session?.tips || [])
    for (const t of sessionTips) {
      const key = fanKey(t.platform, t.username)
      if (!byFan.has(key)) byFan.set(key, new Set())
      byFan.get(key).add(e.id)
    }
  }
  const repeatFans = [...byFan.values()].filter((set) => set.size >= 2).length
  const o = overall || overallSessionStats({ tips, history })
  const audience = o.uniqueTippers > 0 ? {
    uniqueTippers: o.uniqueTippers,
    repeatFans,
    topFans: o.topFans,
    topFansSharePct: o.topFansSharePct,
  } : null
  return { meaningfulSessions: n, typical, momentum, audience }
}

// One truthful sentence about overall history, or null.
export function overallSignal(overall, perf) {
  if (!overall || overall.totalUSD <= 0) return null
  if (perf?.typical) return `Your typical meaningful session earns ${'$'}${perf.typical.medianUSD.toFixed(2)} (median of ${perf.typical.sessions}).`
  if (overall.topFansSharePct != null && overall.uniqueTippers >= 3) return `Your top 3 fans brought ${overall.topFansSharePct}% of your public tips.`
  return null
}


// ── SELECTED-SESSION BREAKDOWN ──────────────────────────────────────────

// The money events of one history entry, each with a time and (when known)
// the fan. Live private intervals have real start/end but no per-fan detail.
function entryEvents(entry, tips = []) {
  const at = (x) => new Date(x).getTime()
  if (entry.type === 'live') {
    return {
      tips: tips.filter((t) => t.live_session_id === entry.sourceId)
        .map((t) => ({ ms: at(t.date_time || t.dateRaw), usd: Number(t.usd) || 0, platform: norm(t.platform), username: t.username })),
      intervals: (entry.privateIntervals || []).filter((iv) => iv.startedAt && iv.endedAt)
        .map((iv) => ({ start: at(iv.startedAt), end: at(iv.endedAt), usd: Number(iv.earningsUsd) || 0 })),
      charges: [],
    }
  }
  if (entry.type === 'private') {
    return {
      tips: [], intervals: [],
      charges: (entry.charges || []).map((c) => ({ ms: at(c.date_time), usd: Number(c.usd) || 0, platform: entry.platforms[0], username: entry.fan })),
    }
  }
  return {
    tips: (entry.session?.tips || []).map((t) => ({ ms: at(t.date_time || t.dateRaw), usd: Number(t.usd) || 0, platform: norm(t.platform), username: t.username })),
    intervals: [], charges: [],
  }
}

// Time buckets for one selected session.
//   span: Live = exact show start→end ("Duration"); everything else = first→
//         last money event ("Earning activity span", never stream duration).
//   size: span < 60 min → 10 min; 60–180 → 15; > 180 → 30.
//   One timestamp or span < 10 min → a single bucket, no peak claim.
//   Live private intervals are spread over every bucket they overlap in
//   proportion to time (estimated); imported charges use their timestamps.
//   Peak = highest-earning bucket; its share is shown only with >= 3
//   earning buckets.
export function sessionBuckets(entry, { tips = [] } = {}) {
  if (!entry) return null
  const ev = entryEvents(entry, tips)
  const points = [...ev.tips, ...ev.charges].filter((e) => !isNaN(e.ms))
  const times = [...points.map((p) => p.ms), ...ev.intervals.flatMap((i) => [i.start, i.end])]
  if (!times.length) return null
  const exact = entry.type === 'live'
  const start = exact ? Math.min(new Date(entry.startTime).getTime(), ...times) : Math.min(...times)
  const end = exact ? Math.max(new Date(entry.endTime || entry.startTime).getTime(), ...times) : Math.max(...times)
  const spanMinutes = (end - start) / 60000
  const single = spanMinutes < 10
  const size = spanMinutes < 60 ? 10 : spanMinutes <= 180 ? 15 : 30
  const width = size * 60000
  const n = single ? 1 : Math.max(1, Math.ceil((end - start) / width))
  const buckets = Array.from({ length: n }, (_, i) => ({
    start: new Date(single ? start : start + i * width).toISOString(),
    end: new Date(single ? end : Math.min(end, start + (i + 1) * width)).toISOString(),
    publicUSD: 0, privateUSD: 0, privateEstimated: false, count: 0, fans: new Map(),
  }))
  const idx = (ms) => single ? 0 : Math.min(n - 1, Math.max(0, Math.floor((ms - start) / width)))
  for (const p of points) {
    const b = buckets[idx(p.ms)]
    if (ev.charges.includes(p)) b.privateUSD += p.usd; else b.publicUSD += p.usd
    b.count += 1
    if (p.username) {
      const k = fanKey(p.platform, p.username)
      const f = b.fans.get(k) || { username: p.username, platform: p.platform, usd: 0 }
      f.usd += p.usd
      b.fans.set(k, f)
    }
  }
  for (const iv of ev.intervals) {
    if (iv.end <= iv.start) { const b = buckets[idx(iv.start)]; b.privateUSD += iv.usd; b.privateEstimated = true; continue }
    for (let i = idx(iv.start); i <= idx(iv.end); i++) {
      const bs = single ? start : start + i * width, be = single ? end : bs + width
      const overlap = Math.max(0, Math.min(be, iv.end) - Math.max(bs, iv.start))
      if (overlap > 0) { buckets[i].privateUSD += iv.usd * (overlap / (iv.end - iv.start)); buckets[i].privateEstimated = true }
    }
  }
  const out = buckets.map((b) => {
    const fans = [...b.fans.values()].sort((x, y) => y.usd - x.usd || norm(x.username).localeCompare(norm(y.username)))
    return {
      start: b.start, end: b.end,
      publicUSD: money(b.publicUSD), privateUSD: money(b.privateUSD), privateEstimated: b.privateEstimated,
      totalUSD: money(b.publicUSD + b.privateUSD), count: b.count, uniqueFans: fans.length,
      topFan: fans[0] ? { username: fans[0].username, platform: fans[0].platform, usd: money(fans[0].usd) } : null,
    }
  })
  const total = out.reduce((a, b) => a + b.totalUSD, 0)
  const earning = out.filter((b) => b.totalUSD > 0)
  const peak = !single && earning.length ? earning.reduce((a, b) => (b.totalUSD > a.totalUSD ? b : a)) : null
  return {
    exact, label: exact ? 'Duration' : 'Earning activity span',
    start: new Date(start).toISOString(), end: new Date(end).toISOString(), spanMinutes,
    bucketMinutes: single ? null : size, single, buckets: out,
    peak: peak ? { start: peak.start, end: peak.end, totalUSD: peak.totalUSD, sharePct: earning.length >= 3 && total > 0 ? Math.round((peak.totalUSD / total) * 100) : null } : null,
  }
}

// Fans who drove one selected session, ranked by USD contributed to it.
//   share     = fan USD / session total (Live private intervals carry no fan
//               detail, so Live shares can sum to less than 100%).
//   returning = this platform:username has a tip or private charge strictly
//               before the session's first money event, within the data
//               passed in (plan-gated history); otherwise new.
export function sessionFanDrivers(entry, { tips = [], paidSessions = [] } = {}) {
  if (!entry) return []
  const ev = entryEvents(entry, tips)
  const points = [...ev.tips, ...ev.charges].filter((p) => p.username && !isNaN(p.ms))
  if (!points.length) return []
  const firstMs = Math.min(...points.map((p) => p.ms))
  const earliest = new Map()
  const seen = (platform, username, x) => {
    const ms = new Date(x).getTime()
    if (isNaN(ms)) return
    const k = fanKey(platform, username)
    if (!earliest.has(k) || ms < earliest.get(k)) earliest.set(k, ms)
  }
  for (const t of tips) seen(t.platform, t.username, t.date_time || t.dateRaw)
  for (const p of paidSessions) seen(p.platform, p.username, p.date_time)
  const fans = new Map()
  for (const p of points) {
    const k = fanKey(p.platform, p.username)
    const f = fans.get(k) || { username: p.username, platform: p.platform, usd: 0, count: 0 }
    f.usd += p.usd
    f.count += 1
    fans.set(k, f)
  }
  const total = Number(entry.totalUSD) || 0
  return [...fans.entries()].map(([k, f]) => ({
    username: f.username, platform: f.platform, usd: money(f.usd), count: f.count,
    sharePct: total > 0 ? Math.round((f.usd / total) * 100) : null,
    returning: earliest.has(k) && earliest.get(k) < firstMs,
  })).sort((a, b) => b.usd - a.usd || norm(a.username).localeCompare(norm(b.username)))
}

// ── SESSION VS THE CREATOR'S OWN TYPICAL ────────────────────────────────
// Compares one meaningful session's total with the median total of the
// creator's OTHER meaningful sessions (never other creators).
//   basis 'same': same platform and same type (live / free_chat / imported),
//                 used when there are >= 5 of them;
//   basis 'all' : all other meaningful sessions, when >= 5;
//   otherwise null (not enough history to claim anything).
// outcome: 'above' / 'below' the median, or 'par' when equal.
export const VS_TYPICAL_MIN = 5
export function sessionVsTypical(entry, history = []) {
  if (!entry || !isMeaningfulSession(entry)) return null
  const others = history.filter((e) => e.id !== entry.id && isMeaningfulSession(e))
  const same = others.filter((e) => e.type === entry.type && e.platforms[0] === entry.platforms[0])
  const pool = same.length >= VS_TYPICAL_MIN ? same : others.length >= VS_TYPICAL_MIN ? others : null
  if (!pool) return null
  const med = median(pool.map((e) => e.totalUSD))
  if (!(med > 0)) return null
  const deltaPct = Math.round(((entry.totalUSD - med) / med) * 100)
  return {
    basis: pool === same ? 'same' : 'all',
    sessions: pool.length,
    medianUSD: money(med),
    deltaPct,
    outcome: entry.totalUSD > med ? 'above' : entry.totalUSD < med ? 'below' : 'par',
  }
}

// ── SCHEDULE STATUS (saved planned_streams only) ────────────────────────
// Matches a session to the creator's saved dated plans. Recommendation
// windows and planner preferences are never treated as plans.
//   start used: Live = exact show start; everything else = first money event
//               (labeled as when activity began, never as the stream start).
//   candidates: same platform, session start between 2 h before the planned
//               start and the planned end; nearest planned start wins.
//   status: no_plans (creator has never saved a plan) | unscheduled (plans
//           exist, none matched) | on_schedule (within ±15 min) | early
//           (> 15 min and <= 2 h before) | late (> 15 min after, before end).
//   Live only: end difference and overlap % of the planned window.
export const SCHEDULE_ON_TIME_MIN = 15
export const SCHEDULE_EARLY_MAX_MIN = 120
export function matchPlannedStream(entry, plans = []) {
  if (!entry) return null
  if (!plans.length) return { status: 'no_plans' }
  const exact = entry.type === 'live'
  const startMs = new Date(entry.startTime).getTime()
  const plats = new Set((entry.platforms || []).map(norm))
  const candidates = plans.map((p) => ({ ...p, s: new Date(p.planned_start_at).getTime(), e: new Date(p.planned_end_at).getTime() }))
    .filter((p) => plats.has(norm(p.platform)) && startMs >= p.s - SCHEDULE_EARLY_MAX_MIN * 60000 && startMs <= p.e)
  if (!candidates.length) return { status: 'unscheduled', exact }
  const plan = candidates.sort((a, b) => Math.abs(startMs - a.s) - Math.abs(startMs - b.s))[0]
  const startDiffMin = Math.round((startMs - plan.s) / 60000)
  const status = Math.abs(startDiffMin) <= SCHEDULE_ON_TIME_MIN ? 'on_schedule' : startDiffMin < 0 ? 'early' : 'late'
  const out = {
    status, exact, startDiffMin,
    plan: { id: plan.id, platform: plan.platform, start: plan.planned_start_at, end: plan.planned_end_at },
    insideWindow: startMs >= plan.s && startMs <= plan.e,
  }
  if (exact && entry.endTime) {
    const endMs = new Date(entry.endTime).getTime()
    out.endDiffMin = Math.round((endMs - plan.e) / 60000)
    const overlap = Math.max(0, Math.min(endMs, plan.e) - Math.max(startMs, plan.s))
    out.overlapPct = Math.round((overlap / (plan.e - plan.s)) * 100)
  }
  return out
}

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

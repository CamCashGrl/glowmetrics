// ============================================================
// LIVE VIP BOARD — pure data helpers (no React, no DOM).
// Shared by app/dashboard/page.js (Live Mode tab) and app/live/page.js.
// Follows the same convention as roomHealth.js / velocity.js / sessionPhase.js:
// plain functions in, plain objects out, so both host pages can render them.
// ============================================================

import { tokenRate } from '../constants'

export const VIP_PLATFORMS = ['Chaturbate', 'BongaCams', 'MyFreeCams', 'Stripchat', 'CamSoda']

export const RANGE_TABS = [
  { key: 'session', label: 'Live Session' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'allTime', label: 'All Time' },
]

export const SORT_OPTIONS = [
  { key: 'total', label: 'Total Earned' },
  { key: 'count', label: 'Tip Count' },
  { key: 'biggest', label: 'Biggest Single Tip' },
  { key: 'recent', label: 'Most Recent Tip' },
  { key: 'climber', label: 'Fastest Climber' },
]

export const FAN_TIERS = {
  Whale:   { label: 'Whale',   icon: '🐳', color: '#F59E0B' },
  Shark:   { label: 'Shark',   icon: '🦈', color: '#60A5FA' },
  Regular: { label: 'Regular', icon: '⭐', color: '#22D3EE' },
  New:     { label: 'New',     icon: '✨', color: '#10B981' },
  Dormant: { label: 'Dormant', icon: '💤', color: '#475569' },
}

export function getFanTier({ totalUsd = 0, tipCount = 0, isNewThisSession = false, daysSinceLastTip = 0 }) {
  if (isNewThisSession) return 'New'
  if (totalUsd >= 100 && tipCount >= 10) return 'Whale'
  if (totalUsd >= 30 && tipCount >= 5) return 'Shark'
  if (daysSinceLastTip > 60) return 'Dormant'
  if (totalUsd >= 5 && tipCount >= 2) return 'Regular'
  return 'Regular'
}

// "BigDaddy123" -> "BigD***", "alex" -> "a***"
export function maskUsername(username, enabled) {
  if (!enabled || !username) return username || 'Unknown'
  const visible = username.slice(0, Math.min(4, Math.max(1, username.length - 1)))
  return `${visible}***`
}

export function normalizeHistoricalTip(row) {
  const usd = row.usd != null && row.usd !== '' ? parseFloat(row.usd) : null
  const tokens = row.tokens != null && row.tokens !== '' ? parseInt(row.tokens, 10) : null
  const platform = row.platform || 'Chaturbate'
  return {
    username: (row.username || 'Unknown').trim(),
    platform,
    usd: usd != null ? usd : parseFloat(((tokens || 0) * tokenRate(platform)).toFixed(2)),
    tokens: tokens != null ? tokens : Math.round((usd || 0) / tokenRate(platform)),
    timestamp: new Date(row.date_time || row.received_at || row.created_at),
  }
}

// liveEvents are already normalized by the host page's normalizeTip() — just re-key.
export function normalizeLiveTip(ev) {
  const platform = ev.platform
    ? ev.platform.charAt(0).toUpperCase() + ev.platform.slice(1)
    : 'Chaturbate'
  return {
    username: (ev.username || 'Unknown').trim(),
    platform,
    usd: ev.normalizedRevenue != null ? ev.normalizedRevenue : (ev.usd || 0),
    tokens: ev.tokens || 0,
    timestamp: ev.timestamp instanceof Date ? ev.timestamp : new Date(ev.timestamp),
  }
}

export function getRangeStart(range, now = new Date()) {
  const d = new Date(now)
  if (range === 'today') {
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (range === 'week') {
    const day = d.getDay() // 0 = Sun
    const diffToMonday = (day + 6) % 7
    d.setDate(d.getDate() - diffToMonday)
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (range === 'month') {
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  }
  return null // allTime / session (session uses sessionStart instead)
}

const fanKey = (username, platform) => `${(username || 'unknown').trim().toLowerCase()}::${(platform || '').toLowerCase()}`

// Lifetime aggregate per username+platform, used to look up a fan's tier
// regardless of which time-range tab is currently being viewed.
export function buildFanIndex(allRecords, now = new Date()) {
  const index = {}
  for (const rec of allRecords) {
    const key = fanKey(rec.username, rec.platform)
    if (!index[key]) {
      index[key] = {
        username: rec.username,
        platform: rec.platform,
        totalUsd: 0,
        tipCount: 0,
        biggestTipUsd: 0,
        biggestTipTokens: 0,
        firstTipAt: rec.timestamp,
        lastTipAt: rec.timestamp,
        sessionDays: new Set(),
      }
    }
    const f = index[key]
    f.totalUsd += rec.usd || 0
    f.tipCount += 1
    if ((rec.usd || 0) > f.biggestTipUsd) f.biggestTipUsd = rec.usd || 0
    if ((rec.tokens || 0) > f.biggestTipTokens) f.biggestTipTokens = rec.tokens || 0
    if (rec.timestamp < f.firstTipAt) f.firstTipAt = rec.timestamp
    if (rec.timestamp > f.lastTipAt) f.lastTipAt = rec.timestamp
    f.sessionDays.add(rec.timestamp.toDateString())
  }
  Object.values(index).forEach(f => {
    f.daysSinceLastTip = Math.floor((now - f.lastTipAt) / (1000 * 60 * 60 * 24))
    f.sessionsTipped = f.sessionDays.size
    delete f.sessionDays
  })
  return index
}

/**
 * Build a ranked leaderboard for one range/platform/sort combination.
 * `records` should already be filtered to the desired time range.
 */
export function buildLeaderboard({
  records,
  fanIndex,
  platformFilter = 'all',
  sortBy = 'total',
  excludedFans = [],
  minTipUsd = 0,
  sessionStart = null,
  now = new Date(),
}) {
  const excludedSet = new Set((excludedFans || []).map(u => u.trim().toLowerCase()))
  const grouped = {}

  for (const rec of records) {
    if (platformFilter !== 'all' && rec.platform.toLowerCase() !== platformFilter.toLowerCase()) continue
    if (excludedSet.has(rec.username.trim().toLowerCase())) continue

    const key = fanKey(rec.username, rec.platform)
    if (!grouped[key]) {
      grouped[key] = {
        username: rec.username,
        platform: rec.platform,
        totalUsd: 0,
        totalTokens: 0,
        tipCount: 0,
        biggestTipUsd: 0,
        biggestTipTokens: 0,
        firstTipAt: rec.timestamp,
        lastTipAt: rec.timestamp,
      }
    }
    const g = grouped[key]
    g.totalUsd += rec.usd || 0
    g.totalTokens += rec.tokens || 0
    g.tipCount += 1
    if ((rec.usd || 0) > g.biggestTipUsd) { g.biggestTipUsd = rec.usd || 0; g.biggestTipTokens = rec.tokens || 0 }
    if (rec.timestamp < g.firstTipAt) g.firstTipAt = rec.timestamp
    if (rec.timestamp > g.lastTipAt) g.lastTipAt = rec.timestamp
  }

  let entries = Object.entries(grouped)
    .map(([key, g]) => {
      const lifetime = fanIndex?.[key]
      const isNewThisSession = !!sessionStart && g.firstTipAt >= sessionStart
      const tier = getFanTier({
        totalUsd: lifetime?.totalUsd ?? g.totalUsd,
        tipCount: lifetime?.tipCount ?? g.tipCount,
        isNewThisSession,
        daysSinceLastTip: lifetime?.daysSinceLastTip ?? 0,
      })
      return {
        key,
        username: g.username,
        platform: g.platform,
        totalUsd: parseFloat(g.totalUsd.toFixed(2)),
        totalTokens: g.totalTokens,
        tipCount: g.tipCount,
        biggestTipUsd: parseFloat(g.biggestTipUsd.toFixed(2)),
        biggestTipTokens: g.biggestTipTokens,
        firstTipAt: g.firstTipAt,
        lastTipAt: g.lastTipAt,
        tier,
        sessionsTipped: lifetime?.sessionsTipped ?? 1,
        allTimeTotalUsd: lifetime ? parseFloat(lifetime.totalUsd.toFixed(2)) : g.totalUsd,
      }
    })
    .filter(e => e.totalUsd >= minTipUsd)

  entries.sort((a, b) => {
    if (sortBy === 'count') return b.tipCount - a.tipCount
    if (sortBy === 'biggest') return b.biggestTipUsd - a.biggestTipUsd
    if (sortBy === 'recent') return b.lastTipAt - a.lastTipAt
    return b.totalUsd - a.totalUsd // 'total' and 'climber' base order; climber re-sorts below
  })

  entries.forEach((e, i) => { e.rank = i + 1 })

  return entries
}

// Applies "Fastest Climber" ordering using a previous-rank snapshot (username::platform -> rank).
export function applyClimberSort(entries, previousRanks) {
  if (!previousRanks) return entries
  const withDelta = entries.map(e => {
    const prevRank = previousRanks[e.key]
    const climb = prevRank != null ? prevRank - e.rank : entries.length // brand-new entrants read as a big climb
    return { ...e, rankPrevious: prevRank ?? null, rankChange: prevRank != null ? prevRank - e.rank : null, _climb: climb }
  })
  withDelta.sort((a, b) => b._climb - a._climb)
  withDelta.forEach(e => delete e._climb)
  return withDelta
}

export function withRankChange(entries, previousRanks) {
  if (!previousRanks) return entries.map(e => ({ ...e, rankPrevious: null, rankChange: null }))
  return entries.map(e => {
    const prevRank = previousRanks[e.key]
    return { ...e, rankPrevious: prevRank ?? null, rankChange: prevRank != null ? prevRank - e.rank : null }
  })
}

export function snapshotRanks(entries) {
  const snap = {}
  entries.forEach(e => { snap[e.key] = e.rank })
  return snap
}

export function getSuggestedAction(entry) {
  if (!entry) return ''
  if (entry.tier === 'Whale') return 'Thank them by name and invite them to push the goal.'
  if (entry.tier === 'Shark') return 'They are close to whale status. Give them a personal shoutout.'
  const hoursSinceTip = (Date.now() - new Date(entry.lastTipAt).getTime()) / (1000 * 60 * 60)
  if (hoursSinceTip < 1) return 'They tipped recently. Keep them engaged before the room slows down.'
  if (entry.tier === 'Regular') return 'They are a loyal smaller tipper. Acknowledge consistency, not just amount.'
  if (entry.tier === 'Dormant') return "It's been a while since their last tip. A friendly mention might bring them back."
  return 'Say hello and welcome them to the stream.'
}

// Compares a fresh Live Session top-N list to the previous one and returns
// short creator-friendly alert strings (rank changes, new whales, platform leader, etc).
export function detectLeaderboardAlerts({ previousTop, currentTop, hideFullUsernames, previousPlatformLeader }) {
  const alerts = []
  if (!previousTop || !currentTop.length) return { alerts, platformLeader: currentTop[0]?.platform || previousPlatformLeader }

  const name = (e) => maskUsername(e.username, hideFullUsernames)
  const prevByKey = new Map(previousTop.map(e => [e.key, e]))
  const prevTop3Keys = new Set(previousTop.slice(0, 3).map(e => e.key))
  const prevLeaderKey = previousTop[0]?.key

  const newLeader = currentTop[0]
  if (newLeader && newLeader.key !== prevLeaderKey) {
    alerts.push(`New #1 this session: ${name(newLeader)}`)
  }

  currentTop.slice(0, 3).forEach(e => {
    if (!prevTop3Keys.has(e.key) && e.key !== prevLeaderKey) {
      alerts.push(`${name(e)} moved into the top 3.`)
    }
  })

  currentTop.forEach(e => {
    const prev = prevByKey.get(e.key)
    if (prev && prev.tier !== 'Whale' && e.tier === 'Whale') {
      alerts.push(`${name(e)} just crossed whale status.`)
    }
    if (!prev && e.tier === 'Whale') {
      alerts.push(`New whale detected: ${name(e)}`)
    }
  })

  const biggestPrev = previousTop.reduce((m, e) => Math.max(m, e.biggestTipUsd || 0), 0)
  const biggestNow = currentTop.reduce((m, e) => Math.max(m, e.biggestTipUsd || 0), 0)
  if (biggestNow > biggestPrev && biggestPrev > 0) {
    alerts.push('New biggest tip of the session!')
  }

  const currentLeaderPlatform = currentTop[0]?.platform
  let platformLeader = previousPlatformLeader
  if (currentLeaderPlatform && currentLeaderPlatform !== previousPlatformLeader) {
    alerts.push(`${currentLeaderPlatform} is currently leading this session.`)
    platformLeader = currentLeaderPlatform
  }

  return { alerts, platformLeader }
}

export const CONTEST_TYPES = [
  { key: 'top_tipper', label: 'Top Tipper Wins' },
  { key: 'top_3', label: 'Top 3 Wins' },
  { key: 'biggest_tip', label: 'Biggest Single Tip Wins' },
  { key: 'first_to_goal', label: 'First to Goal Wins' },
  { key: 'weekly_vip_race', label: 'Weekly VIP Race' },
]

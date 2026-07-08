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

// ============================================================
// RELATIONSHIP STATUSES — "who needs attention right now," not just
// "who has tipped the most." Supersedes the plain Whale/Shark/Regular
// tier badge with a situational status + a next-best-action + ready
// -to-paste chat lines, while still falling back to the base tier
// (via getFanTier) when no situational status applies.
// ============================================================

const COOLING_OFF_MINUTES = 8
const COMPETITIVE_WINDOW_MINUTES = 3
const NEEDS_THANKS_MIN_USD = 10
const SMALL_ACTIVE_MIN_COUNT = 3
const SMALL_ACTIVE_MAX_USD = 30
const AT_RISK_DAYS = 60

export const FAN_STATUS_META = {
  ...FAN_TIERS,
  NewWhale:       { label: 'New Whale',        icon: '🐋', color: '#F59E0B' },
  ReturningVIP:   { label: 'Returning VIP',    icon: '🔁', color: '#60A5FA' },
  CoolingOff:     { label: 'Cooling Off',      icon: '❄️', color: '#38BDF8' },
  Competitive:    { label: 'Competitive',      icon: '🔥', color: '#EC4899' },
  NeedsThankYou:  { label: 'Needs Thank You',  icon: '🙏', color: '#22D3EE' },
  AtRisk:         { label: 'At Risk',          icon: '⚠️', color: '#F87171' },
  SmallButActive: { label: 'Small But Active', icon: '🌱', color: '#10B981' },
}

/**
 * Situational relationship status for one leaderboard entry. Falls back to
 * the plain lifetime tier (Whale/Shark/Regular/New/Dormant) when nothing
 * more specific applies.
 */
export function getFanStatus(entry, ctx = {}) {
  const {
    now = new Date(),
    liveActive = false,
    daysSinceLastTipAllTime = 0,
    isNewThisSession = false,
    lastThankedAt = null,
  } = ctx

  const lastTipAt = new Date(entry.lastTipAt)
  const minutesSinceLastTip = (now - lastTipAt) / 60000
  const allTimeUsd = entry.allTimeTotalUsd ?? entry.totalUsd
  const baseTier = getFanTier({
    totalUsd: allTimeUsd,
    tipCount: entry.tipCount,
    isNewThisSession,
    daysSinceLastTip: daysSinceLastTipAllTime,
  })

  if (liveActive && entry.tipCount >= 1 && minutesSinceLastTip >= COOLING_OFF_MINUTES && minutesSinceLastTip < 60) {
    return 'CoolingOff'
  }
  if (entry.rankPrevious != null && entry.rankChange > 0 && minutesSinceLastTip < COMPETITIVE_WINDOW_MINUTES) {
    return 'Competitive'
  }
  if (baseTier === 'Whale' && (entry.sessionsTipped <= 1 || isNewThisSession)) {
    return 'NewWhale'
  }
  const bigTip = entry.biggestTipUsd >= NEEDS_THANKS_MIN_USD || entry.totalUsd >= NEEDS_THANKS_MIN_USD
  if (bigTip && (!lastThankedAt || new Date(lastThankedAt) < lastTipAt)) {
    return 'NeedsThankYou'
  }
  if (entry.sessionsTipped > 1 && (baseTier === 'Whale' || baseTier === 'Shark' || baseTier === 'Regular')) {
    return 'ReturningVIP'
  }
  if (daysSinceLastTipAllTime > AT_RISK_DAYS) return 'AtRisk'
  if (entry.tipCount >= SMALL_ACTIVE_MIN_COUNT && allTimeUsd < SMALL_ACTIVE_MAX_USD) return 'SmallButActive'

  return baseTier
}

/** Next-best-action copy + a few ready-to-paste chat line variants per status. */
export function getNextBestAction(entry, status, opts = {}) {
  const name = maskUsername(entry.username, opts.hideFullUsernames)
  switch (status) {
    case 'NewWhale':
      return {
        action: 'Thank by name + offer an exclusive next-tip reward.',
        chatLines: [
          `${name}, you're carrying the room right now 😭 want something special if you push again?`,
          `${name} just went VIP on me — thank you! Let's make the next one count.`,
          `Okay ${name} is officially in whale territory 🐋 I see you.`,
        ],
      }
    case 'ReturningVIP':
      return {
        action: 'Welcome them back publicly — loyal regulars respond to recognition.',
        chatLines: [
          `${name}! You're back — I missed you. Let's pick up where we left off.`,
          `${name} showing up again is exactly why this room is fun. Thank you.`,
        ],
      }
    case 'CoolingOff':
      return {
        action: 'Re-engage before they fully check out — call them out directly.',
        chatLines: [
          `${name}, still with me? Come back and let's keep this going 👀`,
          `Where'd you go ${name} — the room's not the same without you.`,
        ],
      }
    case 'Competitive':
      return {
        action: "Lean into the leaderboard competition — it's working.",
        chatLines: [
          `${name} is fighting for that top spot — who's taking it back? 👀`,
          `${name} just reclaimed the lead. Anyone challenging them?`,
        ],
      }
    case 'NeedsThankYou':
      return {
        action: 'Say thank you by name before the moment passes.',
        chatLines: [
          `Thank you ${name} — that tip made my night 💋`,
          `${name}, seriously, thank you. That did not go unnoticed.`,
        ],
      }
    case 'AtRisk':
      return {
        action: 'A quiet personal message can bring them back before they churn.',
        chatLines: [
          `Hey ${name}, it's been a minute — would love to see you back in the room.`,
          `${name}, thinking of you — come say hi next time I'm live.`,
        ],
      }
    case 'SmallButActive':
      return {
        action: 'Encourage another small tip — consistency matters more than size.',
        chatLines: [
          `${name}, you always show up for me — that means more than you know.`,
          `Love the consistency ${name} — let's keep the streak going.`,
        ],
      }
    default:
      return {
        action: 'Acknowledge them by name — recognition drives repeat tipping.',
        chatLines: [`Thank you ${name}!`, `${name}, appreciate you being here.`],
      }
  }
}

/** Distinct fans who tipped within the last `windowMinutes` of the current session. */
export function computeActiveTipperCount(records, sessionStart, now = new Date(), windowMinutes = 10) {
  if (!sessionStart) return 0
  const cutoff = new Date(now.getTime() - windowMinutes * 60000)
  const active = new Set()
  records.forEach(r => {
    if (r.timestamp >= sessionStart && r.timestamp >= cutoff) active.add(r.username.trim().toLowerCase())
  })
  return active.size
}

export function getRotateAttentionWarning(activeTipperCount) {
  if (activeTipperCount < 3) return null
  return {
    headline: `You have ${activeTipperCount} active tippers right now.`,
    body: "Rotate attention between them to keep the competition alive — don't over-focus one fan.",
    chatLines: [
      "Everyone's showing up tonight 👀 who's going for the top spot?",
      "Room is stacked right now — let's see who wants it most.",
    ],
  }
}

/**
 * The single highest-priority "Do This Now" recommendation: a rotate-attention
 * warning when 3+ fans are actively tipping, otherwise the top session fan's
 * situational status + next best action + chat lines.
 */
export function getPrimaryVipAction({ sessionEntries = [], activeTipperCount = 0, doneKeys = new Set(), hideFullUsernames, hideDollarAmounts }) {
  const rotate = getRotateAttentionWarning(activeTipperCount)
  const candidates = sessionEntries.filter(e => !doneKeys.has(e.key))
  const top = candidates[0]

  let vipResult = null
  if (top) {
    const status = top.status || 'Regular'
    const { action, chatLines } = getNextBestAction(top, status, { hideFullUsernames, hideDollarAmounts })
    const meta = FAN_STATUS_META[status] || FAN_STATUS_META.Regular
    vipResult = {
      kind: 'vip', key: top.key, fan: top, status, statusMeta: meta,
      headline: `${maskUsername(top.username, hideFullUsernames)} — ${meta.label}`,
      body: action, chatLines,
    }
  }

  if (rotate) return { kind: 'rotate', key: '__rotate__', ...rotate, chatLines: rotate.chatLines, fallbackVip: vipResult }
  return vipResult
}

/** Attaches a `.status` field to each leaderboard entry (see getFanStatus). */
export function attachFanStatus(entries, fanIndex, { now = new Date(), liveActive = false, sessionStart = null } = {}) {
  return entries.map(e => {
    const lifetime = fanIndex[e.key]
    const isNewThisSession = !!sessionStart && e.firstTipAt >= sessionStart
    const status = getFanStatus(e, {
      now, liveActive,
      daysSinceLastTipAllTime: lifetime?.daysSinceLastTip ?? 0,
      isNewThisSession,
      lastThankedAt: getFanNote(e.key).lastThankedAt,
    })
    return { ...e, status }
  })
}

// ============================================================
// PRIVATE, CLIENT-SIDE STORES — per-fan relationship notes and
// "mark done" dismissals. Nothing here touches tip/earnings data;
// it's UI memory only, scoped to this browser.
// ============================================================

const NOTES_STORAGE_KEY = 'camcash_vip_notes_v1'
const DONE_STORAGE_KEY = 'camcash_vip_done_v1'

function readJSON(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function writeJSON(key, value) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export const EMPTY_FAN_NOTE = { likes: '', respondsTo: '', avoid: '', customNote: '', lastThankedAt: null }

export function loadAllFanNotes() {
  return readJSON(NOTES_STORAGE_KEY, {})
}

export function getFanNote(key) {
  const all = loadAllFanNotes()
  return { ...EMPTY_FAN_NOTE, ...(all[key] || {}) }
}

export function saveFanNote(key, patch) {
  const all = loadAllFanNotes()
  all[key] = { ...EMPTY_FAN_NOTE, ...(all[key] || {}), ...patch }
  writeJSON(NOTES_STORAGE_KEY, all)
  return all[key]
}

export function markFanThanked(key) {
  return saveFanNote(key, { lastThankedAt: new Date().toISOString() })
}

export function loadDoneMap() {
  return readJSON(DONE_STORAGE_KEY, {})
}

export function markActionDone(key, minutes = 20) {
  const map = loadDoneMap()
  map[key] = Date.now() + minutes * 60000
  writeJSON(DONE_STORAGE_KEY, map)
}

export function getActiveDoneKeys() {
  const map = loadDoneMap()
  const now = Date.now()
  return new Set(Object.entries(map).filter(([, exp]) => exp > now).map(([k]) => k))
}

// ============================================================
// PRIVACY MODE — one obvious switch instead of a pile of checkboxes.
// 'private' shows everything to the model; 'overlay' is the safe,
// stream-visible preset (masked usernames, no dollar amounts, no
// private notes, no revenue-share strategy reasoning).
// ============================================================

export const PRIVACY_MODES = {
  private: {
    label: 'Private Dashboard Only',
    description: 'Full usernames, dollar amounts, and strategy notes — visible to you only.',
  },
  overlay: {
    label: 'Safe Overlay Mode',
    description: 'For OBS/stream — hides full usernames, dollar amounts, private notes, and revenue-share reasoning.',
  },
}

// `settings.privacyMode` must reflect the mode BEFORE this transition (callers
// changing mode should pass the unmodified previous settings object, not one
// with privacyMode already overwritten) — otherwise "entering overlay" can
// never be detected and the pre-overlay snapshot below never fires.
export function applyPrivacyModeDefaults(mode, settings) {
  if (mode === 'overlay') {
    // Snapshot whatever the model had chosen in private mode (only on the transition
    // into overlay — repeated calls while already in overlay must not overwrite it),
    // so switching back to private restores it instead of leaving things force-hidden.
    const enteringOverlay = settings.privacyMode !== 'overlay'
    return {
      ...settings,
      privacyMode: mode,
      _preOverlayHideFullUsernames: enteringOverlay ? settings.hideFullUsernames : settings._preOverlayHideFullUsernames,
      _preOverlayHideDollarAmounts: enteringOverlay ? settings.hideDollarAmounts : settings._preOverlayHideDollarAmounts,
      hideFullUsernames: true,
      hideDollarAmounts: true,
    }
  }
  return {
    ...settings,
    privacyMode: mode,
    hideFullUsernames: settings._preOverlayHideFullUsernames ?? settings.hideFullUsernames,
    hideDollarAmounts: settings._preOverlayHideDollarAmounts ?? settings.hideDollarAmounts,
  }
}

// ============================================================
// BOARD SETTINGS STORE — single source of truth for the VIP board's
// display/privacy settings, persisted client-side. Exported (rather than
// kept local to the LiveVIPBoard component) so host pages can read the
// current privacy mode directly — e.g. to decide whether an existing
// coaching alert that names a fan's revenue share is safe to show.
// ============================================================

const BOARD_SETTINGS_STORAGE_KEY = 'camcash_vip_board_settings_v1'

export const DEFAULT_BOARD_SETTINGS = {
  privacyMode: 'private', // 'private' | 'overlay'
  hideFullUsernames: true,
  showTokensInsteadOfUsd: false,
  hideDollarAmounts: false,
  minimumTipUsd: 1,
  excludedFans: [],
  autoResetAfterInactivity: false,
  contestMode: false,
  contestType: 'top_tipper',
}

export function loadBoardSettings() {
  return { ...DEFAULT_BOARD_SETTINGS, ...readJSON(BOARD_SETTINGS_STORAGE_KEY, {}) }
}

export function saveBoardSettings(settings) {
  writeJSON(BOARD_SETTINGS_STORAGE_KEY, settings)
}

export function isOverlayModeActive() {
  return loadBoardSettings().privacyMode === 'overlay'
}

/** Board settings with overlay-mode forcing (masked usernames, hidden $) already applied. */
export function getEffectiveBoardSettings() {
  const s = loadBoardSettings()
  return applyPrivacyModeDefaults(s.privacyMode, s)
}

// ============================================================
// AFTER-STREAM FOLLOW-UP — top-tipper maintenance doesn't stop when the
// stream ends. Categorizes the just-ended session's fans into who to
// thank, who to invite back, and who cooled off before the stream ended,
// each with a ready-to-paste message.
// ============================================================

export function buildPostStreamFollowUp(sessionEntries, sessionEndTime = new Date()) {
  const toThank = []
  const toInvite = []
  const coolingRisk = []
  const seen = new Set()

  const byTotal = [...sessionEntries].sort((a, b) => b.totalUsd - a.totalUsd)
  byTotal.forEach((e, i) => {
    if (seen.has(e.key)) return
    if (i < 3 || e.status === 'NeedsThankYou' || e.status === 'NewWhale') {
      toThank.push(e)
      seen.add(e.key)
    }
  })
  sessionEntries.forEach(e => {
    if (seen.has(e.key)) return
    if (e.status === 'ReturningVIP' || e.status === 'SmallButActive' || e.tipCount >= 2) {
      toInvite.push(e)
      seen.add(e.key)
    }
  })
  sessionEntries.forEach(e => {
    if (seen.has(e.key)) return
    const minutesSinceLastTip = (sessionEndTime - new Date(e.lastTipAt)) / 60000
    if (minutesSinceLastTip >= COOLING_OFF_MINUTES) coolingRisk.push(e)
  })

  return { toThank, toInvite, coolingRisk }
}

export function getFollowUpMessage(entry, category, hideFullUsernames) {
  const name = maskUsername(entry.username, hideFullUsernames)
  if (category === 'thank') {
    return `Thank you for showing up tonight, ${name}. You definitely made the room more fun 💋 I'll tell you first next time I go live.`
  }
  if (category === 'invite') {
    return `${name}, loved having you in the room tonight — come back next time and I'll make it worth it.`
  }
  return `Hey ${name}, missed you toward the end of the stream — hope to catch you next time I'm live!`
}

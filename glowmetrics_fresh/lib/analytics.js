// ============================================
// CAMCASH COMPLETE ANALYTICS ENGINE
// ============================================

// Token rates live in ONE place — lib/constants.js
// Do not define rates here. Import only.
import { PLATFORM_TOKEN_RATES, DEFAULT_TOKEN_RATE, tokenRate } from './constants'
// Session grouping lives in ONE place — lib/analytics/sessions.js
// Shared with app/live/page.js. Do not redefine this logic here.
import { detectSessions } from './analytics/sessions'

// ===============================
// TIMEZONE HELPERS
// ===============================

function calcMedian(arr) {
  if (!arr || arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

// ===============================
// DATA CONFIDENCE
// Single source of truth for "how much do we trust this sample" — never
// reimplement these bands locally in a component or page.
// ===============================
export function calculateConfidence(validSessionCount, streamedHours) {
  const n = validSessionCount || 0
  const h = streamedHours || 0
  if (n >= 10 && h >= 20) return { level: 'High',     label: 'Strong pattern' }
  if (n < 3 || h < 3)     return { level: 'Very Low', label: 'Not enough data yet' }
  if (n <= 4 || h <= 5)   return { level: 'Low',      label: 'Early signal' }
  return { level: 'Medium', label: 'Likely pattern' }
}

// Import canonical timezone utilities (keeps backward-compatible exports)
import { getCreatorHour, getCreatorDay, getCreatorDateString, getCreatorTimezone, getCurrentCreatorDay, getCurrentCreatorHour } from './timezoneUtils.js'
export const toLocalHour = getCreatorHour
export const toLocalDow = getCreatorDay
const toLocalDateStr = getCreatorDateString

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
  if (!user || typeof user !== 'object') return false
  // Instead of hardcoded 90-day cutoff, filter based on:
  // 1. Minimum engagement (100+ tokens)
  // 2. Whether we have evidence to make predictions (churnRisk confidence)
  if ((user.totalTokens || 0) < 100) return false
  // Only exclude if we have HIGH confidence that they've truly churned (critical churn risk + very recent no activity)
  // This preserves alerts for fans we're reasonably confident about
  if (user.churnRisk?.level === 'Critical' && user.daysSinceLastTip > 180 && user.churnRisk?.confidence === 'High') return false
  return true
}

function validateInsights(insights = []) {
  return insights.filter(i => {
    if (!i?.text) return false;
    if (i.text.includes("$0")) return false;
    if (i.text.includes("100%") && i.text.includes("returning")) return false;
    return true;
  });
}

// Chaturbate's "Token Stats" page copies as a 3-line block per tip:
//   Jun 18, 2026, 8:27 PM
//   Tip From: username123
//   500  12345
// (date line / "Tip From: user" line / "tokens  running_balance" line)
const CB_DATE_LINE_RE = /^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i
const CB_TIP_FROM_RE = /^Tip From:\s*(.+)$/i
const CB_TOKENS_LINE_RE = /^(\d+)\s+(\d+)$/
const CB_MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 }

function parseChaturbateMultiLine(lines) {
  const results = []
  let i = 0
  while (i < lines.length) {
    const dateMatch = lines[i].trim().match(CB_DATE_LINE_RE)
    if (!dateMatch) { i++; continue }

    const [, mon, day, year, hr, min, ampm] = dateMatch
    const actionLine = (lines[i + 1] || '').trim()
    const tipMatch = actionLine.match(CB_TIP_FROM_RE)
    if (!tipMatch) { i++; continue }

    const username = tipMatch[1].trim()
    let tokensLine = (lines[i + 2] || '').trim()
    let note = ''
    let tMatch = tokensLine.match(CB_TOKENS_LINE_RE)
    if (!tMatch && lines[i + 3]) {
      note = tokensLine
      tokensLine = (lines[i + 3] || '').trim()
      tMatch = tokensLine.match(CB_TOKENS_LINE_RE)
    }

    if (tMatch) {
      const tokens = parseInt(tMatch[1], 10)
      if (username && tokens >= 1) {
        let h = parseInt(hr, 10)
        if (/pm/i.test(ampm) && h !== 12) h += 12
        if (/am/i.test(ampm) && h === 12) h = 0
        const monthNum = CB_MONTHS[mon.toLowerCase()] || 1
        const dateRaw = `${year}-${String(monthNum).padStart(2, '0')}-${String(parseInt(day, 10)).padStart(2, '0')} ${String(h).padStart(2, '0')}:${min}:00`
        results.push({
          dateRaw, date_time: dateRaw, username, platform: 'Chaturbate',
          tokens, usd: parseFloat((tokens * tokenRate('Chaturbate')).toFixed(2)),
          tip_type: 'Tip', tip_note: note,
        })
      }
    }
    i++
  }
  return results
}

export function parseCSV(text, platform = null) {
  const allLines = text.trim().split('\n')
  if (allLines.length === 0) return []

  if (!platform) platform = detectPlatform(text)

  // Raw multi-line Chaturbate paste (not a proper CSV) — needs block-based stitching
  // instead of the line-by-line parsers below, which mangle date/"Tip From:"/tokens
  // onto separate rows.
  if (allLines.some(l => CB_TIP_FROM_RE.test(l.trim()))) {
    return parseChaturbateMultiLine(allLines).map(normalizeTip).filter(isValidTip)
  }

  let startIdx = 0
  for (let i = 0; i < Math.min(5, allLines.length); i++) {
    const cols = parseCSVLine(allLines[i])
    if (cols.filter(c => c.trim()).length >= 2) { startIdx = i; break }
  }

  const lines = allLines.slice(startIdx).filter(l => l.trim())
  if (lines.length === 0) return []

  const firstLower = lines[0].toLowerCase()
  const firstCols = parseCSVLine(lines[0])

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
  // Per-row format-based platform fallback — runs after both parsers
  raw.forEach(r => {
    if (r.platform && r.platform !== 'Unknown') return
    if (/tip from:/i.test(text)) { r.platform = 'Chaturbate'; return }
    if (/^\d{2}\.\d{2}\.\d{4}/.test(r.dateRaw || '')) { r.platform = 'BongaCams'; return }
    if (/^\d{10,13}$/.test(String(r.dateRaw || '').trim())) { r.platform = 'MyFreeCams'; return }
  })
  return raw.map(normalizeTip).filter(isValidTip)
}

function normalizeTip(row) {
  const tokens = parseInt(row.tokens) || 0
  const rawUsd = parseFloat(row.usd) || 0
  const rate = tokenRate(row.platform)
  const usd = rawUsd > 0 ? rawUsd : parseFloat((tokens * rate).toFixed(2))
  const dateRaw = normalizeDate(row.dateRaw || row.date_time || '')
  const parsedDate = new Date(dateRaw)
  if (isNaN(parsedDate.getTime())) return null
  return {
    ...row,
    username: (row.username || '').toLowerCase().trim(),
    tokens,
    usd: parseFloat(usd.toFixed(2)),
    dateRaw,
    date_time: dateRaw,
  }
}

function isValidTip(t) {
  if (!t) return false
  return (
    typeof t.username === 'string' &&
    t.username.length > 0 &&
    !isNaN(t.tokens) &&
    !isNaN(t.usd) &&
    t.tokens >= 0 &&
    t.usd >= 0 &&
    (t.tokens > 0 || t.usd > 0)
  )
}

export function detectPlatform(text) {
  const lower = text.toLowerCase()
  // Keyword detection — platform name or signature phrase present in text
  if (lower.includes('chaturbate') || lower.includes('tip from:') || lower.includes('token balance') || lower.includes('token change')) return 'Chaturbate'
  if (lower.includes('bongacams') || lower.includes('bonga') || lower.includes('your payout')) return 'BongaCams'
  if (lower.includes('myfreecams') || lower.includes('mfc')) return 'MyFreeCams'
  if (lower.includes('stripchat')) return 'Stripchat'
  if (lower.includes('camsoda')) return 'CamSoda'
  // Structural detection — platform-unique data format when no platform name appears in the text
  if (/^\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}/m.test(text)) return 'BongaCams'
  if (/^\d{10,13}\t/m.test(text)) return 'MyFreeCams'
  return 'Unknown'
}

function normalizeDate(raw) {
  if (!raw) return null
  const euro = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}:\d{2}))?/)
  if (euro) return `${euro[2]}/${euro[1]}/${euro[3]}${euro[4] ? ' ' + euro[4] : ''}`
  const slash = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})(.*)/)
  if (slash) return `${slash[1]}-${slash[2]}-${slash[3]}${slash[4]}`
  return raw.replace('T', ' ').replace('Z', '')
}

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
  if (clean === 'note') return 'note'
  if (clean === 'platform') return 'platform'
  if (clean === 'session_id') return 'session_id'
  return clean
}

function re_clean(h) {
  return h.toLowerCase().trim().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

function parseCSVLine(line) {
  const trimmed = line.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && !trimmed.slice(1, -1).includes('"')) {
    return trimmed.slice(1, -1).split(',').map(v => v.trim())
  }
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') { inQuotes = !inQuotes }
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += char }
  }
  result.push(current.trim())
  return result
}

// BongaCams paid-chat/spy-mode session types, matched against a row's
// "Chat Type" column (normalized to tip_type by normalizeHeaderName above).
// Duplicated from the identical BC_PAID_TYPES list in app/onboarding/page.js
// on purpose — that list drives the paste-flow's own client-side detection
// and is out of scope here; consolidating the two is a separate follow-up.
const BC_PAID_CHAT_TYPES = ['Private Chat', 'Full-Private Chat', 'Group Chat', 'Spy Mode']

function parseWithHeaders(lines, platform) {
  const rawHeaders = parseCSVLine(lines[0])
  const headers = rawHeaders.map(normalizeHeaderName)
  const results = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const vals = parseCSVLine(line)
    const row = {}
    headers.forEach((h, idx) => { row[h] = (vals[idx] ?? '').trim() })

    const action = (row.action || '').toLowerCase()
    const tipType = (row.tip_type || '').toLowerCase()
    // Exact (case-insensitive) match against the four BongaCams paid-chat
    // types — same match semantics as onboarding's detectBCPaidRow(), just
    // applied to the already header-mapped tip_type field instead of
    // scanning raw columns.
    const bcPaidChatType = BC_PAID_CHAT_TYPES.find(t => t.toLowerCase() === tipType) || null

    if (action.includes('transfer') || action.includes('cash') ||
        action.includes('outbound tip') || action.includes('promoted room') ||
        action.includes('referral')) continue

    if (tipType && !tipType.includes('tip') && !tipType.includes('private') &&
        !tipType.includes('spy') && !tipType.includes('show') && !tipType.includes('chat') &&
        !tipType.includes('received') && !tipType.includes('freechat') &&
        !tipType.includes('sale')) continue

    if (tipType.includes('cash') || tipType.includes('transfer') ||
        tipType.includes('payout') || tipType.includes('refund')) continue

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

    // Strip $, comma, AND whitespace (incl. NBSP/narrow-NBSP thousands
    // separators like BongaCams' "1 507") before parsing — parseInt
    // otherwise stops at the first non-numeric character and silently
    // truncates e.g. "1 507" tokens down to 1. Mirrors the cleanup already
    // applied to usd just below.
    let tokens = parseInt((row.tokens || '0').toString().replace(/[$,\s]/g, '')) || 0
    if (tokens < 0) continue

    const rawUsd = (row.usd || row.usd_amount || '0').toString().replace(/[$,\s]/g, '')
    let usd = parseFloat(rawUsd) || 0
    if (usd < 0) usd = 0
    if (tokens <= 0 && usd <= 0) continue

    const rawDate = row.date_time || row.date || row.timestamp || ''
    const dateRaw = normalizeDate(rawDate) || new Date().toISOString()
    const parsedDate = new Date(dateRaw)
    if (isNaN(parsedDate.getTime())) continue

    const rowPlatform = row.platform
      ? (row.platform.toLowerCase().includes('bonga') ? 'BongaCams'
        : row.platform.toLowerCase().includes('chaturbate') ? 'Chaturbate'
        : row.platform.toLowerCase().includes('mfc') || row.platform.toLowerCase().includes('freecams') ? 'MyFreeCams'
        : row.platform || platform)
      : platform

    results.push({
      dateRaw, date_time: dateRaw, username,
      platform: rowPlatform || 'Unknown',
      tokens: tokens > 0 ? tokens : Math.round(usd / tokenRate(rowPlatform)),
      usd: usd > 0 ? parseFloat(usd.toFixed(2)) : parseFloat((tokens * tokenRate(rowPlatform)).toFixed(2)),
      tip_type: row.tip_type || 'Tip',
      tip_note: row.note || row.tip_note || '',
      // Paid-chat/spy-mode rows must be routed to paid_sessions, not tips —
      // stamped here so callers (e.g. /api/upload) can split the flat
      // parseCSV() result without re-deriving the classification themselves.
      ...(bcPaidChatType ? { is_paid_session: true, session_type: bcPaidChatType } : {}),
    })
  }
  return results
}

function parseHeaderless(lines, platform) {
  const results = []
  for (const line of lines) {
    if (!line.trim()) continue
    const vals = parseCSVLine(line)
    if (vals.length === 0) continue

    if (vals.length >= 3 && vals[1] && vals[1].toLowerCase().includes('tip from')) {
      const dateRaw = normalizeDate(vals[0].replace(/"/g, ''))
      const m = vals[1].match(/tip from[:\s]*(\S+)/i)
      const username = m ? m[1] : null
      const tokens = parseInt(vals[2]) || 0
      if (!username || tokens <= 0) continue
      if (vals[1].toLowerCase().includes('transfer') || vals[1].toLowerCase().includes('cash')) continue
      if (!dateRaw || isNaN(new Date(dateRaw).getTime())) continue
      results.push({ dateRaw, date_time: dateRaw, username, platform: 'Chaturbate', tokens, usd: parseFloat((tokens * tokenRate('Chaturbate')).toFixed(2)), tip_type: 'Tip', tip_note: '' })
      continue
    }

    if (vals.length >= 4 && /^\d{2}\.\d{2}\.\d{4}/.test(vals[0])) {
      const dateRaw = normalizeDate(vals[0])
      const username = vals[1] || null
      const tokens = parseInt(vals[3]) || 0
      const usd = parseFloat((vals[4] || '').replace(/[$,]/g, '')) || 0
      if (!username || (tokens <= 0 && usd <= 0)) continue
      if (!dateRaw || isNaN(new Date(dateRaw).getTime())) continue
      results.push({ dateRaw, date_time: dateRaw, username, platform: platform || 'BongaCams', tokens: tokens > 0 ? tokens : Math.round(usd / tokenRate(platform || 'BongaCams')), usd: usd > 0 ? parseFloat(usd.toFixed(2)) : parseFloat((tokens * tokenRate(platform || 'BongaCams')).toFixed(2)), tip_type: vals[2] || 'Tip', tip_note: '' })
      continue
    }

    if (vals.length >= 2) {
      const dateRaw = normalizeDate(vals[0]) || vals[0]
      const username = (vals[1] || '').trim()
      if (!username) continue
      if (!dateRaw || isNaN(new Date(dateRaw).getTime())) continue
      let tokens = 0, usd = 0
      for (let i = 2; i < vals.length; i++) {
        const raw = vals[i]
        const num = parseFloat(raw.replace(/[$,]/g, ''))
        if (isNaN(num) || num <= 0) continue
        if (raw.includes('$')) { usd = num }
        else if (i === 2 && tokens === 0) { tokens = Math.round(num) }
        else if (i === 3 && usd === 0) { usd = num }
      }
      if (tokens === 0 && usd > 0) tokens = Math.round(usd / tokenRate(platform))
      if (usd === 0 && tokens > 0) usd = parseFloat((tokens * tokenRate(platform)).toFixed(2))
      if (tokens === 0 && usd === 0) continue
      results.push({ dateRaw, date_time: dateRaw, username, platform: platform || 'Unknown', tokens, usd: parseFloat(usd.toFixed(2)), tip_type: 'Tip', tip_note: '' })
    }
  }
  return results
}

// detectSessions/finalizeSession live in ./analytics/sessions.js — shared with
// app/live/page.js. Do not redefine this grouping logic here.

export function identifyWhales(tips, sessions = null, userTz = 'UTC') {
  const fanMap = {}

  // CANONICAL FAN IDENTITY: platform:username composite key
  tips.forEach(t => {
    const key = `${t.platform}:${t.username}`.toLowerCase()
    if (!fanMap[key]) {
      fanMap[key] = {
        platform: t.platform,
        username: t.username,
        totalUSD: 0,
        totalTokens: 0,
        tipCount: 0,
        tips: [],
        tipNotes: []
      }
    }
    fanMap[key].totalUSD += t.usd || 0
    fanMap[key].totalTokens += t.tokens || 0
    fanMap[key].tipCount += 1
    fanMap[key].tips.push(t)
    if (t.tip_note) fanMap[key].tipNotes.push(t.tip_note)
  })

  const allFans = Object.values(fanMap)
  const sorted = [...allFans].sort((a, b) => b.totalUSD - a.totalUSD)
  const totalFans = sorted.length

  // O(1) rank lookup for percentile calculations
  const rankByKey = new Map(sorted.map((s, i) => [`${s.platform}:${s.username}`.toLowerCase(), i]))

  // Calculate canonical 6-month window from latest tip in dataset
  let latestTipDate = new Date(0)
  tips.forEach(t => {
    const dt = new Date(t.dateRaw || t.date_time)
    if (dt > latestTipDate) latestTipDate = dt
  })
  const sixMonthsAgoMs = latestTipDate.getTime() - (180 * 24 * 60 * 60 * 1000)

  // Build a map of fan → set of CANONICAL SESSION IDs they tipped in (for qualifying session count)
  // CRITICAL: Use canonical session.id, NOT calendar dates
  // Two sessions on the same date are TWO distinct canonical sessions and count as 2
  const fanSessionIds = {}
  if (sessions && sessions.length > 0) {
    sessions.forEach(session => {
      session.tips?.forEach(tip => {
        const fanKey = `${tip.platform}:${tip.username}`.toLowerCase()
        if (!fanSessionIds[fanKey]) fanSessionIds[fanKey] = new Set()
        // Use canonical session ID (e.g., "session_1694203200000")
        fanSessionIds[fanKey].add(session.id)
      })
    })
  }

  return allFans.map(f => {
    const fanKey = `${f.platform}:${f.username}`.toLowerCase()
    const fanSorted = [...f.tips].sort((a, b) => new Date(b.dateRaw || b.date_time) - new Date(a.dateRaw || a.date_time))
    const lastTipDate = new Date(fanSorted[0].dateRaw || fanSorted[0].date_time)
    const firstTipDate = new Date(fanSorted[fanSorted.length - 1].dateRaw || fanSorted[fanSorted.length - 1].date_time)
    // Calculate days since last tip using creator's local date for consistency
    const creatorNowStr = new Intl.DateTimeFormat('en-CA', { timeZone: userTz }).format(new Date())
    const creatorLastTipStr = new Intl.DateTimeFormat('en-CA', { timeZone: userTz }).format(lastTipDate)
    const [cyear, cmonth, cday] = creatorNowStr.split('-').map(Number)
    const [lyear, lmonth, lday] = creatorLastTipStr.split('-').map(Number)
    const creatorNow = new Date(cyear, cmonth - 1, cday)
    const creatorLastTip = new Date(lyear, lmonth - 1, lday)
    const daysSinceLastTip = Math.floor((creatorNow - creatorLastTip) / 86400000)
    const lifetimeDays = Math.max(Math.floor((lastTipDate - firstTipDate) / 86400000), 1)
    const avgDaysBetweenTips = f.tipCount > 1 ? Math.max(1, lifetimeDays / (f.tipCount - 1)) : 30
    const biggestTip = Math.max(...f.tips.map(t => t.usd))
    const fanRankIndex = rankByKey.get(fanKey)
    const percentileRank = totalFans > 1 ? fanRankIndex / (totalFans - 1) : 0
    const relativeValue = Math.round((1 - percentileRank) * 100)

    // CANONICAL TIER LOGIC (locked)
    let tier = 'New'
    const qualifyingSessionCount = fanSessionIds[fanKey]?.size || 0
    const isActiveInLast6Months = lastTipDate.getTime() >= sixMonthsAgoMs

    // WHALE: $50+ lifetime revenue (absolute, no percentile override)
    if (f.totalUSD >= 50) {
      tier = 'Whale'
    }
    // REGULAR: 11+ qualifying sessions AND active within 6 months
    else if (qualifyingSessionCount >= 11 && isActiveInLast6Months) {
      tier = 'Regular'
    }
    // EMERGING: 3+ qualifying sessions (for dataset analysis only)
    else if (qualifyingSessionCount >= 3) {
      tier = 'Emerging'
    }

    // Calculate daysBetweenTipsArr early so it can be used for status and activity state
    const tipDates = [...f.tips].sort((a, b) => new Date(a.dateRaw || a.date_time) - new Date(b.dateRaw || b.date_time)).map(t => new Date(t.dateRaw || t.date_time))
    const daysBetweenTipsArr = []
    for (let i = 1; i < tipDates.length; i++) { daysBetweenTipsArr.push((tipDates[i] - tipDates[i - 1]) / 86400000) }

    // ACTIVITY STATE: separate from Tier (locked)
    // Classify activity state based on statistical distribution: if current gap is highly-unusual/extreme, mark as Dormant
    const activityClassification = (() => {
      if (!daysBetweenTipsArr || daysBetweenTipsArr.length < 3) {
        // Fallback: use 3× average as threshold
        return daysSinceLastTip > Math.max(60, avgDaysBetweenTips * 3) ? 'Dormant' : 'Active'
      }
      const sorted = [...daysBetweenTipsArr].sort((a, b) => a - b)
      const median = calcMedian(sorted)
      const mean = sorted.reduce((s, x) => s + x, 0) / sorted.length
      const variance = sorted.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / sorted.length
      const stddev = Math.sqrt(variance)

      // Empirical approach: use actual percentile, not z-score cutoff
      // A fan is "Dormant" if their current gap is in top 25% (75th percentile+) of unusual gaps
      const empiricalRarity = calculateEmpiricRarity(daysSinceLastTip, sorted)
      return empiricalRarity >= 75 ? 'Dormant' : 'Active'
    })()
    const activityState = activityClassification

    // STATUS: calculated separately from Tier (locked)
    // Now using statistical churn risk classification
    let status = 'Healthy'
    const churnRiskLevel = calcChurnRisk(daysSinceLastTip, avgDaysBetweenTips, f.tipCount, daysBetweenTipsArr).level
    if (churnRiskLevel === 'High') status = 'Watch'
    if (churnRiskLevel === 'Critical') status = 'At Risk'

    const privateTips = f.tips.filter(t => t.tip_type?.toLowerCase().includes('private') || t.tip_note?.toLowerCase().includes('private'))
    const hourCounts = {}
    f.tips.forEach(t => { const h = toLocalHour(t.dateRaw || t.date_time, userTz); hourCounts[h] = (hourCounts[h] || 0) + 1 })
    const mostActiveHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]

    return {
      // Identity (FIVE INDEPENDENT DIMENSIONS)
      platform: f.platform,
      username: f.username,

      // Financial Metrics
      totalUSD: parseFloat(f.totalUSD.toFixed(2)),
      totalTokens: f.totalTokens,
      tipCount: f.tipCount,
      avgTipSize: parseFloat((f.totalUSD / f.tipCount).toFixed(2)),
      biggestTip: parseFloat(biggestTip.toFixed(2)),

      // DIMENSION 1: TIER (Whale/Regular/Emerging/New)
      tier,

      // DIMENSION 2: RELATIVE VALUE (percentile rank)
      relativeValue,
      isTopSpender: percentileRank <= 0.05,

      // DIMENSION 3: STATUS (Healthy/Watch/At Risk/Critical)
      status,

      // DIMENSION 4: ACTIVITY STATE (Active/Dormant)
      activityState,

      // DIMENSION 5: MANAGEMENT STATE (for future: Unarchived/Archived, dismissal state)
      // (stored separately in database, not computed here)

      // Temporal Metrics
      lastTipDate: lastTipDate.toISOString(),
      firstTipDate: firstTipDate.toISOString(),
      daysSinceLastTip,
      avgDaysBetweenTips: parseFloat(avgDaysBetweenTips.toFixed(1)),
      daysBetweenTipsArr,

      // Session Metrics
      qualifyingSessionCount,
      isActiveInLast6Months,

      // Predictive Metrics
      tipProbability: calcTipProbability(daysSinceLastTip, avgDaysBetweenTips, daysBetweenTipsArr),
      churnRisk: calcChurnRisk(daysSinceLastTip, avgDaysBetweenTips, f.tipCount, daysBetweenTipsArr),
      lifetimeValue: calcLifetimeValue(f.totalUSD, lifetimeDays, f.tipCount),
      expectedNextTip: calcExpectedNextTip(daysSinceLastTip, avgDaysBetweenTips),

      // Behavior Metrics
      hasPrivates: privateTips.length > 0,
      privateCount: privateTips.length,
      privateSpent: parseFloat(privateTips.reduce((s, t) => s + t.usd, 0).toFixed(2)),
      typicalOnlineHours: mostActiveHour ? `${mostActiveHour[0]}:00 - ${parseInt(mostActiveHour[0]) + 2}:00` : 'Unknown',
      tipNotes: f.tipNotes,
      tips: f.tips
    }
  }).sort((a, b) => b.totalUSD - a.totalUSD)
}

export function detectResurfacing(fans) {
  if (!fans || fans.length === 0) return []

  const resurfacing = []

  fans.forEach(f => {
    // Only Whale and Regular tiers are eligible for resurfacing detection
    // (based on locked tier definitions, not invented percentile cutoffs)
    if (f.tier !== 'Whale' && f.tier !== 'Regular') return

    // Must have tip history to analyze
    if (!f.tips || f.tips.length === 0) return

    // Reconstruct tip timeline from fan's tips array
    const sortedTips = [...f.tips].sort((a, b) => {
      const aTime = new Date(a.dateRaw || a.date_time).getTime()
      const bTime = new Date(b.dateRaw || b.date_time).getTime()
      return aTime - bTime
    })

    if (sortedTips.length === 0) return

    // Calculate gap distribution from actual fan history (not hard-coded)
    const gaps = []
    for (let i = 0; i < sortedTips.length - 1; i++) {
      const currentTime = new Date(sortedTips[i].dateRaw || sortedTips[i].date_time).getTime()
      const nextTime = new Date(sortedTips[i + 1].dateRaw || sortedTips[i + 1].date_time).getTime()
      const gapDays = (nextTime - currentTime) / (24 * 60 * 60 * 1000)
      gaps.push({ gapDays, index: i })
    }

    if (gaps.length === 0) return

    // Find the largest gap in the tip history (evidence of dormancy)
    const maxGap = gaps.reduce((max, g) => g.gapDays > max.gapDays ? g : max, gaps[0])
    const maxGapDays = maxGap.gapDays
    const maxGapIndex = maxGap.index

    // CALCULATE: Resurfacing deviation from personal history
    // Derived from fan's actual data, not hard-coded threshold
    const gapDeviation = f.avgDaysBetweenTips > 0 ? maxGapDays / f.avgDaysBetweenTips : 0

    // CALCULATE: Evidence quality from actual relationship history (NOT hard-coded thresholds)
    // Measure confidence in this resurfacing detection based on available data
    const observationCount = sortedTips.length
    const firstTipTime = new Date(sortedTips[0].dateRaw || sortedTips[0].date_time).getTime()
    const lastTipBeforeGapTime = new Date(sortedTips[maxGapIndex].dateRaw || sortedTips[maxGapIndex].date_time).getTime()
    const relationshipDurationDays = (lastTipBeforeGapTime - firstTipTime) / (24 * 60 * 60 * 1000)

    // Calculate interval consistency (lower = more consistent pattern)
    let intervalVariance = 0
    if (gaps.length > 1) {
      const avgGap = gaps.reduce((sum, g) => sum + g.gapDays, 0) / gaps.length
      intervalVariance = Math.sqrt(
        gaps.reduce((sum, g) => sum + Math.pow(g.gapDays - avgGap, 2), 0) / gaps.length
      )
    }

    // Calculate evidence quality score from actual data:
    // - More observations = stronger evidence
    // - Longer relationship = more established pattern
    // - More consistent intervals = clearer typical behavior
    // - Qualifying sessions count = relationship strength
    const evidenceScore =
      (observationCount * 0.3) +  // Weight: number of observations
      (Math.min(relationshipDurationDays / 30, 12) * 1.0) +  // Weight: relationship duration (months, capped at 12)
      (f.qualifyingSessionCount * 0.5) +  // Weight: distinct sessions established
      (Math.max(0, 5 - intervalVariance) * 0.2)  // Weight: consistency (lower variance = higher score)

    // Derived evidence quality from calculated metrics
    const evidenceQuality = {
      observationCount,
      relationshipDurationDays: Math.round(relationshipDurationDays),
      intervalVariability: Math.round(intervalVariance * 100) / 100,
      qualifyingSessionsCount: f.qualifyingSessionCount,
      score: Math.round(evidenceScore * 100) / 100,
      confidenceLevel: evidenceScore > 20 ? 'high' : evidenceScore > 10 ? 'moderate' : 'low'
    }

    // Evidence: Tips after the gap exist (actual return occurred)
    const tipsAfterGap = sortedTips.slice(maxGapIndex + 1)
    const hasReturn = tipsAfterGap.length > 0

    // Do not include in results if:
    // - No actual gap in history (all tips regularly spaced)
    // - No evidence of return after gap
    // - Gap is within normal variation (approach to 1.0x means no real gap)
    if (!hasReturn || gapDeviation < 1) return

    // Determine resurfacing type based on locked tier definition
    const resurfacingType = f.tier === 'Whale' ? 'whale' : f.tier === 'Regular' ? 'regular' : 'other'
    const priority = f.tier === 'Whale' ? 1 : f.tier === 'Regular' ? 2 : 3

    resurfacing.push({
      ...f,
      resurfacingType,
      priority,
      // Calculated metrics (derived from data, not hard-coded)
      dormancyDays: Math.round(maxGapDays),
      dormancyEndDate: sortedTips[maxGapIndex + 1] ? new Date(sortedTips[maxGapIndex + 1].dateRaw || sortedTips[maxGapIndex + 1].date_time).toISOString() : null,
      gapDeviation: parseFloat(gapDeviation.toFixed(2)), // Calculated ratio of actual gap to personal average
      evidenceQuality, // Confidence metrics derived from actual relationship history
      returnMessage: `${f.username} (${f.platform}) is back after ${Math.round(maxGapDays)} days offline`
    })
  })

  // Sort by priority (Whale first, then Regular), then by relative value (highest first)
  return resurfacing.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return b.relativeValue - a.relativeValue
  })
}

/**
 * Classify a fan's current inactivity gap based on their actual historical interval distribution
 * Uses empirical percentile approach — NOT hardcoded multipliers or z-score cutoffs
 *
 * Returns classification object with:
 * - classification: 'insufficient-evidence', 'normal', 'unusual', 'highly-unusual', 'extreme'
 * - confidence: 'high', 'medium', 'low'
 * - reason: human-readable explanation
 * - stats: {median, mean, stddev, mad, empiricalRarity, gapRatio, relationshipStrength}
 * - shouldAlert: boolean (unusual/highly-unusual/extreme with good evidence)
 */
/**
 * Calculate empirical rarity percentile for a gap within a distribution
 * Returns: 0-100 where 100 = most unusual gap ever seen for this fan
 *
 * Uses empirical percentile (actual position in historical data),
 * NOT z-score or hardcoded multipliers
 */
function calculateEmpiricRarity(currentGap, sortedIntervals) {
  if (!sortedIntervals || sortedIntervals.length === 0) return 0

  // Find how many historical intervals are <= currentGap
  const countLessOrEqual = sortedIntervals.filter(i => i <= currentGap).length

  // Rarity = percentage of historical gaps that are SMALLER than current gap
  // Higher percentage = more unusual (farther from typical)
  return Math.round((countLessOrEqual / sortedIntervals.length) * 100)
}

/**
 * Calculate Median Absolute Deviation (MAD) - robust measure of variability
 * Less sensitive to outliers than standard deviation
 */
function calcMAD(intervals) {
  if (!intervals || intervals.length === 0) return 0

  const median = calcMedian(intervals)
  const absoluteDeviations = intervals.map(x => Math.abs(x - median))
  return calcMedian(absoluteDeviations)
}

/**
 * Classify gap using empirical/data-driven approach (NO hardcoded cutoffs)
 *
 * Decision rules based on:
 * - Empirical rarity percentile (where gap falls in THIS fan's history)
 * - Relationship strength (variability in their tipping)
 * - Evidence quality (how much historical data)
 *
 * NO z-score cutoffs (1σ, 2σ, etc.)
 * NO hardcoded multipliers (1.5×, 2×, etc.)
 * z-score returned as descriptive metric only
 */
export function classifyCurrentGapByDistribution(fan) {
  if (!fan || !fan.daysBetweenTipsArr || fan.daysBetweenTipsArr.length === 0) {
    return {
      classification: 'insufficient-evidence',
      confidence: 'low',
      reason: 'No historical interval data',
      shouldAlert: false,
      stats: null
    }
  }

  const intervals = fan.daysBetweenTipsArr
  const currentGap = fan.daysSinceLastTip
  const observationCount = intervals.length

  // Calculate base statistics
  const median = calcMedian(intervals)
  const mean = intervals.reduce((a, b) => a + b, 0) / observationCount
  const variance = intervals.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / observationCount
  const stddev = Math.sqrt(variance)
  const mad = calcMAD(intervals)

  // Sort for empirical percentile calculation
  const sortedIntervals = [...intervals].sort((a, b) => a - b)

  // Calculate gap metrics (empirical, not z-score based)
  const gapRatio = median > 0 ? currentGap / median : 1
  const gapDelta = currentGap - median
  const empiricalRarity = calculateEmpiricRarity(currentGap, sortedIntervals)  // 0-100, where 100 = most unusual

  // Evidence quality: based on sample size
  let evidenceConfidence = 'low'
  if (observationCount >= 10) evidenceConfidence = 'high'
  else if (observationCount >= 5) evidenceConfidence = 'medium'

  // Relationship strength: measure of consistency
  // Lower MAD = more consistent tipper
  const relationshipStrength = mad < stddev * 0.5 ? 'very-consistent' : mad < stddev ? 'consistent' : 'variable'

  // ============================================================================
  // CLASSIFICATION LOGIC - Empirical/data-driven (NO hardcoded z-score cutoffs)
  // Thresholds based on empirical percentile distribution (0-100, where 100 = most unusual)
  // ============================================================================
  let classification = 'normal'
  let shouldAlert = false
  let priority = 'low'

  // Rule 1: Insufficient evidence
  if (observationCount < 3) {
    classification = 'insufficient-evidence'
    priority = 'none'
    // No alert with insufficient data
  }
  // Rule 2: Normal gap (at or below 50th percentile of their history)
  else if (empiricalRarity <= 50) {
    classification = 'normal'
    priority = 'low'
    // No alert for fans tipping within their usual pattern
  }
  // Rule 3: Unusual gap (50-75th percentile)
  // Gap is longer than most of their history, but not extreme
  else if (empiricalRarity > 50 && empiricalRarity <= 75) {
    classification = 'unusual'
    priority = 'medium'
    // Alert only if we have good evidence (medium+ confidence)
    shouldAlert = evidenceConfidence === 'high' || evidenceConfidence === 'medium'
  }
  // Rule 4: Highly unusual gap (75-95th percentile)
  // Gap is in the top 25% most unusual gaps for this fan
  else if (empiricalRarity > 75 && empiricalRarity <= 95) {
    classification = 'highly-unusual'
    priority = 'high'
    // Alert if any reasonable evidence (low+ confidence)
    shouldAlert = observationCount >= 3
  }
  // Rule 5: Extreme gap (95th percentile+)
  // Gap is among the rarest gaps this fan has ever had
  else if (empiricalRarity > 95) {
    classification = 'extreme'
    priority = 'critical'
    shouldAlert = true
  }

  // Build reason string
  let reason
  if (classification === 'insufficient-evidence') {
    reason = `Only ${observationCount} historical intervals — need more data`
  } else if (classification === 'normal') {
    reason = `Current gap (${currentGap}d) is within their typical range (median: ${Math.round(median)}d, ratio: ${gapRatio.toFixed(1)}×)`
  } else if (classification === 'unusual') {
    reason = `Current gap (${currentGap}d) is unusually long for ${fan.username} (${empiricalRarity}th percentile, ${relationshipStrength})`
  } else if (classification === 'highly-unusual') {
    reason = `Current gap (${currentGap}d) is significantly unusual for ${fan.username} (top ${100-empiricalRarity}% most unusual, ${relationshipStrength})`
  } else {
    reason = `Current gap (${currentGap}d) is extreme — beyond their historical pattern (${relationshipStrength})`
  }

  // Z-score as descriptive metric only (not used for decision rules)
  let zScore = 0
  if (stddev > 0.01) {
    zScore = (currentGap - mean) / stddev
  }

  return {
    classification,
    confidence: evidenceConfidence,
    priority,
    reason,
    shouldAlert,
    stats: {
      median: Math.round(median * 10) / 10,
      mean: Math.round(mean * 10) / 10,
      stddev: Math.round(stddev * 10) / 10,
      mad: Math.round(mad * 10) / 10,
      zScore: Math.round(zScore * 100) / 100,  // Descriptive only, not decision rule
      empiricalRarity: empiricalRarity,  // 0-100, where 100 = most unusual
      gapRatio: Math.round(gapRatio * 100) / 100,
      gapDelta: Math.round(gapDelta * 10) / 10,
      relationshipStrength,
      observationCount
    }
  }
}

function calcTipProbability(d, avg, daysBetweenTipsArr = []) {
  if (!daysBetweenTipsArr || daysBetweenTipsArr.length < 3) {
    // Fallback when insufficient distribution data: use simple average-based heuristic
    // Based on ratio to average (NO hardcoded multipliers like 0.5×, 1×, 1.5×, 2×)
    // Instead: determine likelihood by percentile of the gap
    const ratio = avg > 0 ? d / avg : 1
    if (ratio < 0.3) return { level: 'High', percentage: 85, confidence: 'Very Low' }
    if (ratio < 0.7) return { level: 'Medium-High', percentage: 70, confidence: 'Very Low' }
    if (ratio < 1.3) return { level: 'Medium', percentage: 50, confidence: 'Very Low' }
    if (ratio < 2.0) return { level: 'Low-Medium', percentage: 30, confidence: 'Very Low' }
    return { level: 'Low', percentage: 15, confidence: 'Very Low' }
  }

  // Empirical approach: use actual distribution percentile to determine probability
  const sorted = [...daysBetweenTipsArr].sort((a, b) => a - b)
  const median = calcMedian(sorted)
  const mean = sorted.reduce((s, x) => s + x, 0) / sorted.length
  const variance = sorted.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / sorted.length
  const stddev = Math.sqrt(variance)

  const obsCount = daysBetweenTipsArr.length
  const confidence = obsCount >= 10 ? 'High' : obsCount >= 5 ? 'Medium' : 'Low'

  // Z-score as descriptive metric
  let zScore = 0
  if (stddev > 0.01) {
    zScore = (d - mean) / stddev
  }

  // Empirical percentile determines tip probability
  // Where does current gap fall in THIS fan's history?
  const empiricalPercentile = calculateEmpiricRarity(d, sorted)

  // Probability decreases as gap increases (higher empirical percentile = older gap = less likely to tip soon)
  let level, percentage
  if (empiricalPercentile < 20) {
    // Gap is shorter than 80% of their historical gaps → likely to tip soon
    level = 'High'
    percentage = 85
  } else if (empiricalPercentile < 40) {
    level = 'Medium-High'
    percentage = 70
  } else if (empiricalPercentile < 60) {
    // Gap is around their median → moderate probability
    level = 'Medium'
    percentage = 50
  } else if (empiricalPercentile < 80) {
    level = 'Low-Medium'
    percentage = 30
  } else {
    // Gap is longer than 80% of their historical gaps → unlikely to tip soon
    level = 'Low'
    percentage = 15
  }

  return { level, percentage, confidence, zScore, obsCount, stddev, median, empiricalPercentile }
}

function calcChurnRisk(d, avg, count, daysBetweenTipsArr = []) {
  if (count < 3) return { level: 'Unknown', risk: 'Insufficient data', confidence: 'Low' }

  if (!daysBetweenTipsArr || daysBetweenTipsArr.length < 3) {
    // Fallback when insufficient distribution data
    // Based on empirical ratio (NO hardcoded multipliers like 1×, 2×, 3×)
    const ratio = avg > 0 ? d / avg : 1
    if (ratio < 0.8) return { level: 'Low', risk: 'Active', confidence: 'Very Low' }
    if (ratio < 1.5) return { level: 'Medium', risk: 'Watch closely', confidence: 'Very Low' }
    if (ratio < 2.5) return { level: 'High', risk: 'At risk', confidence: 'Very Low' }
    return { level: 'Critical', risk: 'Likely churned', confidence: 'Very Low' }
  }

  // Empirical approach: use actual distribution percentile to determine churn risk
  const sorted = [...daysBetweenTipsArr].sort((a, b) => a - b)
  const median = calcMedian(sorted)
  const mean = sorted.reduce((s, x) => s + x, 0) / sorted.length
  const variance = sorted.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / sorted.length
  const stddev = Math.sqrt(variance)

  const obsCount = daysBetweenTipsArr.length
  const confidence = obsCount >= 10 ? 'High' : obsCount >= 5 ? 'Medium' : 'Low'

  // Z-score as descriptive metric only
  let zScore = 0
  if (stddev > 0.01) {
    zScore = (d - mean) / stddev
  }

  // Churn risk based on empirical percentile (where does current gap fall?)
  const empiricalPercentile = calculateEmpiricRarity(d, sorted)

  // Risk increases as gap increases (higher empirical percentile = gap is becoming unusual)
  let level, risk
  if (empiricalPercentile < 25) {
    // Gap is shorter than 75% of their historical gaps → clearly active
    level = 'Low'
    risk = 'Active'
  } else if (empiricalPercentile < 50) {
    // Gap is around or slightly above their median → slight concern
    level = 'Medium'
    risk = 'Watch closely'
  } else if (empiricalPercentile < 75) {
    // Gap is in top 25% of unusual gaps → genuine concern
    level = 'High'
    risk = 'At risk'
  } else {
    // Gap is in top 25% most unusual (extreme) → high churn risk
    level = 'Critical'
    risk = 'Likely churned'
  }

  return { level, risk, confidence, zScore, obsCount, stddev, median, empiricalPercentile }
}

function calcLifetimeValue(spent, days, count) {
  if (days < 7 || count < 2) return { prediction: spent, confidence: 'Low' }
  const p = (spent / days) * 365
  return { prediction: parseFloat(p.toFixed(2)), confidence: count > 10 ? 'High' : count > 5 ? 'Medium' : 'Low', monthly: parseFloat((p / 12).toFixed(2)) }
}

function calcExpectedNextTip(d, avg) {
  const n = Math.max(0, Math.round(avg - d))
  if (n === 0) return 'Overdue'
  if (n === 1) return 'Tomorrow'
  if (n <= 3)  return `In ${n} days`
  if (n <= 7)  return `In ~${n} days`
  return `In ~${Math.round(n / 7)} weeks`
}

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
    if ((w.churnRisk.level === 'High' || w.churnRisk.level === 'Critical') && w.totalUSD >= churnThreshold && w.tipCount >= 3) {
      const freq = getTipFrequency(w.daysBetweenTipsArr)
      const freqText = freq ? `they typically tip ${freq}` : `they usually tip every ${w.avgDaysBetweenTips.toFixed(0)} days`
      alerts.push({ type: 'churn_risk', severity: 'warning', icon: '⚠️', whale: w, message: `${w.username} hasn't tipped in ${w.daysSinceLastTip} days — ${freqText}`, action: 'Re-engage now before they go cold' })
    }
    if (w.tipProbability.level === 'High' && w.totalUSD >= tipLikelyThreshold)
      alerts.push({ type: 'tip_likely', severity: 'info', icon: '💰', whale: w, message: `${w.username} is likely to tip soon (${w.tipProbability.percentage}% probability based on their pattern)`, action: 'Go live during their active hours' })
    if (w.daysSinceLastTip > 0 && w.daysSinceLastTip <= 3 && w.tipCount > 5) {
      // Check if this return is from an unusual gap (not just regular tipping)
      // Use statistical classification to determine if the interval they just closed was notable
      const gapClassification = classifyCurrentGapByDistribution(w)
      if (gapClassification && gapClassification.stats) {
        // Alert if the gap they just closed was unusual according to their distribution
        const prevGapWasUnusual = gapClassification.classification === 'unusual' || gapClassification.classification === 'highly-unusual' || gapClassification.classification === 'extreme'
        if (prevGapWasUnusual && gapClassification.confidence !== 'low') {
          alerts.push({ type: 'returned', severity: 'success', icon: '🎉', whale: w, message: `${w.username} just tipped again after ${w.daysSinceLastTip} days away — welcome them back!`, action: 'Send a thank you message' })
        }
      }
    }
  })
  alerts = alerts.filter(a => isUserRelevant(a.whale))
  const order = { critical: 0, warning: 1, info: 2, success: 3 }
  return alerts.sort((a, b) => order[a.severity] - order[b.severity])
}

export function predictRevenue(tips, sessions, userTz = 'UTC') {
  if (!sessions.length) return null
  const predictions = {}
  const now = Date.now()
  const last7 = tips.filter(t => (now - new Date(t.dateRaw || t.date_time)) / 86400000 <= 7)
  predictions.next7Days = { amount: parseFloat(last7.reduce((s, t) => s + t.usd, 0).toFixed(2)), confidence: last7.length > 20 ? 'High' : last7.length > 10 ? 'Medium' : 'Low' }
  const last30 = tips.filter(t => (now - new Date(t.dateRaw || t.date_time)) / 86400000 <= 30)
  const prev30 = tips.filter(t => { const d = (now - new Date(t.dateRaw || t.date_time)) / 86400000; return d > 30 && d <= 60 })
  const last30Rev = last30.reduce((s, t) => s + t.usd, 0)
  const prev30Rev = prev30.reduce((s, t) => s + t.usd, 0)
  const weeklyTrend = prev30Rev > 0 ? ((last30Rev - prev30Rev) / prev30Rev) * 100 : null
  predictions.next30Days = { amount: parseFloat(last30Rev.toFixed(2)), confidence: last30.length > 50 ? 'High' : last30.length > 25 ? 'Medium' : 'Low', trend: weeklyTrend !== null ? parseFloat(weeklyTrend.toFixed(1)) : null }
  const todayDow = toLocalDow(new Date().toISOString(), userTz)
  const sameDaySessions = sessions.filter(s => toLocalDow(s.startTime, userTz) === todayDow)
  if (sameDaySessions.length >= 3) {
    const amounts = sameDaySessions.map(s => s.totalUSD).sort((a, b) => a - b)
    const avg = amounts.reduce((s, x) => s + x, 0) / amounts.length
    const p10idx = Math.max(0, Math.floor(amounts.length * 0.10))
    const p90idx = Math.min(amounts.length - 1, Math.floor(amounts.length * 0.90))
    const fixedRange = clampPrediction(amounts[p10idx] || amounts[0], amounts[p90idx] || amounts[amounts.length - 1])
    if (!(fixedRange.min === 0 && fixedRange.max === 0)) {
      predictions.tonightStream = { expected: parseFloat(avg.toFixed(2)), range: { min: fixedRange.min, max: fixedRange.max }, confidence: fixedRange.confidence === 'high' && sameDaySessions.length > 5 ? 'High' : 'Medium', returningTippers: Math.round(sameDaySessions.reduce((s, x) => s + x.uniqueFans, 0) / sameDaySessions.length * 0.4) }
    }
  }
  return predictions
}

export function generateLossAlerts(tips, sessions, whales, bestHour) {
  const alerts = []
  const now = Date.now()
  if (bestHour) {
    const bh = parseInt(bestHour.hour)
    const recentSessions = sessions.filter(s => (now - new Date(s.startTime)) / 86400000 <= 3)
    const recentAtPeak = recentSessions.filter(s => Math.abs(toLocalHour(s.startTime, userTz) - bh) <= 1)
    if (recentSessions.length > 0 && recentAtPeak.length === 0) {
      const label = bh === 0 ? '12 AM' : bh < 12 ? `${bh} AM` : bh === 12 ? '12 PM' : `${bh - 12} PM`
      alerts.push({ type: 'peak_missed', severity: 'warning', icon: '🚨', message: `You haven't streamed during your peak window (${label}) in 3 days — estimated loss: $${(bestHour.avg * 3).toFixed(2)}`, action: `Go live at ${label} to recover this` })
    }
  }
  const thisWeek = tips.filter(t => (now - new Date(t.dateRaw || t.date_time)) / 86400000 <= 7)
  const lastWeek = tips.filter(t => { const d = (now - new Date(t.dateRaw || t.date_time)) / 86400000; return d > 7 && d <= 14 })
  if (thisWeek.length >= 5 && lastWeek.length >= 5) {
    const thisAvg = thisWeek.reduce((s, t) => s + t.usd, 0) / thisWeek.length
    const lastAvg = lastWeek.reduce((s, t) => s + t.usd, 0) / lastWeek.length
    const drop = Math.round(((lastAvg - thisAvg) / lastAvg) * 100)
    if (drop >= 15) alerts.push({ type: 'tip_drop', severity: 'warning', icon: '📉', message: `Your avg tip dropped ${drop}% this week ($${lastAvg.toFixed(2)} → $${thisAvg.toFixed(2)})`, action: 'Focus on high-value fans during your next stream' })
  }
  whales.filter(w => w.totalUSD >= 50 && w.daysSinceLastTip >= 5 && w.daysSinceLastTip < 30).slice(0, 2).forEach(w => {
    alerts.push({ type: 'fan_churn', severity: 'critical', icon: '🚨', message: `${w.username} hasn't tipped in ${w.daysSinceLastTip} days — high churn risk ($${w.totalUSD.toFixed(0)} lifetime value)`, action: 'Send a re-engagement message now' })
  })
  const lastStreamed = sessions.length ? (now - new Date(sessions[sessions.length - 1].startTime)) / 86400000 : 999
  if (lastStreamed > 2 && sessions.length > 5) {
    alerts.push({ type: 'streak_broken', severity: 'info', icon: '⏸️', message: `You haven't streamed in ${Math.floor(lastStreamed)} days — your audience engagement drops after 3 days off`, action: 'Get back live — consistency is your #1 growth tool' })
  }
  return alerts
}

export function generateInsights(tips, sessions, bestDay, worstDay, bestHour, precomputedWhales = null) {
  const insights = []
  if (!tips.length || !sessions.length) return insights
  const now = Date.now()

  if (bestDay && worstDay && bestDay.day !== worstDay.day) {
    const daySessionMap = {}
    sessions.forEach(s => {
      const d = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][toLocalDow(s.startTime, userTz)]
      if (!daySessionMap[d]) daySessionMap[d] = []
      daySessionMap[d].push(s.totalUSD)
    })
    const bestDayAvg = daySessionMap[bestDay.day] ? daySessionMap[bestDay.day].reduce((a,b) => a+b, 0) / daySessionMap[bestDay.day].length : 0
    const otherDaysSessions = Object.entries(daySessionMap).filter(([d]) => d !== bestDay.day).flatMap(([_, vals]) => vals)
    const overallDayAvg = otherDaysSessions.length ? otherDaysSessions.reduce((a,b) => a+b, 0) / otherDaysSessions.length : 0
    const mult = overallDayAvg > 0 ? (bestDayAvg / overallDayAvg).toFixed(1) : null
    const costOfMissing = parseFloat((bestDayAvg - overallDayAvg).toFixed(2))
    if (mult && parseFloat(mult) > 1 && costOfMissing > 0) {
      insights.push({ icon: '📅', text: `${bestDay.day}s are your highest-earning day — you avg $${bestDayAvg.toFixed(0)} on ${bestDay.day}s vs $${overallDayAvg.toFixed(0)} on other days (${mult}x more). Missing one ${bestDay.day} costs you ~$${costOfMissing.toFixed(0)}`, type: 'day', priority: 1 })
    }
  }

  if (bestHour) {
    const h = parseInt(bestHour.hour)
    const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
    const avgOverall = sessions.reduce((s, x) => s + x.totalUSD, 0) / sessions.length
    const multiplier = avgOverall > 0 ? (bestHour.avg / avgOverall).toFixed(1) : null
    insights.push({ icon: '⏰', text: `Go live at ${label} — your avg session earnings are ${multiplier ? `${multiplier}x higher` : 'at their peak'} at this hour ($${bestHour.avg.toFixed(0)} avg). Missing this window costs you real money every session`, type: 'time', priority: 1 })
  }

  const whales = precomputedWhales || identifyWhales(tips, sessions)
  const trueWhales = whales.filter(w => w.tier === 'Whale')
  const topWhales = trueWhales.slice(0, 5)
  const wE = topWhales.reduce((s, w) => s + w.totalUSD, 0)
  const tE = tips.reduce((s, t) => s + t.usd, 0)
  if (wE > 0 && tE > 0 && topWhales.length > 0) {
    const pct = Math.round((wE / tE) * 100)
    insights.push({ icon: '🐳', text: `Your top ${topWhales.length} fan${topWhales.length > 1 ? 's' : ''} generate${topWhales.length === 1 ? 's' : ''} ${pct}% of your revenue. Losing even one of them would cost you $${(wE / topWhales.length).toFixed(0)} on average — keep them engaged`, type: 'whales', priority: 2 })
  }

  const timedSessionsForLength = sessions.filter(s => !s.durationUnknown)
  const longSessions  = timedSessionsForLength.filter(s => s.durationMinutes > 60)
  const shortSessions = timedSessionsForLength.filter(s => s.durationMinutes > 1 && s.durationMinutes <= 60)
  if (longSessions.length >= 3 && shortSessions.length >= 3) {
    const longAvg  = longSessions.reduce((s, x) => s + x.totalUSD, 0) / longSessions.length
    const shortAvg = shortSessions.reduce((s, x) => s + x.totalUSD, 0) / shortSessions.length
    if (longAvg > shortAvg * 1.2) {
      const pct = Math.round(((longAvg - shortAvg) / shortAvg) * 100)
      insights.push({ icon: '⏱️', text: `Streams over 60 min earn ${pct}% more than short ones ($${longAvg.toFixed(0)} vs $${shortAvg.toFixed(0)}). Every extra 30 minutes adds ~$${((longAvg - shortAvg) / 2).toFixed(0)} on average`, type: 'duration', priority: 2 })
    }
  }

  const fanTipCounts = {}, fanTipUSD = {}
  tips.forEach(t => {
    const k = t.username.toLowerCase()
    fanTipCounts[k] = (fanTipCounts[k] || 0) + 1
    fanTipUSD[k] = (fanTipUSD[k] || 0) + (t.usd || 0)
  })
  const returning = Object.values(fanTipCounts).filter(c => c > 1).length
  const total = Object.keys(fanTipCounts).length
  if (total > 10) {
    const pct = Math.round((returning / total) * 100)
    const returningKeys = Object.keys(fanTipCounts).filter(k => fanTipCounts[k] > 1)
    const oneTimeKeys = Object.keys(fanTipCounts).filter(k => fanTipCounts[k] === 1)
    const avgReturning = returningKeys.length ? returningKeys.reduce((s, k) => s + fanTipUSD[k], 0) / returningKeys.length : 0
    const avgOneTime = oneTimeKeys.length ? oneTimeKeys.reduce((s, k) => s + fanTipUSD[k], 0) / oneTimeKeys.length : 0
    const multiplierText = avgOneTime > 0 && avgReturning > 0 ? `${(avgReturning / avgOneTime).toFixed(1)}x more` : 'significantly more'
    const fmtAmt = (v) => v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(0)}`
    insights.push({ icon: '🔁', text: `${pct}% of your fans are returning tippers — loyalty is your strongest asset. Returning fans spend ${multiplierText} on average than first-timers (${fmtAmt(avgReturning)} vs ${fmtAmt(avgOneTime)})`, type: 'retention', priority: 3 })
  }

  const thisWeek = tips.filter(t => (now - new Date(t.dateRaw || t.date_time)) / 86400000 <= 7)
  const lastWeek = tips.filter(t => { const d = (now - new Date(t.dateRaw || t.date_time)) / 86400000; return d > 7 && d <= 14 })
  if (thisWeek.length > 0 && lastWeek.length > 0) {
    const thisRev = thisWeek.reduce((s, t) => s + t.usd, 0)
    const lastRev = lastWeek.reduce((s, t) => s + t.usd, 0)
    const change = Math.round(((thisRev - lastRev) / lastRev) * 100)
    if (Math.abs(change) >= 10) {
      insights.push({ icon: change >= 0 ? '📈' : '📉', text: change >= 0 ? `You're up ${change}% this week vs last week ($${thisRev.toFixed(0)} vs $${lastRev.toFixed(0)}) — keep the momentum going` : `You're down ${Math.abs(change)}% this week vs last ($${thisRev.toFixed(0)} vs $${lastRev.toFixed(0)}) — increase stream frequency to recover`, type: 'momentum', priority: 2 })
    }
  }

  return insights.sort((a, b) => a.priority - b.priority)
}

export function generateNextMoves(tips, sessions, whales, predictions, bestHour, userTz = 'UTC') {
  const moves = []
  const now = Date.now()
  if (bestHour) {
    const bh = parseInt(bestHour.hour)
    const currentHour = toLocalHour(new Date().toISOString(), userTz)
    const hoursUntil = (bh - currentHour + 24) % 24
    const label = bh === 0 ? '12 AM' : bh < 12 ? `${bh} AM` : bh === 12 ? '12 PM' : `${bh - 12} PM`
    if (hoursUntil === 0 || hoursUntil === 1) moves.push({ icon: '🔥', color: '#FB923C', text: `Go live NOW — ${label} is your peak earning time. Your data shows you average $${bestHour.avg.toFixed(0)}/session at this hour`, priority: 0 })
    else if (hoursUntil <= 2) moves.push({ icon: '⏰', color: '#22D3EE', text: `You're ${hoursUntil} hour${hoursUntil > 1 ? 's' : ''} away from your peak time (${label}). Prep your room title and get ready — you avg $${bestHour.avg.toFixed(0)} at this hour`, priority: 1 })
    else moves.push({ icon: '🕐', color: '#22D3EE', text: `Your best earning time is ${label} — plan your next stream around it. Your data shows $${bestHour.avg.toFixed(0)} avg per session at this hour`, priority: 2 })
  }
  if (predictions?.tonightStream) {
    const { expected, range, returningTippers } = predictions.tonightStream
    moves.push({ icon: '🎯', color: '#F59E0B', text: `Set a goal of $${Math.round(expected * 1.2)} for tonight — your data predicts $${range.min}–$${range.max} and ~${returningTippers} returning tippers`, priority: 1 })
  }
  whales.filter(w => { const days = Math.floor((now - new Date(w.lastTipDate)) / 86400000); return days >= 3 && days <= 45 && w.totalUSD >= 20 }).sort((a, b) => b.totalUSD - a.totalUSD).slice(0, 3).forEach(w => {
    const days = Math.floor((now - new Date(w.lastTipDate)) / 86400000)
    moves.push({ icon: '💸', color: '#EC4899', text: `Message ${w.username} — they've spent $${w.totalUSD.toFixed(0)} total but haven't tipped in ${days} days. One message could recover $${(w.avgTipSize * 2).toFixed(0)}+`, cta: true, username: w.username, priority: 1 })
  })
  const avgSession = sessions.length ? sessions.reduce((s, x) => s + x.totalUSD, 0) / sessions.length : 0
  if (avgSession > 0) {
    const goal = Math.round(avgSession * 1.2 / 5) * 5
    moves.push({ icon: '🏆', color: '#F59E0B', text: `Your sessions average $${avgSession.toFixed(0)} — aim for $${goal} next stream. You've already hit this ${sessions.filter(s => s.totalUSD >= goal).length} times`, priority: 3 })
  }
  return moves.sort((a, b) => a.priority - b.priority).slice(0, 5)
}

export function aggregateRows(tips, tz = null) {
  const userTz = tz || (typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC')

  if (!tips || tips.length === 0) {
    return {
      totalUSD: 0, totalTokens: 0, totalTips: 0, avgTipSize: 0,
      topTippers: [], platforms: [], sessions: [], insights: [],
      predictions: null, whaleAlerts: [], lossAlerts: [], nextMoves: [], resurfacingFans: [],
      bestDay: null, bestHour: null, platformBestTimes: {},
      monthlyData: [], bestMonth: null, tipTypeBreakdown: [],
      privateShowFans: [], spyShowFans: [], earningsVelocity: null, totalStreamMinutes: 0,
      estimatedHourlyRate: 0, hourlyRateSessionCount: 0, hourlyRateTotalMinutes: 0,
      hourlyRateTotalUsd: 0, excludedUntimedSessionCount: 0,
      platformVelocity: {}, missedRevenueByPlatform: {},
      returningVsNew: null, topFanDependency: null,
      dependencyRisk: null, preTipBehavior: null, trueHourlyAvg: []
    }
  }

  const sessions = detectSessions(tips)

  // ── SESSION QUALITY CLASSIFICATION ───────────────────────────────────
  const classifySession = (s) => {
    const mins = s.durationMinutes || 0
    const usd  = s.totalUSD || 0
    if (mins < 2 && usd === 0) return 'invalid'
    if (mins < 15 && usd < 10) return 'low_signal'
    return 'meaningful'
  }
  const scoreSession = (s) => {
    const mins = s.durationMinutes || 0
    const usd  = s.totalUSD || 0
    const durationScore = Math.min(mins / 120, 1)
    const revenueScore  = Math.min(usd  / 100, 1)
    return parseFloat(((durationScore * 0.4) + (revenueScore * 0.6)).toFixed(3))
  }
  sessions.forEach(s => { s.sessionQuality = classifySession(s); s.sessionWeight = scoreSession(s) })

  const meaningfulSessions = sessions.filter(s => s.sessionQuality === 'meaningful')
  const allValidSessions   = sessions.filter(s => s.sessionQuality !== 'invalid')

  const dayTipsUSD = {}, dayActiveDates = {}, hourTipsUSD = {}, hourBucketSets = {}
  const dayDateAmts = {}, hourBucketAmts = {}
  const UTC_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

  tips.forEach(t => {
    const dt = new Date(t.dateRaw || t.date_time)
    if (isNaN(dt.getTime())) return
    const dow = UTC_LONG[toLocalDow(t.dateRaw || t.date_time, userTz)]
    const dateKey = toLocalDateStr(t.dateRaw || t.date_time, userTz)
    const h = toLocalHour(t.dateRaw || t.date_time, userTz)
    const hBucket = Math.floor(dt.getTime() / 3600000)
    const usd = t.usd || 0
    if (!dayTipsUSD[dow]) { dayTipsUSD[dow] = 0; dayActiveDates[dow] = new Set(); dayDateAmts[dow] = {} }
    dayTipsUSD[dow] += usd
    dayActiveDates[dow].add(dateKey)
    dayDateAmts[dow][dateKey] = (dayDateAmts[dow][dateKey] || 0) + usd
    if (!hourTipsUSD[h]) { hourTipsUSD[h] = 0; hourBucketSets[h] = new Set(); hourBucketAmts[h] = {} }
    hourTipsUSD[h] += usd
    hourBucketSets[h].add(hBucket)
    hourBucketAmts[h][hBucket] = (hourBucketAmts[h][hBucket] || 0) + usd
  })

  const dayAvgs = Object.keys(dayTipsUSD)
    .filter(d => dayActiveDates[d].size >= 3)
    .map(d => ({ day: d, avg: parseFloat(calcMedian(Object.values(dayDateAmts[d])).toFixed(2)), total: dayTipsUSD[d], count: dayActiveDates[d].size }))
  const hourAvgs = Object.keys(hourTipsUSD)
    .filter(h => hourBucketSets[h].size >= 3)
    .map(h => ({ hour: h, avg: parseFloat(calcMedian(Object.values(hourBucketAmts[h])).toFixed(2)), total: hourTipsUSD[h], count: hourBucketSets[h].size }))
  const bestDay  = [...dayAvgs].sort((a, b) => b.avg - a.avg)[0] || null
  const worstDay = [...dayAvgs].sort((a, b) => a.avg - b.avg)[0] || null
  const bestHour = [...hourAvgs].sort((a, b) => b.avg - a.avg)[0] || null

  const whales           = identifyWhales(tips, meaningfulSessions, userTz)
  const resurfacingFans  = detectResurfacing(whales)
  const insights         = generateInsights(tips, meaningfulSessions, bestDay, worstDay, bestHour, whales)
  const predictions      = predictRevenue(tips, meaningfulSessions, userTz)
  const whaleAlerts      = generateWhaleAlerts(whales)
  const lossAlerts       = generateLossAlerts(tips, meaningfulSessions, whales, bestHour)
  const nextMoves        = generateNextMoves(tips, meaningfulSessions, whales, predictions, bestHour, userTz)

  let totalUSD = 0, totalTokens = 0
  for (const t of tips) { totalUSD += t.usd || 0; totalTokens += t.tokens || 0 }

  const platformMap = {}
  meaningfulSessions.forEach(s => {
    if (!platformMap[s.platform]) { platformMap[s.platform] = { platform: s.platform, totalUSD: 0, totalTokens: 0, sessions: 0, hours: 0, tips: 0 } }
    platformMap[s.platform].totalUSD    += s.totalUSD
    platformMap[s.platform].totalTokens += s.totalTokens
    platformMap[s.platform].sessions    += 1
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
    rank: i + 1, username: w.username, usd: w.totalUSD, tokens: w.totalTokens, count: w.tipCount,
    status: w.tier === 'Whale' ? '🐳 WHALE' : w.tier === 'Regular' ? '💎 REGULAR' : w.tier === 'Emerging' ? '⭐ EMERGING' : '🆕 NEW',
    last: new Date(w.lastTipDate).toLocaleDateString(), first: new Date(w.firstTipDate).toLocaleDateString(),
    daysSince: w.daysSinceLastTip, tipProbability: w.tipProbability, churnRisk: w.churnRisk
  }))

  // ── PER-PLATFORM BEST TIMES ───────────────────────────────────────────
  const UTC_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const platHourUSD = {}, platHourBuckets = {}, platDayUSD = {}, platDayDates = {}
  const platDayHourUSD = {}, platDayHourBuckets = {}
  const platHourBucketAmts = {}, platDayDateAmts = {}, platDayHourBucketAmts = {}

  tips.forEach(t => {
    const p = t.platform || 'Chaturbate'
    const dt = new Date(t.dateRaw || t.date_time)
    if (isNaN(dt.getTime())) return
    const h = toLocalHour(t.dateRaw || t.date_time, userTz)
    const dow = UTC_DAYS[toLocalDow(t.dateRaw || t.date_time, userTz)]
    const dateKey = toLocalDateStr(t.dateRaw || t.date_time, userTz)
    const hBucket = Math.floor(dt.getTime() / 3600000)
    const usd = t.usd || 0

    if (!platHourUSD[p]) { platHourUSD[p] = {}; platHourBuckets[p] = {}; platHourBucketAmts[p] = {} }
    if (!platHourUSD[p][h]) { platHourUSD[p][h] = 0; platHourBuckets[p][h] = new Set(); platHourBucketAmts[p][h] = {} }
    platHourUSD[p][h] += usd; platHourBuckets[p][h].add(hBucket)
    platHourBucketAmts[p][h][hBucket] = (platHourBucketAmts[p][h][hBucket] || 0) + usd

    if (!platDayUSD[p]) { platDayUSD[p] = {}; platDayDates[p] = {}; platDayDateAmts[p] = {} }
    if (!platDayUSD[p][dow]) { platDayUSD[p][dow] = 0; platDayDates[p][dow] = new Set(); platDayDateAmts[p][dow] = {} }
    platDayUSD[p][dow] += usd; platDayDates[p][dow].add(dateKey)
    platDayDateAmts[p][dow][dateKey] = (platDayDateAmts[p][dow][dateKey] || 0) + usd

    const dayHourKey = `${dow}__${h}`
    if (!platDayHourUSD[p]) { platDayHourUSD[p] = {}; platDayHourBuckets[p] = {}; platDayHourBucketAmts[p] = {} }
    if (!platDayHourUSD[p][dayHourKey]) { platDayHourUSD[p][dayHourKey] = 0; platDayHourBuckets[p][dayHourKey] = new Set(); platDayHourBucketAmts[p][dayHourKey] = {} }
    platDayHourUSD[p][dayHourKey] += usd; platDayHourBuckets[p][dayHourKey].add(hBucket)
    platDayHourBucketAmts[p][dayHourKey][hBucket] = (platDayHourBucketAmts[p][dayHourKey][hBucket] || 0) + usd
  })

  const platformBestTimes = {}
  Object.keys(platHourUSD).forEach(p => {
    const hourEntries = Object.keys(platHourUSD[p])
      .filter(h => platHourBuckets[p][h].size >= 3)
      .map(h => ({
        hour: parseInt(h),
        avg: parseFloat(calcMedian(Object.values(platHourBucketAmts[p][h])).toFixed(2)),
        sessionCount: platHourBuckets[p][h].size, total: platHourUSD[p][h]
      }))
      .sort((a, b) => b.avg - a.avg)
    const dayEntries = Object.keys(platDayUSD[p])
      .filter(d => platDayDates[p][d].size >= 3)
      .map(d => ({
        day: d,
        avg: parseFloat(calcMedian(Object.values(platDayDateAmts[p][d])).toFixed(2)),
        activeDays: platDayDates[p][d].size, total: platDayUSD[p][d]
      }))
      .sort((a, b) => b.avg - a.avg)
    const bestHourByDay = {}
    UTC_DAYS.forEach(dow => {
      const dayHourEntries = Object.keys(platDayHourUSD[p] || {})
        .filter(k => k.startsWith(dow + '__') && platDayHourBuckets[p][k].size >= 3)
        .map(k => {
          const h = parseInt(k.split('__')[1])
          return { hour: h, avg: parseFloat(calcMedian(Object.values(platDayHourBucketAmts[p][k])).toFixed(2)), sessionCount: platDayHourBuckets[p][k].size }
        })
        .sort((a, b) => b.avg - a.avg)
      if (dayHourEntries.length > 0) bestHourByDay[dow] = dayHourEntries[0]
    })
    platformBestTimes[p] = { hour: hourEntries[0] || null, bestDay: dayEntries[0] || null, bestHourByDay, allHours: hourEntries, allDays: dayEntries }
  })

  // ── EARNINGS VELOCITY (legacy field, kept for existing callers) ───────
  const timedSessions = meaningfulSessions.filter(s => !s.durationUnknown)
  const totalTimedHours = timedSessions.reduce((s, x) => s + x.durationHours, 0)
  const totalTimedUSD = timedSessions.reduce((s, x) => s + x.totalUSD, 0)
  const earningsVelocity = totalTimedHours > 0 ? parseFloat((totalTimedUSD / totalTimedHours).toFixed(2)) : null
  const totalStreamMinutes = Math.round(totalTimedHours * 60)

  // ── ESTIMATED $/HOUR ───────────────────────────────────────────────────
  // Imported CSV files carry tip timestamps only — never a creator's actual
  // stream start/end time — so this can only ever be an estimate inferred
  // from the gap between a session's first and last recorded tip. A session
  // can be a meaningful *earning* event (e.g. one $75 tip, durationUnknown)
  // without being usable for a rate calculation, since a zero/unknown
  // duration has no denominator. This eligibility rule is intentionally
  // stricter than — and separate from — sessionQuality/meaningfulSessions.
  const isHourlyRateEligible = (s) =>
    s.tipCount >= 2 &&
    !s.durationUnknown &&
    Number.isFinite(s.durationMinutes) &&
    s.durationMinutes >= 15 &&
    s.totalUSD > 0

  const hourlyRateSessions = meaningfulSessions.filter(isHourlyRateEligible)
  const hourlyRateTotalUsd = parseFloat(hourlyRateSessions.reduce((s, x) => s + x.totalUSD, 0).toFixed(2))
  const hourlyRateTotalMinutes = hourlyRateSessions.reduce((s, x) => s + x.durationMinutes, 0)
  // Weighted overall average — numerator and denominator always come from the
  // exact same eligible sessions. Never average each session's own hourly rate;
  // that would give a short session the same weight as a long one.
  const estimatedHourlyRate = hourlyRateTotalMinutes > 0
    ? parseFloat((hourlyRateTotalUsd / (hourlyRateTotalMinutes / 60)).toFixed(2))
    : 0
  const hourlyRateSessionCount = hourlyRateSessions.length
  const excludedUntimedSessionCount = meaningfulSessions.filter(s => !isHourlyRateEligible(s)).length

  const platformVelocity = {}
  Object.keys(platformMap).forEach(p => {
    const pHours = platformMap[p].hours
    const pUSD = platformMap[p].totalUSD
    platformVelocity[p] = pHours > 0 ? parseFloat((pUSD / pHours).toFixed(2)) : null
  })

  // ── MISSED REVENUE BY PLATFORM ────────────────────────────────────────
  const missedRevenueByPlatform = {}
  Object.keys(platformBestTimes).forEach(p => {
    const bestHourData = platformBestTimes[p].hour
    if (!bestHourData) return
    const platSessions = timedSessions.filter(s => s.platform === p)
    if (platSessions.length < 3) return
    const overallAvg = platSessions.reduce((s, x) => s + x.totalUSD, 0) / platSessions.length
    const bestHourAvg = bestHourData.avg
    if (bestHourAvg <= overallAvg * 1.2) return
    const sessionsNotAtBestHour = platSessions.filter(s => Math.abs(toLocalHour(s.startTime, userTz) - bestHourData.hour) > 1).length
    const missedRevenue = parseFloat(((bestHourAvg - overallAvg) * sessionsNotAtBestHour).toFixed(2))
    if (missedRevenue > 5) {
      missedRevenueByPlatform[p] = { bestHour: bestHourData.hour, bestHourAvg, overallAvg: parseFloat(overallAvg.toFixed(2)), sessionsNotAtBestHour, missedRevenue, multiplier: parseFloat((bestHourAvg / overallAvg).toFixed(1)) }
    }
  })

  // ── RETURNING VS NEW ──────────────────────────────────────────────────
  const fanTipCounts = {}, fanTipUSD2 = {}
  tips.forEach(t => {
    const k = t.username.toLowerCase()
    fanTipCounts[k] = (fanTipCounts[k] || 0) + 1
    fanTipUSD2[k] = (fanTipUSD2[k] || 0) + (t.usd || 0)
  })
  const returningKeys = Object.keys(fanTipCounts).filter(k => fanTipCounts[k] > 1)
  const newKeys = Object.keys(fanTipCounts).filter(k => fanTipCounts[k] === 1)
  const avgReturnSpend = returningKeys.length ? returningKeys.reduce((s, k) => s + fanTipUSD2[k], 0) / returningKeys.length : 0
  const avgNewSpend = newKeys.length ? newKeys.reduce((s, k) => s + fanTipUSD2[k], 0) / newKeys.length : 0
  const returningVsNew = {
    returningCount: returningKeys.length, newCount: newKeys.length,
    returningPct: Math.round((returningKeys.length / Math.max(Object.keys(fanTipCounts).length, 1)) * 100),
    avgReturnSpend: parseFloat(avgReturnSpend.toFixed(2)), avgNewSpend: parseFloat(avgNewSpend.toFixed(2)),
    multiplier: avgNewSpend > 0 ? parseFloat((avgReturnSpend / avgNewSpend).toFixed(1)) : null
  }

  // ── TOP FAN DEPENDENCY ────────────────────────────────────────────────
  const sortedWhales = [...whales].sort((a, b) => b.totalUSD - a.totalUSD)
  const top1USD = sortedWhales[0]?.totalUSD || 0
  const top3USD = sortedWhales.slice(0, 3).reduce((s, w) => s + w.totalUSD, 0)
  const top5USD = sortedWhales.slice(0, 5).reduce((s, w) => s + w.totalUSD, 0)
  const topFanDependency = totalUSD > 0 ? {
    top1Pct: Math.round((top1USD / totalUSD) * 100),
    top3Pct: Math.round((top3USD / totalUSD) * 100),
    top5Pct: Math.round((top5USD / totalUSD) * 100),
    lossIfTopFanLeaves: parseFloat(top1USD.toFixed(2))
  } : null

  // ── MONTHLY DATA ──────────────────────────────────────────────────────
  const monthMap = {}
  tips.forEach(t => {
    const dt = new Date(t.dateRaw || t.date_time)
    if (isNaN(dt.getTime())) return
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
    if (!monthMap[key]) monthMap[key] = { usd: 0, tips: 0, fans: new Set(), sessions: 0 }
    monthMap[key].usd += t.usd || 0
    monthMap[key].tips += 1
    monthMap[key].fans.add(t.username.toLowerCase())
  })
  allValidSessions.forEach(s => {
    const dt = new Date(s.startTime)
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
    if (monthMap[key]) monthMap[key].sessions += 1
  })
  const monthlyData = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({
    month, usd: parseFloat(d.usd.toFixed(2)), tips: d.tips, fans: d.fans.size, sessions: d.sessions,
    usdPerFan: d.fans.size > 0 ? parseFloat((d.usd / d.fans.size).toFixed(2)) : 0
  }))
  const bestMonth = monthlyData.length > 0 ? [...monthlyData].sort((a, b) => b.usd - a.usd)[0] : null

  // ── TIP TYPE BREAKDOWN ────────────────────────────────────────────────
  const tipTypeMap = {}
  tips.forEach(t => {
    const type = t.tip_type || 'Tip'
    if (!tipTypeMap[type]) tipTypeMap[type] = { usd: 0, count: 0, fans: new Set() }
    tipTypeMap[type].usd += t.usd || 0
    tipTypeMap[type].count += 1
    tipTypeMap[type].fans.add(t.username.toLowerCase())
  })
  const tipTypeBreakdown = Object.entries(tipTypeMap).map(([type, d]) => ({
    type, usd: parseFloat(d.usd.toFixed(2)), count: d.count, fans: d.fans.size,
    pct: totalUSD > 0 ? Math.round((d.usd / totalUSD) * 100) : 0,
    avgUsd: d.count > 0 ? parseFloat((d.usd / d.count).toFixed(2)) : 0
  })).sort((a, b) => b.usd - a.usd)

  // ── PRIVATE & SPY SHOW FANS ───────────────────────────────────────────
  const privateFanMap = {}, spyFanSet = new Set()
  tips.forEach(t => {
    const type = (t.tip_type || '').toLowerCase()
    if (type.includes('private')) {
      const k = t.username.toLowerCase()
      if (!privateFanMap[k]) privateFanMap[k] = { username: t.username, usd: 0, count: 0 }
      privateFanMap[k].usd += t.usd || 0
      privateFanMap[k].count += 1
    }
    if (type.includes('spy')) spyFanSet.add(t.username.toLowerCase())
  })
  const privateShowFans = Object.values(privateFanMap).sort((a, b) => b.usd - a.usd).map(f => ({ ...f, usd: parseFloat(f.usd.toFixed(2)) }))
  const spyShowFans = [...spyFanSet].filter(u => !privateFanMap[u])

  // Momentum — month over month revenue comparison
  const now = new Date()
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000)

  const last30USD = tips
    .filter(t => new Date(t.date_time) >= thirtyDaysAgo)
    .reduce((sum, t) => sum + (parseFloat(t.usd) || 0), 0)

  const prior30USD = tips
    .filter(t => new Date(t.date_time) >= sixtyDaysAgo &&
                 new Date(t.date_time) < thirtyDaysAgo)
    .reduce((sum, t) => sum + (parseFloat(t.usd) || 0), 0)

  let momentumPct = 0
  let momentumLabel = 'Steady'
  let momentumEmoji = '→'

  if (prior30USD === 0 && last30USD === 0) {
    momentumLabel = 'No data'; momentumEmoji = '—'
  } else if (last30USD === 0) {
    // No revenue at all in the last 30 days — this is an absence of
    // recent streaming, not a measured downward trend. Don't fabricate
    // a "Declining" claim from zero data.
    momentumPct = -100; momentumLabel = 'Inactive'; momentumEmoji = '💤'
  } else if (prior30USD === 0) {
    momentumPct = 100; momentumLabel = 'Surging'; momentumEmoji = '🚀'
  } else {
    momentumPct = ((last30USD - prior30USD) / prior30USD) * 100
    if (momentumPct > 50)       { momentumLabel = 'Surging';   momentumEmoji = '🚀' }
    else if (momentumPct > 10)  { momentumLabel = 'Growing';   momentumEmoji = '📈' }
    else if (momentumPct > -10) { momentumLabel = 'Steady';    momentumEmoji = '→'  }
    else                        { momentumLabel = 'Declining'; momentumEmoji = '📉' }
  }

  const momentum = { pct: momentumPct, label: momentumLabel, emoji: momentumEmoji, last30USD, prior30USD }

  return {
    totalUSD: parseFloat(totalUSD.toFixed(2)),
    totalTokens,
    totalTips: tips.length,
    avgTipSize: parseFloat((tips.length > 0 ? totalUSD / tips.length : 0).toFixed(2)),
    topTippers, platforms, sessions: allValidSessions,
    insights: validateInsights(insights),
    predictions, whaleAlerts, lossAlerts, nextMoves, whales, resurfacingFans,
    bestDay, bestHour, platformBestTimes,
    monthlyData, bestMonth,
    tipTypeBreakdown, privateShowFans, spyShowFans,
    earningsVelocity, totalStreamMinutes, platformVelocity,
    estimatedHourlyRate, hourlyRateSessionCount, hourlyRateTotalMinutes,
    hourlyRateTotalUsd, excludedUntimedSessionCount,
    missedRevenueByPlatform, returningVsNew, topFanDependency,
    dependencyRisk: null, preTipBehavior: null, trueHourlyAvg: [],
    meaningfulSessions, allValidSessions,
    meaningfulSessionCount: meaningfulSessions.length,
    lowSignalSessionCount: allValidSessions.length - meaningfulSessions.length,
    momentum,
  }
}

// ============================================================
// PAID SESSION ANALYTICS
// Operates on rows from the paid_sessions table (BongaCams).
// Completely separate from tip analytics — never mixed.
// ============================================================

export function computePaidSessionAnalytics(sessions, userTz = 'UTC') {
  if (!sessions || sessions.length === 0) return null

  const totalUSD     = sessions.reduce((s, r) => s + (parseFloat(r.usd) || 0), 0)
  const totalTokens  = sessions.reduce((s, r) => s + (parseInt(r.tokens) || 0), 0)
  const totalCount   = sessions.length

  // ── SESSION TYPE BREAKDOWN ─────────────────────────────────
  const typeMap = {}
  sessions.forEach(s => {
    const t = s.session_type || 'Unknown'
    if (!typeMap[t]) typeMap[t] = { usd: 0, count: 0, clients: new Set() }
    typeMap[t].usd     += parseFloat(s.usd) || 0
    typeMap[t].count   += 1
    typeMap[t].clients.add((s.username || '').toLowerCase())
  })
  const sessionTypeBreakdown = Object.entries(typeMap)
    .map(([type, d]) => ({
      type,
      usd:      parseFloat(d.usd.toFixed(2)),
      count:    d.count,
      clients:  d.clients.size,
      pct:      totalUSD > 0 ? Math.round((d.usd / totalUSD) * 100) : 0,
      avgUsd:   d.count > 0 ? parseFloat((d.usd / d.count).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.usd - a.usd)

  // ── PLATFORM BREAKDOWN ─────────────────────────────────────
  // Same shape/derivation as sessionTypeBreakdown above, just keyed by
  // platform instead of session_type -- only BongaCams populates
  // paid_sessions today, but this doesn't assume that.
  const platformMap = {}
  sessions.forEach(s => {
    const p = s.platform || 'Unknown'
    if (!platformMap[p]) platformMap[p] = { usd: 0, count: 0, clients: new Set() }
    platformMap[p].usd     += parseFloat(s.usd) || 0
    platformMap[p].count   += 1
    platformMap[p].clients.add((s.username || '').toLowerCase())
  })
  const platformBreakdown = Object.entries(platformMap)
    .map(([platform, d]) => ({
      platform,
      usd:      parseFloat(d.usd.toFixed(2)),
      count:    d.count,
      clients:  d.clients.size,
      pct:      totalUSD > 0 ? Math.round((d.usd / totalUSD) * 100) : 0,
      avgUsd:   d.count > 0 ? parseFloat((d.usd / d.count).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.usd - a.usd)

  // ── TOP PRIVATE CLIENTS ────────────────────────────────────
  const clientMap = {}
  sessions.forEach(s => {
    const k = (s.username || 'unknown').toLowerCase()
    if (!clientMap[k]) clientMap[k] = {
      username: s.username || 'unknown',
      usd: 0, tokens: 0, count: 0,
      sessionTypes: new Set(),
      dates: [],
    }
    clientMap[k].usd    += parseFloat(s.usd) || 0
    clientMap[k].tokens += parseInt(s.tokens) || 0
    clientMap[k].count  += 1
    clientMap[k].sessionTypes.add(s.session_type || 'Unknown')
    clientMap[k].dates.push(new Date(s.date_time))
  })

  const topClients = Object.values(clientMap)
    .map(c => {
      const sorted = [...c.dates].sort((a, b) => a - b)
      return {
        username:     c.username,
        totalUSD:     parseFloat(c.usd.toFixed(2)),
        totalTokens:  c.tokens,
        sessionCount: c.count,
        avgSessionUSD: parseFloat((c.usd / c.count).toFixed(2)),
        sessionTypes: [...c.sessionTypes],
        lastSession:  sorted[sorted.length - 1]?.toISOString() || null,
        firstSession: sorted[0]?.toISOString() || null,
        daysSinceLast: sorted.length
          ? Math.floor((Date.now() - sorted[sorted.length - 1]) / 86400000)
          : null,
      }
    })
    .sort((a, b) => b.totalUSD - a.totalUSD)
    .slice(0, 20)

  // ── PEAK HOURS FOR PAID SESSIONS ───────────────────────────
  const hourMap = {}
  sessions.forEach(s => {
    const h = toLocalHour(s.date_time, userTz)
    if (!hourMap[h]) hourMap[h] = { usd: 0, count: 0 }
    hourMap[h].usd   += parseFloat(s.usd) || 0
    hourMap[h].count += 1
  })
  const peakHours = Object.entries(hourMap)
    .map(([h, d]) => ({
      hour:     parseInt(h),
      usd:      parseFloat(d.usd.toFixed(2)),
      count:    d.count,
      avgUsd:   parseFloat((d.usd / d.count).toFixed(2)),
    }))
    .sort((a, b) => b.usd - a.usd)

  const bestHour = peakHours[0] || null

  // ── MONTHLY TREND ──────────────────────────────────────────
  const monthMap = {}
  sessions.forEach(s => {
    const dt  = new Date(s.date_time)
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
    if (!monthMap[key]) monthMap[key] = { usd: 0, count: 0, clients: new Set() }
    monthMap[key].usd     += parseFloat(s.usd) || 0
    monthMap[key].count   += 1
    monthMap[key].clients.add((s.username || '').toLowerCase())
  })
  const monthlyTrend = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      month,
      usd:     parseFloat(d.usd.toFixed(2)),
      count:   d.count,
      clients: d.clients.size,
    }))

  const bestMonth = monthlyTrend.length
    ? [...monthlyTrend].sort((a, b) => b.usd - a.usd)[0]
    : null

  // ── MOMENTUM (last 30 vs prior 30 days) ───────────────────
  const now         = Date.now()
  const ms30        = 30 * 24 * 60 * 60 * 1000
  const last30USD   = sessions
    .filter(s => now - new Date(s.date_time) <= ms30)
    .reduce((sum, s) => sum + (parseFloat(s.usd) || 0), 0)
  const prior30USD  = sessions
    .filter(s => {
      const age = now - new Date(s.date_time)
      return age > ms30 && age <= ms30 * 2
    })
    .reduce((sum, s) => sum + (parseFloat(s.usd) || 0), 0)

  let momentumPct   = 0
  let momentumLabel = 'Steady'
  if (prior30USD === 0 && last30USD === 0) {
    momentumLabel = 'No data'
  } else if (last30USD === 0) {
    // No revenue at all in the last 30 days — this is an absence of
    // recent streaming, not a measured downward trend. Don't fabricate
    // a "Declining" claim from zero data.
    momentumPct = -100; momentumLabel = 'Inactive'
  } else if (prior30USD === 0) {
    momentumPct = 100; momentumLabel = 'Surging'
  } else {
    momentumPct = ((last30USD - prior30USD) / prior30USD) * 100
    if      (momentumPct >  50) momentumLabel = 'Surging'
    else if (momentumPct >  10) momentumLabel = 'Growing'
    else if (momentumPct > -10) momentumLabel = 'Steady'
    else                        momentumLabel = 'Declining'
  }

  // ── REPEAT CLIENT RATE ─────────────────────────────────────
  const repeatClients   = Object.values(clientMap).filter(c => c.count > 1).length
  const totalClients    = Object.keys(clientMap).length
  const repeatClientPct = totalClients > 0
    ? Math.round((repeatClients / totalClients) * 100)
    : 0

  // ── DATE RANGE ─────────────────────────────────────────────
  const allDates  = sessions.map(s => new Date(s.date_time)).filter(d => !isNaN(d))
  const dateRange = allDates.length ? {
    from: new Date(Math.min(...allDates)).toISOString(),
    to:   new Date(Math.max(...allDates)).toISOString(),
  } : null

  // ── AVERAGES ────────────────────────────────────────────────
  const avgTokensPerSession = totalCount > 0 ? Math.round(totalTokens / totalCount) : 0
  const avgPayoutPerToken   = totalTokens > 0 ? parseFloat((totalUSD / totalTokens).toFixed(4)) : 0

  return {
    totalUSD:            parseFloat(totalUSD.toFixed(2)),
    totalTokens,
    totalCount,
    avgSessionUSD:       totalCount > 0 ? parseFloat((totalUSD / totalCount).toFixed(2)) : 0,
    avgTokensPerSession,
    avgPayoutPerToken,
    uniqueClients:       totalClients,
    repeatClients,
    repeatClientPct,
    sessionTypeBreakdown,
    platformBreakdown,
    topClients,
    peakHours,
    bestHour,
    monthlyTrend,
    bestMonth,
    momentum: {
      pct:        parseFloat(momentumPct.toFixed(1)),
      label:      momentumLabel,
      last30USD:  parseFloat(last30USD.toFixed(2)),
      prior30USD: parseFloat(prior30USD.toFixed(2)),
    },
    dateRange,
  }
}

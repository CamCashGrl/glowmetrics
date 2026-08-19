// ============================================
// CAMCASH COMPLETE ANALYTICS ENGINE
// ============================================

// Token rates live in ONE place — lib/constants.js
// Do not define rates here. Import only.
import { PLATFORM_TOKEN_RATES, DEFAULT_TOKEN_RATE, tokenRate, UNDETECTED_PLATFORM } from './constants'
// Session grouping lives in ONE place — lib/analytics/sessions.js
// Shared with app/live/page.js. Do not redefine this logic here.
import { detectSessions, classifySession as classifySessionQuality } from './analytics/sessions'
// Local-timezone + median primitives live in this leaf module (no imports of
// its own) specifically so lib/analytics/bestTimes.js can depend on them
// without creating a circular import with this file (this file's platforms
// calculation calls into bestTimes.js — see the PLATFORMS section below).
// Re-exported here so existing importers of toLocalHour/toLocalDow/calcMedian
// from 'lib/analytics' keep working unchanged.
import { calcMedian, toLocalHour, toLocalDow, toLocalDateStr } from './analytics/localTime'
import { computeCanonicalBestTimes } from './analytics/bestTimes'
import { computeMissedRevenue } from './analytics/missedRevenue'
export { calcMedian, toLocalHour, toLocalDow }

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

// 24-hour numeric hour -> 12-hour label, wrapping correctly past midnight
// (e.g. 23 + 2 -> "1 AM", not "25:00"). Single source of truth for any
// hour-range display — never hand-roll ":00" hour strings in a component.
export function fmt12Hour(h) {
  const hh = ((h % 24) + 24) % 24
  return hh === 0 ? '12 AM' : hh < 12 ? `${hh} AM` : hh === 12 ? '12 PM' : `${hh - 12} PM`
}

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
  if (!user || typeof user !== 'object') return false;
  if (user.daysSinceLastTip > 90) return false;
  if ((user.totalTokens || 0) < 100) return false;
  return true;
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
//
// Two real-world variants confirmed against actual failed-paste patterns
// (49 of 56 onboarding_paste_parse_failed events were Chaturbate, by far
// the dominant activation blocker — see the funnel data behind this fix):
//   1. Day-of-month ordinal suffixes ("Jun 18th, 2026, 8:27 PM") — the
//      onboarding preview's client-side date matcher already accepted
//      these (app/onboarding/page.js's tryParseDate), but THIS server-side
//      matcher did not. That meant some pastes showed a successful preview
//      but then silently imported zero/fewer rows than previewed — not
//      even visible as a distinct failure event, since onboarding_paste_
//      parse_failed only fires on the client-preview step.
//   2. A running balance over 999 formatted with a thousands-comma
//      ("500  12,345") — the same class of bug already found and fixed for
//      BongaCams (scripts/verify-bongacams-tokens-thousands-separator.mjs),
//      applied here proactively since Chaturbate's stat page can format
//      large numbers the same way.
// Also tolerates a tokens-only line (no running balance) as a fallback,
// since not every page view/account shows a running balance column.
const CB_DATE_LINE_RE = /^([A-Za-z]{3})\s+(\d{1,2})(?:st|nd|rd|th)?,\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i
const CB_TIP_FROM_RE = /^Tip From:\s*(.+)$/i
const CB_TOKENS_LINE_RE = /^([\d,]+)\s+([\d,]+)$/
const CB_TOKENS_SINGLE_RE = /^([\d,]+)$/
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
    let singleMatch = !tMatch ? tokensLine.match(CB_TOKENS_SINGLE_RE) : null
    if (!tMatch && !singleMatch && lines[i + 3]) {
      note = tokensLine
      tokensLine = (lines[i + 3] || '').trim()
      tMatch = tokensLine.match(CB_TOKENS_LINE_RE)
      singleMatch = !tMatch ? tokensLine.match(CB_TOKENS_SINGLE_RE) : null
    }

    const tokensRaw = tMatch ? tMatch[1] : (singleMatch ? singleMatch[1] : null)
    if (tokensRaw) {
      const tokens = parseInt(tokensRaw.replace(/,/g, ''), 10)
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

  // Decide day-first vs month-first for this file BEFORE any row is read —
  // including the Chaturbate multi-line branch below, which also normalises
  // dates. See SLASH_DATE_RE for why this cannot be decided per row.
  SLASH_DATE_DAY_FIRST = inferSlashDateOrientation(text)

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
  // No CamSoda branch: its import path is not shipped (see SUPPORTED_PLATFORMS
  // in lib/constants.js). Detecting it here would stamp rows with a platform
  // the rest of the pipeline treats as unsupported. Letting them fall through
  // to 'Unknown' keeps the data importable and readable via the existing
  // undetected-platform handling instead of stranding it.
  // Structural detection — platform-unique data format when no platform name appears in the text
  if (/^\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}/m.test(text)) return 'BongaCams'
  if (/^\d{10,13}\t/m.test(text)) return 'MyFreeCams'
  return 'Unknown'
}

// Slash dates with a 1-2 digit first component ("5/1/26", "05/07/2024") are
// AMBIGUOUS: nothing in the value says whether 5 is the day or the month.
// Before this, they fell through to new Date(), which always reads them as US
// month-first. A real BongaCams export mixed "DD.MM.YYYY" rows with "D/M/YY"
// rows — both day-first — and 32% of the file silently had day and month
// swapped. One row, "5/1/26" (5 January 2026), became 1 May 2026: four months
// past the creator's newest real tip. Since the Free window anchors on each
// platform's newest row, it landed on an empty future range and the creator
// saw "1 tip · $7.16" after importing 1,912 rows.
const SLASH_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?:[\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/

// Orientation is a property of the FILE, not of any single row, so it is
// inferred once per parse. Module-level rather than threaded through five
// call sites: parseCSV is synchronous, so one file's orientation can never be
// observed by another parse mid-run.
let SLASH_DATE_DAY_FIRST = true

export function inferSlashDateOrientation(text) {
  let sawDayFirst = false
  let sawMonthFirst = false
  for (const line of String(text || '').split('\n')) {
    const m = line.trim().match(SLASH_DATE_RE)
    if (!m) continue
    if (+m[1] > 12) sawDayFirst = true   // first component can only be a day
    if (+m[2] > 12) sawMonthFirst = true // second component can only be a day
  }
  // Unambiguous evidence wins.
  if (sawDayFirst && !sawMonthFirst) return true
  if (sawMonthFirst && !sawDayFirst) return false
  // Otherwise every slash row is ambiguous (or the file contradicts itself).
  // Fall back to day-first: the platforms CamCash imports are non-US and their
  // other date format in the same files, DD.MM.YYYY, is itself day-first.
  return true
}

function normalizeDate(raw) {
  if (!raw) return null
  const euro = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}:\d{2}))?/)
  if (euro) return `${euro[2]}/${euro[1]}/${euro[3]}${euro[4] ? ' ' + euro[4] : ''}`
  const iso = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})(.*)/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}${iso[4]}`
  // normalizeDate() is applied TWICE to the same value — once by the
  // per-platform parser and again by normalizeTip() — so it must be
  // idempotent. The old slash branch only matched YYYY/MM/DD, so its own
  // MM/DD/YYYY output fell straight through and nobody noticed. An
  // ambiguous-slash branch that re-reads that output would swap day and
  // month back on the second pass, and would turn the euro branch's
  // "06/14/2024" into month 14 — dropping every dot-format row.
  //
  // Canonical output is always zero-padded 2/2/4. Raw ambiguous dates worth
  // reinterpreting have a 2-digit year or an unpadded component, so requiring
  // one of those both fixes the real exports and leaves our own output alone.
  //
  // KNOWN LIMIT: a raw date already written "05/07/2024" is byte-identical to
  // canonical output, so it cannot be reinterpreted here and still parses
  // US-style. That is exactly the previous behaviour — not a regression — and
  // fixing it needs single-pass normalisation, not a smarter regex.
  const alreadyNormalized = /^\d{2}\/\d{2}\/\d{4}/.test(raw)
  const sl = alreadyNormalized ? null : raw.match(SLASH_DATE_RE)
  if (sl) {
    const [, p1, p2, yRaw, hh, mm, ss] = sl
    const day = SLASH_DATE_DAY_FIRST ? +p1 : +p2
    const month = SLASH_DATE_DAY_FIRST ? +p2 : +p1
    // A 2-digit year is this century unless it would be absurdly future.
    let year = +yRaw
    if (yRaw.length === 2) year += year >= 70 ? 1900 : 2000
    const pad = (n) => String(n).padStart(2, '0')
    const time = hh ? ` ${pad(hh)}:${mm}${ss ? ':' + ss : ''}` : ''
    // Emitted MM/DD/YYYY to match the euro branch above, so both feed the same
    // downstream new Date() the same way.
    return `${pad(month)}/${pad(day)}/${year}${time}`
  }
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

// Paid-chat/private-session detection, matched against a row's "Chat Type"
// / "Transaction Type" column (normalized to tip_type by normalizeHeaderName
// above). Session-based revenue uses different label text per platform
// (BongaCams: "Private Chat" / "Full-Private Chat" / "Group Chat" / "Spy
// Mode"; Chaturbate & MyFreeCams: "Private Show" / "Spy Show" / "Group
// Show"), so this matches by keyword rather than an exact per-platform
// string and canonicalizes every match to the same four labels — those are
// what PrivateSessions.js's TYPE_COLORS map and type filter expect,
// regardless of which platform the row came from. Order matters: "full
// private" is checked before the plain "private" pattern since it's a
// substring of it.
const PAID_SESSION_TYPE_PATTERNS = [
  { re: /full[\s-]?private/i, label: 'Full-Private Chat' },
  { re: /private/i,           label: 'Private Chat' },
  { re: /spy/i,                label: 'Spy Mode' },
  { re: /group/i,              label: 'Group Chat' },
]

function detectPaidSessionType(tipType) {
  if (!tipType) return null
  const found = PAID_SESSION_TYPE_PATTERNS.find(p => p.re.test(tipType))
  return found ? found.label : null
}

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

    // Recomputed from row.tip_type (not the earlier `tipType` const) so the
    // action-derived "Private Show"/"Spy Show" values set just above are
    // picked up too, not just tip_type as it was in the raw CSV column.
    const paidSessionType = detectPaidSessionType(row.tip_type)

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
      ...(paidSessionType ? { is_paid_session: true, session_type: paidSessionType } : {}),
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

// tz: creator's resolved timezone (lib/timezone.js). Optional so existing
// callers keep working; defaults to UTC, which is what the hour bucketing
// below did unconditionally before.
export function identifyWhales(tips, tz = 'UTC') {
  const fanMap = {}
  tips.forEach(t => {
    const key = t.username.toLowerCase()
    if (!fanMap[key]) { fanMap[key] = { username: t.username, totalUSD: 0, totalTokens: 0, tipCount: 0, tips: [], platform: t.platform, tipNotes: [] } }
    fanMap[key].totalUSD += t.usd || 0
    fanMap[key].totalTokens += t.tokens || 0
    fanMap[key].tipCount += 1
    fanMap[key].tips.push(t)
    if (t.tip_note) fanMap[key].tipNotes.push(t.tip_note)
  })

  const allFans = Object.values(fanMap)
  const sorted = [...allFans].sort((a, b) => b.totalUSD - a.totalUSD)
  const totalFans = sorted.length
  // O(1) rank lookup instead of sorted.findIndex(...) per fan (was O(fans^2))
  const rankByUsername = new Map(sorted.map((s, i) => [s.username.toLowerCase(), i]))

  return allFans.map(f => {
    const fanSorted = [...f.tips].sort((a, b) => new Date(b.dateRaw || b.date_time) - new Date(a.dateRaw || a.date_time))
    const lastTipDate = new Date(fanSorted[0].dateRaw || fanSorted[0].date_time)
    const firstTipDate = new Date(fanSorted[fanSorted.length - 1].dateRaw || fanSorted[fanSorted.length - 1].date_time)
    const daysSinceLastTip = Math.floor((Date.now() - lastTipDate) / 86400000)
    const lifetimeDays = Math.max(Math.floor((lastTipDate - firstTipDate) / 86400000), 1)
    const avgDaysBetweenTips = f.tipCount > 1 ? Math.max(1, lifetimeDays / (f.tipCount - 1)) : 30
    const biggestTip = Math.max(...f.tips.map(t => t.usd))
    const fanRankIndex = rankByUsername.get(f.username.toLowerCase())
    const percentileRank = totalFans > 1 ? fanRankIndex / (totalFans - 1) : 0
    let tier = 'Regular'
    if (percentileRank <= 0.05) tier = 'Whale'
    else if (percentileRank <= 0.20) tier = 'Shark'
    else if (daysSinceLastTip > Math.max(60, avgDaysBetweenTips * 3)) tier = 'Dormant'

    const privateTips = f.tips.filter(t => t.tip_type?.toLowerCase().includes('private') || t.tip_note?.toLowerCase().includes('private'))
    const hourCounts = {}
    // Creator-local hour — this drives typicalOnlineHours, rendered as
    // "Typically online 8 PM - 10 PM". Was getUTCHours(), so the range shown
    // was in UTC while being read as the creator's own clock.
    f.tips.forEach(t => { const h = toLocalHour(t.dateRaw || t.date_time, tz); hourCounts[h] = (hourCounts[h] || 0) + 1 })
    const mostActiveHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]
    const spendPercentile = Math.round((1 - percentileRank) * 100)
    const tipDates = [...f.tips].sort((a, b) => new Date(a.dateRaw || a.date_time) - new Date(b.dateRaw || b.date_time)).map(t => new Date(t.dateRaw || t.date_time))
    const daysBetweenTipsArr = []
    for (let i = 1; i < tipDates.length; i++) { daysBetweenTipsArr.push((tipDates[i] - tipDates[i - 1]) / 86400000) }

    return {
      username: f.username, totalUSD: parseFloat(f.totalUSD.toFixed(2)), totalTokens: f.totalTokens,
      tipCount: f.tipCount, avgTipSize: parseFloat((f.totalUSD / f.tipCount).toFixed(2)),
      biggestTip: parseFloat(biggestTip.toFixed(2)), platform: f.platform, tier,
      lastTipDate: lastTipDate.toISOString(), firstTipDate: firstTipDate.toISOString(),
      daysSinceLastTip, avgDaysBetweenTips: parseFloat(avgDaysBetweenTips.toFixed(1)), daysBetweenTipsArr,
      tipProbability: calcTipProbability(daysSinceLastTip, avgDaysBetweenTips),
      churnRisk: calcChurnRisk(daysSinceLastTip, avgDaysBetweenTips, f.tipCount),
      lifetimeValue: calcLifetimeValue(f.totalUSD, lifetimeDays, f.tipCount),
      expectedNextTip: calcExpectedNextTip(daysSinceLastTip, avgDaysBetweenTips),
      hasPrivates: privateTips.length > 0, privateCount: privateTips.length,
      privateSpent: parseFloat(privateTips.reduce((s, t) => s + t.usd, 0).toFixed(2)),
      typicalOnlineHours: mostActiveHour ? `${fmt12Hour(parseInt(mostActiveHour[0]))} - ${fmt12Hour(parseInt(mostActiveHour[0]) + 2)}` : 'Unknown',
      // The NUMERIC form of the same bucket typicalOnlineHours formats, plus
      // the counts behind it. Exposed because the Fans tab needs to compare
      // this hour against the current hour ("is this fan usually around right
      // now?"), which a pre-formatted "8 PM - 10 PM" string can't support —
      // so page.js was re-bucketing every fan's tips by creator-local hour to
      // recover it, a second implementation of this exact calculation. Same
      // hourCounts, same toLocalHour, computed once here.
      peakLocalHour: mostActiveHour ? parseInt(mostActiveHour[0]) : null,
      peakHourTipCount: mostActiveHour ? mostActiveHour[1] : 0,
      tipNotes: f.tipNotes, tips: f.tips, isTopSpender: percentileRank <= 0.05, spendPercentile
    }
  }).sort((a, b) => b.totalUSD - a.totalUSD)
}

function calcTipProbability(d, avg) {
  if (d < avg * 0.5)  return { level: 'High',        percentage: 85 }
  if (d < avg)        return { level: 'Medium-High',  percentage: 70 }
  if (d < avg * 1.5)  return { level: 'Medium',       percentage: 50 }
  if (d < avg * 2)    return { level: 'Low-Medium',   percentage: 30 }
  return                     { level: 'Low',           percentage: 15 }
}

function calcChurnRisk(d, avg, count) {
  if (count < 3) return { level: 'Unknown', risk: 'Insufficient data' }
  const r = d / avg
  if (r < 1) return { level: 'Low',      risk: 'Active' }
  if (r < 2) return { level: 'Medium',   risk: 'Watch closely' }
  if (r < 3) return { level: 'High',     risk: 'At risk' }
  return           { level: 'Critical',  risk: 'Likely churned' }
}

function calcLifetimeValue(spent, days, count) {
  if (days < 7 || count < 2) {
    // Same per-day-rate projection as the confident branch below, just
    // labeled Low confidence — was previously omitting `monthly` entirely,
    // which rendered as a blank "$—" in the fan intelligence panel instead
    // of a rough early estimate.
    const perDayEarly = spent / Math.max(days, 1)
    return { prediction: spent, confidence: 'Low', monthly: parseFloat((perDayEarly * 30).toFixed(2)) }
  }
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
      if (w.daysSinceLastTip > w.avgDaysBetweenTips * 1.5)
        alerts.push({ type: 'returned', severity: 'success', icon: '🎉', whale: w, message: `${w.username} just tipped again after ${w.daysSinceLastTip} days away — welcome them back!`, action: 'Send a thank you message' })
    }
  })
  alerts = alerts.filter(a => isUserRelevant(a.whale))
  const order = { critical: 0, warning: 1, info: 2, success: 3 }
  return alerts.sort((a, b) => order[a.severity] - order[b.severity])
}

export function predictRevenue(tips, sessions, tz = 'UTC') {
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
  // Creator-local day-of-week: "today" in the forecast means the creator's
  // today, and the sessions it is matched against must be bucketed the same way.
  const todayDow = toLocalDow(new Date().toISOString(), tz)
  const sameDaySessions = sessions.filter(s => toLocalDow(s.startTime, tz) === todayDow)
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

export function generateLossAlerts(tips, sessions, whales, bestHour, tz = 'UTC') {
  const alerts = []
  const now = Date.now()
  if (bestHour) {
    const bh = parseInt(bestHour.hour)
    const recentSessions = sessions.filter(s => (now - new Date(s.startTime)) / 86400000 <= 3)
    // bh is a creator-local hour (canonical bestWindow), so the session hour
    // it is compared against must be local too — this was comparing a local
    // peak hour against a UTC session hour.
    const recentAtPeak = recentSessions.filter(s => Math.abs(toLocalHour(s.startTime, tz) - bh) <= 1)
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

  // Reuses bestDay.avg/worstDay.avg exactly as computed upstream in
  // aggregateRows() (median-per-date, local timezone) — this used to
  // recompute its own "day average" from a mean of session totals grouped
  // by UTC day-of-week, which produced a different number for the same
  // "Sunday average" concept than the Best Streaming Day stat shown
  // elsewhere on the same screen. One formula, one number, everywhere.
  //
  // UNIT, STATED EXPLICITLY: bestDay.avg is MEDIAN DOLLARS PER DAY STREAMED
  // — total tips on each calendar date that day-of-week, then the median
  // across those dates. It is NOT a $/hour rate. The Creator Report's "Best
  // Streaming Time" card shows canonicalBestTimes.bestWindow.medianUsdPerHour,
  // a $/HOUR median, and on the owner's real account the two rendered side
  // by side as "Saturday ~$18 avg" and "you avg $4 on Saturdays" — one
  // finding that read as a contradiction because neither said what it
  // measured. Both are correct; the wording now names the unit.
  if (bestDay && worstDay && bestDay.day !== worstDay.day && bestDay.avg > 0) {
    const mult = worstDay.avg > 0 ? (bestDay.avg / worstDay.avg).toFixed(1) : null
    const costOfMissing = parseFloat((bestDay.avg - worstDay.avg).toFixed(2))
    if (mult && parseFloat(mult) > 1 && costOfMissing > 0) {
      insights.push({ icon: '📅', text: `${bestDay.day}s are your highest-earning day — you take home a median $${bestDay.avg.toFixed(0)} on each ${bestDay.day} you stream vs $${worstDay.avg.toFixed(0)} on your lowest day (${worstDay.day}) (${mult}x more). Missing one ${bestDay.day} costs you ~$${costOfMissing.toFixed(0)}`, type: 'day', priority: 1 })
    }
  }

  if (bestHour) {
    const h = parseInt(bestHour.hour)
    const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
    const avgOverall = sessions.reduce((s, x) => s + x.totalUSD, 0) / sessions.length
    const multiplier = avgOverall > 0 ? (bestHour.avg / avgOverall).toFixed(1) : null
    insights.push({ icon: '⏰', text: `Go live at ${label} — your avg session earnings are ${multiplier ? `${multiplier}x higher` : 'at their peak'} at this hour ($${bestHour.avg.toFixed(0)} avg). Missing this window costs you real money every session`, type: 'time', priority: 1 })
  }

  const whales = precomputedWhales || identifyWhales(tips)
  const trueWhales = whales.filter(w => w.tier === 'Whale')
  const topWhales = (trueWhales.length > 0 ? trueWhales : whales.filter(w => w.tier === 'Shark')).slice(0, 5)
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

export function generateNextMoves(tips, sessions, whales, predictions, bestHour, tz = 'UTC') {
  const moves = []
  const now = Date.now()
  if (bestHour) {
    const bh = parseInt(bestHour.hour)
    const currentHour = toLocalHour(new Date().toISOString(), tz)
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

// Canonical best-day / best-hour computation (median USD per local-hour or
// local-day bucket, 3+ active buckets required for confidence) — the single
// source of truth for "when should I stream" across the product. Extracted
// out of aggregateRows() so pages that don't need the full aggregation
// pipeline (e.g. Live Mode's real-time coaching, which intentionally scopes
// to a recent rolling window rather than full lifetime history) can still
// use the exact same formula instead of recomputing their own version.
export function computeBestTimes(tips, tz = null) {
  const userTz = tz || (typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC')

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

  // Same exact pipeline as bestHour (median USD per local-hour bucket) but
  // with the 3-session floor dropped to 1 — a lower-confidence "early
  // signal" candidate for when there isn't enough data yet for a confident
  // bestHour. Never shown as "Best Time" — always labeled Early Signal, per
  // the confidence-labeling rule (never present low-confidence data as fact).
  const earlySignalHour = !bestHour
    ? (Object.keys(hourTipsUSD)
        .map(h => ({ hour: h, avg: parseFloat(calcMedian(Object.values(hourBucketAmts[h])).toFixed(2)), total: hourTipsUSD[h], count: hourBucketSets[h].size }))
        .sort((a, b) => b.avg - a.avg)[0] || null)
    : null

  return { bestDay, worstDay, bestHour, earlySignalHour }
}

export function aggregateRows(tips, tz = null) {
  const userTz = tz || (typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC')

  if (!tips || tips.length === 0) {
    return {
      totalUSD: 0, totalTokens: 0, totalTips: 0, avgTipSize: 0,
      topTippers: [], platforms: [], sessions: [], insights: [],
      predictions: null, whales: [], whaleAlerts: [], lossAlerts: [], nextMoves: [],
      uniqueFanCount: 0,
      bestDay: null, bestHour: null, earlySignalHour: null, platformBestTimes: {},
      monthlyData: [], bestMonth: null, tipTypeBreakdown: [],
      privateShowFans: [], spyShowFans: [], earningsVelocity: null, totalStreamMinutes: 0,
      estimatedHourlyRate: 0, hourlyRateSessionCount: 0, hourlyRateTotalMinutes: 0,
      hourlyRateTotalUsd: 0, excludedUntimedSessionCount: 0,
      platformVelocity: {}, missedRevenue: { today_missed: null, cumulative_by_platform: {}, recent_streak_missed: null },
      returningVsNew: null, topFanDependency: null,
      dependencyRisk: null, sessionPerformance: null, latestPlatformDelta: null,
      bestPlatformByRate: null, rankablePlatformCount: 0,
      canonicalBestTimes: { grid: [], bestWindow: null, earlySignal: null }, bestWindowFanOverlap: null
    }
  }

  const sessions = detectSessions(tips)

  // ── SESSION QUALITY CLASSIFICATION ───────────────────────────────────
  // classifySession() itself now lives in lib/analytics/sessions.js
  // (imported as classifySessionQuality below) so other consumers — e.g.
  // StreamPlanner's migration off its own quality-agnostic session
  // population — use the exact same thresholds, not a second copy of them.
  const scoreSession = (s) => {
    const mins = s.durationMinutes || 0
    const usd  = s.totalUSD || 0
    const durationScore = Math.min(mins / 120, 1)
    const revenueScore  = Math.min(usd  / 100, 1)
    return parseFloat(((durationScore * 0.4) + (revenueScore * 0.6)).toFixed(3))
  }
  sessions.forEach(s => { s.sessionQuality = classifySessionQuality(s); s.sessionWeight = scoreSession(s) })

  const meaningfulSessions = sessions.filter(s => s.sessionQuality === 'meaningful')
  const allValidSessions   = sessions.filter(s => s.sessionQuality !== 'invalid')

  const { bestDay, worstDay, bestHour, earlySignalHour } = computeBestTimes(tips, userTz)

  const whales      = identifyWhales(tips, userTz)
  const insights    = generateInsights(tips, meaningfulSessions, bestDay, worstDay, bestHour, whales)
  const predictions = predictRevenue(tips, meaningfulSessions, userTz)
  const whaleAlerts = generateWhaleAlerts(whales)
  const lossAlerts  = generateLossAlerts(tips, meaningfulSessions, whales, bestHour, userTz)

  // Canonical account-wide best-time grid — session-based, median $/hour,
  // confidence-tiered (lib/analytics/bestTimes.js). generateNextMoves()'s
  // best-time dependency is repointed to this per canonical-analytics-
  // rules.md's Phase 1 scope; generateInsights()/generateLossAlerts() above
  // are intentionally NOT repointed in this pass — their bestHour usage is
  // out of Phase 1's approved scope (missed-revenue's peak_missed concept
  // is being replaced separately via lib/analytics/missedRevenue.js, not
  // patched in place here).
  const canonicalBestTimes = computeCanonicalBestTimes(meaningfulSessions, userTz)
  // Thin shape-adapter so generateNextMoves() doesn't need its own edit —
  // same { hour, avg } shape it already expects from computeBestTimes(),
  // now sourced from the canonical, confidence-gated bestWindow instead.
  const canonicalBestHourForNextMoves = canonicalBestTimes.bestWindow
    ? { hour: canonicalBestTimes.bestWindow.localHour, avg: canonicalBestTimes.bestWindow.medianUsdPerHour }
    : null
  const nextMoves   = generateNextMoves(tips, meaningfulSessions, whales, predictions, canonicalBestHourForNextMoves, userTz)

  // ── BEST-WINDOW FAN OVERLAP ──────────────────────────────────────────
  // Which of this creator's highest-value fans actually tip inside her
  // strongest earning window. Additive composition of two values that are
  // already canonical (canonicalBestTimes.bestWindow + identifyWhales) — it
  // introduces no new definition of "best window" or "fan value", and no
  // consumer recomputes either. Exposed so the Command Center can state the
  // relationship without doing this arithmetic in a component, which is the
  // pattern the analytics audit removed everywhere else.
  //
  // Counts a fan as overlapping when at least one of their tips lands in the
  // window's exact local day+hour bucket. Restricted to fans with >=3 tips so
  // a single coincidental tip cannot manufacture an "overlap".
  const bestWindowFanOverlap = canonicalBestTimes.bestWindow
    ? (() => {
        const w = canonicalBestTimes.bestWindow
        const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
        const matches = whales.filter(f => {
          if (f.tipCount < 3) return false
          return (f.tips || []).some(t => {
            const ts = t.dateRaw || t.date_time
            return DAYS[toLocalDow(ts, userTz)] === w.localDay && toLocalHour(ts, userTz) === w.localHour
          })
        })
        const sorted = [...matches].sort((a, b) => b.totalUSD - a.totalUSD)
        return {
          count: sorted.length,
          totalUSD: parseFloat(sorted.reduce((sum, f) => sum + (f.totalUSD || 0), 0).toFixed(2)),
          fans: sorted.slice(0, 3).map(f => ({ username: f.username, totalUSD: f.totalUSD, tipCount: f.tipCount })),
          // Lowercased usernames of EVERY overlapping fan (not just the top 3
          // shown in `fans`), so a per-fan surface can ask "is this fan one of
          // them?" without re-running the day+hour match itself. Membership
          // only — no new figure.
          usernames: sorted.map(f => f.username.toLowerCase()),
        }
      })()
    : null

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

  // Canonical best local day/hour per platform — reuses the same day×hour
  // grid/confidence-tier logic as the account-wide canonical best-time
  // calculation (lib/analytics/bestTimes.js), just scoped to this
  // platform's own meaningfulSessions, instead of StreamPlanner's retired
  // platformEfficiency() independently computing bestUtcDay/bestUtcHour.
  const platformBestWindow = {}
  Object.keys(platformMap).forEach(p => {
    const platSessions = meaningfulSessions.filter(s => s.platform === p)
    const { bestWindow } = computeCanonicalBestTimes(platSessions, userTz)
    platformBestWindow[p] = bestWindow
  })

  const platforms = Object.values(platformMap).map(p => ({
    ...p,
    usdPerHour:    p.hours > 0 ? parseFloat((p.totalUSD    / p.hours).toFixed(2)) : 0,
    tokensPerHour: p.hours > 0 ? Math.round( p.totalTokens / p.hours)             : 0,
    avgTipSize:    p.tips  > 0 ? parseFloat((p.totalUSD    / p.tips).toFixed(2))  : 0,
    bestLocalDay:  platformBestWindow[p.platform]?.localDay ?? null,
    bestLocalHour: platformBestWindow[p.platform]?.localHour ?? null,
    bestWindowConfidence: platformBestWindow[p.platform]?.tier ?? null,
  }))

  // ── BEST PLATFORM — ONE canonical answer ────────────────────────────
  // "Unknown" is the CSV parser's undetected-platform bucket (see
  // detectPlatform()), not a platform the creator streams on. It must never
  // be presented as their best or most profitable platform.
  //
  // On the owner's real account this was doing visible damage: 13 Unknown
  // tips totalling $175.60 average $13.51/tip, against Chaturbate's $0.36
  // and BongaCams' $0.20 across 7,635 tips — so any ranking by average tip
  // size crowned "Unknown". get_user_insights' best_platform does exactly
  // that (AVG(usd) per tip, HAVING COUNT(*) >= 5), which is why both the
  // command bar and the Creator Report read "Best Platform: Unknown".
  //
  // Ranked by usdPerHour — the same statistic every surface DISPLAYS
  // underneath the claim — and platforms with no measurable streamed hours
  // are excluded, because "most profitable per hour" is meaningless without
  // a denominator.
  const rankablePlatforms = platforms.filter(
    p => p.platform !== UNDETECTED_PLATFORM && p.usdPerHour > 0
  )
  const bestPlatformByRate = rankablePlatforms.length
    ? [...rankablePlatforms].sort((a, b) => b.usdPerHour - a.usdPerHour)[0]
    : null

  const topTippers = whales.map((w, i) => ({
    rank: i + 1, username: w.username, usd: w.totalUSD, tokens: w.totalTokens, count: w.tipCount,
    status: w.tier === 'Whale' ? '🐳 WHALE' : w.tier === 'Shark' ? '🦈 SHARK' : w.tier === 'Dormant' ? '💤 DORMANT' : '🐟 REGULAR',
    last: new Date(w.lastTipDate).toLocaleDateString(), first: new Date(w.firstTipDate).toLocaleDateString(),
    daysSince: w.daysSinceLastTip, tipProbability: w.tipProbability, churnRisk: w.churnRisk
  }))

  // ── PER-PLATFORM BEST TIMES ───────────────────────────────────────────
  // Audit checklist decision, documented once per "explicitly document
  // genuine deferrals" rather than left silent: this full per-platform
  // day×hour grid (bestHourByDay, allHours, allDays — what the Platforms
  // tab heatmap actually renders) is intentionally NOT migrated onto the
  // canonical bestTimes.js engine. Canonical's per-platform output today
  // (platforms[].bestLocalDay/bestLocalHour/bestWindowConfidence, added in
  // Phase 1) is single-window only — there is no legitimate existing UI
  // consumer of a single best window to simply repoint, and the checklist
  // explicitly forbids inventing one just to claim migration completion.
  // Extending computeCanonicalBestTimes() to emit a full grid (median-based,
  // session-level, local-native — instead of this block's mean-based,
  // tip-level, local-native grid) is real, separately-scoped follow-up
  // work: it needs its own test plan proving grid-shape parity across every
  // day×hour cell, not just the single top window bestTimes.js already
  // verifies. Deferred with this rationale, not silently left unexplained.
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

  // ── SESSION PERFORMANCE ─────────────────────────────────────────────────
  // "Which kinds of streams actually make me money?" — a median split of the
  // same rate-eligible population estimatedHourlyRate is built from
  // (hourlyRateSessions/isHourlyRateEligible above), not a new population or
  // a new definition of "session value." Two buckets (above/at-or-below the
  // median $/hr), not arbitrary tiers — a real computed split, not an
  // invented multiplier. Mirrors identifyWhales' percentile-based tiering,
  // the precedent for splitting a population by its own distribution rather
  // than a fixed threshold.
  const sessionPerformance = (() => {
    const avgMeaningfulSessionUSD = meaningfulSessions.length > 0
      ? parseFloat((meaningfulSessions.reduce((s, x) => s + x.totalUSD, 0) / meaningfulSessions.length).toFixed(2))
      : 0
    const timedMeaningful = meaningfulSessions.filter(s => !s.durationUnknown)
    const avgMeaningfulSessionMinutes = timedMeaningful.length > 0
      ? Math.round(timedMeaningful.reduce((s, x) => s + x.durationMinutes, 0) / timedMeaningful.length)
      : null

    if (hourlyRateSessions.length < 4) {
      return {
        avgMeaningfulSessionUSD, avgMeaningfulSessionMinutes,
        rateEligibleCount: hourlyRateSessions.length,
        distribution: null, // not enough rate-eligible sessions for a meaningful split
      }
    }
    const rates = hourlyRateSessions.map(s => s.totalUSD / (s.durationMinutes / 60))
    const medianRate = calcMedian(rates)
    const above = hourlyRateSessions.filter((s, i) => rates[i] > medianRate)
    const belowOrAt = hourlyRateSessions.filter((s, i) => rates[i] <= medianRate)
    const avgRate = (arr) => arr.length ? parseFloat((arr.reduce((s, x) => s + (x.totalUSD / (x.durationMinutes / 60)), 0) / arr.length).toFixed(2)) : 0
    return {
      avgMeaningfulSessionUSD, avgMeaningfulSessionMinutes,
      rateEligibleCount: hourlyRateSessions.length,
      distribution: {
        medianUsdPerHour: parseFloat(medianRate.toFixed(2)),
        aboveMedian: { count: above.length, avgUsdPerHour: avgRate(above) },
        belowOrAtMedian: { count: belowOrAt.length, avgUsdPerHour: avgRate(belowOrAt) },
      },
    }
  })()

  // Derived from platforms[].usdPerHour (computed once above from the same
  // platformMap) rather than recomputing totalUSD/hours a second time — the
  // two were previously independent implementations of the identical
  // formula over the identical inputs, which is exactly the duplicate-
  // calculation class this audit exists to remove. Kept as a separate
  // {platform: rate} map because several consumers index by platform name
  // (Smart Insights' top-platform pick, the Platform ROI card's `roi`, the
  // velocity strip) and reshaping all of them is churn without benefit.
  // The null-vs-0 distinction is preserved deliberately: null means "no
  // timed hours recorded, rate unknowable" (consumers filter on `!= null`
  // to hide the platform entirely), whereas platforms[].usdPerHour uses 0
  // for the same case because its consumers render a numeric cell.
  const platformVelocity = {}
  platforms.forEach(p => {
    platformVelocity[p.platform] = p.hours > 0 ? p.usdPerHour : null
  })

  // ── MISSED REVENUE ───────────────────────────────────────────────────
  // Canonical: lib/analytics/missedRevenue.js. This replaces the legacy
  // missedRevenueByPlatform that used to be computed inline here.
  //
  // The legacy version had a genuine unit mismatch: it subtracted a MEAN
  // $/SESSION (platSessions totalUSD / count) from a MEDIAN $/HOUR
  // (platformBestTimes' hour-bucket figure) and multiplied the difference by
  // a session count — three incompatible units in one expression. A 3-hour
  // session and a 20-minute session contributed identically to the "per
  // session" side while the other side was a rate. The canonical version
  // subtracts median $/hour from median $/hour, so the difference is a real
  // rate gap.
  //
  // Its previously-documented deferral reason — that migrating this without
  // the platformBestTimes grid would leave "the Platform tab internally
  // inconsistent (a missed-revenue figure computed against a different best
  // hour than the heatmap right next to it)" — was factually wrong: the
  // missed-revenue card renders on the OVERVIEW tab, not beside the Platforms
  // heatmap. Nothing is adjacent to contradict, and the Platform ROI card's
  // own "Best window" badge already reads the canonical per-platform window,
  // so this migration increases consistency rather than splitting it.
  const missedRevenue = computeMissedRevenue(meaningfulSessions, userTz)

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

  // ── REVENUE DEPENDENCY RISK ───────────────────────────────────────────
  // A severity label + factual restatement over topFanDependency's
  // already-computed percentages. No new statistic is derived here — every
  // number below comes from the block immediately above.
  //
  // Previously this was hardcoded `null` while app/dashboard/page.js
  // carried a full "Revenue Dependency Risk" card gated on it, so that card
  // could never render. Worse, the Smart Insights block explicitly defers
  // the concentration-risk framing to this card ("that card owns the
  // concentration-risk claim"), so the insight was reaching users nowhere
  // at all — while /guides/chaturbate-earnings-tracker, several blog posts,
  // and the /landing/demo page all advertise exactly this feature.
  //
  // Thresholds come from this product's own published editorial standard
  // rather than being invented here: the 50%-from-one-fan line appears in
  // app/blog/how-to-increase-cam-earnings ("if one fan contributed 50%+ of
  // a session's income, that's a concentration risk") and
  // app/blog/how-to-re-engage-whales-and-high-tipping-fans ("just 1-3
  // people represent 50%+ of total earnings"). Cross-checked against
  // app/landing/demo's own characterization of top1=42%/top3=72% as
  // "Moderate concentration" — those exact inputs classify as 'medium'
  // here, so the dashboard and the marketing demo cannot contradict.
  //
  // Sample-size guard: below 5 unique fans these percentages are
  // arithmetically trivial (with 4 fans, top5Pct is always 100%), so no
  // claim is made at all — returning null hides the card rather than
  // telling a creator with 3 fans that she has "high risk". 5 is the same
  // unique-fan threshold DashboardPreview.js's canShowWhales() already
  // uses to gate whale-related surfaces, not a new number.
  const DEPENDENCY_MIN_FANS = 5
  const dependencyRisk = (topFanDependency && whales.length >= DEPENDENCY_MIN_FANS)
    ? (() => {
        const { top1Pct, top3Pct, top5Pct, lossIfTopFanLeaves } = topFanDependency
        const level = (top1Pct >= 50 || top3Pct >= 80) ? 'high'
                    : (top1Pct >= 30 || top3Pct >= 60) ? 'medium'
                    : 'low'
        const message =
          level === 'high'
            ? `Your top fan is ${top1Pct}% of all revenue. If they stopped tipping, that's $${lossIfTopFanLeaves.toFixed(2)} of your $${totalUSD.toFixed(2)} lifetime total.`
            : level === 'medium'
              ? `Your top 3 fans are ${top3Pct}% of all revenue, and your top fan alone is ${top1Pct}%. Widening your tipping base lowers what one fan's departure costs you.`
              : `Your revenue is spread across your fan base — your top fan is ${top1Pct}% and your top 5 are ${top5Pct}% of the total.`
        return { level, message, top1Pct, top3Pct, top5Pct, lossIfTopFanLeaves, fanCount: whales.length }
      })()
    : null

  // ── MONTHLY DATA ──────────────────────────────────────────────────────
  // Canonical: creator-local calendar month, not UTC — see
  // canonical-analytics-rules.md's Monthly-Growth Reconciliation for why
  // (consistency with every other now-local-native rule; a UTC boundary can
  // misattribute a tip to the wrong month from the creator's own lived
  // perspective). This is the single source of truth page.js's inline
  // momentum block and DashboardGrowthCharts.js should read from instead of
  // independently recomputing.
  const monthMap = {}
  const monthKeyLocal = (dateStr) => {
    const local = toLocalDateStr(dateStr, userTz) // YYYY-MM-DD
    return local ? local.slice(0, 7) : null // YYYY-MM
  }
  tips.forEach(t => {
    const dt = new Date(t.dateRaw || t.date_time)
    if (isNaN(dt.getTime())) return
    const key = monthKeyLocal(t.dateRaw || t.date_time)
    if (!key) return
    if (!monthMap[key]) monthMap[key] = { usd: 0, tips: 0, fans: new Set(), sessions: 0, hourlyUsd: 0, hourlyMinutes: 0 }
    monthMap[key].usd += t.usd || 0
    monthMap[key].tips += 1
    monthMap[key].fans.add(t.username.toLowerCase())
  })
  // Sessions: bucketed from meaningfulSessions, the same population
  // meaningfulSessionCount (the account-wide "Sessions" figure everywhere
  // else — Command Center, the relocated Overview cards) is built from. This
  // used to bucket from allValidSessions, a superset that also counts
  // low_signal sessions — so a per-month "Sessions" figure here could never
  // sum to the one account-wide total the rest of the app shows under the
  // same unlabeled word. No consumer read the old field for its exact
  // value (verified: DashboardGrowthCharts and the momentum block only ever
  // read .usd/.growthPct/.month), so this corrects the population without
  // changing any number a screen was already relying on.
  meaningfulSessions.forEach(s => {
    const key = monthKeyLocal(s.startTime)
    if (key && monthMap[key]) monthMap[key].sessions += 1
  })
  // Hours + $/hour: bucketed from hourlyRateSessions, the EXACT population
  // estimatedHourlyRate is built from (isHourlyRateEligible, defined above)
  // — so a month's usdPerHour uses the same eligibility rule and the same
  // weighted numerator/denominator as the account-wide rate, not a second
  // implementation of "hourly rate."
  hourlyRateSessions.forEach(s => {
    const key = monthKeyLocal(s.startTime)
    if (key && monthMap[key]) {
      monthMap[key].hourlyUsd += s.totalUSD
      monthMap[key].hourlyMinutes += s.durationMinutes
    }
  })
  const monthlyDataUnsorted = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({
    month, usd: parseFloat(d.usd.toFixed(2)), tips: d.tips, fans: d.fans.size, sessions: d.sessions,
    usdPerFan: d.fans.size > 0 ? parseFloat((d.usd / d.fans.size).toFixed(2)) : 0,
    hours: parseFloat((d.hourlyMinutes / 60).toFixed(2)),
    usdPerHour: d.hourlyMinutes > 0 ? parseFloat((d.hourlyUsd / (d.hourlyMinutes / 60)).toFixed(2)) : null,
  }))
  // growthPct computed here once, canonically, so consumers (page.js's
  // momentum block, DashboardGrowthCharts.js) never need their own copy of
  // this formula. Reused for every metric Performance's "What changed?"
  // section compares — earnings, $/hour, hours, sessions, fans — through
  // one function instead of five separate percent-change implementations.
  //
  // monthMap only contains months with actual tip data (see the forEach
  // above — a month with zero tips never gets a key), so `prev` here is the
  // previous ACTIVE month, not necessarily the previous CALENDAR month. A
  // 4-month gap with zero activity, followed by one small tip, can produce a
  // mathematically correct but wildly misleading growthPct (e.g. 2,883%) if
  // displayed as plain "monthly growth" with no indication of the gap.
  // gapMonths lets consumers show that context instead of a bare percentage.
  const monthIndex = (ym) => { const [y, mo] = ym.split('-').map(Number); return y * 12 + mo }
  const pctChange = (cur, prev) => (cur == null || prev == null || prev === 0) ? null : Math.round(((cur - prev) / prev) * 100)
  const monthlyData = monthlyDataUnsorted.map((m, i) => {
    const prev = i > 0 ? monthlyDataUnsorted[i - 1] : null
    const growthPct = prev && prev.usd > 0 ? Math.round(((m.usd - prev.usd) / prev.usd) * 100) : null
    const gapMonths = prev ? monthIndex(m.month) - monthIndex(prev.month) - 1 : null
    return {
      ...m, growthPct, prevMonth: prev?.month || null, gapMonths,
      usdPerHourGrowthPct: prev ? pctChange(m.usdPerHour, prev.usdPerHour) : null,
      hoursGrowthPct: prev ? pctChange(m.hours, prev.hours) : null,
      sessionsGrowthPct: prev ? pctChange(m.sessions, prev.sessions) : null,
      fansGrowthPct: prev ? pctChange(m.fans, prev.fans) : null,
    }
  })
  const bestMonth = monthlyData.length > 0 ? [...monthlyData].sort((a, b) => b.usd - a.usd)[0] : null

  // ── LATEST-PERIOD PLATFORM ATTRIBUTION ──────────────────────────────────
  // "Which platform drove the change?" — scoped to just the two most recent
  // ACTIVE months (the same pair monthlyData's own growthPct compares), not
  // a full per-platform time series. Built from the same tips already
  // grouped into monthMap above; platform is read off each tip directly, so
  // this introduces no new session/session-quality population.
  const latestPlatformDelta = (() => {
    if (monthlyData.length < 2) return null
    const cur = monthlyData[monthlyData.length - 1]
    const prev = monthlyData[monthlyData.length - 2]
    const byPlatform = {}
    tips.forEach(t => {
      const key = monthKeyLocal(t.dateRaw || t.date_time)
      if (key !== cur.month && key !== prev.month) return
      const p = t.platform || 'Unknown'
      if (!byPlatform[p]) byPlatform[p] = { platform: p, curUSD: 0, prevUSD: 0 }
      byPlatform[p][key === cur.month ? 'curUSD' : 'prevUSD'] += t.usd || 0
    })
    const totalDeltaUSD = cur.usd - prev.usd
    const rows = Object.values(byPlatform)
      .map(p => ({
        platform: p.platform,
        curUSD: parseFloat(p.curUSD.toFixed(2)),
        prevUSD: parseFloat(p.prevUSD.toFixed(2)),
        deltaUSD: parseFloat((p.curUSD - p.prevUSD).toFixed(2)),
      }))
      .sort((a, b) => Math.abs(b.deltaUSD) - Math.abs(a.deltaUSD))
    return { curMonth: cur.month, prevMonth: prev.month, totalDeltaUSD: parseFloat(totalDeltaUSD.toFixed(2)), gapMonths: cur.gapMonths, platforms: rows }
  })()

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
    predictions, whaleAlerts, lossAlerts, nextMoves, whales,
    // Canonical unique-fan count — identifyWhales() returns exactly one
    // entry per unique username in `tips` (see its allFans.map at the end),
    // so its length IS the unique fan count, not just "whale" fans despite
    // the function name. This is the single source every "Total Fans" /
    // fan-count consumer should read (app/dashboard/page.js previously read
    // a same-named field that was never actually returned here, and
    // separately a "Total Fans" KPI card read whales.length directly instead
    // of a canonical field — both are migrated to this in the same pass).
    uniqueFanCount: whales.length,
    bestDay, bestHour, earlySignalHour, platformBestTimes,
    monthlyData, bestMonth,
    tipTypeBreakdown, privateShowFans, spyShowFans,
    earningsVelocity, totalStreamMinutes, platformVelocity,
    estimatedHourlyRate, hourlyRateSessionCount, hourlyRateTotalMinutes,
    hourlyRateTotalUsd, excludedUntimedSessionCount,
    missedRevenue, returningVsNew, topFanDependency, dependencyRisk, bestWindowFanOverlap,
    // preTipBehavior and trueHourlyAvg intentionally removed rather than
    // left as permanently-null keys. preTipBehavior's dashboard card was
    // deleted in the same pass: its "peak tipping window" duplicated
    // canonicalBestTimes.bestWindow (the single source every other
    // best-time surface was just consolidated onto), and its
    // clusteringDetected/recommendation fields had no definition anywhere
    // in the codebase — implementing them would have meant inventing
    // unsupported metrics. trueHourlyAvg was never actually read by the
    // per-platform hourly heatmap that a stale comment claimed used it
    // (that heatmap reads platformTimes[platform].hours); it was a dead
    // key with a misleading pointer.
    meaningfulSessions, allValidSessions, sessionPerformance, latestPlatformDelta,
    bestPlatformByRate, rankablePlatformCount: rankablePlatforms.length,
    meaningfulSessionCount: meaningfulSessions.length,
    lowSignalSessionCount: allValidSessions.length - meaningfulSessions.length,
    momentum,
    // Canonical best-time grid (lib/analytics/bestTimes.js) — session-based,
    // median $/hour, confidence-tiered, local-native timezone. Exposed here
    // for consumers migrating per canonical-analytics-rules.md; bestDay/
    // bestHour/platformBestTimes above are computeBestTimes()'s existing
    // tip-level output, kept unchanged as a reference implementation, not
    // yet the operative path for any UI surface — that migration is tracked
    // separately per the approved consumer migration order.
    canonicalBestTimes,
  }
}

// ============================================================
// PAID SESSION ANALYTICS
// Operates on rows from the paid_sessions table (BongaCams).
// Completely separate from tip analytics — never mixed.
// ============================================================

export function computePaidSessionAnalytics(sessions, tz = 'UTC') {
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
    const h = toLocalHour(s.date_time, tz)
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
    const key = toLocalDateStr(s.date_time, tz).slice(0, 7)
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

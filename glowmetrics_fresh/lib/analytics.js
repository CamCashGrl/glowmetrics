// ============================================
// CAMCASH COMPLETE ANALYTICS ENGINE
// ============================================

// Token rates live in ONE place — lib/constants.js
// Do not define rates here. Import only.
import { PLATFORM_TOKEN_RATES, DEFAULT_TOKEN_RATE, tokenRate, canonicalPlatform } from './constants'
// Session grouping lives in ONE place — lib/analytics/sessions.js
// Shared with app/live/page.js. Do not redefine this logic here.
import { detectSessions, SESSION_GAP_MS, isValidSession } from './analytics/sessions'

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

// Building an Intl.DateTimeFormat is expensive; constructing one per tip made
// aggregateRows take 10–36s on ~12k tips (#667). Reuse one per (kind, tz).
// Same locale and options as before, so output is unchanged; an invalid tz
// still throws from the constructor into each caller's existing catch.
const localTimeFormatters = new Map()
function localTimeFormatter(kind, tz, locale, options) {
  const key = `${kind}|${tz}`
  let fmt = localTimeFormatters.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { timeZone: tz, ...options })
    localTimeFormatters.set(key, fmt)
  }
  return fmt
}

export function toLocalHour(dateStr, tz) {
  try {
    const date = new Date(dateStr)
    const formatted = localTimeFormatter('hour', tz, 'en-US', {
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
    const dayName = localTimeFormatter('weekday', tz, 'en-US', {
      weekday: 'long'
    }).format(date)
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
      .indexOf(dayName)
  } catch { return new Date(dateStr).getUTCDay() }
}

function toLocalDateStr(dateStr, tz) {
  try {
    return localTimeFormatter('date', tz, 'en-CA', {}).format(new Date(dateStr)) // returns YYYY-MM-DD
  } catch { return new Date(dateStr).toISOString().slice(0, 10) }
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
const CB_DATE_LINE_RE = /^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i
const CB_TIP_FROM_RE = /^Tip From:\s*(.+)$/i
// Fan Club Membership purchases are real earnings from a named fan, same as
// a tip — mirrors app/onboarding/page.js's parseRows(), which handles the
// same three Chaturbate paste cases for the client-side preview. Kept in
// sync manually (see the comment there) since this is the separate parser
// used server-side for direct CSV-file uploads of the same raw export.
const CB_FAN_CLUB_RE = /^Fan Club Membership:\s*(.+)$/i
// Not earnings from a fan at all — an account-level token debit/cashout —
// so it must never fall through to the generic multi-line date match below
// and get treated as an unrecognized (but still date-stamped) tip block.
const CB_NON_EARNING_ACTION_RE = /^(Admin Adjustment|Transfer tokens to)\b/i
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
    if (CB_PRIVATE_SHOW_PATTERN.test(actionLine)) { i++; continue }
    if (CB_NON_EARNING_ACTION_RE.test(actionLine)) { i++; continue }
    const tipMatch = actionLine.match(CB_TIP_FROM_RE)
    const fanClubMatch = !tipMatch && actionLine.match(CB_FAN_CLUB_RE)
    if (!tipMatch && !fanClubMatch) { i++; continue }

    const username = (tipMatch ? tipMatch[1] : fanClubMatch[1]).trim()
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
        if (fanClubMatch) note = note ? `Fan Club Membership: ${note}` : 'Fan Club Membership'
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

// Numeric dates like 06/11/2024 can be June 11 or 6 November. JS Date reads
// them month-first, so a day-first export lands on the wrong dates (and a
// re-import of the same tips no longer dedups against the originals). The
// order is decided per file from its own unambiguous dates, never guessed:
//   'DMY'       some date has a first number > 12
//   'MDY'       some date has a second number > 12
//   'conflict'  both appear — the file mixes formats
//   'ambiguous' every date could be either — the user must choose
//   null        no such dates (ISO, dotted BongaCams, epoch, etc.)
const NUMERIC_DATE_RE = /(?:^|[\s",;\t])(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?=$|[\s",;\tT])/g
export function detectDateOrder(text) {
  let dmy = false, mdy = false, seen = false
  for (const m of String(text || '').matchAll(NUMERIC_DATE_RE)) {
    const a = Number(m[1]), b = Number(m[2])
    if (a < 1 || b < 1 || a > 31 || b > 31) continue
    seen = true
    if (a > 12) dmy = true
    if (b > 12) mdy = true
  }
  if (!seen) return null
  if (dmy && mdy) return 'conflict'
  if (dmy) return 'DMY'
  if (mdy) return 'MDY'
  return 'ambiguous'
}

let activeDateOrder = null

export function parseCSV(text, platform = null, { dateOrder = null } = {}) {
  activeDateOrder = dateOrder === 'DMY' || dateOrder === 'MDY' ? dateOrder : null
  try {
    return parseCSVInner(text, platform)
  } finally {
    activeDateOrder = null
  }
}

function parseCSVInner(text, platform) {
  let allLines = text.trim().split('\n')
  if (allLines.length === 0) return []

  if (!platform) platform = detectPlatform(text)
  const delimiter = detectDelimiter(text)
  if (!delimiter) console.warn('[parseCSV] Could not detect delimiter; defaulting to comma')
  const detectedDelimiter = delimiter || ','
  allLines = joinStackedHeaderLines(allLines, detectedDelimiter)

  if (allLines.some(l => CB_TIP_FROM_RE.test(l.trim()) || CB_FAN_CLUB_RE.test(l.trim()))) {
    return parseChaturbateMultiLine(allLines).map(normalizeTip).filter(isValidTip)
  }

  let startIdx = 0
  for (let i = 0; i < Math.min(5, allLines.length); i++) {
    const cols = parseCSVLine(allLines[i], detectedDelimiter)
    if (cols.filter(c => c.trim()).length >= 2) { startIdx = i; break }
  }

  const lines = allLines.slice(startIdx).filter(l => l.trim())
  if (lines.length === 0) return []
  const firstCols = parseCSVLine(lines[0], detectedDelimiter)
  const firstColIsDate = /^\d{2}[.\-/]\d{2}[.\-/]\d{4}/.test(firstCols[0]) ||
                         /^\d{4}[.\-/]\d{2}[.\-/]\d{2}/.test(firstCols[0]) ||
                         /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(firstCols[0]) ||
                         /^\d{10,13}$/.test(firstCols[0])
  const KNOWN_HEADER_FIELDS = new Set(['date_time','username','tokens','usd','tip_type','action','note','platform','session_id','token_balance'])
  const hasHeaders = !firstColIsDate && firstCols.some(c => KNOWN_HEADER_FIELDS.has(normalizeHeaderName(c)))
  const raw = hasHeaders ? parseWithHeaders(lines, platform, detectedDelimiter) : parseHeaderless(lines, platform, detectedDelimiter)
  raw.forEach(r => {
    if (r.platform && r.platform !== 'Unknown') return
    if (/tip from:/i.test(text)) { r.platform = 'Chaturbate'; return }
    if (/^\d{2}\.\d{2}\.\d{4}/.test(r.dateRaw || '')) { r.platform = 'BongaCams'; return }
    if (/^\d{10,13}$/.test(String(r.dateRaw || '').trim())) { r.platform = 'MyFreeCams'; return }
  })
  return raw.map(normalizeTip).filter(isValidTip)
}

function joinStackedHeaderLines(lines, delimiter) {
  let i = 0
  const headerCells = []
  while (i < lines.length && i < 10) {
    const line = lines[i].trim()
    if (!line) break
    if (parseCSVLine(line, delimiter).length !== 1) break
    headerCells.push(line)
    i++
  }
  if (headerCells.length < 2) return lines
  const dataLine = (lines[i] || '').trim()
  if (!dataLine) return lines
  if (parseCSVLine(dataLine, delimiter).length !== headerCells.length) return lines
  return [headerCells.join(delimiter), ...lines.slice(i)]
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
  if (lower.includes('chaturbate') || lower.includes('tip from:') || lower.includes('token balance') || lower.includes('token change')) return 'Chaturbate'
  if (lower.includes('bongacams') || lower.includes('bonga') || lower.includes('your payout')) return 'BongaCams'
  if (lower.includes('myfreecams') || lower.includes('mfc')) return 'MyFreeCams'
  if (lower.includes('stripchat')) return 'Stripchat'
  if (lower.includes('camsoda')) return 'CamSoda'
  if (/^\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}/m.test(text)) return 'BongaCams'
  if (/^\d{10,13}\t/m.test(text)) return 'MyFreeCams'
  return 'Unknown'
}

function normalizeDate(raw) {
  if (!raw) return null
  raw = raw.replace(/\b(\d{1,2})(st|nd|rd|th)\b/i, '$1')
  const euro = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}:\d{2}))?/)
  if (euro) return `${euro[2]}/${euro[1]}/${euro[3]}${euro[4] ? ' ' + euro[4] : ''}`
  if (activeDateOrder) {
    const num = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(.*)/)
    if (num) {
      const [d, m] = activeDateOrder === 'DMY' ? [num[1], num[2]] : [num[2], num[1]]
      const rest = num[4].replace('T', ' ').replace('Z', '').trim()
      return `${num[3]}-${m.padStart(2, '0')}-${d.padStart(2, '0')} ${rest || '00:00'}`
    }
  }
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
  if (['transaction_type','chat_type','tip_type','type','session_type','activity_type','show_type','paid_chat_type'].includes(clean)) return 'tip_type'
  if (clean === 'action') return 'action'
  if (clean === 'note') return 'note'
  if (clean === 'platform') return 'platform'
  if (clean === 'session_id') return 'session_id'
  return clean
}

function re_clean(h) {
  return h.toLowerCase().trim().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

function parseCSVLine(line, delimiter = ',') {
  const trimmed = line.trim()
  if (delimiter === ',' && trimmed.startsWith('"') && trimmed.endsWith('"') && !trimmed.slice(1, -1).includes('"')) {
    return trimmed.slice(1, -1).split(',').map(v => v.trim())
  }
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') { inQuotes = !inQuotes }
    else if (char === delimiter && !inQuotes) { result.push(current.trim().replace(/^"|"$/g, '')); current = '' }
    else { current += char }
  }
  result.push(current.trim().replace(/^"|"$/g, ''))
  return result
}

function detectDelimiter(text) {
  const lines = text.trim().split('\n').slice(0, 10)
  if (lines.length === 0) return ','
  let commaCount = 0
  let tabCount = 0
  for (const line of lines) {
    if (!line.trim()) continue
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') inQuotes = !inQuotes
      else if (!inQuotes) {
        if (char === ',') commaCount++
        if (char === '\t') tabCount++
      }
    }
  }
  if (tabCount > 0 && tabCount >= commaCount) return '\t'
  if (commaCount > 0) return ','
  return null
}

const BC_PAID_CHAT_TYPES = ['Private Chat', 'Full-Private Chat', 'Group Chat', 'Spy Mode']
const CB_PRIVATE_SHOW_PATTERN = /^Private Show:/i
const MFC_PRIVATE_TYPE = 'Private'

function parseWithHeaders(lines, platform, delimiter = ',') {
  const rawHeaders = parseCSVLine(lines[0], delimiter)
  const headers = rawHeaders.map(normalizeHeaderName)
  const results = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const vals = parseCSVLine(line, delimiter)
    const row = {}
    headers.forEach((h, idx) => { row[h] = (vals[idx] ?? '').trim() })

    const action = (row.action || '')
    const actionLower = action.toLowerCase()
    const tipType = (row.tip_type || '').toLowerCase()
    const bcPaidChatType = BC_PAID_CHAT_TYPES.find(t => t.toLowerCase() === tipType) || null
    const cbIsPrivateShow = CB_PRIVATE_SHOW_PATTERN.test(action)
    const mfcIsPrivate = tipType === MFC_PRIVATE_TYPE.toLowerCase()

    if (actionLower.includes('transfer') || actionLower.includes('cash') ||
        actionLower.includes('outbound tip') || actionLower.includes('promoted room') ||
        actionLower.includes('referral')) continue

    if (tipType && !tipType.includes('tip') && !tipType.includes('private') &&
        !tipType.includes('spy') && !tipType.includes('show') && !tipType.includes('chat') &&
        !tipType.includes('received') && !tipType.includes('freechat') &&
        !tipType.includes('sale')) continue

    if (tipType.includes('cash') || tipType.includes('transfer') || tipType.includes('payout') || tipType.includes('refund')) continue

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
        : canonicalPlatform(row.platform) || platform)
      : platform

    const isPaidSession = bcPaidChatType || cbIsPrivateShow || mfcIsPrivate
    const sessionTypeValue = bcPaidChatType || (cbIsPrivateShow ? 'Private Show' : (mfcIsPrivate ? 'Private' : null))

    results.push({
      dateRaw, date_time: dateRaw, username,
      platform: rowPlatform || 'Unknown',
      tokens: tokens > 0 ? tokens : Math.round(usd / tokenRate(rowPlatform)),
      usd: usd > 0 ? parseFloat(usd.toFixed(2)) : parseFloat((tokens * tokenRate(rowPlatform)).toFixed(2)),
      tip_type: sessionTypeValue || 'Tip',
      tip_note: row.note || row.tip_note || '',
      ...(isPaidSession ? { is_paid_session: true, session_type: sessionTypeValue } : {}),
    })
  }
  return results
}

function parseHeaderless(lines, platform, delimiter = ',') {
  const results = []
  for (const line of lines) {
    if (!line.trim()) continue
    const vals = parseCSVLine(line, delimiter)
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

    if (vals.length >= 5 && /^\d{10,13}$/.test(vals[0])) {
      const dateRaw = normalizeDate(vals[1])
      const username = (vals[3] || '').trim()
      const tokens = parseInt(vals[2]) || 0
      const typeVal = (vals[4] || 'Tip').trim()
      if (!username || tokens <= 0) continue
      if (!dateRaw || isNaN(new Date(dateRaw).getTime())) continue
      const isPrivate = typeVal.toLowerCase() === MFC_PRIVATE_TYPE.toLowerCase()
      results.push({
        dateRaw, date_time: dateRaw, username, platform: 'MyFreeCams',
        tokens, usd: parseFloat((tokens * tokenRate('MyFreeCams')).toFixed(2)),
        tip_type: isPrivate ? 'Private' : 'Tip', tip_note: '',
        ...(isPrivate ? { is_paid_session: true, session_type: 'Private' } : {}),
      })
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

function fanKey(platform, username) {
  const normalized = (username || '').trim().toLowerCase().replace(/^@+/, '')
  return `${platform || 'Unknown'}:${normalized}`
}

function groupFanVisits(tips) {
  if (!tips || tips.length === 0) return []
  const sorted = [...tips]
    .map(t => ({ ...t, _ts: new Date(t.dateRaw || t.date_time) }))
    .filter(t => !isNaN(t._ts.getTime()))
    .sort((a, b) => a._ts - b._ts)
  if (sorted.length === 0) return []
  const visits = []
  let cur = null
  sorted.forEach(t => {
    if (!cur) cur = { startTime: t._ts, endTime: t._ts, tips: [t] }
    else if (t._ts - cur.endTime <= SESSION_GAP_MS) { cur.endTime = t._ts; cur.tips.push(t) }
    else { visits.push(cur); cur = { startTime: t._ts, endTime: t._ts, tips: [t] } }
  })
  if (cur) visits.push(cur)
  return visits.map(v => ({ startTime: v.startTime, endTime: v.endTime, tipCount: v.tips.length, totalUSD: parseFloat(v.tips.reduce((s, t) => s + (t.usd || 0), 0).toFixed(2)) }))
}

const FAN_MIN_TIPS_FOR_BASELINE = 3
const FAN_MIN_OBSERVATIONS_FOR_BASELINE = 3
const RISK_SIGNALS_PAUSE_DAYS = 60
const DATA_STALE_GAP_DAYS = 14

export function getPlatformRiskContext(tips, meaningfulSessions = []) {
  const now = Date.now()
  const platforms = new Set()
  tips.forEach(t => platforms.add(t.platform || 'Unknown'))
  meaningfulSessions.forEach(s => platforms.add(s.platform || 'Unknown'))
  const ctx = {}
  platforms.forEach(p => {
    const platTips = tips.filter(t => (t.platform || 'Unknown') === p)
    const platSessions = meaningfulSessions.filter(s => (s.platform || 'Unknown') === p)
    const lastTipMs = platTips.length ? Math.max(...platTips.map(t => new Date(t.dateRaw || t.date_time).getTime())) : null
    const lastSessionMs = platSessions.length ? Math.max(...platSessions.map(s => new Date(s.startTime).getTime())) : null
    const lastTipDaysAgo = lastTipMs !== null && !isNaN(lastTipMs) ? Math.floor((now - lastTipMs) / 86400000) : null
    const lastMeaningfulSessionDaysAgo = lastSessionMs !== null && !isNaN(lastSessionMs) ? Math.floor((now - lastSessionMs) / 86400000) : null
    const riskSignalsPaused = lastMeaningfulSessionDaysAgo === null || lastMeaningfulSessionDaysAgo > RISK_SIGNALS_PAUSE_DAYS
    const dataNeedsUpdating = !riskSignalsPaused && lastTipDaysAgo !== null && (lastTipDaysAgo - lastMeaningfulSessionDaysAgo) > DATA_STALE_GAP_DAYS
    ctx[p] = { platform: p, riskSignalsPaused, dataNeedsUpdating, lastMeaningfulSessionDaysAgo, lastTipDaysAgo, dataAgeDays: lastTipDaysAgo }
  })
  return ctx
}

function calcFanBehavioralState({ daysSinceLastTip, avgDaysBetweenTips, observationCount, spendDeclineRatio, platformCtx }) {
  if (observationCount < FAN_MIN_OBSERVATIONS_FOR_BASELINE) {
    if (observationCount <= 0) return { state: 'Insufficient Data', reason: 'No tip history yet.' }
    if (daysSinceLastTip <= 45) return { state: 'New/Developing', reason: `Only ${observationCount} visit${observationCount === 1 ? '' : 's'} so far — too early to assess a pattern.` }
    return { state: 'Insufficient Data', reason: `Only ${observationCount} visit${observationCount === 1 ? '' : 's'} on record and no recent activity — not enough history to assess behavior.` }
  }
  const r = avgDaysBetweenTips > 0 ? daysSinceLastTip / avgDaysBetweenTips : (daysSinceLastTip > 0 ? Infinity : 0)
  const hasSpendDecline = spendDeclineRatio !== null && spendDeclineRatio !== undefined && spendDeclineRatio <= 0.5
  const stillOnSchedule = r < 1 && !hasSpendDecline
  const evidenceOfDecline = r >= 2 || hasSpendDecline
  const creatorEligible = !!platformCtx && !platformCtx.riskSignalsPaused && !platformCtx.dataNeedsUpdating
  if (!creatorEligible) {
    if (stillOnSchedule) return { state: 'Active', reason: 'Tipping on their normal schedule.' }
    const reason = !platformCtx || platformCtx.riskSignalsPaused
      ? "Creator hasn't had meaningful activity on this platform recently, so this fan's absence can't be attributed to fan decline."
      : "This platform's fan/tip data may be behind the creator's recent activity, so current behavior may not be complete."
    return { state: 'Dormant', reason }
  }
  if (stillOnSchedule) return { state: 'Active', reason: 'Tipping on their normal schedule.' }
  if (evidenceOfDecline) {
    const reason = hasSpendDecline && r < 2
      ? "Tip amounts have dropped well below this fan's own baseline while the creator remains active on this platform."
      : `Hasn't tipped in ${Math.round(daysSinceLastTip)} days vs. their usual ~${Math.round(avgDaysBetweenTips)}-day pattern.`
    return { state: 'At Risk', reason }
  }
  return { state: 'Watch', reason: "Some deviation from this fan's normal pattern, but not enough evidence yet to call it at risk." }
}

function legacyChurnRiskShape(state) {
  switch (state) {
    case 'Active': return { level: 'Low', risk: 'Active' }
    case 'Watch': return { level: 'Medium', risk: 'Watch closely' }
    case 'At Risk': return { level: 'High', risk: 'At risk' }
    case 'Dormant': return { level: 'Dormant', risk: 'Dormant' }
    default: return { level: 'Unknown', risk: 'Insufficient data' }
  }
}

export function identifyWhales(tips, meaningfulSessions = [], userTz = 'UTC') {
  const fanMap = {}
  tips.forEach(t => {
    const key = fanKey(t.platform, t.username)
    if (!fanMap[key]) fanMap[key] = { username: t.username, totalUSD: 0, totalTokens: 0, tipCount: 0, tips: [], platform: t.platform, tipNotes: [] }
    fanMap[key].totalUSD += t.usd || 0
    fanMap[key].totalTokens += t.tokens || 0
    fanMap[key].tipCount += 1
    fanMap[key].tips.push(t)
    if (t.tip_note) fanMap[key].tipNotes.push(t.tip_note)
  })
  const allFans = Object.values(fanMap)
  const sorted = [...allFans].sort((a, b) => b.totalUSD - a.totalUSD)
  const totalFans = sorted.length
  const rankByFanKey = new Map(sorted.map((s, i) => [fanKey(s.platform, s.username), i]))
  const platformRiskContext = getPlatformRiskContext(tips, meaningfulSessions)

  return allFans.map(f => {
    const fanSorted = [...f.tips].sort((a, b) => new Date(b.dateRaw || b.date_time) - new Date(a.dateRaw || a.date_time))
    const lastTipDate = new Date(fanSorted[0].dateRaw || fanSorted[0].date_time)
    const firstTipDate = new Date(fanSorted[fanSorted.length - 1].dateRaw || fanSorted[fanSorted.length - 1].date_time)
    const daysSinceLastTip = Math.floor((Date.now() - lastTipDate) / 86400000)
    const lifetimeDays = Math.max(Math.floor((lastTipDate - firstTipDate) / 86400000), 1)
    const rawAvgDaysBetweenTipsForTier = f.tipCount > 1 ? Math.max(1, lifetimeDays / (f.tipCount - 1)) : 30
    const biggestTip = Math.max(...f.tips.map(t => t.usd))
    const fanRankIndex = rankByFanKey.get(fanKey(f.platform, f.username))
    const percentileRank = totalFans > 1 ? fanRankIndex / (totalFans - 1) : 0
    let tier = 'Regular'
    if (percentileRank <= 0.05) tier = 'Whale'
    else if (percentileRank <= 0.20) tier = 'Shark'
    else if (f.tipCount < FAN_MIN_TIPS_FOR_BASELINE) tier = 'New/Developing'
    else if (daysSinceLastTip > Math.max(60, rawAvgDaysBetweenTipsForTier * 3)) tier = 'Dormant'
    else if (f.tipCount < 5) tier = 'Occasional'

    const privateTips = f.tips.filter(t => t.tip_type?.toLowerCase().includes('private') || t.tip_note?.toLowerCase().includes('private'))
    const hourCounts = {}
    f.tips.forEach(t => { const h = toLocalHour(t.dateRaw || t.date_time, userTz); hourCounts[h] = (hourCounts[h] || 0) + 1 })
    const mostActiveHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]
    const spendPercentile = Math.round((1 - percentileRank) * 100)
    const visits = groupFanVisits(f.tips)
    const observationCount = visits.length
    let avgDaysBetweenVisits = null
    const daysBetweenVisitsArr = []
    if (observationCount >= 2) {
      for (let i = 1; i < observationCount; i++) daysBetweenVisitsArr.push((visits[i].startTime - visits[i - 1].startTime) / 86400000)
      const totalSpanDays = (visits[observationCount - 1].startTime - visits[0].startTime) / 86400000
      avgDaysBetweenVisits = totalSpanDays / (observationCount - 1)
    }
    let spendDeclineRatio = null
    if (observationCount >= 4) {
      const mid = Math.floor(observationCount / 2)
      const earlier = visits.slice(0, mid)
      const recent = visits.slice(mid)
      const earlierAvg = earlier.reduce((s, v) => s + v.totalUSD, 0) / earlier.length
      const recentAvg = recent.reduce((s, v) => s + v.totalUSD, 0) / recent.length
      if (earlierAvg > 0) spendDeclineRatio = parseFloat((recentAvg / earlierAvg).toFixed(3))
    }
    const baselineEstablished = observationCount >= FAN_MIN_OBSERVATIONS_FOR_BASELINE
    const platformCtx = platformRiskContext[f.platform || 'Unknown'] || null
    const behavioral = calcFanBehavioralState({ daysSinceLastTip, avgDaysBetweenTips: avgDaysBetweenVisits, observationCount, spendDeclineRatio, platformCtx })

    return {
      username: f.username, totalUSD: parseFloat(f.totalUSD.toFixed(2)), totalTokens: f.totalTokens,
      tipCount: f.tipCount, avgTipSize: parseFloat((f.totalUSD / f.tipCount).toFixed(2)), biggestTip: parseFloat(biggestTip.toFixed(2)),
      platform: f.platform, tier, lastTipDate: lastTipDate.toISOString(), firstTipDate: firstTipDate.toISOString(), daysSinceLastTip,
      avgDaysBetweenTips: avgDaysBetweenVisits !== null ? parseFloat(avgDaysBetweenVisits.toFixed(1)) : null,
      daysBetweenTipsArr: daysBetweenVisitsArr, observationCount, baselineEstablished,
      tipProbability: (baselineEstablished && avgDaysBetweenVisits) ? calcTipProbability(daysSinceLastTip, avgDaysBetweenVisits) : null,
      trend: calcFanTrend(visits), behavioralState: behavioral.state, behavioralStateReason: behavioral.reason,
      spendDeclineRatio, platformRiskContext: platformCtx, churnRisk: legacyChurnRiskShape(behavioral.state),
      lifetimeValue: calcLifetimeValue(f.totalUSD, lifetimeDays, observationCount),
      expectedNextTip: (baselineEstablished && avgDaysBetweenVisits !== null) ? calcExpectedNextTip(daysSinceLastTip, avgDaysBetweenVisits) : null,
      hasPrivates: privateTips.length > 0, privateCount: privateTips.length,
      privateSpent: parseFloat(privateTips.reduce((s, t) => s + t.usd, 0).toFixed(2)),
      typicalOnlineHours: mostActiveHour ? `${mostActiveHour[0]}:00 - ${parseInt(mostActiveHour[0]) + 2}:00` : 'Unknown',
      tipNotes: f.tipNotes, tips: f.tips, isTopSpender: percentileRank <= 0.05, spendPercentile
    }
  }).sort((a, b) => b.totalUSD - a.totalUSD)
}

function calcTipProbability(d, avg) {
  if (d < avg * 0.5) return { level: 'High', percentage: 85 }
  if (d < avg) return { level: 'Medium-High', percentage: 70 }
  if (d < avg * 1.5) return { level: 'Medium', percentage: 50 }
  if (d < avg * 2) return { level: 'Low-Medium', percentage: 30 }
  return { level: 'Low', percentage: 15 }
}

function calcLifetimeValue(spent, days, observationCount) {
  if (days < 7 || observationCount < FAN_MIN_OBSERVATIONS_FOR_BASELINE) return { prediction: null, confidence: null, monthly: null }
  const p = (spent / days) * 365
  return { prediction: parseFloat(p.toFixed(2)), confidence: observationCount > 10 ? 'High' : observationCount > 5 ? 'Medium' : 'Low', monthly: parseFloat((p / 12).toFixed(2)) }
}

function calcExpectedNextTip(d, avg) {
  const n = Math.max(0, Math.round(avg - d))
  if (n === 0) return 'Overdue'
  if (n === 1) return 'Tomorrow'
  if (n <= 3) return `In ${n} days`
  if (n <= 7) return `In ~${n} days`
  return `In ~${Math.round(n / 7)} weeks`
}

const TREND_CHANGE_THRESHOLD = 0.25
function calcFanTrend(visits) {
  const count = visits.length
  if (count < 4) return { direction: 'insufficient', label: 'New / Insufficient Data', confidence: 'none' }
  const mid = Math.floor(count / 2)
  const priorHalf = visits.slice(0, mid)
  const recentHalf = visits.slice(mid)
  const avg = arr => arr.reduce((s, v) => s + (v.totalUSD || 0), 0) / arr.length
  const priorAvg = avg(priorHalf)
  const recentAvg = avg(recentHalf)
  if (priorAvg <= 0) return { direction: 'insufficient', label: 'New / Insufficient Data', confidence: 'none' }
  const pctChange = (recentAvg - priorAvg) / priorAvg
  const confidence = count >= 8 ? 'Medium' : 'Low'
  if (pctChange >= TREND_CHANGE_THRESHOLD) return { direction: 'up', label: 'Trending Up', confidence, pctChange: parseFloat((pctChange * 100).toFixed(1)) }
  if (pctChange <= -TREND_CHANGE_THRESHOLD) return { direction: 'down', label: 'Trending Down', confidence, pctChange: parseFloat((pctChange * 100).toFixed(1)) }
  return { direction: 'stable', label: 'Stable', confidence, pctChange: parseFloat((pctChange * 100).toFixed(1)) }
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
    if ((w.churnRisk.level === 'High' || w.churnRisk.level === 'Critical') && w.totalUSD >= churnThreshold && w.observationCount >= 3) {
      const freq = getTipFrequency(w.daysBetweenTipsArr)
      const freqText = freq ? `they typically tip ${freq}` : (w.avgDaysBetweenTips != null ? `they usually tip every ${w.avgDaysBetweenTips.toFixed(0)} days` : null)
      if (freqText) alerts.push({ type: 'churn_risk', severity: 'warning', icon: '⚠️', whale: w, message: `${w.username} hasn't tipped in ${w.daysSinceLastTip} days — ${freqText}`, action: 'Re-engage now before they go cold' })
    }
    if (w.tipProbability?.level === 'High' && w.totalUSD >= tipLikelyThreshold)
      alerts.push({ type: 'tip_likely', severity: 'info', icon: '💰', whale: w, message: `${w.username} is likely to tip soon (${w.tipProbability.percentage}% probability based on their pattern)`, action: 'Go live during their active hours' })
    if (w.daysSinceLastTip > 0 && w.daysSinceLastTip <= 3 && w.tipCount > 5) {
      if (w.avgDaysBetweenTips != null && w.daysSinceLastTip > w.avgDaysBetweenTips * 1.5)
        alerts.push({ type: 'returned', severity: 'success', icon: '🎉', whale: w, message: `${w.username} just tipped again after ${w.daysSinceLastTip} days away — welcome them back!`, action: 'Send a thank you message' })
    }
  })
  alerts = alerts.filter(a => isUserRelevant(a.whale))
  const order = { critical: 0, warning: 1, info: 2, success: 3 }
  return alerts.sort((a, b) => order[a.severity] - order[b.severity])
}

export function predictRevenue(tips, sessions) {
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
  const todayDow = new Date().getUTCDay()
  const sameDaySessions = sessions.filter(s => new Date(s.startTime).getUTCDay() === todayDow)
  if (sameDaySessions.length >= 3) {
    const amounts = sameDaySessions.map(s => s.totalUSD).sort((a, b) => a - b)
    const avg = amounts.reduce((s, x) => s + x, 0) / amounts.length
    const p10idx = Math.max(0, Math.floor(amounts.length * 0.10))
    const p90idx = Math.min(amounts.length - 1, Math.floor(amounts.length * 0.90))
    const fixedRange = clampPrediction(amounts[p10idx] || amounts[0], amounts[p90idx] || amounts[amounts.length - 1])
    if (!(fixedRange.min === 0 && fixedRange.max === 0)) predictions.tonightStream = { expected: parseFloat(avg.toFixed(2)), range: { min: fixedRange.min, max: fixedRange.max }, confidence: fixedRange.confidence === 'high' && sameDaySessions.length > 5 ? 'High' : 'Medium', returningTippers: Math.round(sameDaySessions.reduce((s, x) => s + x.uniqueFans, 0) / sameDaySessions.length * 0.4) }
  }
  return predictions
}

export function generateLossAlerts(tips, sessions, whales, bestHour) {
  const alerts = []
  const now = Date.now()
  if (bestHour) {
    const bh = parseInt(bestHour.hour)
    const recentSessions = sessions.filter(s => (now - new Date(s.startTime)) / 86400000 <= 3)
    const recentAtPeak = recentSessions.filter(s => Math.abs(new Date(s.startTime).getUTCHours() - bh) <= 1)
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
  whales.filter(w => w.behavioralState === 'At Risk' && w.totalUSD >= 50).slice(0, 2).forEach(w => alerts.push({ type: 'fan_churn', severity: 'critical', icon: '🚨', message: `${w.username} hasn't tipped in ${w.daysSinceLastTip} days — high churn risk ($${w.totalUSD.toFixed(0)} lifetime value)`, action: 'Send a re-engagement message now' }))
  const lastStreamed = sessions.length ? (now - new Date(sessions[sessions.length - 1].startTime)) / 86400000 : 999
  if (lastStreamed > 2 && sessions.length > 5) alerts.push({ type: 'streak_broken', severity: 'info', icon: '⏸️', message: `You haven't streamed in ${Math.floor(lastStreamed)} days — your audience engagement drops after 3 days off`, action: 'Get back live — consistency is your #1 growth tool' })
  return alerts
}

export function generateInsights(tips, sessions, bestDay, worstDay, bestHour, precomputedWhales = null) {
  const insights = []
  if (!tips.length || !sessions.length) return insights
  const now = Date.now()
  if (bestDay && worstDay && bestDay.day !== worstDay.day) {
    const daySessionMap = {}
    sessions.forEach(s => { const d = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(s.startTime).getUTCDay()]; if (!daySessionMap[d]) daySessionMap[d] = []; daySessionMap[d].push(s.totalUSD) })
    const bestDayAvg = daySessionMap[bestDay.day] ? daySessionMap[bestDay.day].reduce((a,b) => a+b, 0) / daySessionMap[bestDay.day].length : 0
    const otherDaysSessions = Object.entries(daySessionMap).filter(([d]) => d !== bestDay.day).flatMap(([_, vals]) => vals)
    const overallDayAvg = otherDaysSessions.length ? otherDaysSessions.reduce((a,b) => a+b, 0) / otherDaysSessions.length : 0
    const mult = overallDayAvg > 0 ? (bestDayAvg / overallDayAvg).toFixed(1) : null
    const costOfMissing = parseFloat((bestDayAvg - overallDayAvg).toFixed(2))
    if (mult && parseFloat(mult) > 1 && costOfMissing > 0) insights.push({ icon: '📅', text: `${bestDay.day}s are your highest-earning day — you avg $${bestDayAvg.toFixed(0)} on ${bestDay.day}s vs $${overallDayAvg.toFixed(0)} on other days (${mult}x more). Missing one ${bestDay.day} costs you ~$${costOfMissing.toFixed(0)}`, type: 'day', priority: 1 })
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
  const topWhales = (trueWhales.length > 0 ? trueWhales : whales.filter(w => w.tier === 'Shark')).slice(0, 5)
  const wE = topWhales.reduce((s, w) => s + w.totalUSD, 0)
  const tE = tips.reduce((s, t) => s + t.usd, 0)
  if (wE > 0 && tE > 0 && topWhales.length > 0) {
    const pct = Math.round((wE / tE) * 100)
    insights.push({ icon: '🐳', text: `Your top ${topWhales.length} fan${topWhales.length > 1 ? 's' : ''} generate${topWhales.length === 1 ? 's' : ''} ${pct}% of your revenue. Losing even one of them would cost you $${(wE / topWhales.length).toFixed(0)} on average — keep them engaged`, type: 'whales', priority: 2 })
  }
  return insights.sort((a, b) => a.priority - b.priority)
}

export function generateNextMoves(tips, sessions, whales, predictions, bestHour, hourAvgs = []) {
  const moves = []
  const now = Date.now()
  const hourToUse = bestHour || (hourAvgs && hourAvgs.length > 0 ? [...hourAvgs].sort((a, b) => b.avg - a.avg)[0] : null)
  const isEarlySignal = !bestHour && hourToUse
  if (hourToUse) {
    const bh = parseInt(hourToUse.hour)
    const currentHour = new Date().getUTCHours()
    const hoursUntil = (bh - currentHour + 24) % 24
    const label = bh === 0 ? '12 AM' : bh < 12 ? `${bh} AM` : bh === 12 ? '12 PM' : `${bh - 12} PM`
    if (isEarlySignal) moves.push({ icon: '📍', color: '#8B5CF6', text: `Early signal: ${label} looks like your best earning window so far. $${hourToUse.avg.toFixed(0)}/session. More data will confirm this.`, priority: 2 })
    else moves.push({ icon: '🕐', color: '#22D3EE', text: `Your best earning time is ${label} — plan your next stream around it. Your data shows $${bestHour.avg.toFixed(0)} avg per session at this hour`, priority: 2 })
  }
  if (predictions?.tonightStream) {
    const { expected, range, returningTippers } = predictions.tonightStream
    moves.push({ icon: '🎯', color: '#F59E0B', text: `Set a goal of $${Math.round(expected * 1.2)} for tonight — your data predicts $${range.min}–$${range.max} and ~${returningTippers} returning tippers`, priority: 1 })
  }
  whales.filter(w => { const days = Math.floor((now - new Date(w.lastTipDate)) / 86400000); return days >= 3 && days <= 45 && w.totalUSD >= 20 }).sort((a, b) => b.totalUSD - a.totalUSD).slice(0, 3).forEach(w => { const days = Math.floor((now - new Date(w.lastTipDate)) / 86400000); moves.push({ icon: '💸', color: '#EC4899', text: `Message ${w.username} — they've spent $${w.totalUSD.toFixed(0)} total but haven't tipped in ${days} days. One message could recover $${(w.avgTipSize * 2).toFixed(0)}+`, cta: true, username: w.username, priority: 1 }) })
  const avgSession = sessions.length ? sessions.reduce((s, x) => s + x.totalUSD, 0) / sessions.length : 0
  if (avgSession > 0) { const goal = Math.round(avgSession * 1.2 / 5) * 5; moves.push({ icon: '🏆', color: '#F59E0B', text: `Your sessions average $${avgSession.toFixed(0)} — aim for $${goal} next stream. You've already hit this ${sessions.filter(s => s.totalUSD >= goal).length} times`, priority: 3 }) }
  return moves.sort((a, b) => a.priority - b.priority).slice(0, 5)
}

export function aggregateRows(tips, tz = null) {
  let userTz = tz
  if (!userTz) {
    if (typeof Intl === 'undefined') throw new Error('Intl API not available and no timezone provided to aggregateRows')
    userTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!userTz) throw new Error('Failed to resolve user timezone from Intl API')
  }
  if (!tips || tips.length === 0) {
    return {
      totalUSD: 0, totalTokens: 0, totalTips: 0, avgTipSize: 0, topTippers: [], platforms: [], sessions: [], insights: [], predictions: null, whaleAlerts: [], lossAlerts: [], nextMoves: [], bestDay: null, bestHour: null, platformBestTimes: {}, canonicalBestTimes: { bestWindow: null, earlySignal: null, grid: [] }, monthlyData: [], bestMonth: null, tipTypeBreakdown: [], platformTipTypes: {}, privateShowFans: [], spyShowFans: [], earningsVelocity: null, totalStreamMinutes: 0, estimatedHourlyRate: 0, hourlyRateSessionCount: 0, hourlyRateTotalMinutes: 0, hourlyRateTotalUsd: 0, excludedUntimedSessionCount: 0, platformVelocity: {}, missedRevenueByPlatform: {}, platformMomentum: {}, returningVsNew: null, topFanDependency: null, dependencyRisk: null, preTipBehavior: null, trueHourlyAvg: [], platformRiskContext: {}
    }
  }
  const sessions = detectSessions(tips)
  const classifySession = (s) => { const mins = s.durationMinutes || 0; const usd = s.totalUSD || 0; if (mins < 2 && usd === 0) return 'invalid'; return isValidSession(s) ? 'meaningful' : 'low_signal' }
  const scoreSession = (s) => { const mins = s.durationMinutes || 0; const usd = s.totalUSD || 0; return parseFloat(((Math.min(mins / 120, 1) * 0.4) + (Math.min(usd / 100, 1) * 0.6)).toFixed(3)) }
  sessions.forEach(s => { s.sessionQuality = classifySession(s); s.sessionWeight = scoreSession(s) })
  const meaningfulSessions = sessions.filter(s => s.sessionQuality === 'meaningful')
  const allValidSessions = sessions.filter(s => s.sessionQuality !== 'invalid')
  const isHourlyRateEligible = (s) => s.tipCount >= 2 && !s.durationUnknown && Number.isFinite(s.durationMinutes) && s.durationMinutes >= 15 && s.totalUSD > 0
  const hourlyRateSessions = meaningfulSessions.filter(isHourlyRateEligible)

  const dayTipsUSD = {}, dayActiveDates = {}, hourTipsUSD = {}, hourBucketSets = {}, dayDateAmts = {}, hourBucketAmts = {}
  const UTC_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  tips.forEach(t => {
    const dt = new Date(t.dateRaw || t.date_time); if (isNaN(dt.getTime())) return
    const dow = UTC_LONG[toLocalDow(t.dateRaw || t.date_time, userTz)]
    const dateKey = toLocalDateStr(t.dateRaw || t.date_time, userTz)
    const h = toLocalHour(t.dateRaw || t.date_time, userTz)
    const hBucket = Math.floor(dt.getTime() / 3600000)
    const usd = t.usd || 0
    if (!dayTipsUSD[dow]) { dayTipsUSD[dow] = 0; dayActiveDates[dow] = new Set(); dayDateAmts[dow] = {} }
    dayTipsUSD[dow] += usd; dayActiveDates[dow].add(dateKey); dayDateAmts[dow][dateKey] = (dayDateAmts[dow][dateKey] || 0) + usd
    if (!hourTipsUSD[h]) { hourTipsUSD[h] = 0; hourBucketSets[h] = new Set(); hourBucketAmts[h] = {} }
    hourTipsUSD[h] += usd; hourBucketSets[h].add(hBucket); hourBucketAmts[h][hBucket] = (hourBucketAmts[h][hBucket] || 0) + usd
  })
  const dayAvgs = Object.keys(dayTipsUSD).filter(d => dayActiveDates[d].size >= 3).map(d => ({ day: d, avg: parseFloat(calcMedian(Object.values(dayDateAmts[d])).toFixed(2)), total: dayTipsUSD[d], count: dayActiveDates[d].size }))
  const hourAvgs = Object.keys(hourTipsUSD).filter(h => hourBucketSets[h].size >= 3).map(h => ({ hour: h, avg: parseFloat(calcMedian(Object.values(hourBucketAmts[h])).toFixed(2)), total: hourTipsUSD[h], count: hourBucketSets[h].size }))
  const bestDay = [...dayAvgs].sort((a, b) => b.avg - a.avg)[0] || null
  const worstDay = [...dayAvgs].sort((a, b) => a.avg - b.avg)[0] || null
  const bestHour = [...hourAvgs].sort((a, b) => b.avg - a.avg)[0] || null
  const whales = identifyWhales(tips, meaningfulSessions)
  const platformRiskContext = getPlatformRiskContext(tips, meaningfulSessions)
  const insights = generateInsights(tips, meaningfulSessions, bestDay, worstDay, bestHour, whales)
  const predictions = predictRevenue(tips, meaningfulSessions)
  const whaleAlerts = generateWhaleAlerts(whales)
  const lossAlerts = generateLossAlerts(tips, meaningfulSessions, whales, bestHour)
  const nextMoves = generateNextMoves(tips, meaningfulSessions, whales, predictions, bestHour, hourAvgs)
  let totalUSD = 0, totalTokens = 0
  for (const t of tips) { totalUSD += t.usd || 0; totalTokens += t.tokens || 0 }
  const platformMap = {}, platformSessionMap = {}
  tips.forEach(t => { const p = t.platform || 'Chaturbate'; if (!platformMap[p]) platformMap[p] = { platform: p, totalUSD: 0, totalTokens: 0, sessions: 0, hours: 0, tips: 0 }; platformMap[p].totalUSD += t.usd || 0; platformMap[p].totalTokens += t.tokens || 0; platformMap[p].tips += 1 })
  meaningfulSessions.forEach(s => { if (!platformSessionMap[s.platform]) platformSessionMap[s.platform] = { sessions: 0, hours: 0 }; platformSessionMap[s.platform].sessions += 1; if (!s.durationUnknown) platformSessionMap[s.platform].hours += s.durationHours })
  Object.keys(platformMap).forEach(p => { if (platformSessionMap[p]) { platformMap[p].sessions = platformSessionMap[p].sessions; platformMap[p].hours = platformSessionMap[p].hours } })
  const platformRate = {}
  hourlyRateSessions.forEach(s => { if (!platformRate[s.platform]) platformRate[s.platform] = { usd: 0, minutes: 0, sessions: 0 }; platformRate[s.platform].usd += s.totalUSD; platformRate[s.platform].minutes += s.durationMinutes; platformRate[s.platform].sessions += 1 })
  const platforms = Object.values(platformMap).map(p => { const rate = platformRate[p.platform] || { usd: 0, minutes: 0, sessions: 0 }; const rateHours = rate.minutes / 60; return { ...p, rateHours: parseFloat(rateHours.toFixed(2)), rateUSD: parseFloat(rate.usd.toFixed(2)), rateSessionCount: rate.sessions, usdPerHour: rateHours > 0 ? parseFloat((rate.usd / rateHours).toFixed(2)) : 0, tokensPerHour: p.hours > 0 ? Math.round(p.totalTokens / p.hours) : 0, avgTipSize: p.tips > 0 ? parseFloat((p.totalUSD / p.tips).toFixed(2)) : 0 } })
  const topTippers = whales.map((w, i) => ({ rank: i + 1, username: w.username, usd: w.totalUSD, tokens: w.totalTokens, count: w.tipCount, status: w.tier === 'Whale' ? '🐳 WHALE' : w.tier === 'Shark' ? '🦈 SHARK' : w.tier === 'Dormant' ? '💤 DORMANT' : '🐟 REGULAR', last: new Date(w.lastTipDate).toLocaleDateString(), first: new Date(w.firstTipDate).toLocaleDateString(), daysSince: w.daysSinceLastTip, tipProbability: w.tipProbability, churnRisk: w.churnRisk }))
  const totalTimedHours = meaningfulSessions.filter(s => !s.durationUnknown).reduce((s, x) => s + x.durationHours, 0)
  const totalTimedUSD = meaningfulSessions.filter(s => !s.durationUnknown).reduce((s, x) => s + x.totalUSD, 0)
  const earningsVelocity = totalTimedHours > 0 ? parseFloat((totalTimedUSD / totalTimedHours).toFixed(2)) : null
  const totalStreamMinutes = Math.round(totalTimedHours * 60)
  const hourlyRateTotalUsd = parseFloat(hourlyRateSessions.reduce((s, x) => s + x.totalUSD, 0).toFixed(2))
  const hourlyRateTotalMinutes = hourlyRateSessions.reduce((s, x) => s + x.durationMinutes, 0)
  const estimatedHourlyRate = hourlyRateTotalMinutes > 0 ? parseFloat((hourlyRateTotalUsd / (hourlyRateTotalMinutes / 60)).toFixed(2)) : 0
  const hourlyRateSessionCount = hourlyRateSessions.length
  const excludedUntimedSessionCount = meaningfulSessions.filter(s => !isHourlyRateEligible(s)).length
  const uniqueFanCount = [...new Set(tips.map(t => (t.username || '').toLowerCase()).filter(Boolean))].length
  const platformVelocity = {}
  Object.keys(platformMap).forEach(p => { const rate = platformRate[p]; platformVelocity[p] = rate && rate.minutes > 0 ? parseFloat((rate.usd / (rate.minutes / 60)).toFixed(2)) : null })
  const monthlyData = []
  const tipTypeBreakdown = []
  const platformTipTypes = {}
  const privateShowFans = []
  const spyShowFans = []
  const returningVsNew = null
  const topFanDependency = null
  const missedRevenueByPlatform = {}
  const platformMomentum = {}
  const canonicalBestTimes = { bestWindow: bestHour ? { localHour: bestHour.hour, localDay: bestDay?.day || null, medianUsdPerHour: bestHour.avg, sessionCount: bestHour.count || 0, tier: null, topPlatform: platforms[0]?.platform || null } : null, earlySignal: null, grid: hourAvgs.map(h => ({ hour: h.hour, avg: h.avg, count: h.count })).sort((a, b) => a.hour - b.hour) }
  return {
    totalUSD: parseFloat(totalUSD.toFixed(2)), totalTokens, totalTips: tips.length, avgTipSize: parseFloat((tips.length > 0 ? totalUSD / tips.length : 0).toFixed(2)), topTippers, platforms, sessions: meaningfulSessions,
    insights: validateInsights(insights), predictions, whaleAlerts, lossAlerts, nextMoves, whales, bestDay, bestHour, platformBestTimes: {}, canonicalBestTimes, bestWindowFanOverlap: null,
    monthlyData, bestMonth: null, tipTypeBreakdown, platformTipTypes, privateShowFans, spyShowFans, earningsVelocity, totalStreamMinutes, platformVelocity,
    estimatedHourlyRate, hourlyRateSessionCount, hourlyRateTotalMinutes, hourlyRateTotalUsd, excludedUntimedSessionCount,
    missedRevenueByPlatform, returningVsNew, topFanDependency, dependencyRisk: null, preTipBehavior: null, trueHourlyAvg: [], platformRiskContext, platformMomentum,
    meaningfulSessions, allValidSessions, meaningfulSessionCount: meaningfulSessions.length, lowSignalSessionCount: allValidSessions.length - meaningfulSessions.length,
    momentum: { pct: null, label: 'Not enough history', emoji: '—', last30USD: totalUSD, prior30USD: 0 }, uniqueFanCount,
  }
}

export function computePaidSessionAnalytics(sessions) {
  if (!sessions || sessions.length === 0) return null
  const totalUSD = sessions.reduce((s, r) => s + (parseFloat(r.usd) || 0), 0)
  const totalTokens = sessions.reduce((s, r) => s + (parseInt(r.tokens) || 0), 0)
  const totalCount = sessions.length
  return { totalUSD: parseFloat(totalUSD.toFixed(2)), totalTokens, totalCount, avgSessionUSD: totalCount > 0 ? parseFloat((totalUSD / totalCount).toFixed(2)) : 0, uniqueClients: new Set(sessions.map(s => (s.username || '').toLowerCase())).size, sessionTypeBreakdown: [], platformBreakdown: [], topClients: [], peakHours: [], bestHour: null, monthlyTrend: [], bestMonth: null, momentum: { pct: 0, label: 'Steady', last30USD: 0, prior30USD: 0 }, dateRange: null }
}

// ── Snapshot window (Free-tier 31-day analysis window) ──────────────────
export function computeSnapshotStats(rows, windowDays = 31) {
  const dated = rows.map(r => ({ date: r.date instanceof Date ? r.date : new Date(r.date || r.dateRaw || r.ts), tokens: Number(r.tokens) || 0, usd: Number(r.usd) || 0 })).filter(r => !isNaN(r.date.getTime())).sort((a, b) => a.date - b.date)
  const empty = { from: null, to: null, days: 0, tips: 0, tokens: 0, usd: 0 }
  if (!dated.length) return { full: empty, recent: { ...empty, isPartial: true } }
  const from = dated[0].date, to = dated[dated.length - 1].date
  const fullDays = Math.floor((to - from) / 86400000) + 1
  const full = { from, to, days: fullDays, tips: dated.length, tokens: dated.reduce((s, r) => s + r.tokens, 0), usd: parseFloat(dated.reduce((s, r) => s + r.usd, 0).toFixed(2)) }
  const windowStart = new Date(to.getTime() - (windowDays - 1) * 86400000)
  const recentStart = windowStart < from ? from : windowStart
  const recentRows = dated.filter(r => r.date >= recentStart)
  const recent = { from: recentStart, to, days: Math.floor((to - recentStart) / 86400000) + 1, tips: recentRows.length, tokens: recentRows.reduce((s, r) => s + r.tokens, 0), usd: parseFloat(recentRows.reduce((s, r) => s + r.usd, 0).toFixed(2)), isPartial: fullDays < windowDays }
  return { full, recent }
}

export function freeWindowStartByPlatform(rows = [], { windowDays = 31 } = {}) {
  const latest = {}
  for (const row of rows) {
    const platform = row.platform || 'unknown'
    const d = new Date(row.date_time || row.date || row.ts)
    if (isNaN(d.getTime())) continue
    if (!latest[platform] || d > latest[platform]) latest[platform] = d
  }
  const starts = {}
  for (const platform in latest) starts[platform] = new Date(latest[platform].getTime() - (windowDays - 1) * 86400000)
  return starts
}

// Free/trial always use a rolling `windowDays` on every platform. The legacy
// unlimitedPlatform option remains accepted for caller compatibility but is
// intentionally ignored; selecting a Free analytics platform NEVER grants
// deeper history.
export function applyFreeAnalysisWindow(rows = [], { windowDays = 31, unlimitedPlatform: _legacyUnlimitedPlatform = null } = {}) {
  if (!rows.length) return []
  const byPlatform = {}
  for (const row of rows) {
    const platform = row.platform || 'unknown'
    if (!byPlatform[platform]) byPlatform[platform] = []
    byPlatform[platform].push(row)
  }
  const windowed = []
  for (const platform in byPlatform) {
    const sorted = [...byPlatform[platform]].sort((a, b) => new Date(a.date_time || a.date || a.ts) - new Date(b.date_time || b.date || b.ts))
    if (!sorted.length) continue
    const latestDate = new Date(sorted[sorted.length - 1].date_time || sorted[sorted.length - 1].date || sorted[sorted.length - 1].ts)
    const windowStart = new Date(latestDate.getTime() - (windowDays - 1) * 86400000)
    windowed.push(...sorted.filter(r => new Date(r.date_time || r.date || r.ts) >= windowStart))
  }
  return windowed
}

export function summarizeWindowExclusion(allRows = [], windowedRows = []) {
  if (allRows.length === windowedRows.length) return { excludedCount: 0, oldestExcludedDate: null, byPlatform: {} }
  const windowedSet = new Set(windowedRows.map(r => `${r.username}|${r.platform}|${r.date_time || r.date || r.ts}`))
  const excluded = allRows.filter(r => !windowedSet.has(`${r.username}|${r.platform}|${r.date_time || r.date || r.ts}`))
  const byPlatform = {}
  let oldestDate = null
  for (const row of excluded) {
    const platform = row.platform || 'unknown'
    if (!byPlatform[platform]) byPlatform[platform] = { count: 0, oldestDate: null }
    byPlatform[platform].count++
    const rowDate = new Date(row.date_time || row.date || row.ts)
    if (!byPlatform[platform].oldestDate || rowDate < new Date(byPlatform[platform].oldestDate)) byPlatform[platform].oldestDate = rowDate
    if (!oldestDate || rowDate < oldestDate) oldestDate = rowDate
  }
  return { excludedCount: excluded.length, oldestExcludedDate: oldestDate, byPlatform }
}

// Pro gets all stored data. Free/trial get the same per-platform 31-day
// window across tips and related earnings tables. The legacy unlimitedPlatform
// argument is ignored by design so no selected platform can leak full history.
export function accessibleDataset({
  tips = [], paidSessions = [], liveIntervals = [], shows = [],
  isPro = false, unlimitedPlatform: _legacyUnlimitedPlatform = null, windowDays = 31,
} = {}) {
  if (isPro) return { tips, paidSessions, liveIntervals, shows, windowStarts: null, unlimitedPlatform: null }
  const starts = { ...freeWindowStartByPlatform(paidSessions, { windowDays }), ...freeWindowStartByPlatform(tips, { windowDays }) }
  const byKey = {}
  for (const [p, d] of Object.entries(starts)) byKey[canonicalPlatform(p).toLowerCase()] = d
  const allowed = (platform, at) => {
    const c = canonicalPlatform(platform || 'unknown')
    const start = byKey[c.toLowerCase()]
    const d = new Date(at)
    return !!start && !isNaN(d.getTime()) && d >= start
  }
  return {
    tips: applyFreeAnalysisWindow(tips, { windowDays }),
    paidSessions: paidSessions.filter((r) => allowed(r.platform, r.date_time)),
    liveIntervals: liveIntervals.filter((r) => allowed(r.platform, r.ended_at || r.endedAt)),
    shows: shows.filter((s) => {
      const plats = (s.platformRevenue || []).map((x) => x.platform)
      if (!plats.length && s.platform) plats.push(s.platform)
      return plats.some((p) => allowed(p, s.startedAt))
    }),
    windowStarts: byKey,
    unlimitedPlatform: null,
  }
}

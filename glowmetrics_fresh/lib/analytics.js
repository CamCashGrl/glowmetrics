// ============================================
// CAMCASH COMPLETE ANALYTICS ENGINE
// ============================================

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

export function parseCSV(text, platform = null) {
  const allLines = text.trim().split('\n')
  if (allLines.length === 0) return []

  if (!platform) platform = detectPlatform(text)

  // Skip leading junk/blank rows to find first real content row
  let startIdx = 0
  for (let i = 0; i < Math.min(5, allLines.length); i++) {
    const cols = parseCSVLine(allLines[i])
    if (cols.filter(c => c.trim()).length >= 2) { startIdx = i; break }
  }

  const lines = allLines.slice(startIdx).filter(l => l.trim())
  if (lines.length === 0) return []

  const firstLower = lines[0].toLowerCase()
  const firstCols = parseCSVLine(lines[0])

  // If first column looks like a date value, it's a data row (not headers)
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

  // ── Normalize + validate every row before it leaves the parser ──────
  return raw.map(normalizeTip).filter(isValidTip)
}

// ============================================
// DATA NORMALIZATION + VALIDATION
// ============================================

// FIX #2 (high-level): Normalize everything in one place, applied to ALL paths
function normalizeTip(row) {
  const tokens = parseInt(row.tokens) || 0
  // If usd is missing, derive from tokens at the standard 0.05 rate
  const rawUsd = parseFloat(row.usd) || 0
  const usd = rawUsd > 0 ? rawUsd : parseFloat((tokens * 0.05).toFixed(2))

  // FIX #3: Validate date and discard rows with unparseable dates
  const dateRaw = normalizeDate(row.dateRaw || row.date_time || '')
  const parsedDate = new Date(dateRaw)
  if (isNaN(parsedDate.getTime())) return null   // will be filtered by isValidTip

  return {
    ...row,
    username: (row.username || '').toLowerCase().trim(),
    tokens,
    usd: parseFloat(usd.toFixed(2)),
    dateRaw,
    date_time: dateRaw,
  }
}

// FIX #2 (high-level): Single validation gate — bad rows never enter the system
function isValidTip(t) {
  if (!t) return false
  return (
    typeof t.username === 'string' &&
    t.username.length > 0 &&
    !isNaN(t.tokens) &&
    !isNaN(t.usd) &&
    t.tokens >= 0 &&
    t.usd >= 0 &&
    // At least one of tokens or usd must be non-zero
    (t.tokens > 0 || t.usd > 0)
  )
}

// ============================================
// PLATFORM DETECTION
// ============================================

function detectPlatform(text) {
  const lower = text.toLowerCase()
  if (lower.includes('chaturbate') || lower.includes('tip from:') || lower.includes('token balance') || lower.includes('token change')) return 'Chaturbate'
  if (lower.includes('bongacams') || lower.includes('bonga') || lower.includes('your payout')) return 'BongaCams'
  if (lower.includes('myfreecams') || lower.includes('mfc')) return 'MyFreeCams'
  if (lower.includes('stripchat')) return 'Stripchat'
  if (lower.includes('camsoda')) return 'CamSoda'
  return 'Unknown'
}

// ============================================
// DATE NORMALIZATION
// ============================================

function normalizeDate(raw) {
  if (!raw) return null
  // European DD.MM.YYYY
  const euro = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}:\d{2}))?/)
  if (euro) return `${euro[2]}/${euro[1]}/${euro[3]}${euro[4] ? ' ' + euro[4] : ''}`
  // YYYY/MM/DD
  const slash = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})(.*)/)
  if (slash) return `${slash[1]}-${slash[2]}-${slash[3]}${slash[4]}`
  // ISO with Z: 2026-03-01T22:14:03Z
  return raw.replace('T', ' ').replace('Z', '')
}

// ============================================
// HEADER NORMALIZATION
// ============================================

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

// ============================================
// CSV LINE PARSER
// ============================================

// FIX #1: REMOVE .filter(v => v !== '') — empty columns must stay in place
// to preserve alignment with headers. Trimming only.
function parseCSVLine(line) {
  // Handle case where entire row is wrapped in outer quotes: "col1,col2,col3"
  // Only treat as outer-wrap if there are no inner quotes at all
  const trimmed = line.trim()
  if (
    trimmed.startsWith('"') &&
    trimmed.endsWith('"') &&
    !trimmed.slice(1, -1).includes('"')
  ) {
    // Preserve empty columns — map(trim) only, no filter
    return trimmed.slice(1, -1).split(',').map(v => v.trim())
  }

  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  // Push the last field (may be empty — that's valid)
  result.push(current.trim())

  // DO NOT filter — an empty string at index N means column N is empty,
  // which must stay in place so row[headers[N]] maps correctly.
  return result
}

// ============================================
// HEADER-BASED PARSING
// ============================================

function parseWithHeaders(lines, platform) {
  const rawHeaders = parseCSVLine(lines[0])
  const headers = rawHeaders.map(normalizeHeaderName)
  const results = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const vals = parseCSVLine(line)
    const row = {}
    // vals[idx] may be '' (empty column) — that is intentional and correct
    headers.forEach((h, idx) => { row[h] = (vals[idx] ?? '').trim() })

    // ── Skip non-revenue rows ────────────────────────────────────────
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

    // ── Extract username ─────────────────────────────────────────────
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

    // ── Extract tokens ───────────────────────────────────────────────
    let tokens = parseInt(row.tokens || 0) || 0
    if (tokens < 0) continue

    // ── Extract USD ──────────────────────────────────────────────────
    const rawUsd = (row.usd || row.usd_amount || '0').toString().replace(/[$,\s]/g, '')
    let usd = parseFloat(rawUsd) || 0
    if (usd < 0) usd = 0

    if (tokens <= 0 && usd <= 0) continue

    // ── Extract date ─────────────────────────────────────────────────
    const rawDate = row.date_time || row.date || row.timestamp || ''
    const dateRaw = normalizeDate(rawDate) || new Date().toISOString()

    // FIX #3: Validate date before using it
    const parsedDate = new Date(dateRaw)
    if (isNaN(parsedDate.getTime())) continue

    // ── Detect platform from row if available ────────────────────────
    const rowPlatform = row.platform
      ? (row.platform.toLowerCase().includes('bonga') ? 'BongaCams'
        : row.platform.toLowerCase().includes('chaturbate') ? 'Chaturbate'
        : row.platform.toLowerCase().includes('mfc') || row.platform.toLowerCase().includes('freecams') ? 'MyFreeCams'
        : row.platform || platform)
      : platform

    results.push({
      dateRaw, date_time: dateRaw,
      username,
      platform: rowPlatform || 'Unknown',
      // Derive missing value from the other — never guess from magnitude
      tokens: tokens > 0 ? tokens : Math.round(usd / 0.05),
      usd: usd > 0 ? parseFloat(usd.toFixed(2)) : parseFloat((tokens * 0.05).toFixed(2)),
      tip_type: row.tip_type || 'Tip',
      tip_note: row.note || row.tip_note || ''
    })
  }
  return results
}

// ============================================
// HEADERLESS PARSING
// ============================================

function parseHeaderless(lines, platform) {
  const results = []

  for (const line of lines) {
    if (!line.trim()) continue
    const vals = parseCSVLine(line)
    if (vals.length === 0) continue

    // Chaturbate "Tip From: username message" format
    if (vals.length >= 3 && vals[1] && vals[1].toLowerCase().includes('tip from')) {
      const dateRaw = normalizeDate(vals[0].replace(/"/g, ''))
      const m = vals[1].match(/tip from[:\s]*(\S+)/i)
      const username = m ? m[1] : null
      const tokens = parseInt(vals[2]) || 0
      if (!username || tokens <= 0) continue
      if (vals[1].toLowerCase().includes('transfer') || vals[1].toLowerCase().includes('cash')) continue

      // FIX #3: Validate date
      if (!dateRaw || isNaN(new Date(dateRaw).getTime())) continue

      results.push({
        dateRaw, date_time: dateRaw, username,
        platform: 'Chaturbate', tokens,
        usd: parseFloat((tokens * 0.05).toFixed(2)),
        tip_type: 'Tip', tip_note: ''
      })
      continue
    }

    // European date DD.MM.YYYY (BongaCams headerless)
    if (vals.length >= 4 && /^\d{2}\.\d{2}\.\d{4}/.test(vals[0])) {
      const dateRaw = normalizeDate(vals[0])
      const username = vals[1] || null
      const tokens = parseInt(vals[3]) || 0
      const usd = parseFloat((vals[4] || '').replace(/[$,]/g, '')) || 0
      if (!username || (tokens <= 0 && usd <= 0)) continue

      // FIX #3: Validate date
      if (!dateRaw || isNaN(new Date(dateRaw).getTime())) continue

      results.push({
        dateRaw, date_time: dateRaw, username,
        platform: platform || 'BongaCams',
        tokens: tokens > 0 ? tokens : Math.round(usd / 0.05),
        usd: usd > 0 ? parseFloat(usd.toFixed(2)) : parseFloat((tokens * 0.05).toFixed(2)),
        tip_type: vals[2] || 'Tip', tip_note: ''
      })
      continue
    }

    // Generic fallback
    if (vals.length >= 2) {
      const dateRaw = normalizeDate(vals[0]) || vals[0]
      const username = (vals[1] || '').trim()
      if (!username) continue

      // FIX #3: Validate date
      if (!dateRaw || isNaN(new Date(dateRaw).getTime())) continue

      let tokens = 0
      let usd = 0

      // FIX #2: Do NOT guess tokens vs USD by magnitude (>100 heuristic was wrong).
      // Instead: look for a $ sign to identify USD, otherwise treat as tokens.
      // If neither is marked, use position: index 2 = tokens, index 3 = usd
      // and fall back to deriving one from the other.
      for (let i = 2; i < vals.length; i++) {
        const raw = vals[i]
        const num = parseFloat(raw.replace(/[$,]/g, ''))
        if (isNaN(num) || num <= 0) continue

        if (raw.includes('$')) {
          usd = num
        } else if (i === 2 && tokens === 0) {
          tokens = Math.round(num) // position 2 = tokens column
        } else if (i === 3 && usd === 0) {
          usd = num // position 3 = usd column
        }
      }

      // Derive missing value from the known one
      if (tokens === 0 && usd > 0) tokens = Math.round(usd / 0.05)
      if (usd === 0 && tokens > 0) usd = parseFloat((tokens * 0.05).toFixed(2))

      if (tokens === 0 && usd === 0) continue

      results.push({
        dateRaw, date_time: dateRaw, username,
        platform: platform || 'Unknown',
        tokens,
        usd: parseFloat(usd.toFixed(2)),
        tip_type: 'Tip', tip_note: ''
      })
    }
  }
  return results
}

// ============================================
// SESSION DETECTION
// ============================================

export function detectSessions(tips) {
  if (!tips || tips.length === 0) return []

  const parsed = tips
    .map(t => {
      const timestamp = new Date(t.dateRaw || t.date_time)
      // FIX #3: Consistent invalid-date guard everywhere
      if (isNaN(timestamp.getTime())) return null
      return { ...t, timestamp }
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp)

  if (parsed.length === 0) return []

  const SESSION_GAP_MS = 3 * 60 * 60 * 1000
  const sessions = []
  let cur = null

  parsed.forEach(tip => {
    if (!cur) {
      cur = {
        tips: [tip], platform: tip.platform,
        startTime: tip.timestamp, endTime: tip.timestamp,
        fans: new Set([tip.username.toLowerCase()])
      }
    } else if (tip.timestamp - cur.endTime <= SESSION_GAP_MS && tip.platform === cur.platform) {
      cur.tips.push(tip)
      cur.endTime = tip.timestamp
      cur.fans.add(tip.username.toLowerCase())
    } else {
      sessions.push(finalizeSession(cur))
      cur = {
        tips: [tip], platform: tip.platform,
        startTime: tip.timestamp, endTime: tip.timestamp,
        fans: new Set([tip.username.toLowerCase()])
      }
    }
  })

  if (cur && cur.tips.length > 0) sessions.push(finalizeSession(cur))
  return sessions
}

function finalizeSession(s) {
  const durationMs = s.endTime - s.startTime
  const rawMinutes = Math.round(durationMs / 60000)

  // If start === end (single-tip export, e.g. some BongaCams CSVs), we don't
  // know the real stream length — flag it so the dashboard can exclude it from
  // $/hour calculations rather than showing an inflated number.
  const durationUnknown = rawMinutes === 0

  // Use real duration. Do NOT floor to 30 min — that inflates $/hour for short
  // sessions and makes "best time to stream" calculations wrong.
  // Minimum of 1 minute just to avoid divide-by-zero.
  const durationMinutes = Math.max(rawMinutes, 1)
  const durationHours = durationMinutes / 60

  let totalTokens = 0
  let totalUSD = 0
  for (const t of s.tips) {
    totalTokens += t.tokens || 0
    totalUSD += t.usd || 0
  }

  const tipCount = s.tips.length
  const uniqueFans = s.fans.size

  // usdPerMinute — more granular, useful for short sessions
  const usdPerMinute = !durationUnknown
    ? parseFloat((totalUSD / durationMinutes).toFixed(3))
    : null

  // Velocity trend: compare first half vs second half earnings per minute
  const sorted = [...s.tips].sort((a, b) => a.timestamp - b.timestamp)
  const midMs = s.startTime.getTime() + durationMs / 2
  const firstHalf = sorted.filter(t => t.timestamp.getTime() <= midMs)
  const secondHalf = sorted.filter(t => t.timestamp.getTime() > midMs)
  const halfMins = Math.max(durationMinutes / 2, 1)
  const firstHalfUPM = firstHalf.reduce((a, t) => a + (t.usd || 0), 0) / halfMins
  const secondHalfUPM = secondHalf.reduce((a, t) => a + (t.usd || 0), 0) / halfMins
  let velocityTrend = 'unknown'
  if (!durationUnknown && durationMinutes >= 10) {
    if (secondHalfUPM > firstHalfUPM * 1.15) velocityTrend = 'growing'
    else if (secondHalfUPM < firstHalfUPM * 0.75) velocityTrend = 'dying'
    else velocityTrend = 'steady'
  }

  // Top contributor concentration
  const tipperMap = {}
  sorted.forEach(t => {
    const u = t.username || 'unknown'
    tipperMap[u] = (tipperMap[u] || 0) + (t.usd || 0)
  })
  const topEntry = Object.entries(tipperMap).sort((a, b) => b[1] - a[1])[0]
  const topContributor = topEntry ? topEntry[0] : null
  const topContributorPct = topEntry && totalUSD > 0
    ? Math.round((topEntry[1] / totalUSD) * 100)
    : 0

  return {
    id: `session_${s.startTime.getTime()}`,
    platform: s.platform,
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    durationMinutes,
    durationHours: parseFloat(durationHours.toFixed(2)),
    durationUnknown,
    totalTokens,
    totalUSD: parseFloat(totalUSD.toFixed(2)),
    tipCount,
    uniqueFans,
    tokensPerHour: (!durationUnknown && durationHours > 0) ? Math.round(totalTokens / durationHours) : 0,
    usdPerHour: (!durationUnknown && durationHours > 0) ? parseFloat((totalUSD / durationHours).toFixed(2)) : null,
    usdPerMinute,
    avgTipSize: tipCount > 0 ? parseFloat((totalUSD / tipCount).toFixed(2)) : 0,
    velocityTrend,
    firstHalfUPM: parseFloat(firstHalfUPM.toFixed(3)),
    secondHalfUPM: parseFloat(secondHalfUPM.toFixed(3)),
    topContributor,
    topContributorPct,
    tips: s.tips
  }
}

// ============================================
// WHALE IDENTIFICATION
// ============================================

export function identifyWhales(tips) {
  const fanMap = {}

  tips.forEach(t => {
    const key = t.username.toLowerCase()
    if (!fanMap[key]) {
      fanMap[key] = {
        username: t.username, totalUSD: 0, totalTokens: 0,
        tipCount: 0, tips: [], platform: t.platform, tipNotes: []
      }
    }
    // FIX performance: accumulate inline instead of re-reducing later
    fanMap[key].totalUSD += t.usd || 0
    fanMap[key].totalTokens += t.tokens || 0
    fanMap[key].tipCount += 1
    fanMap[key].tips.push(t)
    if (t.tip_note) fanMap[key].tipNotes.push(t.tip_note)
  })

  const allFans = Object.values(fanMap)
  // sorted by total spend descending — used for percentile rank
  const sorted = [...allFans].sort((a, b) => b.totalUSD - a.totalUSD)
  const totalFans = sorted.length

  return allFans.map(f => {
    const fanSorted = [...f.tips].sort((a, b) =>
      new Date(b.dateRaw || b.date_time) - new Date(a.dateRaw || a.date_time)
    )
    const lastTipDate = new Date(fanSorted[0].dateRaw || fanSorted[0].date_time)
    const firstTipDate = new Date(fanSorted[fanSorted.length - 1].dateRaw || fanSorted[fanSorted.length - 1].date_time)
    const daysSinceLastTip = Math.floor((Date.now() - lastTipDate) / 86400000)
    const lifetimeDays = Math.max(Math.floor((lastTipDate - firstTipDate) / 86400000), 1)
    // tipCount === 1: no interval exists, default to 30 days
    // tipCount > 1 but tips very close together: floor to 1 day minimum
    const avgDaysBetweenTips = f.tipCount > 1
      ? Math.max(1, lifetimeDays / (f.tipCount - 1))
      : 30
    const biggestTip = Math.max(...f.tips.map(t => t.usd))

    // FIX whale tiers: use pure percentile rank — avoids misclassification
    // on small or skewed datasets where avgSpend * 3 could fire incorrectly
    const fanRankIndex = sorted.findIndex(s => s.username.toLowerCase() === f.username.toLowerCase())
    const percentileRank = totalFans > 1 ? fanRankIndex / (totalFans - 1) : 0
    // percentileRank 0 = top spender, 1 = bottom spender

    let tier = 'Regular'
    if (percentileRank <= 0.05) tier = 'Whale'
    else if (percentileRank <= 0.20) tier = 'Shark'
    else if (daysSinceLastTip > Math.max(60, avgDaysBetweenTips * 3)) tier = 'Dormant'

    const privateTips = f.tips.filter(t =>
      t.tip_type?.toLowerCase().includes('private') ||
      t.tip_note?.toLowerCase().includes('private')
    )

    const hourCounts = {}
    f.tips.forEach(t => {
      const h = new Date(t.dateRaw || t.date_time).getHours()
      hourCounts[h] = (hourCounts[h] || 0) + 1
    })
    const mostActiveHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]

    const spendPercentile = Math.round((1 - percentileRank) * 100)

    // Build daysBetweenTips array for getTipFrequency
    const tipDates = [...f.tips]
      .sort((a, b) => new Date(a.dateRaw || a.date_time) - new Date(b.dateRaw || b.date_time))
      .map(t => new Date(t.dateRaw || t.date_time))
    const daysBetweenTipsArr = []
    for (let i = 1; i < tipDates.length; i++) {
      daysBetweenTipsArr.push((tipDates[i] - tipDates[i - 1]) / 86400000)
    }

    return {
      username: f.username,
      totalUSD: parseFloat(f.totalUSD.toFixed(2)),
      totalTokens: f.totalTokens,
      tipCount: f.tipCount,
      avgTipSize: parseFloat((f.totalUSD / f.tipCount).toFixed(2)),
      biggestTip: parseFloat(biggestTip.toFixed(2)),
      platform: f.platform,
      tier,
      lastTipDate: lastTipDate.toISOString(),
      firstTipDate: firstTipDate.toISOString(),
      daysSinceLastTip,
      avgDaysBetweenTips: parseFloat(avgDaysBetweenTips.toFixed(1)),
      daysBetweenTipsArr,
      tipProbability: calcTipProbability(daysSinceLastTip, avgDaysBetweenTips),
      churnRisk: calcChurnRisk(daysSinceLastTip, avgDaysBetweenTips, f.tipCount),
      lifetimeValue: calcLifetimeValue(f.totalUSD, lifetimeDays, f.tipCount),
      expectedNextTip: calcExpectedNextTip(daysSinceLastTip, avgDaysBetweenTips),
      hasPrivates: privateTips.length > 0,
      privateCount: privateTips.length,
      privateSpent: parseFloat(privateTips.reduce((s, t) => s + t.usd, 0).toFixed(2)),
      typicalOnlineHours: mostActiveHour
        ? `${mostActiveHour[0]}:00 - ${parseInt(mostActiveHour[0]) + 2}:00`
        : 'Unknown',
      tipNotes: f.tipNotes,
      tips: f.tips,
      isTopSpender: percentileRank <= 0.05,
      spendPercentile
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
  if (days < 7 || count < 2) return { prediction: spent, confidence: 'Low' }
  const p = (spent / days) * 365
  return {
    prediction: parseFloat(p.toFixed(2)),
    confidence: count > 10 ? 'High' : count > 5 ? 'Medium' : 'Low',
    monthly: parseFloat((p / 12).toFixed(2))
  }
}

function calcExpectedNextTip(d, avg) {
  const n = Math.max(0, Math.round(avg - d))
  if (n === 0) return 'Overdue'
  if (n === 1) return 'Tomorrow'
  if (n <= 3)  return `In ${n} days`
  if (n <= 7)  return `In ~${n} days`
  return `In ~${Math.round(n / 7)} weeks`
}

// ============================================
// WHALE ALERTS
// ============================================

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

    if (
      (w.churnRisk.level === 'High' || w.churnRisk.level === 'Critical') &&
      w.totalUSD >= churnThreshold &&
      w.tipCount >= 3
    ) {
      const freq = getTipFrequency(w.daysBetweenTipsArr)
      const freqText = freq
        ? `they typically tip ${freq}`
        : `they usually tip every ${w.avgDaysBetweenTips.toFixed(0)} days`
      alerts.push({ type: 'churn_risk', severity: 'warning', icon: '⚠️', whale: w, message: `${w.username} hasn't tipped in ${w.daysSinceLastTip} days — ${freqText}`, action: 'Re-engage now before they go cold' })
    }

    if (w.tipProbability.level === 'High' && w.totalUSD >= tipLikelyThreshold)
      alerts.push({ type: 'tip_likely', severity: 'info', icon: '💰', whale: w, message: `${w.username} is likely to tip soon (${w.tipProbability.percentage}% probability based on their pattern)`, action: 'Go live during their active hours' })

    if (w.daysSinceLastTip > 0 && w.daysSinceLastTip <= 3 && w.tipCount > 5) {
      if (w.daysSinceLastTip > w.avgDaysBetweenTips * 1.5)
        alerts.push({ type: 'returned', severity: 'success', icon: '🎉', whale: w, message: `${w.username} just tipped again after ${w.daysSinceLastTip} days away — welcome them back!`, action: 'Send a thank you message' })
    }
  })

  // Filter out alerts for irrelevant/stale users
  alerts = alerts.filter(a => isUserRelevant(a.whale))

  const order = { critical: 0, warning: 1, info: 2, success: 3 }
  return alerts.sort((a, b) => order[a.severity] - order[b.severity])
}

// ============================================
// REVENUE PREDICTIONS
// ============================================

export function predictRevenue(tips, sessions) {
  if (!sessions.length) return null
  const predictions = {}
  const now = Date.now()

  const last7 = tips.filter(t => (now - new Date(t.dateRaw || t.date_time)) / 86400000 <= 7)
  const last7Rev = last7.reduce((s, t) => s + t.usd, 0)
  predictions.next7Days = {
    amount: parseFloat(last7Rev.toFixed(2)),
    confidence: last7.length > 20 ? 'High' : last7.length > 10 ? 'Medium' : 'Low'
  }

  const last30 = tips.filter(t => (now - new Date(t.dateRaw || t.date_time)) / 86400000 <= 30)
  const last30Rev = last30.reduce((s, t) => s + t.usd, 0)
  const prev30 = tips.filter(t => {
    const d = (now - new Date(t.dateRaw || t.date_time)) / 86400000
    return d > 30 && d <= 60
  })
  const prev30Rev = prev30.reduce((s, t) => s + t.usd, 0)
  const weeklyTrend = prev30Rev > 0 ? ((last30Rev - prev30Rev) / prev30Rev) * 100 : null
  predictions.next30Days = {
    amount: parseFloat(last30Rev.toFixed(2)),
    confidence: last30.length > 50 ? 'High' : last30.length > 25 ? 'Medium' : 'Low',
    trend: weeklyTrend !== null ? parseFloat(weeklyTrend.toFixed(1)) : null
  }

  const todayDow = new Date().getDay()
  const sameDaySessions = sessions.filter(s => new Date(s.startTime).getDay() === todayDow)
  // Require at least 3 sessions on this day of week for a meaningful prediction
  if (sameDaySessions.length >= 3) {
    const amounts = sameDaySessions.map(s => s.totalUSD).sort((a, b) => a - b)
    const avg = amounts.reduce((s, x) => s + x, 0) / amounts.length
    // For small samples use actual min/max; for larger use percentiles
    const p10idx = Math.max(0, Math.floor(amounts.length * 0.10))
    const p90idx = Math.min(amounts.length - 1, Math.floor(amounts.length * 0.90))
    const p10 = amounts[p10idx] || amounts[0]
    const p90 = amounts[p90idx] || amounts[amounts.length - 1]
    const fixedRange = clampPrediction(p10, p90)
    // Don't show tonightStream if both min and max are 0
    if (fixedRange.min === 0 && fixedRange.max === 0) return predictions
    predictions.tonightStream = {
      expected: parseFloat(avg.toFixed(2)),
      range: { min: fixedRange.min, max: fixedRange.max },
      confidence: fixedRange.confidence === 'high' && sameDaySessions.length > 5 ? 'High' : 'Medium',
      returningTippers: Math.round(
        sameDaySessions.reduce((s, x) => s + x.uniqueFans, 0) / sameDaySessions.length * 0.4
      )
    }
  }

  return predictions
}

// ============================================
// LOSS ALERTS
// ============================================

export function generateLossAlerts(tips, sessions, whales, bestHour) {
  const alerts = []
  const now = Date.now()

  // Peak window missed — uses pre-computed bestHour from aggregateRows
  if (bestHour) {
    const bh = parseInt(bestHour.hour)
    const avgAtPeak = bestHour.avg
    const recentSessions = sessions.filter(s => (now - new Date(s.startTime)) / 86400000 <= 3)
    const recentAtPeak = recentSessions.filter(s => Math.abs(new Date(s.startTime).getHours() - bh) <= 1)
    if (recentSessions.length > 0 && recentAtPeak.length === 0) {
      const estLoss = parseFloat((avgAtPeak * 3).toFixed(2))
      const label = bh === 0 ? '12 AM' : bh < 12 ? `${bh} AM` : bh === 12 ? '12 PM' : `${bh - 12} PM`
      alerts.push({ type: 'peak_missed', severity: 'warning', icon: '🚨', message: `You haven't streamed during your peak window (${label}) in 3 days — estimated loss: $${estLoss}`, action: `Go live at ${label} to recover this` })
    }
  }

  // Avg tip drop this week vs last week
  const thisWeek = tips.filter(t => (now - new Date(t.dateRaw || t.date_time)) / 86400000 <= 7)
  const lastWeek = tips.filter(t => {
    const d = (now - new Date(t.dateRaw || t.date_time)) / 86400000
    return d > 7 && d <= 14
  })
  if (thisWeek.length >= 5 && lastWeek.length >= 5) {
    const thisAvg = thisWeek.reduce((s, t) => s + t.usd, 0) / thisWeek.length
    const lastAvg = lastWeek.reduce((s, t) => s + t.usd, 0) / lastWeek.length
    const drop = Math.round(((lastAvg - thisAvg) / lastAvg) * 100)
    if (drop >= 15)
      alerts.push({ type: 'tip_drop', severity: 'warning', icon: '📉', message: `Your avg tip dropped ${drop}% this week ($${lastAvg.toFixed(2)} → $${thisAvg.toFixed(2)})`, action: 'Focus on high-value fans during your next stream' })
  }

  // High-value fan churn risk
  whales
    .filter(w => w.totalUSD >= 50 && w.daysSinceLastTip >= 5 && w.daysSinceLastTip < 30)
    .slice(0, 2)
    .forEach(w => {
      alerts.push({ type: 'fan_churn', severity: 'critical', icon: '🚨', message: `${w.username} hasn't tipped in ${w.daysSinceLastTip} days — high churn risk ($${w.totalUSD.toFixed(0)} lifetime value)`, action: 'Send a re-engagement message now' })
    })

  // Streak broken
  const daySet = new Set(sessions.map(s => new Date(s.startTime).toDateString()))
  const lastStreamed = sessions.length
    ? (now - new Date(sessions[sessions.length - 1].startTime)) / 86400000
    : 999
  if (lastStreamed > 2 && sessions.length > 5) {
    alerts.push({ type: 'streak_broken', severity: 'info', icon: '⏸️', message: `You haven't streamed in ${Math.floor(lastStreamed)} days — your audience engagement drops after 3 days off`, action: 'Get back live — consistency is your #1 growth tool' })
  }

  return alerts
}

// ============================================
// INSIGHTS (ACTION-ORIENTED)
// ============================================

export function generateInsights(tips, sessions, bestDay, worstDay, bestHour) {
  const insights = []
  if (!tips.length || !sessions.length) return insights
  const now = Date.now()

  // Best day — uses pre-computed avg-per-active-day passed in from aggregateRows
  // FIX: compare bestDay.avg vs the mean of all day avgs (not avg per session)
  if (bestDay && worstDay && bestDay.day !== worstDay.day) {
    // Re-derive per-day avg from tips directly for accuracy
    const dayTips = {}; const dayDates = {}
    tips.forEach(t => {
      const d = new Date(t.dateRaw || t.date_time)
      const dow = d.toLocaleDateString('en-US', { weekday: 'long' })
      const dateKey = d.toLocaleDateString()
      if (!dayTips[dow]) { dayTips[dow] = 0; dayDates[dow] = new Set() }
      dayTips[dow] += t.usd || 0
      dayDates[dow].add(dateKey)
    })
    // FIX: use avg per SESSION on each day (not avg/calendar day which dilutes by inactive days)
    const daySessionMap = {}
    sessions.forEach(s => {
      const d = new Date(s.startTime).toLocaleDateString('en-US', { weekday: 'long' })
      if (!daySessionMap[d]) daySessionMap[d] = []
      daySessionMap[d].push(s.totalUSD)
    })
    const bestDayAvg = daySessionMap[bestDay.day]
      ? daySessionMap[bestDay.day].reduce((a,b) => a+b, 0) / daySessionMap[bestDay.day].length
      : (dayTips[bestDay.day] / (dayDates[bestDay.day]?.size || 1))
    const otherDaysSessions = Object.entries(daySessionMap)
      .filter(([d]) => d !== bestDay.day)
      .flatMap(([_, vals]) => vals)
    const overallDayAvg = otherDaysSessions.length
      ? otherDaysSessions.reduce((a,b) => a+b, 0) / otherDaysSessions.length
      : 0
    const mult = overallDayAvg > 0 ? (bestDayAvg / overallDayAvg).toFixed(1) : null
    const costOfMissing = parseFloat((bestDayAvg - overallDayAvg).toFixed(2))
    if (mult && parseFloat(mult) > 1 && costOfMissing > 0) {
      insights.push({ icon: '📅', text: `${bestDay.day}s are your highest-earning day — you avg $${bestDayAvg.toFixed(0)} on ${bestDay.day}s vs $${overallDayAvg.toFixed(0)} on other days (${mult}x more). Missing one ${bestDay.day} costs you ~$${costOfMissing.toFixed(0)}`, type: 'day', priority: 1 })
    }
  }

  // Best hour — uses pre-computed value
  if (bestHour) {
    const h = parseInt(bestHour.hour)
    const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
    const avgOverall = sessions.reduce((s, x) => s + x.totalUSD, 0) / sessions.length
    const multiplier = avgOverall > 0 ? (bestHour.avg / avgOverall).toFixed(1) : null
    insights.push({ icon: '⏰', text: `Go live at ${label} — your avg session earnings are ${multiplier ? `${multiplier}x higher` : 'at their peak'} at this hour ($${bestHour.avg.toFixed(0)} avg). Missing this window costs you real money every session`, type: 'time', priority: 1 })
  }

  // Whale concentration — use only true Whales (top 5%) for this insight
  // Sharks are included in revenue share but the headline should reflect your real top spenders
  const whales = identifyWhales(tips)
  const trueWhales = whales.filter(w => w.tier === 'Whale')
  const topWhales = (trueWhales.length > 0 ? trueWhales : whales.filter(w => w.tier === 'Shark')).slice(0, 5)
  const wE = topWhales.reduce((s, w) => s + w.totalUSD, 0)
  const tE = tips.reduce((s, t) => s + t.usd, 0)
  if (wE > 0 && tE > 0 && topWhales.length > 0) {
    const pct = Math.round((wE / tE) * 100)
    insights.push({ icon: '🐳', text: `Your top ${topWhales.length} fan${topWhales.length > 1 ? 's' : ''} generate${topWhales.length === 1 ? 's' : ''} ${pct}% of your revenue. Losing even one of them would cost you $${(wE / topWhales.length).toFixed(0)} on average — keep them engaged`, type: 'whales', priority: 2 })
  }

  // Session length vs earnings
  // FIX: exclude durationUnknown sessions (zero-duration exports) from both buckets
  // so we only compare sessions where we actually know the stream length
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

  // Returning vs new tippers
  const fanTipCounts = {}
  const fanTipUSD = {}
  tips.forEach(t => {
    const k = t.username.toLowerCase()
    fanTipCounts[k] = (fanTipCounts[k] || 0) + 1
    fanTipUSD[k] = (fanTipUSD[k] || 0) + (t.usd || 0)
  })
  const returning = Object.values(fanTipCounts).filter(c => c > 1).length
  const total     = Object.keys(fanTipCounts).length
  if (total > 10) {
    const pct = Math.round((returning / total) * 100)
    // Compare avg spend: returning fans (tipped >1 time) vs one-time fans
    const returningKeys = Object.keys(fanTipCounts).filter(k => fanTipCounts[k] > 1)
    const oneTimeKeys   = Object.keys(fanTipCounts).filter(k => fanTipCounts[k] === 1)
    const avgReturning  = returningKeys.length ? returningKeys.reduce((s, k) => s + fanTipUSD[k], 0) / returningKeys.length : 0
    const avgOneTime    = oneTimeKeys.length   ? oneTimeKeys.reduce((s, k) => s + fanTipUSD[k], 0)   / oneTimeKeys.length   : 0
    const multiplierText = avgOneTime > 0 && avgReturning > 0
      ? `${(avgReturning / avgOneTime).toFixed(1)}x more`
      : 'significantly more'
    // FIX: use toFixed(2) for new fan avg so $0.50 doesn't round to $0 or $1
    const fmtAmt = (v) => v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(0)}`
    insights.push({ icon: '🔁', text: `${pct}% of your fans are returning tippers — loyalty is your strongest asset. Returning fans spend ${multiplierText} on average than first-timers (${fmtAmt(avgReturning)} vs ${fmtAmt(avgOneTime)})`, type: 'retention', priority: 3 })
  }

  // Weekly momentum
  const thisWeek = tips.filter(t => (now - new Date(t.dateRaw || t.date_time)) / 86400000 <= 7)
  const lastWeek = tips.filter(t => {
    const d = (now - new Date(t.dateRaw || t.date_time)) / 86400000
    return d > 7 && d <= 14
  })
  if (thisWeek.length > 0 && lastWeek.length > 0) {
    const thisRev = thisWeek.reduce((s, t) => s + t.usd, 0)
    const lastRev = lastWeek.reduce((s, t) => s + t.usd, 0)
    const change  = Math.round(((thisRev - lastRev) / lastRev) * 100)
    if (Math.abs(change) >= 10) {
      insights.push({
        icon: change >= 0 ? '📈' : '📉',
        text: change >= 0
          ? `You're up ${change}% this week vs last week ($${thisRev.toFixed(0)} vs $${lastRev.toFixed(0)}) — keep the momentum going`
          : `You're down ${Math.abs(change)}% this week vs last ($${thisRev.toFixed(0)} vs $${lastRev.toFixed(0)}) — increase stream frequency to recover`,
        type: 'momentum', priority: 2
      })
    }
  }

  return insights.sort((a, b) => a.priority - b.priority)
}

// ============================================
// NEXT MOVE ENGINE
// ============================================

export function generateNextMoves(tips, sessions, whales, predictions, bestHour) {
  const moves = []
  const now = Date.now()

  // Best hour coaching — uses pre-computed bestHour from aggregateRows
  if (bestHour) {
    const bh = parseInt(bestHour.hour)
    const currentHour = new Date().getHours()
    const hoursUntil = (bh - currentHour + 24) % 24
    const avgAtPeak = bestHour.avg
    const label = bh === 0 ? '12 AM' : bh < 12 ? `${bh} AM` : bh === 12 ? '12 PM' : `${bh - 12} PM`
    if (hoursUntil === 0 || hoursUntil === 1) {
      moves.push({ icon: '🔥', color: '#FB923C', text: `Go live NOW — ${label} is your peak earning time. Your data shows you average $${avgAtPeak.toFixed(0)}/session at this hour`, priority: 0 })
    } else if (hoursUntil <= 2) {
      moves.push({ icon: '⏰', color: '#22D3EE', text: `You're ${hoursUntil} hour${hoursUntil > 1 ? 's' : ''} away from your peak time (${label}). Prep your room title and get ready — you avg $${avgAtPeak.toFixed(0)} at this hour`, priority: 1 })
    } else {
      moves.push({ icon: '🕐', color: '#22D3EE', text: `Your best earning time is ${label} — plan your next stream around it. Your data shows $${avgAtPeak.toFixed(0)} avg per session at this hour`, priority: 2 })
    }
  }

  // Tonight prediction
  if (predictions?.tonightStream) {
    const { expected, range, returningTippers } = predictions.tonightStream
    moves.push({ icon: '🎯', color: '#F59E0B', text: `Set a goal of $${Math.round(expected * 1.2)} for tonight — your data predicts $${range.min}–$${range.max} and ~${returningTippers} returning tippers`, priority: 1 })
  }

  // Dormant high-value fans to re-engage
  whales
    .filter(w => {
      const days = Math.floor((now - new Date(w.lastTipDate)) / 86400000)
      return days >= 3 && days <= 45 && w.totalUSD >= 20
    })
    .sort((a, b) => b.totalUSD - a.totalUSD)
    .slice(0, 3)
    .forEach(w => {
      const days = Math.floor((now - new Date(w.lastTipDate)) / 86400000)
      moves.push({ icon: '💸', color: '#EC4899', text: `Message ${w.username} — they've spent $${w.totalUSD.toFixed(0)} total but haven't tipped in ${days} days. One message could recover $${(w.avgTipSize * 2).toFixed(0)}+`, cta: true, username: w.username, priority: 1 })
    })

  // Session goal based on avg
  const avgSession = sessions.length
    ? sessions.reduce((s, x) => s + x.totalUSD, 0) / sessions.length
    : 0
  if (avgSession > 0) {
    const goal = Math.round(avgSession * 1.2 / 5) * 5
    moves.push({ icon: '🏆', color: '#F59E0B', text: `Your sessions average $${avgSession.toFixed(0)} — aim for $${goal} next stream. You've already hit this ${sessions.filter(s => s.totalUSD >= goal).length} times`, priority: 3 })
  }

  return moves.sort((a, b) => a.priority - b.priority).slice(0, 5)
}

// ============================================
// AGGREGATE
// ============================================

export function aggregateRows(tips) {
  if (!tips || tips.length === 0) {
    return {
      totalUSD: 0, totalTokens: 0, totalTips: 0, avgTipSize: 0,
      topTippers: [], platforms: [], sessions: [], insights: [],
      predictions: null, whaleAlerts: [], lossAlerts: [], nextMoves: [],
      bestDay: null, bestHour: null
    }
  }

  const sessions    = detectSessions(tips)

  // ── SINGLE SOURCE OF TRUTH for best day and best hour ──────────────────
  // Method: avg USD per active calendar day (for bestDay)
  //         avg USD per unique UTC hour-bucket (for bestHour)
  // Both use UTC timestamps to match DB storage.

  const dayTipsUSD = {}; const dayActiveDates = {}
  const hourTipsUSD = {}; const hourBucketSets = {}

  tips.forEach(t => {
    const dt = new Date(t.dateRaw || t.date_time)
    if (isNaN(dt.getTime())) return
    // Use LOCAL time (not UTC) — CSV timestamps are stored in local time
    const dow = dt.toLocaleDateString('en-US', { weekday: 'long' })
    const dateKey = dt.toLocaleDateString('en-US')
    const h = dt.getHours()
    const hBucket = Math.floor(dt.getTime() / 3600000)

    if (!dayTipsUSD[dow]) { dayTipsUSD[dow] = 0; dayActiveDates[dow] = new Set() }
    dayTipsUSD[dow] += t.usd || 0
    dayActiveDates[dow].add(dateKey)

    if (!hourTipsUSD[h]) { hourTipsUSD[h] = 0; hourBucketSets[h] = new Set() }
    hourTipsUSD[h] += t.usd || 0
    hourBucketSets[h].add(hBucket)
  })

  const dayAvgs = Object.keys(dayTipsUSD).map(d => ({
    day: d,
    avg: parseFloat((dayTipsUSD[d] / (dayActiveDates[d].size || 1)).toFixed(2)),
    total: dayTipsUSD[d],
    count: dayActiveDates[d].size
  }))
  const hourAvgs = Object.keys(hourTipsUSD).map(h => ({
    hour: h,
    avg: parseFloat((hourTipsUSD[h] / (hourBucketSets[h].size || 1)).toFixed(2)),
    total: hourTipsUSD[h],
    count: hourBucketSets[h].size
  }))

  const bestDay  = [...dayAvgs].sort((a, b) => b.avg - a.avg)[0] || null
  const worstDay = [...dayAvgs].sort((a, b) => a.avg - b.avg)[0] || null
  const bestHour = [...hourAvgs].sort((a, b) => b.avg - a.avg)[0] || null

  const whales      = identifyWhales(tips)
  const insights    = generateInsights(tips, sessions, bestDay, worstDay, bestHour)
  const predictions = predictRevenue(tips, sessions)
  const whaleAlerts = generateWhaleAlerts(whales)
  const lossAlerts  = generateLossAlerts(tips, sessions, whales, bestHour)
  const nextMoves   = generateNextMoves(tips, sessions, whales, predictions, bestHour)

  // FIX performance: single pass for totals
  let totalUSD = 0
  let totalTokens = 0
  for (const t of tips) {
    totalUSD    += t.usd    || 0
    totalTokens += t.tokens || 0
  }

  const platformMap = {}
  sessions.forEach(s => {
    if (!platformMap[s.platform]) {
      platformMap[s.platform] = {
        platform: s.platform, totalUSD: 0, totalTokens: 0,
        sessions: 0, hours: 0, tips: 0
      }
    }
    platformMap[s.platform].totalUSD    += s.totalUSD
    platformMap[s.platform].totalTokens += s.totalTokens
    platformMap[s.platform].sessions    += 1
    // FIX: only count hours for timed sessions (exclude single-tip zero-duration)
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
    rank: i + 1,
    username: w.username,
    usd: w.totalUSD,
    tokens: w.totalTokens,
    count: w.tipCount,
    status: w.tier === 'Whale'   ? '🐳 WHALE'
          : w.tier === 'Shark'   ? '🦈 SHARK'
          : w.tier === 'Dormant' ? '💤 DORMANT'
          :                        '🐟 REGULAR',
    last: new Date(w.lastTipDate).toLocaleDateString(),
    first: new Date(w.firstTipDate).toLocaleDateString(),
    daysSince: w.daysSinceLastTip,
    tipProbability: w.tipProbability,
    churnRisk: w.churnRisk
  }))

  // ── PER-PLATFORM BEST HOUR ────────────────────────────────────────────
  // Formula: avg USD per unique UTC hour-bucket, per platform
  // Only use tips with valid timestamps
  const platHourUSD = {}; const platHourBuckets = {}
  tips.forEach(t => {
    const dt = new Date(t.dateRaw || t.date_time)
    if (isNaN(dt.getTime())) return
    const p = t.platform || 'Unknown'
    const h = dt.getHours() // LOCAL time — matches CSV timestamps
    const bucket = Math.floor(dt.getTime() / 3600000)
    if (!platHourUSD[p]) { platHourUSD[p] = {}; platHourBuckets[p] = {} }
    if (!platHourUSD[p][h]) { platHourUSD[p][h] = 0; platHourBuckets[p][h] = new Set() }
    platHourUSD[p][h] += t.usd || 0
    platHourBuckets[p][h].add(bucket)
  })
  // For each platform: find best hour (highest avg $/hour-bucket)
  const platformBestTimes = {}
  Object.keys(platHourUSD).forEach(plat => {
    const hourAvgList = Object.keys(platHourUSD[plat]).map(h => ({
      hour: parseInt(h),
      avg: parseFloat((platHourUSD[plat][h] / (platHourBuckets[plat][h].size || 1)).toFixed(2)),
      sessionCount: platHourBuckets[plat][h].size
    }))
    // Require at least 2 sessions at an hour to be meaningful
    const qualified = hourAvgList.filter(x => x.sessionCount >= 2)
    const best = (qualified.length ? qualified : hourAvgList).sort((a,b) => b.avg - a.avg)[0]
    if (best) platformBestTimes[plat] = best
  })

  // ── EARNINGS VELOCITY ─────────────────────────────────────────────────
  // Formula: total USD / total timed hours across all sessions
  const timedSessions = sessions.filter(s => !s.durationUnknown && s.durationHours > 0)
  const totalTimedUSD   = timedSessions.reduce((s, x) => s + x.totalUSD, 0)
  const totalTimedHours = timedSessions.reduce((s, x) => s + x.durationHours, 0)
  const earningsVelocity = totalTimedHours > 0
    ? parseFloat((totalTimedUSD / totalTimedHours).toFixed(2))
    : null

  // Per-platform velocity
  const platformVelocity = {}
  Object.keys(platformMap).forEach(plat => {
    const p = platformMap[plat]
    platformVelocity[plat] = p.hours > 0
      ? parseFloat((p.totalUSD / p.hours).toFixed(2))
      : null
  })

  // ── MISSED REVENUE ────────────────────────────────────────────────────
  // Formula (per platform):
  //   potentialGain = (bestHourAvg - overallPlatformAvgPerSession) × sessionsNotAtBestHour
  // Capped at 3x overall avg to avoid misleading huge numbers
  // Only computed if we have enough sessions per platform
  const missedRevenueByPlatform = {}
  Object.keys(platformBestTimes).forEach(plat => {
    const platSessions = sessions.filter(s => s.platform === plat)
    if (platSessions.length < 5) return
    const best = platformBestTimes[plat]
    const overallAvg = platSessions.reduce((s, x) => s + x.totalUSD, 0) / platSessions.length
    const sessionsAtBestHour = platSessions.filter(s => new Date(s.startTime).getHours() === best.hour).length
    const sessionsNotAtBest  = platSessions.length - sessionsAtBestHour
    // Cap the gap at 2x overall avg to avoid astronomical unrealistic numbers
    const gap = Math.min(best.avg - overallAvg, overallAvg * 2)
    const missed = parseFloat((gap * sessionsNotAtBest).toFixed(2))
    if (missed > 0) {
      missedRevenueByPlatform[plat] = {
        bestHourAvg: best.avg,
        overallAvg: parseFloat(overallAvg.toFixed(2)),
        sessionsNotAtBestHour: sessionsNotAtBest,
        missedRevenue: missed,
        bestHour: best.hour,
        multiplier: parseFloat((best.avg / overallAvg).toFixed(1))
      }
    }
  })

  // ── FAN FREQUENCY ─────────────────────────────────────────────────────
  // Already computed on whale objects as: tipCount / activeDays
  // Surfaced here as a summary
  const totalActiveFans = whales.length
  const returningFans   = whales.filter(w => w.tipCount > 1)
  const avgReturnSpend  = returningFans.length
    ? parseFloat((returningFans.reduce((s, w) => s + w.totalUSD, 0) / returningFans.length).toFixed(2))
    : 0
  const newFans       = whales.filter(w => w.tipCount === 1)
  const avgNewSpend   = newFans.length
    ? parseFloat((newFans.reduce((s, w) => s + w.totalUSD, 0) / newFans.length).toFixed(2))
    : 0
  const returningVsNew = {
    returningCount: returningFans.length,
    newCount: newFans.length,
    returningPct: totalActiveFans > 0 ? Math.round((returningFans.length / totalActiveFans) * 100) : 0,
    avgReturnSpend,
    avgNewSpend,
    multiplier: avgNewSpend > 0 ? parseFloat((avgReturnSpend / avgNewSpend).toFixed(1)) : null
  }

  // ── TOP FAN DEPENDENCY ────────────────────────────────────────────────
  // Formula: topN_revenue / total_revenue
  const sortedWhales = [...whales].sort((a, b) => b.totalUSD - a.totalUSD)
  const top1Rev  = sortedWhales[0]?.totalUSD || 0
  const top3Rev  = sortedWhales.slice(0, 3).reduce((s, w) => s + w.totalUSD, 0)
  const top5Rev  = sortedWhales.slice(0, 5).reduce((s, w) => s + w.totalUSD, 0)
  const topFanDependency = totalUSD > 0 ? {
    top1Pct:  Math.round((top1Rev  / totalUSD) * 100),
    top3Pct:  Math.round((top3Rev  / totalUSD) * 100),
    top5Pct:  Math.round((top5Rev  / totalUSD) * 100),
    lossIfTopFanLeaves: parseFloat(top1Rev.toFixed(2))
  } : null

  // ── MONTHLY BREAKDOWN ─────────────────────────────────────────────
  const monthlyMap = {}
  tips.forEach(t => {
    const dt = new Date(t.dateRaw || t.date_time)
    if (isNaN(dt.getTime())) return
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}`
    if (!monthlyMap[key]) monthlyMap[key] = { month: key, usd: 0, tips: 0, fans: new Set(), sessions: 0 }
    monthlyMap[key].usd += t.usd || 0
    monthlyMap[key].tips += 1
    monthlyMap[key].fans.add(t.username)
  })
  // Count sessions per month
  sessions.forEach(s => {
    const dt = new Date(s.startTime)
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}`
    if (monthlyMap[key]) monthlyMap[key].sessions += 1
  })
  const monthlyData = Object.values(monthlyMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({
      month: m.month,
      usd: parseFloat(m.usd.toFixed(2)),
      tips: m.tips,
      fans: m.fans.size,
      sessions: m.sessions,
      usdPerFan: m.fans.size > 0 ? parseFloat((m.usd / m.fans.size).toFixed(2)) : 0
    }))
  const bestMonth = [...monthlyData].sort((a,b) => b.usd - a.usd)[0] || null
  const worstMonth = [...monthlyData].sort((a,b) => a.usd - b.usd)[0] || null

  // ── TIP TYPE BREAKDOWN ─────────────────────────────────────────────
  const tipTypeMap = {}
  tips.forEach(t => {
    const type = t.tip_type || 'Tip'
    if (!tipTypeMap[type]) tipTypeMap[type] = { type, usd: 0, count: 0, fans: new Set() }
    tipTypeMap[type].usd += t.usd || 0
    tipTypeMap[type].count += 1
    tipTypeMap[type].fans.add(t.username)
  })
  const tipTypeBreakdown = Object.values(tipTypeMap)
    .map(t => ({ ...t, fans: t.fans.size, avgUsd: parseFloat((t.usd / t.count).toFixed(2)), pct: parseFloat(((t.usd / totalUSD) * 100).toFixed(1)) }))
    .sort((a, b) => b.usd - a.usd)

  // Private show specific insights
  const privateShowFans = Object.values((() => {
    const m = {}
    tips.filter(t => (t.tip_type||'').toLowerCase().includes('private')).forEach(t => {
      if (!m[t.username]) m[t.username] = { username: t.username, usd: 0, count: 0 }
      m[t.username].usd += t.usd || 0
      m[t.username].count += 1
    })
    return m
  })()).sort((a,b) => b.usd - a.usd)

  const spyShowFans = [...new Set(tips.filter(t => (t.tip_type||'').toLowerCase().includes('spy')).map(t => t.username))]

  return {
    totalUSD: parseFloat(totalUSD.toFixed(2)),
    totalTokens,
    totalTips: tips.length,
    avgTipSize: parseFloat((tips.length > 0 ? totalUSD / tips.length : 0).toFixed(2)),
    topTippers, platforms, sessions, insights: validateInsights(insights), predictions,
    whaleAlerts, lossAlerts, nextMoves, whales,
    bestDay, bestHour,
    monthlyData, bestMonth, worstMonth,
    tipTypeBreakdown, privateShowFans, spyShowFans,
    // ── New advanced analytics ──
    platformBestTimes,    // { platform: { hour, avg, sessionCount } }
    earningsVelocity,     // overall $/hour (null if no timed sessions)
    platformVelocity,     // { platform: $/hour }
    missedRevenueByPlatform, // { platform: { bestHourAvg, overallAvg, sessionsNotAtBestHour, missedRevenue, bestHour } }
    returningVsNew,       // { returningCount, newCount, returningPct, avgReturnSpend, avgNewSpend, multiplier }
    topFanDependency      // { top1Pct, top3Pct, top5Pct, lossIfTopFanLeaves }
  }
}

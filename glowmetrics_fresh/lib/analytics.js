// ============================================
// CAMCASH COMPLETE ANALYTICS ENGINE
// ============================================

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

  if (hasHeaders) return parseWithHeaders(lines, platform)
  else return parseHeaderless(lines, platform)
}

function detectPlatform(text) {
  const lower = text.toLowerCase()
  if (lower.includes('chaturbate') || lower.includes('tip from:') || lower.includes('token balance') || lower.includes('token change')) return 'Chaturbate'
  if (lower.includes('bongacams') || lower.includes('bonga') || lower.includes('your payout')) return 'BongaCams'
  if (lower.includes('myfreecams') || lower.includes('mfc')) return 'MyFreeCams'
  if (lower.includes('stripchat')) return 'Stripchat'
  if (lower.includes('camsoda')) return 'CamSoda'
  return 'Unknown'
}

function normalizeDate(raw) {
  if (!raw) return raw
  // European DD.MM.YYYY HH:MM
  const euro = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}:\d{2}))?/)
  if (euro) {
    const [, day, month, year, time] = euro
    return `${month}/${day}/${year}${time ? ' ' + time : ''}`
  }
  return raw
}

function normalizeHeaderName(h) {
  const clean = h.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')
  // Must check token_balance BEFORE tokens to avoid false match
  if (['token_balance', 'balance', 'running_balance'].includes(clean)) return 'token_balance'
  if (['token_change', 'tokens_earned', 'tokens', 'token', 'credits'].includes(clean)) return 'tokens'
  if (['your_payout', 'usd_amount', 'payout', 'usd', 'earnings', 'amount_usd'].includes(clean)) return 'usd'
  if (['date_and_time', 'date_time', 'datetime', 'timestamp', 'date', 'time'].includes(clean)) return 'date_time'
  if (['member', 'username', 'user', 'tipper', 'sender', 'nickname', 'from'].includes(clean)) return 'username'
  if (['transaction_type', 'chat_type', 'tip_type', 'type'].includes(clean)) return 'tip_type'
  if (clean === 'action') return 'action'
  if (clean === 'note') return 'note'
  if (clean === 'platform') return 'platform'
  if (clean === 'session_id') return 'session_id'
  return clean
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
    headers.forEach((h, idx) => { row[h] = (vals[idx] || '').trim() })

    // ── Skip non-revenue rows ──────────────────────────────────────────
    const action = (row.action || '').toLowerCase()
    const tipType = (row.tip_type || '').toLowerCase()

    // Chaturbate: skip cashouts and transfers
    if (action.includes('transfer') || action.includes('cash') ||
        action.includes('outbound tip') || action.includes('promoted room') ||
        action.includes('referral')) continue

    // Chaturbate_csv / transactions__2_ style: skip non-tip transaction types
    if (tipType && !tipType.includes('tip') && !tipType.includes('private') &&
        !tipType.includes('spy') && !tipType.includes('show') && !tipType.includes('chat') &&
        !tipType.includes('received') && !tipType.includes('freechat')) continue

    // Skip explicit cashouts in tip_type
    if (tipType.includes('cash') || tipType.includes('transfer') ||
        tipType.includes('payout') || tipType.includes('refund')) continue

    // ── Extract username ───────────────────────────────────────────────
    let username = (row.username || row.user || '').trim()

    // Chaturbate Action column: "Tip From: username message"
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

    // ── Extract tokens ─────────────────────────────────────────────────
    let tokens = parseInt(row.tokens || 0) || 0
    // token_change can be negative (cashout) — skip negatives
    if (tokens < 0) continue
    // For Chaturbate_csv Token change column stored as 'tokens' after normalization
    // it could be negative for cashouts — already handled above

    // ── Extract USD ────────────────────────────────────────────────────
    const rawUsd = (row.usd || row.usd_amount || '0').toString().replace(/[$,\s]/g, '')
    let usd = parseFloat(rawUsd) || 0
    if (usd < 0) usd = 0

    if (tokens <= 0 && usd <= 0) continue

    // ── Extract date ───────────────────────────────────────────────────
    const rawDate = row.date_time || row.date || row.timestamp || ''
    const dateRaw = normalizeDate(rawDate) || new Date().toISOString()

    // ── Detect platform from row if available ──────────────────────────
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
      tokens: tokens || Math.round(usd / 0.05),
      usd: usd || parseFloat((tokens * 0.05).toFixed(2)),
      tip_type: row.tip_type || 'Tip',
      tip_note: row.note || row.tip_note || ''
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

    // Chaturbate "Tip From: username message" format
    if (vals.length >= 3 && vals[1] && vals[1].toLowerCase().includes('tip from')) {
      const dateRaw = normalizeDate(vals[0].replace(/"/g, ''))
      const m = vals[1].match(/tip from[:\s]*(\S+)/i)
      const username = m ? m[1] : null
      const tokens = parseInt(vals[2]) || 0
      if (!username || tokens <= 0) continue
      if (vals[1].toLowerCase().includes('transfer') || vals[1].toLowerCase().includes('cash')) continue
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
      results.push({
        dateRaw, date_time: dateRaw, username,
        platform: platform || 'BongaCams',
        tokens: tokens || Math.round(usd / 0.05),
        usd: usd || parseFloat((tokens * 0.05).toFixed(2)),
        tip_type: vals[2] || 'Tip', tip_note: ''
      })
      continue
    }

    // Generic fallback
    if (vals.length >= 2) {
      const dateRaw = normalizeDate(vals[0]) || vals[0]
      const username = (vals[1] || '').trim()
      if (!username) continue
      let tokens = 0, usd = 0
      for (let i = 2; i < vals.length; i++) {
        const num = parseFloat(vals[i].replace(/[$,]/g, ''))
        if (!isNaN(num) && num > 0) {
          if (num > 100) tokens = Math.round(num)
          else usd = num
        }
      }
      if (tokens === 0 && usd === 0) continue
      results.push({
        dateRaw, date_time: dateRaw, username,
        platform: platform || 'Unknown',
        tokens: tokens || Math.round(usd / 0.05),
        usd: usd || parseFloat((tokens * 0.05).toFixed(2)),
        tip_type: 'Tip', tip_note: ''
      })
    }
  }
  return results
}

function parseCSVLine(line) {
  const result = []
  let current = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') inQuotes = !inQuotes
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else current += char
  }
  result.push(current.trim())
  return result.filter(v => v !== '')
}

// ============================================
// SESSION DETECTION
// ============================================

export function detectSessions(tips) {
  if (!tips || tips.length === 0) return []
  const parsed = tips.map(t => ({ ...t, timestamp: new Date(t.dateRaw || t.date_time) }))
    .filter(t => !isNaN(t.timestamp.getTime()))
    .sort((a, b) => a.timestamp - b.timestamp)
  if (parsed.length === 0) return []
  const SESSION_GAP_MS = 3 * 60 * 60 * 1000
  const sessions = []
  let cur = null
  parsed.forEach(tip => {
    if (!cur) {
      cur = { tips: [tip], platform: tip.platform, startTime: tip.timestamp, endTime: tip.timestamp, fans: new Set([tip.username.toLowerCase()]) }
    } else if (tip.timestamp - cur.endTime <= SESSION_GAP_MS && tip.platform === cur.platform) {
      cur.tips.push(tip); cur.endTime = tip.timestamp; cur.fans.add(tip.username.toLowerCase())
    } else {
      sessions.push(finalizeSession(cur))
      cur = { tips: [tip], platform: tip.platform, startTime: tip.timestamp, endTime: tip.timestamp, fans: new Set([tip.username.toLowerCase()]) }
    }
  })
  if (cur && cur.tips.length > 0) sessions.push(finalizeSession(cur))
  return sessions
}

function finalizeSession(s) {
  const durationMs = s.endTime - s.startTime
  const durationMinutes = Math.max(Math.round(durationMs / 60000), 30)
  const durationHours = durationMinutes / 60
  const totalTokens = s.tips.reduce((sum, t) => sum + (t.tokens || 0), 0)
  const totalUSD = s.tips.reduce((sum, t) => sum + (t.usd || 0), 0)
  const tipCount = s.tips.length
  const uniqueFans = s.fans.size
  return {
    id: `session_${s.startTime.getTime()}`, platform: s.platform,
    startTime: s.startTime.toISOString(), endTime: s.endTime.toISOString(),
    durationMinutes, durationHours: parseFloat(durationHours.toFixed(2)),
    totalTokens, totalUSD: parseFloat(totalUSD.toFixed(2)),
    tipCount, uniqueFans,
    tokensPerHour: durationHours > 0 ? Math.round(totalTokens / durationHours) : 0,
    usdPerHour: durationHours > 0 ? parseFloat((totalUSD / durationHours).toFixed(2)) : 0,
    avgTipSize: tipCount > 0 ? parseFloat((totalUSD / tipCount).toFixed(2)) : 0,
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
    if (!fanMap[key]) fanMap[key] = { username: t.username, totalUSD: 0, totalTokens: 0, tipCount: 0, tips: [], platform: t.platform, tipNotes: [] }
    fanMap[key].totalUSD += t.usd || 0
    fanMap[key].totalTokens += t.tokens || 0
    fanMap[key].tipCount += 1
    fanMap[key].tips.push(t)
    if (t.tip_note) fanMap[key].tipNotes.push(t.tip_note)
  })
  return Object.values(fanMap).map(f => {
    const sorted = f.tips.sort((a, b) => new Date(b.dateRaw || b.date_time) - new Date(a.dateRaw || a.date_time))
    const lastTipDate = new Date(sorted[0].dateRaw || sorted[0].date_time)
    const firstTipDate = new Date(sorted[sorted.length - 1].dateRaw || sorted[sorted.length - 1].date_time)
    const daysSinceLastTip = Math.floor((Date.now() - lastTipDate) / 86400000)
    const lifetimeDays = Math.max(Math.floor((lastTipDate - firstTipDate) / 86400000), 1)
    const avgDaysBetweenTips = f.tipCount > 1 ? lifetimeDays / (f.tipCount - 1) : 30
    const biggestTip = Math.max(...f.tips.map(t => t.usd))
    let tier = 'Regular'
    if (f.totalUSD >= 500) tier = 'Whale'
    else if (f.totalUSD >= 100) tier = 'Shark'
    else if (daysSinceLastTip > 60) tier = 'Dormant'
    const privateTips = f.tips.filter(t => t.tip_type?.toLowerCase().includes('private') || t.tip_note?.toLowerCase().includes('private'))
    const hourCounts = {}
    f.tips.forEach(t => { const h = new Date(t.dateRaw || t.date_time).getHours(); hourCounts[h] = (hourCounts[h] || 0) + 1 })
    const mostActiveHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]
    return {
      username: f.username, totalUSD: parseFloat(f.totalUSD.toFixed(2)),
      totalTokens: f.totalTokens, tipCount: f.tipCount,
      avgTipSize: parseFloat((f.totalUSD / f.tipCount).toFixed(2)),
      biggestTip: parseFloat(biggestTip.toFixed(2)), platform: f.platform, tier,
      lastTipDate: lastTipDate.toISOString(), firstTipDate: firstTipDate.toISOString(),
      daysSinceLastTip, avgDaysBetweenTips: parseFloat(avgDaysBetweenTips.toFixed(1)),
      tipProbability: calcTipProbability(daysSinceLastTip, avgDaysBetweenTips),
      churnRisk: calcChurnRisk(daysSinceLastTip, avgDaysBetweenTips, f.tipCount),
      lifetimeValue: calcLifetimeValue(f.totalUSD, lifetimeDays, f.tipCount),
      expectedNextTip: calcExpectedNextTip(daysSinceLastTip, avgDaysBetweenTips),
      hasPrivates: privateTips.length > 0, privateCount: privateTips.length,
      privateSpent: parseFloat(privateTips.reduce((s, t) => s + t.usd, 0).toFixed(2)),
      typicalOnlineHours: mostActiveHour ? `${mostActiveHour[0]}:00 - ${parseInt(mostActiveHour[0]) + 2}:00` : 'Unknown',
      tipNotes: f.tipNotes, tips: f.tips
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

function calcChurnRisk(d, avg, count) {
  if (count < 3) return { level: 'Unknown', risk: 'Insufficient data' }
  const r = d / avg
  if (r < 1) return { level: 'Low', risk: 'Active' }
  if (r < 2) return { level: 'Medium', risk: 'Watch closely' }
  if (r < 3) return { level: 'High', risk: 'At risk' }
  return { level: 'Critical', risk: 'Likely churned' }
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
  if (n <= 3) return `In ${n} days`
  if (n <= 7) return `In ~${n} days`
  return `In ~${Math.round(n / 7)} weeks`
}

// ============================================
// WHALE ALERTS
// ============================================

export function generateWhaleAlerts(whales) {
  const alerts = []
  whales.forEach(w => {
    if (w.tier === 'Whale' && w.daysSinceLastTip < 7 && w.totalUSD >= 500 && w.totalUSD < 600)
      alerts.push({ type: 'new_whale', severity: 'success', icon: '🐳', whale: w.username, message: `${w.username} just became a whale! ($${w.totalUSD} lifetime)`, action: 'Send thank you message' })
    if ((w.churnRisk.level === 'High' || w.churnRisk.level === 'Critical') && w.totalUSD >= 100)
      alerts.push({ type: 'churn_risk', severity: 'warning', icon: '⚠️', whale: w.username, message: `${w.username} hasn't tipped in ${w.daysSinceLastTip} days (usually every ${w.avgDaysBetweenTips.toFixed(0)} days)`, action: 'Re-engage now' })
    if (w.tipProbability.level === 'High' && w.totalUSD >= 200)
      alerts.push({ type: 'tip_likely', severity: 'info', icon: '💰', whale: w.username, message: `${w.username} likely to tip soon (${w.tipProbability.percentage}% probability)`, action: 'Go live during their active hours' })
  })
  const order = { critical: 0, warning: 1, info: 2, success: 3 }
  return alerts.sort((a, b) => order[a.severity] - order[b.severity])
}

// ============================================
// REVENUE PREDICTIONS
// ============================================

export function predictRevenue(tips, sessions) {
  if (!sessions.length) return null
  const predictions = {}
  const last7 = tips.filter(t => (Date.now() - new Date(t.dateRaw || t.date_time)) / 86400000 <= 7)
  predictions.next7Days = { amount: parseFloat(last7.reduce((s, t) => s + t.usd, 0).toFixed(2)), confidence: last7.length > 20 ? 'High' : last7.length > 10 ? 'Medium' : 'Low' }
  const last30 = tips.filter(t => (Date.now() - new Date(t.dateRaw || t.date_time)) / 86400000 <= 30)
  predictions.next30Days = { amount: parseFloat(last30.reduce((s, t) => s + t.usd, 0).toFixed(2)), confidence: last30.length > 50 ? 'High' : last30.length > 25 ? 'Medium' : 'Low' }
  const same = sessions.filter(s => new Date(s.startTime).getDay() === new Date().getDay())
  if (same.length > 2) {
    const avg = same.reduce((s, x) => s + x.totalUSD, 0) / same.length
    predictions.tonightStream = { expected: parseFloat(avg.toFixed(2)), range: { min: parseFloat(Math.min(...same.map(s => s.totalUSD)).toFixed(2)), max: parseFloat(Math.max(...same.map(s => s.totalUSD)).toFixed(2)) }, confidence: same.length > 5 ? 'High' : 'Medium' }
  }
  return predictions
}

// ============================================
// INSIGHTS
// ============================================

export function generateInsights(tips, sessions) {
  const insights = []
  if (!tips.length || !sessions.length) return insights
  const dayE = {}
  sessions.forEach(s => { const d = new Date(s.startTime).toLocaleDateString('en-US', { weekday: 'long' }); dayE[d] = (dayE[d] || 0) + s.totalUSD })
  const bestDay = Object.entries(dayE).sort((a, b) => b[1] - a[1])[0]
  if (bestDay) {
    const avg = Object.values(dayE).reduce((a, b) => a + b, 0) / Object.keys(dayE).length
    const pct = Math.round(((bestDay[1] - avg) / avg) * 100)
    if (pct > 10) insights.push({ icon: '📅', text: `${bestDay[0]}s earn ${pct}% more than average`, type: 'day' })
  }
  const hourE = {}
  sessions.forEach(s => { const h = new Date(s.startTime).getHours(); hourE[h] = (hourE[h] || 0) + s.totalUSD })
  const bestHour = Object.entries(hourE).sort((a, b) => b[1] - a[1])[0]
  if (bestHour) {
    const h = parseInt(bestHour[0])
    const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
    insights.push({ icon: '⏰', text: `Peak earnings around ${label}`, type: 'time' })
  }
  const whales = identifyWhales(tips)
  const wE = whales.filter(w => w.tier === 'Whale').reduce((s, w) => s + w.totalUSD, 0)
  const tE = tips.reduce((s, t) => s + t.usd, 0)
  if (wE > 0) insights.push({ icon: '🐳', text: `Top ${whales.filter(w => w.tier === 'Whale').length} whales generate ${Math.round((wE / tE) * 100)}% of revenue`, type: 'whales' })
  return insights
}

// ============================================
// AGGREGATE
// ============================================

export function aggregateRows(tips) {
  if (!tips || tips.length === 0) {
    return { totalUSD: 0, totalTokens: 0, totalTips: 0, avgTipSize: 0, topTippers: [], platforms: [], sessions: [], insights: [], predictions: null, whaleAlerts: [] }
  }
  const sessions = detectSessions(tips)
  const whales = identifyWhales(tips)
  const insights = generateInsights(tips, sessions)
  const predictions = predictRevenue(tips, sessions)
  const whaleAlerts = generateWhaleAlerts(whales)
  const totalUSD = tips.reduce((s, t) => s + (t.usd || 0), 0)
  const totalTokens = tips.reduce((s, t) => s + (t.tokens || 0), 0)
  const platformMap = {}
  sessions.forEach(s => {
    if (!platformMap[s.platform]) platformMap[s.platform] = { platform: s.platform, totalUSD: 0, totalTokens: 0, sessions: 0, hours: 0, tips: 0 }
    platformMap[s.platform].totalUSD += s.totalUSD
    platformMap[s.platform].totalTokens += s.totalTokens
    platformMap[s.platform].sessions += 1
    platformMap[s.platform].hours += s.durationHours
    platformMap[s.platform].tips += s.tipCount
  })
  const platforms = Object.values(platformMap).map(p => ({
    ...p,
    usdPerHour: p.hours > 0 ? parseFloat((p.totalUSD / p.hours).toFixed(2)) : 0,
    tokensPerHour: p.hours > 0 ? Math.round(p.totalTokens / p.hours) : 0,
    avgTipSize: p.tips > 0 ? parseFloat((p.totalUSD / p.tips).toFixed(2)) : 0
  }))
  const topTippers = whales.map((w, i) => ({
    rank: i + 1, username: w.username, usd: w.totalUSD, tokens: w.totalTokens, count: w.tipCount,
    status: w.tier === 'Whale' ? '🐳 WHALE' : w.tier === 'Shark' ? '🦈 SHARK' : w.tier === 'Dormant' ? '💤 DORMANT' : '🐟 REGULAR',
    last: new Date(w.lastTipDate).toLocaleDateString(), first: new Date(w.firstTipDate).toLocaleDateString(),
    daysSince: w.daysSinceLastTip, tipProbability: w.tipProbability, churnRisk: w.churnRisk
  }))
  return {
    totalUSD: parseFloat(totalUSD.toFixed(2)), totalTokens, totalTips: tips.length,
    avgTipSize: parseFloat((tips.length > 0 ? totalUSD / tips.length : 0).toFixed(2)),
    topTippers, platforms, sessions, insights, predictions, whaleAlerts, whales
  }
}

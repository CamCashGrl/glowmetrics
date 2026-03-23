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
  // European DD.MM.YYYY
  const euro = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}:\d{2}))?/)
  if (euro) return `${euro[2]}/${euro[1]}/${euro[3]}${euro[4] ? ' ' + euro[4] : ''}`
  // YYYY/MM/DD
  const slash = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})(.*)/)
  if (slash) return `${slash[1]}-${slash[2]}-${slash[3]}${slash[4]}`
  // ISO with Z: 2026-03-01T22:14:03Z
  return raw.replace('T', ' ').replace('Z', '')
}

function normalizeHeaderName(h) {
  const clean = re_clean(h)
  if (['token_balance','balance','running_balance'].includes(clean)) return 'token_balance'
  // Amount (tokens), Amount (USD) style headers
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
  // Handle case where entire row is wrapped in quotes: "col1,col2,col3"
  const trimmed = line.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && !trimmed.slice(1, -1).includes('"')) {
    return trimmed.slice(1, -1).split(',').map(v => v.trim()).filter(v => v !== '')
  }
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

  const allFans = Object.values(fanMap)
  const sorted = [...allFans].sort((a, b) => b.totalUSD - a.totalUSD)
  const totalFans = sorted.length

  // Dynamic thresholds based on THIS user's actual data
  const whaleThreshold = totalFans >= 10 ? sorted[Math.floor(totalFans * 0.05)].totalUSD : (sorted[0]?.totalUSD || 0) * 0.7
  const sharkThreshold = totalFans >= 5 ? sorted[Math.floor(totalFans * 0.15)].totalUSD : (sorted[0]?.totalUSD || 0) * 0.3
  const avgSpend = allFans.reduce((s, f) => s + f.totalUSD, 0) / (allFans.length || 1)

  return allFans.map(f => {
    const fanSorted = f.tips.sort((a, b) => new Date(b.dateRaw || b.date_time) - new Date(a.dateRaw || a.date_time))
    const lastTipDate = new Date(fanSorted[0].dateRaw || fanSorted[0].date_time)
    const firstTipDate = new Date(fanSorted[fanSorted.length - 1].dateRaw || fanSorted[fanSorted.length - 1].date_time)
    const daysSinceLastTip = Math.floor((Date.now() - lastTipDate) / 86400000)
    const lifetimeDays = Math.max(Math.floor((lastTipDate - firstTipDate) / 86400000), 1)
    const avgDaysBetweenTips = f.tipCount > 1 ? lifetimeDays / (f.tipCount - 1) : 30
    const biggestTip = Math.max(...f.tips.map(t => t.usd))

    // Dynamic tier assignment
    let tier = 'Regular'
    if (f.totalUSD >= whaleThreshold && f.totalUSD >= avgSpend * 3) tier = 'Whale'
    else if (f.totalUSD >= sharkThreshold && f.totalUSD >= avgSpend * 1.5) tier = 'Shark'
    else if (daysSinceLastTip > Math.max(60, avgDaysBetweenTips * 3)) tier = 'Dormant'

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
      tipNotes: f.tipNotes, tips: f.tips,
      // Expose thresholds for UI context
      isTopSpender: f.totalUSD >= whaleThreshold,
      spendPercentile: Math.round((1 - sorted.findIndex(s => s.username === f.username) / totalFans) * 100)
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
  if (!whales.length) return alerts

  // Dynamic thresholds from this user's actual data
  const totalSpend = whales.reduce((s, w) => s + w.totalUSD, 0)
  const avgSpend = totalSpend / whales.length
  const topSpenders = whales.filter(w => w.tier === 'Whale' || w.tier === 'Shark')
  const churnThreshold = avgSpend * 0.5 // anyone above half the avg spend matters
  const tipLikelyThreshold = avgSpend * 0.8

  whales.forEach(w => {
    // New top tipper crossed into Whale tier recently
    if (w.tier === 'Whale' && w.daysSinceLastTip < 7 && w.isTopSpender)
      alerts.push({ type: 'new_whale', severity: 'success', icon: '🐳', whale: w.username, message: `${w.username} just became your top tipper! ($${w.totalUSD.toFixed(0)} lifetime)`, action: 'Send a thank you message' })

    // Churn risk — scaled to their data
    if ((w.churnRisk.level === 'High' || w.churnRisk.level === 'Critical') && w.totalUSD >= churnThreshold)
      alerts.push({ type: 'churn_risk', severity: 'warning', icon: '⚠️', whale: w.username, message: `${w.username} hasn't tipped in ${w.daysSinceLastTip} days — they usually tip every ${w.avgDaysBetweenTips.toFixed(0)} days`, action: 'Re-engage now before they go cold' })

    // High tip probability — scaled to their data
    if (w.tipProbability.level === 'High' && w.totalUSD >= tipLikelyThreshold)
      alerts.push({ type: 'tip_likely', severity: 'info', icon: '💰', whale: w.username, message: `${w.username} is likely to tip soon (${w.tipProbability.percentage}% probability based on their pattern)`, action: 'Go live during their active hours' })

    // Returning after long absence
    if (w.daysSinceLastTip > 0 && w.daysSinceLastTip <= 3 && w.tipCount > 5) {
      const prevGap = w.avgDaysBetweenTips
      if (w.daysSinceLastTip > prevGap * 1.5)
        alerts.push({ type: 'returned', severity: 'success', icon: '🎉', whale: w.username, message: `${w.username} just tipped again after ${w.daysSinceLastTip} days away — welcome them back!`, action: 'Send a thank you message' })
    }
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
  const now = Date.now()

  const last7 = tips.filter(t => (now - new Date(t.dateRaw || t.date_time)) / 86400000 <= 7)
  const last7Rev = last7.reduce((s, t) => s + t.usd, 0)
  predictions.next7Days = { amount: parseFloat(last7Rev.toFixed(2)), confidence: last7.length > 20 ? 'High' : last7.length > 10 ? 'Medium' : 'Low' }

  const last30 = tips.filter(t => (now - new Date(t.dateRaw || t.date_time)) / 86400000 <= 30)
  const last30Rev = last30.reduce((s, t) => s + t.usd, 0)
  const prev30 = tips.filter(t => { const d = (now - new Date(t.dateRaw || t.date_time)) / 86400000; return d > 30 && d <= 60 })
  const prev30Rev = prev30.reduce((s, t) => s + t.usd, 0)
  const weeklyTrend = prev30Rev > 0 ? ((last30Rev - prev30Rev) / prev30Rev) * 100 : null
  predictions.next30Days = { amount: parseFloat(last30Rev.toFixed(2)), confidence: last30.length > 50 ? 'High' : last30.length > 25 ? 'Medium' : 'Low', trend: weeklyTrend !== null ? parseFloat(weeklyTrend.toFixed(1)) : null }

  // Tonight prediction based on same day of week history
  const todayDow = new Date().getDay()
  const sameDaySessions = sessions.filter(s => new Date(s.startTime).getDay() === todayDow)
  if (sameDaySessions.length > 2) {
    const avg = sameDaySessions.reduce((s, x) => s + x.totalUSD, 0) / sameDaySessions.length
    const min = Math.min(...sameDaySessions.map(s => s.totalUSD))
    const max = Math.max(...sameDaySessions.map(s => s.totalUSD))
    predictions.tonightStream = {
      expected: parseFloat(avg.toFixed(2)),
      range: { min: parseFloat(min.toFixed(2)), max: parseFloat(max.toFixed(2)) },
      confidence: sameDaySessions.length > 5 ? 'High' : 'Medium',
      returningTippers: Math.round(sameDaySessions.reduce((s, x) => s + x.uniqueFans, 0) / sameDaySessions.length * 0.4)
    }
  }

  return predictions
}

// ============================================
// LOSS ALERTS
// ============================================

export function generateLossAlerts(tips, sessions, whales) {
  const alerts = []
  const now = Date.now()

  // Peak window missed
  const hourE = {}
  sessions.forEach(s => { const h = new Date(s.startTime).getHours(); hourE[h] = (hourE[h] || 0) + s.totalUSD })
  const bestHourEntry = Object.entries(hourE).sort((a, b) => b[1] - a[1])[0]
  if (bestHourEntry) {
    const bestHour = parseInt(bestHourEntry[0])
    const avgAtPeak = bestHourEntry[1] / sessions.filter(s => new Date(s.startTime).getHours() === bestHour).length
    const recentSessions = sessions.filter(s => (now - new Date(s.startTime)) / 86400000 <= 3)
    const recentAtPeak = recentSessions.filter(s => Math.abs(new Date(s.startTime).getHours() - bestHour) <= 1)
    if (recentSessions.length > 0 && recentAtPeak.length === 0) {
      const daysMissed = 3
      const estLoss = parseFloat((avgAtPeak * daysMissed).toFixed(2))
      const label = bestHour === 0 ? '12 AM' : bestHour < 12 ? `${bestHour} AM` : bestHour === 12 ? '12 PM' : `${bestHour - 12} PM`
      alerts.push({ type: 'peak_missed', severity: 'warning', icon: '🚨', message: `You haven't streamed during your peak window (${label}) in ${daysMissed} days — estimated loss: $${estLoss}`, action: `Go live at ${label} to recover this` })
    }
  }

  // Avg tip drop this week vs last week
  const thisWeek = tips.filter(t => (now - new Date(t.dateRaw || t.date_time)) / 86400000 <= 7)
  const lastWeek = tips.filter(t => { const d = (now - new Date(t.dateRaw || t.date_time)) / 86400000; return d > 7 && d <= 14 })
  if (thisWeek.length >= 5 && lastWeek.length >= 5) {
    const thisAvg = thisWeek.reduce((s, t) => s + t.usd, 0) / thisWeek.length
    const lastAvg = lastWeek.reduce((s, t) => s + t.usd, 0) / lastWeek.length
    const drop = Math.round(((lastAvg - thisAvg) / lastAvg) * 100)
    if (drop >= 15) alerts.push({ type: 'tip_drop', severity: 'warning', icon: '📉', message: `Your avg tip dropped ${drop}% this week ($${lastAvg.toFixed(2)} → $${thisAvg.toFixed(2)})`, action: 'Focus on high-value fans during your next stream' })
  }

  // High-value fan churn risk
  whales.filter(w => w.totalUSD >= 50 && w.daysSinceLastTip >= 5 && w.daysSinceLastTip < 30).slice(0, 2).forEach(w => {
    alerts.push({ type: 'fan_churn', severity: 'critical', icon: '🚨', message: `${w.username} hasn't tipped in ${w.daysSinceLastTip} days — high churn risk ($${w.totalUSD.toFixed(0)} lifetime value)`, action: 'Send a re-engagement message now' })
  })

  // Streak broken
  const daySet = new Set(sessions.map(s => new Date(s.startTime).toDateString()))
  let streak = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(now - i * 86400000).toDateString()
    if (daySet.has(d)) streak++
    else if (i > 0) break
  }
  const lastStreamed = sessions.length ? (now - new Date(sessions[sessions.length - 1].startTime)) / 86400000 : 999
  if (lastStreamed > 2 && sessions.length > 5) {
    alerts.push({ type: 'streak_broken', severity: 'info', icon: '⏸️', message: `You haven't streamed in ${Math.floor(lastStreamed)} days — your audience engagement drops after 3 days off`, action: 'Get back live — consistency is your #1 growth tool' })
  }

  return alerts
}

// ============================================
// INSIGHTS (ACTION-ORIENTED)
// ============================================

export function generateInsights(tips, sessions) {
  const insights = []
  if (!tips.length || !sessions.length) return insights
  const now = Date.now()

  // Best day → action + cost of missing it
  const dayE = {}; const dayCount = {}
  sessions.forEach(s => {
    const d = new Date(s.startTime).toLocaleDateString('en-US', { weekday: 'long' })
    dayE[d] = (dayE[d] || 0) + s.totalUSD
    dayCount[d] = (dayCount[d] || 0) + 1
  })
  const bestDay = Object.entries(dayE).sort((a, b) => b[1] - a[1])[0]
  const worstDay = Object.entries(dayE).sort((a, b) => a[1] - b[1])[0]
  if (bestDay && worstDay && bestDay[0] !== worstDay[0]) {
    const avgPerSession = dayE[bestDay[0]] / dayCount[bestDay[0]]
    const avgOverall = Object.values(dayE).reduce((a, b) => a + b, 0) / sessions.length
    const mult = (avgPerSession / avgOverall).toFixed(1)
    const costOfMissing = parseFloat((avgPerSession - avgOverall).toFixed(2))
    insights.push({ icon: '📅', text: `${bestDay[0]}s are your highest-earning day — your avg session earns ${mult}x more. Missing one ${bestDay[0]} costs you ~$${costOfMissing}`, type: 'day', priority: 1 })
  }

  // Best hour → go live action
  const hourE = {}; const hourCount = {}
  sessions.forEach(s => {
    const h = new Date(s.startTime).getHours()
    hourE[h] = (hourE[h] || 0) + s.totalUSD
    hourCount[h] = (hourCount[h] || 0) + 1
  })
  const bestHour = Object.entries(hourE).sort((a, b) => b[1] - a[1])[0]
  const worstHour = Object.entries(hourE).sort((a, b) => a[1] - b[1])[0]
  if (bestHour) {
    const h = parseInt(bestHour[0])
    const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
    const avgAtBest = bestHour[1] / hourCount[bestHour[0]]
    const avgAtWorst = worstHour ? worstHour[1] / hourCount[worstHour[0]] : 0
    const multiplier = avgAtWorst > 0 ? (avgAtBest / avgAtWorst).toFixed(1) : null
    insights.push({ icon: '⏰', text: `Go live at ${label} — your earnings are ${multiplier ? `${multiplier}x higher` : 'at their peak'} at this time. Missing this window costs you real money every session`, type: 'time', priority: 1 })
  }

  // Whale concentration
  const whales = identifyWhales(tips)
  const topWhales = whales.filter(w => w.tier === 'Whale' || w.tier === 'Shark')
  const wE = topWhales.reduce((s, w) => s + w.totalUSD, 0)
  const tE = tips.reduce((s, t) => s + t.usd, 0)
  if (wE > 0 && tE > 0) {
    const pct = Math.round((wE / tE) * 100)
    insights.push({ icon: '🐳', text: `Your top ${topWhales.length} fans generate ${pct}% of your revenue. Losing even one of them would cost you $${(wE / topWhales.length).toFixed(0)} on average — keep them engaged`, type: 'whales', priority: 2 })
  }

  // Session length vs earnings
  const longSessions = sessions.filter(s => s.durationMinutes > 60)
  const shortSessions = sessions.filter(s => s.durationMinutes <= 60)
  if (longSessions.length >= 3 && shortSessions.length >= 3) {
    const longAvg = longSessions.reduce((s, x) => s + x.totalUSD, 0) / longSessions.length
    const shortAvg = shortSessions.reduce((s, x) => s + x.totalUSD, 0) / shortSessions.length
    if (longAvg > shortAvg * 1.2) {
      const pct = Math.round(((longAvg - shortAvg) / shortAvg) * 100)
      insights.push({ icon: '⏱️', text: `Streams over 60 min earn ${pct}% more than short ones ($${longAvg.toFixed(0)} vs $${shortAvg.toFixed(0)}). Every extra 30 minutes adds ~$${((longAvg - shortAvg) / 2).toFixed(0)} on average`, type: 'duration', priority: 2 })
    }
  }

  // Returning vs new tippers
  const fanTipCounts = {}
  tips.forEach(t => { fanTipCounts[t.username.toLowerCase()] = (fanTipCounts[t.username.toLowerCase()] || 0) + 1 })
  const returning = Object.values(fanTipCounts).filter(c => c > 1).length
  const total = Object.keys(fanTipCounts).length
  if (total > 10) {
    const pct = Math.round((returning / total) * 100)
    insights.push({ icon: '🔁', text: `${pct}% of your fans are returning tippers — loyalty is your strongest asset. Each returning fan is worth ${(tE / tips.length * 3).toFixed(0)}x more than a first-timer`, type: 'retention', priority: 3 })
  }

  // Weekly momentum
  const thisWeek = tips.filter(t => (now - new Date(t.dateRaw || t.date_time)) / 86400000 <= 7)
  const lastWeek = tips.filter(t => { const d = (now - new Date(t.dateRaw || t.date_time)) / 86400000; return d > 7 && d <= 14 })
  if (thisWeek.length > 0 && lastWeek.length > 0) {
    const thisRev = thisWeek.reduce((s, t) => s + t.usd, 0)
    const lastRev = lastWeek.reduce((s, t) => s + t.usd, 0)
    const change = Math.round(((thisRev - lastRev) / lastRev) * 100)
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

export function generateNextMoves(tips, sessions, whales, predictions) {
  const moves = []
  const now = Date.now()

  // Best hour coaching
  const hourE = {}; const hourCount = {}
  sessions.forEach(s => {
    const h = new Date(s.startTime).getHours()
    hourE[h] = (hourE[h] || 0) + s.totalUSD
    hourCount[h] = (hourCount[h] || 0) + 1
  })
  const bestHourEntry = Object.entries(hourE).sort((a, b) => b[1] - a[1])[0]
  if (bestHourEntry) {
    const bestHour = parseInt(bestHourEntry[0])
    const currentHour = new Date().getHours()
    const hoursUntil = ((bestHour - currentHour + 24) % 24)
    const avgAtPeak = bestHourEntry[1] / hourCount[bestHourEntry[0]]
    const label = bestHour === 0 ? '12 AM' : bestHour < 12 ? `${bestHour} AM` : bestHour === 12 ? '12 PM' : `${bestHour - 12} PM`
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
  const dormant = whales.filter(w => { const days = Math.floor((now - new Date(w.lastTipDate)) / 86400000); return days >= 3 && days <= 45 && w.totalUSD >= 20 }).sort((a, b) => b.totalUSD - a.totalUSD).slice(0, 3)
  dormant.forEach(w => {
    const days = Math.floor((now - new Date(w.lastTipDate)) / 86400000)
    moves.push({ icon: '💸', color: '#EC4899', text: `Message ${w.username} — they've spent $${w.totalUSD.toFixed(0)} total but haven't tipped in ${days} days. One message could recover $${(w.avgTipSize * 2).toFixed(0)}+`, cta: true, username: w.username, priority: 1 })
  })

  // Session goal based on avg
  const avgSession = sessions.length ? sessions.reduce((s, x) => s + x.totalUSD, 0) / sessions.length : 0
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
    return { totalUSD: 0, totalTokens: 0, totalTips: 0, avgTipSize: 0, topTippers: [], platforms: [], sessions: [], insights: [], predictions: null, whaleAlerts: [], lossAlerts: [], nextMoves: [] }
  }
  const sessions = detectSessions(tips)
  const whales = identifyWhales(tips)
  const insights = generateInsights(tips, sessions)
  const predictions = predictRevenue(tips, sessions)
  const whaleAlerts = generateWhaleAlerts(whales)
  const lossAlerts = generateLossAlerts(tips, sessions, whales)
  const nextMoves = generateNextMoves(tips, sessions, whales, predictions)
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
    topTippers, platforms, sessions, insights, predictions, whaleAlerts, lossAlerts, nextMoves, whales
  }
}

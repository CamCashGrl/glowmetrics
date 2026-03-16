// ============================================
// CAMCASH COMPLETE ANALYTICS ENGINE
// ============================================
// Universal CSV parser + Session detection + Whale tracking + Smart insights
// ============================================

// ============================================
// UNIVERSAL CSV PARSER
// ============================================
// Handles: Chaturbate, BongaCams, MyFreeCams, Stripchat, all formats

export function parseCSV(text, platform = null) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length === 0) return []

  if (!platform) {
    platform = detectPlatform(text)
  }

  const firstLine = lines[0].toLowerCase()
  const hasHeaders = firstLine.includes('date') || firstLine.includes('username') || 
                     firstLine.includes('amount') || firstLine.includes('tokens') ||
                     firstLine.includes('timestamp') || firstLine.includes('tip')

  if (hasHeaders) {
    return parseWithHeaders(lines, platform)
  } else {
    return parseHeaderless(lines, platform)
  }
}

function detectPlatform(text) {
  const lower = text.toLowerCase()
  if (lower.includes('chaturbate') || lower.includes('tip from:')) return 'Chaturbate'
  if (lower.includes('bongacams') || lower.includes('bonga')) return 'BongaCams'
  if (lower.includes('myfreecams') || lower.includes('mfc')) return 'MyFreeCams'
  if (lower.includes('stripchat')) return 'Stripchat'
  if (lower.includes('camsoda')) return 'CamSoda'
  return 'Unknown'
}

function parseWithHeaders(lines, platform) {
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
  const results = []

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i])
    if (vals.length === 0) continue

    const row = {}
    headers.forEach((h, idx) => {
      row[h] = vals[idx] || ''
    })

    const parsed = extractTipData(row, platform)
    if (parsed) results.push(parsed)
  }

  return results
}

function parseHeaderless(lines, platform) {
  const results = []

  for (const line of lines) {
    const vals = parseCSVLine(line)
    if (vals.length === 0) continue

    // Chaturbate "Tip From:" format (case insensitive)
    if (vals.length >= 3 && vals[1]) {
      const val1Lower = vals[1].toLowerCase()
      if (val1Lower.includes('tip from:') || val1Lower.includes('tip from ')) {
        const dateRaw = vals[0].replace(/"/g, '')
        const actionMatch = vals[1].match(/tip from[:\s]+([^\s,]+)/i)
        const username = actionMatch ? actionMatch[1] : 'anonymous'
        const tokens = parseInt(vals[2]) || 0
        if (tokens <= 0) continue
        results.push({
          dateRaw,
          username,
          platform: 'Chaturbate',
          tokens,
          usd: parseFloat((tokens * 0.05).toFixed(2)),
          tip_type: 'Tip'
        })
        continue
      }
    }

    // BongaCams DD.MM.YYYY format
    if (vals.length >= 4 && vals[0].match(/\d{2}\.\d{2}\.\d{4}/)) {
      const dateRaw = vals[0]
      const username = vals[1] || 'anonymous'
      const tokens = parseInt(vals[3]) || 0
      const usd = parseFloat(vals[4]?.replace('$', '')) || 0
      if (tokens <= 0 && usd <= 0) continue
      results.push({
        dateRaw,
        username,
        platform: platform || 'BongaCams',
        tokens: tokens || Math.round(usd / 0.05),
        usd: usd || parseFloat((tokens * 0.05).toFixed(2)),
        tip_type: vals[2] || 'Tip'
      })
      continue
    }

    const parsed = extractTipDataFromArray(vals, platform)
    if (parsed) results.push(parsed)
  }

  return results
}

function extractTipData(row, platform) {
  const username = row.username || row.user || row.tipper || row.from || 'anonymous'
  const tokens = parseInt(row.tokens || row['token change'] || row.amount || row.credits || 0)
  const usd = parseFloat(row.usd || row.usd_amount || row.amount_usd || row.earnings || 0)
  
  // Handle various date formats
  const dateRaw = row.date_time || row['date_time'] || row.date_time || row['date_time'] || 
                  row.date || row.Date || row.timestamp || row.Timestamp || row.time || row.Time || 
                  new Date().toISOString()
  
  const tipType = row.tip_type || row.Tip_Type || row.type || row.Type || row['transaction type'] || 'Tip'

  if (tokens <= 0 && usd <= 0) return null

  return {
    dateRaw,
    username: username.trim(),
    platform: platform || 'Unknown',
    tokens: tokens || Math.round(usd / 0.05),
    usd: usd || parseFloat((tokens * 0.05).toFixed(2)),
    tip_type: tipType
  }
}

function extractTipDataFromArray(vals, platform) {
  if (vals.length < 2) return null

  let dateRaw = vals[0]
  let username = vals[1] || 'anonymous'
  let tokens = 0
  let usd = 0

  for (let i = 2; i < vals.length; i++) {
    const num = parseFloat(vals[i])
    if (!isNaN(num) && num > 0) {
      if (num > 100) {
        tokens = num
      } else {
        usd = num
      }
    }
  }

  if (tokens === 0 && usd === 0) return null

  return {
    dateRaw,
    username: username.trim(),
    platform: platform || 'Unknown',
    tokens: tokens || Math.round(usd / 0.05),
    usd: usd || parseFloat((tokens * 0.05).toFixed(2)),
    tip_type: 'Tip'
  }
}

function parseCSVLine(line) {
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
  
  result.push(current.trim())
  return result.filter(v => v !== '')
}

// ============================================
// SESSION DETECTION
// ============================================
// Auto-detect streaming sessions from tip timestamps
// 3-hour gap = new session

export function detectSessions(tips) {
  if (!tips || tips.length === 0) return []

  const parsed = tips
    .map(t => ({
      ...t,
      timestamp: new Date(t.dateRaw || t.date_time)
    }))
    .filter(t => !isNaN(t.timestamp.getTime()))
    .sort((a, b) => a.timestamp - b.timestamp)

  if (parsed.length === 0) return []

  const SESSION_GAP_MS = 3 * 60 * 60 * 1000 // 3 hours
  const sessions = []
  let currentSession = null

  parsed.forEach(tip => {
    if (!currentSession) {
      currentSession = {
        tips: [tip],
        platform: tip.platform,
        startTime: tip.timestamp,
        endTime: tip.timestamp,
        fans: new Set([tip.username.toLowerCase()])
      }
    } else {
      const timeSinceLastTip = tip.timestamp - currentSession.endTime

      if (timeSinceLastTip <= SESSION_GAP_MS && tip.platform === currentSession.platform) {
        currentSession.tips.push(tip)
        currentSession.endTime = tip.timestamp
        currentSession.fans.add(tip.username.toLowerCase())
      } else {
        sessions.push(finalizeSession(currentSession))
        currentSession = {
          tips: [tip],
          platform: tip.platform,
          startTime: tip.timestamp,
          endTime: tip.timestamp,
          fans: new Set([tip.username.toLowerCase()])
        }
      }
    }
  })

  if (currentSession && currentSession.tips.length > 0) {
    sessions.push(finalizeSession(currentSession))
  }

  return sessions
}

function finalizeSession(session) {
  const durationMs = session.endTime - session.startTime
  const durationMinutes = Math.max(Math.round(durationMs / (1000 * 60)), 30)
  const durationHours = durationMinutes / 60
  
  const totalTokens = session.tips.reduce((sum, t) => sum + (t.tokens || 0), 0)
  const totalUSD = session.tips.reduce((sum, t) => sum + (t.usd || 0), 0)
  const tipCount = session.tips.length
  const uniqueFans = session.fans.size

  const tokensPerHour = durationHours > 0 ? Math.round(totalTokens / durationHours) : 0
  const usdPerHour = durationHours > 0 ? parseFloat((totalUSD / durationHours).toFixed(2)) : 0
  const avgTipSize = tipCount > 0 ? parseFloat((totalUSD / tipCount).toFixed(2)) : 0

  return {
    id: `session_${session.startTime.getTime()}`,
    platform: session.platform,
    startTime: session.startTime.toISOString(),
    endTime: session.endTime.toISOString(),
    durationMinutes,
    durationHours: parseFloat(durationHours.toFixed(2)),
    totalTokens,
    totalUSD: parseFloat(totalUSD.toFixed(2)),
    tipCount,
    uniqueFans,
    tokensPerHour,
    usdPerHour,
    avgTipSize,
    tips: session.tips
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
        username: t.username,
        totalUSD: 0,
        totalTokens: 0,
        tipCount: 0,
        tips: [],
        platform: t.platform
      }
    }
    fanMap[key].totalUSD += t.usd || 0
    fanMap[key].totalTokens += t.tokens || 0
    fanMap[key].tipCount += 1
    fanMap[key].tips.push(t)
  })

  return Object.values(fanMap)
    .map(f => {
      const sortedTips = f.tips.sort((a, b) => new Date(b.dateRaw || b.date_time) - new Date(a.dateRaw || a.date_time))
      const lastTip = sortedTips[0]
      const firstTip = sortedTips[sortedTips.length - 1]
      
      const lastTipDate = new Date(lastTip.dateRaw || lastTip.date_time)
      const daysSinceLastTip = Math.floor((Date.now() - lastTipDate) / (1000 * 60 * 60 * 24))
      
      // Whale tiers
      let tier = 'Regular'
      if (f.totalUSD >= 500) tier = 'Whale'
      else if (f.totalUSD >= 100) tier = 'Shark'
      else if (daysSinceLastTip > 60) tier = 'Dormant'

      return {
        username: f.username,
        totalUSD: parseFloat(f.totalUSD.toFixed(2)),
        totalTokens: f.totalTokens,
        tipCount: f.tipCount,
        avgTipSize: parseFloat((f.totalUSD / f.tipCount).toFixed(2)),
        platform: f.platform,
        tier,
        lastTipDate: lastTipDate.toISOString(),
        firstTipDate: new Date(firstTip.dateRaw || firstTip.date_time).toISOString(),
        daysSinceLastTip,
        tips: f.tips
      }
    })
    .sort((a, b) => b.totalUSD - a.totalUSD)
}

// ============================================
// SMART INSIGHTS ENGINE
// ============================================

export function generateInsights(tips, sessions) {
  const insights = []

  if (!tips.length || !sessions.length) return insights

  // Best day of week
  const dayEarnings = {}
  sessions.forEach(s => {
    const day = new Date(s.startTime).toLocaleDateString('en-US', { weekday: 'long' })
    dayEarnings[day] = (dayEarnings[day] || 0) + s.totalUSD
  })
  const bestDay = Object.entries(dayEarnings).sort((a, b) => b[1] - a[1])[0]
  if (bestDay) {
    const avgDay = Object.values(dayEarnings).reduce((a, b) => a + b, 0) / Object.keys(dayEarnings).length
    const percentBetter = Math.round(((bestDay[1] - avgDay) / avgDay) * 100)
    if (percentBetter > 10) {
      insights.push({
        icon: '📅',
        text: `Your earnings are ${percentBetter}% higher on ${bestDay[0]}s.`,
        type: 'day'
      })
    }
  }

  // Best hour
  const hourEarnings = {}
  sessions.forEach(s => {
    const hour = new Date(s.startTime).getHours()
    hourEarnings[hour] = (hourEarnings[hour] || 0) + s.totalUSD
  })
  const bestHour = Object.entries(hourEarnings).sort((a, b) => b[1] - a[1])[0]
  if (bestHour) {
    const hourLabel = parseInt(bestHour[0]) === 0 ? '12 AM' : 
                      parseInt(bestHour[0]) < 12 ? `${bestHour[0]} AM` :
                      parseInt(bestHour[0]) === 12 ? '12 PM' : `${parseInt(bestHour[0]) - 12} PM`
    insights.push({
      icon: '⏰',
      text: `Most of your whales tip between ${hourLabel} and ${parseInt(bestHour[0]) + 1} ${parseInt(bestHour[0]) >= 11 ? 'PM' : 'AM'}.`,
      type: 'time'
    })
  }

  // Whale contribution
  const whales = identifyWhales(tips)
  const whaleEarnings = whales.filter(w => w.tier === 'Whale').reduce((sum, w) => sum + w.totalUSD, 0)
  const totalEarnings = tips.reduce((sum, t) => sum + t.usd, 0)
  if (whaleEarnings > 0) {
    const whalePercent = Math.round((whaleEarnings / totalEarnings) * 100)
    insights.push({
      icon: '🐳',
      text: `Your top ${whales.filter(w => w.tier === 'Whale').length} whales generate ${whalePercent}% of your revenue.`,
      type: 'whales'
    })
  }

  // Session length
  const avgSessionMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0) / sessions.length
  const longSessions = sessions.filter(s => s.durationMinutes > avgSessionMinutes)
  const longSessionEarnings = longSessions.reduce((sum, s) => sum + s.totalUSD, 0) / longSessions.length
  const shortSessionEarnings = sessions.filter(s => s.durationMinutes <= avgSessionMinutes).reduce((sum, s) => sum + s.totalUSD, 0) / (sessions.length - longSessions.length)
  if (longSessionEarnings > shortSessionEarnings * 1.2) {
    insights.push({
      icon: '⏱️',
      text: `Longer streams (${Math.round(avgSessionMinutes)}+ min) earn ${Math.round(((longSessionEarnings - shortSessionEarnings) / shortSessionEarnings) * 100)}% more.`,
      type: 'duration'
    })
  }

  return insights
}

// ============================================
// AGGREGATE ANALYTICS
// ============================================

export function aggregateRows(tips) {
  if (!tips || tips.length === 0) {
    return {
      totalUSD: 0,
      totalTokens: 0,
      totalTips: 0,
      avgTipSize: 0,
      topTippers: [],
      platforms: [],
      sessions: [],
      insights: []
    }
  }

  const sessions = detectSessions(tips)
  const whales = identifyWhales(tips)
  const insights = generateInsights(tips, sessions)

  const totalUSD = tips.reduce((sum, t) => sum + (t.usd || 0), 0)
  const totalTokens = tips.reduce((sum, t) => sum + (t.tokens || 0), 0)
  const avgTipSize = tips.length > 0 ? totalUSD / tips.length : 0

  // Platform breakdown
  const platformMap = {}
  sessions.forEach(s => {
    if (!platformMap[s.platform]) {
      platformMap[s.platform] = {
        platform: s.platform,
        totalUSD: 0,
        totalTokens: 0,
        sessions: 0,
        hours: 0
      }
    }
    platformMap[s.platform].totalUSD += s.totalUSD
    platformMap[s.platform].totalTokens += s.totalTokens
    platformMap[s.platform].sessions += 1
    platformMap[s.platform].hours += s.durationHours
  })

  const platforms = Object.values(platformMap).map(p => ({
    ...p,
    usdPerHour: p.hours > 0 ? parseFloat((p.totalUSD / p.hours).toFixed(2)) : 0,
    tokensPerHour: p.hours > 0 ? Math.round(p.totalTokens / p.hours) : 0
  }))

  // Format whales for UI
  const topTippers = whales.map((w, i) => ({
    rank: i + 1,
    username: w.username,
    usd: w.totalUSD,
    tokens: w.totalTokens,
    count: w.tipCount,
    status: w.tier === 'Whale' ? '🐳 WHALE' : 
            w.tier === 'Shark' ? '🦈 SHARK' :
            w.tier === 'Dormant' ? '💤 DORMANT' : '🐟 REGULAR',
    last: new Date(w.lastTipDate).toLocaleDateString(),
    first: new Date(w.firstTipDate).toLocaleDateString(),
    daysSince: w.daysSinceLastTip
  }))

  return {
    totalUSD: parseFloat(totalUSD.toFixed(2)),
    totalTokens,
    totalTips: tips.length,
    avgTipSize: parseFloat(avgTipSize.toFixed(2)),
    topTippers,
    platforms,
    sessions,
    insights
  }
}

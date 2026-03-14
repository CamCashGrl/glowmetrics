// ============================================
// GLOWMETRICS CSV-BASED ANALYTICS ENGINE
// ============================================
// Session detection and engagement metrics
// calculated ONLY from CSV tip data
// ============================================

export function parseCSV(text, platform = null) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length === 0) return []

  if (!platform) {
    platform = detectPlatform(text)
  }

  const firstLine = lines[0].toLowerCase()
  const hasHeaders = firstLine.includes('date') || firstLine.includes('username') || firstLine.includes('amount') || firstLine.includes('tokens')

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
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
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

    if (vals.length === 4 && vals[1] && vals[1].toLowerCase().includes('tip from:')) {
      const dateRaw = vals[0]
      const actionMatch = vals[1].match(/tip from:\s*([^\s,]+)/i)
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

    const parsed = extractTipDataFromArray(vals, platform)
    if (parsed) results.push(parsed)
  }

  return results
}

function extractTipData(row, platform) {
  const username = row.username || row.user || row.tipper || row.from || 'anonymous'
  const tokens = parseInt(row.tokens || row.amount || row.credits || 0)
  const usd = parseFloat(row.usd || row.amount_usd || row.earnings || 0)
  const dateRaw = row.date || row.timestamp || row.date_time || row.time || new Date().toISOString()
  const tipType = row.type || row.tip_type || 'Tip'

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
// SESSION DETECTION FROM CSV TIP DATA
// ============================================
// 3-hour gap threshold
// ONLY uses tip timestamps - no external data
// ============================================

export function detectSessions(tips, platformId = null) {
  if (!tips || tips.length === 0) return []

  // Parse dates and sort chronologically
  const parsed = tips
    .map(t => ({
      ...t,
      timestamp: new Date(t.dateRaw || t.date_time)
    }))
    .filter(t => !isNaN(t.timestamp.getTime()))
    .sort((a, b) => a.timestamp - b.timestamp)

  if (parsed.length === 0) return []

  const SESSION_GAP_MS = 3 * 60 * 60 * 1000 // 3 hours in milliseconds
  const sessions = []
  let currentSession = null

  parsed.forEach(tip => {
    if (!currentSession) {
      // Start first session
      currentSession = {
        tips: [tip],
        platform: tip.platform,
        startTime: tip.timestamp,
        endTime: tip.timestamp,
        fans: new Set([tip.username.toLowerCase()])
      }
    } else {
      const timeSinceLastTip = tip.timestamp - currentSession.endTime

      // Check if tip belongs to current session (within 3 hours)
      if (timeSinceLastTip <= SESSION_GAP_MS && tip.platform === currentSession.platform) {
        // Add to current session
        currentSession.tips.push(tip)
        currentSession.endTime = tip.timestamp
        currentSession.fans.add(tip.username.toLowerCase())
      } else {
        // Save completed session and start new one
        sessions.push(finalizeSession(currentSession, platformId))
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

  // Don't forget last session
  if (currentSession && currentSession.tips.length > 0) {
    sessions.push(finalizeSession(currentSession, platformId))
  }

  return sessions
}

function finalizeSession(session, platformId) {
  const durationMs = session.endTime - session.startTime
  const durationMinutes = Math.max(Math.round(durationMs / (1000 * 60)), 30) // Min 30 minutes
  const durationHours = durationMinutes / 60
  
  const totalTokens = session.tips.reduce((sum, t) => sum + (t.tokens || 0), 0)
  const totalUSD = session.tips.reduce((sum, t) => sum + (t.usd || 0), 0)
  const tipCount = session.tips.length
  const uniqueFans = session.fans.size

  // Engagement metrics from tip data only
  const tokensPerHour = durationHours > 0 ? Math.round(totalTokens / durationHours) : 0
  const avgTipSize = tipCount > 0 ? parseFloat((totalUSD / tipCount).toFixed(2)) : 0
  const tipFrequency = durationMinutes > 0 ? parseFloat((tipCount / durationMinutes).toFixed(3)) : 0

  return {
    platform: session.platform,
    platform_id: platformId,
    session_start_time: session.startTime.toISOString(),
    session_end_time: session.endTime.toISOString(),
    duration_minutes: durationMinutes,
    total_tokens: totalTokens,
    total_usd: parseFloat(totalUSD.toFixed(2)),
    tip_count: tipCount,
    unique_fans: uniqueFans,
    tokens_per_hour: tokensPerHour,
    average_tip_size: avgTipSize,
    tip_frequency: tipFrequency,
    show_type: null, // User can add manually
    notes: null
  }
}

// ============================================
// ANALYTICS FROM CSV DATA ONLY
// ============================================
// All metrics calculated from tip timestamps
// No external data sources
// ============================================

export function buildAnalytics(tips, sessions = null) {
  if (!tips || tips.length === 0) {
    return {
      totalUSD: 0,
      totalTips: 0,
      totalTokens: 0,
      uniqueFans: 0,
      totalSessions: 0,
      totalMinutesStreamed: 0,
      avgSessionLength: 0,
      avgEarningsPerSession: 0,
      avgTokensPerHour: 0,
      sessions: [],
      topFans: [],
      platforms: []
    }
  }

  // Auto-detect sessions if not provided
  if (!sessions || sessions.length === 0) {
    sessions = detectSessions(tips)
  }

  // Parse dates
  const parsed = tips.map(t => ({
    ...t,
    timestamp: new Date(t.dateRaw || t.date_time)
  })).filter(t => !isNaN(t.timestamp.getTime()))

  // Basic totals
  const totalUSD = parsed.reduce((sum, t) => sum + (t.usd || 0), 0)
  const totalTokens = parsed.reduce((sum, t) => sum + (t.tokens || 0), 0)
  const totalTips = parsed.length
  const uniqueFans = new Set(parsed.map(t => t.username.toLowerCase())).size

  // Session analytics
  const totalMinutes = sessions.reduce((sum, s) => sum + s.duration_minutes, 0)
  const totalSessionEarnings = sessions.reduce((sum, s) => sum + s.total_usd, 0)
  const avgSessionLength = sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0
  const avgEarningsPerSession = sessions.length > 0 ? parseFloat((totalSessionEarnings / sessions.length).toFixed(2)) : 0
  const avgTokensPerHour = totalMinutes > 0 ? Math.round((totalTokens / totalMinutes) * 60) : 0

  // Top fans
  const fanMap = {}
  parsed.forEach(t => {
    const key = t.username.toLowerCase()
    if (!fanMap[key]) {
      fanMap[key] = {
        username: t.username,
        totalUSD: 0,
        totalTokens: 0,
        tipCount: 0,
        platform: t.platform
      }
    }
    fanMap[key].totalUSD += t.usd || 0
    fanMap[key].totalTokens += t.tokens || 0
    fanMap[key].tipCount += 1
  })

  const topFans = Object.values(fanMap)
    .map((f, idx) => ({
      rank: idx + 1,
      username: f.username,
      totalUSD: parseFloat(f.totalUSD.toFixed(2)),
      totalTokens: f.totalTokens,
      tipCount: f.tipCount,
      avgTipSize: parseFloat((f.totalUSD / f.tipCount).toFixed(2)),
      platform: f.platform,
      tier: f.totalUSD >= 500 ? 'Whale' : f.totalUSD >= 100 ? 'Shark' : 'Regular'
    }))
    .sort((a, b) => b.totalUSD - a.totalUSD)

  // Platform breakdown
  const platformMap = {}
  sessions.forEach(s => {
    const p = s.platform
    if (!platformMap[p]) {
      platformMap[p] = {
        platform: p,
        totalUSD: 0,
        totalTokens: 0,
        sessions: 0,
        minutes: 0
      }
    }
    platformMap[p].totalUSD += s.total_usd
    platformMap[p].totalTokens += s.total_tokens
    platformMap[p].sessions += 1
    platformMap[p].minutes += s.duration_minutes
  })

  const platforms = Object.values(platformMap).map(p => ({
    ...p,
    avgPerHour: p.minutes > 0 ? parseFloat(((p.totalUSD / p.minutes) * 60).toFixed(2)) : 0
  }))

  return {
    totalUSD: parseFloat(totalUSD.toFixed(2)),
    totalTips,
    totalTokens,
    uniqueFans,
    totalSessions: sessions.length,
    totalMinutesStreamed: totalMinutes,
    avgSessionLength,
    avgEarningsPerSession,
    avgTokensPerHour,
    sessions: sessions.sort((a, b) => new Date(b.session_start_time) - new Date(a.session_start_time)),
    topFans,
    platforms
  }
}

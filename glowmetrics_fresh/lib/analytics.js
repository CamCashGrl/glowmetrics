// ============================================
// ENHANCED WHALE DEEP DIVE ANALYTICS
// With search, profiles, AI predictions, notes
// ============================================

// ============================================
// BULLETPROOF CSV PARSER - ZERO TOLERANCE
// ============================================

export function parseCSV(text, platform = null) {
  if (!text || text.trim().length === 0) {
    return {
      success: false,
      error: {
        type: 'empty_file',
        message: "Empty file uploaded",
        fix: "Please upload a CSV file with your tip data"
      }
    }
  }

  const cleaned = cleanCSVText(text)
  const detectedPlatform = platform || detectPlatform(cleaned)
  const lines = cleaned.split('\n').filter(l => l.trim())
  
  if (lines.length === 0) {
    return {
      success: false,
      error: {
        type: 'no_data',
        message: "No valid data rows found",
        fix: "Your CSV appears empty. Check the file and try again."
      }
    }
  }

  const headerValidation = validateHeaders(lines[0])
  
  if (!headerValidation.valid) {
    return {
      success: false,
      needsConfirmation: true,
      error: headerValidation.error,
      suggestions: headerValidation.suggestions,
      detectedPlatform
    }
  }

  const hasHeaders = headerValidation.hasHeaders
  let parseResult
  
  if (hasHeaders) {
    parseResult = parseWithHeaders(lines, detectedPlatform, headerValidation.normalizedHeaders)
  } else {
    parseResult = parseHeaderless(lines, detectedPlatform)
  }

  const validation = strictValidate(parseResult.data, detectedPlatform)
  
  if (!validation.valid) {
    return {
      success: false,
      needsConfirmation: false,
      error: validation.error,
      issues: validation.issues,
      sampleRows: parseResult.data.slice(0, 3),
      detectedPlatform
    }
  }

  const confirmationData = buildConfirmationData(validation.data, detectedPlatform)
  
  return {
    success: true,
    needsConfirmation: true,
    data: validation.data,
    platform: detectedPlatform,
    confirmation: confirmationData,
    warnings: validation.needsWarning ? validation.warningMessage : null,
    skipped: validation.skipped || [],
    stats: {
      total: validation.data.length,
      dateRange: {
        earliest: confirmationData.dateRange.earliest,
        latest: confirmationData.dateRange.latest
      },
      totalRevenue: confirmationData.totalRevenue,
      topTipper: confirmationData.topTipper
    }
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function cleanCSVText(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  text = text.split('\n').filter(l => l.trim()).join('\n')
  text = text.replace(/=""(.*?)""/g, '$1')
  return text
}

function detectPlatform(text) {
  const lower = text.toLowerCase()
  const markers = {
    'Chaturbate': ['chaturbate', 'tip from:', 'tokens received'],
    'BongaCams': ['bongacams', 'bonga', 'credits earned'],
    'MyFreeCams': ['myfreecams', 'mfc', 'tokens earned'],
    'Stripchat': ['stripchat'],
    'CamSoda': ['camsoda']
  }
  
  for (const [platform, keywords] of Object.entries(markers)) {
    if (keywords.some(k => lower.includes(k))) return platform
  }
  
  if (lower.includes('username') && lower.includes('tokens')) return 'Chaturbate'
  return 'Unknown'
}

function validateHeaders(firstLine) {
  const lower = firstLine.toLowerCase()
  const cols = parseCSVLine(firstLine)
  
  // Special case: If first data column contains "tip from:", it's headerless Chaturbate data
  if (cols.length >= 2 && cols[1].toLowerCase().includes('tip from')) {
    return { valid: true, hasHeaders: false, normalizedHeaders: [] }
  }
  
  const required = {
    date: ['date', 'time', 'datetime', 'timestamp', 'date_time'],
    username: ['username', 'user', 'tipper', 'from', 'sender', 'nickname'],
    amount: ['token', 'tokens', 'credits', 'amount', 'usd', 'earnings', 'dollars']
  }
  
  const found = { date: false, username: false, amount: false }
  const suggestions = []
  
  cols.forEach(col => {
    const colLower = col.toLowerCase().trim()
    if (required.date.some(v => colLower.includes(v))) found.date = true
    if (required.username.some(v => colLower.includes(v))) found.username = true
    if (required.amount.some(v => colLower.includes(v))) found.amount = true
    
    if (colLower === 'site' || colLower === 'source') {
      suggestions.push({
        found: col,
        suggest: 'platform',
        reason: 'Platform/site column detected but not named "platform"'
      })
    }
    if (colLower === 'name' || colLower === 'member') {
      suggestions.push({
        found: col,
        suggest: 'username',
        reason: 'User column detected but should be "username"'
      })
    }
  })
  
  const hasHeaderKeywords = required.date.concat(required.username, required.amount)
    .some(keyword => lower.includes(keyword))
  
  // If looks like data (has date pattern), not headers
  if (!hasHeaderKeywords && /\d{1,2}[\/\-\.]\d{1,2}/.test(firstLine)) {
    return { valid: true, hasHeaders: false, normalizedHeaders: [] }
  }
  
  const missing = []
  if (!found.date) missing.push('date/time')
  if (!found.username) missing.push('username')
  if (!found.amount) missing.push('tokens or USD amount')
  
  if (missing.length > 0) {
    return {
      valid: false,
      error: {
        type: 'missing_columns',
        message: `❌ Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
        fix: `Your CSV must have these columns:\n• Date or DateTime\n• Username or User\n• Tokens or USD amount`
      },
      suggestions,
      hasHeaders: true
    }
  }
  
  const normalized = normalizeHeaders(cols)
  return { valid: true, hasHeaders: true, normalizedHeaders: normalized, suggestions }
}

function normalizeHeaders(headers) {
  return headers.map(h => {
    const clean = h.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_')
    const mappings = {
      'date_time': ['datetime', 'timestamp', 'date', 'time'],
      'username': ['username', 'user', 'tipper', 'from', 'sender'],
      'tokens': ['tokens', 'token_change', 'token', 'credits', 'amount', 'quantity'],
      'usd': ['usd', 'usd_amount', 'amount_usd', 'dollars', 'earnings', 'revenue'],
      'tip_type': ['type', 'transaction_type', 'category'],
      'platform': ['platform', 'site', 'source']
    }
    
    for (const [standard, variations] of Object.entries(mappings)) {
      if (variations.some(v => clean.includes(v))) return standard
    }
    return clean
  })
}

function parseWithHeaders(lines, platform, normalizedHeaders) {
  const data = []
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i])
    const row = {}
    normalizedHeaders.forEach((h, idx) => {
      row[h] = vals[idx] || ''
    })
    
    // Skip non-tip transactions (like "Tokens cashed out")
    const transactionType = (row.tip_type || row.transaction_type || '').toLowerCase()
    if (transactionType.includes('cashed') || transactionType.includes('cash out')) {
      continue
    }
    
    const parsed = extractTipData(row, platform)
    if (parsed) data.push(parsed)
  }
  return { data }
}

function parseHeaderless(lines, platform) {
  const data = []
  for (const line of lines) {
    const vals = parseCSVLine(line)
    let parsed = null
    
    // Chaturbate "Tip From:" format (with space and colon)
    if (vals.length >= 3 && vals[1]?.toLowerCase().includes('tip from')) {
      parsed = parseChaturbateTipFrom(vals)
    } 
    // Standard date,username,tokens format
    else if (vals.length >= 3 && isDate(vals[0])) {
      parsed = parseStandardFormat(vals, platform)
    }
    
    if (parsed) data.push(parsed)
  }
  return { data }
}

function extractTipData(row, platform) {
  const username = row.username || row.user || row.tipper
  let tokens = parseInt(row.tokens || row.credits || '0') || 0
  let usd = parseFloat(row.usd || row.usd_amount || row.earnings || '0') || 0
  const dateRaw = row.date_time || row.date || row.timestamp
  
  // Skip negative tokens (cashouts)
  if (tokens < 0) tokens = 0
  if (usd < 0) usd = 0
  
  if (!username || !dateRaw) return null
  
  // Must have EITHER tokens OR USD (at least one must be > 0)
  if (tokens <= 0 && usd <= 0) return null
  
  return {
    dateRaw,
    username: username.trim(),
    platform: platform || 'Unknown',
    tokens: tokens > 0 ? tokens : Math.round(usd / 0.05),
    usd: usd > 0 ? usd : parseFloat((tokens * 0.05).toFixed(2)),
    tip_type: row.tip_type || row.transaction_type || 'Tip',
    tip_note: row.tip_note || ''
  }
}

function parseChaturbateTipFrom(vals) {
  const dateRaw = vals[0].replace(/"/g, '')
  const match = vals[1].match(/tip from[:\s]+([^\s,]+)/i)
  const username = match ? match[1] : null
  const tokens = parseInt(vals[2]) || 0
  
  if (!username || tokens <= 0) return null
  
  return {
    dateRaw,
    username,
    platform: 'Chaturbate',
    tokens,
    usd: parseFloat((tokens * 0.05).toFixed(2)),
    tip_type: 'Tip',
    tip_note: ''
  }
}

function parseStandardFormat(vals, platform) {
  const dateRaw = vals[0]
  const username = vals[1]
  const tokens = parseInt(vals[2]) || 0
  const usd = parseFloat(vals[3]?.replace('$', '')) || 0
  
  if (!username || (tokens <= 0 && usd <= 0)) return null
  
  return {
    dateRaw,
    username: username.trim(),
    platform: platform || 'Unknown',
    tokens: tokens || Math.round(usd / 0.05),
    usd: usd || parseFloat((tokens * 0.05).toFixed(2)),
    tip_type: 'Tip',
    tip_note: ''
  }
}

function strictValidate(data, platform) {
  const validated = []
  const issues = []
  
  if (data.length === 0) {
    return {
      valid: false,
      error: {
        type: 'no_valid_rows',
        message: "❌ Could not parse any valid tips",
        fix: "Check your CSV format. Required: Date, Username, Amount"
      }
    }
  }
  
  data.forEach((item, i) => {
    const rowNum = i + 1
    const rowIssues = []
    
    if (!isValidDate(item.dateRaw)) {
      rowIssues.push(`Invalid date: "${item.dateRaw}"`)
    } else {
      const tipDate = new Date(item.dateRaw)
      // Allow future dates up to 1 year from now (for test data)
      const oneYearFromNow = new Date()
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
      
      if (tipDate > oneYearFromNow) {
        rowIssues.push(`Date too far in future: ${item.dateRaw}`)
      }
      if (tipDate.getFullYear() < 2010) {
        rowIssues.push(`Date seems too old: ${item.dateRaw}`)
      }
    }
    
    if (!item.username || item.username.trim() === '') {
      rowIssues.push("Missing username")
    }
    
    const hasTokens = item.tokens && item.tokens > 0
    const hasUSD = item.usd && item.usd > 0
    
    // Must have EITHER tokens OR USD
    if (!hasTokens && !hasUSD) {
      rowIssues.push("No valid tip amount (tokens and USD both zero/missing)")
    } else {
      // Only validate if the value exists
      if (hasTokens && (item.tokens < 0 || item.tokens > 1000000)) {
        rowIssues.push(`Unrealistic tokens: ${item.tokens}`)
      }
      if (hasUSD && (item.usd < 0 || item.usd > 50000)) {
        rowIssues.push(`Unrealistic USD: $${item.usd}`)
      }
      
      // Check token/USD ratio only if BOTH exist
      if (hasTokens && hasUSD && item.tokens > 0 && item.usd > 0) {
        const ratio = item.usd / item.tokens
        if (ratio < 0.01 || ratio > 0.15) {
          rowIssues.push(`Suspicious token/USD ratio: ${ratio.toFixed(4)} (expected ~0.05)`)
        }
      }
    }
    
    if (rowIssues.length > 0) {
      issues.push({ row: rowNum, data: item, problems: rowIssues })
    } else {
      validated.push(item)
    }
  })
  
  const errorRate = issues.length / data.length
  if (errorRate > 0.2) {
    return {
      valid: false,
      error: {
        type: 'too_many_errors',
        message: `❌ ${issues.length} of ${data.length} rows have errors (${(errorRate * 100).toFixed(0)}%)`,
        fix: "Please fix your CSV file. Too many rows have problems to safely import."
      },
      issues: issues.slice(0, 10)
    }
  }
  
  if (issues.length > 0) {
    return {
      valid: true,
      needsWarning: true,
      data: validated,
      skipped: issues,
      warningMessage: `⚠️ ${issues.length} row${issues.length > 1 ? 's' : ''} will be skipped due to errors`
    }
  }
  
  return { valid: true, data: validated }
}

function buildConfirmationData(data, platform) {
  const dates = data.map(d => new Date(d.dateRaw)).sort((a, b) => a - b)
  const totalRevenue = data.reduce((sum, d) => sum + d.usd, 0)
  
  const userTotals = {}
  data.forEach(d => {
    userTotals[d.username] = (userTotals[d.username] || 0) + d.usd
  })
  const topTipper = Object.entries(userTotals).sort((a, b) => b[1] - a[1])[0]
  
  const sampleRows = data.slice(0, 5).map(d => ({
    date: new Date(d.dateRaw).toLocaleDateString(),
    username: d.username,
    amount: `${d.tokens} tokens ($${d.usd.toFixed(2)})`
  }))
  
  return {
    totalTips: data.length,
    totalRevenue: totalRevenue.toFixed(2),
    dateRange: {
      earliest: dates[0].toLocaleDateString(),
      latest: dates[dates.length - 1].toLocaleDateString()
    },
    topTipper: topTipper ? {
      username: topTipper[0],
      amount: topTipper[1].toFixed(2)
    } : null,
    sampleRows,
    platform
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

function isDate(str) {
  return /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(str) ||
         /^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/.test(str) ||
         /^\d{2}\.\d{2}\.\d{4}/.test(str)  // European format DD.MM.YYYY
}

function isValidDate(dateStr) {
  // Try parsing as-is first
  let date = new Date(dateStr)
  
  // If invalid, try converting European format DD.MM.YYYY to MM/DD/YYYY
  if (isNaN(date.getTime()) && /^\d{2}\.\d{2}\.\d{4}/.test(dateStr)) {
    const parts = dateStr.split(/[\s\.]+/)
    const day = parts[0]
    const month = parts[1]
    const year = parts[2]
    const time = parts[3] || ''
    
    // Convert to MM/DD/YYYY format
    const converted = `${month}/${day}/${year} ${time}`.trim()
    date = new Date(converted)
  }
  
  return date instanceof Date && !isNaN(date.getTime()) && date.getFullYear() > 2000
}

// ============================================
// END OF NEW PARSER CODE
// ============================================

export function detectSessions(tips) {
  if (!tips || tips.length === 0) return []
  const parsed = tips.map(t => ({ ...t, timestamp: new Date(t.dateRaw || t.date_time) }))
    .filter(t => !isNaN(t.timestamp.getTime()))
    .sort((a, b) => a.timestamp - b.timestamp)
  if (parsed.length === 0) return []
  const SESSION_GAP_MS = 3 * 60 * 60 * 1000
  const sessions = []
  let currentSession = null
  parsed.forEach(tip => {
    if (!currentSession) {
      currentSession = {
        tips: [tip], platform: tip.platform, startTime: tip.timestamp,
        endTime: tip.timestamp, fans: new Set([tip.username.toLowerCase()])
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
          tips: [tip], platform: tip.platform, startTime: tip.timestamp,
          endTime: tip.timestamp, fans: new Set([tip.username.toLowerCase()])
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
    durationMinutes, durationHours: parseFloat(durationHours.toFixed(2)),
    totalTokens, totalUSD: parseFloat(totalUSD.toFixed(2)),
    tipCount, uniqueFans, tokensPerHour, usdPerHour, avgTipSize,
    tips: session.tips
  }
}

// ============================================
// ENHANCED WHALE IDENTIFICATION
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
    fanMap[key].totalUSD += t.usd || 0
    fanMap[key].totalTokens += t.tokens || 0
    fanMap[key].tipCount += 1
    fanMap[key].tips.push(t)
    if (t.tip_note) fanMap[key].tipNotes.push(t.tip_note)
  })

  return Object.values(fanMap).map(f => {
    const sortedTips = f.tips.sort((a, b) => new Date(b.dateRaw || b.date_time) - new Date(a.dateRaw || a.date_time))
    const lastTip = sortedTips[0]
    const firstTip = sortedTips[sortedTips.length - 1]
    const lastTipDate = new Date(lastTip.dateRaw || lastTip.date_time)
    const firstTipDate = new Date(firstTip.dateRaw || firstTip.date_time)
    const daysSinceLastTip = Math.floor((Date.now() - lastTipDate) / (1000 * 60 * 60 * 24))
    const lifetimeDays = Math.max(Math.floor((lastTipDate - firstTipDate) / (1000 * 60 * 60 * 24)), 1)
    const avgDaysBetweenTips = f.tipCount > 1 ? lifetimeDays / (f.tipCount - 1) : 30

    // Detect privates (tips with "private" keyword)
    const privateTips = f.tips.filter(t => 
      t.tip_type?.toLowerCase().includes('private') || 
      t.tip_note?.toLowerCase().includes('private')
    )
    const hasPrivates = privateTips.length > 0
    const privateCount = privateTips.length
    const privateSpent = privateTips.reduce((sum, t) => sum + t.usd, 0)

    // Activity hours analysis
    const hourCounts = {}
    f.tips.forEach(t => {
      const hour = new Date(t.dateRaw || t.date_time).getHours()
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    })
    const mostActiveHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]
    const typicalOnlineHours = mostActiveHour ? `${mostActiveHour[0]}:00 - ${parseInt(mostActiveHour[0]) + 2}:00` : 'Unknown'

    // Biggest single tip
    const biggestTip = Math.max(...f.tips.map(t => t.usd))

    let tier = 'Regular'
    if (f.totalUSD >= 500) tier = 'Whale'
    else if (f.totalUSD >= 100) tier = 'Shark'
    else if (daysSinceLastTip > 60) tier = 'Dormant'

    const tipProbability = calculateTipProbability(daysSinceLastTip, avgDaysBetweenTips)
    const churnRisk = calculateChurnRisk(daysSinceLastTip, avgDaysBetweenTips, f.tipCount)
    const lifetimeValue = predictLifetimeValue(f.totalUSD, lifetimeDays, f.tipCount)
    const expectedNextTip = calculateExpectedNextTip(daysSinceLastTip, avgDaysBetweenTips)

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
      tipProbability, 
      churnRisk, 
      lifetimeValue,
      expectedNextTip,
      hasPrivates,
      privateCount,
      privateSpent: parseFloat(privateSpent.toFixed(2)),
      typicalOnlineHours,
      tipNotes: f.tipNotes,
      tips: f.tips
    }
  }).sort((a, b) => b.totalUSD - a.totalUSD)
}

function calculateTipProbability(daysSince, avgDays) {
  if (daysSince < avgDays * 0.5) return { level: 'High', percentage: 85 }
  if (daysSince < avgDays) return { level: 'Medium-High', percentage: 70 }
  if (daysSince < avgDays * 1.5) return { level: 'Medium', percentage: 50 }
  if (daysSince < avgDays * 2) return { level: 'Low-Medium', percentage: 30 }
  return { level: 'Low', percentage: 15 }
}

function calculateChurnRisk(daysSince, avgDays, tipCount) {
  if (tipCount < 3) return { level: 'Unknown', risk: 'Insufficient data' }
  const ratio = daysSince / avgDays
  if (ratio < 1) return { level: 'Low', risk: 'Active' }
  if (ratio < 2) return { level: 'Medium', risk: 'Watch closely' }
  if (ratio < 3) return { level: 'High', risk: 'At risk' }
  return { level: 'Critical', risk: 'Likely churned' }
}

function predictLifetimeValue(totalSpent, days, tipCount) {
  if (days < 7 || tipCount < 2) return { prediction: totalSpent, confidence: 'Low' }
  const dailyRate = totalSpent / days
  const projected365 = dailyRate * 365
  const confidence = tipCount > 10 ? 'High' : tipCount > 5 ? 'Medium' : 'Low'
  return {
    prediction: parseFloat(projected365.toFixed(2)),
    confidence,
    monthly: parseFloat((projected365 / 12).toFixed(2))
  }
}

function calculateExpectedNextTip(daysSince, avgDays) {
  const daysUntilNext = Math.max(0, Math.round(avgDays - daysSince))
  if (daysUntilNext === 0) return 'Overdue'
  if (daysUntilNext === 1) return 'Tomorrow'
  if (daysUntilNext <= 3) return `In ${daysUntilNext} days`
  if (daysUntilNext <= 7) return `In ~${daysUntilNext} days`
  return `In ~${Math.round(daysUntilNext / 7)} weeks`
}

export function generateWhaleAlerts(whales) {
  const alerts = []
  whales.forEach(whale => {
    if (whale.tier === 'Whale' && whale.daysSinceLastTip < 7) {
      if (whale.totalUSD >= 500 && whale.totalUSD < 600) {
        alerts.push({
          type: 'new_whale', severity: 'success', icon: '🐳',
          whale: whale.username,
          message: `${whale.username} just became a whale! ($${whale.totalUSD} lifetime)`,
          action: 'Send thank you message'
        })
      }
    }
    if (whale.churnRisk.level === 'High' || whale.churnRisk.level === 'Critical') {
      if (whale.totalUSD >= 100) {
        alerts.push({
          type: 'churn_risk', severity: 'warning', icon: '⚠️',
          whale: whale.username,
          message: `${whale.username} hasn't tipped in ${whale.daysSinceLastTip} days (usually tips every ${whale.avgDaysBetweenTips.toFixed(0)} days)`,
          action: 'Re-engage now'
        })
      }
    }
    if (whale.tipProbability.level === 'High' && whale.totalUSD >= 200) {
      alerts.push({
        type: 'tip_likely', severity: 'info', icon: '💰',
        whale: whale.username,
        message: `${whale.username} likely to tip soon (${whale.tipProbability.percentage}% probability)`,
        action: 'Go live during their active hours'
      })
    }
  })
  return alerts.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

export function predictRevenue(tips, sessions) {
  if (!sessions.length) return null
  const predictions = {}
  const last7Days = tips.filter(t => {
    const date = new Date(t.dateRaw || t.date_time)
    const daysAgo = (Date.now() - date) / (1000 * 60 * 60 * 24)
    return daysAgo <= 7
  })
  const last7Revenue = last7Days.reduce((sum, t) => sum + t.usd, 0)
  predictions.next7Days = {
    amount: parseFloat(last7Revenue.toFixed(2)),
    confidence: last7Days.length > 20 ? 'High' : last7Days.length > 10 ? 'Medium' : 'Low'
  }
  const last30Days = tips.filter(t => {
    const date = new Date(t.dateRaw || t.date_time)
    const daysAgo = (Date.now() - date) / (1000 * 60 * 60 * 24)
    return daysAgo <= 30
  })
  const last30Revenue = last30Days.reduce((sum, t) => sum + t.usd, 0)
  predictions.next30Days = {
    amount: parseFloat(last30Revenue.toFixed(2)),
    confidence: last30Days.length > 50 ? 'High' : last30Days.length > 25 ? 'Medium' : 'Low'
  }
  const now = new Date()
  const dayOfWeek = now.getDay()
  const sameDaySessions = sessions.filter(s => {
    const sessionDate = new Date(s.startTime)
    return sessionDate.getDay() === dayOfWeek
  })
  if (sameDaySessions.length > 2) {
    const avgRevenue = sameDaySessions.reduce((sum, s) => sum + s.totalUSD, 0) / sameDaySessions.length
    const minRevenue = Math.min(...sameDaySessions.map(s => s.totalUSD))
    const maxRevenue = Math.max(...sameDaySessions.map(s => s.totalUSD))
    predictions.tonightStream = {
      expected: parseFloat(avgRevenue.toFixed(2)),
      range: { min: parseFloat(minRevenue.toFixed(2)), max: parseFloat(maxRevenue.toFixed(2)) },
      confidence: sameDaySessions.length > 5 ? 'High' : 'Medium'
    }
  }
  return predictions
}

export function generateInsights(tips, sessions) {
  const insights = []
  if (!tips.length || !sessions.length) return insights
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
      insights.push({ icon: '📅', text: `${bestDay[0]}s earn ${percentBetter}% more than average`, type: 'day' })
    }
  }
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
    insights.push({ icon: '⏰', text: `Peak earnings between ${hourLabel} and ${parseInt(bestHour[0]) + 1}:00`, type: 'time' })
  }
  const whales = identifyWhales(tips)
  const whaleEarnings = whales.filter(w => w.tier === 'Whale').reduce((sum, w) => sum + w.totalUSD, 0)
  const totalEarnings = tips.reduce((sum, t) => sum + t.usd, 0)
  if (whaleEarnings > 0) {
    const whalePercent = Math.round((whaleEarnings / totalEarnings) * 100)
    insights.push({ icon: '🐳', text: `Top ${whales.filter(w => w.tier === 'Whale').length} whales generate ${whalePercent}% of revenue`, type: 'whales' })
  }
  return insights
}

export function aggregateRows(tips) {
  if (!tips || tips.length === 0) {
    return {
      totalUSD: 0, totalTokens: 0, totalTips: 0, avgTipSize: 0,
      topTippers: [], platforms: [], sessions: [], insights: [],
      predictions: null, whaleAlerts: []
    }
  }
  const sessions = detectSessions(tips)
  const whales = identifyWhales(tips)
  const insights = generateInsights(tips, sessions)
  const predictions = predictRevenue(tips, sessions)
  const whaleAlerts = generateWhaleAlerts(whales)
  const totalUSD = tips.reduce((sum, t) => sum + (t.usd || 0), 0)
  const totalTokens = tips.reduce((sum, t) => sum + (t.tokens || 0), 0)
  const avgTipSize = tips.length > 0 ? totalUSD / tips.length : 0
  const platformMap = {}
  sessions.forEach(s => {
    if (!platformMap[s.platform]) {
      platformMap[s.platform] = {
        platform: s.platform, totalUSD: 0, totalTokens: 0,
        sessions: 0, hours: 0, tips: 0
      }
    }
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
    rank: i + 1, username: w.username, usd: w.totalUSD,
    tokens: w.totalTokens, count: w.tipCount,
    status: w.tier === 'Whale' ? '🐳 WHALE' : 
            w.tier === 'Shark' ? '🦈 SHARK' :
            w.tier === 'Dormant' ? '💤 DORMANT' : '🐟 REGULAR',
    last: new Date(w.lastTipDate).toLocaleDateString(),
    first: new Date(w.firstTipDate).toLocaleDateString(),
    daysSince: w.daysSinceLastTip,
    tipProbability: w.tipProbability,
    churnRisk: w.churnRisk
  }))
  return {
    totalUSD: parseFloat(totalUSD.toFixed(2)), totalTokens,
    totalTips: tips.length, avgTipSize: parseFloat(avgTipSize.toFixed(2)),
    topTippers, platforms, sessions, insights,
    predictions, whaleAlerts, whales
  }
}

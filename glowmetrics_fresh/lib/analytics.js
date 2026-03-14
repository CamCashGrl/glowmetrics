// Analytics and CSV parsing utilities for GlowMetrics

export function parseCSV(text, platform = null) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length === 0) return []

  // Auto-detect platform if not specified
  if (!platform) {
    platform = detectPlatform(text)
  }

  // Check if it has headers
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

    // Chaturbate raw format: Date, "Tip From: username", tokens, empty
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

    // Generic fallback for other headerless formats
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

  // Try to find date, username, and amount
  let dateRaw = vals[0]
  let username = vals[1] || 'anonymous'
  let tokens = 0
  let usd = 0

  // Look for numbers in the array
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

// Convert raw tips data to dashboard analytics
export function buildAnalytics(tips) {
  if (!tips || tips.length === 0) {
    return {
      totalUSD: 0,
      totalTips: 0,
      uniqueFans: 0,
      platforms: [],
      topFans: [],
      dailyData: [],
      monthlyData: [],
      hourlyData: [],
      platformBreakdown: []
    }
  }

  // Parse dates
  const parsed = tips.map(t => ({
    ...t,
    date: new Date(t.dateRaw || t.date_time)
  })).filter(t => !isNaN(t.date.getTime()))

  // Calculate totals
  const totalUSD = parsed.reduce((sum, t) => sum + (t.usd || 0), 0)
  const totalTips = parsed.length
  const uniqueFans = new Set(parsed.map(t => t.username.toLowerCase())).size

  // Top fans
  const fanMap = {}
  parsed.forEach(t => {
    const key = t.username.toLowerCase()
    if (!fanMap[key]) {
      fanMap[key] = { username: t.username, totalUSD: 0, totalTokens: 0, tips: 0, platform: t.platform }
    }
    fanMap[key].totalUSD += t.usd || 0
    fanMap[key].totalTokens += t.tokens || 0
    fanMap[key].tips += 1
  })

  const topFans = Object.values(fanMap)
    .sort((a, b) => b.totalUSD - a.totalUSD)
    .slice(0, 100)
    .map((f, idx) => ({
      rank: idx + 1,
      username: f.username,
      totalUSD: parseFloat(f.totalUSD.toFixed(2)),
      totalTokens: f.totalTokens,
      tips: f.tips,
      platform: f.platform
    }))

  // Daily data
  const dailyMap = {}
  parsed.forEach(t => {
    const dateKey = t.date.toISOString().split('T')[0]
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { date: dateKey, usd: 0, tips: 0, tokens: 0 }
    }
    dailyMap[dateKey].usd += t.usd || 0
    dailyMap[dateKey].tips += 1
    dailyMap[dateKey].tokens += t.tokens || 0
  })

  const dailyData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))

  // Monthly data
  const monthlyMap = {}
  parsed.forEach(t => {
    const month = t.date.toISOString().substring(0, 7) // YYYY-MM
    if (!monthlyMap[month]) {
      monthlyMap[month] = { month, usd: 0, tips: 0, tokens: 0 }
    }
    monthlyMap[month].usd += t.usd || 0
    monthlyMap[month].tips += 1
    monthlyMap[month].tokens += t.tokens || 0
  })

  const monthlyData = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month))

  // Hourly data
  const hourlyMap = {}
  parsed.forEach(t => {
    const hour = t.date.getHours()
    if (!hourlyMap[hour]) {
      hourlyMap[hour] = { hour, usd: 0, tips: 0, tokens: 0 }
    }
    hourlyMap[hour].usd += t.usd || 0
    hourlyMap[hour].tips += 1
    hourlyMap[hour].tokens += t.tokens || 0
  })

  const hourlyData = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? 'AM' : 'PM'}`,
    usd: hourlyMap[h]?.usd || 0,
    tips: hourlyMap[h]?.tips || 0,
    tokens: hourlyMap[h]?.tokens || 0
  }))

  // Platform breakdown
  const platformMap = {}
  parsed.forEach(t => {
    const p = t.platform || 'Unknown'
    if (!platformMap[p]) {
      platformMap[p] = { platform: p, usd: 0, tips: 0, tokens: 0 }
    }
    platformMap[p].usd += t.usd || 0
    platformMap[p].tips += 1
    platformMap[p].tokens += t.tokens || 0
  })

  const platformBreakdown = Object.values(platformMap).sort((a, b) => b.usd - a.usd)

  return {
    totalUSD: parseFloat(totalUSD.toFixed(2)),
    totalTips,
    uniqueFans,
    platforms: platformBreakdown.map(p => p.platform),
    topFans,
    dailyData,
    monthlyData,
    hourlyData,
    platformBreakdown
  }
}

// ─── CSV PARSER ───────────────────────────────────────────────────────────────
export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].match(/(".*?"|[^,]+)(?=,|$)/g) || []
    const obj = {}
    headers.forEach((h, j) => { obj[h] = (vals[j] || '').replace(/"/g, '').trim() })
    if (obj.date_time && obj.username && obj.tokens) {
      const tokens = parseInt(obj.tokens)
      const usd = parseFloat(obj.usd) || tokens * 0.05
      if (tokens > 0) rows.push({
        date_time: obj.date_time,
        platform: obj.platform || 'Chaturbate',
        username: obj.username,
        tip_type: obj.tip_type || 'Tip',
        tokens,
        usd: parseFloat(usd.toFixed(2)),
      })
    }
  }
  return rows
}

// ─── AGGREGATION ─────────────────────────────────────────────────────────────
export function aggregateRows(rows) {
  const daily = {}, hourly = {}, monthly = {}, tippers = {}, platforms = {}, tipTypes = {}
  for (let h = 0; h < 24; h++) hourly[h] = { h, tokens: 0, usd: 0, count: 0 }

  for (const r of rows) {
    const date  = r.date_time.slice(0, 10)
    const month = r.date_time.slice(0, 7)
    const h     = new Date(r.date_time).getHours()

    // Daily
    daily[date] = daily[date] || { date, tokens: 0, usd: 0, count: 0 }
    daily[date].tokens += r.tokens
    daily[date].usd     = +(daily[date].usd + r.usd).toFixed(2)
    daily[date].count++

    // Monthly
    monthly[month] = monthly[month] || { month, tokens: 0, usd: 0, count: 0 }
    monthly[month].tokens += r.tokens
    monthly[month].usd     = +(monthly[month].usd + r.usd).toFixed(2)
    monthly[month].count++

    // Hourly
    hourly[h].tokens += r.tokens
    hourly[h].usd     = +(hourly[h].usd + r.usd).toFixed(2)
    hourly[h].count++

    // Tippers
    tippers[r.username] = tippers[r.username] || { username: r.username, usd: 0, tokens: 0, count: 0, first: date, last: '' }
    tippers[r.username].usd    = +(tippers[r.username].usd + r.usd).toFixed(2)
    tippers[r.username].tokens += r.tokens
    tippers[r.username].count++
    if (date > tippers[r.username].last) tippers[r.username].last = date
    if (date < tippers[r.username].first) tippers[r.username].first = date

    // Platforms
    platforms[r.platform] = platforms[r.platform] || { platform: r.platform, usd: 0, tokens: 0, count: 0 }
    platforms[r.platform].usd    = +(platforms[r.platform].usd + r.usd).toFixed(2)
    platforms[r.platform].tokens += r.tokens
    platforms[r.platform].count++

    // Tip types
    tipTypes[r.tip_type] = tipTypes[r.tip_type] || { type: r.tip_type, usd: 0, tokens: 0, count: 0 }
    tipTypes[r.tip_type].usd    = +(tipTypes[r.tip_type].usd + r.usd).toFixed(2)
    tipTypes[r.tip_type].tokens += r.tokens
    tipTypes[r.tip_type].count++
  }

  const now = new Date()
  const topTippers = Object.values(tippers)
    .sort((a, b) => b.usd - a.usd)
    .slice(0, 100)
    .map(t => {
      const daysSince = Math.floor((now - new Date(t.last)) / 86400000)
      const status = t.usd >= 50  ? '🐳 WHALE'
                   : t.usd >= 20  ? '🦈 SHARK'
                   : daysSince > 60 ? '💤 DORMANT'
                   : '🐟 REGULAR'
      return { ...t, daysSince, status }
    })

  const totalUsd    = rows.reduce((s, r) => s + r.usd, 0)
  const totalTokens = rows.reduce((s, r) => s + r.tokens, 0)

  // Biggest single tip
  const biggestTip = rows.reduce((max, r) => r.usd > max.usd ? r : max, { usd: 0, tokens: 0, username: '—' })

  // Best day
  const dailyArr  = Object.values(daily).sort((a, b) => a.date < b.date ? -1 : 1)
  const bestDay   = dailyArr.reduce((max, d) => d.usd > max.usd ? d : max, { usd: 0, date: '—' })

  // Best month
  const monthlyArr = Object.values(monthly).sort((a, b) => a.month < b.month ? -1 : 1)
  const bestMonth  = monthlyArr.reduce((max, m) => m.usd > max.usd ? m : max, { usd: 0, month: '—' })

  // Streak — consecutive active days
  let streak = 0, maxStreak = 0, cur = 0
  const dateSet = new Set(dailyArr.map(d => d.date))
  const sortedDates = [...dateSet].sort()
  for (let i = 0; i < sortedDates.length; i++) {
    const prev = i > 0 ? new Date(sortedDates[i - 1]) : null
    const curr = new Date(sortedDates[i])
    if (prev && (curr - prev) / 86400000 === 1) { cur++; maxStreak = Math.max(maxStreak, cur) }
    else cur = 1
  }

  // Hourly labels
  const hourlyArr = Array.from({ length: 24 }, (_, h) => ({
    ...hourly[h],
    label: `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? 'am' : 'pm'}`,
  }))
  const peakHour = hourlyArr.reduce((a, b) => b.tokens > a.tokens ? b : a, hourlyArr[0])

  // Running total for cumulative chart
  let running = 0
  const cumulative = dailyArr.map(d => { running = +(running + d.usd).toFixed(2); return { ...d, cumulative: running } })

  return {
    daily: dailyArr,
    cumulative,
    monthly: monthlyArr,
    hourly: hourlyArr,
    topTippers,
    platforms: Object.values(platforms).sort((a, b) => b.usd - a.usd),
    tipTypes:  Object.values(tipTypes).sort((a, b) => b.usd - a.usd),
    peakHour,
    bestDay,
    bestMonth,
    biggestTip,
    maxStreak,
    totals: {
      usd:            +totalUsd.toFixed(2),
      tokens:         totalTokens,
      tips:           rows.length,
      avgTip:         rows.length > 0 ? +(totalUsd / rows.length).toFixed(2) : 0,
      avgPerDay:      dailyArr.length > 0 ? +(totalUsd / dailyArr.length).toFixed(2) : 0,
      uniqueTippers:  Object.keys(tippers).length,
      activeDays:     dailyArr.length,
      topWhale:       topTippers[0]?.username || '—',
      topWhaleUsd:    topTippers[0]?.usd || 0,
      topWhaleTokens: topTippers[0]?.tokens || 0,
      whales:         topTippers.filter(t => t.status === '🐳 WHALE').length,
      sharks:         topTippers.filter(t => t.status === '🦈 SHARK').length,
      dormant:        topTippers.filter(t => t.status === '💤 DORMANT').length,
    }
  }
}

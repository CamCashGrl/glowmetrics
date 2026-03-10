// ─── PLATFORM TOKEN RATES ────────────────────────────────────────────────────
const PLATFORM_TOKEN_RATES = {
  Chaturbate:  0.05,
  BongaCams:   0.05,
  Stripchat:   0.05,
  CamSoda:     0.05,
  'Cherry.tv': 0.05,
  Streamate:   1.00,
  ImLive:      0.055,
  Flirt4Free:  0.08,
  LiveJasmin:  0.08,
  MyFreeCams:  0.05,
  Other:       0.05,
}

// ─── FLEXIBLE CSV SPLITTER ───────────────────────────────────────────────────
// Handles commas, tabs, semicolons, quoted fields, BOM characters
function splitLine(line, delimiter) {
  const result = []
  let cur = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"' || ch === "'") {
      inQuote = !inQuote
    } else if (!inQuote && ch === delimiter) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

function detectDelimiter(firstLine) {
  const counts = {
    ',': (firstLine.match(/,/g)||[]).length,
    '\t': (firstLine.match(/\t/g)||[]).length,
    ';': (firstLine.match(/;/g)||[]).length,
    '|': (firstLine.match(/\|/g)||[]).length,
  }
  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0]
}

// ─── PLATFORM DETECTION ──────────────────────────────────────────────────────
function detectPlatform(headers, firstRows) {
  const h = headers.join(' ').toLowerCase()
  const allText = (firstRows||[]).map(r=>Object.values(r).join(' ')).join(' ').toLowerCase()
  const combined = h + ' ' + allText

  if (combined.includes('chaturbate')) return 'Chaturbate'
  if (combined.includes('bongacams') || combined.includes('bonga')) return 'BongaCams'
  if (combined.includes('stripchat')) return 'Stripchat'
  if (combined.includes('camsoda')) return 'CamSoda'
  if (combined.includes('cherry')) return 'Cherry.tv'
  if (combined.includes('streamate')) return 'Streamate'
  if (combined.includes('imlive') || combined.includes('im live')) return 'ImLive'
  if (combined.includes('flirt4free') || combined.includes('flirt 4 free')) return 'Flirt4Free'
  if (combined.includes('livejasmin') || combined.includes('jasmin')) return 'LiveJasmin'
  if (combined.includes('myfreecams') || combined.includes('mfc')) return 'MyFreeCams'
  return null
}

// ─── FLEXIBLE DATE PARSER ────────────────────────────────────────────────────
function parseDate(raw) {
  if (!raw) return null
  const s = raw.toString().trim().replace(/"/g, '')
  if (!s) return null

  // Try native parse first (handles ISO, RFC, most US formats)
  let d = new Date(s)
  if (!isNaN(d.getTime())) return d

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  let m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/)
  if (m) {
    const [,a,b,y] = m
    const year = y.length===2 ? '20'+y : y
    // Try DD/MM/YYYY
    d = new Date(`${year}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`)
    if (!isNaN(d.getTime())) return d
    // Try MM/DD/YYYY
    d = new Date(`${year}-${a.padStart(2,'0')}-${b.padStart(2,'0')}`)
    if (!isNaN(d.getTime())) return d
  }

  // YYYY/MM/DD
  m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/)
  if (m) {
    d = new Date(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`)
    if (!isNaN(d.getTime())) return d
  }

  // Unix timestamp (seconds or ms)
  if (/^\d{10,13}$/.test(s)) {
    const ts = parseInt(s)
    d = new Date(s.length === 10 ? ts * 1000 : ts)
    if (!isNaN(d.getTime())) return d
  }

  return null
}

// ─── FLEXIBLE FIELD FINDER ───────────────────────────────────────────────────
// Finds a value from an object using fuzzy key matching
function find(obj, ...keys) {
  const objLower = {}
  Object.keys(obj).forEach(k => { objLower[k.toLowerCase().replace(/[\s_\-\.]/g,'')] = obj[k] })

  for (const key of keys) {
    const k = key.toLowerCase().replace(/[\s_\-\.]/g,'')
    if (objLower[k] !== undefined && objLower[k] !== '') return objLower[k]
  }
  // Fuzzy partial match
  for (const key of keys) {
    const k = key.toLowerCase().replace(/[\s_\-\.]/g,'')
    for (const ok of Object.keys(objLower)) {
      if (ok.includes(k) || k.includes(ok)) {
        if (objLower[ok] !== undefined && objLower[ok] !== '') return objLower[ok]
      }
    }
  }
  return ''
}

function normalizeRow(obj, detectedPlatform) {
  // ── Date ──
  const dateRaw = find(obj,
    'date_time','datetime','date','timestamp','time','created_at','created',
    'transaction_date','transactiondate','tip_date','tipdate',
    'transaction date','tip date','date and time','tipped at','tipped_at',
    'when','recorded','recorded_at'
  )

  // ── Username ──
  const username = find(obj,
    'username','user_name','user','tipper','tipper_name','tippername',
    'member','viewer','performer','name','display_name','displayname',
    'from','fan','sender','nick','nickname','handle'
  )

  // ── Platform ──
  const platformRaw = find(obj,'platform','site','source','network','service','from_site','from_platform')
  const platform = detectedPlatform || platformRaw || 'Other'

  // ── Tokens ──
  const tokensStr = find(obj,
    'tokens','token','amount','credits','points','gems',
    'tip_amount','tipamount','tip amount','coins','bits',
    'token_amount','tokenamount','tipped','tips'
  )
  const tokensRaw = parseInt((tokensStr||'').toString().replace(/[^0-9]/g,'')) || 0

  // ── USD ──
  const usdStr = find(obj,
    'usd','amount_usd','amountusd','earnings','revenue','payout','value',
    'amount_usd','usd_amount','usdamount','price','cost','income',
    'amount (usd)','usd amount','dollars','$','total','net'
  )
  const usdRaw = parseFloat((usdStr||'').toString().replace(/[$,\s]/g,'')) || 0

  // ── Tip type ──
  const tip_type = find(obj,
    'tip_type','tiptype','type','transaction_type','transactiontype',
    'tip type','category','kind','event','event_type'
  ) || 'Tip'

  const rate = PLATFORM_TOKEN_RATES[platform] || 0.05
  const usd = usdRaw > 0 ? usdRaw : tokensRaw * rate
  const tokens = tokensRaw > 0 ? tokensRaw : (usd > 0 ? Math.round(usd / rate) : 0)

  return {
    dateRaw,
    username: username || '',
    platform,
    tokens,
    usd: parseFloat(usd.toFixed(2)),
    tip_type,
  }
}

// ─── MAIN CSV PARSER ─────────────────────────────────────────────────────────
export function parseCSV(text, forcePlatform) {
  // Strip BOM and normalize line endings
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  const lines = cleaned.split('\n').filter(l => l.trim())

  if (lines.length < 2) return []

  // Auto-detect delimiter
  const delimiter = detectDelimiter(lines[0])

  // Parse headers
  const headers = splitLine(lines[0], delimiter).map(h =>
    h.trim().replace(/^["']|["']$/g, '').toLowerCase().replace(/\s+/g, '_')
  )

  // Parse first few rows for platform detection
  const sampleRows = []
  for (let i = 1; i <= Math.min(5, lines.length-1); i++) {
    const vals = splitLine(lines[i], delimiter)
    const obj = {}
    headers.forEach((h,j) => { obj[h] = (vals[j]||'').trim() })
    sampleRows.push(obj)
  }

  const detectedPlatform = forcePlatform || detectPlatform(headers, sampleRows)

  const rows = []
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const vals = splitLine(line, delimiter)
    const obj = {}
    headers.forEach((h, j) => {
      obj[h] = (vals[j] || '').replace(/^["']|["']$/g, '').trim()
    })

    const { dateRaw, username, platform, tokens, usd, tip_type } = normalizeRow(obj, detectedPlatform)

    // Skip rows with no username
    if (!username || username === '—' || username === '-') { skipped++; continue }

    // Skip rows with no value
    if (tokens <= 0 && usd <= 0) { skipped++; continue }

    // Parse date
    const dateObj = parseDate(dateRaw)
    if (!dateObj) { skipped++; continue }

    rows.push({
      date_time: dateObj.toISOString(),
      platform,
      username,
      tip_type: tip_type || 'Tip',
      tokens,
      usd,
    })
  }

  console.log(`CSV parsed: ${rows.length} valid rows, ${skipped} skipped`)
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

    daily[date] = daily[date] || { date, tokens: 0, usd: 0, count: 0 }
    daily[date].tokens += r.tokens
    daily[date].usd     = +(daily[date].usd + r.usd).toFixed(2)
    daily[date].count++

    monthly[month] = monthly[month] || { month, tokens: 0, usd: 0, count: 0 }
    monthly[month].tokens += r.tokens
    monthly[month].usd     = +(monthly[month].usd + r.usd).toFixed(2)
    monthly[month].count++

    hourly[h].tokens += r.tokens
    hourly[h].usd     = +(hourly[h].usd + r.usd).toFixed(2)
    hourly[h].count++

    tippers[r.username] = tippers[r.username] || { username: r.username, usd: 0, tokens: 0, count: 0, platforms: new Set(), first: date, last: '' }
    tippers[r.username].usd     = +(tippers[r.username].usd + r.usd).toFixed(2)
    tippers[r.username].tokens += r.tokens
    tippers[r.username].count++
    tippers[r.username].platforms.add(r.platform)
    if (date > tippers[r.username].last)  tippers[r.username].last  = date
    if (date < tippers[r.username].first) tippers[r.username].first = date

    platforms[r.platform] = platforms[r.platform] || { platform: r.platform, usd: 0, tokens: 0, count: 0 }
    platforms[r.platform].usd    = +(platforms[r.platform].usd + r.usd).toFixed(2)
    platforms[r.platform].tokens += r.tokens
    platforms[r.platform].count++

    tipTypes[r.tip_type] = tipTypes[r.tip_type] || { type: r.tip_type, usd: 0, tokens: 0, count: 0 }
    tipTypes[r.tip_type].usd    = +(tipTypes[r.tip_type].usd + r.usd).toFixed(2)
    tipTypes[r.tip_type].tokens += r.tokens
    tipTypes[r.tip_type].count++
  }

  const now = new Date()
  const topTippers = Object.values(tippers)
    .sort((a, b) => b.usd - a.usd)
    .slice(0, 200)
    .map(t => {
      const daysSince = Math.floor((now - new Date(t.last)) / 86400000)
      const status = t.usd >= 50    ? '🐳 WHALE'
                   : t.usd >= 20    ? '🦈 SHARK'
                   : daysSince > 60 ? '💤 DORMANT'
                   : '🐟 REGULAR'
      return { ...t, daysSince, status, platforms: [...t.platforms] }
    })

  const totalUsd    = rows.reduce((s, r) => s + r.usd, 0)
  const totalTokens = rows.reduce((s, r) => s + r.tokens, 0)
  const biggestTip  = rows.reduce((max, r) => r.usd > max.usd ? r : max, { usd: 0, tokens: 0, username: '—' })
  const dailyArr    = Object.values(daily).sort((a, b) => a.date < b.date ? -1 : 1)
  const bestDay     = dailyArr.reduce((max, d) => d.usd > max.usd ? d : max, { usd: 0, date: '—' })
  const monthlyArr  = Object.values(monthly).sort((a, b) => a.month < b.month ? -1 : 1)
  const bestMonth   = monthlyArr.reduce((max, m) => m.usd > max.usd ? m : max, { usd: 0, month: '—' })
  const platformArr = Object.values(platforms).sort((a, b) => b.usd - a.usd)

  let maxStreak = 0, cur = 0
  const sortedDates = [...new Set(dailyArr.map(d => d.date))].sort()
  for (let i = 0; i < sortedDates.length; i++) {
    const prev = i > 0 ? new Date(sortedDates[i-1]) : null
    const curr = new Date(sortedDates[i])
    if (prev && (curr - prev) / 86400000 === 1) { cur++; maxStreak = Math.max(maxStreak, cur) }
    else cur = 1
  }

  const hourlyArr = Array.from({ length: 24 }, (_, h) => ({
    ...hourly[h],
    label: `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? 'am' : 'pm'}`,
  }))
  const peakHour = hourlyArr.reduce((a, b) => b.usd > a.usd ? b : a, hourlyArr[0])

  let running = 0
  const cumulative = dailyArr.map(d => { running = +(running + d.usd).toFixed(2); return { ...d, cumulative: running } })

  return {
    daily: dailyArr, cumulative, monthly: monthlyArr, monthlyArr,
    hourly: hourlyArr, hourlyArr,
    topTippers, platformArr,
    platforms: platformArr,
    tipTypes: Object.values(tipTypes).sort((a, b) => b.usd - a.usd),
    peakHour, bestDay, bestMonth, biggestTip, maxStreak,
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

// ─── FREE TRIAL HELPERS ───────────────────────────────────────────────────────
export const TRIAL_DAYS = 14

export function getTrialStatus(createdAt) {
  if (!createdAt) return { active: false, daysLeft: 0, expired: true }
  const created = new Date(createdAt)
  const now = new Date()
  const daysUsed = Math.floor((now - created) / 86400000)
  const daysLeft = Math.max(0, TRIAL_DAYS - daysUsed)
  return { active: daysLeft > 0, daysLeft, expired: daysLeft === 0, daysUsed }
}

export function applyPlanLimits(data, plan, trialActive) {
  if (plan === 'pro' || trialActive) return data
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
  const topPlatform = data.platforms[0]?.platform || null
  return {
    ...data,
    daily:      data.daily.filter(d => d.date >= cutoff),
    cumulative: data.cumulative.filter(d => d.date >= cutoff),
    topTippers: data.topTippers.slice(0, 25),
    platforms:  topPlatform ? data.platforms.filter(p => p.platform === topPlatform) : data.platforms,
    _limited:   true,
    _limitMsg:  "Upgrade to Pro to unlock all platforms, full history, and unlimited tippers.",
  }
}

export const SUPPORTED_PLATFORMS = [
  { name: 'Chaturbate',  color: '#f472b6', icon: '🎭' },
  { name: 'BongaCams',   color: '#c084fc', icon: '📹' },
  { name: 'Stripchat',   color: '#d946ef', icon: '💬' },
  { name: 'CamSoda',     color: '#2dd4bf', icon: '🥤' },
  { name: 'Cherry.tv',   color: '#f87171', icon: '🍒' },
  { name: 'Streamate',   color: '#fbbf24', icon: '📡' },
  { name: 'ImLive',      color: '#34d399', icon: '🎬' },
  { name: 'Flirt4Free',  color: '#818cf8', icon: '💌' },
  { name: 'LiveJasmin',  color: '#fb923c', icon: '🌹' },
  { name: 'MyFreeCams',  color: '#60a5fa', icon: '🎥' },
]

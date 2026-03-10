// ─── PLATFORM TOKEN RATES ────────────────────────────────────────────────────
const PLATFORM_TOKEN_RATES = {
  Chaturbate: 0.05,
  BongaCams: 0.05,
  Stripchat: 0.05,
  CamSoda: 0.05,
  'Cherry.tv': 0.05,
  Streamate: 1.0,
  ImLive: 0.055,
  Flirt4Free: 0.08,
  LiveJasmin: 0.08,
  MyFreeCams: 0.05,
  Other: 0.05,
}

// ─── FLEXIBLE CSV SPLITTER ───────────────────────────────────────────────────
function splitLine(line, delimiter) {
  const result = []
  let cur = ''
  let inQuote = false

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
    ',': (firstLine.match(/,/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
    ';': (firstLine.match(/;/g) || []).length,
    '|': (firstLine.match(/\|/g) || []).length,
  }

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

// ─── PLATFORM DETECTION ──────────────────────────────────────────────────────
function detectPlatform(headers, firstRows) {
  const h = headers.join(' ').toLowerCase()
  const allText = (firstRows || [])
    .map((r) => Object.values(r).join(' '))
    .join(' ')
    .toLowerCase()

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

// ─── DATE PARSER ─────────────────────────────────────────────────────────────
function parseDate(raw) {
  if (!raw) return null

  const s = raw.toString().trim().replace(/"/g, '')
  if (!s) return null

  let d = new Date(s)
  if (!isNaN(d.getTime())) return d

  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/)

  if (m) {
    const [, a, b, y] = m
    const year = y.length === 2 ? '20' + y : y

    d = new Date(`${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`)
    if (!isNaN(d.getTime())) return d

    d = new Date(`${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`)
    if (!isNaN(d.getTime())) return d
  }

  m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/)

  if (m) {
    d = new Date(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`)
    if (!isNaN(d.getTime())) return d
  }

  if (/^\d{10,13}$/.test(s)) {
    const ts = parseInt(s)
    d = new Date(s.length === 10 ? ts * 1000 : ts)
    if (!isNaN(d.getTime())) return d
  }

  return null
}

// ─── FLEXIBLE FIELD FINDER ───────────────────────────────────────────────────
function find(obj, ...keys) {
  const objLower = {}

  Object.keys(obj).forEach((k) => {
    objLower[k.toLowerCase().replace(/[\s_\-.]/g, '')] = obj[k]
  })

  for (const key of keys) {
    const k = key.toLowerCase().replace(/[\s_\-.]/g, '')

    if (objLower[k] !== undefined && objLower[k] !== '') return objLower[k]
  }

  for (const key of keys) {
    const k = key.toLowerCase().replace(/[\s_\-.]/g, '')

    for (const ok of Object.keys(objLower)) {
      if (ok.includes(k) || k.includes(ok)) {
        if (objLower[ok] !== undefined && objLower[ok] !== '') return objLower[ok]
      }
    }
  }

  return ''
}

function normalizeRow(obj, detectedPlatform) {
  const dateRaw = find(
    obj,
    'date_time',
    'datetime',
    'date',
    'timestamp',
    'time',
    'created_at',
    'transaction_date',
    'tip_date'
  )

  const username = find(
    obj,
    'username',
    'user_name',
    'user',
    'tipper',
    'tipper_name',
    'member',
    'member_name',
    'viewer',
    'fan',
    'sender',
    'nickname'
  )

  const platformRaw = find(obj, 'platform', 'site', 'source', 'network')
  const platform = detectedPlatform || platformRaw || 'Other'

  const tokensStr = find(
    obj,
    'tokens',
    'token',
    'amount',
    'credits',
    'coins',
    'tip_amount'
  )

  const tokensRaw = parseInt((tokensStr || '').toString().replace(/[^0-9]/g, '')) || 0

  const usdStr = find(obj, 'usd', 'earnings', 'revenue', 'payout', 'income', 'total')

  const usdRaw = parseFloat((usdStr || '').toString().replace(/[$,\s]/g, '')) || 0

  const tip_type = find(obj, 'tip_type', 'type', 'transaction_type', 'category') || 'Tip'

  const rate = PLATFORM_TOKEN_RATES[platform] || 0.05

  const usd = usdRaw > 0 ? usdRaw : tokensRaw * rate
  const tokens = tokensRaw > 0 ? tokensRaw : usd > 0 ? Math.round(usd / rate) : 0

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
  const cleaned = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()

  const lines = cleaned.split('\n').filter((l) => l.trim())

  if (lines.length < 1) return []

  const delimiter = detectDelimiter(lines[0])

  let headerLine = splitLine(lines[0], delimiter)

  const firstCell = headerLine[0]?.toLowerCase() || ''

  const looksLikeDate = /\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{2,4}/.test(firstCell)

  let headers

  if (looksLikeDate) {
    headers = ['date_time', 'username', 'tip_type', 'tokens', 'usd']
  } else {
    headers = headerLine.map((h) =>
      h
        .trim()
        .replace(/^["']|["']$/g, '')
        .toLowerCase()
        .replace(/\s+/g, '_')
    )
  }

  const startIndex = looksLikeDate ? 0 : 1

  console.log('Detected headers:', headers)

  const sampleRows = []

  for (let i = startIndex; i < Math.min(startIndex + 5, lines.length); i++) {
    const vals = splitLine(lines[i], delimiter)
    const obj = {}

    headers.forEach((h, j) => {
      obj[h] = (vals[j] || '').trim()
    })

    sampleRows.push(obj)
  }

  const detectedPlatform = forcePlatform || detectPlatform(headers, sampleRows)

  console.log('Detected platform:', detectedPlatform)

  const rows = []
  let skipped = 0

  for (let i = startIndex; i < lines.length; i++) {
    const vals = splitLine(lines[i], delimiter)

    const obj = {}

    headers.forEach((h, j) => {
      obj[h] = (vals[j] || '').replace(/^["']|["']$/g, '').trim()
    })

    const { dateRaw, username, platform, tokens, usd, tip_type } = normalizeRow(
      obj,
      detectedPlatform
    )

    if (!username || username === '—' || username === '-') {
      skipped++
      continue
    }

    if (tokens <= 0 && usd <= 0) {
      skipped++
      continue
    }

    const dateObj = parseDate(dateRaw)

    if (!dateObj) {
      skipped++
      continue
    }

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

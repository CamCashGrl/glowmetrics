// ─── PLATFORM TOKEN RATES ────────────────────────────────────────────────────
const PLATFORM_TOKEN_RATES = {
  Chaturbate:0.05,BongaCams:0.05,Stripchat:0.05,CamSoda:0.05,
  'Cherry.tv':0.05,Streamate:1.00,ImLive:0.055,Flirt4Free:0.08,
  LiveJasmin:0.08,MyFreeCams:0.05,Other:0.05,
}

// Normalize platform shortcodes
function normalizePlatform(raw) {
  if (!raw) return null
  const r = raw.toString().toLowerCase().trim()
  if (r==='bc'||r.includes('bonga')) return 'BongaCams'
  if (r.includes('chaturbate')||r==='cb') return 'Chaturbate'
  if (r.includes('stripchat')||r==='sc') return 'Stripchat'
  if (r.includes('camsoda')) return 'CamSoda'
  if (r.includes('cherry')) return 'Cherry.tv'
  if (r.includes('streamate')) return 'Streamate'
  if (r.includes('imlive')) return 'ImLive'
  if (r.includes('flirt')) return 'Flirt4Free'
  if (r.includes('jasmin')) return 'LiveJasmin'
  if (r.includes('myfreecams')||r==='mfc') return 'MyFreeCams'
  return null
}

// ─── CSV SPLITTER ────────────────────────────────────────────────────────────
function splitLine(line, delim) {
  const result=[];let cur='',inQ=false
  for(let i=0;i<line.length;i++){
    const ch=line[i]
    if(ch==='"'||ch==="'"){inQ=!inQ}
    else if(!inQ&&ch===delim){result.push(cur.trim());cur=''}
    else{cur+=ch}
  }
  result.push(cur.trim())
  return result
}

function detectDelimiter(line){
  const c={',':0,'\t':0,';':0,'|':0}
  for(const ch of line){if(c[ch]!==undefined)c[ch]++}
  return Object.entries(c).sort((a,b)=>b[1]-a[1])[0][0]
}

function cleanVal(v) {
  return (v||'').toString().replace(/\\"/g,'"').replace(/^["'\s]+|["'\s]+$/g,'').trim()
}

// ─── DATE PARSER ─────────────────────────────────────────────────────────────
function parseDate(raw){
  if(!raw)return null
  const s=raw.toString().trim().replace(/^["']+|["']+$/g,'')
  if(!s)return null

  // DD.MM.YYYY HH:MM (BongaCams)
  let m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})/)
  if(m){
    const d=new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}:00`)
    if(!isNaN(d.getTime()))return d
  }

  // DD.MM.YYYY
  m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if(m){
    const d=new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`)
    if(!isNaN(d.getTime()))return d
  }

  // "Feb 12, 2026, 5:05 AM" or "Feb 14, 2026, 12:54 PM" (Chaturbate raw export)
  m=s.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4}),\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if(m){
    const d=new Date(`${m[1]} ${m[2]}, ${m[3]} ${m[4]}:${m[5]} ${m[6]}`)
    if(!isNaN(d.getTime()))return d
  }
  m=s.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if(m){
    const d=new Date(`${m[1]} ${m[2]}, ${m[3]} ${m[4]}:${m[5]} ${m[6]||''}`)
    if(!isNaN(d.getTime()))return d
  }

  // DD/MM/YYYY or MM/DD/YYYY
  m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if(m){
    const y=m[3].length===2?'20'+m[3]:m[3]
    let d=new Date(`${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`)
    if(!isNaN(d.getTime()))return d
    d=new Date(`${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`)
    if(!isNaN(d.getTime()))return d
  }

  // ISO / natural
  const d=new Date(s)
  if(!isNaN(d.getTime()))return d

  // Unix timestamp
  if(/^\d{10,13}$/.test(s)){
    const ts=parseInt(s)
    const d2=new Date(s.length===10?ts*1000:ts)
    if(!isNaN(d2.getTime()))return d2
  }

  return null
}

// ─── PLATFORM DETECTION ──────────────────────────────────────────────────────
function detectPlatform(text){
  const t=(text||'').toLowerCase()
  if(t.includes('chaturbate'))return'Chaturbate'
  if(t.includes('bongacams')||t.includes('bonga'))return'BongaCams'
  if(t.includes('stripchat'))return'Stripchat'
  if(t.includes('camsoda'))return'CamSoda'
  if(t.includes('cherry'))return'Cherry.tv'
  if(t.includes('streamate'))return'Streamate'
  if(t.includes('imlive'))return'ImLive'
  if(t.includes('flirt4free'))return'Flirt4Free'
  if(t.includes('livejasmin')||t.includes('jasmin'))return'LiveJasmin'
  if(t.includes('myfreecams')||t.includes('mfc'))return'MyFreeCams'
  return null
}

// ─── FIND HEADER ROW (skip blank rows at top) ────────────────────────────────
function findHeaderRow(lines, delimiter) {
  for (let i=0; i<Math.min(5, lines.length); i++) {
    const line = lines[i].trim()
    if (!line) continue
    const vals = splitLine(line, delimiter).map(cleanVal)
    // If first col looks like a date → no headers, data starts here
    if (parseDate(vals[0])) return { headerIdx: -1, dataIdx: i }
    // If it has text-like headers
    if (vals.some(v => /^[a-zA-Z_\s\-#"']+$/.test(v) && v.length > 0)) {
      return { headerIdx: i, dataIdx: i+1 }
    }
  }
  return { headerIdx: -1, dataIdx: 0 }
}

// ─── CHATURBATE SPECIFIC PARSER ──────────────────────────────────────────────
// Columns: Timestamp, Token change, Token balance, Transaction type, User, Note
function parseChaturbateRow(obj) {
  const dateRaw = obj['timestamp'] || obj['date'] || ''
  const tokenChange = parseInt((obj['token_change']||obj['tokenchange']||obj['tokens']||'0').replace(/[^0-9\-]/g,'')) || 0
  const txType = (obj['transaction_type']||obj['transactiontype']||obj['action']||'').toLowerCase()
  const username = obj['user']||obj['username']||''
  const note = obj['note']||''

  // Skip non-tip rows (cashouts, referrals etc)
  if (tokenChange <= 0) return null
  if (txType && !txType.includes('tip') && !txType.includes('token')) return null

  return {
    dateRaw,
    username: username || 'anonymous',
    platform: 'Chaturbate',
    tokens: tokenChange,
    usd: parseFloat((tokenChange * 0.05).toFixed(2)),
    tip_type: note || txType || 'Tip'
  }
}

// ─── CHATURBATE RAW FORMAT PARSER ────────────────────────────────────────────
// Columns: Date, Action, Tokens, Token Balance
// Action contains "Tip From: username message" or "Transfer tokens..."
function parseChaturbateRawRow(obj) {
  const dateRaw = obj['date']||obj['timestamp']||''
  const action = obj['action']||obj['transaction_type']||''
  const tokensRaw = parseInt((obj['tokens']||obj['token_change']||'0').replace(/[^0-9\-]/g,'')) || 0

  if (tokensRaw <= 0) return null
  if (!action.toLowerCase().includes('tip')) return null

  // Extract username from "Tip From: username message"
  let username = 'anonymous'
  const tipMatch = action.match(/tip from:\s*([^\s,]+)/i)
  if (tipMatch) username = tipMatch[1]

  return {
    dateRaw,
    username,
    platform: 'Chaturbate',
    tokens: tokensRaw,
    usd: parseFloat((tokensRaw * 0.05).toFixed(2)),
    tip_type: 'Tip'
  }
}

// ─── GENERIC ROW PARSER WITH HEADERS ────────────────────────────────────────
function parseWithHeaders(obj, platform) {
  // Normalize keys once
  const norm = {}
  Object.keys(obj).forEach(k => { norm[k.toLowerCase().replace(/[\s\-]/g,'_')] = obj[k] })

  // Chaturbate raw format: has "action" column (Date, Action, Tokens, Token Balance)
  if (norm['action'] !== undefined) return parseChaturbateRawRow(norm)

  // Chaturbate standard format: has "token_change" or "transaction_type"
  if (norm['token_change'] !== undefined || norm['tokenchange'] !== undefined || norm['transaction_type'] !== undefined) {
    return parseChaturbateRow(norm)
  }

  // Generic: find fields by fuzzy name match
  function find(...keys) {
    const lower = {}
    Object.keys(obj).forEach(k => { lower[k.toLowerCase().replace(/[\s_\-\.]/g,'')] = obj[k] })
    for (const key of keys) {
      const k = key.toLowerCase().replace(/[\s_\-\.]/g,'')
      if (lower[k] !== undefined && lower[k] !== '') return lower[k]
    }
    for (const key of keys) {
      const k = key.toLowerCase().replace(/[\s_\-\.]/g,'')
      for (const ok of Object.keys(lower)) {
        if ((ok.includes(k)||k.includes(ok)) && lower[ok]!==undefined && lower[ok]!=='') return lower[ok]
      }
    }
    return ''
  }

  const dateRaw = find('date_time','datetime','date','timestamp','time','created_at','tipped_at','when')
  const username = find('username','user_name','user','tipper','member','viewer','name','display_name','from','fan','nick','handle')
  const platformRaw = find('platform','site','source','network')
  const tokensStr = find('tokens','token','amount','credits','points','gems','tip_amount','tipped')
  const usdStr = find('usd','amount_usd','earnings','revenue','payout','value','dollars','income','total','net')
  const tip_type = find('tip_type','type','transaction_type','category','tiptype','freechat') || 'Tip'

  const pl = platform || normalizePlatform(platformRaw) || 'Other'
  const rate = PLATFORM_TOKEN_RATES[pl] || 0.05
  const tokens = parseInt((tokensStr||'').replace(/[^0-9]/g,'')) || 0
  const usdRaw = parseFloat((usdStr||'').replace(/[$,\s]/g,'')) || 0
  const usd = usdRaw > 0 ? usdRaw : tokens * rate

  if (tokens <= 0 && usd <= 0) return null

  return {
    dateRaw, username: username||'',
    platform: pl, tokens: tokens>0?tokens:Math.round(usd/rate),
    usd: parseFloat(usd.toFixed(2)), tip_type
  }
}

// ─── HEADERLESS ROW PARSER (original BongaCams style) ────────────────────────
function parseHeaderless(vals, platform) {
  let dateRaw='', username='', tip_type='Tip', tokens=0, usd=0

  for (let i=0; i<vals.length; i++) {
    const v = vals[i]
    if (!dateRaw && parseDate(v)) { dateRaw=v; continue }
    if (v.includes('$') || (/^\d+\.\d+$/.test(v) && parseFloat(v)<1000)) {
      usd = parseFloat(v.replace(/[$,]/g,'')) || 0; continue
    }
    if (/^\d+$/.test(v) && parseInt(v)>0 && !tokens) { tokens=parseInt(v); continue }
    if (/tip|token|gift|purchase|sub|donat|freechat/i.test(v)) { tip_type=v; continue }
    if (!username && v && v.length>0 && v!=='-') username=v
  }

  const pl = platform || 'BongaCams'
  const rate = PLATFORM_TOKEN_RATES[pl] || 0.05
  const finalUsd = usd>0 ? usd : tokens*rate
  const finalTokens = tokens>0 ? tokens : Math.round(finalUsd/rate)

  return { dateRaw, username, platform:pl, tokens:finalTokens, usd:parseFloat(finalUsd.toFixed(2)), tip_type }
}

// ─── MAIN CSV PARSER ─────────────────────────────────────────────────────────
export function parseCSV(text, forcePlatform) {
  const cleaned = text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim()
  const lines = cleaned.split('\n').filter(l => l.trim())
  if (lines.length < 1) return []

  const delimiter = detectDelimiter(lines[0] || lines[1] || '')
  const platform = forcePlatform || detectPlatform(cleaned.slice(0,1000))

  const { headerIdx, dataIdx } = findHeaderRow(lines, delimiter)
  const hasHdrs = headerIdx >= 0
  const headers = hasHdrs
    ? splitLine(lines[headerIdx], delimiter).map(h => cleanVal(h).toLowerCase())
    : null

  const rows = []; let skipped = 0

  for (let i = dataIdx; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const vals = splitLine(line, delimiter).map(cleanVal)
    if (vals.every(v => !v)) continue // skip fully empty rows

    let parsed
    if (hasHdrs && headers) {
      const obj = {}
      headers.forEach((h,j) => { obj[h] = vals[j]||'' })
      parsed = parseWithHeaders(obj, platform)
    } else {
      parsed = parseHeaderless(vals, platform)
    }

    if (!parsed) { skipped++; continue }
    const { dateRaw, username, platform:pl, tokens, usd, tip_type } = parsed

    if (!username || username==='-' || username==='—') { skipped++; continue }
    if (tokens <= 0 && usd <= 0) { skipped++; continue }

    const dateObj = parseDate(dateRaw)
    if (!dateObj) { skipped++; continue }

    rows.push({
      date_time: dateObj.toISOString(),
      platform: pl || 'Other',
      username,
      tip_type: tip_type||'Tip',
      tokens,
      usd,
    })
  }

  console.log(`Parsed ${rows.length} rows (${skipped} skipped) | platform:${platform} | headers:${hasHdrs}`)
  return rows
}

// ─── AGGREGATION ─────────────────────────────────────────────────────────────
export function aggregateRows(rows){
  const daily={},hourly={},monthly={},tippers={},platforms={},tipTypes={}
  for(let h=0;h<24;h++)hourly[h]={h,tokens:0,usd:0,count:0}

  for(const r of rows){
    const date=r.date_time.slice(0,10)
    const month=r.date_time.slice(0,7)
    const h=new Date(r.date_time).getHours()

    daily[date]=daily[date]||{date,tokens:0,usd:0,count:0}
    daily[date].tokens+=r.tokens;daily[date].usd=+(daily[date].usd+r.usd).toFixed(2);daily[date].count++

    monthly[month]=monthly[month]||{month,tokens:0,usd:0,count:0}
    monthly[month].tokens+=r.tokens;monthly[month].usd=+(monthly[month].usd+r.usd).toFixed(2);monthly[month].count++

    hourly[h].tokens+=r.tokens;hourly[h].usd=+(hourly[h].usd+r.usd).toFixed(2);hourly[h].count++

    tippers[r.username]=tippers[r.username]||{username:r.username,usd:0,tokens:0,count:0,platforms:new Set(),first:date,last:''}
    tippers[r.username].usd=+(tippers[r.username].usd+r.usd).toFixed(2)
    tippers[r.username].tokens+=r.tokens;tippers[r.username].count++
    tippers[r.username].platforms.add(r.platform)
    if(date>tippers[r.username].last)tippers[r.username].last=date
    if(date<tippers[r.username].first)tippers[r.username].first=date

    platforms[r.platform]=platforms[r.platform]||{platform:r.platform,usd:0,tokens:0,count:0}
    platforms[r.platform].usd=+(platforms[r.platform].usd+r.usd).toFixed(2)
    platforms[r.platform].tokens+=r.tokens;platforms[r.platform].count++

    tipTypes[r.tip_type]=tipTypes[r.tip_type]||{type:r.tip_type,usd:0,tokens:0,count:0}
    tipTypes[r.tip_type].usd=+(tipTypes[r.tip_type].usd+r.usd).toFixed(2)
    tipTypes[r.tip_type].tokens+=r.tokens;tipTypes[r.tip_type].count++
  }

  const now=new Date()
  const topTippers=Object.values(tippers).sort((a,b)=>b.usd-a.usd).slice(0,200).map(t=>{
    const daysSince=Math.floor((now-new Date(t.last))/86400000)
    const status=t.usd>=50?'🐳 WHALE':t.usd>=20?'🦈 SHARK':daysSince>60?'💤 DORMANT':'🐟 REGULAR'
    return{...t,daysSince,status,platforms:[...t.platforms]}
  })

  const totalUsd=rows.reduce((s,r)=>s+r.usd,0)
  const totalTokens=rows.reduce((s,r)=>s+r.tokens,0)
  const biggestTip=rows.reduce((max,r)=>r.usd>max.usd?r:max,{usd:0,tokens:0,username:'—'})
  const dailyArr=Object.values(daily).sort((a,b)=>a.date<b.date?-1:1)
  const bestDay=dailyArr.reduce((max,d)=>d.usd>max.usd?d:max,{usd:0,date:'—'})
  const monthlyArr=Object.values(monthly).sort((a,b)=>a.month<b.month?-1:1)
  const bestMonth=monthlyArr.reduce((max,m)=>m.usd>max.usd?m:max,{usd:0,month:'—'})
  const platformArr=Object.values(platforms).sort((a,b)=>b.usd-a.usd)
  const hourlyArr=Array.from({length:24},(_,h)=>({...hourly[h],label:`${h===0?12:h>12?h-12:h}${h<12?'am':'pm'}`}))
  const peakHour=hourlyArr.reduce((a,b)=>b.usd>a.usd?b:a,hourlyArr[0])
  let running=0
  const cumulative=dailyArr.map(d=>{running=+(running+d.usd).toFixed(2);return{...d,cumulative:running}})

  return{
    daily:dailyArr,cumulative,monthly:monthlyArr,monthlyArr,
    hourly:hourlyArr,hourlyArr,topTippers,platformArr,
    platforms:platformArr,tipTypes:Object.values(tipTypes).sort((a,b)=>b.usd-a.usd),
    peakHour,bestDay,bestMonth,biggestTip,
    totals:{
      usd:+totalUsd.toFixed(2),tokens:totalTokens,tips:rows.length,
      avgTip:rows.length>0?+(totalUsd/rows.length).toFixed(2):0,
      avgPerDay:dailyArr.length>0?+(totalUsd/dailyArr.length).toFixed(2):0,
      uniqueTippers:Object.keys(tippers).length,activeDays:dailyArr.length,
      topWhale:topTippers[0]?.username||'—',topWhaleUsd:topTippers[0]?.usd||0,
      topWhaleTokens:topTippers[0]?.tokens||0,
      whales:topTippers.filter(t=>t.status==='🐳 WHALE').length,
      sharks:topTippers.filter(t=>t.status==='🦈 SHARK').length,
      dormant:topTippers.filter(t=>t.status==='💤 DORMANT').length,
    }
  }
}

export const TRIAL_DAYS=14
export function getTrialStatus(createdAt){
  if(!createdAt)return{active:false,daysLeft:0,expired:true}
  const daysUsed=Math.floor((new Date()-new Date(createdAt))/86400000)
  const daysLeft=Math.max(0,TRIAL_DAYS-daysUsed)
  return{active:daysLeft>0,daysLeft,expired:daysLeft===0,daysUsed}
}
export function applyPlanLimits(data,plan,trialActive){
  if(plan==='pro'||trialActive)return data
  const cutoff=new Date(Date.now()-90*86400000).toISOString().slice(0,10)
  const topPlatform=data.platforms[0]?.platform||null
  return{...data,daily:data.daily.filter(d=>d.date>=cutoff),cumulative:data.cumulative.filter(d=>d.date>=cutoff),topTippers:data.topTippers.slice(0,25),platforms:topPlatform?data.platforms.filter(p=>p.platform===topPlatform):data.platforms,_limited:true,_limitMsg:"Upgrade to Pro to unlock all platforms, full history, and unlimited tippers."}
}
export const SUPPORTED_PLATFORMS=[
  {name:'Chaturbate',color:'#f472b6',icon:'🎭'},{name:'BongaCams',color:'#c084fc',icon:'📹'},
  {name:'Stripchat',color:'#d946ef',icon:'💬'},{name:'CamSoda',color:'#2dd4bf',icon:'🥤'},
  {name:'Cherry.tv',color:'#f87171',icon:'🍒'},{name:'Streamate',color:'#fbbf24',icon:'📡'},
  {name:'ImLive',color:'#34d399',icon:'🎬'},{name:'Flirt4Free',color:'#818cf8',icon:'💌'},
  {name:'LiveJasmin',color:'#fb923c',icon:'🌹'},{name:'MyFreeCams',color:'#60a5fa',icon:'🎥'},
]

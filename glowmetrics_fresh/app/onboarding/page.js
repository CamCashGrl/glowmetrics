'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
// Token rates — single source of truth, never hardcode below this line
import { PLATFORM_TOKEN_RATES, tokenRate } from '../../lib/constants'
import { computeSnapshotStats } from '../../lib/analytics'
import { track } from '../../lib/track'
import { logParseAttempt, analyzeFormat } from '../../lib/parseTracking'
import OnboardingExitSurvey from '@/components/OnboardingExitSurvey'


const PLATFORMS = {
  chaturbate:{
    label:'Chaturbate',short:'CB',
    iconStyle:{background:'#F05A2A',color:'#fff'},
    instructions:'Go to your profile → Token Stats tab. Select All Time. Highlight the table, copy, and paste below.',
    earningsUrl:(u)=>u?`https://chaturbate.com/p/${u}/?tab=tokens`:'https://chaturbate.com/accounts/settings/',
    placeholder:'Paste your Chaturbate tip history here...\n\nExample:\nJun 18, 2026, 8:27 PM\nTip From: username123\n500  12345\n\nJun 18, 2026, 9:14 PM\nTip From: whaleking99\n1000  12346',
  },
  bongacams:{
    label:'BongaCams',short:'BC',
    iconStyle:{background:'#311222',color:'#FF3B6E',border:'1px solid rgba(255,59,110,0.25)'},
    instructions:'Go to Reports → General. Select your date range. Highlight all rows, copy, and paste below. You can also paste your Paid Chat section separately.',
    earningsUrl:()=>'https://bongamodels.com/reports/general',
    placeholder:'Paste your BongaCams tip history here...\n\nExample:\n18.06.2026 14:32\tusername123\t500\t25.00\n18.06.2026 15:14\twhaleking99\t1000\t50.00\n18.06.2026 15:45\tregularfan\t25\t1.25',
  },
  myfreecams:{
    label:'MyFreeCams',short:'MFC',
    iconStyle:{background:'#2D2226',color:'#FF8B2C',border:'1px solid rgba(255,139,44,0.25)'},
    instructions:'Go to Token Sessions. Set your date range, highlight all rows, copy and paste below.',
    earningsUrl:()=>'https://profiles.myfreecams.com/_/ext/token_sessions',
    placeholder:'Paste your MyFreeCams tip history here...\n\nExample:\n1746555770\tJun 18th, 2026 10:40 PM\t500\tusername123\tTip\n1746555771\tJun 18th, 2026 11:02 PM\t1000\twhaleking99\tTip',
  },
}

// Token rates come from lib/constants.js — do not define here
const TOKEN_RATES = {
  chaturbate: PLATFORM_TOKEN_RATES.Chaturbate,
  bongacams:  PLATFORM_TOKEN_RATES.BongaCams,
  myfreecams: PLATFORM_TOKEN_RATES.MyFreeCams,
}
const LOADING_MESSAGES=['Cleaning your tip history…','Finding your top fans…','Calculating your average earnings per hour…','Detecting your best stream windows…','Building your dashboard…']
const EXTRA_MSGS=['Importing additional tip history…','Merging with your dashboard…','Updating your insights…']

// BongaCams paid chat session types
const BC_PAID_TYPES=['Private Chat','Full-Private Chat','Group Chat','Spy Mode']

// Chaturbate private show pattern
const CB_PRIVATE_SHOW_PATTERN = /^Private Show:/i

// MyFreeCams private type
const MFC_PRIVATE_TYPE = 'Private'

// ── Parsers ────────────────────────────────────────────────────
function tryParseDate(str){
  if(!str)return null;const s=str.trim()
  const cbMatch=s.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i)
  if(cbMatch){const[,mon,day,year,hr,min,ampm]=cbMatch;const months={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};let h=parseInt(hr,10);if(ampm.toUpperCase()==='PM'&&h!==12)h+=12;if(ampm.toUpperCase()==='AM'&&h===12)h=0;const d=new Date(parseInt(year),months[mon.toLowerCase()],parseInt(day),h,parseInt(min));if(!isNaN(d.getTime()))return d}
  const bcMatch=s.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/)
  if(bcMatch){const[,day,mon,year,hr,min]=bcMatch;const d=new Date(parseInt(year),parseInt(mon)-1,parseInt(day),parseInt(hr),parseInt(min));if(!isNaN(d.getTime()))return d}
  const mfcMatch=s.match(/^([A-Za-z]{3})\s+(\d{1,2})(?:st|nd|rd|th),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i)
  if(mfcMatch){const[,mon,day,year,hr,min,ampm]=mfcMatch;const months={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};let h=parseInt(hr,10);if(ampm.toUpperCase()==='PM'&&h!==12)h+=12;if(ampm.toUpperCase()==='AM'&&h===12)h=0;const d=new Date(parseInt(year),months[mon.toLowerCase()],parseInt(day),h,parseInt(min));if(!isNaN(d.getTime()))return d}
  const d=new Date(s);if(!isNaN(d.getTime()))return d;return null
}

// Detects if a BongaCams tab-separated row is a paid chat session
// Returns session_type string or null
function detectBCPaidRow(cols){
  if(!cols||cols.length<4)return null
  for(const t of BC_PAID_TYPES){
    if(cols.some(c=>c.trim()===t))return t
  }
  return null
}

// Parse BongaCams paid chat rows into paid_session objects
function parseBCPaidSessions(rawText){
  const lines=rawText.split('\n').map(l=>l.trim()).filter(Boolean)
  const sessions=[];let skipped=0
  const headerKw=['date','time','member','chat','type','tokens','payout','earned']
  for(const line of lines){
    const cols=line.split(/\t/).map(c=>c.trim().replace(/^"|"$/g,''))
    if(cols.length<4){skipped++;continue}
    const lower=cols.map(c=>c.toLowerCase())
    if(lower.filter(c=>headerKw.some(k=>c.includes(k))).length>=2)continue
    const sessionType=detectBCPaidRow(cols)
    if(!sessionType){skipped++;continue}
    let ts=null,username=null,tokens=0,usd=0
    for(const col of cols){
      const d=tryParseDate(col)
      if(d&&!ts){ts=d;continue}
      if(col===sessionType)continue
      // Strip $, comma, AND whitespace (incl. NBSP/narrow-NBSP thousands
      // separators like BongaCams' "1 507") before parsing — parseFloat
      // otherwise stops at the first non-numeric character and silently
      // truncates e.g. "1 507" tokens down to 1.
      const n=parseFloat(col.replace(/[$,\s]/g,''))
      if(!isNaN(n)&&n>0){
        if(Number.isInteger(n)&&n<100000&&tokens===0)tokens=Math.round(n)
        else if(n<50000&&usd===0)usd=n
      } else if(col.length>1&&col.length<=50&&isNaN(parseFloat(col))&&!username){
        username=col
      }
    }
    if(!ts||!username||tokens<1){skipped++;continue}
    sessions.push({ts,username,sessionType,tokens,usd:usd>0?usd:+(tokens*tokenRate('BongaCams')).toFixed(4)})
  }
  return{sessions,skipped}
}

// Parse Chaturbate private shows into paid_session objects
function parseCBPrivateSessions(rawText){
  const lines=rawText.split('\n').map(l=>l.trim()).filter(Boolean)
  const sessions=[];let skipped=0
  const dateLineRe=/^([A-Za-z]{3}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}\s+[AP]M)/i
  const privateShowRe=/^Private Show:\s*(.+)/i
  const tokensLineRe=/^(\d+)\s+(\d+)$/

  let i=0
  while(i<lines.length){
    const dateMatch=lines[i].match(dateLineRe)
    if(dateMatch){
      const ts=tryParseDate(dateMatch[1])
      const actionLine=lines[i+1]||''
      const privateMatch=actionLine.match(privateShowRe)
      if(ts&&privateMatch){
        const username=privateMatch[1].trim()
        const tokensLine=lines[i+2]||''
        const tMatch=tokensLine.match(tokensLineRe)
        if(tMatch){
          const tokens=parseInt(tMatch[1],10)
          if(tokens>=1){
            const usd=+(tokens*TOKEN_RATES.chaturbate).toFixed(2)
            sessions.push({ts,username,sessionType:'Private Show',tokens,usd})
          }else skipped++
        }else skipped++
      }
      i++
    }else i++
  }
  return{sessions,skipped}
}

// Parse MyFreeCams private earnings into paid_session objects
function parseMFCPrivateSessions(rawText){
  const lines=rawText.split('\n').map(l=>l.trim()).filter(Boolean)
  const sessions=[];let skipped=0
  const splitCols=l=>l.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c=>c.trim().replace(/^"|"$/g,''))
  const shiftRefId=cols=>{if(cols[0]&&/^\d{8,}$/.test(cols[0].trim()))cols.shift();return cols}

  const ROLE_KW={
    timestamp:['timestamp','date/time','date','time'],
    tokens:['token change','tokens','token amt'],
    usd:['usd','payout','earnings','dollar','amount'],
    type:['transaction type','type','action'],
    username:['user','username','member','from','sender'],
  }
  const mapHeaderRow=cols=>{
    const lower=cols.map(c=>c.toLowerCase().trim())
    const map={};const claimed=new Set()
    for(const role of['timestamp','tokens','usd','type','username']){
      for(let i=0;i<lower.length;i++){
        if(claimed.has(i))continue
        if(ROLE_KW[role].some(k=>lower[i]===k||lower[i].includes(k))){map[role]=i;claimed.add(i);break}
      }
    }
    return map
  }

  const firstCols=lines.length?splitCols(lines[0]):[]
  const hasRefIdCol=firstCols[0]&&/^reference\s+id|ref\s*id/i.test(firstCols[0])
  const headerCols=hasRefIdCol?firstCols.slice(1):firstCols
  const headerMap=mapHeaderRow(headerCols)
  const hasHeaderRow=headerMap.timestamp!==undefined&&headerMap.tokens!==undefined

  for(const[idx,line]of lines.entries()){
    if(hasHeaderRow&&idx===0)continue
    const cols=hasRefIdCol?shiftRefId(splitCols(line)):splitCols(line)
    if(cols.length<2){skipped++;continue}

    if(hasHeaderRow){
      const type=headerMap.type!==undefined?cols[headerMap.type]:''
      if(!type||type.toLowerCase()!==MFC_PRIVATE_TYPE.toLowerCase()){skipped++;continue}
      const ts=headerMap.timestamp!==undefined?tryParseDate(cols[headerMap.timestamp]):null
      if(!ts){skipped++;continue}
      const tokensRaw=headerMap.tokens!==undefined?parseFloat(String(cols[headerMap.tokens]).replace(/[$,]/g,'')):NaN
      const tokens=Number.isFinite(tokensRaw)?Math.round(tokensRaw):null
      if(!tokens||tokens<1){skipped++;continue}
      const username=headerMap.username!==undefined?cols[headerMap.username].trim():''
      const usdRaw=headerMap.usd!==undefined?parseFloat(String(cols[headerMap.usd]).replace(/[$,]/g,'')):NaN
      const usd=Number.isFinite(usdRaw)&&usdRaw>0?usdRaw:+(tokens*TOKEN_RATES.myfreecams).toFixed(2)
      sessions.push({ts,username:username||'anonymous',sessionType:'Private',tokens,usd})
      continue
    }
    skipped++
  }
  return{sessions,skipped}
}

export function parseRows(rawText,platformId){
  const rate=TOKEN_RATES[platformId]||0.05
  const lines=rawText.split('\n').map(l=>l.trim()).filter(Boolean)
  const rows=[];let skipped=0
  const dateLineRe=/^([A-Za-z]{3}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}\s+[AP]M)/i
  const tipFromRe=/^Tip From:\s*(.+)/i
  // Fan Club Membership purchases are real earnings from a named fan, same
  // as a tip — counted into totals here, tagged via `note` so they stay
  // distinguishable from ordinary tips downstream.
  const fanClubRe=/^Fan Club Membership:\s*(.+)/i
  // Not earnings from a fan at all — an account-level token debit/cashout.
  // Recognized explicitly so they're counted as skipped instead of silently
  // vanishing from the row/skip totals shown to the user.
  const nonEarningActionRe=/^(Admin Adjustment|Transfer tokens to)\b/i
  const tokensLineRe=/^(\d+)\s+(\d+)$/
  const isMultiLine=lines.some(l=>tipFromRe.test(l)||fanClubRe.test(l)||CB_PRIVATE_SHOW_PATTERN.test(l))
  if(isMultiLine){
    let i=0
    while(i<lines.length){
      const dateMatch=lines[i].match(dateLineRe)
      if(dateMatch){
        const ts=tryParseDate(dateMatch[1]);const actionLine=lines[i+1]||''
        // Skip private shows - they're handled by parseCBPrivateSessions
        if(CB_PRIVATE_SHOW_PATTERN.test(actionLine)){i++;continue}
        if(nonEarningActionRe.test(actionLine)){skipped++;i++;continue}
        const tipMatch=actionLine.match(tipFromRe)
        const fanClubMatch=!tipMatch&&actionLine.match(fanClubRe)
        if(ts&&(tipMatch||fanClubMatch)){
          const username=(tipMatch?tipMatch[1]:fanClubMatch[1]).trim();let tokensLine=lines[i+2]||'';let note='';let tMatch=tokensLine.match(tokensLineRe)
          if(!tMatch&&lines[i+3]){note=tokensLine;tokensLine=lines[i+3]||'';tMatch=tokensLine.match(tokensLineRe)}
          if(tMatch){
            const tokens=parseInt(tMatch[1],10)
            if(tokens>=1){
              const usd=+(tokens*rate).toFixed(2)
              if(fanClubMatch)note=note?`Fan Club Membership: ${note}`:'Fan Club Membership'
              rows.push({ts,username,tokens,usd,note})
            }else skipped++
          }else skipped++
        }
        i++
      }else i++
    }
    return{rows,skipped}
  }
  const headerKw=['date','time','user','token','usd','tip','amount','note','message','from','type','stamp','earning','reference','private','voyeur','group','xfer','returned','fines','total','mfc','away','club','display','sort','period','payment','month','search']
  const splitCols=l=>l.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c=>c.trim().replace(/^"|"$/g,''))
  const shiftRefId=cols=>{if(cols[0]&&/^\d{8,}$/.test(cols[0].trim()))cols.shift();return cols}

  // Map an actual header row's column names to their role (timestamp/tokens/
  // balance/type/username/note) so data rows are read by column identity
  // instead of guessed by position. This must only ever run on the header
  // row itself — running a keyword scan on every row (the old approach)
  // false-positives on ordinary fan notes that happen to contain common
  // words like "time"/"from"/"private"/"tip", silently dropping real tips.
  const ROLE_KW={
    timestamp:['timestamp','date/time','date','time'],
    tokens:['token change','tokens','token amt'],
    balance:['token balance','balance'],
    usd:['usd','payout','earnings','dollar','amount'],
    type:['transaction type','type','action'],
    username:['user','username','member','from','sender'],
    note:['note','message','notes','comment'],
  }
  const mapHeaderRow=cols=>{
    const lower=cols.map(c=>c.toLowerCase().trim())
    const map={};const claimed=new Set()
    for(const role of['timestamp','tokens','balance','usd','type','username','note']){
      for(let i=0;i<lower.length;i++){
        if(claimed.has(i))continue
        if(ROLE_KW[role].some(k=>lower[i]===k||lower[i].includes(k))){map[role]=i;claimed.add(i);break}
      }
    }
    return map
  }
  const firstCols=lines.length?shiftRefId(splitCols(lines[0])):[]
  const headerMap=mapHeaderRow(firstCols)
  const hasHeaderRow=headerMap.timestamp!==undefined&&(headerMap.tokens!==undefined||headerMap.username!==undefined)

  for(const[idx,line]of lines.entries()){
    if(hasHeaderRow&&idx===0)continue // the actual header row — skip once, by position, not by content scan
    const cols=shiftRefId(splitCols(line))
    if(cols.length<2){skipped++;continue}
    // Skip BongaCams paid chat rows from the free tips parser
    if(detectBCPaidRow(cols)){skipped++;continue}

    if(hasHeaderRow){
      const type=headerMap.type!==undefined?cols[headerMap.type]:''
      if(type&&/cash|payout|withdraw/i.test(type)){skipped++;continue}
      // Skip MyFreeCams private sessions - they're handled by parseMFCPrivateSessions
      if(platformId==='myfreecams'&&type.toLowerCase()===MFC_PRIVATE_TYPE.toLowerCase()){skipped++;continue}
      const ts=headerMap.timestamp!==undefined?tryParseDate(cols[headerMap.timestamp]):null
      if(!ts){skipped++;continue}
      const tokensRaw=headerMap.tokens!==undefined?parseFloat(String(cols[headerMap.tokens]).replace(/[$,]/g,'')):NaN
      const tokens=Number.isFinite(tokensRaw)?Math.round(tokensRaw):null
      if(!tokens||tokens<1){skipped++;continue}
      const username=headerMap.username!==undefined?cols[headerMap.username].trim():''
      const note=headerMap.note!==undefined?cols[headerMap.note]:''
      // Earnings always come from the actual tip amount, never the running
      // account balance ("Token balance") — that's a cumulative total, not
      // a per-tip payout. Prefer an explicit USD/payout column if the
      // platform's export has one; otherwise derive from tokens × rate.
      const usdRaw=headerMap.usd!==undefined?parseFloat(String(cols[headerMap.usd]).replace(/[$,]/g,'')):NaN
      const usd=Number.isFinite(usdRaw)&&usdRaw>0?usdRaw:+(tokens*rate).toFixed(2)
      rows.push({ts,username:username||'anonymous',tokens,usd,note})
      continue
    }

    // Headerless fallback — no column names to map by, so guess by shape.
    const lower=cols.map(c=>c.toLowerCase())
    if(lower.filter(c=>headerKw.some(k=>c.includes(k))).length>=2)continue
    let ts=null,tsIdx=-1
    for(let i=0;i<cols.length;i++){const d=tryParseDate(cols[i]);if(d){ts=d;tsIdx=i;break}}
    if(!ts){skipped++;continue}
    const rest=cols.filter((_,i)=>i!==tsIdx)
    let tokens=null,usd=null,username=null,note=''
    for(const col of rest){
      const n=parseFloat(col.replace(/[$,]/g,''))
      if(!isNaN(n)&&n>0){
        if(Number.isInteger(n)&&n>=1&&n<100000&&tokens===null)tokens=n
        else if(!Number.isInteger(n)&&n<5000&&usd===null)usd=n
        else if(Number.isInteger(n)&&n>=1&&n<100000&&tokens===null)tokens=n
        // A whole-dollar payout (e.g. "9.00") parses to an integer and
        // matched neither branch above once tokens was already found —
        // silently dropping a real trusted payout in favor of a token-rate
        // estimate. Once tokens is known and usd isn't, treat the next
        // positive number as the real payout regardless of its integer-ness.
        else if(tokens!==null&&usd===null)usd=n
      }else if(col.length>0&&isNaN(parseFloat(col))){
        if(username===null&&col.length<=50&&col.length>1)username=col
        else if(note===''&&col.length>0)note=col
      }
    }
    if(!tokens||tokens<1){skipped++;continue}
    if(!usd)usd=+(tokens*rate).toFixed(2)
    rows.push({ts,username:username||'anonymous',tokens,usd,note})
  }
  return{rows,skipped}
}

function pasteToCSVBlob(rawText,platformId){
  const{rows,skipped}=parseRows(rawText,platformId)
  const csvRows=['date_time,username,tokens,usd,note']
  for(const r of rows){const isoTs=r.ts.toISOString().replace('T',' ').slice(0,19);csvRows.push(`${isoTs},${r.username.replace(/,/g,'')},${r.tokens},${r.usd},${r.note.replace(/,/g,'')}`)}
  return{blob:new Blob([csvRows.join('\n')],{type:'text/csv'}),rowCount:rows.length,skipped}
}

// Convert paid sessions to CSV blob for upload via /api/upload-paid-sessions
function paidSessionsToCSVBlob(sessions){
  const csvRows=['date_time,username,session_type,tokens,usd']
  for(const s of sessions){
    const isoTs=s.ts.toISOString().replace('T',' ').slice(0,19)
    csvRows.push(`${isoTs},${s.username.replace(/,/g,'')},${s.sessionType.replace(/,/g,'')},${s.tokens},${s.usd}`)
  }
  return new Blob([csvRows.join('\n')],{type:'text/csv'})
}

export function buildPreview(rawText,platformId,platformLabel){
  const{rows,skipped}=parseRows(rawText,platformId)

  // Detect paid sessions for all platforms
  let paidSessions=[]
  if(platformId==='bongacams'){
    const res=parseBCPaidSessions(rawText)
    paidSessions=res.sessions
  }else if(platformId==='chaturbate'){
    const res=parseCBPrivateSessions(rawText)
    paidSessions=res.sessions
  }else if(platformId==='myfreecams'){
    const res=parseMFCPrivateSessions(rawText)
    paidSessions=res.sessions
  }

  if(!rows.length&&!paidSessions.length)return null
  const totalUsd=rows.reduce((s,r)=>s+r.usd,0)
  const paidUsd=paidSessions.reduce((s,r)=>s+r.usd,0)
  const allRows=[...rows,...paidSessions.map(s=>({...s,ts:s.ts,username:s.username,tokens:s.tokens,usd:s.usd}))]
  const fans=new Set([...rows,...paidSessions].map(r=>(r.username||'').toLowerCase().trim()).filter(Boolean)).size
  const dates=allRows.map(r=>r.ts).sort((a,b)=>a-b)
  const topSpender=Object.entries(allRows.reduce((acc,r)=>{acc[r.username]=(acc[r.username]||0)+r.tokens;return acc},{})).sort((a,b)=>b[1]-a[1])[0]
  const hourCounts=allRows.reduce((acc,r)=>{const h=r.ts.getHours();acc[h]=(acc[h]||0)+r.tokens;return acc},{})
  const bestHour=Object.entries(hourCounts).sort((a,b)=>b[1]-a[1])[0]
  const fmtHour=h=>{const n=parseInt(h);return n===0?'12am':n<12?`${n}am`:n===12?'12pm':`${n-12}pm`}
  // A raw token-sum peak hour can be driven entirely by a single whale tip on
  // a single day — that's not evidence of a repeatable streaming window, just
  // that one big transaction happened to land in that hour. Only call it a
  // confident "sweet spot" if tips from at least 2 distinct calendar days
  // landed in that hour; otherwise the UI shows the raw peak without implying
  // it's a reliable pattern.
  let bestHourConfident=false
  if(bestHour){
    const targetHour=parseInt(bestHour[0])
    const distinctDays=new Set(allRows.filter(r=>r.ts.getHours()===targetHour).map(r=>r.ts.toDateString()))
    bestHourConfident=distinctDays.size>=2
  }
  return{
    tipsDetected:rows.length,
    paidSessionsDetected:paidSessions.length,
    paidSessions,
    estimatedEarnings:+(totalUsd+paidUsd).toFixed(2),
    paidEarnings:+paidUsd.toFixed(2),
    fansDetected:fans,
    dateRange:dates.length?`${dates[0].toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${dates[dates.length-1].toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`:'—',
    topSpender:topSpender?{name:topSpender[0],tokens:topSpender[1]}:null,
    bestHour:bestHour?fmtHour(bestHour[0]):null,
    bestHourConfident,
    sampleRows:rows.slice(0,5).map(r=>({date:r.ts.toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}),fan:r.username,tokens:r.tokens,amount:r.usd,platform:platformLabel})),
    // Full parsed rows + the shared Free-tier 31-day window computed from
    // them (lib/analytics.js computeSnapshotStats — same function the CSV
    // upload API route uses) so the onboarding success states can show real
    // "full imported range" vs "most recent 31 days" numbers instead of
    // reusing the flat totals above for both.
    rows,
    snapshot:computeSnapshotStats(rows.map(r=>({date:r.ts,tokens:r.tokens,usd:r.usd})),31),
  }
}

// ── Ambient particle canvas ────────────────────────────────────
function AmbientParticles(){
  const ref=useRef()
  useEffect(()=>{
    const c=ref.current;if(!c)return
    const ctx=c.getContext('2d')
    const resize=()=>{c.width=window.innerWidth;c.height=window.innerHeight}
    resize();window.addEventListener('resize',resize)
    const COLS=['rgba(33,230,243,','rgba(255,47,174,','rgba(139,92,246,','rgba(255,255,255,']
    const pts=Array.from({length:55},()=>({
      x:Math.random()*c.width,y:Math.random()*c.height,
      r:Math.random()*1.5+0.3,
      col:COLS[Math.floor(Math.random()*COLS.length)],
      alpha:Math.random()*0.5+0.1,
      aDir:Math.random()>0.5?1:-1,
      aSpd:Math.random()*0.008+0.003,
      vx:(Math.random()-0.5)*0.18,
      vy:(Math.random()-0.5)*0.18,
    }))
    let raf
    const draw=()=>{
      ctx.clearRect(0,0,c.width,c.height)
      pts.forEach(p=>{
        p.x+=p.vx;p.y+=p.vy
        p.alpha+=p.aDir*p.aSpd
        if(p.alpha>=0.65){p.alpha=0.65;p.aDir=-1}
        if(p.alpha<=0.05){p.alpha=0.05;p.aDir=1}
        if(p.x<-4)p.x=c.width+4;if(p.x>c.width+4)p.x=-4
        if(p.y<-4)p.y=c.height+4;if(p.y>c.height+4)p.y=-4
        ctx.beginPath()
        ctx.arc(p.x,p.y,p.r,0,Math.PI*2)
        ctx.fillStyle=`${p.col}${p.alpha.toFixed(2)})`
        ctx.fill()
        if(p.alpha>0.4&&p.r>1){
          ctx.strokeStyle=`${p.col}${(p.alpha*0.4).toFixed(2)})`
          ctx.lineWidth=0.5
          ctx.beginPath();ctx.moveTo(p.x-p.r*2.5,p.y);ctx.lineTo(p.x+p.r*2.5,p.y);ctx.stroke()
          ctx.beginPath();ctx.moveTo(p.x,p.y-p.r*2.5);ctx.lineTo(p.x,p.y+p.r*2.5);ctx.stroke()
        }
      })
      raf=requestAnimationFrame(draw)
    }
    raf=requestAnimationFrame(draw)
    return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize)}
  },[])
  return<canvas ref={ref} style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:1}}/>
}

// ── Sparkle burst (completion) ─────────────────────────────────
function Sparkle(){
  const ref=useRef()
  useEffect(()=>{
    const c=ref.current;if(!c)return
    const ctx=c.getContext('2d');c.width=window.innerWidth;c.height=window.innerHeight
    const COLS=['#21E6F3','#ffffff','#FF2FAE','#a78bfa','#6C5CFF']
    const dots=Array.from({length:38},()=>({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*2.2+0.4,color:COLS[Math.floor(Math.random()*COLS.length)],alpha:Math.random()*0.9+0.1,aDir:Math.random()>0.5?1:-1,aSpd:Math.random()*0.025+0.008,vx:(Math.random()-0.5)*0.3,vy:(Math.random()-0.5)*0.3}))
    let frame=0,raf
    const draw=()=>{
      ctx.clearRect(0,0,c.width,c.height)
      dots.forEach(d=>{
        d.x+=d.vx;d.y+=d.vy;d.alpha+=d.aDir*d.aSpd
        if(d.alpha>=1){d.alpha=1;d.aDir=-1}if(d.alpha<=0){d.alpha=0;d.aDir=1}
        if(d.x<-4)d.x=c.width+4;if(d.x>c.width+4)d.x=-4;if(d.y<-4)d.y=c.height+4;if(d.y>c.height+4)d.y=-4
        ctx.save();ctx.globalAlpha=d.alpha;ctx.translate(d.x,d.y);ctx.fillStyle=d.color
        const s=d.r;ctx.beginPath();ctx.moveTo(0,-s*2.5);ctx.lineTo(s*0.5,-s*0.5);ctx.lineTo(s*2.5,0);ctx.lineTo(s*0.5,s*0.5);ctx.lineTo(0,s*2.5);ctx.lineTo(-s*0.5,s*0.5);ctx.lineTo(-s*2.5,0);ctx.lineTo(-s*0.5,-s*0.5);ctx.closePath();ctx.fill();ctx.restore()
      })
      frame++;if(frame<200)raf=requestAnimationFrame(draw);else{let op=1;const fade=()=>{op-=0.05;ctx.globalAlpha=op;if(op>0)requestAnimationFrame(fade);else ctx.clearRect(0,0,c.width,c.height)};fade()}
    }
    raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf)
  },[])
  return<canvas ref={ref} style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:9999}}/>
}

// ── CountUp ────────────────────────────────────────────────────
function CountUp({to,prefix='',suffix='',duration=1000,decimals=0}){
  const[val,setVal]=useState(0)
  useEffect(()=>{
    const start=Date.now()
    const tick=()=>{const p=Math.min((Date.now()-start)/duration,1);const e=1-Math.pow(1-p,3);const v=e*to;setVal(decimals?+v.toFixed(decimals):Math.round(v));if(p<1)requestAnimationFrame(tick)}
    requestAnimationFrame(tick)
  },[to,duration,decimals])
  return<>{prefix}{decimals?val.toFixed(decimals):val.toLocaleString()}{suffix}</>
}



// ── Feedback bubble ────────────────────────────────────────────
function FeedbackBubble(){
  const[open,setOpen]=useState(false)
  if(!open)return(<button onClick={()=>setOpen(true)} style={{position:'fixed',bottom:20,right:20,zIndex:200,display:'flex',alignItems:'center',gap:7,padding:'8px 16px',borderRadius:100,background:'rgba(6,8,20,0.92)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(148,163,184,0.9)',fontSize:12,fontWeight:700,cursor:'pointer',backdropFilter:'blur(20px)'}}>💬 Feedback</button>)
  return(<div style={{position:'fixed',bottom:20,right:20,zIndex:200,maxWidth:280,borderRadius:18,border:'1px solid rgba(200,43,255,0.25)',background:'rgba(6,8,20,0.96)',padding:14,backdropFilter:'blur(20px)'}}><button onClick={()=>setOpen(false)} style={{position:'absolute',top:8,right:8,background:'none',border:'none',color:'rgba(100,116,139,0.7)',cursor:'pointer',fontSize:14}}>✕</button><p style={{fontSize:13,fontWeight:700,color:'#C9B8FF',paddingRight:16,marginBottom:10,lineHeight:1.6}}>Having trouble with this step? We'd love your feedback.</p><button style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',borderRadius:100,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.035)',color:'rgba(148,163,184,0.9)',fontSize:11,fontWeight:700,cursor:'pointer'}}>💬 Feedback</button></div>)
}

// ── Design tokens ──────────────────────────────────────────────
const CYAN='#21E6F3'
const PINK='#FF2FAE'
const GRAD='linear-gradient(90deg,#21E6F3,#6C5CFF,#FF2FAE)'
const EYE={fontSize:10,fontWeight:900,letterSpacing:'0.22em',textTransform:'uppercase',color:CYAN,marginBottom:10,textAlign:'center'}

const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',system-ui,sans-serif}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
  @keyframes cardShimmer{0%,92%{opacity:0}94%{opacity:1}100%{opacity:0}}
  @keyframes glowPulse{0%,100%{box-shadow:0 0 28px rgba(33,230,243,0.18),0 0 60px rgba(255,47,174,0.12),0 0 120px rgba(33,230,243,0.06)}50%{box-shadow:0 0 45px rgba(33,230,243,0.30),0 0 90px rgba(255,47,174,0.20),0 0 160px rgba(33,230,243,0.10)}}
  @keyframes checkIn{from{transform:scale(0) rotate(-20deg);opacity:0}to{transform:scale(1) rotate(0);opacity:1}}
  @keyframes flashPulse{0%{opacity:0}20%{opacity:1}100%{opacity:0}}
  @keyframes statCardIn{from{opacity:0;transform:translateY(8px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes progressSweep{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
  @keyframes dashboardSweep{0%{opacity:0;transform:translateX(-30%) scaleX(0.6)}45%{opacity:1}100%{opacity:0;transform:translateX(30%) scaleX(1.4)}}
  @keyframes dashboardDissolve{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.03)}}
  @media(prefers-reduced-motion:reduce){
    .ob-dash-sweep,.ob-dash-dissolve{animation:none!important}
  }
  textarea::placeholder{color:rgba(100,116,139,0.4);font-family:monospace;font-size:11px;line-height:1.6}
  input::placeholder{color:rgba(100,116,139,0.4)}
  input:focus,textarea:focus{outline:none}
  button{font-family:inherit;cursor:pointer}
  ::-webkit-scrollbar{width:4px}
  ::-webkit-scrollbar-thumb{background:rgba(33,230,243,0.25);border-radius:2px}
  .stat-card{
    background:linear-gradient(160deg,rgba(255,255,255,0.055),rgba(255,255,255,0.022));
    border:1px solid rgba(255,255,255,0.10);
    box-shadow:inset 0 1px 0 rgba(255,255,255,0.07),0 0 22px rgba(0,217,255,0.05);
    border-radius:14px;
    position:relative;
    overflow:hidden;
    transition:box-shadow 0.2s,border-color 0.2s;
  }
  .stat-card::before{
    content:'';position:absolute;top:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent);
  }
  .stat-card:hover{border-color:rgba(255,255,255,0.16);box-shadow:inset 0 1px 0 rgba(255,255,255,0.09),0 0 32px rgba(0,217,255,0.09)}
  .ob-btn-primary{
    position:relative;overflow:hidden;
    background:linear-gradient(90deg,#20E3F3,#7C5CFF,#FF2FAE);
    box-shadow:0 0 14px rgba(32,227,243,0.16),0 0 28px rgba(255,47,174,0.10),inset 0 1px 0 rgba(255,255,255,0.35);
  }
  .ob-btn-primary::after{
    content:'';position:absolute;top:0;left:-100%;width:60%;height:100%;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent);
    animation:shimmer 3s ease-in-out infinite 1.5s;
  }
  .ob-card-inner::before{
    content:'';position:absolute;top:0;left:-100%;right:0;height:1px;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent);
    animation:cardShimmer 7s ease-in-out infinite;
    pointer-events:none;z-index:1;
  }
  @media(max-width:600px){
    main{padding:18px 12px 28px!important;align-items:flex-start!important}
    .ob-card{padding:22px 16px!important;border-radius:24px!important}
    .ob-plat-row{flex-direction:column!important}
  }
`

// ── UI components ──────────────────────────────────────────────
function OBLogo({showSub=false}){
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',marginBottom:12}}>
      <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:showSub?4:0}}>
        <div style={{width:32,height:32,borderRadius:12,background:GRAD,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:900,color:'#fff',boxShadow:`0 0 14px rgba(33,230,243,0.25),0 0 28px rgba(255,47,174,0.12)`}}>$</div>
        <div style={{fontSize:20,fontWeight:900,letterSpacing:'-0.035em'}}>
          <span style={{color:'#fff'}}>Cam</span>
          <span style={{background:GRAD,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Cash</span>
        </div>
      </div>
      {showSub&&<div style={{fontSize:10,color:'rgba(148,163,184,0.5)',letterSpacing:'0.06em',fontWeight:500}}>Creator intelligence for your cam income</div>}
    </div>
  )
}

function OBProgress({current}){
  const steps=[{n:1,label:'Stats'},{n:2,label:'Tips'},{n:3,label:'Done'}]
  return(
    <div className="ob-stepper" style={{marginBottom:22}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',maxWidth:250,margin:'0 auto 8px'}}>
        {steps.map((s,i)=>(
          <div key={s.n} style={{display:'flex',alignItems:'center',flex:i<2?1:'none'}}>
            <div className="ob-stepper-circle" style={{
              width:30,height:30,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:11,fontWeight:800,flexShrink:0,transition:'all 0.35s',
              background:s.n<current?CYAN:s.n===current?GRAD:'rgba(255,255,255,0.05)',
              border:s.n>current?'1px solid rgba(255,255,255,0.12)':'none',
              color:s.n<=current?'#04101b':'rgba(255,255,255,0.25)',
              boxShadow:s.n===current?`0 0 22px rgba(33,230,243,0.65),0 0 45px rgba(33,230,243,0.25)`:s.n<current?`0 0 14px rgba(33,230,243,0.4)`:'none',
            }}>
              {s.n<current?'✓':s.n}
            </div>
            {i<2&&<div className="ob-stepper-line" style={{height:2,flex:1,background:current>s.n?GRAD:'rgba(255,255,255,0.1)',transition:'all 0.35s',margin:'0 3px',boxShadow:current>s.n?'0 0 6px rgba(33,230,243,0.3)':'none'}}/>}
          </div>
        ))}
      </div>
      <div className="ob-stepper-labels" style={{display:'flex',justifyContent:'space-between',maxWidth:250,margin:'0 auto'}}>
        {steps.map(s=>(<div key={s.n} style={{width:28,textAlign:'center',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:s.n<=current?`rgba(33,230,243,0.9)`:'rgba(255,255,255,0.2)',transition:'all 0.35s'}}>{s.label}</div>))}
      </div>
    </div>
  )
}

function OBBtn({onClick,children,disabled=false,style={}}){
  return(
    <button onClick={onClick} disabled={disabled} className={disabled?'':'ob-btn-primary'} style={{
      width:'100%',height:48,borderRadius:14,border:'none',
      background:disabled?'rgba(255,255,255,0.07)':GRAD,
      color:disabled?'rgba(255,255,255,0.25)':'#fff',
      fontSize:14,fontWeight:900,cursor:disabled?'not-allowed':'pointer',
      boxShadow:disabled?'none':'0 0 14px rgba(33,230,243,0.16),0 0 28px rgba(255,47,174,0.10)',
      transition:'all 0.18s',display:'flex',alignItems:'center',justifyContent:'center',gap:7,
      letterSpacing:'-0.01em',
      ...style
    }}
    onMouseEnter={e=>{if(!disabled){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 0 22px rgba(33,230,243,0.28),0 0 44px rgba(255,47,174,0.18),inset 0 1px 0 rgba(255,255,255,0.3)'}}}
    onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=disabled?'none':'0 0 14px rgba(33,230,243,0.16),0 0 28px rgba(255,47,174,0.10)'}}
    onMouseDown={e=>{if(!disabled)e.currentTarget.style.transform='translateY(0)'}}
    >{children}</button>
  )
}

function OBSecBtn({onClick,children,style={}}){
  return(
    <button onClick={onClick} style={{height:44,padding:'0 16px',borderRadius:12,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'rgba(203,213,225,0.85)',fontSize:13,fontWeight:700,transition:'all 0.18s',...style}}
    onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(33,230,243,0.45)';e.currentTarget.style.color='#fff';e.currentTarget.style.background='rgba(33,230,243,0.07)'}}
    onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.12)';e.currentTarget.style.color='rgba(203,213,225,0.85)';e.currentTarget.style.background='rgba(255,255,255,0.04)'}}
    >{children}</button>
  )
}

function OBLinks({links}){
  return(
    <div style={{display:'flex',justifyContent:'center',gap:18,marginTop:12,flexWrap:'wrap'}}>
      {links.map((l,i)=>(<button key={i} onClick={l.onClick} style={{background:'none',border:'none',fontSize:11,color:'rgba(100,116,139,0.7)',cursor:'pointer',transition:'color 0.2s'}} onMouseEnter={e=>e.currentTarget.style.color=CYAN} onMouseLeave={e=>e.currentTarget.style.color='rgba(100,116,139,0.7)'}>{l.label}</button>))}
    </div>
  )
}

function OBTrust(){
  return(<div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,marginTop:14,fontSize:10,color:'rgba(100,116,139,0.55)'}}><span>🔒</span><span>Your data is stored securely and never shared.</span></div>)
}

// ── Main component ─────────────────────────────────────────────
export default function OnboardingPage(){
  const router=useRouter()
  const[user,setUser]=useState(null)
  const[booting,setBooting]=useState(true)
  const[userPlan,setUserPlan]=useState('free')

  const[step,setStep]=useState('platforms')
  // selectedPlatforms order IS the primary/secondary order: index 0 is
  // always Primary. Selecting a platform appends it; "make primary" moves
  // it to index 0. This is the single source of truth for primary/secondary
  // status — there is no separate primaryPlatformId to keep in sync.
  const[selectedPlatforms,setSelectedPlatforms]=useState([])
  // Which position in selectedPlatforms is currently being connected.
  const[queueIndex,setQueueIndex]=useState(0)
  // Per-platform outcome once its connect step finishes (connected or
  // skipped), keyed by platform id — powers the platform-success screen,
  // the final summary, and (eventually) cross-platform features without
  // needing a second parallel data model.
  const[platformResults,setPlatformResults]=useState({})
  // platformId = the platform currently being connected. All existing
  // parse/import machinery below is unchanged and keys off this exactly as
  // it always did — only what drives it (a queue instead of one click) is new.
  const[platformId,setPlatformId]=useState('chaturbate')
  const[cbUsername,setCbUsername]=useState('')
  const[cbUsernameError,setCbUsernameError]=useState('')
  const[pasteText,setPasteText]=useState('')
  const[preview,setPreview]=useState(null)
  const[parseError,setParseError]=useState('')
  const[importResult,setImportResult]=useState(null)
  const[importError,setImportError]=useState('')
  const[upgradeBlocked,setUpgradeBlocked]=useState(null)
  const[isFirstImport,setIsFirstImport]=useState(true)
  const[showSparkle,setShowSparkle]=useState(false)
  const[importedPlatforms,setImportedPlatforms]=useState([])
  const[csvUploading,setCsvUploading]=useState(false)
  const[csvError,setCsvError]=useState('')
  const[loadingMsgIdx,setLoadingMsgIdx]=useState(0)
  const[loadingProgress,setLoadingProgress]=useState(0)
  const[howItWorksOpen,setHowItWorksOpen]=useState(false)
  const[dashboardTransitioning,setDashboardTransitioning]=useState(false)
  const csvRef=useRef()

  function enterDashboard(){
    const reduceMotion=typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches
    track('dashboard_transition_completed',{platforms:selectedPlatforms})
    if(reduceMotion){router.push('/dashboard');return}
    setDashboardTransitioning(true)
    setTimeout(()=>router.push('/dashboard'),700)
  }

  const platform=PLATFORMS[platformId]
  const primaryPlatformId=selectedPlatforms[0]||null
  const stepNum={platforms:1,username:1,paste:2,csv:2,loading:2,platformSuccess:2,finalSummary:3,trial:3,step4:3,done:3}[step]||1
  const showProgress=!['loading'].includes(step)

  useEffect(()=>{
    ;(async()=>{
      const{data:{user}}=await supabase.auth.getUser()
      if(!user){router.replace('/login');return}
      const{data}=await supabase.from('beta_users').select('onboarding_complete').eq('user_id',user.id).single()
      if(data?.onboarding_complete){router.replace('/dashboard');return}
      const{data:profile}=await supabase.from('profiles').select('plan,streaming_platforms,primary_pro_platform').eq('id',user.id).single()
      setUserPlan(profile?.plan==='pro'?'pro':'free')
      // Restore an in-progress platform selection if the user left and came
      // back — matches beta_users.onboarding_complete already gating re-entry.
      const saved=(profile?.streaming_platforms||[]).filter(id=>PLATFORMS[id])
      if(saved.length){
        const primary=profile?.primary_pro_platform&&saved.includes(profile.primary_pro_platform)?profile.primary_pro_platform:saved[0]
        setSelectedPlatforms([primary,...saved.filter(id=>id!==primary)])
      }
      setUser(user);setBooting(false)
    })()
  },[router])

  // Fires on every step transition so we can see exactly where a user
  // last was before abandoning onboarding (drop-off = last step_viewed row).
  useEffect(()=>{
    if(!user)return
    track('onboarding_step_viewed',{step,platform:platformId})
  },[step,user])

  async function markDone(){
    if(!user)return
    await supabase.from('beta_users').upsert({user_id:user.id,email:user.email,onboarding_complete:true,signed_up_at:user.created_at},{onConflict:'user_id'})
  }

  // ── Multi-platform selection (Step 1) ──────────────────────────
  function togglePlatform(id){
    setSelectedPlatforms(prev=>prev.includes(id)?prev.filter(p=>p!==id):[...prev,id])
  }
  function makePrimary(id){
    setSelectedPlatforms(prev=>prev.includes(id)?[id,...prev.filter(p=>p!==id)]:prev)
    track('onboarding_primary_platform_selected',{platform:id})
  }

  function startConnecting(id){
    setPlatformId(id)
    setPasteText('');setPreview(null);setParseError('');setImportError('');setCsvError('');setUpgradeBlocked(null);setHowItWorksOpen(false)
    if(id==='chaturbate'&&!cbUsername)setStep('username');else setStep('paste')
    track('onboarding_import_started',{platform:id})
  }

  async function confirmPlatforms(){
    if(!selectedPlatforms.length)return
    if(user){
      await supabase.from('profiles').upsert({id:user.id,streaming_platforms:selectedPlatforms,primary_pro_platform:selectedPlatforms[0]},{onConflict:'id'})
    }
    selectedPlatforms.forEach(id=>track('onboarding_platform_selected',{platform:id}))
    setQueueIndex(0)
    startConnecting(selectedPlatforms[0])
  }

  // After a platform's connect step finishes (success or skip), either move
  // to the next platform that has no result yet, or the final summary.
  // Deliberately NOT "queueIndex + 1": finalSummary lets a user go back and
  // connect a platform they'd earlier skipped (see the 'Connect later' link
  // below), and after THAT completes, a plain index increment would run
  // straight into a platform that was already handled — this always finds
  // whatever's actually still outstanding instead, so it's correct however
  // the user got here.
  // Pass the just-computed results explicitly when calling this in the same
  // tick as setPlatformResults (state updates aren't visible synchronously);
  // omit it when platformResults is already known-committed (e.g. the button
  // on the platformSuccess screen, which only renders after that commit).
  function goToNextOrFinish(latestResults){
    const results=latestResults||platformResults
    const nextUnhandled=selectedPlatforms.find(id=>!results[id])
    if(nextUnhandled){
      setQueueIndex(selectedPlatforms.indexOf(nextUnhandled))
      startConnecting(nextUnhandled)
    }else{
      setStep('finalSummary')
    }
  }

  function skipCurrentPlatform(){
    const updated={...platformResults,[platformId]:{status:'skipped'}}
    setPlatformResults(updated)
    track('onboarding_secondary_skipped',{platform:platformId})
    goToNextOrFinish(updated)
  }

  // finalSummary is reached exactly once per onboarding session (the queue
  // never loops back to it), so the next step is always the trial upsell —
  // its own "Skip for now" button already routes to 'done'.
  function finishOnboarding(){
    track('onboarding_complete',{platforms:selectedPlatforms,primary:primaryPlatformId})
    setStep('trial')
  }

  async function handleUsernameSubmit(){
    setCbUsernameError('')
    const cleaned=cbUsername.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'')
    if(!cleaned){setCbUsernameError('Enter your Chaturbate username to continue.');return}
    setCbUsername(cleaned)
    if(user)await supabase.from('profiles').upsert({id:user.id,chaturbate_username:cleaned},{onConflict:'id'})
    setStep('paste')
  }

  function handleCloseClick(){
    // window.__onboardingExitCheck returns false and shows the exit survey
    // when eligible; onResolved (passed to OnboardingExitSurvey) completes
    // this navigation once the user dismisses/submits it.
    // Goes to '/' rather than '/dashboard': a user with onboarding_complete
    // false and zero tips gets bounced right back to /onboarding by the
    // dashboard's abandoned-onboarding redirect, trapping them in a loop.
    const canExitNow=window.__onboardingExitCheck?window.__onboardingExitCheck():true
    if(canExitNow)router.push('/')
  }

  function handlePreview(){
    setParseError('')
    if(!pasteText.trim()){setParseError('Paste your tip history above first.');return}
    const p=buildPreview(pasteText,platformId,platform.label)
    if(!p||( p.tipsDetected===0&&p.paidSessionsDetected===0)){
      setParseError("We couldn't find any tip rows. Make sure you copied the full table including dates and token amounts.")
      track('onboarding_paste_parse_failed',{platform:platformId})

      // Log detailed parse attempt for analysis
      if(user?.id){
        const formatAnalysis=analyzeFormat(pasteText)
        logParseAttempt({
          userId:user.id,
          source:'onboarding',
          attemptedPlatform:platformId,
          claimedPlatform:platformId,
          rawText:pasteText,
          formatAnalysis,
          parseSuccess:false,
          errorReason:"We couldn't find any tip rows. Make sure you copied the full table including dates and token amounts.",
          errorDetails:formatAnalysis,
        })
      }
      return
    }

    // Log successful parse
    if(user?.id){
      logParseAttempt({
        userId:user.id,
        source:'onboarding',
        attemptedPlatform:platformId,
        claimedPlatform:platformId,
        rawText:pasteText,
        formatAnalysis:analyzeFormat(pasteText),
        parseSuccess:true,
      })
    }

    setPreview(p)
    handleImport(p)
  }

  async function handleImport(previewArg){
    const p=previewArg||preview
    if(!user)return
    setImportError('');setUpgradeBlocked(null);setStep('loading');setLoadingMsgIdx(0);setLoadingProgress(0)
    try{
      const{data:{session}}=await supabase.auth.getSession()
      if(!session)throw new Error('Not logged in')
      // Send the already-parsed rows as a clean CSV instead of the raw paste —
      // the server has its own independent parser, and re-parsing the raw text
      // there can disagree with what this page's parseRows() already validated.
      const{blob:csvBlob}=pasteToCSVBlob(pasteText,platformId)
      const file=new File([csvBlob],'pasted_import.csv',{type:'text/csv'})
      const minWait=isFirstImport?5500:1800
      const msgs=isFirstImport?LOADING_MESSAGES:EXTRA_MSGS
      const start=Date.now()
      const pi=setInterval(()=>{const pr=Math.min((Date.now()-start)/minWait,0.95);setLoadingProgress(Math.round(pr*100))},60)
      const mi=setInterval(()=>setLoadingMsgIdx(i=>(i+1)%msgs.length),900)

      const controller=new AbortController()
      const timeoutId=setTimeout(()=>controller.abort(),90000) // 90s timeout for large imports

      // Upload free tips
      const tipUploadPromise=fetch('/api/upload',{
        method:'POST',
        headers:{Authorization:`Bearer ${session.access_token}`},
        body:(()=>{const f=new FormData();f.append('file',file);f.append('platform',platform.label);return f})(),
        signal:controller.signal
      })

      // Upload BongaCams paid sessions if any detected
      let paidUploadPromise=Promise.resolve(null)
      if(platformId==='bongacams'&&p?.paidSessionsDetected>0){
        const paidBlob=paidSessionsToCSVBlob(p.paidSessions)
        const paidFile=new File([paidBlob],'paid_sessions_import.csv',{type:'text/csv'})
        const paidForm=new FormData()
        paidForm.append('file',paidFile)
        paidForm.append('platform','BongaCams')
        paidUploadPromise=fetch('/api/upload-paid-sessions',{
          method:'POST',
          headers:{Authorization:`Bearer ${session.access_token}`},
          body:paidForm,
          signal:controller.signal
        })
      }

      const[res,,]=await Promise.all([
        tipUploadPromise,
        paidUploadPromise,
        new Promise(r=>setTimeout(r,minWait)),
      ])
      clearTimeout(timeoutId)
      clearInterval(pi);clearInterval(mi);setLoadingProgress(100)
      const json=await res.json()
      if(!res.ok||json.error){
        const err=new Error(json.error||'Import failed')
        err.code=json.code;err.upgradeUrl=json.upgradeUrl
        throw err
      }
      await markDone()
      const inserted=json.inserted??p?.tipsDetected??0
      setImportResult({inserted,skipped:json.skipped??0,paidInserted:p?.paidSessionsDetected??0})
      setImportedPlatforms(prev=>prev.includes(platformId)?prev:[...prev,platformId])
      track('onboarding_import_completed',{platform:platformId,inserted,skipped:json.skipped??0})
      if(isFirstImport){track('onboarding_completed',{platform:platformId});setIsFirstImport(false);setShowSparkle(true);setTimeout(()=>setShowSparkle(false),4000)}
      setPlatformResults(prev=>({...prev,[platformId]:{
        status:'connected',inserted,skipped:json.skipped??0,paidInserted:p?.paidSessionsDetected??0,
        snapshot:p?.snapshot||null,topSpender:p?.topSpender||null,
        bestHour:p?.bestHour||null,bestHourConfident:p?.bestHourConfident||false,
      }}))
      setStep('platformSuccess')
    }catch(e){
      if(e.name==='AbortError')setImportError('Import timed out. Check your connection or try a smaller file.')
      else if(e.code==='platform_limit_reached')setUpgradeBlocked({message:e.message,upgradeUrl:e.upgradeUrl||'/pricing'})
      else setImportError(e.message||'Import failed')
      track('onboarding_import_failed',{platform:platformId,code:e.code||null,message:e.message||null})
      setStep('paste')
    }
  }

  async function handleStartTrial(){
    if(!user)return
    try{
      const{data:{session}}=await supabase.auth.getSession()
      const res=await fetch('/api/stripe/checkout',{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          Authorization:`Bearer ${session.access_token}`
        },
        body:JSON.stringify({plan_type:'standard_monthly'})
      })
      const json=await res.json()
      if(json.url)window.location.href=json.url
      else throw new Error(json.error||'No checkout URL returned')
    }catch(e){
      console.error('Trial checkout failed:',e)
      alert(e.message||'Failed to start trial. Please try again.')
    }
  }

  async function handleCsvUpload(file){
    if(!file||!user)return
    setCsvUploading(true);setCsvError('');setStep('loading');setLoadingProgress(0)
    try{
      const{data:{session}}=await supabase.auth.getSession()
      if(!session)throw new Error('Not logged in')
      const form=new FormData();form.append('file',file);form.append('platform',platform.label)
      const minWait=isFirstImport?5500:1800
      const start=Date.now()
      const pi=setInterval(()=>{const p=Math.min((Date.now()-start)/minWait,0.95);setLoadingProgress(Math.round(p*100))},60)

      const controller=new AbortController()
      const timeoutId=setTimeout(()=>controller.abort(),90000) // 90s timeout for large imports

      const[res]=await Promise.all([
        fetch('/api/upload',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:form,signal:controller.signal}),
        new Promise(r=>setTimeout(r,minWait))
      ])
      clearTimeout(timeoutId)
      clearInterval(pi);setLoadingProgress(100)
      const json=await res.json()
      if(!res.ok||json.error)throw new Error(json.error||'Upload failed')
      await markDone()
      const inserted=json.inserted??preview?.tipsDetected??0
      setImportResult({inserted,skipped:json.skipped??0})
      setImportedPlatforms(prev=>prev.includes(platformId)?prev:[...prev,platformId])
      track('onboarding_import_completed',{platform:platformId,inserted,skipped:json.skipped??0,source:'csv'})
      if(isFirstImport){track('onboarding_completed',{platform:platformId,source:'csv'});setIsFirstImport(false);setShowSparkle(true);setTimeout(()=>setShowSparkle(false),4000)}
      setPlatformResults(prev=>({...prev,[platformId]:{
        status:'connected',inserted,skipped:json.skipped??0,
        snapshot:json.snapshot||null,totalUsd:json.totalUsd,dateFrom:json.dateFrom,dateTo:json.dateTo,source:'csv',
      }}))
      setStep('platformSuccess')
    }catch(e){
      setCsvError(e.name==='AbortError'?'Upload timed out. Try a smaller file or check your connection.':e.message||'Upload failed')
      track('onboarding_import_failed',{platform:platformId,message:e.message||null,source:'csv'})
      setStep('csv')
    }
    finally{setCsvUploading(false)}
  }

  if(booting)return(
    <div style={{minHeight:'100vh',background:'#050812',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:30,height:30,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.08)',borderTopColor:CYAN,animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const msgs=isFirstImport?LOADING_MESSAGES:EXTRA_MSGS
  const tipsDisplayed=importResult?.inserted>0?importResult.inserted:(preview?.tipsDetected||0)
  const isPrimaryInQueue=queueIndex===0
  const queuePosLabel=selectedPlatforms.length>1?` (${queueIndex+1} of ${selectedPlatforms.length})`:''
  const currentResult=platformResults[platformId]||null
  const nextUnhandledId=selectedPlatforms.find(id=>!platformResults[id])||null
  // snapshot.full/.recent dates come back as real Date objects from the
  // client-side paste-preview path, but as ISO strings from the CSV-upload
  // API response (JSON has no Date type) — new Date(x) normalizes either.
  const fmtDate=d=>d?new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—'

  return(
    <main style={{position:'relative',minHeight:'100vh',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'28px 16px 34px',background:'#070b18',fontFamily:"'Inter',system-ui,sans-serif",color:'#fff',overflow:'hidden'}}>
      <style>{CSS}</style>

      {/* ── BACKGROUND ── */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0}}>
        <div style={{position:'absolute',inset:0,background:'linear-gradient(90deg,rgba(7,178,207,0.22) 0%,rgba(8,14,31,0.92) 48%,rgba(29,12,45,0.88) 72%,rgba(255,47,174,0.16) 100%),radial-gradient(ellipse at 14% 46%,rgba(33,230,243,0.24) 0%,transparent 54%),radial-gradient(ellipse at 86% 50%,rgba(255,47,174,0.22) 0%,transparent 58%),radial-gradient(ellipse at 50% 100%,rgba(139,92,246,0.12) 0%,transparent 50%)'}}/>
        <div style={{position:'absolute',left:'-12%',top:'8%',width:620,height:620,borderRadius:'50%',background:'rgba(33,230,243,0.22)',filter:'blur(100px)'}}/>
        <div style={{position:'absolute',right:'-14%',bottom:'2%',width:640,height:640,borderRadius:'50%',background:'rgba(255,47,174,0.20)',filter:'blur(110px)'}}/>
        <div style={{position:'absolute',left:'35%',top:'30%',width:420,height:420,borderRadius:'50%',background:'rgba(139,92,246,0.12)',filter:'blur(90px)'}}/>
        <div style={{position:'absolute',left:'50%',top:'-5%',transform:'translateX(-50%)',width:400,height:300,borderRadius:'50%',background:'rgba(33,230,243,0.10)',filter:'blur(80px)'}}/>
        <div style={{position:'absolute',inset:0,opacity:0.13,backgroundImage:'radial-gradient(rgba(255,255,255,0.58) 1px,transparent 1px)',backgroundSize:'28px 28px'}}/>
      </div>

      <AmbientParticles/>
      <OnboardingExitSurvey currentStep={stepNum} currentStepName={step} minStepToTrigger={1} onResolved={()=>router.push('/')}/>
      {showSparkle&&<Sparkle/>}
      <FeedbackBubble/>

      {/* ── CARD ── */}
      <div style={{position:'relative',zIndex:10,width:'100%',maxWidth:622}}>
        <div style={{position:'absolute',inset:-2,borderRadius:30,background:'linear-gradient(135deg,rgba(33,230,243,0.9) 0%,rgba(124,92,255,0.45) 45%,rgba(255,47,174,0.9) 100%)',zIndex:-1,filter:'blur(1.5px)',animation:'glowPulse 3.5s ease-in-out infinite'}}/>
        <div style={{position:'absolute',inset:-60,borderRadius:'50%',background:'radial-gradient(circle,rgba(124,92,255,0.10) 0%,transparent 70%)',zIndex:-2,pointerEvents:'none'}}/>
        <div className={`ob-card ob-card-inner${dashboardTransitioning?' ob-dash-dissolve':''}`} style={{position:'relative',borderRadius:28,border:'1px solid rgba(255,255,255,0.12)',background:'linear-gradient(180deg,rgba(10,15,35,0.94),rgba(6,9,24,0.96))',backdropFilter:'blur(34px)',WebkitBackdropFilter:'blur(34px)',padding:'26px 28px 24px',overflow:'hidden',boxShadow:'0 0 46px rgba(33,230,243,0.25),0 0 70px rgba(255,47,174,0.15),0 26px 96px rgba(0,0,0,0.58),inset 0 1px 0 rgba(255,255,255,0.10)',animation:dashboardTransitioning?'dashboardDissolve 0.7s ease-out both':'none'}}>
          <div style={{position:'absolute',top:0,left:'8%',right:'8%',height:'1px',background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)',pointerEvents:'none'}}/>
          <div style={{position:'absolute',top:-50,left:-50,width:220,height:220,borderRadius:'50%',background:'rgba(33,230,243,0.055)',filter:'blur(40px)',pointerEvents:'none'}}/>
          <div style={{position:'absolute',bottom:-50,right:-50,width:220,height:220,borderRadius:'50%',background:'rgba(255,47,174,0.045)',filter:'blur(40px)',pointerEvents:'none'}}/>

          {!['loading','done'].includes(step)&&(
            <button
              onClick={handleCloseClick}
              aria-label="Close onboarding"
              style={{position:'absolute',top:16,right:16,width:28,height:28,borderRadius:'50%',border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'rgba(148,163,184,0.7)',fontSize:13,lineHeight:1,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:5,transition:'all 0.18s'}}
              onMouseEnter={e=>{e.currentTarget.style.color='#fff';e.currentTarget.style.borderColor='rgba(255,255,255,0.25)'}}
              onMouseLeave={e=>{e.currentTarget.style.color='rgba(148,163,184,0.7)';e.currentTarget.style.borderColor='rgba(255,255,255,0.12)'}}
            >✕</button>
          )}

          {!['loading'].includes(step)&&(
            <header>
              <OBLogo showSub={step==='platform'}/>
              {showProgress&&<OBProgress current={stepNum}/>}
            </header>
          )}

          {/* ══ PLATFORMS (multi-select + primary) ══ */}
          {step==='platforms'&&(
            <div style={{animation:'fadeUp 0.3s ease both'}}>
              <div style={EYE}>Step 1 of 3</div>
              <div style={{textAlign:'center',marginBottom:16}}>
                <h1 style={{fontSize:23,fontWeight:900,color:'#F8FAFC',letterSpacing:'-0.025em',lineHeight:1.15,marginBottom:7}}>Tell us where you stream</h1>
                <p style={{fontSize:13,color:'rgba(166,168,189,0.88)',lineHeight:1.7,maxWidth:360,margin:'0 auto'}}>Select all platforms you stream on. Your primary platform will shape your personalized insights.</p>
              </div>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,fontWeight:700,color:'rgba(166,168,189,0.6)',marginBottom:9,letterSpacing:'0.08em',textTransform:'uppercase'}}>Your platforms</div>
                <div className="ob-plat-row" style={{display:'flex',gap:9}}>
                  {Object.entries(PLATFORMS).map(([key,p])=>{
                    const sel=selectedPlatforms.includes(key)
                    const isPrimary=selectedPlatforms[0]===key
                    return(
                      <button key={key} onClick={()=>togglePlatform(key)} style={{
                        flex:1,padding:'12px 8px',borderRadius:14,textAlign:'center',
                        background:sel?'rgba(33,230,243,0.09)':'rgba(255,255,255,0.03)',
                        border:sel?`1.5px solid rgba(33,230,243,0.85)`:'1px solid rgba(255,255,255,0.09)',
                        boxShadow:sel?'0 0 22px rgba(33,230,243,0.22),inset 0 1px 0 rgba(255,255,255,0.08)':'none',
                        cursor:'pointer',transition:'all 0.22s',position:'relative',
                      }}
                      onMouseEnter={e=>{if(!sel){e.currentTarget.style.borderColor='rgba(33,230,243,0.45)';e.currentTarget.style.background='rgba(33,230,243,0.05)'}}}
                      onMouseLeave={e=>{if(!sel){e.currentTarget.style.borderColor='rgba(255,255,255,0.09)';e.currentTarget.style.background='rgba(255,255,255,0.03)'}}}
                      >
                        {sel&&<div style={{position:'absolute',top:9,right:9,width:18,height:18,borderRadius:'50%',background:CYAN,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,color:'#04101b',boxShadow:'0 0 14px rgba(33,230,243,0.6)'}}>✓</div>}
                        {isPrimary&&<div style={{position:'absolute',top:9,left:9,padding:'2px 6px',borderRadius:6,background:GRAD,fontSize:7,fontWeight:900,letterSpacing:'0.06em',color:'#fff',textTransform:'uppercase'}}>Primary</div>}
                        <div style={{width:44,height:44,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:900,margin:'0 auto 10px',...p.iconStyle}}>{p.short}</div>
                        <div style={{fontSize:12,fontWeight:700,color:sel?'#fff':'rgba(255,255,255,0.5)'}}>{p.label}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedPlatforms.length>0&&(
                <div style={{borderRadius:13,border:'1px solid rgba(33,230,243,0.22)',background:'rgba(33,230,243,0.06)',padding:'12px 14px',marginBottom:14}}>
                  <div style={{display:'flex',alignItems:'center',gap:9}}>
                    <span style={{fontSize:16}}>👑</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:800,color:'#fff'}}>Primary platform: {PLATFORMS[primaryPlatformId].label}</div>
                      <div style={{fontSize:10,color:'rgba(148,163,184,0.75)',lineHeight:1.5}}>We'll use this to personalize your experience and show your most relevant insights first.</div>
                    </div>
                  </div>
                  {selectedPlatforms.length>1&&(
                    <div style={{display:'flex',gap:6,marginTop:9,flexWrap:'wrap'}}>
                      {selectedPlatforms.slice(1).map(id=>(
                        <button key={id} onClick={()=>makePrimary(id)} style={{fontSize:10,fontWeight:700,color:CYAN,background:'rgba(33,230,243,0.08)',border:'1px solid rgba(33,230,243,0.25)',borderRadius:8,padding:'4px 9px',cursor:'pointer'}}>Make {PLATFORMS[id].label} primary</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{marginBottom:20}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontSize:11,color:'rgba(148,163,184,0.75)'}}>{selectedPlatforms.length} platform{selectedPlatforms.length===1?'':'s'} selected</span>
                  <span style={{fontSize:11,color:CYAN,fontWeight:700}}>{selectedPlatforms.length} / 3</span>
                </div>
                <div style={{height:7,borderRadius:100,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(selectedPlatforms.length/3)*100}%`,background:GRAD,borderRadius:100,boxShadow:selectedPlatforms.length?'0 0 12px rgba(33,230,243,0.4)':'none',transition:'width 0.25s ease'}}/>
                </div>
              </div>

              <OBBtn onClick={confirmPlatforms} disabled={!selectedPlatforms.length} style={{marginBottom:10}}>
                {selectedPlatforms.length?`Continue with ${selectedPlatforms.length} platform${selectedPlatforms.length===1?'':'s'} →`:'Select a platform to continue'}
              </OBBtn>
            </div>
          )}

          {/* ══ USERNAME ══ */}
          {step==='username'&&(
            <div style={{animation:'fadeUp 0.3s ease both'}}>
              <div style={EYE}>Step 2 of 3 — Chaturbate{queuePosLabel}</div>
              <div style={{textAlign:'center',marginBottom:22}}>
                <h1 style={{fontSize:23,fontWeight:900,color:'#F8FAFC',letterSpacing:'-0.025em',lineHeight:1.15,marginBottom:7}}>{isPrimaryInQueue?'Connect your Chaturbate data':`You also stream on ${platform.label}`}</h1>
                <p style={{fontSize:13,color:'rgba(166,168,189,0.88)',lineHeight:1.7,maxWidth:360,margin:'0 auto'}}>Enter your username so we can link you directly to your token stats page.</p>
              </div>
              <div style={{marginBottom:22}}>
                <div style={{fontSize:10,fontWeight:700,color:'rgba(166,168,189,0.6)',marginBottom:7,letterSpacing:'0.08em',textTransform:'uppercase'}}>Chaturbate username</div>
                <div style={{position:'relative'}}>
                  <input value={cbUsername} onChange={e=>{setCbUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,''));setCbUsernameError('')}} onKeyDown={e=>e.key==='Enter'&&handleUsernameSubmit()} placeholder="your_username" autoFocus
                    style={{width:'100%',padding:'12px 14px',background:'rgba(4,6,18,0.92)',border:`1px solid ${cbUsernameError?'rgba(248,113,113,0.5)':'rgba(255,255,255,0.1)'}`,borderRadius:13,color:'#f8fafc',fontSize:13,fontFamily:'monospace',transition:'all 0.2s'}}
                    onFocus={e=>{e.target.style.borderColor='rgba(33,230,243,0.65)';e.target.style.boxShadow='0 0 0 3px rgba(33,230,243,0.09)'}}
                    onBlur={e=>{e.target.style.borderColor=cbUsernameError?'rgba(248,113,113,0.5)':'rgba(255,255,255,0.1)';e.target.style.boxShadow='none'}}
                  />
                </div>
                {cbUsernameError&&<div style={{marginTop:6,fontSize:12,color:'#f87171'}}>⚠️ {cbUsernameError}</div>}
                {cbUsername&&<div style={{marginTop:6,fontSize:11,color:'rgba(100,116,139,0.7)'}}>Your stats page: <span style={{color:CYAN}}>chaturbate.com/p/{cbUsername}/?tab=tokens</span></div>}
                <div style={{marginTop:5,fontSize:10,color:'rgba(100,116,139,0.45)'}}>Exact username you use to broadcast (not display name)</div>
              </div>
              <OBBtn onClick={handleUsernameSubmit} style={{marginBottom:10}}>Continue to Tip Import →</OBBtn>
              <OBLinks links={[{label:'← Back',onClick:()=>setStep('platforms')},{label:"Skip — I'll navigate there myself",onClick:()=>{setCbUsername('');setStep('paste')}}]}/>
              <OBTrust/>
            </div>
          )}

          {/* ══ PASTE ══ */}
          {step==='paste'&&(
            <div style={{animation:'fadeUp 0.3s ease both'}}>
              <div style={EYE}>Step 2 of 3 — {platform.label}{queuePosLabel}</div>
              <div style={{textAlign:'center',marginBottom:16}}>
                <h1 style={{fontSize:23,fontWeight:900,color:'#F8FAFC',letterSpacing:'-0.025em',lineHeight:1.15,marginBottom:7}}>{isPrimaryInQueue?'Paste your tip history':`You also stream on ${platform.label}`}</h1>
              </div>

              <div className="ob-howto-card" style={{borderRadius:13,border:'1px solid rgba(33,230,243,0.22)',background:'rgba(33,230,243,0.055)',padding:'14px 16px',marginBottom:12}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:10}}>
                  <div style={{fontSize:10,fontWeight:900,letterSpacing:'0.18em',textTransform:'uppercase',color:'rgba(33,230,243,0.85)'}}>How to copy from {platform.label}</div>
                  <a href={platform.earningsUrl(cbUsername)} target="_blank" rel="noreferrer" style={{flexShrink:0,padding:'5px 11px',borderRadius:9,border:'1px solid rgba(255,47,174,0.35)',background:'rgba(255,255,255,0.03)',color:'rgba(203,213,225,0.85)',fontSize:10,fontWeight:700,textDecoration:'none',whiteSpace:'nowrap',transition:'all 0.2s'}} onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(33,230,243,0.55)';e.currentTarget.style.color='#fff'}} onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,47,174,0.35)';e.currentTarget.style.color='rgba(203,213,225,0.85)'}}>Open earnings page ↗</a>
                </div>
                <p style={{fontSize:12,color:'rgba(148,163,184,0.8)',lineHeight:1.6,marginBottom:10}}>{platform.instructions}</p>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
                  {['No password required','You control what gets imported','Takes about 60 seconds'].map(t=>(<div key={t} style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:'rgba(148,163,184,0.75)'}}><span style={{color:CYAN,fontSize:11}}>✓</span>{t}</div>))}
                </div>
              </div>

              <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)} placeholder={platform.placeholder}
                style={{width:'100%',height:156,resize:'none',borderRadius:13,border:'1px solid rgba(33,230,243,0.18)',borderTop:'1.5px solid rgba(33,230,243,0.48)',background:'rgba(1,3,12,0.98)',padding:'12px 14px',fontFamily:'monospace',fontSize:11,lineHeight:1.65,color:'#a5f3fc',outline:'none',transition:'border-color 0.2s,box-shadow 0.2s',marginBottom:parseError?9:12,boxShadow:'inset 0 2px 12px rgba(0,0,0,0.4),inset 0 1px 0 rgba(33,230,243,0.08)'}}
                onFocus={e=>{e.target.style.borderColor='rgba(33,230,243,0.6)';e.target.style.boxShadow='0 0 0 3px rgba(33,230,243,0.08)'}}
                onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.1)';e.target.style.boxShadow='none'}}
              />

              {parseError&&<div style={{marginBottom:10,padding:'9px 12px',borderRadius:11,background:'rgba(248,113,113,0.07)',border:'1px solid rgba(248,113,113,0.22)',fontSize:12,color:'#f87171'}}>⚠️ {parseError}</div>}

              {upgradeBlocked&&(
                <div style={{marginBottom:10,padding:'12px 14px',borderRadius:12,background:'rgba(167,139,250,0.08)',border:'1px solid rgba(167,139,250,0.35)'}}>
                  <div style={{fontSize:12,fontWeight:800,color:'#a78bfa',marginBottom:4}}>🔒 Upgrade to add {platform.label}</div>
                  <div style={{fontSize:12,color:'rgba(203,213,225,0.85)',lineHeight:1.5,marginBottom:9}}>{upgradeBlocked.message}</div>
                  <button onClick={()=>window.open('https://www.camcashgrl.com/pricing','_blank')} style={{padding:'8px 16px',borderRadius:9,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#a78bfa,#7c3aed)',color:'#fff',fontSize:12,fontWeight:700}}>See upgrade options →</button>
                </div>
              )}
              {importError&&<div style={{marginBottom:10,padding:'9px 12px',borderRadius:11,background:'rgba(248,113,113,0.07)',border:'1px solid rgba(248,113,113,0.22)',fontSize:12,color:'#f87171'}}>⚠️ {importError}</div>}

              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:9,marginBottom:16}}>
                {['Open your earnings page','Highlight the rows you want','Copy and paste them here'].map((t,i)=>(<div key={i} style={{display:'flex',alignItems:'center',gap:7,fontSize:10,color:'rgba(148,163,184,0.8)'}}><div style={{width:19,height:19,borderRadius:'50%',border:'1px solid rgba(33,230,243,0.35)',background:'rgba(33,230,243,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,color:CYAN,flexShrink:0}}>{i+1}</div><span>{t}</span></div>))}
              </div>

              <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:10,marginBottom:6}}>
                <OBSecBtn onClick={()=>setStep('platforms')} style={{height:46}}>← Back</OBSecBtn>
                <OBBtn onClick={handlePreview} disabled={!pasteText.trim()} style={{height:46,fontSize:13}}>Import & build dashboard →</OBBtn>
              </div>
              <OBLinks links={[{label:'Upload CSV instead',onClick:()=>setStep('csv')},...(!isPrimaryInQueue?[{label:'Skip for now — connect later',onClick:skipCurrentPlatform}]:[])]}/>
              <OBTrust/>
            </div>
          )}

          {/* ══ CSV ══ */}
          {step==='csv'&&(
            <div style={{animation:'fadeUp 0.3s ease both'}}>
              <div style={EYE}>Step 2 of 3 — {platform.label}{queuePosLabel}</div>
              <div style={{textAlign:'center',marginBottom:16}}>
                <h1 style={{fontSize:23,fontWeight:900,color:'#F8FAFC',letterSpacing:'-0.025em',marginBottom:7}}>{isPrimaryInQueue?'Upload your CSV':`You also stream on ${platform.label}`}</h1>
                <p style={{fontSize:13,color:'rgba(166,168,189,0.85)',lineHeight:1.65}}>Export your earnings as a CSV file and drop it below.</p>
              </div>
              <div onClick={()=>!csvUploading&&csvRef.current?.click()} style={{border:'2px dashed rgba(255,255,255,0.1)',borderRadius:16,padding:'40px 20px',textAlign:'center',cursor:csvUploading?'not-allowed':'pointer',background:'rgba(255,255,255,0.02)',marginBottom:12,transition:'all 0.2s'}} onMouseEnter={e=>{if(!csvUploading){e.currentTarget.style.borderColor='rgba(33,230,243,0.4)';e.currentTarget.style.background='rgba(33,230,243,0.03)'}}} onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';e.currentTarget.style.background='rgba(255,255,255,0.02)'}}>
                <input ref={csvRef} type="file" accept=".csv,.txt" style={{display:'none'}} onChange={e=>{const f=e.target.files[0];if(f)handleCsvUpload(f)}}/>
                {csvUploading?(<><div style={{width:24,height:24,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.1)',borderTopColor:CYAN,animation:'spin 0.8s linear infinite',margin:'0 auto 10px'}}/><div style={{fontSize:13,color:CYAN,fontWeight:500}}>Uploading…</div></>):(<><div style={{fontSize:28,marginBottom:8}}>📁</div><div style={{fontSize:13,fontWeight:700,color:'#f8fafc',marginBottom:3}}>Drop your CSV here or click to browse</div><div style={{fontSize:11,color:'rgba(148,163,184,0.55)'}}>Supports {platform.label} export format</div></>)}
              </div>
              {csvError&&<div style={{marginBottom:12,padding:'9px 12px',borderRadius:11,background:'rgba(248,113,113,0.07)',border:'1px solid rgba(248,113,113,0.22)',fontSize:12,color:'#f87171'}}>⚠️ {csvError}</div>}
              <div style={{display:'flex',gap:9}}><OBSecBtn onClick={()=>setStep('paste')} style={{flex:1}}>← Use paste instead</OBSecBtn><OBSecBtn onClick={()=>setStep('platforms')} style={{flex:1}}>← Back</OBSecBtn></div>
              {!isPrimaryInQueue&&<OBLinks links={[{label:'Skip for now — connect later',onClick:skipCurrentPlatform}]}/>}
              <OBTrust/>
            </div>
          )}

          {/* ══ LOADING ══ */}
          {step==='loading'&&(
            <div style={{animation:'fadeUp 0.3s ease both'}}>
              <OBLogo/>
              <div style={{marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',maxWidth:250,margin:'0 auto 8px'}}>
                  {[{n:1},{n:2},{n:3}].map((s,i)=>(<div key={s.n} style={{display:'flex',alignItems:'center',flex:i<2?1:'none'}}>
                    <div style={{width:30,height:30,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,flexShrink:0,background:s.n<3?CYAN:GRAD,color:'#04101b',boxShadow:s.n===3?`0 0 20px rgba(33,230,243,0.6)`:`0 0 14px rgba(33,230,243,0.4)`}}>{s.n<3?'✓':s.n}</div>
                    {i<2&&<div style={{height:2,flex:1,background:GRAD,margin:'0 3px',boxShadow:'0 0 6px rgba(33,230,243,0.3)'}}/>}
                  </div>))}
                </div>
                <div style={{display:'flex',justifyContent:'space-between',maxWidth:250,margin:'0 auto'}}>
                  {['Stats','Tips','Done'].map((l,i)=>(<div key={l} style={{width:28,textAlign:'center',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:i<2?`rgba(33,230,243,0.55)`:`rgba(33,230,243,0.9)`}}>{l}</div>))}
                </div>
              </div>
              <div style={{textAlign:'center',marginBottom:16}}>
                <h1 style={{fontSize:23,fontWeight:900,color:'#F8FAFC',letterSpacing:'-0.025em',marginBottom:7}}>Building your CamCash dashboard</h1>
                <p style={{fontSize:13,color:'rgba(148,163,184,0.75)',minHeight:18}}>{msgs[loadingMsgIdx]}</p>
              </div>
              <div style={{marginBottom:22}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontSize:10,color:'rgba(148,163,184,0.55)'}}>Progress</span>
                  <span style={{fontSize:10,color:CYAN,fontWeight:700}}>{loadingProgress}%</span>
                </div>
                <div style={{height:8,borderRadius:100,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${loadingProgress}%`,background:GRAD,borderRadius:100,boxShadow:'0 0 18px rgba(33,230,243,0.4)',transition:'width 0.1s linear'}}/>
                </div>
                <div style={{fontSize:10,color:'rgba(100,116,139,0.5)',textAlign:'center',marginTop:4}}>{loadingProgress}% complete</div>
              </div>
              <div style={{marginBottom:12}}>
                {LOADING_MESSAGES.map((m,i)=>{
                  const done=loadingProgress>=((i+1)/LOADING_MESSAGES.length)*95
                  const active=!done&&loadingProgress>=(i/LOADING_MESSAGES.length)*95
                  return(<div key={m} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 0',borderBottom:i<LOADING_MESSAGES.length-1?'1px solid rgba(255,255,255,0.04)':'none',opacity:done||active?1:0.3,transition:'opacity 0.4s'}}>
                    <div style={{display:'flex',alignItems:'center',gap:9}}>
                      <div style={{width:20,height:20,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,background:done?CYAN:active?'rgba(33,230,243,0.15)':'rgba(255,255,255,0.05)',border:done?'none':active?`1px solid rgba(33,230,243,0.45)`:'1px solid rgba(255,255,255,0.1)',transition:'all 0.3s',boxShadow:done?'0 0 10px rgba(33,230,243,0.5)':active?'0 0 6px rgba(33,230,243,0.2)':'none'}}>
                        {done?<span style={{fontSize:10,fontWeight:900,color:'#04101b'}}>✓</span>:active?<div style={{width:6,height:6,borderRadius:'50%',border:'1.5px solid rgba(255,255,255,0.2)',borderTopColor:CYAN,animation:'spin 0.8s linear infinite'}}/>:null}
                      </div>
                      <span style={{fontSize:12,color:done?'#fff':active?CYAN:'rgba(148,163,184,0.5)',fontWeight:done?600:active?700:400}}>{m}</span>
                    </div>
                    <span style={{fontSize:9,fontWeight:700,color:done?CYAN:active?'rgba(33,230,243,0.6)':'rgba(100,116,139,0.35)'}}>{done?'Complete':active?'In progress':'Queued'}</span>
                  </div>)
                })}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:7}}>
                {[
                  {icon:'💵',label:'Earnings',value:`$${((preview?.estimatedEarnings||0)*(loadingProgress/100)).toFixed(0)}`,color:CYAN},
                  {icon:'👥',label:'Fans',value:Math.round((preview?.fansDetected||0)*(loadingProgress/100)),color:'#a78bfa'},
                  {icon:'💎',label:'Tips',value:Math.round((preview?.tipsDetected||0)*(loadingProgress/100)),color:'#4ade80'},
                  {icon:'⏰',label:'Best Hour',value:loadingProgress>80?(preview?.bestHour||'–'):'…',color:PINK},
                ].map(s=>(<div key={s.label} className="stat-card" style={{padding:'9px 8px',textAlign:'center'}}>
                  <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',borderRadius:'14px 14px 0 0',background:`linear-gradient(90deg,${s.color}00,${s.color}70,${s.color}00)`}}/>
                  <div style={{fontSize:13,marginBottom:2}}>{s.icon}</div>
                  <div style={{fontSize:8,color:'rgba(148,163,184,0.5)',marginBottom:2,textTransform:'uppercase',letterSpacing:'0.06em'}}>{s.label}</div>
                  <div style={{fontSize:13,fontWeight:900,color:s.color,fontVariantNumeric:'tabular-nums'}}>{s.value}</div>
                </div>))}
              </div>
              <div style={{textAlign:'center',marginTop:10,fontSize:10,color:'rgba(100,116,139,0.45)'}}>⚡ Almost there! Crunching the good stuff…</div>
            </div>
          )}

          {/* ══ PLATFORM SUCCESS (primary or secondary) ══ */}
          {step==='platformSuccess'&&currentResult&&(()=>{
            const snap=currentResult.snapshot
            const full=snap?.full
            const recent=snap?.recent
            return(
            <div style={{animation:'fadeUp 0.35s ease both',textAlign:'center'}}>
              <div style={{width:56,height:56,borderRadius:20,background:GRAD,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,color:'#fff',margin:'0 auto 14px',boxShadow:'0 0 40px rgba(33,230,243,0.35),0 0 70px rgba(255,47,174,0.2)'}}>✓</div>
              <div style={EYE}>{isPrimaryInQueue?'Primary Platform':'Secondary Platform'}</div>
              <h1 style={{fontSize:20,fontWeight:900,color:'#fff',marginBottom:6}}>{isPrimaryInQueue?`Your ${platform.label} data is ready`:`${platform.label} data connected`}</h1>
              {full&&full.days>0&&(
                <p style={{fontSize:12,color:'rgba(148,163,184,0.75)',marginBottom:18}}>{fmtDate(full.from)} — {fmtDate(full.to)} · {full.days} day{full.days===1?'':'s'} of data imported</p>
              )}

              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:9,marginBottom:16}}>
                <div className="stat-card" style={{padding:'12px 10px'}}>
                  <div style={{fontSize:9,color:'rgba(148,163,184,0.6)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:700}}>Earnings</div>
                  <div style={{fontSize:18,fontWeight:900,color:CYAN}}>${(full?.usd??currentResult.totalUsd??0).toFixed(2)}</div>
                </div>
                <div className="stat-card" style={{padding:'12px 10px'}}>
                  <div style={{fontSize:9,color:'rgba(148,163,184,0.6)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:700}}>Tips</div>
                  <div style={{fontSize:18,fontWeight:900,color:'#4ade80'}}>{full?.tips??currentResult.inserted??0}</div>
                </div>
              </div>

              <div style={{borderRadius:14,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.03)',padding:'14px 16px',marginBottom:16,textAlign:'left'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                  <div style={{fontSize:10,fontWeight:900,color:'rgba(33,230,243,0.9)',textTransform:'uppercase',letterSpacing:'0.1em'}}>Your first snapshot</div>
                  <button onClick={()=>setHowItWorksOpen(v=>{const next=!v;if(next)track('onboarding_how_it_works_opened',{platform:platformId});return next})} style={{background:'none',border:'none',color:'rgba(148,163,184,0.6)',fontSize:10,cursor:'pointer',padding:0}}>ⓘ How this works</button>
                </div>
                {howItWorksOpen&&(
                  <div style={{borderRadius:11,background:'rgba(33,230,243,0.06)',border:'1px solid rgba(33,230,243,0.18)',padding:'10px 12px',marginBottom:10,fontSize:11,color:'rgba(203,213,225,0.85)',lineHeight:1.6}}>
                    CamCash keeps your imported history so your insights can get smarter as you add more data. Your Free dashboard focuses on your most recent 31 days so you can quickly see what's happening now. Older imported history is preserved where available and can power deeper trends as you unlock more of CamCash.
                  </div>
                )}
                {recent&&!recent.isPartial?(
                  <>
                    <div style={{fontSize:12,fontWeight:700,color:'#fff',marginBottom:2}}>Most recent 31 days</div>
                    <div style={{fontSize:11,color:'rgba(148,163,184,0.7)',marginBottom:8}}>{fmtDate(recent.from)} — {fmtDate(recent.to)}</div>
                  </>
                ):(
                  <>
                    <div style={{fontSize:12,fontWeight:700,color:'#fff',marginBottom:2}}>Your available data</div>
                    <div style={{fontSize:11,color:'rgba(148,163,184,0.7)',marginBottom:8}}>You're starting with {recent?.days||0} day{recent?.days===1?'':'s'} of data. Add more history later to uncover deeper trends.</div>
                  </>
                )}
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
                  <div><div style={{fontSize:9,color:'rgba(148,163,184,0.55)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Earnings</div><div style={{fontSize:14,fontWeight:800,color:CYAN}}>${(recent?.usd||0).toFixed(2)}</div></div>
                  <div><div style={{fontSize:9,color:'rgba(148,163,184,0.55)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Tips</div><div style={{fontSize:14,fontWeight:800,color:'#4ade80'}}>{recent?.tips||0}</div></div>
                </div>
              </div>

              {!isPrimaryInQueue&&(
                <div style={{borderRadius:13,border:'1px solid rgba(124,92,255,0.22)',background:'rgba(124,92,255,0.06)',padding:'12px 14px',marginBottom:16,textAlign:'left'}}>
                  <div style={{fontSize:10,fontWeight:900,color:'#a78bfa',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>CamCash found more</div>
                  {['Cross-platform comparison','Deeper earnings patterns','Longer-term trends'].map(t=>(<div key={t} style={{fontSize:11,color:'rgba(203,213,225,0.75)',marginBottom:5}}>🔒 {t}</div>))}
                  <a href="/pricing" style={{fontSize:11,fontWeight:700,color:'#a78bfa',textDecoration:'none'}}>Unlock deeper insights →</a>
                </div>
              )}

              <OBBtn onClick={()=>goToNextOrFinish()}>{nextUnhandledId?`Continue to ${PLATFORMS[nextUnhandledId].label} →`:'See your setup →'}</OBBtn>
            </div>
          )})()}

          {/* ══ FINAL SUMMARY ══ */}
          {step==='finalSummary'&&(
            <div style={{animation:'fadeUp 0.35s ease both',textAlign:'center'}}>
              <div style={EYE}>All Set</div>
              <h1 style={{fontSize:21,fontWeight:900,color:'#fff',marginBottom:7}}>Your CamCash setup is ready ✓</h1>
              <p style={{fontSize:13,color:'rgba(148,163,184,0.8)',lineHeight:1.6,marginBottom:18}}>Your first snapshot is ready.</p>

              <div style={{marginBottom:18}}>
                {selectedPlatforms.map((id,i)=>{
                  const res=platformResults[id]
                  const connected=res?.status==='connected'
                  return(
                    <div key={id} style={{display:'flex',alignItems:'center',gap:11,padding:'11px 13px',borderRadius:13,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',marginBottom:8,textAlign:'left'}}>
                      <div style={{width:36,height:36,borderRadius:11,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,flexShrink:0,...PLATFORMS[id].iconStyle}}>{PLATFORMS[id].short}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:700,color:'#fff'}}>{PLATFORMS[id].label}</div>
                        <div style={{fontSize:10,color:'rgba(148,163,184,0.65)'}}>{i===0?'Primary':'Secondary'} · {connected?'Connected':'Not connected'}</div>
                      </div>
                      {connected?<span style={{color:'#4ade80',fontSize:14}}>✓</span>:(
                        <button onClick={()=>{setQueueIndex(i);startConnecting(id)}} style={{fontSize:10,fontWeight:700,color:CYAN,background:'none',border:'none',cursor:'pointer'}}>Connect later →</button>
                      )}
                    </div>
                  )
                })}
              </div>

              {selectedPlatforms.length>1&&(
                <p style={{fontSize:11,color:'rgba(148,163,184,0.65)',lineHeight:1.55,marginBottom:16}}>CamCash is ready to start building your cross-platform picture as more data comes in.</p>
              )}

              <OBBtn onClick={finishOnboarding}>Enter CamCash →</OBBtn>
            </div>
          )}

          {/* ══ TRIAL UPSELL ══ */}
          {step==='trial'&&(
            <div style={{animation:'fadeUp 0.3s ease both'}}>
              <div style={{textAlign:'center',marginBottom:22}}>
                <div style={{width:56,height:56,borderRadius:18,background:'linear-gradient(135deg,#21E6F3,#6C5CFF)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,color:'#fff',margin:'0 auto 14px',boxShadow:'0 0 40px rgba(33,230,243,0.35)'}}>⚡</div>
                <h2 style={{fontSize:22,fontWeight:900,color:'#fff',marginBottom:6,letterSpacing:'-0.02em'}}>Unlock Pro Features — Free for 7 Days</h2>
                <p style={{fontSize:13,color:'rgba(166,168,189,0.85)',lineHeight:1.65,maxWidth:360,margin:'0 auto'}}>We collected your first insights. Get access to multi-platform tracking and AI pattern learning risk-free with your 7-day trial.</p>
              </div>
              <div style={{marginBottom:18,borderRadius:14,background:'linear-gradient(135deg,rgba(33,230,243,0.08),rgba(124,92,255,0.08))',border:'1px solid rgba(167,139,250,0.2)',padding:16}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {[{icon:'🌍',label:'All Platforms',desc:'Track multiple cam sites'},{icon:'📈',label:'AI Analytics',desc:'Pattern & trend insights'},{icon:'🎯',label:'Live Tracking',desc:'Real-time stream coaching'},{icon:'🔐',label:'Secure & Private',desc:'Your data stays private'}].map(f=>(<div key={f.label} style={{textAlign:'center'}}>
                    <div style={{fontSize:20,marginBottom:6}}>{f.icon}</div>
                    <div style={{fontSize:11,fontWeight:700,color:'#fff',marginBottom:2}}>{f.label}</div>
                    <div style={{fontSize:10,color:'rgba(148,163,184,0.65)'}}>{f.desc}</div>
                  </div>))}
                </div>
              </div>
              <div style={{marginBottom:16,paddingTop:16,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
                <div style={{display:'flex',alignItems:'baseline',gap:4,justifyContent:'center',marginBottom:2}}>
                  <span style={{fontSize:32,fontWeight:900,color:CYAN}}>$0</span>
                  <span style={{fontSize:12,color:'rgba(148,163,184,0.6)'}}>for 7 days</span>
                </div>
                <div style={{fontSize:11,color:'rgba(148,163,184,0.6)',marginBottom:10}}>Then $19.99/month. Cancel anytime.</div>
                <OBBtn onClick={handleStartTrial} style={{marginBottom:10}}>Start 7-Day Trial →</OBBtn>
                <button onClick={()=>setStep('done')} style={{width:'100%',height:44,borderRadius:12,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'rgba(203,213,225,0.85)',fontSize:13,fontWeight:700,cursor:'pointer',transition:'all 0.18s'}} onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(33,230,243,0.45)';e.currentTarget.style.color='#fff';e.currentTarget.style.background='rgba(33,230,243,0.07)'}} onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.12)';e.currentTarget.style.color='rgba(203,213,225,0.85)';e.currentTarget.style.background='rgba(255,255,255,0.04)'}}>Skip for now</button>
              </div>
            </div>
          )}

          {/* ══ STEP4 ══ */}
          {step==='step4'&&(
            <div style={{animation:'fadeUp 0.35s ease both'}}>
              <div style={{textAlign:'center',marginBottom:16}}>
                <div style={{width:56,height:56,borderRadius:20,background:GRAD,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,color:'#fff',margin:'0 auto 14px',boxShadow:'0 0 40px rgba(33,230,243,0.35),0 0 70px rgba(255,47,174,0.2)'}}>✓</div>
                <h1 style={{fontSize:20,fontWeight:900,color:'#fff',marginBottom:7}}>Make your dashboard smarter</h1>
                <p style={{fontSize:13,color:'rgba(148,163,184,0.8)',lineHeight:1.6}}>Add more history or turn on live tracking so CamCash can find stronger patterns.</p>
              </div>
              {[{icon:'📥',title:'Add more history',sub:'Improve accuracy with more tip data',onClick:()=>{setPasteText('');setStep('paste')}},{icon:'📡',title:'Set up live tracking',sub:'Track future tips automatically while you stream',onClick:()=>window.open('https://www.camcashgrl.com/extension','_blank')},{icon:'📊',title:'Go to dashboard',sub:'See what CamCash found so far',onClick:()=>router.push('/dashboard')}].map(a=>(<button key={a.title} onClick={a.onClick} style={{display:'flex',alignItems:'center',gap:13,padding:'14px 15px',width:'100%',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:15,cursor:'pointer',transition:'all 0.2s',textAlign:'left',marginBottom:9}} onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(33,230,243,0.3)';e.currentTarget.style.background='rgba(33,230,243,0.04)';e.currentTarget.style.transform='translateY(-1px)'}} onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.08)';e.currentTarget.style.background='rgba(255,255,255,0.03)';e.currentTarget.style.transform=''}}><div style={{width:40,height:40,borderRadius:13,background:'rgba(33,230,243,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19,flexShrink:0}}>{a.icon}</div><div><div style={{fontSize:13,fontWeight:700,color:'#fff',marginBottom:1}}>{a.title}</div><div style={{fontSize:11,color:'rgba(100,116,139,0.8)'}}>{a.sub}</div></div><div style={{marginLeft:'auto',color:'rgba(100,116,139,0.5)',fontSize:14}}>→</div></button>))}
            </div>
          )}

          {/* ══ DONE ══ */}
          {step==='done'&&importResult&&(
            <div style={{animation:'fadeUp 0.4s ease both',textAlign:'center',position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',inset:0,animation:'flashPulse 1s ease-out 1',background:'rgba(33,230,243,0)',pointerEvents:'none'}}/>
              <div style={{width:64,height:64,borderRadius:22,background:GRAD,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,fontWeight:900,color:'#fff',margin:'0 auto 16px',boxShadow:'0 0 55px rgba(255,47,174,0.45),0 0 100px rgba(33,230,243,0.3)',animation:'glowPulse 2.5s ease-in-out infinite'}}>✓</div>
              <div style={EYE}>First Insights</div>
              <h1 style={{fontSize:23,fontWeight:900,color:'#F8FAFC',letterSpacing:'-0.025em',marginBottom:7}}>Your first insights are ready</h1>
              <p style={{fontSize:13,color:'rgba(166,168,189,0.85)',lineHeight:1.65,marginBottom:20}}>Here's a beautiful preview of what we found.</p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:9,marginBottom:14}}>
                {[
                  {label:'Tips Imported',value:tipsDisplayed,color:CYAN,prefix:'',suffix:' tips',delay:'0s'},
                  {label:'Unique Fans',value:preview?.fansDetected||0,color:'#f59e0b',prefix:'',suffix:' fans',delay:'0.1s'},
                  {label:'Est. Earnings',value:parseFloat(preview?.estimatedEarnings||0),color:'#4ade80',prefix:'$',suffix:'',delay:'0.2s',decimals:2},
                  {label:'Top Spender',value:preview?.topSpender?.name||'—',color:PINK,isText:true,delay:'0.3s'},
                ].map(s=>(<div key={s.label} className="stat-card" style={{padding:'13px 13px',animation:`statCardIn 0.4s ease ${s.delay} both`}}>
                  <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',borderRadius:'14px 14px 0 0',background:`linear-gradient(90deg,${s.color}00,${s.color}88,${s.color}00)`}}/>
                  <div style={{fontSize:9,color:'rgba(148,163,184,0.6)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.14em',fontWeight:700}}>{s.label}</div>
                  <div style={{fontSize:s.isText?14:20,fontWeight:900,color:s.color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {s.isText?s.value:<CountUp to={typeof s.value==='number'?s.value:0} prefix={s.prefix||''} suffix={s.suffix||''} duration={900} decimals={s.decimals||0}/>}
                  </div>
                </div>))}
              </div>

              {/* Paid sessions callout on done screen */}
              {importResult.paidInserted>0&&(
                <div style={{borderRadius:12,border:'1px solid rgba(255,47,174,0.2)',background:'rgba(255,47,174,0.04)',padding:'10px 13px',marginBottom:12,textAlign:'left',display:'flex',gap:9,alignItems:'flex-start'}}>
                  <span style={{fontSize:14,flexShrink:0}}>💳</span>
                  <div style={{fontSize:11,color:'rgba(203,213,225,0.8)',lineHeight:1.55}}>
                    <strong style={{color:PINK}}>{importResult.paidInserted} paid chat sessions</strong> were also imported and are tracked separately in your dashboard under Private Sessions.
                  </div>
                </div>
              )}

              <div style={{borderRadius:14,border:`1px solid ${PINK}33`,background:`rgba(255,47,174,0.05)`,padding:'13px 15px',marginBottom:14,textAlign:'left',display:'flex',gap:10}}>
                <span style={{fontSize:18,flexShrink:0}}>⚡</span>
                <div>
                  <div style={{fontSize:10,fontWeight:800,color:PINK,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:4}}>Best first insight</div>
                  {preview?.bestHour?(
                    preview.bestHourConfident?(
                      <p style={{fontSize:13,color:'rgba(248,250,252,0.9)',lineHeight:1.6}}>Your earnings peak around <strong style={{color:PINK}}>{preview.bestHour}</strong>. That's your sweet spot — prioritize streaming then.</p>
                    ):(
                      <p style={{fontSize:13,color:'rgba(248,250,252,0.9)',lineHeight:1.6}}>Your biggest tips so far cluster around <strong style={{color:PINK}}>{preview.bestHour}</strong>, but that's based on limited history — import more to confirm it's a real pattern.</p>
                    )
                  ):(
                    <p style={{fontSize:12,color:'rgba(148,163,184,0.7)',lineHeight:1.6}}>Import more history to unlock your peak streaming windows.</p>
                  )}
                </div>
              </div>

              <div style={{borderRadius:14,border:'1px solid rgba(255,255,255,0.07)',background:'rgba(255,255,255,0.03)',padding:'12px 14px',marginBottom:16,textAlign:'left',display:'flex',alignItems:'flex-start',gap:10}}>
                <div style={{fontSize:18,flexShrink:0}}>📧</div>
                <div><div style={{fontSize:12,fontWeight:800,color:'#fff',marginBottom:2}}>Check your email</div><div style={{fontSize:11,color:'rgba(148,163,184,0.7)',lineHeight:1.55}}>We sent you a walkthrough on importing more data. Use the <span style={{color:CYAN,fontWeight:600}}>CSV Importer</span> in your sidebar anytime.</div></div>
              </div>

              <div style={{borderRadius:12,border:'1px solid rgba(124,92,255,0.2)',background:'rgba(124,92,255,0.06)',padding:'10px 13px',marginBottom:12,textAlign:'left',display:'flex',gap:9,alignItems:'flex-start'}}>
                <span style={{fontSize:14,flexShrink:0}}>💡</span>
                <div style={{fontSize:11,color:'rgba(148,163,184,0.75)',lineHeight:1.55}}>
                  <strong style={{color:'rgba(203,213,225,0.9)'}}>To get the full potential of CamCash,</strong> import as much tip history as possible. Until you have a substantial number of sessions, your insights won't be as deep or accurate — but you can always add more later using the CSV Importer in your dashboard.
                </div>
              </div>

              <OBBtn onClick={enterDashboard} style={{marginBottom:10}}>Go to Dashboard →</OBBtn>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}>
                {[{label:'Add more history',onClick:()=>{setPasteText('');setStep('paste')}},{label:'Set up live tracking',onClick:()=>window.open('https://www.camcashgrl.com/extension','_blank')}].map(b=>(<OBSecBtn key={b.label} onClick={b.onClick} style={{width:'100%',height:40,fontSize:12}}>{b.label}</OBSecBtn>))}
              </div>
            </div>
          )}

          {dashboardTransitioning&&(
            <div className="ob-dash-sweep" style={{position:'absolute',inset:0,zIndex:20,pointerEvents:'none',background:GRAD,animation:'dashboardSweep 0.7s ease-out both',mixBlendMode:'screen'}}/>
          )}

        </div>
      </div>
    </main>
  )
}

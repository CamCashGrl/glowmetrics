'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { readUploadJson } from '../../lib/readUploadJson'
// Token rates — single source of truth, never hardcode below this line
import { PLATFORM_TOKEN_RATES, tokenRate } from '../../lib/constants'
import { computeSnapshotStats, parseCSV } from '../../lib/analytics'
import { summarizeOnboarding, importDate, assertImportComplete, earningDateRange, formatDay } from '../../lib/onboardingSummary'
import { FREE_ANALYSIS_WINDOW_DAYS } from '../../lib/planLimits'
import { track } from '../../lib/track'
import { trackCheckoutEvent } from '../../lib/analytics-client'
import { logParseAttempt, analyzeFormat } from '../../lib/parseTracking'
import OnboardingExitSurvey from '@/components/OnboardingExitSurvey'
import { isValidTimeZone, resolveCreatorTimeZone, timeZoneLabel, allTimeZones } from '../../lib/creatorTimezone'


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

// Maps an import/upload error to a controlled category for analytics — never
// send e.message here, since parser errors can echo back pasted content.
function categorizeImportError(e){
  if(e.name==='AbortError')return 'timeout'
  if(e.code==='platform_limit_reached')return 'platform_limit'
  if(e.code)return String(e.code)
  const msg=(e.message||'').toLowerCase()
  if(msg.includes('no tip rows')||msg.includes("couldn't find"))return 'empty_data'
  if(msg.includes('format')||msg.includes('unsupported'))return 'unsupported_format'
  if(msg.includes('not logged in'))return 'auth_error'
  return 'unknown_error'
}

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

// Paste preview + first-insight summary. One category contract for every
// platform (lib/onboardingSummary.js): regular tips, private earnings
// (Chaturbate private shows, BongaCams paid chats, MyFreeCams privates),
// memberships, other sales. Private earnings and memberships are never
// counted as regular tips; total earnings = tips + private + memberships.
// Chaturbate and MyFreeCams use the canonical server parser
// (lib/analytics.js parseCSV) so the preview matches exactly what /api/upload
// will store — including private shows / MFC privates, which that route saves
// through its deduplicating paid-session path. (This page's own MFC row
// parser mis-read MFC exports: wrong dates, usernames, tokens, and privates
// counted as tips.) BongaCams keeps this page's parsers, which read its
// headerless exports more accurately; its paid chats upload separately.
export function buildPreview(rawText,platformId,platformLabel,timeZone='UTC'){
  let rows=[],paidSessions=[]
  if(platformId==='chaturbate'||platformId==='myfreecams'){
    const parsed=parseCSV(rawText,PLATFORMS[platformId].label)
    for(const r of parsed){
      const ts=importDate(r.date_time||r.dateRaw)
      if(isNaN(ts.getTime()))continue
      const date_time=r.date_time||r.dateRaw
      if(r.is_paid_session)paidSessions.push({ts,date_time,username:r.username,sessionType:r.session_type,tokens:r.tokens,usd:r.usd})
      else rows.push({ts,date_time,username:r.username,tokens:r.tokens,usd:r.usd,note:r.tip_note||'',tip_type:r.tip_type})
    }
  }else{
    rows=parseRows(rawText,platformId).rows
    paidSessions=parseBCPaidSessions(rawText).sessions
  }
  if(!rows.length&&!paidSessions.length)return null
  const allRows=[...rows,...paidSessions.map(s=>({ts:s.ts,date_time:s.date_time,username:s.username,tokens:s.tokens,usd:s.usd,session_type:s.sessionType,is_paid_session:true}))]
  const summary=summarizeOnboarding(allRows,timeZone)
  // Card date range: first → last earning day on the creator's clock.
  const range=earningDateRange(allRows,timeZone)
  const fans=new Set(allRows.map(r=>(r.username||'').toLowerCase().trim()).filter(Boolean)).size
  const topSpender=Object.entries(allRows.reduce((acc,r)=>{acc[r.username]=(acc[r.username]||0)+r.tokens;return acc},{})).sort((a,b)=>b[1]-a[1])[0]
  const c=summary.full.categories
  return{
    tipsDetected:c.tips.count,
    privateDetected:c.private.count,
    membershipsDetected:c.memberships.count,
    otherDetected:c.other.count,
    transactionsDetected:c.tips.count+c.private.count+c.memberships.count+c.other.count,
    paidSessionsDetected:paidSessions.length,
    paidSessions,
    estimatedEarnings:summary.full.usd,
    paidEarnings:c.private.usd,
    fansDetected:fans,
    startDate:range?.startDate||null,
    endDate:range?.endDate||null,
    dateFrom:range?formatDay(range.startDate):null,
    dateTo:range?formatDay(range.endDate):null,
    dateRange:range?`${formatDay(range.startDate)} – ${formatDay(range.endDate)}`:'—',
    // Inclusive calendar dates in the range (Sep 18 → Oct 9 = 22).
    calendarDays:range?.calendarDays||0,
    topSpender:topSpender?{name:topSpender[0],tokens:topSpender[1]}:null,
    bestHour:summary.bestHour,
    bestHourConfident:summary.bestHourConfident,
    sampleRows:rows.slice(0,5).map(r=>({date:r.ts.toLocaleDateString('en-US',{timeZone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}),fan:r.username,tokens:r.tokens,amount:r.usd,platform:platformLabel})),
    rows,
    snapshot:summary,
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
// Trial-screen copy kept in one object so variants can be swapped for A/B
// tests later. Benefits only list features with real Pro gating in code:
// FREE_ANALYSIS_WINDOW_DAYS (history), Platforms Intelligence (top fans
// 3 vs 10), StreamPlanner isPro gating.
const TRIAL_COPY={
  headline:'Your first insight is just the beginning.',
  sub:'Start your 7-day Pro trial and let CamCash build a deeper picture of your earnings, fans, platforms, and best streaming times.',
  benefits:['Full earning history','Full multi-platform analytics','Complete fan insights','Stream Planner','Deeper earning-pattern analysis'],
  cta:'Start my 7-day Pro trial →',
}
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
  .ob-card{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.10) transparent;scrollbar-gutter:auto}
  .ob-card::-webkit-scrollbar{width:6px}
  .ob-card::-webkit-scrollbar-track{background:transparent;margin:24px 0}
  .ob-card::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.10);border-radius:6px}
  .ob-card::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.18)}
  textarea::-webkit-scrollbar{width:4px}
  textarea::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:2px}
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
    /* Step 1 platform cards stay a compact 3-across row on phones so the CTA stays above the fold. */
    .ob-plat-row{gap:7px!important}
    .ob-plat-card{padding:10px 4px 9px!important}
    .ob-plat-icon{width:40px!important;height:40px!important;border-radius:12px!important;font-size:12px!important;margin-bottom:6px!important}
    .ob-plat-name{font-size:12px!important}
    .ob-plat-blurb{display:none}
    .ob-s2-title{font-size:23px!important}
    .ob-det-grid{grid-template-columns:1fr 1fr!important;row-gap:10px}
    .ob-det-grid>div:nth-child(3){grid-column:1 / -1;border-left:none!important;padding-left:0!important}
    .ob-det-val{white-space:normal!important}
    .ob-det-title{font-size:14.5px!important}
    .ob-step1-title{font-size:24px!important}
    .ob-step1-sub{font-size:12.5px!important}
    .ob-tz-row{padding:0 12px!important;gap:9px!important}
    .ob-tz-iana{font-size:11.5px!important}
  }
  @media(min-width:601px){
    .ob-card-shell{max-width:min(600px,calc(100vw - 32px))!important}
    main{padding:12px 16px!important}
    .ob-card{padding:clamp(14px,2.4dvh,22px) 28px clamp(12px,2dvh,18px)!important}
  }
  /* Step 1: wider card on desktop with one centered content column. */
  .ob-step1-col{max-width:600px;margin:0 auto}
  .ob-tz-list::-webkit-scrollbar{width:6px}
  .ob-tz-list::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.25);border-radius:6px}
  .ob-tz-list{scrollbar-width:thin;scrollbar-color:rgba(148,163,184,0.25) transparent}
  /* Step 1 never scrolls on normal screens; one internal scroll only as a fallback on very short ones. */
  .ob-card.ob-card--step1{overflow:hidden!important}
  @media(max-height:620px){.ob-card.ob-card--step1{overflow-y:auto!important}}
  @media(min-width:601px){
    .ob-card-shell.ob-card-shell--wide{max-width:min(760px,calc(100vw - 48px))!important}
    .ob-card-shell--wide .ob-card{padding:clamp(18px,3dvh,30px) clamp(28px,4vw,56px) clamp(16px,2.6dvh,24px)!important}
  }
  @media(min-width:601px) and (max-height:760px){
    .ob-step1-head{margin-bottom:14px!important}
    .ob-plat-row{margin-bottom:14px!important}
    .ob-plat-card{padding:14px 10px 12px!important}
  }
  .ob-card{max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px)}
  .ob-gap{margin-bottom:clamp(10px,1.8dvh,16px)!important}
  @media(max-height:820px){
    .ob-stepper{margin-bottom:8px!important}
    .ob-stepper-circle{width:26px!important;height:26px!important}
  }
`

// ── UI components ──────────────────────────────────────────────
function OBLogo({showSub=false}){
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',marginBottom:8}}>
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

function OBProgress({current,onBack}){
  const steps=[{n:1,label:'Platform'},{n:2,label:'Import'},{n:3,label:'Insights'}]
  return(
    <div className="ob-stepper" style={{marginBottom:10}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',maxWidth:250,margin:'0 auto 8px'}}>
        {steps.map((s,i)=>(
          <div key={s.n} style={{display:'flex',alignItems:'center',flex:i<2?1:'none'}}>
            {(()=>{const back=onBack&&s.n===current-1;const Tag=back?'button':'div';return(
            <Tag className="ob-stepper-circle" {...(back?{type:'button',onClick:onBack,'aria-label':`Back to ${s.label}`,title:`Back to ${s.label}`}:{})} style={{
              width:30,height:30,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',padding:0,cursor:back?'pointer':'default',
              fontSize:11,fontWeight:800,flexShrink:0,transition:'all 0.35s',
              background:s.n===current?GRAD:s.n<current?CYAN:'rgba(255,255,255,0.05)',
              border:s.n>current?'1px solid rgba(255,255,255,0.12)':'none',
              color:s.n===current?'#fff':s.n<current?'#04101b':'rgba(255,255,255,0.25)',
              boxShadow:s.n===current?`0 0 22px rgba(33,230,243,0.75),0 0 40px rgba(168,85,247,0.5),0 0 56px rgba(255,47,174,0.38)`:s.n<current?`0 0 14px rgba(33,230,243,0.4)`:'none',
            }}>
              {s.n<current?'✓':s.n}
            </Tag>)})()}
            {i<2&&<div className="ob-stepper-line" style={{height:2,flex:1,background:current>s.n?GRAD:'rgba(255,255,255,0.1)',transition:'all 0.35s',margin:'0 3px',boxShadow:current>s.n?'0 0 6px rgba(33,230,243,0.3)':'none'}}/>}
          </div>
        ))}
      </div>
      <div className="ob-stepper-step-labels" style={{display:'flex',justifyContent:'space-between',maxWidth:280,margin:'0 auto'}}>
        {steps.map(s=>(<div key={s.n} aria-current={s.n===current?'step':undefined} style={{width:60,textAlign:'center',fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.12em',color:s.n===current?CYAN:s.n<current?'rgba(33,230,243,0.7)':'rgba(255,255,255,0.28)',textShadow:s.n===current?'0 0 10px rgba(33,230,243,0.55)':'none',transition:'all 0.35s'}}>{s.label}</div>))}
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
  return(<div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,marginTop:10,fontSize:10,color:'rgba(100,116,139,0.55)'}}><span>🔒</span><span>Your data is stored securely and never shared.</span></div>)
}

// Step 1 timezone: a glass row (closed by default) that opens a styled,
// searchable picker. The picker is portalled to <body> so the card's own
// overflow/backdrop-filter can't clip it; on phones it's a bottom sheet.
// Only valid IANA zones can be picked.
const TZ_COMMON=['America/Los_Angeles','America/Denver','America/Phoenix','America/Chicago','America/New_York','America/Toronto','America/Bogota','America/Sao_Paulo','Europe/London','Europe/Berlin','Europe/Madrid','Europe/Bucharest','Europe/Kyiv','Europe/Kiev','Europe/Moscow','Asia/Manila','Australia/Sydney','UTC']
function OBTimezonePicker({value,onPick,onClose,anchorRef}){
  const[query,setQuery]=useState('')
  const[active,setActive]=useState(0)
  const[pos,setPos]=useState(null)
  const panelRef=useRef(null)
  const inputRef=useRef(null)
  const zones=useMemo(()=>allTimeZones().map(z=>({z,label:timeZoneLabel(z)})),[])
  const q=query.trim().toLowerCase()
  const matches=useMemo(()=>{
    // Matches the readable name ("Pacific Time"), the city ("Los Angeles") or the IANA id.
    const list=q?zones.filter(({z,label})=>label.toLowerCase().includes(q)||z.split('/').pop().replace(/_/g,' ').toLowerCase().includes(q)||z.toLowerCase().replace(/_/g,' ').includes(q)||z.toLowerCase().includes(q.replace(/\s+/g,'_'))):zones
    // Current selection first, then the most common creator zones, then A–Z.
    const rank=o=>o.z===value?-1:(TZ_COMMON.indexOf(o.z)+1||TZ_COMMON.length+1)
    return [...list].sort((a,b)=>rank(a)-rank(b))
  },[q,zones,value])
  useEffect(()=>{setActive(0)},[q])
  useEffect(()=>{
    const place=()=>{
      const el=anchorRef.current; if(!el)return
      const r=el.getBoundingClientRect(),vw=window.innerWidth,vh=window.innerHeight
      if(vw<600){setPos({sheet:true});return}
      // Floats directly beneath the field (never in document flow, so the
      // card never grows); flips above only if there isn't room below.
      const H=Math.min(300,vh-24),below=vh-r.bottom-14,above=r.top-14
      const down=below>=180||below>=above
      setPos({sheet:false,top:down?r.bottom+8:Math.max(8,r.top-8-Math.min(H,above)),left:r.left,width:r.width,maxH:Math.min(H,down?below:above)})
    }
    place()
    window.addEventListener('resize',place);window.addEventListener('scroll',place,true)
    return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true)}
  },[anchorRef])
  useEffect(()=>{inputRef.current?.focus()},[pos?.sheet])
  useEffect(()=>{
    const down=e=>{if(panelRef.current?.contains(e.target)||anchorRef.current?.contains(e.target))return;onClose()}
    document.addEventListener('mousedown',down);document.addEventListener('touchstart',down)
    return()=>{document.removeEventListener('mousedown',down);document.removeEventListener('touchstart',down)}
  },[onClose,anchorRef])
  const choose=z=>{if(isValidTimeZone(z))onPick(z)}
  const onKey=e=>{
    if(e.key==='Escape'){e.preventDefault();onClose(true)}
    else if(e.key==='ArrowDown'){e.preventDefault();setActive(i=>Math.min(i+1,matches.length-1))}
    else if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(i-1,0))}
    else if(e.key==='Enter'){e.preventDefault();if(matches[active])choose(matches[active].z)}
  }
  useEffect(()=>{panelRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView?.({block:'nearest'})},[active])
  if(!pos)return null
  const sheet=pos.sheet
  const panel=(
    <div ref={panelRef} data-testid="timezone-picker" onKeyDown={onKey} style={{
      position:'fixed',zIndex:1000,display:'flex',flexDirection:'column',
      ...(sheet?{left:0,right:0,bottom:0,maxHeight:'70vh',borderRadius:'20px 20px 0 0',padding:'14px 14px 18px'}:{top:pos.top,left:pos.left,width:pos.width,maxHeight:pos.maxH,borderRadius:16,padding:10}),
      background:'linear-gradient(180deg,#0e1328,#080b1a)',border:'1px solid rgba(96,165,250,0.25)',
      boxShadow:'0 24px 60px rgba(0,0,0,0.6),0 0 24px rgba(124,92,255,0.18)',fontFamily:"'Inter',system-ui,sans-serif",
    }}>
      {sheet&&<div aria-hidden="true" style={{width:40,height:4,borderRadius:4,background:'rgba(255,255,255,0.2)',margin:'0 auto 12px'}}/>}
      <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search city or timezone…" aria-label="Search timezones"
        role="combobox" aria-expanded="true" aria-controls="ob-tz-list" aria-activedescendant={matches[active]?`ob-tz-${active}`:undefined}
        style={{width:'100%',padding:'10px 12px',background:'rgba(4,6,18,0.9)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:11,color:'#f8fafc',fontSize:13,outline:'none',marginBottom:8}}/>
      <div id="ob-tz-list" role="listbox" aria-label="Timezone" className="ob-tz-list" style={{overflowY:'auto',flex:1,minHeight:0,display:'flex',flexDirection:'column',gap:2,paddingRight:2}}>
        {matches.length===0&&<div style={{padding:'12px 10px',fontSize:12,color:'rgba(148,163,184,0.75)'}}>No matching timezones</div>}
        {matches.map((o,i)=>{
          const cur=o.z===value
          return(
            <div key={o.z} id={`ob-tz-${i}`} data-idx={i} role="option" aria-selected={cur} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(o.z)} onMouseEnter={()=>setActive(i)}
              style={{display:'flex',alignItems:'center',gap:10,height:40,flexShrink:0,padding:'0 10px',borderRadius:10,cursor:'pointer',border:'1px solid transparent',
                ...(cur?{background:'linear-gradient(90deg,rgba(33,230,243,0.12),rgba(124,92,255,0.16),rgba(255,47,174,0.12)) padding-box,linear-gradient(#10152c,#10152c) padding-box,linear-gradient(90deg,rgba(33,230,243,0.65),rgba(168,85,247,0.6),rgba(255,47,174,0.65)) border-box',boxShadow:'0 0 14px rgba(124,92,255,0.18)'}:i===active?{background:'rgba(255,255,255,0.05)'}:{})}}>
              <span aria-hidden="true" style={{fontSize:13,opacity:0.75,flexShrink:0}}>🌐</span>
              <span style={{fontSize:13,fontWeight:cur?800:600,color:cur?'#fff':'#E2E8F0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',width:'42%',flexShrink:0}}>{o.label}</span>
              <span style={{flex:1,minWidth:0,fontSize:12,color:cur?'rgba(165,243,252,0.9)':'rgba(148,163,184,0.8)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.z}</span>
              {cur&&<span aria-hidden="true" style={{color:CYAN,fontWeight:900,fontSize:14,flexShrink:0}}>✓</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
  return createPortal(sheet?<><div aria-hidden="true" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:999}}/>{panel}</>:panel,document.body)
}

function OBTimezone({value,onChange,detected=false,status=null}){
  const[open,setOpen]=useState(false)
  const anchorRef=useRef(null)
  const btnRef=useRef(null)
  const close=(refocus)=>{setOpen(false);if(refocus)btnRef.current?.focus()}
  const badge=status||(detected?'Detected':null)
  return(
    <div data-testid="timezone-card" ref={anchorRef} style={{textAlign:'left',position:'relative'}}>
      <button ref={btnRef} type="button" aria-label="Change timezone" aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(o=>!o)} className="ob-tz-row" title="Used for your best hours, daily earnings, sessions, and stream recommendations." style={{
        width:'100%',display:'flex',alignItems:'center',gap:12,padding:'0 16px',height:52,borderRadius:14,cursor:'pointer',textAlign:'left',
        background:'linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))',
        border:`1px solid ${open?'rgba(124,92,255,0.7)':'rgba(96,165,250,0.22)'}`,boxShadow:open?'0 0 0 3px rgba(124,92,255,0.14),0 0 18px rgba(33,230,243,0.12)':'inset 0 1px 0 rgba(255,255,255,0.05)',transition:'border-color 0.18s,box-shadow 0.18s',
      }}>
        <span aria-hidden="true" style={{fontSize:17,flexShrink:0,opacity:0.9}}>🌐</span>
        <span style={{flex:1,minWidth:0,display:'flex',alignItems:'baseline',gap:10,overflow:'hidden'}}>
          <span style={{fontSize:15,fontWeight:800,color:'#F8FAFC',whiteSpace:'nowrap'}}>{timeZoneLabel(value)}</span>
          <span data-testid="timezone-iana" className="ob-tz-iana" style={{fontSize:13,color:'rgba(148,163,184,0.85)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{value}</span>
        </span>
        {badge&&<span data-testid={badge==='Detected'?'timezone-detected':'timezone-status'} style={{flexShrink:0,fontSize:11.5,fontWeight:700,borderRadius:8,padding:'3px 10px',...(badge==='Detected'?{color:'#4ade80',background:'rgba(74,222,128,0.12)',border:'1px solid rgba(74,222,128,0.3)'}:{color:CYAN,background:'rgba(33,230,243,0.12)',border:'1px solid rgba(33,230,243,0.32)'})}}>{badge}</span>}
        <span aria-hidden="true" style={{flexShrink:0,fontSize:11,color:'rgba(226,232,240,0.8)',transform:open?'rotate(180deg)':'none',transition:'transform 0.18s'}}>⌄</span>
      </button>
      {open&&<OBTimezonePicker value={value} anchorRef={anchorRef} onClose={close} onPick={tz=>{onChange(tz);close(true)}}/>}
    </div>
  )
}

// Step 1 card order (matches the approved onboarding reference).
const STEP1_PLATFORM_ORDER=['chaturbate','myfreecams','bongacams']

// ── Main component ─────────────────────────────────────────────
export default function OnboardingPage(){
  const router=useRouter()
  const[user,setUser]=useState(null)
  const[booting,setBooting]=useState(true)
  const[userPlan,setUserPlan]=useState('free')

  const[step,setStep]=useState('platforms')
  // selectedPlatforms is this session's connect queue. Step 1 is single
  // select, so it only ever holds the chosen primary — secondary platforms
  // are added later inside CamCash, not walked through here. Index 0 is
  // always Primary and is the single source of truth for it — there is no
  // separate primaryPlatformId to keep in sync.
  const[selectedPlatforms,setSelectedPlatforms]=useState([])
  // Platforms already saved in profiles.streaming_platforms (primary-first,
  // lowercase ids) for a returning user. Kept only so Step 1's save
  // preserves existing secondaries instead of overwriting them.
  const[savedPlatforms,setSavedPlatforms]=useState([])
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
  // Optional. No longer asked for in onboarding; if the profile already has a
  // Chaturbate username it's used only to deep-link the stats page on Import.
  const[cbUsername,setCbUsername]=useState('')
  // Step 2 detection: 'empty' | 'validating' | 'detected' | 'invalid'
  // Step 2 states (one persistent screen): 'empty' | 'parsing' | 'success' | 'error'
  const[detectStatus,setDetectStatus]=useState('empty')
  const[parseStage,setParseStage]=useState(0) // 0..100 — parsing progress shown in place
  const pasteRef=useRef(null)
  const[pasteHelpOpen,setPasteHelpOpen]=useState(false)
  const parseFailTrackedRef=useRef('')
  const[pasteText,setPasteText]=useState('')
  const[preview,setPreview]=useState(null)
  const[parseError,setParseError]=useState('')
  const[importResult,setImportResult]=useState(null)
  const[importError,setImportError]=useState('')
  const[primarySaveError,setPrimarySaveError]=useState('')
  // Creator timezone (IANA). A saved profiles.timezone is the source of
  // truth; the browser zone is only the initial suggestion when none exists.
  // Resolved in the boot effect (client only) to avoid an SSR/hydration mismatch.
  const[timezone,setTimezone]=useState('UTC')
  // True only when the shown zone came from a successful browser detection
  // (not a saved value, not the UTC fallback, not a manual pick).
  const[timezoneDetected,setTimezoneDetected]=useState(false)
  // Badge for a non-detected zone: 'Saved' (from the profile) or 'Selected' (picked here).
  const[timezoneSource,setTimezoneSource]=useState(null)
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
  // null until the user picks on the trial screen; 'trial' | 'free' after.
  const[trialChoice,setTrialChoice]=useState(null)
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
  const stepNum={platforms:1,paste:2,csv:2,loading:2,platformSuccess:2,finalSummary:3,trial:3,freeReady:3,step4:3,done:3}[step]||1
  const showProgress=!['loading'].includes(step)

  useEffect(()=>{
    ;(async()=>{
      const{data:{user}}=await supabase.auth.getUser()
      if(!user){router.replace('/login');return}
      const{data}=await supabase.from('beta_users').select('onboarding_complete').eq('user_id',user.id).single()
      if(data?.onboarding_complete){router.replace('/dashboard');return}
      const{data:profile}=await supabase.from('profiles').select('plan,streaming_platforms,primary_pro_platform,timezone,chaturbate_username').eq('id',user.id).single()
      setUserPlan(profile?.plan==='pro'?'pro':'free')
      // Restore an in-progress platform selection if the user left and came
      // back — matches beta_users.onboarding_complete already gating re-entry.
      // The database stores canonical names ('BongaCams'); onboarding ids are lowercase.
      const saved=(profile?.streaming_platforms||[]).map(id=>String(id).toLowerCase()).filter(id=>PLATFORMS[id])
      if(saved.length){
        const storedPrimary=profile?.primary_pro_platform?String(profile.primary_pro_platform).toLowerCase():null
        const primary=storedPrimary&&saved.includes(storedPrimary)?storedPrimary:saved[0]
        setSavedPlatforms([...new Set([primary,...saved])])
        setSelectedPlatforms([primary])
      }
      if(profile?.chaturbate_username)setCbUsername(String(profile.chaturbate_username))
      setTimezone(resolveCreatorTimeZone(profile?.timezone))
      if(isValidTimeZone(profile?.timezone))setTimezoneSource('Saved')
      setTimezoneDetected(!isValidTimeZone(profile?.timezone)&&isValidTimeZone((()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone}catch{return null}})()))
      setUser(user);setBooting(false)
    })()
  },[router])

  // Fires on every step transition so we can see exactly where a user
  // last was before abandoning onboarding (drop-off = last step_viewed row).
  useEffect(()=>{
    if(!user)return
    track('onboarding_step_viewed',{step,platform:platformId})
  },[step,user])

  // Step 2 detection — runs the real import parser (buildPreview) in place
  // after a short debounce. The paste field never leaves the screen; the
  // status/result slot beneath it moves empty → parsing → success | error.
  useEffect(()=>{
    if(step!=='paste')return
    if(!pasteText.trim()){setDetectStatus('empty');setPreview(null);setParseStage(0);return}
    let t2,t3
    const t1=setTimeout(()=>{
      setDetectStatus('parsing');setParseStage(35)
      t2=setTimeout(()=>{
        const p=buildPreview(pasteText,platformId,platform.label,timezone)
        setParseStage(100)
        t3=setTimeout(()=>{
          if(p&&p.transactionsDetected>0){setPreview(p);setDetectStatus('success');setParseError('')}
          else{
            setPreview(null);setDetectStatus('error')
            if(parseFailTrackedRef.current!==pasteText){parseFailTrackedRef.current=pasteText;track('onboarding_paste_parse_failed',{platform:platformId,source:'auto_detect'})}
          }
        },220)
      },260)
    },350)
    return()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3)}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pasteText,platformId,timezone,step])

  // The page itself never scrolls while onboarding is open — the card is the
  // only (fallback) scroll region.
  useEffect(()=>{
    const html=document.documentElement,body=document.body
    const prev=[html.style.overflow,body.style.overflow]
    html.style.overflow='hidden';body.style.overflow='hidden'
    return()=>{html.style.overflow=prev[0];body.style.overflow=prev[1]}
  },[])

  // Fires exactly once per session when a logged-in user actually lands in
  // onboarding — distinct from onboarding_step_viewed (which fires per-step
  // for drop-off analysis) so funnel tools can mark true entry vs. re-views.
  const onboardingStartedRef=useRef(false)
  useEffect(()=>{
    if(!user||onboardingStartedRef.current)return
    onboardingStartedRef.current=true
    track('onboarding_started',{primary_platform:primaryPlatformId||null})
  },[user])

  // Fires once per transition into the trial screen (not per render). Named
  // pro_preview_viewed rather than a new onboarding-prefixed event so it
  // slots into the same taxonomy as upgrade_click/paywall_hit if a matching
  // dashboard-side event is ever added.
  useEffect(()=>{
    if(!user||step!=='trial')return
    track('pro_preview_viewed',{source:'onboarding',plan:'free',trial_length:7})
    track('onboarding_trial_screen_viewed',{primary_platform:primaryPlatformId,platforms_selected:selectedPlatforms.length})
  },[step,user])

  // onboarding_complete is set only once the user picks Trial or Free on the
  // trial screen (handleStartTrial / handleChooseFree) — not on first import —
  // so someone who leaves mid-flow is routed back into onboarding.
  useEffect(()=>{
    if(!user||step!=='platformSuccess'||queueIndex!==0)return
    track('onboarding_first_insight_viewed',{primary_platform:platformId,has_insight:!!(preview?.bestHour&&preview?.bestHourConfident)})
  },[step,user])

  async function markDone(){
    if(!user)return
    await supabase.from('beta_users').upsert({user_id:user.id,email:user.email,onboarding_complete:true,signed_up_at:user.created_at},{onConflict:'user_id'})
  }

  // ── Primary platform selection (Step 1, single select) ─────────
  function selectPrimary(id){
    if(selectedPlatforms[0]===id&&selectedPlatforms.length===1)return
    setSelectedPlatforms([id])
    track('onboarding_primary_platform_selected',{platform:id})
  }

  function startConnecting(id){
    setPlatformId(id)
    setPasteText('');setPreview(null);setParseError('');setImportError('');setCsvError('');setUpgradeBlocked(null);setHowItWorksOpen(false)
    setStep('paste')
  }

  async function confirmPlatforms(){
    if(!selectedPlatforms.length)return
    if(user){
      setPrimarySaveError('')
      // Chosen primary first, then any secondaries the user already had saved
      // (never dropped, never duplicated). Brand-new users save just [primary].
      const platformsToSave=[...new Set([selectedPlatforms[0],...savedPlatforms])]
      // Browser saves only the platform list; the permanent primary is set only by the server route.
      // One scoped UPDATE (not an upsert): every signed-in user already has a
      // profile row (created by handle_new_user), and browsers hold UPDATE on
      // these columns but not INSERT. maybeSingle() makes a missing row an error.
      const{data:savedRow,error:listErr}=await supabase.from('profiles').update({streaming_platforms:platformsToSave,timezone}).eq('id',user.id).select('id').maybeSingle()
      if(listErr||!savedRow){setPrimarySaveError('We could not save your platforms and timezone. Your choices are kept.');return}
      const res=await fetch('/api/profile/primary-platform',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform:selectedPlatforms[0]})}).catch(()=>null)
      const body=res?await res.json().catch(()=>({})):{}
      const alreadySame=res?.status===409&&String(body?.primary_pro_platform||'').toLowerCase()===selectedPlatforms[0]
      if(!res||(!res.ok&&!alreadySame)){setPrimarySaveError(body?.error||'We could not save your primary platform. Please try again.');return}
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
    const p=buildPreview(pasteText,platformId,platform.label,timezone)
    if(!p||( p.transactionsDetected===0)){
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
    track('onboarding_import_started',{platform:platformId,source:'paste'})
    try{
      const{data:{session}}=await supabase.auth.getSession()
      if(!session)throw new Error('Not logged in')
      // Chaturbate / MyFreeCams: send the raw paste — preview and server share
      // the canonical parser, so private earnings are classified identically
      // and stored through the route's deduplicating paid-session path.
      // BongaCams: send the already-parsed tips as a clean CSV; its paid
      // chats go to /api/upload-paid-sessions below.
      const rawToServer=platformId==='chaturbate'||platformId==='myfreecams'
      const{blob:csvBlob}=rawToServer?{blob:new Blob([pasteText],{type:'text/plain'})}:pasteToCSVBlob(pasteText,platformId)
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
        body:(()=>{const f=new FormData();f.append('file',file);f.append('platform',platform.label);f.append('time_zone',timezone);return f})(),
        signal:controller.signal
      })

      // Upload BongaCams paid chats (deduplicated server-side)
      let paidUploadPromise=Promise.resolve(null)
      if(platformId==='bongacams'&&p?.paidSessionsDetected>0){
        const paidBlob=paidSessionsToCSVBlob(p.paidSessions)
        const paidFile=new File([paidBlob],'paid_sessions_import.csv',{type:'text/csv'})
        const paidForm=new FormData()
        paidForm.append('file',paidFile)
        paidForm.append('platform',platform.label)
        paidUploadPromise=fetch('/api/upload-paid-sessions',{
          method:'POST',
          headers:{Authorization:`Bearer ${session.access_token}`},
          body:paidForm,
          signal:controller.signal
        })
      }

      const[res,paidRes]=await Promise.all([
        tipUploadPromise,
        paidUploadPromise,
        new Promise(r=>setTimeout(r,minWait)),
      ])
      clearTimeout(timeoutId)
      clearInterval(pi);clearInterval(mi);setLoadingProgress(100)
      const json=await readUploadJson(res)
      if(!res.ok||json.error){
        const err=new Error(json.error||'Import failed')
        err.code=json.code;err.upgradeUrl=json.upgradeUrl
        throw err
      }
      // Never report success when any batch (tips or private earnings) failed.
      assertImportComplete(json)
      let paidInserted=json.paidSessionsInserted??0
      if(paidRes){
        const paidJson=await readUploadJson(paidRes)
        if(!paidRes.ok||paidJson.error)throw new Error(paidJson.error||'Private earnings could not be saved. Retry this import — duplicates are skipped safely.')
        assertImportComplete(paidJson)
        paidInserted=paidJson.inserted??0
      }
      const inserted=json.inserted??p?.tipsDetected??0
      setImportResult({inserted,skipped:json.skipped??0,paidInserted})
      setImportedPlatforms(prev=>prev.includes(platformId)?prev:[...prev,platformId])
      track('onboarding_import_completed',{platform:platformId,inserted,skipped:json.skipped??0,source:'paste'})
      if(isFirstImport){track('onboarding_completed',{platform:platformId});setIsFirstImport(false);setShowSparkle(true);setTimeout(()=>setShowSparkle(false),4000)}
      if(queueIndex>0)track('onboarding_secondary_platform_connected',{platform:platformId,platforms_selected:selectedPlatforms.length})
      setPlatformResults(prev=>({...prev,[platformId]:{
        status:'connected',inserted,skipped:json.skipped??0,paidInserted,
        snapshot:p?.snapshot||null,topSpender:p?.topSpender||null,
        bestHour:p?.bestHour||null,bestHourConfident:p?.bestHourConfident||false,
      }}))
      track('onboarding_results_viewed',{platform:platformId,source:'paste'})
      setStep('platformSuccess')
    }catch(e){
      if(e.name==='AbortError')setImportError('Import timed out. Check your connection or try a smaller file.')
      else if(e.code==='platform_limit_reached')setUpgradeBlocked({message:e.message,upgradeUrl:e.upgradeUrl||'/pricing'})
      else setImportError(e.message||'Import failed')
      track('onboarding_import_failed',{platform:platformId,source:'paste',error_category:categorizeImportError(e)})
      setStep('paste')
    }
  }

  function goToTrial(){
    track('onboarding_complete',{platforms:selectedPlatforms,primary:primaryPlatformId})
    setStep('trial')
  }

  async function handleChooseFree(){
    track('onboarding_trial_skipped')
    track('onboarding_free_selected',{primary_platform:primaryPlatformId,platforms_selected:selectedPlatforms.length})
    setTrialChoice('free')
    await markDone()
    setStep('freeReady')
  }

  async function handleStartTrial(){
    if(!user)return
    track('onboarding_trial_started',{primary_platform:primaryPlatformId,platforms_selected:selectedPlatforms.length})
    setTrialChoice('trial')
    // Mark complete before leaving for Stripe: both success_url and
    // cancel_url return to /dashboard.
    await markDone()
    // Reuse the existing upgrade_click taxonomy (already fired from the
    // dashboard's upgrade prompts) rather than a new onboarding-only event.
    track('upgrade_click',{source:'onboarding',placement:'trial',plan:'free'})
    try{
      const{data:{session}}=await supabase.auth.getSession()
      trackCheckoutEvent('started',{source:'onboarding',billing_interval:'monthly'})
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
      trackCheckoutEvent('failed',{source:'onboarding'})
      alert(e.message||'Failed to start trial. Please try again.')
    }
  }

  async function handleCsvUpload(file){
    if(!file||!user)return
    setCsvUploading(true);setCsvError('');setStep('loading');setLoadingProgress(0)
    track('onboarding_import_started',{platform:platformId,source:'csv'})
    try{
      const{data:{session}}=await supabase.auth.getSession()
      if(!session)throw new Error('Not logged in')
      const form=new FormData();form.append('file',file);form.append('platform',platform.label);form.append('time_zone',timezone)
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
      const json=await readUploadJson(res)
      if(!res.ok||json.error)throw new Error(json.error||'Upload failed')
      assertImportComplete(json)
      const inserted=json.inserted??preview?.tipsDetected??0
      setImportResult({inserted,skipped:json.skipped??0})
      setImportedPlatforms(prev=>prev.includes(platformId)?prev:[...prev,platformId])
      track('onboarding_import_completed',{platform:platformId,inserted,skipped:json.skipped??0,source:'csv'})
      if(isFirstImport){track('onboarding_completed',{platform:platformId,source:'csv'});setIsFirstImport(false);setShowSparkle(true);setTimeout(()=>setShowSparkle(false),4000)}
      if(queueIndex>0)track('onboarding_secondary_platform_connected',{platform:platformId,platforms_selected:selectedPlatforms.length})
      setPlatformResults(prev=>({...prev,[platformId]:{
        status:'connected',inserted,skipped:json.skipped??0,
        snapshot:json.onboardingSummary||json.snapshot||null,totalUsd:json.totalUsd,dateFrom:json.dateFrom,dateTo:json.dateTo,source:'csv',
        bestHour:json.onboardingSummary?.bestHour||null,bestHourConfident:!!json.onboardingSummary?.bestHourConfident,
      }}))
      track('onboarding_results_viewed',{platform:platformId,source:'csv'})
      setStep('platformSuccess')
    }catch(e){
      setCsvError(e.name==='AbortError'?'Upload timed out. Try a smaller file or check your connection.':e.message||'Upload failed')
      track('onboarding_import_failed',{platform:platformId,source:'csv',error_category:categorizeImportError(e)})
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
    <main style={{position:'fixed',inset:0,height:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',background:'#070b18',fontFamily:"'Inter',system-ui,sans-serif",color:'#fff',overflow:'hidden'}}>
      <style>{CSS}</style>

      {/* ── BACKGROUND ── */}
      {/* Shared by every onboarding step: neutral dark centre that frames the
          card, teal light on the left, magenta/purple light on the right, and
          a faint irregular star field (several offset tile sizes so it never
          reads as a grid). */}
      <div aria-hidden="true" style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,background:'#05070f'}}>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 34% 70% at -6% 44%,rgba(20,184,206,0.30) 0%,rgba(14,116,144,0.10) 45%,transparent 75%),radial-gradient(ellipse 34% 70% at 106% 54%,rgba(219,39,119,0.28) 0%,rgba(126,34,206,0.12) 45%,transparent 75%),radial-gradient(ellipse 28% 30% at 4% 100%,rgba(37,99,235,0.12) 0%,transparent 70%),radial-gradient(ellipse 28% 30% at 96% 100%,rgba(79,70,229,0.12) 0%,transparent 70%)'}}/>
        <div style={{position:'absolute',left:'-16%',top:'22%',width:480,height:480,borderRadius:'50%',background:'rgba(20,184,206,0.10)',filter:'blur(130px)'}}/>
        <div style={{position:'absolute',right:'-16%',bottom:'14%',width:500,height:500,borderRadius:'50%',background:'rgba(219,39,119,0.10)',filter:'blur(140px)'}}/>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 58% 70% at 50% 50%,rgba(4,6,13,0.96) 0%,rgba(4,6,13,0.7) 55%,transparent 100%)'}}/>
        <div style={{position:'absolute',left:'50%',bottom:'-18%',transform:'translateX(-50%)',width:'60%',height:'42%',borderRadius:'50%',background:'rgba(124,58,237,0.16)',filter:'blur(120px)'}}/>
        {/* Faint neon wave accents along the lower edges */}
        <svg viewBox="0 0 1440 900" preserveAspectRatio="none" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
          <defs>
            <linearGradient id="obWaveL" x1="0" x2="1"><stop offset="0" stopColor="#22d3ee" stopOpacity="0.55"/><stop offset="1" stopColor="#7c3aed" stopOpacity="0"/></linearGradient>
            <linearGradient id="obWaveR" x1="1" x2="0"><stop offset="0" stopColor="#ff2fae" stopOpacity="0.55"/><stop offset="1" stopColor="#7c3aed" stopOpacity="0"/></linearGradient>
            <filter id="obWaveGlow"><feGaussianBlur stdDeviation="3"/></filter>
          </defs>
          <g fill="none" strokeLinecap="round" filter="url(#obWaveGlow)" opacity="0.7">
            <path d="M-40 640 C 160 600, 260 760, 520 900" stroke="url(#obWaveL)" strokeWidth="2.5"/>
            <path d="M-40 700 C 140 670, 240 800, 430 900" stroke="url(#obWaveL)" strokeWidth="1.5" opacity="0.7"/>
            <path d="M1480 600 C 1280 590, 1180 760, 920 900" stroke="url(#obWaveR)" strokeWidth="2.5"/>
            <path d="M1480 670 C 1300 660, 1200 800, 1010 900" stroke="url(#obWaveR)" strokeWidth="1.5" opacity="0.7"/>
          </g>
        </svg>
        <div style={{position:'absolute',inset:0,opacity:0.38,backgroundImage:'radial-gradient(1px 1px at 23px 41px,rgba(255,255,255,0.55),transparent),radial-gradient(1px 1px at 131px 97px,rgba(255,255,255,0.35),transparent),radial-gradient(1.5px 1.5px at 77px 163px,rgba(186,230,253,0.45),transparent),radial-gradient(1px 1px at 189px 19px,rgba(255,255,255,0.3),transparent)',backgroundSize:'211px 197px'}}/>
        <div style={{position:'absolute',inset:0,opacity:0.28,backgroundImage:'radial-gradient(1px 1px at 61px 211px,rgba(251,207,232,0.5),transparent),radial-gradient(1px 1px at 257px 83px,rgba(255,255,255,0.35),transparent),radial-gradient(1.5px 1.5px at 173px 281px,rgba(255,255,255,0.4),transparent)',backgroundSize:'331px 307px'}}/>
      </div>

      <AmbientParticles/>
      <OnboardingExitSurvey currentStep={stepNum} currentStepName={step} minStepToTrigger={1} onResolved={()=>router.push('/')}/>
      {showSparkle&&<Sparkle/>}
      <FeedbackBubble/>

      {/* ── CARD ── */}
      <div className={`ob-card-shell${step==='platforms'||step==='paste'?' ob-card-shell--wide':''}`} style={{position:'relative',zIndex:10,width:'100%',maxWidth:430}}>
        <div className={`ob-card ob-card-inner${step==='platforms'||step==='paste'?' ob-card--step1':''}${dashboardTransitioning?' ob-dash-dissolve':''}`} style={{position:'relative',borderRadius:24,border:'1px solid rgba(34,211,238,0.20)',background:'rgba(7,16,31,0.90)',backdropFilter:'blur(40px)',WebkitBackdropFilter:'blur(40px)',padding:'18px 32px',overflowX:'hidden',overflowY:'auto',boxShadow:'0 30px 100px rgba(0,0,0,0.55),0 0 50px rgba(22,244,255,0.10),0 0 70px rgba(255,43,174,0.08),inset 0 1px 0 rgba(255,255,255,0.08)',animation:dashboardTransitioning?'dashboardDissolve 0.7s ease-out both':'none'}}>
          <div style={{position:'absolute',top:0,left:'8%',right:'8%',height:'1px',background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)',pointerEvents:'none'}}/>
          {/* Decorative glows sit in a clipped layer so their -50px offsets
              don't add empty scrollable space to the card. */}
          <div aria-hidden="true" style={{position:'absolute',inset:0,overflow:'hidden',borderRadius:'inherit',pointerEvents:'none'}}>
            <div style={{position:'absolute',top:-50,left:-50,width:220,height:220,borderRadius:'50%',background:'rgba(33,230,243,0.055)',filter:'blur(40px)',pointerEvents:'none'}}/>
            <div style={{position:'absolute',bottom:-50,right:-50,width:220,height:220,borderRadius:'50%',background:'rgba(255,47,174,0.045)',filter:'blur(40px)',pointerEvents:'none'}}/>
          </div>

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
              {showProgress&&<OBProgress current={stepNum} onBack={step==='paste'?()=>setStep('platforms'):undefined}/>}
            </header>
          )}

          {/* ══ PLATFORMS (single select — primary only) ══ */}
          {step==='platforms'&&(
            <div style={{animation:'fadeUp 0.3s ease both'}}>
              <div className="ob-step1-head" style={{textAlign:'center',marginBottom:18}}>
                <h1 className="ob-step1-title" style={{fontSize:30,fontWeight:900,color:'#F8FAFC',letterSpacing:'-0.03em',lineHeight:1.12,marginBottom:8}}>Let’s get <span style={{background:GRAD,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>started</span></h1>
                <p className="ob-step1-sub" style={{fontSize:14,color:'rgba(166,168,189,0.9)',lineHeight:1.55,maxWidth:400,margin:'0 auto'}}>Choose your primary platform to import your data and get your first insights.</p>
              </div>
              <div className="ob-step1-col">
                  <div className="ob-plat-row" role="radiogroup" aria-label="Primary platform" style={{display:'flex',gap:12,marginBottom:14}}>
                    {STEP1_PLATFORM_ORDER.map(key=>[key,PLATFORMS[key]]).map(([key,p])=>{
                      const sel=selectedPlatforms[0]===key
                      return(
                        <button key={key} className="ob-plat-card" role="radio" aria-checked={sel} onClick={()=>selectPrimary(key)} style={{
                          flex:'1 1 0',minWidth:0,padding:'16px 10px 14px',borderRadius:18,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                          // Selected: cyan → pink gradient border via padding-box/border-box layers.
                          background:sel?'linear-gradient(180deg,rgba(30,16,52,0.96),rgba(12,14,36,0.97)) padding-box,linear-gradient(135deg,#21E6F3,#A855F7 45%,#FF2FAE) border-box':'linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))',
                          border:sel?'2px solid transparent':'1px solid rgba(96,165,250,0.18)',
                          boxShadow:sel?'0 0 0 1px rgba(168,85,247,0.25),-8px 0 26px rgba(33,230,243,0.28),8px 0 32px rgba(255,47,174,0.45),0 12px 30px rgba(124,58,237,0.32),inset 0 1px 0 rgba(255,255,255,0.08)':'inset 0 1px 0 rgba(255,255,255,0.04)',
                          transform:sel?'translateY(-2px)':'none',
                          cursor:'pointer',transition:'all 0.2s ease',position:'relative',
                        }}
                        onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';if(!sel){e.currentTarget.style.borderColor='rgba(33,230,243,0.45)';e.currentTarget.style.background='rgba(33,230,243,0.05)'}}}
                        onMouseLeave={e=>{e.currentTarget.style.transform=sel?'translateY(-2px)':'';if(!sel){e.currentTarget.style.borderColor='rgba(96,165,250,0.18)';e.currentTarget.style.background='rgba(255,255,255,0.03)'}}}
                        >
                          {sel&&<div aria-hidden="true" style={{position:'absolute',top:10,right:10,width:22,height:22,borderRadius:'50%',background:'linear-gradient(135deg,#D946EF,#FF2FAE)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,color:'#fff',boxShadow:'0 0 12px rgba(255,47,174,0.55)'}}>✓</div>}
                          <div className="ob-plat-icon" style={{width:52,height:52,borderRadius:15,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:900,margin:'0 auto 9px',flexShrink:0,overflow:'hidden',...(p.logoSrc?{}:p.iconStyle)}}>
                            {/* Set PLATFORMS[key].logoSrc to an official asset to replace the badge; the fixed 52×52 container keeps all cards identical. */}
                            {p.logoSrc?<img src={p.logoSrc} alt="" style={{width:'78%',height:'78%',objectFit:'contain'}}/>:p.short}
                          </div>
                          <div className="ob-plat-name" style={{fontSize:15,fontWeight:800,color:sel?'#fff':'rgba(226,232,240,0.78)'}}>{p.label}</div>
                        </button>
                      )
                    })}
                  </div>

                  <OBTimezone value={timezone} detected={timezoneDetected} status={timezoneDetected?null:timezoneSource} onChange={tz=>{setTimezone(tz);setTimezoneDetected(false);setTimezoneSource('Selected');setPrimarySaveError('');track('onboarding_timezone_changed',{timezone:tz})}}/>

                  <div style={{height:14}}/>

                  {primarySaveError&&<div role="alert" data-testid="primary-save-error" style={{color:'#F87171',fontSize:13,marginBottom:10,textAlign:'center'}}>{primarySaveError} Tap Continue to retry.</div>}
                  <OBBtn onClick={confirmPlatforms} disabled={!primaryPlatformId} style={primaryPlatformId?{height:58,fontSize:16,borderRadius:16}:{height:58,fontSize:16,borderRadius:16,color:'rgba(226,232,240,0.6)',border:'1px solid rgba(255,255,255,0.10)'}}>
                    {primaryPlatformId?`Continue with ${PLATFORMS[primaryPlatformId].label} →`:'Choose a platform'}
                  </OBBtn>
                  <div style={{marginTop:12,textAlign:'center',fontSize:12.5,color:'rgba(203,213,225,0.8)'}}><span aria-hidden="true" style={{marginRight:5}}>⚡</span>You can add more platforms later.</div>
              </div>
            </div>
          )}

          {/* ══ PASTE ══ */}
          {step==='paste'&&(()=>{
            const ok=detectStatus==='success'&&preview
            const helpLink=platformId==='chaturbate'
              ?(cbUsername?{href:platform.earningsUrl(cbUsername),label:'Open your Chaturbate token stats ↗'}:null)
              :{href:platform.earningsUrl(),label:platformId==='bongacams'?'Open BongaCams reports ↗':'Open MyFreeCams token sessions ↗'}
            // Headline count: "tips" only when every row is a tip; otherwise
            // "transactions" so private shows / memberships are never called tips.
            const onlyTips=ok&&preview.privateDetected===0&&preview.membershipsDetected===0&&preview.otherDetected===0
            const count=ok?(onlyTips?preview.tipsDetected:preview.transactionsDetected):0
            const range=ok&&preview.dateFrom&&preview.dateTo?(preview.dateFrom===preview.dateTo?preview.dateTo:preview.dateFrom.slice(-4)===preview.dateTo.slice(-4)?`${preview.dateFrom.replace(/, \d{4}$/,'')} – ${preview.dateTo}`:`${preview.dateFrom} – ${preview.dateTo}`):'—'
            // Reserve the success card's height so parsing → success/error never jumps.
            const slot={minHeight:129,borderRadius:14,marginTop:10,textAlign:'left'}
            const col=(k,label,value,sub,color='#F1F5F9',first=false)=>(
              <div key={k} data-testid={`detected-${k}`} style={{minWidth:0,padding:first?'0 14px 0 0':'0 14px',borderLeft:first?'none':'1px solid rgba(148,163,184,0.16)'}}>
                <div style={{fontSize:11.5,color:'rgba(148,163,184,0.8)',marginBottom:3}}>{label}</div>
                <div className="ob-det-val" style={{fontSize:15,fontWeight:800,color,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{value}</div>
                {sub&&<div style={{fontSize:11,color:'rgba(148,163,184,0.75)',marginTop:2}}>{sub}</div>}
              </div>
            )
            return(
            <div className="ob-s2" style={{animation:'fadeUp 0.3s ease both',maxWidth:600,margin:'0 auto'}}>
              <div style={{textAlign:'center',marginBottom:10}}>
                <h1 className="ob-s2-title" style={{fontSize:28,fontWeight:900,color:'#F8FAFC',letterSpacing:'-0.03em',lineHeight:1.15,marginBottom:6}}>{isPrimaryInQueue?<>Paste your {platform.label} <span style={{background:'linear-gradient(90deg,#22d3ee,#a855f7,#ff2fae)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>tip history</span></>:`You also stream on ${platform.label}`}</h1>
                <p style={{fontSize:13.5,color:'rgba(166,168,189,0.9)',lineHeight:1.45}}>Copy your earnings rows from {platform.label} and paste them below.</p>
              </div>

              <div style={{position:'relative'}}>
              <textarea ref={pasteRef} aria-label={`Paste your ${platform.label} tip history`} value={pasteText}
                onChange={e=>setPasteText(e.target.value)} placeholder={`Paste your ${platform.label} tip history here…`}
                className="ob-paste" spellCheck={false}
                style={{display:'block',width:'100%',height:125,minHeight:125,maxHeight:125,resize:'none',borderRadius:14,border:`1px solid ${detectStatus==='error'?'rgba(248,113,113,0.5)':'rgba(34,211,238,0.28)'}`,background:'rgba(4,10,24,0.85)',padding:'12px 14px',fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace',fontSize:12,lineHeight:1.5,color:'#E2E8F0',outline:'none',transition:'border-color 0.18s,box-shadow 0.18s'}}
                onFocus={e=>{e.target.style.borderColor='rgba(34,211,238,0.6)';e.target.style.boxShadow='0 0 0 3px rgba(34,211,238,0.08)'}}
                onBlur={e=>{e.target.style.borderColor=detectStatus==='error'?'rgba(248,113,113,0.5)':'rgba(34,211,238,0.28)';e.target.style.boxShadow='none'}}
              />
              {!pasteText&&(
                <div aria-hidden="true" style={{position:'absolute',left:15,right:14,top:36,pointerEvents:'none',fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace',fontSize:11.5,lineHeight:1.6,color:'rgba(148,163,184,0.42)',whiteSpace:'pre-line'}}>
                  {`e.g.  Jun 18, 2026, 8:27 PM  ·  Tip From: fan_name  ·  500 tokens`}
                </div>
              )}
              </div>

              {/* Status / result slot — in place, directly beneath the paste field */}
              {(importError||upgradeBlocked)?(
                <div role="alert" style={{...slot,padding:'14px 16px',border:'1px solid rgba(248,113,113,0.4)',background:'rgba(248,113,113,0.06)'}}>
                  {upgradeBlocked?(<>
                    <div style={{fontSize:13.5,fontWeight:800,color:'#c4b5fd',marginBottom:4}}>🔒 Upgrade to add {platform.label}</div>
                    <div style={{fontSize:12,color:'rgba(203,213,225,0.85)',lineHeight:1.5,marginBottom:8}}>{upgradeBlocked.message}</div>
                    <button onClick={()=>window.open('https://www.camcashgrl.com/pricing','_blank')} style={{padding:'7px 14px',borderRadius:9,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#a78bfa,#7c3aed)',color:'#fff',fontSize:12,fontWeight:700}}>See plans</button>
                  </>):(<>
                    <div style={{fontSize:13.5,fontWeight:800,color:'#FCA5A5',marginBottom:4}}>Import didn’t finish</div>
                    <div style={{fontSize:12,color:'rgba(203,213,225,0.85)',lineHeight:1.5}}>{importError} Your pasted data is still here — press Continue to try again.</div>
                  </>)}
                </div>
              ):detectStatus==='parsing'?(
                <div data-testid="detect-parsing" style={{...slot,display:'flex',alignItems:'center',gap:14,padding:'0 18px',border:'1px solid rgba(124,92,255,0.45)',background:'linear-gradient(90deg,rgba(34,211,238,0.06),rgba(168,85,247,0.08))'}}>
                  <span aria-hidden="true" style={{width:30,height:30,flexShrink:0,borderRadius:'50%',border:'3px solid rgba(34,211,238,0.18)',borderTopColor:'#22d3ee',borderRightColor:'#a855f7',animation:'spin 0.9s linear infinite'}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:800,color:'#F8FAFC'}}>Analyzing your history…</div>
                    <div style={{fontSize:12,color:'rgba(148,163,184,0.85)',margin:'2px 0 8px'}}>Reading transactions and detecting earnings…</div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{flex:1,height:6,borderRadius:6,background:'rgba(255,255,255,0.07)',overflow:'hidden'}}><div style={{width:`${parseStage}%`,height:'100%',borderRadius:6,background:'linear-gradient(90deg,#22d3ee,#a855f7,#ff2fae)',transition:'width 0.25s ease'}}/></div>
                      <span style={{fontSize:11.5,color:'rgba(203,213,225,0.85)',minWidth:30,textAlign:'right'}}>{parseStage}%</span>
                    </div>
                  </div>
                </div>
              ):ok?(
                <div data-testid="detected-summary" style={{...slot,padding:'12px 18px 14px',border:'1.5px solid transparent',background:'linear-gradient(90deg,rgba(7,16,31,0.92),rgba(30,16,52,0.75)) padding-box,linear-gradient(90deg,rgba(34,211,238,0.85),rgba(34,211,238,0.7) 60%,rgba(255,47,174,0.75)) border-box',boxShadow:'0 0 20px rgba(34,211,238,0.10),12px 0 26px rgba(255,47,174,0.08)'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:9,minWidth:0}}>
                      <span aria-hidden="true" style={{width:22,height:22,flexShrink:0,borderRadius:'50%',background:'#22d3ee',color:'#04101b',fontSize:12,fontWeight:900,display:'inline-flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 10px rgba(34,211,238,0.5)'}}>✓</span>
                      <span className="ob-det-title" style={{fontSize:15.5,fontWeight:800,color:'#F8FAFC'}}><span data-testid="detected-count">{count.toLocaleString('en-US')}</span> <span style={{color:'#22d3ee'}}>{onlyTips?'tips':'transactions'} detected!</span></span>
                    </div>
                    <button type="button" onClick={()=>{const el=pasteRef.current;if(el){el.focus();el.setSelectionRange?.(el.value.length,el.value.length);el.scrollTop=el.scrollHeight}}} style={{flexShrink:0,padding:'5px 12px',borderRadius:9,border:'1px solid rgba(148,163,184,0.45)',background:'rgba(255,255,255,0.03)',color:'#F1F5F9',fontSize:12,fontWeight:700,cursor:'pointer'}}>Edit data</button>
                  </div>
                  <div className="ob-det-grid" style={{display:'grid',gridTemplateColumns:'1fr 1.5fr 1fr'}}>
                    {col('platform','Platform',platform.label,null,'#F1F5F9',true)}
                    {col('range','Date range',range,preview.calendarDays?`${preview.calendarDays.toLocaleString('en-US')} calendar day${preview.calendarDays===1?'':'s'}`:null,'#93C5FD')}
                    {col('total','Earnings detected',`$${preview.estimatedEarnings.toFixed(2)}`,null,'#4ade80')}
                  </div>
                </div>
              ):detectStatus==='error'?(
                <div role="alert" data-testid="detect-invalid" style={{...slot,display:'flex',gap:12,padding:'12px 16px',border:'1px solid rgba(248,113,113,0.55)',background:'rgba(127,29,29,0.14)'}}>
                  <span aria-hidden="true" style={{width:22,height:22,flexShrink:0,borderRadius:'50%',background:'rgba(248,113,113,0.9)',color:'#1f0a0a',fontSize:12,fontWeight:900,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>!</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13.5,fontWeight:800,color:'#FCA5A5',marginBottom:3}}>We couldn’t detect a valid {platform.label} earnings history.</div>
                    <div style={{fontSize:12,color:'rgba(203,213,225,0.82)',lineHeight:1.45,marginBottom:8}}>Please make sure you’ve copied the full tip history from {platform.label}, or try uploading a CSV file instead.</div>
                    <button type="button" onClick={()=>setStep('csv')} style={{padding:'6px 14px',borderRadius:9,border:'1px solid rgba(34,211,238,0.5)',background:'rgba(34,211,238,0.06)',color:'#E0F7FF',fontSize:12,fontWeight:700,cursor:'pointer'}}>⇪ Upload CSV instead</button>
                  </div>
                </div>
              ):null}

              <div style={{marginTop:10}}>
                <OBBtn onClick={handlePreview} disabled={!ok} style={ok?{height:54,fontSize:15.5,borderRadius:13}:{height:54,fontSize:15.5,borderRadius:13,background:'linear-gradient(90deg,rgba(34,211,238,0.14),rgba(168,85,247,0.14),rgba(255,47,174,0.14))',color:'rgba(226,232,240,0.5)',border:'1px solid rgba(34,211,238,0.16)',cursor:'not-allowed'}}>Continue →</OBBtn>
              </div>

              <div style={{position:'relative',display:'flex',justifyContent:'center',gap:18,marginTop:10,flexWrap:'wrap',fontSize:12}}>
                {pasteHelpOpen&&(
                  <div data-testid="paste-help" role="dialog" aria-label="How to copy your history" style={{position:'absolute',bottom:'calc(100% + 8px)',left:'50%',transform:'translateX(-50%)',width:'min(440px,100%)',zIndex:20,padding:'12px 14px',borderRadius:13,border:'1px solid rgba(34,211,238,0.28)',background:'#0b1428',boxShadow:'0 18px 40px rgba(0,0,0,0.5)',textAlign:'left'}}>
                    <div style={{fontSize:12.5,fontWeight:800,color:'#F1F5F9',marginBottom:4}}>How to copy from {platform.label}</div>
                    <div style={{fontSize:12,color:'rgba(203,213,225,0.82)',lineHeight:1.5}}>{platform.instructions}{platformId==='chaturbate'&&!cbUsername?' You’ll find Token Stats on your broadcaster profile page.':''}{platformId==='bongacams'?' You can paste your Free Chat and Paid Chat sections together.':''}</div>
                    {helpLink&&<a href={helpLink.href} target="_blank" rel="noreferrer" style={{display:'inline-block',marginTop:6,fontSize:12,fontWeight:700,color:'#22d3ee',textDecoration:'none'}}>{helpLink.label}</a>}
                  </div>
                )}
                <button type="button" onClick={()=>setPasteHelpOpen(o=>!o)} style={{background:'none',border:'none',padding:0,color:'rgba(203,213,225,0.8)',cursor:'pointer'}}>{pasteHelpOpen?'Hide copy instructions':'Need help copying your history?'}</button>
                <button type="button" onClick={()=>setStep('csv')} style={{padding:'4px 12px',borderRadius:9,border:'1px solid rgba(34,211,238,0.42)',background:'rgba(34,211,238,0.06)',color:'#E0F7FF',fontWeight:700,cursor:'pointer'}}>⇪ Upload CSV instead</button>
                {!isPrimaryInQueue&&<button type="button" onClick={skipCurrentPlatform} style={{background:'none',border:'none',padding:0,color:'rgba(148,163,184,0.85)',cursor:'pointer'}}>Skip for now</button>}
              </div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,marginTop:8,fontSize:11,color:'rgba(148,163,184,0.7)'}}><span aria-hidden="true">🔒</span><span>Your data is stored securely and never shared.</span></div>
            </div>
          )})()}

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
              <div style={{textAlign:'center',fontSize:11,color:'rgba(100,116,139,0.5)'}}>Your results are almost ready.</div>
            </div>
          )}

          {/* ══ PLATFORM SUCCESS (primary or secondary) ══ */}
          {step==='platformSuccess'&&currentResult&&(()=>{
            const snap=currentResult.snapshot
            const full=snap?.full
            const recent=snap?.recent
            return(
            <div style={{animation:'fadeUp 0.35s ease both',textAlign:'center'}}>
              <div style={{width:44,height:44,borderRadius:16,background:GRAD,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,color:'#fff',margin:'0 auto 10px',boxShadow:'0 0 40px rgba(33,230,243,0.35),0 0 70px rgba(255,47,174,0.2)'}}>✓</div>
              <div style={EYE}>{isPrimaryInQueue?'Primary Platform':'Secondary Platform'}</div>
              <h1 style={{fontSize:20,fontWeight:900,color:'#fff',marginBottom:6}}>{isPrimaryInQueue?`Your ${platform.label} data is ready`:`${platform.label} data connected`}</h1>
              {full&&full.days>0&&(
                <p style={{fontSize:12,color:'rgba(148,163,184,0.75)',marginBottom:12}}>{fmtDate(full.from)} — {fmtDate(full.to)} · {full.days} day{full.days===1?'':'s'} of data imported</p>
              )}

              {/* Real imported categories only (lib/onboardingSummary.js). Private
                  earnings and memberships are shown separately and never
                  counted as tips; Total earnings includes all three. */}
              {(()=>{
                const cat=full?.categories
                const cards=[
                  {k:'earnings',label:'Total earnings',value:`$${(full?.usd??currentResult.totalUsd??0).toFixed(2)}`,color:CYAN},
                  {k:'tips',label:'Regular tips',value:(cat?cat.tips.count:(full?.tips??currentResult.inserted??0)).toLocaleString('en-US'),sub:cat?`$${cat.tips.usd.toFixed(2)}`:null,color:'#4ade80'},
                  ...(cat&&cat.private.count>0?[{k:'private',label:'Private earnings',value:`$${cat.private.usd.toFixed(2)}`,sub:`${cat.private.count.toLocaleString('en-US')} private ${cat.private.count===1?'session':'sessions'}`,color:PINK}]:[]),
                  ...(cat&&cat.memberships.count>0?[{k:'memberships',label:'Memberships',value:`$${cat.memberships.usd.toFixed(2)}`,sub:`${cat.memberships.count.toLocaleString('en-US')} ${cat.memberships.count===1?'membership':'memberships'}`,color:'#a78bfa'}]:[]),
                ]
                return(
                  <div data-testid="first-insight-stats" style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(cards.length,4)},1fr)`,gap:9,marginBottom:12}}>
                    {cards.map(c=>(
                      <div key={c.k} data-testid={`stat-${c.k}`} className="stat-card" style={{padding:'12px 10px'}}>
                        <div style={{fontSize:9,color:'rgba(148,163,184,0.6)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:700}}>{c.label}</div>
                        <div style={{fontSize:18,fontWeight:900,color:c.color}}>{c.value}</div>
                        {c.sub&&<div style={{fontSize:10.5,color:'rgba(148,163,184,0.7)',marginTop:2}}>{c.sub}</div>}
                      </div>
                    ))}
                  </div>
                )
              })()}

              <div style={{borderRadius:14,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.03)',padding:'12px 14px',marginBottom:12,textAlign:'left'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                  <div style={{fontSize:10,fontWeight:900,color:'rgba(33,230,243,0.9)',textTransform:'uppercase',letterSpacing:'0.1em'}}>Your first snapshot</div>
                  <button onClick={()=>setHowItWorksOpen(v=>{const next=!v;if(next)track('onboarding_how_it_works_opened',{platform:platformId});return next})} style={{background:'none',border:'none',color:'rgba(148,163,184,0.6)',fontSize:10,cursor:'pointer',padding:0}}>ⓘ How this works</button>
                </div>
                {howItWorksOpen&&(
                  <div style={{borderRadius:11,background:'rgba(33,230,243,0.06)',border:'1px solid rgba(33,230,243,0.18)',padding:'10px 12px',marginBottom:10,fontSize:11,color:'rgba(203,213,225,0.85)',lineHeight:1.6}}>
                    CamCash keeps your imported history so your insights can get smarter as you add more data. Your Free dashboard focuses on your most recent 31 days so you can quickly see what's happening now. Older imported history is preserved where available and can power deeper trends as you unlock more of CamCash.
                  </div>
                )}
                {/* First insight — reuses buildPreview's existing bestHour /
                    bestHourConfident (≥2 distinct days) for the platform just
                    imported. preview is reset per platform in startConnecting
                    and is null for CSV imports, so nothing is shown unless the
                    data for THIS platform supports it. No new metric logic. */}
                {full&&full.days>0&&(
                  <div style={{fontSize:12,fontWeight:700,color:'#fff',marginBottom:6}}>You imported {full.days} day{full.days===1?'':'s'} of streaming history.</div>
                )}
                {currentResult.bestHour&&currentResult.bestHourConfident?(
                  <div style={{fontSize:12,color:'rgba(203,213,225,0.88)',lineHeight:1.55}}>⚡ Your biggest tips land around <strong style={{color:PINK}}>{currentResult.bestHour}</strong>, across more than one day of streaming.</div>
                ):(
                  <div style={{fontSize:11.5,color:'rgba(148,163,184,0.78)',lineHeight:1.55}}>We need a little more history to identify your strongest earning patterns. Keep using Live Mode or import more history.</div>
                )}
                {/* Only surface the Free 31-day window figures when they
                    actually differ from the full-import totals above. */}
                {recent&&!recent.isPartial&&full&&full.days>FREE_ANALYSIS_WINDOW_DAYS&&(
                  <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid rgba(255,255,255,0.06)',fontSize:11,color:'rgba(148,163,184,0.75)'}}>Free dashboard view (most recent {FREE_ANALYSIS_WINDOW_DAYS} days): <span style={{color:CYAN,fontWeight:700}}>${(recent.usd||0).toFixed(2)}</span> · <span style={{color:'#4ade80',fontWeight:700}}>{recent.tips||0} tips</span></div>
                )}
              </div>

              {!isPrimaryInQueue&&(
                <div style={{borderRadius:13,border:'1px solid rgba(124,92,255,0.22)',background:'rgba(124,92,255,0.06)',padding:'12px 14px',marginBottom:16,textAlign:'left'}}>
                  <div style={{fontSize:10,fontWeight:900,color:'#a78bfa',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>CamCash found more</div>
                  {['Cross-platform comparison','Deeper earnings patterns','Longer-term trends'].map(t=>(<div key={t} style={{fontSize:11,color:'rgba(203,213,225,0.75)',marginBottom:5}}>🔒 {t}</div>))}
                  <a href="/pricing" style={{fontSize:11,fontWeight:700,color:'#a78bfa',textDecoration:'none'}}>Unlock deeper insights →</a>
                </div>
              )}

              {/* Primary import → straight to the trial offer. Secondary
                  platforms stay saved in profiles.streaming_platforms and are
                  offered again after the Trial/Free choice. */}
              {trialChoice===null?(
                <>
                  <OBBtn onClick={goToTrial}>Continue →</OBBtn>
                  {nextUnhandledId&&<OBLinks links={[{label:`Connect ${PLATFORMS[nextUnhandledId].label} later`,onClick:goToTrial}]}/>}
                </>
              ):(
                <>
                  <OBBtn onClick={enterDashboard}>Enter CamCash →</OBBtn>
                  {nextUnhandledId&&<OBLinks links={[{label:`Connect ${PLATFORMS[nextUnhandledId].label}`,onClick:()=>{setQueueIndex(selectedPlatforms.indexOf(nextUnhandledId));startConnecting(nextUnhandledId)}}]}/>}
                </>
              )}
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
          {step==='trial'&&(()=>{
            const tipsAnalyzed=Object.values(platformResults).reduce((n,r)=>n+(r?.status==='connected'?(r.inserted||0):0),0)
            const hasInsight=!!(preview?.bestHour&&preview?.bestHourConfident)
            return(
            <div style={{animation:'fadeUp 0.3s ease both',textAlign:'center'}}>
              <div style={EYE}>Step 3 of 3</div>
              <div style={{width:44,height:44,borderRadius:14,background:GRAD,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,margin:'0 auto 10px',boxShadow:'0 0 28px rgba(124,92,255,0.45),0 0 50px rgba(255,47,174,0.2)'}}>👑</div>
              <h1 style={{fontSize:'clamp(19px,2.8dvh,23px)',fontWeight:900,color:'#fff',marginBottom:6,letterSpacing:'-0.02em',lineHeight:1.2}}>{TRIAL_COPY.headline}</h1>
              <p className="ob-gap" style={{fontSize:13,color:'rgba(166,168,189,0.85)',lineHeight:1.5,maxWidth:440,margin:'0 auto'}}>{TRIAL_COPY.sub}</p>
              {/* Proof line — only real counts from this session's imports. */}
              {(tipsAnalyzed>0||hasInsight)&&(
                <div className="ob-gap" style={{display:'inline-flex',alignItems:'center',gap:8,padding:'7px 16px',borderRadius:10,border:'1px solid rgba(124,92,255,0.35)',background:'rgba(124,92,255,0.08)',fontSize:12,color:'rgba(226,232,240,0.9)'}}>
                  <span style={{fontSize:14}}>📊</span>
                  {tipsAnalyzed>0?<span>CamCash already analyzed <strong style={{color:CYAN}}>{tipsAnalyzed} tip{tipsAnalyzed===1?'':'s'}</strong> from your first import.</span>:<span>Your first earning pattern is ready.</span>}
                </div>
              )}
              <div className="ob-gap" style={{borderRadius:14,background:'rgba(33,230,243,0.035)',border:'1px solid rgba(33,230,243,0.2)',padding:'12px 18px',textAlign:'left'}}>
                <div style={{fontSize:9.5,fontWeight:900,letterSpacing:'0.16em',textTransform:'uppercase',color:CYAN,marginBottom:8}}>With CamCash Pro</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:'6px 16px'}}>
                  {TRIAL_COPY.benefits.map(t=>(<div key={t} style={{display:'flex',alignItems:'flex-start',gap:9,fontSize:12.5,color:'rgba(226,232,240,0.92)'}}><span style={{flexShrink:0,width:17,height:17,borderRadius:'50%',background:CYAN,color:'#04101b',fontSize:10,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center'}}>✓</span>{t}</div>))}
                </div>
              </div>
              {/* Price matches /pricing (Standard monthly, plan_type standard_monthly). */}
              <div className="ob-gap" style={{borderRadius:14,border:'1px solid rgba(167,139,250,0.45)',background:'rgba(255,255,255,0.02)',padding:'10px 14px',boxShadow:'0 0 18px rgba(124,92,255,0.12)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:14,flexWrap:'wrap'}}>
                  <span style={{fontSize:26,fontWeight:900,color:'#fff'}}><span style={{color:CYAN,fontSize:32}}>$0</span> today</span>
                  <span style={{width:1,height:28,background:'rgba(255,255,255,0.15)'}}/>
                  <span style={{fontSize:26,fontWeight:900,background:GRAD,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>7 days free</span>
                </div>
                <div style={{fontSize:11,color:'rgba(148,163,184,0.75)',marginTop:2}}>Then $9.99/month • Cancel anytime before your trial ends.</div>
              </div>
              <OBBtn onClick={handleStartTrial} style={{height:52,fontSize:15}}>{TRIAL_COPY.cta}</OBBtn>
              <div style={{display:'flex',alignItems:'center',gap:12,maxWidth:300,margin:'10px auto 4px'}}>
                <span style={{flex:1,height:1,background:'rgba(255,255,255,0.1)'}}/><span style={{fontSize:10,color:'rgba(148,163,184,0.6)'}}>or</span><span style={{flex:1,height:1,background:'rgba(255,255,255,0.1)'}}/>
              </div>
              <button onClick={handleChooseFree} style={{background:'none',border:'none',color:'rgba(203,213,225,0.8)',fontSize:12.5,fontWeight:700,cursor:'pointer',padding:'4px 8px'}}>Continue with Free</button>
            </div>
          )})()}

          {/* ══ FREE READY ══ */}
          {step==='freeReady'&&(
            <div style={{animation:'fadeUp 0.3s ease both',textAlign:'center'}}>
              <h1 style={{fontSize:22,fontWeight:900,color:'#fff',marginBottom:6}}>You're ready to use CamCash Free.</h1>
              <p className="ob-gap" style={{fontSize:13,color:'rgba(166,168,189,0.85)',lineHeight:1.55,maxWidth:400,margin:'0 auto'}}>You can upgrade whenever you want deeper history, cross-platform analytics and advanced insights.</p>
              <OBBtn onClick={enterDashboard}>Enter CamCash →</OBBtn>
              {nextUnhandledId&&<OBLinks links={[{label:`Connect ${PLATFORMS[nextUnhandledId].label}`,onClick:()=>{setQueueIndex(selectedPlatforms.indexOf(nextUnhandledId));startConnecting(nextUnhandledId)}}]}/>}
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

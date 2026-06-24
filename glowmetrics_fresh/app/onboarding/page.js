'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hlsdlaibnayzbfflxclj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc2RsYWlibmF5emJmZmx4Y2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjQwODUsImV4cCI6MjA4OTIwMDA4NX0.5FwPe35UL-o46FvBJX526La5o7jcbFaP1KVoLtI4U_M',
  { auth: { autoRefreshToken:true, persistSession:true, detectSessionInUrl:true } }
)

// ── Platform config ────────────────────────────────────────────
const PLATFORMS = {
  chaturbate: {
    label:'Chaturbate', short:'CB',
    iconStyle:{ background:'#F05A2A', color:'#fff', boxShadow:'0 0 28px rgba(240,90,42,0.25)' },
    instructions:'Go to your profile → Token Stats tab. Select All Time. Highlight the table, copy, and paste below.',
    earningsUrl:(u)=> u ? `https://chaturbate.com/p/${u}/?tab=tokens` : 'https://chaturbate.com/accounts/settings/',
    placeholder:'Paste your Chaturbate tip history here...\n\nExample:\n06/18/2026 14:32    username123    500    25.00\n06/18/2026 15:14    whaleKing99    1000   50.00\n06/18/2026 15:45    regularFan     25     1.25',
  },
  bongacams: {
    label:'BongaCams', short:'BC',
    iconStyle:{ background:'#311222', color:'#FF3B6E', border:'1px solid rgba(255,59,110,0.25)', boxShadow:'0 0 28px rgba(255,43,170,0.16)' },
    instructions:'Go to Reports → General. Select your date range. Highlight all rows, copy, and paste below.',
    earningsUrl:()=>'https://bongamodels.com/reports/general',
    placeholder:'Paste your BongaCams tip history here...\n\nExample:\n18.06.2026 14:32    username123    500    25.00\n18.06.2026 15:14    whaleKing99    1000   50.00\n18.06.2026 15:45    regularFan     25     1.25',
  },
  myfreecams: {
    label:'MyFreeCams', short:'MFC',
    iconStyle:{ background:'#2D2226', color:'#FF8B2C', border:'1px solid rgba(255,139,44,0.25)', boxShadow:'0 0 28px rgba(255,139,44,0.15)' },
    instructions:'Go to Token Sessions. Set your date range, highlight all rows, copy and paste below.',
    earningsUrl:()=>'https://profiles.myfreecams.com/_/ext/token_sessions',
    placeholder:'Paste your MyFreeCams tip history here...\n\nExample:\nJun 18 2:32 PM    username123    500    25.00\nJun 18 3:14 PM    whaleKing99    1000   50.00\nJun 18 3:45 PM    regularFan     25     1.25',
  },
}

const TOKEN_RATES = { chaturbate:0.05, bongacams:0.04, myfreecams:0.05 }

const LOADING_MESSAGES = [
  'Cleaning your tip history…',
  'Finding your top fans…',
  'Calculating your average earnings per hour…',
  'Detecting your best stream windows…',
  'Building your dashboard…',
]

const EXTRA_MSGS = ['Importing additional tip history…','Merging with your dashboard…','Updating your insights…']

// ── Paste parser ───────────────────────────────────────────────
function tryParseDate(str) {
  if (!str) return null;
  const s = str.trim();

  // Chaturbate: "Jun 14, 2026, 8:27 PM"
  const cbMatch = s.match(
    /^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i
  );
  if (cbMatch) {
    const [, mon, day, year, hr, min, ampm] = cbMatch;
    const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,
                    jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    let h = parseInt(hr, 10);
    if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    const d = new Date(parseInt(year), months[mon.toLowerCase()],
                       parseInt(day), h, parseInt(min));
    if (!isNaN(d.getTime())) return d;
  }

  // BongaCams: "14.06.2026 14:43"
  const bcMatch = s.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
  if (bcMatch) {
    const [, day, mon, year, hr, min] = bcMatch;
    const d = new Date(parseInt(year), parseInt(mon) - 1,
                       parseInt(day), parseInt(hr), parseInt(min));
    if (!isNaN(d.getTime())) return d;
  }

  // MFC: "Jan 31st, 2024 10:40 PM"
  const mfcMatch = s.match(
    /^([A-Za-z]{3})\s+(\d{1,2})(?:st|nd|rd|th),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i
  );
  if (mfcMatch) {
    const [, mon, day, year, hr, min, ampm] = mfcMatch;
    const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,
                    jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    let h = parseInt(hr, 10);
    if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    const d = new Date(parseInt(year), months[mon.toLowerCase()],
                       parseInt(day), h, parseInt(min));
    if (!isNaN(d.getTime())) return d;
  }

  // Generic fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function parseRows(rawText, platformId){
  const rate = TOKEN_RATES[platformId] || 0.05
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
  const rows = []
  let skipped = 0

  // Detect Chaturbate multi-line format:
  // Line 1: date
  // Line 2: "Tip From: username" or other action
  // Line 3: optional note text
  // Line 4: "tokens  balance" (two numbers separated by whitespace)
  const dateLineRe = /^([A-Za-z]{3}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}\s+[AP]M)/i
  const tipFromRe = /^Tip From:\s*(.+)/i
  const tokensLineRe = /^(\d+)\s+(\d+)$/

  // Check if this looks like multi-line Chaturbate format
  const isMultiLine = lines.some(l => tipFromRe.test(l))

  if(isMultiLine){
    let i = 0
    while(i < lines.length){
      const dateMatch = lines[i].match(dateLineRe)
      if(dateMatch){
        const ts = tryParseDate(dateMatch[1])
        const actionLine = lines[i+1] || ''
        const tipMatch = actionLine.match(tipFromRe)

        if(ts && tipMatch){
          const username = tipMatch[1].trim()
          // Next line is either tokens or a note
          let tokensLine = lines[i+2] || ''
          let note = ''
          let tMatch = tokensLine.match(tokensLineRe)

          // If not tokens, it's a note — tokens are on the line after
          if(!tMatch && lines[i+3]){
            note = tokensLine
            tokensLine = lines[i+3] || ''
            tMatch = tokensLine.match(tokensLineRe)
          }

          if(tMatch){
            const tokens = parseInt(tMatch[1], 10)
            if(tokens >= 1){
              const usd = +(tokens * rate).toFixed(2)
              rows.push({ ts, username, tokens, usd, note })
            } else { skipped++ }
          } else { skipped++ }
        }
        // Skip outbound/transfer/purchase lines
        i++
      } else {
        i++
      }
    }
    return { rows, skipped }
  }

  // Original single-line CSV/TSV parser (kept for BongaCams/MFC CSV uploads)
  const headerKw = [
    'date','time','user','token','usd','tip','amount','note',
    'message','from','type','stamp','earning','reference',
    'private','voyeur','group','xfer','returned','fines',
    'total','mfc','away','club','display','sort','period',
    'payment','month','search'
  ]
  for(const line of lines){
    const cols = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g,''))
    if(cols.length < 2){ skipped++; continue }
    const lower = cols.map(c => c.toLowerCase())
    if(lower.filter(c => headerKw.some(k => c.includes(k))).length >= 2) continue
    let ts = null, tsIdx = -1
    for(let i = 0; i < cols.length; i++){ const d = tryParseDate(cols[i]); if(d){ ts = d; tsIdx = i; break } }
    if(!ts){ skipped++; continue }
    const rest = cols.filter((_,i) => i !== tsIdx)
    let tokens = null, usd = null, username = null, note = ''
    for(const col of rest){
      const n = parseFloat(col.replace(/[$,]/g,''))
      if(!isNaN(n) && n > 0){
        if(Number.isInteger(n) && n >= 1 && n < 100000 && tokens === null) tokens = n
        else if(!Number.isInteger(n) && n < 5000 && usd === null) usd = n
        else if(Number.isInteger(n) && n >= 1 && n < 100000 && tokens === null) tokens = n
      } else if(col.length > 0 && isNaN(parseFloat(col))){
        if(username === null && col.length <= 50 && col.length > 1) username = col
        else if(note === '' && col.length > 0) note = col
      }
    }
    if(!tokens || tokens < 1){ skipped++; continue }
    if(!usd) usd = +(tokens * rate).toFixed(2)
    rows.push({ ts, username: username || 'anonymous', tokens, usd, note })
  }
  return { rows, skipped }
}

function pasteToCSVBlob(rawText, platformId){
  const{rows,skipped}=parseRows(rawText,platformId)
  const csvRows=['date_time,username,tokens,usd,note']
  for(const r of rows){
    const isoTs=r.ts.toISOString().replace('T',' ').slice(0,19)
    csvRows.push(`${isoTs},${r.username.replace(/,/g,'')},${r.tokens},${r.usd},${r.note.replace(/,/g,'')}`)
  }
  return{blob:new Blob([csvRows.join('\n')],{type:'text/csv'}),rowCount:rows.length,skipped}
}

function buildPreview(rawText, platformId, platformLabel){
  const{rows,skipped}=parseRows(rawText,platformId)
  if(!rows.length)return null
  const totalUsd=rows.reduce((s,r)=>s+r.usd,0)
  const fans=new Set(rows.map(r=>r.username)).size
  const dates=rows.map(r=>r.ts).sort((a,b)=>a-b)
  const topSpender=Object.entries(rows.reduce((acc,r)=>{acc[r.username]=(acc[r.username]||0)+r.tokens;return acc},{})).sort((a,b)=>b[1]-a[1])[0]
  const hourCounts=rows.reduce((acc,r)=>{const h=r.ts.getHours();acc[h]=(acc[h]||0)+r.tokens;return acc},{})
  const bestHour=Object.entries(hourCounts).sort((a,b)=>b[1]-a[1])[0]
  const fmtHour=h=>{const n=parseInt(h);return n===0?'12am':n<12?`${n}am`:n===12?'12pm':`${n-12}pm`}
  return{
    tipsDetected:rows.length,
    estimatedEarnings:+totalUsd.toFixed(2),
    fansDetected:fans,
    dateRange:`${dates[0].toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${dates[dates.length-1].toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`,
    rowsSkipped:skipped,
    topSpender:topSpender?{name:topSpender[0],tokens:topSpender[1]}:null,
    bestHour:bestHour?fmtHour(bestHour[0]):null,
    sampleRows:rows.slice(0,5).map(r=>({
      date:r.ts.toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}),
      fan:r.username,tokens:r.tokens,amount:r.usd,platform:platformLabel
    })),
  }
}

// ── Sparkle ────────────────────────────────────────────────────
function Sparkle(){
  const ref=useRef()
  useEffect(()=>{
    const c=ref.current;if(!c)return
    const ctx=c.getContext('2d')
    c.width=window.innerWidth;c.height=window.innerHeight
    const COLS=['#00D9FF','#ffffff','#FF2BAA','#a78bfa','#6C5CFF']
    const dots=Array.from({length:32},()=>({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*2+0.4,color:COLS[Math.floor(Math.random()*COLS.length)],alpha:Math.random()*0.8+0.2,aDir:Math.random()>0.5?1:-1,aSpd:Math.random()*0.02+0.008,vx:(Math.random()-0.5)*0.25,vy:(Math.random()-0.5)*0.25}))
    let frame=0,raf
    const draw=()=>{
      ctx.clearRect(0,0,c.width,c.height)
      dots.forEach(d=>{
        d.x+=d.vx;d.y+=d.vy;d.alpha+=d.aDir*d.aSpd
        if(d.alpha>=1){d.alpha=1;d.aDir=-1}if(d.alpha<=0){d.alpha=0;d.aDir=1}
        if(d.x<-4)d.x=c.width+4;if(d.x>c.width+4)d.x=-4
        if(d.y<-4)d.y=c.height+4;if(d.y>c.height+4)d.y=-4
        ctx.save();ctx.globalAlpha=d.alpha;ctx.translate(d.x,d.y);ctx.fillStyle=d.color
        const s=d.r
        ctx.beginPath();ctx.moveTo(0,-s*2.5);ctx.lineTo(s*0.5,-s*0.5);ctx.lineTo(s*2.5,0);ctx.lineTo(s*0.5,s*0.5);ctx.lineTo(0,s*2.5);ctx.lineTo(-s*0.5,s*0.5);ctx.lineTo(-s*2.5,0);ctx.lineTo(-s*0.5,-s*0.5);ctx.closePath();ctx.fill();ctx.restore()
      })
      frame++
      if(frame<200)raf=requestAnimationFrame(draw)
      else{let op=1;const fade=()=>{op-=0.06;ctx.globalAlpha=op;if(op>0)requestAnimationFrame(fade);else ctx.clearRect(0,0,c.width,c.height)};fade()}
    }
    raf=requestAnimationFrame(draw)
    return()=>cancelAnimationFrame(raf)
  },[])
  return<canvas ref={ref} style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:9999}}/>
}

// ── CountUp ────────────────────────────────────────────────────
function CountUp({to,prefix='',suffix='',duration=1000}){
  const[val,setVal]=useState(0)
  useEffect(()=>{
    const start=Date.now()
    const tick=()=>{const p=Math.min((Date.now()-start)/duration,1);const e=1-Math.pow(1-p,3);setVal(Math.round(e*to));if(p<1)requestAnimationFrame(tick)}
    requestAnimationFrame(tick)
  },[to,duration])
  return<>{prefix}{val.toLocaleString()}{suffix}</>
}

// ── Shared UI pieces ───────────────────────────────────────────
function Logo(){
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12,marginBottom:20}}>
      <div style={{width:48,height:48,borderRadius:16,background:'linear-gradient(135deg,#00D9FF,#6C5CFF,#FF2BAA)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:900,color:'#fff',boxShadow:'0 0 34px rgba(0,217,255,0.28)'}}>$</div>
      <div style={{fontSize:28,fontWeight:900,letterSpacing:'-0.02em'}}>
        <span style={{color:'#fff'}}>Cam</span>
        <span style={{background:'linear-gradient(90deg,#00D9FF,#FF2BAA)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Cash</span>
      </div>
    </div>
  )
}

function StepDots({current}){
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',maxWidth:310,margin:'0 auto 4px'}}>
      {[1,2,3].map((n,i)=>(
        <div key={n} style={{display:'flex',alignItems:'center',flex:i<2?1:'none'}}>
          <div style={{
            width:36,height:36,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:13,fontWeight:700,flexShrink:0,transition:'all 0.3s',
            background:n<current?'#22d3ee':n===current?'linear-gradient(135deg,#00D9FF,#2D9CFF)':'rgba(255,255,255,0.04)',
            border:n<=current?'none':'1px solid rgba(255,255,255,0.1)',
            color:n<=current?'#04101b':'rgba(255,255,255,0.35)',
            boxShadow:n===current?'0 0 28px rgba(0,217,255,0.42)':n<current?'0 0 26px rgba(0,217,255,0.45)':'none',
          }}>{n<current?'✓':n}</div>
          {i<2&&<div style={{height:1,flex:1,background:current>n?'linear-gradient(90deg,#00D9FF,#FF2BAA)':'rgba(255,255,255,0.1)',boxShadow:current>n?'0 0 12px rgba(0,217,255,0.4)':'none',transition:'all 0.3s'}}/>}
        </div>
      ))}
    </div>
  )
}

function StepTitle({eyebrow,title,subtitle}){
  return(
    <div style={{textAlign:'center',marginBottom:20}}>
      <div style={{fontSize:11,fontWeight:900,letterSpacing:'0.26em',textTransform:'uppercase',color:'#22d3ee',marginBottom:12}}>{eyebrow}</div>
      <h1 style={{fontSize:30,fontWeight:900,color:'#fff',letterSpacing:'-0.02em',marginBottom:10,lineHeight:1.15}}>{title}</h1>
      <p style={{fontSize:14,color:'rgba(148,163,184,0.9)',lineHeight:1.6,maxWidth:480,margin:'0 auto'}}>{subtitle}</p>
    </div>
  )
}

function PrimaryBtn({onClick,children,disabled=false,style={}}){
  return(
    <button onClick={onClick} disabled={disabled} style={{
      width:'100%',height:56,borderRadius:16,border:'1px solid rgba(255,255,255,0.15)',
      background:disabled?'rgba(255,255,255,0.06)':'linear-gradient(90deg,#00D9FF,#6C5CFF,#FF2BAA)',
      color:disabled?'rgba(255,255,255,0.3)':'#fff',fontSize:16,fontWeight:900,cursor:disabled?'not-allowed':'pointer',
      boxShadow:disabled?'none':'0 0 34px rgba(0,217,255,0.20),0 0 34px rgba(255,43,170,0.18),inset 0 1px 0 rgba(255,255,255,0.35)',
      transition:'all 0.18s ease',display:'flex',alignItems:'center',justifyContent:'center',gap:8,
      ...style,
    }}
    onMouseEnter={e=>{if(!disabled){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.filter='brightness(1.1)'}}}
    onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.filter=''}}
    onMouseDown={e=>{if(!disabled)e.currentTarget.style.transform='translateY(0)'}}
    >{children} {!disabled&&<span style={{fontSize:16}}>→</span>}</button>
  )
}

function BackBtn({onClick,children='← Back'}){
  return(
    <button onClick={onClick} style={{height:48,padding:'0 20px',borderRadius:12,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.035)',color:'rgba(203,213,225,0.9)',fontSize:14,fontWeight:700,cursor:'pointer',transition:'all 0.2s'}}
    onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(0,217,255,0.35)';e.currentTarget.style.color='#fff'}}
    onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';e.currentTarget.style.color='rgba(203,213,225,0.9)'}}
    >{children}</button>
  )
}

function MutedLinks({links}){
  return(
    <div style={{display:'flex',justifyContent:'center',gap:20,marginTop:16,flexWrap:'wrap'}}>
      {links.map((l,i)=>(
        <button key={i} onClick={l.onClick} style={{background:'none',border:'none',fontSize:12,color:'rgba(100,116,139,0.8)',cursor:'pointer',transition:'color 0.2s'}}
        onMouseEnter={e=>e.currentTarget.style.color='#22d3ee'}
        onMouseLeave={e=>e.currentTarget.style.color='rgba(100,116,139,0.8)'}
        >{l.label}</button>
      ))}
    </div>
  )
}

function TrustLine(){
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:16,fontSize:12,color:'rgba(100,116,139,0.7)'}}>
      <span>🔒</span><span>Your data is stored securely and never shared.</span>
    </div>
  )
}

function FeedbackBubble(){
  const[open,setOpen]=useState(true)
  if(!open)return(
    <button onClick={()=>setOpen(true)} style={{position:'fixed',bottom:24,right:24,zIndex:50,display:'flex',alignItems:'center',gap:8,padding:'10px 18px',borderRadius:100,background:'rgba(8,11,26,0.9)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(148,163,184,0.9)',fontSize:13,fontWeight:700,cursor:'pointer',backdropFilter:'blur(20px)',boxShadow:'0 0 28px rgba(0,217,255,0.10)',transition:'all 0.2s'}}
    onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(0,217,255,0.4)';e.currentTarget.style.color='#fff'}}
    onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';e.currentTarget.style.color='rgba(148,163,184,0.9)'}}
    >💬 Feedback</button>
  )
  return(
    <div style={{position:'fixed',bottom:24,right:24,zIndex:50,maxWidth:310,borderRadius:20,border:'1px solid rgba(200,43,255,0.25)',background:'rgba(8,11,26,0.95)',padding:16,backdropFilter:'blur(20px)',boxShadow:'0 0 38px rgba(255,43,170,0.12)'}}>
      <button onClick={()=>setOpen(false)} style={{position:'absolute',top:10,right:10,background:'none',border:'none',color:'rgba(100,116,139,0.7)',cursor:'pointer',fontSize:16,lineHeight:1}}
      onMouseEnter={e=>e.currentTarget.style.color='#fff'}
      onMouseLeave={e=>e.currentTarget.style.color='rgba(100,116,139,0.7)'}
      >✕</button>
      <p style={{fontSize:14,fontWeight:700,color:'#C9B8FF',lineHeight:1.6,paddingRight:20,marginBottom:12}}>Having trouble with this step? We'd love your feedback.</p>
      <button style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:100,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.035)',color:'rgba(148,163,184,0.9)',fontSize:12,fontWeight:700,cursor:'pointer'}}>💬 Feedback</button>
    </div>
  )
}

// ── Pro Upsell Modal ───────────────────────────────────────────
function ProUpsellModal({platform,onSkip}){
  return(
    <div style={{position:'fixed',inset:0,zIndex:9998,background:'rgba(4,6,18,0.88)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{width:'100%',maxWidth:520,background:'linear-gradient(180deg,rgba(14,18,42,0.97),rgba(8,10,28,0.99))',borderRadius:24,position:'relative',boxShadow:'0 0 60px rgba(0,217,255,0.15),0 0 120px rgba(255,43,170,0.1)',border:'1px solid rgba(255,255,255,0.08)',padding:28}}>
        <div style={{textAlign:'center',marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:900,letterSpacing:'0.1em',textTransform:'uppercase',color:'#a78bfa',marginBottom:8}}>Unlock All Platforms</div>
          <h2 style={{fontSize:20,fontWeight:900,color:'#fff',marginBottom:6}}>You're adding {platform.label}</h2>
          <p style={{fontSize:13,color:'rgba(148,163,184,0.8)',lineHeight:1.6}}>Multi-platform tracking is a Pro feature. Upgrade to sync all platforms and see your full earnings picture.</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
          <div style={{background:'rgba(167,139,250,0.08)',border:'1.5px solid rgba(167,139,250,0.4)',borderRadius:14,padding:'16px',position:'relative'}}>
            <div style={{position:'absolute',top:0,right:0,background:'linear-gradient(135deg,#a78bfa,#7c3aed)',borderRadius:'0 14px 0 10px',padding:'3px 10px',fontSize:10,fontWeight:700,color:'#fff'}}>BEST DEAL</div>
            <div style={{fontSize:11,color:'#a78bfa',fontWeight:700,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.07em'}}>Early Adopter</div>
            <div style={{fontSize:24,fontWeight:900,color:'#fff',lineHeight:1}}>$9.99</div>
            <div style={{fontSize:11,color:'rgba(148,163,184,0.7)',marginBottom:12}}>/month · locked forever</div>
            {['All platforms','Save history forever','AI pattern learning','Fan behavior analysis','Lifetime price lock ✦'].map(f=>(
              <div key={f} style={{display:'flex',gap:6,alignItems:'center',fontSize:12,color:'rgba(203,213,225,0.9)',marginBottom:4}}>
                <span style={{color:'#a78bfa'}}>✓</span>{f}
              </div>
            ))}
            <button onClick={()=>window.open('https://www.camcashgrl.com/pricing','_blank')} style={{width:'100%',marginTop:12,padding:'10px',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#a78bfa,#7c3aed)',color:'#fff',fontSize:13,fontWeight:700}}>Lock in $9.99/mo →</button>
          </div>
          <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:'16px'}}>
            <div style={{fontSize:11,color:'rgba(148,163,184,0.7)',fontWeight:700,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.07em'}}>Standard</div>
            <div style={{fontSize:24,fontWeight:900,color:'#fff',lineHeight:1}}>$19.99</div>
            <div style={{fontSize:11,color:'rgba(148,163,184,0.7)',marginBottom:16}}>/month</div>
            {['All platforms','Save history forever','AI pattern learning','Fan behavior analysis'].map(f=>(
              <div key={f} style={{display:'flex',gap:6,alignItems:'center',fontSize:12,color:'rgba(148,163,184,0.8)',marginBottom:4}}>
                <span style={{color:'#00D9FF'}}>✓</span>{f}
              </div>
            ))}
            <button onClick={()=>window.open('https://www.camcashgrl.com/pricing','_blank')} style={{width:'100%',marginTop:12,padding:'10px',borderRadius:10,border:'1px solid rgba(255,255,255,0.12)',cursor:'pointer',background:'rgba(255,255,255,0.05)',color:'rgba(148,163,184,0.8)',fontSize:13,fontWeight:600}}>Get Standard →</button>
          </div>
        </div>
        <div style={{background:'rgba(0,217,255,0.06)',border:'1px solid rgba(0,217,255,0.15)',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:12,color:'rgba(148,163,184,0.8)',textAlign:'center'}}>
          ✅ <span style={{color:'#fff'}}>Free tier always exists</span> — your current platform stays free forever.
        </div>
        <div style={{textAlign:'center'}}>
          <button onClick={onSkip} style={{background:'none',border:'none',fontSize:12,color:'rgba(100,116,139,0.7)',cursor:'pointer',textDecoration:'underline'}}>Skip for now — continue with one platform</button>
        </div>
      </div>
    </div>
  )
}

// ── Live Mode Demo ─────────────────────────────────────────────
function LiveModeDemo({onInstall,onSkip}){
  const PROMPTS=[
    {icon:'🐋',title:'Greet Returning Fan',body:'whaleking99 just entered. He tipped $180 last stream. Say hi by name.',impact:'+$40 avg when acknowledged'},
    {icon:'💡',title:'Mention Your Tip Menu',body:'22 active viewers, no tip in 7 min. Mention your toy or wheel menu.',impact:'+34% tip rate after prompt'},
    {icon:'🎯',title:'Refresh the Room Goal',body:'Tips slowed down. Try a smaller, faster goal to restart momentum.',impact:'Recovers dead zones in ~4 min'},
  ]
  const[idx,setIdx]=useState(0)
  const[earnings,setEarnings]=useState(42.50)
  const[score,setScore]=useState(74)
  useEffect(()=>{
    const t=setInterval(()=>{setEarnings(e=>+(e+(Math.random()*2.5)).toFixed(2));setScore(s=>Math.min(98,s+Math.floor(Math.random()*3)))},2200)
    return()=>clearInterval(t)
  },[])
  useEffect(()=>{
    const t=setInterval(()=>setIdx(i=>(i+1)%PROMPTS.length),3500)
    return()=>clearInterval(t)
  },[])
  const cur=PROMPTS[idx]
  return(
    <div style={{animation:'fadeUp 0.3s ease both'}}>
      <StepTitle eyebrow="Live Mode Preview" title="This is CamCash during your stream" subtitle="While you stream, CamCash watches your room and tells you exactly what to do to earn more."/>
      <div style={{background:'rgba(4,6,18,0.8)',border:'1px solid rgba(0,217,255,0.2)',borderRadius:20,padding:20,marginBottom:16,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:'linear-gradient(90deg,transparent,#00D9FF,#6C5CFF,#FF2BAA,transparent)',animation:'shimmer 2.5s linear infinite'}}/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
          {[{label:'Live Score',value:`${score}/100`,color:'#00D9FF'},{label:'Earnings/hr',value:`$${(earnings*2.4).toFixed(0)}/hr`,color:'#4ade80'},{label:'Prompts followed',value:'5/7',color:'#a78bfa'}].map(s=>(
            <div key={s.label} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:'10px 12px'}}>
              <div style={{fontSize:10,color:'rgba(148,163,184,0.5)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>{s.label}</div>
              <div style={{fontSize:16,fontWeight:800,color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(0,217,255,0.25)',borderRadius:14,padding:16,boxShadow:'0 0 20px rgba(0,217,255,0.08)'}}>
          <div style={{display:'flex',gap:12,marginBottom:10}}>
            <div style={{width:40,height:40,borderRadius:12,background:'rgba(0,217,255,0.1)',border:'1px solid rgba(0,217,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{cur.icon}</div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'#00D9FF',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:3}}>Coach Prompt</div>
              <div style={{fontSize:13,fontWeight:700,color:'#fff',marginBottom:3}}>{cur.title}</div>
              <div style={{fontSize:12,color:'rgba(148,163,184,0.8)',lineHeight:1.5}}>{cur.body}</div>
            </div>
          </div>
          <div style={{fontSize:11,color:'rgba(74,222,128,0.8)',marginBottom:10}}>📈 {cur.impact}</div>
          <div style={{display:'flex',gap:8}}>
            {['✓ Done','⏸ Snooze','✕ Ignore'].map((l,i)=>(
              <button key={l} style={{flex:i===0?2:1,padding:'7px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12,fontWeight:700,background:i===0?'linear-gradient(90deg,#00D9FF,#6C5CFF)':'rgba(255,255,255,0.06)',color:i===0?'#04101b':'rgba(148,163,184,0.7)'}}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'center',gap:6,marginTop:12}}>
          {PROMPTS.map((_,i)=>(
            <div key={i} onClick={()=>setIdx(i)} style={{width:i===idx?20:6,height:6,borderRadius:3,background:i===idx?'#00D9FF':'rgba(255,255,255,0.15)',transition:'all 0.3s',cursor:'pointer'}}/>
          ))}
        </div>
      </div>
      <PrimaryBtn onClick={onInstall}>Install Live Tracker — it's free</PrimaryBtn>
      <div style={{textAlign:'center',marginTop:10}}>
        <button onClick={onSkip} style={{background:'none',border:'none',fontSize:13,color:'rgba(0,217,255,0.8)',cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.color='#00D9FF'} onMouseLeave={e=>e.currentTarget.style.color='rgba(0,217,255,0.8)'}>Skip — go to dashboard first</button>
      </div>
      <TrustLine/>
    </div>
  )
}

// ── Global CSS ─────────────────────────────────────────────────
const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',system-ui,sans-serif}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
  @keyframes camcashLoad{0%{transform:translateX(-100%)}100%{transform:translateX(180%)}}
  @keyframes glowPulse{0%,100%{box-shadow:0 0 24px rgba(0,217,255,0.15)}50%{box-shadow:0 0 48px rgba(0,217,255,0.35),0 0 80px rgba(255,43,170,0.2)}}
  @keyframes flashPulse{0%{background:rgba(255,255,255,0)}20%{background:rgba(255,255,255,0.06)}100%{background:rgba(255,255,255,0)}}
  textarea::placeholder{color:rgba(148,163,184,0.6);font-family:monospace;font-size:12px;line-height:1.6}
  input::placeholder{color:rgba(71,85,105,0.9)}
`

// ── Main component ─────────────────────────────────────────────
export default function OnboardingPage(){
  const router=useRouter()
  const[user,setUser]=useState(null)
  const[booting,setBooting]=useState(true)
  const[step,setStep]=useState('platform') // platform|username|paste|csv|preview|loading|insights|done|step4
  const[platformId,setPlatformId]=useState('chaturbate')
  const[cbUsername,setCbUsername]=useState('')
  const[cbUsernameError,setCbUsernameError]=useState('')
  const[pasteText,setPasteText]=useState('')
  const[preview,setPreview]=useState(null)
  const[parseError,setParseError]=useState('')
  const[importResult,setImportResult]=useState(null)
  const[importError,setImportError]=useState('')
  const[isFirstImport,setIsFirstImport]=useState(true)
  const[showSparkle,setShowSparkle]=useState(false)
  const[importedPlatforms,setImportedPlatforms]=useState([])
  const[showUpsell,setShowUpsell]=useState(false)
  const[pendingPlatform,setPendingPlatform]=useState(null)
  const[csvUploading,setCsvUploading]=useState(false)
  const[csvError,setCsvError]=useState('')
  const[loadingMsgIdx,setLoadingMsgIdx]=useState(0)
  const[loadingProgress,setLoadingProgress]=useState(0)
  const csvRef=useRef()

  const platform=PLATFORMS[platformId]
  const stepNum={platform:1,username:1,paste:2,csv:2,preview:2,loading:3,insights:3,live:3,step4:3,done:3}[step]||1
  const showDots=true

  useEffect(()=>{
    ;(async()=>{
      const{data:{user}}=await supabase.auth.getUser()
      if(!user){router.replace('/login');return}
      const{data}=await supabase.from('beta_users').select('onboarding_complete').eq('user_id',user.id).single()
      if(data?.onboarding_complete){router.replace('/dashboard');return}
      setUser(user);setBooting(false)
    })()
  },[router])

  async function markDone(){
    if(!user)return
    await supabase.from('beta_users').upsert({user_id:user.id,email:user.email,onboarding_complete:true,signed_up_at:user.created_at},{onConflict:'user_id'})
  }

  function selectPlatform(id){
    if(importedPlatforms.length>0&&!importedPlatforms.includes(id)){setPendingPlatform(id);setShowUpsell(true);return}
    setPlatformId(id)
    if(id==='chaturbate')setStep('username');else setStep('paste')
  }

  async function handleUsernameSubmit(){
    setCbUsernameError('')
    const cleaned=cbUsername.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'')
    if(!cleaned){setCbUsernameError('Enter your Chaturbate username to continue.');return}
    setCbUsername(cleaned)
    if(user)await supabase.from('profiles').upsert({id:user.id,chaturbate_username:cleaned},{onConflict:'id'})
    setStep('paste')
  }

  function handleUpsellSkip(){
    setPlatformId(pendingPlatform);setShowUpsell(false);setPendingPlatform(null);setPasteText('')
    if(pendingPlatform==='chaturbate')setStep('username');else setStep('paste')
  }

  function handlePreview(){
    setParseError('')
    if(!pasteText.trim()){setParseError('Paste your tip history above first.');return}
    const p=buildPreview(pasteText,platformId,platform.label)
    if(!p||p.tipsDetected===0){setParseError("We couldn't find any tip rows. Make sure you copied the full table including dates and token amounts.");return}
    setPreview(p);setStep('preview')
  }

  async function handleImport(){
    if(!user)return
    setImportError('');setStep('loading');setLoadingMsgIdx(0);setLoadingProgress(0)
    try{
      const{data:{session}}=await supabase.auth.getSession()
      if(!session)throw new Error('Not logged in')
      const{blob}=pasteToCSVBlob(pasteText,platformId)
      const file=new File([blob],'pasted_import.csv',{type:'text/csv'})
      const minWait=isFirstImport?5500:1800
      const msgs=isFirstImport?LOADING_MESSAGES:EXTRA_MSGS
      const start=Date.now()
      const pi=setInterval(()=>{const p=Math.min((Date.now()-start)/minWait,0.95);setLoadingProgress(Math.round(p*100))},60)
      const mi=setInterval(()=>setLoadingMsgIdx(i=>(i+1)%msgs.length),900)
      const[res]=await Promise.all([
        fetch('/api/upload',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:(()=>{const f=new FormData();f.append('file',file);f.append('platform',platform.label);return f})()}),
        new Promise(r=>setTimeout(r,minWait)),
      ])
      clearInterval(pi);clearInterval(mi);setLoadingProgress(100)
      const json=await res.json()
      if(!res.ok||json.error)throw new Error(json.error||'Import failed')
      await markDone()
      setImportResult({inserted:json.inserted||0,skipped:json.skipped||0})
      setImportedPlatforms(prev=>prev.includes(platformId)?prev:[...prev,platformId])
      if(isFirstImport){setIsFirstImport(false);setShowSparkle(true);setTimeout(()=>setShowSparkle(false),4000);setStep('insights')}
      else setStep('insights')
    }catch(e){setImportError(e.message||'Import failed');setStep('preview')}
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
      const[res]=await Promise.all([fetch('/api/upload',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:form}),new Promise(r=>setTimeout(r,minWait))])
      clearInterval(pi);setLoadingProgress(100)
      const json=await res.json()
      if(!res.ok||json.error)throw new Error(json.error||'Upload failed')
      await markDone()
      setImportResult({inserted:json.inserted||0,skipped:json.skipped||0})
      setImportedPlatforms(prev=>prev.includes(platformId)?prev:[...prev,platformId])
      if(isFirstImport){setIsFirstImport(false);setShowSparkle(true);setTimeout(()=>setShowSparkle(false),4000);setStep('insights')}
      else setStep('insights')
    }catch(e){setCsvError(e.message||'Upload failed');setStep('csv')}
    finally{setCsvUploading(false)}
  }

  async function skipToDashboard(){await markDone();router.push('/dashboard')}

  if(booting)return(
    <div style={{minHeight:'100vh',background:'#050712',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:32,height:32,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.1)',borderTopColor:'#00D9FF',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const msgs=isFirstImport?LOADING_MESSAGES:EXTRA_MSGS

  return(
    <main style={{position:'relative',minHeight:'100vh',overflow:'hidden',background:'#050712',padding:'20px',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Inter',system-ui,sans-serif",color:'#fff'}}>
      <style>{CSS}</style>

      {/* Background glows */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0}}>
        <div style={{position:'absolute',left:'-20%',top:'-5%',width:700,height:700,borderRadius:'50%',background:'rgba(0,217,255,0.35)',filter:'blur(100px)'}}/>
        <div style={{position:'absolute',right:'-20%',bottom:'-5%',width:750,height:750,borderRadius:'50%',background:'rgba(255,43,170,0.32)',filter:'blur(110px)'}}/>
        <div style={{position:'absolute',left:'30%',top:'40%',width:400,height:400,borderRadius:'50%',background:'rgba(108,92,255,0.18)',filter:'blur(80px)'}}/>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 15% 15%,rgba(0,217,255,0.15),transparent 35%),radial-gradient(circle at 85% 80%,rgba(255,43,170,0.18),transparent 35%)'}}/>
        <div style={{position:'absolute',inset:0,opacity:0.18,backgroundImage:'radial-gradient(rgba(255,255,255,0.38) 1px,transparent 1px)',backgroundSize:'34px 34px'}}/>
      </div>

      {showSparkle&&<Sparkle/>}
      {showUpsell&&pendingPlatform&&<ProUpsellModal platform={PLATFORMS[pendingPlatform]} onSkip={handleUpsellSkip}/>}
      <FeedbackBubble/>

      {/* Main card */}
      <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:680}}>
        <div style={{position:'relative',borderRadius:28,padding:1,background:'linear-gradient(135deg,rgba(0,217,255,0.9),rgba(108,92,255,0.4),rgba(255,43,170,0.9))',boxShadow:'0 0 120px rgba(0,217,255,0.4),0 0 180px rgba(255,43,170,0.3),0 0 60px rgba(108,92,255,0.3)'}}>
          <div style={{borderRadius:27,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(6,8,20,0.97)',padding:'26px 30px 24px',boxShadow:'inset 0 1px 0 rgba(255,255,255,0.08)'}}>

            {/* Header */}
            <header style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:step==='loading'?8:20}}>
              <Logo/>
              {showDots&&<StepDots current={stepNum}/>}
            </header>

            {/* ── PLATFORM ── */}
            {step==='platform'&&(
              <div style={{animation:'fadeUp 0.3s ease both'}}>
                <StepTitle eyebrow="STEP 1 OF 3" title="Where do you stream?" subtitle="Choose your platform so CamCash can import your tip history and turn it into insights in under a minute."/>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:20,marginTop:4}}>
                  {Object.entries(PLATFORMS).map(([key,p])=>{
                    const sel=platformId===key
                    return(
                      <button key={key} onClick={()=>selectPlatform(key)} style={{
                        position:'relative',minHeight:140,borderRadius:20,padding:20,textAlign:'center',
                        background:sel?'rgba(0,217,255,0.055)':'rgba(255,255,255,0.035)',
                        border:sel?'1.5px solid rgba(0,217,255,0.9)':'1px solid rgba(255,255,255,0.1)',
                        boxShadow:sel?'0 0 34px rgba(0,217,255,0.22),inset 0 1px 0 rgba(255,255,255,0.08)':'none',
                        cursor:'pointer',transition:'all 0.2s',
                      }}
                      onMouseEnter={e=>{if(!sel){e.currentTarget.style.borderColor='rgba(0,217,255,0.4)';e.currentTarget.style.boxShadow='0 0 24px rgba(0,217,255,0.12)';e.currentTarget.style.background='rgba(255,255,255,0.055)'}}}
                      onMouseLeave={e=>{if(!sel){e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';e.currentTarget.style.boxShadow='none';e.currentTarget.style.background='rgba(255,255,255,0.035)'}}}
                      >
                        {sel&&<div style={{position:'absolute',top:14,right:14,width:28,height:28,borderRadius:'50%',background:'#22d3ee',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:900,color:'#04101b',boxShadow:'0 0 20px rgba(0,217,255,0.55)'}}>✓</div>}
                        <div style={{width:64,height:64,borderRadius:20,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:900,margin:'0 auto 14px',...p.iconStyle}}>{p.short}</div>
                        <div style={{fontSize:15,fontWeight:900,color:sel?'#fff':'rgba(255,255,255,0.45)'}}>{p.label}</div>
                      </button>
                    )
                  })}
                </div>

                <div style={{borderRadius:20,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.035)',padding:20,marginBottom:24,boxShadow:'inset 0 1px 0 rgba(255,255,255,0.05)'}}>
                  <div style={{display:'flex',gap:16}}>
                    <div style={{width:48,height:48,borderRadius:20,border:'1px solid rgba(0,217,255,0.2)',background:'rgba(0,217,255,0.10)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0,boxShadow:'0 0 24px rgba(0,217,255,0.12)'}}>⚡</div>
                    <div>
                      <h3 style={{fontSize:15,fontWeight:900,color:'#22d3ee',marginBottom:4}}>Paste once. Get insights fast.</h3>
                      <p style={{fontSize:13,color:'rgba(148,163,184,0.85)',lineHeight:1.6}}>Copy and paste your tip history one time. We'll handle the rest and unlock powerful analytics in about 60 seconds.</p>
                    </div>
                  </div>
                </div>

                <PrimaryBtn onClick={()=>selectPlatform(platformId)}>Continue with {platform.label}</PrimaryBtn>
                <div style={{textAlign:'center',marginTop:14}}>
                  <button onClick={skipToDashboard} style={{background:'none',border:'none',fontSize:13,fontWeight:500,color:'rgba(34,211,238,0.8)',cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.color='#22d3ee'}
                  onMouseLeave={e=>e.currentTarget.style.color='rgba(34,211,238,0.8)'}
                  >Skip for now ›</button>
                </div>
              </div>
            )}

            {/* ── USERNAME ── */}
            {step==='username'&&(
              <div style={{animation:'fadeUp 0.3s ease both'}}>
                <StepTitle eyebrow="STEP 1 OF 3 — CHATURBATE" title="What's your Chaturbate username?" subtitle="We'll open your token stats page directly so you can copy your tip history."/>
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:600,color:'rgba(148,163,184,0.7)',marginBottom:8}}>Chaturbate username</div>
                  <div style={{position:'relative'}}>
                    <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'rgba(71,85,105,0.9)',fontWeight:500,pointerEvents:'none',fontFamily:'monospace'}}>chaturbate.com/p/</span>
                    <input type="text" value={cbUsername} onChange={e=>{setCbUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,''));setCbUsernameError('')}} onKeyDown={e=>e.key==='Enter'&&handleUsernameSubmit()} placeholder="yourname" autoFocus
                      style={{width:'100%',padding:'14px 14px 14px 186px',background:'rgba(5,8,22,0.8)',border:`1px solid ${cbUsernameError?'rgba(248,113,113,0.5)':'rgba(255,255,255,0.1)'}`,borderRadius:14,color:'#e2e8f0',fontSize:14,fontFamily:'monospace',outline:'none',transition:'border-color 0.2s',boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04)'}}/>
                  </div>
                  {cbUsernameError&&<div style={{marginTop:8,fontSize:12,color:'#f87171'}}>⚠️ {cbUsernameError}</div>}
                  {cbUsername&&<div style={{marginTop:8,fontSize:12,color:'rgba(100,116,139,0.7)'}}>Your stats page: <span style={{color:'#22d3ee'}}>chaturbate.com/p/{cbUsername}/?tab=tokens</span></div>}
                </div>
                <PrimaryBtn onClick={handleUsernameSubmit} style={{marginBottom:12}}>Continue</PrimaryBtn>
                <MutedLinks links={[{label:'← Back',onClick:()=>setStep('platform')},{label:"Skip — I'll navigate there myself",onClick:()=>{setCbUsername('');setStep('paste')}}]}/>
                <TrustLine/>
              </div>
            )}

            {/* ── PASTE ── */}
            {step==='paste'&&(
              <div style={{animation:'fadeUp 0.3s ease both'}}>
                <StepTitle eyebrow={`STEP 2 OF 3 — ${platform.label.toUpperCase()}`} title="Paste your tip history" subtitle={`Copy your earning rows from ${platform.label} and paste them below. CamCash will clean the data automatically.`}/>

                <div style={{borderRadius:20,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.035)',padding:16,marginBottom:14,boxShadow:'inset 0 1px 0 rgba(255,255,255,0.05)'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,marginBottom:14}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:900,letterSpacing:'0.18em',textTransform:'uppercase',color:'#22d3ee',marginBottom:8}}>How to copy from {platform.label}</div>
                      <p style={{fontSize:13,color:'rgba(148,163,184,0.85)',lineHeight:1.6}}>{platform.instructions}</p>
                    </div>
                    <a href={platform.earningsUrl(cbUsername)} target="_blank" rel="noreferrer" style={{flexShrink:0,padding:'8px 16px',borderRadius:12,border:'1px solid rgba(255,43,170,0.40)',background:'rgba(255,255,255,0.035)',color:'rgba(203,213,225,0.9)',fontSize:12,fontWeight:700,textDecoration:'none',whiteSpace:'nowrap',boxShadow:'0 0 18px rgba(255,43,170,0.10)',transition:'all 0.2s'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(0,217,255,0.6)';e.currentTarget.style.color='#fff'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,43,170,0.40)';e.currentTarget.style.color='rgba(203,213,225,0.9)'}}
                    >Open earnings page ↗</a>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                    {['No password required','You control what gets imported','Takes about 60 seconds'].map(t=>(
                      <div key={t} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'rgba(148,163,184,0.85)'}}>
                        <span style={{color:'#22d3ee',fontSize:13}}>✓</span>{t}
                      </div>
                    ))}
                  </div>
                </div>

                <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)} placeholder={platform.placeholder}
                  style={{width:'100%',height:145,resize:'none',borderRadius:20,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(8,12,30,0.90)',padding:16,fontFamily:'monospace',fontSize:12,lineHeight:1.6,color:'#e2e8f0',outline:'none',boxShadow:'inset 0 1px 0 rgba(255,255,255,0.05)',marginBottom:parseError?10:14,transition:'border-color 0.2s,box-shadow 0.2s'}}
                  onFocus={e=>{e.target.style.borderColor='rgba(0,217,255,0.7)';e.target.style.boxShadow='0 0 26px rgba(0,217,255,0.16)'}}
                  onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.1)';e.target.style.boxShadow='inset 0 1px 0 rgba(255,255,255,0.04)'}}
                />
                {parseError&&<div style={{marginBottom:14,padding:'10px 14px',borderRadius:10,background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.25)',fontSize:13,color:'#f87171'}}>⚠️ {parseError}</div>}

                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
                  {['Open your earnings or tip history','Highlight the rows you want','Copy and paste them here'].map((t,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:10,fontSize:12,color:'rgba(148,163,184,0.85)'}}>
                      <div style={{width:24,height:24,borderRadius:'50%',border:'1px solid rgba(0,217,255,0.3)',background:'rgba(0,217,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,color:'#22d3ee',flexShrink:0}}>{i+1}</div>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>

                <div style={{display:'grid',gridTemplateColumns:'120px 1fr',gap:12,marginBottom:4}}>
                  <BackBtn onClick={()=>setStep('platform')}/>
                  <PrimaryBtn onClick={handlePreview} disabled={!pasteText.trim()} style={{height:48,fontSize:15}}>Preview Import</PrimaryBtn>
                </div>
                <MutedLinks links={[{label:'Upload CSV instead',onClick:()=>setStep('csv')},{label:'Track future tips instead',onClick:skipToDashboard}]}/>
                <TrustLine/>
              </div>
            )}

            {/* ── CSV ── */}
            {step==='csv'&&(
              <div style={{animation:'fadeUp 0.3s ease both'}}>
                <StepTitle eyebrow={`STEP 2 OF 3 — ${platform.label.toUpperCase()}`} title="Upload your CSV" subtitle="Export your earnings as a CSV file and drop it below."/>
                <div onClick={()=>!csvUploading&&csvRef.current?.click()} style={{border:'2px dashed rgba(255,255,255,0.12)',borderRadius:20,padding:'44px 20px',textAlign:'center',cursor:csvUploading?'not-allowed':'pointer',background:'rgba(255,255,255,0.02)',marginBottom:14,transition:'all 0.2s'}}>
                  <input ref={csvRef} type="file" accept=".csv,.txt" style={{display:'none'}} onChange={e=>{const f=e.target.files[0];if(f)handleCsvUpload(f)}}/>
                  {csvUploading?(<><div style={{width:28,height:28,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.1)',borderTopColor:'#00D9FF',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/><div style={{fontSize:14,color:'#00D9FF',fontWeight:500}}>Uploading…</div></>):(<><div style={{fontSize:32,marginBottom:10}}>📁</div><div style={{fontSize:14,fontWeight:700,color:'#f8fafc',marginBottom:4}}>Drop your CSV here or click to browse</div><div style={{fontSize:12,color:'rgba(148,163,184,0.6)'}}>Supports {platform.label} export format</div></>)}
                </div>
                {csvError&&<div style={{marginBottom:14,padding:'10px 14px',borderRadius:10,background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.25)',fontSize:13,color:'#f87171'}}>⚠️ {csvError}</div>}
                <div style={{display:'flex',gap:10}}>
                  <BackBtn onClick={()=>setStep('paste')}>← Use paste instead</BackBtn>
                  <BackBtn onClick={()=>setStep('platform')}>← Back</BackBtn>
                </div>
                <TrustLine/>
              </div>
            )}

            {/* ── PREVIEW ── */}
            {step==='preview'&&preview&&(
              <div style={{animation:'fadeUp 0.3s ease both'}}>
                <StepTitle eyebrow="STEP 3 OF 3 — PREVIEW IMPORT" title="Review your import" subtitle="We found your tip history. Confirm everything looks right, then CamCash will build your dashboard."/>

                <div style={{borderRadius:20,border:'1px solid rgba(0,217,255,0.25)',background:'rgba(0,217,255,0.055)',padding:16,marginBottom:14,boxShadow:'0 0 24px rgba(0,217,255,0.12)'}}>
                  <h3 style={{fontSize:15,fontWeight:900,color:'#fff',marginBottom:4}}>Looks good — {preview.tipsDetected.toLocaleString()} tips found</h3>
                  <p style={{fontSize:13,color:'rgba(148,163,184,0.85)',lineHeight:1.6}}>CamCash cleaned your paste and detected earnings, fans, dates, and platform data.</p>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:10,gridAutoRows:'auto'}}>
                  {[
                    {label:'Tips detected',value:preview.tipsDetected.toLocaleString()},
                    {label:'Est. earnings',value:`$${preview.estimatedEarnings.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`},
                    {label:'Fans detected',value:preview?.fansDetected||0.toLocaleString()},
                    {label:'Date range',value:preview.dateRange},
                    {label:'Platform',value:platform.label},
                  ].map(s=>(
                    <div key={s.label} style={{borderRadius:20,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.035)',padding:'14px 16px',boxShadow:'inset 0 1px 0 rgba(255,255,255,0.05)'}}>
                      <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.14em',color:'rgba(71,85,105,0.9)',marginBottom:6}}>{s.label}</div>
                      <div style={{fontSize:17,fontWeight:900,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {preview.rowsSkipped>0&&(
                  <div style={{borderRadius:20,border:'1px solid rgba(251,146,60,0.2)',background:'rgba(251,146,60,0.06)',padding:14,marginBottom:12}}>
                    <h3 style={{fontSize:14,fontWeight:900,color:'rgba(253,186,116,0.9)',marginBottom:4}}>A few rows need attention</h3>
                    <p style={{fontSize:13,color:'rgba(148,163,184,0.85)',lineHeight:1.5}}>CamCash found {preview.tipsDetected.toLocaleString()} tips and skipped {preview.rowsSkipped} rows that looked incomplete. You can import the clean rows anyway.</p>
                  </div>
                )}

                <div style={{borderRadius:20,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.035)',marginBottom:8,overflow:'hidden'}}>
                  <div style={{borderBottom:'1px solid rgba(255,255,255,0.1)',padding:'12px 16px'}}>
                    <h3 style={{fontSize:13,fontWeight:900,color:'#fff'}}>Sample rows</h3>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',minWidth:560,borderCollapse:'collapse',fontSize:12}}>
                      <thead>
                        <tr style={{borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
                          {['Date','Fan','Tokens','Amount','Platform'].map(h=>(
                            <th key={h} style={{padding:'10px 16px',textAlign:'left',fontWeight:700,color:'rgba(71,85,105,0.9)',fontSize:11,textTransform:'uppercase',letterSpacing:'0.08em'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sampleRows.slice(0,5).map((r,i)=>(
                          <tr key={i} style={{borderBottom:i<preview.sampleRows.length-1?'1px solid rgba(255,255,255,0.06)':'none'}}>
                            <td style={{padding:'10px 16px',color:'rgba(148,163,184,0.85)'}}>{r.date}</td>
                            <td style={{padding:'10px 16px',fontWeight:700,color:'#fff'}}>{r.fan}</td>
                            <td style={{padding:'10px 16px',color:'rgba(148,163,184,0.85)'}}>{r.tokens.toLocaleString()}</td>
                            <td style={{padding:'10px 16px',color:'#22d3ee'}}>${r.amount.toFixed(2)}</td>
                            <td style={{padding:'10px 16px',color:'rgba(71,85,105,0.9)'}}>{r.platform}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{borderTop:'1px solid rgba(255,255,255,0.1)',padding:'10px 16px',fontSize:11,color:'rgba(71,85,105,0.9)'}}>Showing a sample. Full import will be added to your dashboard.</p>
                </div>

                {importError&&<div style={{marginBottom:12,padding:'10px 14px',borderRadius:10,background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.25)',fontSize:13,color:'#f87171'}}>⚠️ {importError}</div>}

                <div style={{display:'grid',gridTemplateColumns:'120px 1fr',gap:12,marginBottom:4}}>
                  <BackBtn onClick={()=>setStep('paste')}/>
                  <PrimaryBtn onClick={handleImport} style={{height:48,fontSize:15}}>Import & build dashboard</PrimaryBtn>
                </div>
                <MutedLinks links={[{label:'Paste more rows',onClick:()=>setStep('paste')},{label:'Upload CSV instead',onClick:()=>setStep('csv')},{label:'Track future tips instead',onClick:skipToDashboard}]}/>
                <TrustLine/>
              </div>
            )}

            {/* ── LOADING / ANALYZING ── */}
            {step==='loading'&&(
              <div style={{textAlign:'center',padding:'18px 0 4px',animation:'fadeUp 0.35s ease both'}}>
                <div style={{position:'relative',width:76,height:76,margin:'0 auto 18px'}}>
                  <div style={{position:'absolute',inset:-10,borderRadius:30,background:'conic-gradient(from 90deg,#00D9FF,#6C5CFF,#FF2BAA,#00D9FF)',filter:'blur(18px)',opacity:0.55,animation:'spin 3.2s linear infinite'}}/>
                  <div style={{position:'relative',width:76,height:76,borderRadius:26,background:'linear-gradient(135deg,#00D9FF,#6C5CFF,#FF2BAA)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,fontWeight:900,color:'#fff',boxShadow:'inset 0 1px 0 rgba(255,255,255,0.35)'}}>$</div>
                </div>
                <StepTitle eyebrow="STEP 3 OF 3" title="Analyzing your data" subtitle="CamCash is cleaning your paste, finding your best fans, and building your first earnings insights."/>
                <div style={{height:12,borderRadius:100,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.04)',maxWidth:480,margin:'0 auto 12px',overflow:'hidden',boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04)'}}>
                  <div style={{height:'100%',width:`${loadingProgress}%`,background:'linear-gradient(90deg,#00D9FF,#6C5CFF,#FF2BAA)',borderRadius:100,boxShadow:'0 0 28px rgba(0,217,255,0.35)',transition:'width 0.1s linear'}}/>
                </div>
                <div style={{fontSize:12,fontWeight:800,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(34,211,238,0.85)',marginBottom:16}}>{loadingProgress}% complete</div>

                <div style={{display:'grid',gap:8,marginBottom:16}}>
                  {(isFirstImport?LOADING_MESSAGES:EXTRA_MSGS).map((msg,i)=>{
                    const complete=loadingProgress >= ((i+1)/((isFirstImport?LOADING_MESSAGES:EXTRA_MSGS).length))*100 - 8
                    const active=i===loadingMsgIdx
                    return(
                      <div key={msg} style={{display:'flex',alignItems:'center',gap:10,borderRadius:14,border:`1px solid ${complete?'rgba(0,217,255,0.26)':active?'rgba(255,43,170,0.22)':'rgba(255,255,255,0.08)'}`,background:complete?'rgba(0,217,255,0.055)':active?'rgba(255,43,170,0.04)':'rgba(255,255,255,0.025)',padding:'10px 12px',textAlign:'left',transition:'all 0.25s'}}>
                        <div style={{width:24,height:24,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,background:complete?'#22d3ee':'rgba(255,255,255,0.05)',color:complete?'#04101b':'rgba(148,163,184,0.6)',fontSize:12,fontWeight:900,boxShadow:complete?'0 0 18px rgba(0,217,255,0.42)':'none'}}>{complete?'✓':'•'}</div>
                        <div style={{fontSize:13,fontWeight:700,color:complete?'#fff':'rgba(203,213,225,0.82)'}}>{msg}</div>
                      </div>
                    )
                  })}
                </div>

                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                  {[
                    {label:'Earnings',value:Math.round(preview?.estimatedEarnings||0),prefix:'$',suffix:''},
                    {label:'Fans',value:preview?.fansDetected||0,prefix:'',suffix:''},
                    {label:'Tips',value:preview?.tipsDetected||0,prefix:'',suffix:''},
                    {label:'Best hour',value:0,prefix:'',suffix:preview?.bestHour?` ${preview.bestHour}`:' calculating…'},
                  ].map((s,i)=>(
                    <div key={s.label} style={{borderRadius:16,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.035)',padding:'12px 8px',boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04)'}}>
                      <div style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.10em',color:'rgba(100,116,139,0.85)',marginBottom:6}}>{s.label}</div>
                      <div style={{fontSize:16,fontWeight:900,color:i===3?'#C9B8FF':'#22d3ee',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{i===3?s.suffix:<CountUp to={s.value} prefix={s.prefix} suffix={s.suffix} duration={1100}/>}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}


            {/* ── FIRST INSIGHTS ── */}
            {step==='insights'&&importResult&&(
              <div style={{animation:'fadeUp 0.35s ease both'}}>
                <div style={{textAlign:'center',marginBottom:18}}>
                  <div style={{position:'relative',width:74,height:74,margin:'0 auto 18px'}}>
                    <div style={{position:'absolute',inset:-14,borderRadius:30,background:'radial-gradient(circle,rgba(255,43,170,0.42),transparent 60%)',filter:'blur(16px)'}}/>
                    <div style={{position:'relative',width:74,height:74,borderRadius:26,background:'linear-gradient(135deg,#00D9FF,#6C5CFF,#FF2BAA)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,fontWeight:900,color:'#fff',boxShadow:'0 0 42px rgba(0,217,255,0.25),0 0 48px rgba(255,43,170,0.20),inset 0 1px 0 rgba(255,255,255,0.35)'}}>✓</div>
                  </div>
                  <StepTitle eyebrow="FIRST INSIGHTS" title="Your first insights are ready" subtitle="Here’s what CamCash found from your imported tip history. Import more data anytime to make these stats smarter."/>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:14}}>
                  {[
                    {label:'Tips imported',value:importResult.inserted||preview?.tipsDetected||0,color:'#00D9FF',prefix:'',suffix:''},
                    {label:'Unique fans',value:preview?.fansDetected||0,color:'#FF2BAA',prefix:'',suffix:''},
                    {label:'Est. earnings',value:Math.round(preview?.estimatedEarnings||0),color:'#4ade80',prefix:'$',suffix:''},
                    {label:'Top spender',text:preview?.topSpender?.name||'Import more',color:'#C9B8FF'},
                  ].map((s)=>(
                    <div key={s.label} style={{borderRadius:20,border:'1px solid rgba(255,255,255,0.10)',background:'linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))',padding:'16px 14px',boxShadow:'inset 0 1px 0 rgba(255,255,255,0.06)'}}>
                      <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.12em',color:'rgba(100,116,139,0.88)',marginBottom:7}}>{s.label}</div>
                      <div style={{fontSize:22,fontWeight:900,color:s.color,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.text || <CountUp to={s.value} prefix={s.prefix} suffix={s.suffix} duration={900}/>}</div>
                    </div>
                  ))}
                </div>

                <div style={{borderRadius:24,padding:1,background:'linear-gradient(135deg,rgba(0,217,255,0.5),rgba(255,43,170,0.45))',boxShadow:'0 0 34px rgba(0,217,255,0.13),0 0 34px rgba(255,43,170,0.10)',marginBottom:14}}>
                  <div style={{borderRadius:23,background:'rgba(8,12,30,0.92)',padding:18}}>
                    <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                      <div style={{width:46,height:46,borderRadius:16,background:'rgba(0,217,255,0.10)',border:'1px solid rgba(0,217,255,0.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>💎</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,fontWeight:900,letterSpacing:'0.16em',textTransform:'uppercase',color:'#22d3ee',marginBottom:7}}>Best first insight</div>
                        <div style={{fontSize:15,fontWeight:900,color:'#fff',lineHeight:1.45,marginBottom:6}}>
                          {preview?.bestHour?`Your highest tip activity was around ${preview.bestHour}.`:'Not enough history yet for a peak streaming window.'}
                        </div>
                        <p style={{fontSize:13,color:'rgba(148,163,184,0.86)',lineHeight:1.55}}>
                          {preview?.bestHour?'Import more history to compare weekdays, platforms, and your strongest earning windows with better accuracy.':'Import more rows or another date range to unlock best hours, platform comparisons, and stronger fan patterns.'}
                        </p>
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6,marginTop:16,alignItems:'end',height:54}}>
                      {[30,46,34,62,44,75,52].map((h,i)=>(
                        <div key={i} style={{height:`${h}%`,borderRadius:'10px 10px 4px 4px',background:i===5?'linear-gradient(180deg,#FF2BAA,#6C5CFF)':'linear-gradient(180deg,#00D9FF55,#00D9FF18)',boxShadow:i===5?'0 0 20px rgba(255,43,170,0.22)':'none'}}/>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{borderRadius:18,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.035)',padding:'13px 14px',fontSize:12,color:'rgba(148,163,184,0.82)',lineHeight:1.55,marginBottom:14}}>
                  <span style={{color:'#fff',fontWeight:800}}>Recommended:</span> import more history to make your stats smarter and more accurate. You can do this later from your dashboard too.
                </div>

                <PrimaryBtn onClick={()=>{setShowSparkle(true);setTimeout(()=>setShowSparkle(false),3500);setStep('done')}} style={{marginBottom:10}}>Finish onboarding</PrimaryBtn>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <button onClick={()=>{setPasteText('');setStep('paste')}} style={{padding:'12px',borderRadius:14,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.035)',color:'rgba(203,213,225,0.9)',fontSize:13,fontWeight:800,cursor:'pointer'}}>Import more data</button>
                  <button onClick={()=>window.open('https://chrome.google.com/webstore','_blank')} style={{padding:'12px',borderRadius:14,border:'1px solid rgba(255,43,170,0.22)',background:'rgba(255,43,170,0.055)',color:'rgba(255,255,255,0.92)',fontSize:13,fontWeight:800,cursor:'pointer'}}>Install Pretty Profits</button>
                </div>
              </div>
            )}

            {/* ── LIVE MODE DEMO ── */}
            {step==='live'&&(
              <LiveModeDemo
                onInstall={()=>{window.open('https://chrome.google.com/webstore','_blank');setStep('done')}}
                onSkip={()=>setStep('done')}
              />
            )}

            {/* ── STEP4 (additional imports) ── */}
            {step==='step4'&&(
              <div style={{animation:'fadeUp 0.3s ease both'}}>
                <div style={{textAlign:'center',marginBottom:24}}>
                  <div style={{fontSize:36,marginBottom:14}}>✅</div>
                  <h1 style={{fontSize:24,fontWeight:900,color:'#fff',marginBottom:8}}>Make your dashboard smarter</h1>
                  <p style={{fontSize:14,color:'rgba(148,163,184,0.85)',lineHeight:1.6}}>Add more history or turn on live tracking so CamCash can find stronger patterns.</p>
                </div>
                {[{icon:'📥',title:'Add more history',sub:'Improve accuracy with more tip data',onClick:()=>{setPasteText('');setStep('paste')}},{icon:'📡',title:'Set up live tracking',sub:'Track future tips automatically while you stream',onClick:()=>window.open('https://chrome.google.com/webstore','_blank')},{icon:'📊',title:'Go to dashboard',sub:'See what CamCash found so far',onClick:()=>router.push('/dashboard')}].map(a=>(
                  <button key={a.title} onClick={a.onClick} style={{display:'flex',alignItems:'center',gap:14,padding:'16px 18px',width:'100%',background:'rgba(255,255,255,0.035)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:16,cursor:'pointer',transition:'all 0.2s',textAlign:'left',marginBottom:10}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(0,217,255,0.2)';e.currentTarget.style.background='rgba(0,217,255,0.04)';e.currentTarget.style.transform='translateY(-1px)'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.08)';e.currentTarget.style.background='rgba(255,255,255,0.035)';e.currentTarget.style.transform=''}}
                  >
                    <div style={{width:44,height:44,borderRadius:14,background:'rgba(0,217,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{a.icon}</div>
                    <div><div style={{fontSize:14,fontWeight:700,color:'#fff',marginBottom:2}}>{a.title}</div><div style={{fontSize:12,color:'rgba(100,116,139,0.8)'}}>{a.sub}</div></div>
                    <div style={{marginLeft:'auto',color:'rgba(100,116,139,0.5)',fontSize:16}}>→</div>
                  </button>
                ))}
              </div>
            )}

            {/* ── DONE ── */}
            {step==='done'&&importResult&&(
              <div style={{animation:'fadeUp 0.4s ease both',textAlign:'center',position:'relative',overflow:'hidden'}}>
                <div style={{position:'absolute',inset:0,animation:'flashPulse 1s ease-out 1',background:'rgba(255,255,255,0)',pointerEvents:'none'}}/>
                <div style={{width:64,height:64,borderRadius:24,background:'linear-gradient(135deg,#00D9FF,#6C5CFF,#FF2BAA)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,fontWeight:900,color:'#fff',margin:'0 auto 20px',boxShadow:'0 0 48px rgba(255,43,170,0.32)',animation:'glowPulse 2.5s ease-in-out infinite'}}>✓</div>
                <h1 style={{fontSize:28,fontWeight:900,color:'#fff',marginBottom:8,letterSpacing:'-0.02em'}}>Your dashboard is ready</h1>
                <p style={{fontSize:14,color:'rgba(148,163,184,0.85)',lineHeight:1.6,maxWidth:400,margin:'0 auto 24px'}}>We found your earnings, fans, and best starting insights.</p>

                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:16}}>
                  {[
                    {label:'Tips imported',value:importResult.inserted,color:'#00D9FF',prefix:'',suffix:'',delay:'0s'},
                    {label:'Unique fans',value:preview?.fansDetected||0,color:'#f59e0b',prefix:'',suffix:'',delay:'0.15s'},
                    {label:'Est. earnings',value:parseFloat(preview?.estimatedEarnings||0),color:'#4ade80',prefix:'$',suffix:'',delay:'0.3s'},
                    {label:'Top spender',value:1,color:'#a78bfa',prefix:'',suffix:' found',delay:'0.45s'},
                  ].map(s=>(
                    <div key={s.label} style={{borderRadius:20,border:`1px solid rgba(${s.color==='#00D9FF'?'0,217,255':s.color==='#f59e0b'?'245,158,11':s.color==='#4ade80'?'74,222,128':'167,139,250'},0.2)`,background:'rgba(255,255,255,0.035)',padding:'16px 14px',animation:`fadeUp 0.4s ease ${s.delay} both`}}>
                      <div style={{fontSize:10,color:'rgba(71,85,105,0.9)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.1em'}}>{s.label}</div>
                      <div style={{fontSize:22,fontWeight:900,color:s.color}}><CountUp to={s.value} prefix={s.prefix} suffix={s.suffix} duration={1000}/></div>
                    </div>
                  ))}
                </div>

                <div style={{background:'rgba(255,255,255,0.035)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:16,padding:'14px 18px',marginBottom:16,textAlign:'left',display:'flex',alignItems:'flex-start',gap:12}}>
                  <div style={{fontSize:20,flexShrink:0}}>📧</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:'#fff',marginBottom:3}}>Check your email</div>
                    <div style={{fontSize:12,color:'rgba(148,163,184,0.75)',lineHeight:1.5}}>We sent you a video walkthrough on importing more data. You can also use the <span style={{color:'#22d3ee',fontWeight:600}}>CSV Importer</span> in your dashboard sidebar anytime.</div>
                  </div>
                </div>

                <PrimaryBtn onClick={()=>router.push('/dashboard')} style={{marginBottom:10}}>Go to Dashboard</PrimaryBtn>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {[{label:'Add more history',onClick:()=>{setPasteText('');setStep('paste')}},{label:'Set up live tracking',onClick:()=>window.open('https://chrome.google.com/webstore','_blank')}].map(b=>(
                    <button key={b.label} onClick={b.onClick} style={{padding:'11px',borderRadius:12,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.035)',color:'rgba(148,163,184,0.85)',fontSize:13,fontWeight:700,cursor:'pointer',transition:'all 0.2s'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(0,217,255,0.35)';e.currentTarget.style.color='#fff'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';e.currentTarget.style.color='rgba(148,163,184,0.85)'}}
                    >{b.label}</button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hlsdlaibnayzbfflxclj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc2RsYWlibmF5emJmZmx4Y2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjQwODUsImV4cCI6MjA4OTIwMDA4NX0.5FwPe35UL-o46FvBJX526La5o7jcbFaP1KVoLtI4U_M',
  { auth: { autoRefreshToken:true, persistSession:true, detectSessionInUrl:true } }
)

// ── Platform config (PRESERVED) ────────────────────────────────
const PLATFORMS = {
  chaturbate: {
    label:'Chaturbate', short:'CB',
    iconStyle:{ background:'#F05A2A', color:'#fff' },
    instructions:'Go to your profile → Token Stats tab. Select All Time. Highlight the table, copy, and paste below.',
    earningsUrl:(u)=> u ? `https://chaturbate.com/p/${u}/?tab=tokens` : 'https://chaturbate.com/accounts/settings/',
    placeholder:'Paste your Chaturbate tip history here...\n\nExample:\nJun 14, 2026, 8:27 PM\nTip From: username123\n500  12345',
  },
  bongacams: {
    label:'BongaCams', short:'BC',
    iconStyle:{ background:'#311222', color:'#FF3B6E', border:'1px solid rgba(255,59,110,0.25)' },
    instructions:'Go to Reports → General. Select your date range. Highlight all rows, copy, and paste below.',
    earningsUrl:()=>'https://bongamodels.com/reports/general',
    placeholder:'Paste your BongaCams tip history here...\n\nExample:\n14.06.2026 14:43\thaverford35\tTips\t1\t$0.024',
  },
  myfreecams: {
    label:'MyFreeCams', short:'MFC',
    iconStyle:{ background:'#2D2226', color:'#FF8B2C', border:'1px solid rgba(255,139,44,0.25)' },
    instructions:'Go to Token Sessions. Set your date range, highlight all rows, copy and paste below.',
    earningsUrl:()=>'https://profiles.myfreecams.com/_/ext/token_sessions',
    placeholder:'Paste your MyFreeCams tip history here...\n\nExample:\n1746555770\tJan 31st, 2024 10:40 PM\t10\tSkunk_Ape\tTip',
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

// ── Paste parser (PRESERVED EXACTLY) ───────────────────────────
function tryParseDate(str){
  if(!str)return null
  const s=str.trim()
  const cbMatch=s.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i)
  if(cbMatch){
    const[,mon,day,year,hr,min,ampm]=cbMatch
    const months={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11}
    let h=parseInt(hr,10)
    if(ampm.toUpperCase()==='PM'&&h!==12)h+=12
    if(ampm.toUpperCase()==='AM'&&h===12)h=0
    const d=new Date(parseInt(year),months[mon.toLowerCase()],parseInt(day),h,parseInt(min))
    if(!isNaN(d.getTime()))return d
  }
  const bcMatch=s.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/)
  if(bcMatch){
    const[,day,mon,year,hr,min]=bcMatch
    const d=new Date(parseInt(year),parseInt(mon)-1,parseInt(day),parseInt(hr),parseInt(min))
    if(!isNaN(d.getTime()))return d
  }
  const mfcMatch=s.match(/^([A-Za-z]{3})\s+(\d{1,2})(?:st|nd|rd|th),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i)
  if(mfcMatch){
    const[,mon,day,year,hr,min,ampm]=mfcMatch
    const months={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11}
    let h=parseInt(hr,10)
    if(ampm.toUpperCase()==='PM'&&h!==12)h+=12
    if(ampm.toUpperCase()==='AM'&&h===12)h=0
    const d=new Date(parseInt(year),months[mon.toLowerCase()],parseInt(day),h,parseInt(min))
    if(!isNaN(d.getTime()))return d
  }
  const d=new Date(s)
  if(!isNaN(d.getTime()))return d
  return null
}

function parseRows(rawText,platformId){
  const rate=TOKEN_RATES[platformId]||0.05
  const lines=rawText.split('\n').map(l=>l.trim()).filter(Boolean)
  const rows=[]
  let skipped=0
  const dateLineRe=/^([A-Za-z]{3}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}\s+[AP]M)/i
  const tipFromRe=/^Tip From:\s*(.+)/i
  const tokensLineRe=/^(\d+)\s+(\d+)$/
  const isMultiLine=lines.some(l=>tipFromRe.test(l))
  if(isMultiLine){
    let i=0
    while(i<lines.length){
      const dateMatch=lines[i].match(dateLineRe)
      if(dateMatch){
        const ts=tryParseDate(dateMatch[1])
        const actionLine=lines[i+1]||''
        const tipMatch=actionLine.match(tipFromRe)
        if(ts&&tipMatch){
          const username=tipMatch[1].trim()
          let tokensLine=lines[i+2]||''
          let note=''
          let tMatch=tokensLine.match(tokensLineRe)
          if(!tMatch&&lines[i+3]){note=tokensLine;tokensLine=lines[i+3]||'';tMatch=tokensLine.match(tokensLineRe)}
          if(tMatch){
            const tokens=parseInt(tMatch[1],10)
            if(tokens>=1){const usd=+(tokens*rate).toFixed(2);rows.push({ts,username,tokens,usd,note})}
            else skipped++
          }else skipped++
        }
        i++
      }else i++
    }
    return{rows,skipped}
  }
  const headerKw=['date','time','user','token','usd','tip','amount','note','message','from','type','stamp','earning','reference','private','voyeur','group','xfer','returned','fines','total','mfc','away','club','display','sort','period','payment','month','search']
  for(const line of lines){
    const cols=line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c=>c.trim().replace(/^"|"$/g,''))
    if(cols.length<2){skipped++;continue}
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
  for(const r of rows){
    const isoTs=r.ts.toISOString().replace('T',' ').slice(0,19)
    csvRows.push(`${isoTs},${r.username.replace(/,/g,'')},${r.tokens},${r.usd},${r.note.replace(/,/g,'')}`)
  }
  return{blob:new Blob([csvRows.join('\n')],{type:'text/csv'}),rowCount:rows.length,skipped}
}

function buildPreview(rawText,platformId,platformLabel){
  const{rows}=parseRows(rawText,platformId)
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
    topSpender:topSpender?{name:topSpender[0],tokens:topSpender[1]}:null,
    bestHour:bestHour?fmtHour(bestHour[0]):null,
    sampleRows:rows.slice(0,5).map(r=>({
      date:r.ts.toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}),
      fan:r.username,tokens:r.tokens,amount:r.usd,platform:platformLabel
    })),
  }
}

// ── Sparkle (PRESERVED) ────────────────────────────────────────
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

// ── CountUp (PRESERVED) ────────────────────────────────────────
function CountUp({to,prefix='',suffix='',duration=1000}){
  const[val,setVal]=useState(0)
  useEffect(()=>{
    const start=Date.now()
    const tick=()=>{const p=Math.min((Date.now()-start)/duration,1);const e=1-Math.pow(1-p,3);setVal(Math.round(e*to));if(p<1)requestAnimationFrame(tick)}
    requestAnimationFrame(tick)
  },[to,duration])
  return<>{prefix}{val.toLocaleString()}{suffix}</>
}

// ── Pro Upsell Modal (PRESERVED) ──────────────────────────────
function ProUpsellModal({platform,onSkip}){
  return(
    <div style={{position:'fixed',inset:0,zIndex:9998,background:'rgba(4,6,18,0.92)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{width:'100%',maxWidth:480,background:'linear-gradient(180deg,rgba(14,18,42,0.98),rgba(8,10,28,0.99))',borderRadius:24,position:'relative',boxShadow:'0 0 60px rgba(0,217,255,0.15),0 0 120px rgba(255,43,170,0.1)',border:'1px solid rgba(255,255,255,0.08)',padding:28}}>
        <div style={{textAlign:'center',marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:900,letterSpacing:'0.1em',textTransform:'uppercase',color:'#a78bfa',marginBottom:8}}>Unlock All Platforms</div>
          <h2 style={{fontSize:20,fontWeight:900,color:'#fff',marginBottom:6}}>You're adding {platform.label}</h2>
          <p style={{fontSize:13,color:'rgba(148,163,184,0.8)',lineHeight:1.6}}>Multi-platform tracking is a Pro feature. Upgrade to sync all platforms and see your full earnings picture.</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
          <div style={{background:'rgba(167,139,250,0.08)',border:'1.5px solid rgba(167,139,250,0.4)',borderRadius:14,padding:16,position:'relative'}}>
            <div style={{position:'absolute',top:0,right:0,background:'linear-gradient(135deg,#a78bfa,#7c3aed)',borderRadius:'0 14px 0 10px',padding:'3px 10px',fontSize:10,fontWeight:700,color:'#fff'}}>BEST DEAL</div>
            <div style={{fontSize:11,color:'#a78bfa',fontWeight:700,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.07em'}}>Early Adopter</div>
            <div style={{fontSize:24,fontWeight:900,color:'#fff',lineHeight:1}}>$9.99</div>
            <div style={{fontSize:11,color:'rgba(148,163,184,0.7)',marginBottom:12}}>/month · locked forever</div>
            {['All platforms','Save history forever','AI pattern learning','Fan behavior analysis','Lifetime price lock ✦'].map(f=>(
              <div key={f} style={{display:'flex',gap:6,alignItems:'center',fontSize:12,color:'rgba(203,213,225,0.9)',marginBottom:4}}><span style={{color:'#a78bfa'}}>✓</span>{f}</div>
            ))}
            <button onClick={()=>window.open('https://www.camcashgrl.com/pricing','_blank')} style={{width:'100%',marginTop:12,padding:'10px',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#a78bfa,#7c3aed)',color:'#fff',fontSize:13,fontWeight:700}}>Lock in $9.99/mo →</button>
          </div>
          <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:16}}>
            <div style={{fontSize:11,color:'rgba(148,163,184,0.7)',fontWeight:700,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.07em'}}>Standard</div>
            <div style={{fontSize:24,fontWeight:900,color:'#fff',lineHeight:1}}>$19.99</div>
            <div style={{fontSize:11,color:'rgba(148,163,184,0.7)',marginBottom:16}}>/month</div>
            {['All platforms','Save history forever','AI pattern learning','Fan behavior analysis'].map(f=>(
              <div key={f} style={{display:'flex',gap:6,alignItems:'center',fontSize:12,color:'rgba(148,163,184,0.8)',marginBottom:4}}><span style={{color:'#00D9FF'}}>✓</span>{f}</div>
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

// ── Live Mode Demo (PRESERVED) ─────────────────────────────────
function LiveModeDemo({onInstall,onSkip}){
  const PROMPTS=[
    {icon:'🐋',title:'Greet Returning Fan',body:'whaleking99 just entered. He tipped $180 last stream. Say hi by name.',impact:'+$40 avg when acknowledged'},
    {icon:'💡',title:'Mention Your Tip Menu',body:'22 active viewers, no tip in 7 min. Mention your toy or wheel menu.',impact:'+34% tip rate after prompt'},
    {icon:'🎯',title:'Refresh the Room Goal',body:'Tips slowed down. Try a smaller, faster goal to restart momentum.',impact:'Recovers dead zones in ~4 min'},
  ]
  const[idx,setIdx]=useState(0)
  const[earnings,setEarnings]=useState(42.50)
  const[score,setScore]=useState(74)
  useEffect(()=>{const t=setInterval(()=>{setEarnings(e=>+(e+(Math.random()*2.5)).toFixed(2));setScore(s=>Math.min(98,s+Math.floor(Math.random()*3)))},2200);return()=>clearInterval(t)},[])
  useEffect(()=>{const t=setInterval(()=>setIdx(i=>(i+1)%PROMPTS.length),3500);return()=>clearInterval(t)},[])
  const cur=PROMPTS[idx]
  return(
    <div style={{animation:'fadeUp 0.3s ease both'}}>
      <div style={{textAlign:'center',marginBottom:20}}>
        <div style={{fontSize:10,fontWeight:900,letterSpacing:'0.2em',textTransform:'uppercase',color:'#FF2BAA',marginBottom:8}}>Live Mode Preview</div>
        <h2 style={{fontSize:20,fontWeight:900,color:'#fff',marginBottom:6,letterSpacing:'-0.02em'}}>This is CamCash during your stream</h2>
        <p style={{fontSize:13,color:'rgba(166,168,189,0.9)',lineHeight:1.6}}>While you stream, CamCash watches your room and tells you exactly what to do to earn more.</p>
      </div>
      <div style={{background:'rgba(4,6,18,0.85)',border:'1px solid rgba(0,217,255,0.2)',borderRadius:16,padding:16,marginBottom:16,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:'linear-gradient(90deg,transparent,#00D9FF,#6C5CFF,#FF2BAA,transparent)',animation:'shimmer 2.5s linear infinite'}}/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
          {[{label:'Live Score',value:`${score}/100`,color:'#00D9FF'},{label:'Earnings/hr',value:`$${(earnings*2.4).toFixed(0)}/hr`,color:'#4ade80'},{label:'Prompts followed',value:'5/7',color:'#a78bfa'}].map(s=>(
            <div key={s.label} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:'8px 10px'}}>
              <div style={{fontSize:9,color:'rgba(148,163,184,0.5)',marginBottom:3,textTransform:'uppercase',letterSpacing:'0.06em'}}>{s.label}</div>
              <div style={{fontSize:14,fontWeight:800,color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(0,217,255,0.25)',borderRadius:12,padding:14}}>
          <div style={{display:'flex',gap:10,marginBottom:8}}>
            <div style={{width:36,height:36,borderRadius:10,background:'rgba(0,217,255,0.1)',border:'1px solid rgba(0,217,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{cur.icon}</div>
            <div>
              <div style={{fontSize:9,fontWeight:700,color:'#00D9FF',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2}}>Coach Prompt</div>
              <div style={{fontSize:12,fontWeight:700,color:'#fff',marginBottom:2}}>{cur.title}</div>
              <div style={{fontSize:11,color:'rgba(148,163,184,0.8)',lineHeight:1.5}}>{cur.body}</div>
            </div>
          </div>
          <div style={{fontSize:10,color:'rgba(74,222,128,0.8)',marginBottom:8}}>📈 {cur.impact}</div>
          <div style={{display:'flex',gap:6}}>
            {['✓ Done','⏸ Snooze','✕ Ignore'].map((l,i)=>(
              <button key={l} style={{flex:i===0?2:1,padding:'6px',borderRadius:7,border:'none',cursor:'pointer',fontSize:11,fontWeight:700,background:i===0?'linear-gradient(90deg,#00D9FF,#6C5CFF)':'rgba(255,255,255,0.06)',color:i===0?'#04101b':'rgba(148,163,184,0.7)'}}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'center',gap:5,marginTop:10}}>
          {PROMPTS.map((_,i)=>(<div key={i} onClick={()=>setIdx(i)} style={{width:i===idx?16:5,height:5,borderRadius:3,background:i===idx?'#00D9FF':'rgba(255,255,255,0.15)',transition:'all 0.3s',cursor:'pointer'}}/>))}
        </div>
      </div>
      <button onClick={onInstall} style={{width:'100%',height:50,borderRadius:14,border:'none',background:'linear-gradient(90deg,#00D9FF,#6C5CFF,#FF2BAA)',color:'#fff',fontSize:14,fontWeight:900,cursor:'pointer',boxShadow:'0 0 28px rgba(0,217,255,0.25),0 0 50px rgba(255,43,170,0.15)',marginBottom:10}}>Install Live Tracker — it's free →</button>
      <div style={{textAlign:'center'}}>
        <button onClick={onSkip} style={{background:'none',border:'none',fontSize:12,color:'rgba(0,217,255,0.7)',cursor:'pointer'}}>Skip — go to dashboard first</button>
      </div>
    </div>
  )
}

// ── FeedbackBubble (PRESERVED) ─────────────────────────────────
function FeedbackBubble(){
  const[open,setOpen]=useState(true)
  if(!open)return(
    <button onClick={()=>setOpen(true)} style={{position:'fixed',bottom:20,right:20,zIndex:50,display:'flex',alignItems:'center',gap:7,padding:'8px 16px',borderRadius:100,background:'rgba(8,11,26,0.92)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(148,163,184,0.9)',fontSize:12,fontWeight:700,cursor:'pointer',backdropFilter:'blur(20px)'}}>💬 Feedback</button>
  )
  return(
    <div style={{position:'fixed',bottom:20,right:20,zIndex:50,maxWidth:280,borderRadius:18,border:'1px solid rgba(200,43,255,0.25)',background:'rgba(8,11,26,0.96)',padding:14,backdropFilter:'blur(20px)',boxShadow:'0 0 30px rgba(255,43,170,0.1)'}}>
      <button onClick={()=>setOpen(false)} style={{position:'absolute',top:8,right:8,background:'none',border:'none',color:'rgba(100,116,139,0.7)',cursor:'pointer',fontSize:14}}>✕</button>
      <p style={{fontSize:13,fontWeight:700,color:'#C9B8FF',lineHeight:1.6,paddingRight:16,marginBottom:10}}>Having trouble with this step? We'd love your feedback.</p>
      <button style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',borderRadius:100,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.035)',color:'rgba(148,163,184,0.9)',fontSize:11,fontWeight:700,cursor:'pointer'}}>💬 Feedback</button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// NEW DESIGN COMPONENTS
// ══════════════════════════════════════════════════════════════

const C = {
  cyan: '#21E6F3',
  pink: '#FF2FAE',
  violet: '#8B5CF6',
  navy: '#070A18',
  card: 'rgba(8,10,25,0.85)',
  text: '#F8FAFC',
  muted: '#A6A8BD',
  dim: 'rgba(166,168,189,0.55)',
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',system-ui,sans-serif}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
  @keyframes glowPulse{0%,100%{box-shadow:0 0 30px rgba(33,230,243,0.2),0 0 60px rgba(255,47,174,0.15)}50%{box-shadow:0 0 50px rgba(33,230,243,0.35),0 0 90px rgba(255,47,174,0.25)}}
  @keyframes checkIn{from{transform:scale(0) rotate(-20deg);opacity:0}to{transform:scale(1) rotate(0);opacity:1}}
  @keyframes flashPulse{0%{background:rgba(255,255,255,0)}20%{background:rgba(255,255,255,0.05)}100%{background:rgba(255,255,255,0)}}
  @keyframes starFloat{0%,100%{transform:translateY(0) rotate(0deg);opacity:0.6}50%{transform:translateY(-8px) rotate(180deg);opacity:1}}
  @keyframes countUp{from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}}
  textarea::placeholder{color:rgba(166,168,189,0.4);font-family:monospace;font-size:12px;line-height:1.6}
  input::placeholder{color:rgba(166,168,189,0.4)}
  input:focus,textarea:focus{outline:none}
  button{font-family:inherit;cursor:pointer}
  @media(max-width:600px){
    .ob-card{padding:22px 18px 20px!important;width:calc(100vw - 20px)!important;border-radius:24px!important}
    .ob-platform-row{flex-direction:column!important}
    .ob-broadcaster-row{flex-wrap:wrap!important}
  }
`

// Logo
function OBLogo(){
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:18}}>
      <div style={{width:32,height:32,borderRadius:10,background:'linear-gradient(135deg,#21E6F3,#6C5CFF,#FF2BAA)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:900,color:'#fff',boxShadow:'0 0 20px rgba(33,230,243,0.4)'}}>$</div>
      <div style={{fontSize:20,fontWeight:900,letterSpacing:'-0.03em'}}>
        <span style={{color:'#fff'}}>Cam</span>
        <span style={{background:'linear-gradient(90deg,#21E6F3,#FF2FAE)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Cash</span>
      </div>
    </div>
  )
}

// Progress dots — Stats / Tips / Done (matching reference image)
function OBProgress({current}){
  // current: 1=Stats/Connect, 2=Tips/Import, 3=Done/Analyze
  const steps=[{n:1,label:'Stats'},{n:2,label:'Tips'},{n:3,label:'Done'}]
  return(
    <div style={{marginBottom:20}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',maxWidth:240,margin:'0 auto 6px'}}>
        {steps.map((s,i)=>(
          <div key={s.n} style={{display:'flex',alignItems:'center',flex:i<2?1:'none'}}>
            <div style={{
              width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:11,fontWeight:800,flexShrink:0,transition:'all 0.35s',
              background: s.n<current ? 'linear-gradient(135deg,#21E6F3,#6C5CFF)' : s.n===current ? 'linear-gradient(135deg,#21E6F3,#6C5CFF)' : 'rgba(255,255,255,0.05)',
              border: s.n>current ? '1px solid rgba(255,255,255,0.12)' : 'none',
              color: s.n<=current ? '#04101b' : 'rgba(255,255,255,0.25)',
              boxShadow: s.n===current ? '0 0 20px rgba(33,230,243,0.6),0 0 40px rgba(33,230,243,0.2)' : s.n<current ? '0 0 14px rgba(33,230,243,0.4)' : 'none',
            }}>
              {s.n<current ? '✓' : s.n}
            </div>
            {i<2&&<div style={{height:1.5,flex:1,borderRadius:2,background:current>s.n?'linear-gradient(90deg,#21E6F3,#FF2FAE)':'rgba(255,255,255,0.1)',transition:'all 0.35s',margin:'0 3px'}}/>}
          </div>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',maxWidth:240,margin:'0 auto'}}>
        {steps.map(s=>(
          <div key={s.n} style={{width:28,textAlign:'center',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:s.n<=current?'rgba(33,230,243,0.9)':'rgba(255,255,255,0.2)',transition:'all 0.35s'}}>{s.label}</div>
        ))}
      </div>
    </div>
  )
}

// Primary gradient button
function OBBtn({onClick,children,disabled=false,style={}}){
  return(
    <button onClick={onClick} disabled={disabled} style={{
      width:'100%',height:48,borderRadius:14,border:'none',
      background:disabled?'rgba(255,255,255,0.07)':'linear-gradient(90deg,#21E6F3,#6C5CFF,#FF2FAE)',
      color:disabled?'rgba(255,255,255,0.25)':'#fff',fontSize:14,fontWeight:900,
      cursor:disabled?'not-allowed':'pointer',letterSpacing:'-0.01em',
      boxShadow:disabled?'none':'0 0 24px rgba(33,230,243,0.22),0 0 50px rgba(255,47,174,0.14)',
      transition:'all 0.18s',display:'flex',alignItems:'center',justifyContent:'center',gap:7,
      ...style
    }}
    onMouseEnter={e=>{if(!disabled){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 0 36px rgba(33,230,243,0.32),0 0 70px rgba(255,47,174,0.22)'}}}
    onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=disabled?'none':'0 0 24px rgba(33,230,243,0.22),0 0 50px rgba(255,47,174,0.14)'}}
    onMouseDown={e=>{if(!disabled)e.currentTarget.style.transform='translateY(0)'}}
    >{children}</button>
  )
}

// Secondary/ghost button
function OBSecBtn({onClick,children,style={}}){
  return(
    <button onClick={onClick} style={{
      height:42,padding:'0 16px',borderRadius:12,border:'1px solid rgba(255,255,255,0.12)',
      background:'rgba(255,255,255,0.04)',color:'rgba(203,213,225,0.85)',fontSize:13,
      fontWeight:700,transition:'all 0.18s',...style
    }}
    onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(33,230,243,0.4)';e.currentTarget.style.color='#fff';e.currentTarget.style.background='rgba(33,230,243,0.06)'}}
    onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.12)';e.currentTarget.style.color='rgba(203,213,225,0.85)';e.currentTarget.style.background='rgba(255,255,255,0.04)'}}
    >{children}</button>
  )
}

// Dark glass input
function OBInput({value,onChange,onKeyDown,placeholder,type='text',style={},suffix}){
  const[focused,setFocused]=useState(false)
  return(
    <div style={{position:'relative'}}>
      <input type={type} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder}
        onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
        style={{width:'100%',padding:'11px 14px',background:'rgba(5,8,22,0.9)',border:`1px solid ${focused?'rgba(33,230,243,0.6)':'rgba(255,255,255,0.1)'}`,borderRadius:12,color:'#f8fafc',fontSize:13,boxShadow:focused?'0 0 0 3px rgba(33,230,243,0.08),inset 0 1px 0 rgba(255,255,255,0.04)':'inset 0 1px 0 rgba(255,255,255,0.04)',transition:'border-color 0.2s,box-shadow 0.2s',...style}}
      />
      {suffix&&<div style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)'}}>{suffix}</div>}
    </div>
  )
}

// Muted text links row
function OBLinks({links}){
  return(
    <div style={{display:'flex',justifyContent:'center',gap:18,marginTop:12,flexWrap:'wrap'}}>
      {links.map((l,i)=>(
        <button key={i} onClick={l.onClick} style={{background:'none',border:'none',fontSize:11,color:'rgba(100,116,139,0.75)',cursor:'pointer',transition:'color 0.2s'}}
        onMouseEnter={e=>e.currentTarget.style.color='#21E6F3'}
        onMouseLeave={e=>e.currentTarget.style.color='rgba(100,116,139,0.75)'}
        >{l.label}</button>
      ))}
    </div>
  )
}

// Trust lock line
function OBTrust(){
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,marginTop:14,fontSize:10,color:'rgba(100,116,139,0.6)'}}>
      <span>🔒</span><span>Your data is stored securely and never shared.</span>
    </div>
  )
}

// Small eyebrow label
function OBEyebrow({children}){
  return <div style={{fontSize:9,fontWeight:900,letterSpacing:'0.25em',textTransform:'uppercase',color:'rgba(33,230,243,0.85)',marginBottom:8,textAlign:'center'}}>{children}</div>
}

// Step heading
function OBHeading({title,sub}){
  return(
    <div style={{textAlign:'center',marginBottom:18}}>
      <h1 style={{fontSize:22,fontWeight:900,color:'#F8FAFC',letterSpacing:'-0.025em',lineHeight:1.15,marginBottom:7}}>{title}</h1>
      {sub&&<p style={{fontSize:13,color:'#A6A8BD',lineHeight:1.6,maxWidth:380,margin:'0 auto'}}>{sub}</p>}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function OnboardingPage(){
  const router=useRouter()
  const[user,setUser]=useState(null)
  const[booting,setBooting]=useState(true)

  // PRESERVED STATE
  const[step,setStep]=useState('platform')
  const[platformId,setPlatformId]=useState('chaturbate')
  const[cbUsername,setCbUsername]=useState('')
  const[cbUsernameError,setCbUsernameError]=useState('')
  const[broadcasterType,setBroadcasterType]=useState('female')
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
  // Map steps to progress dot number
  const stepNum={platform:1,username:1,paste:2,csv:2,preview:2,loading:3,live:3,step4:3,done:3}[step]||1
  const showProgress=!['loading'].includes(step)

  // PRESERVED AUTH
  useEffect(()=>{
    ;(async()=>{
      const{data:{user}}=await supabase.auth.getUser()
      if(!user){router.replace('/login');return}
      const{data}=await supabase.from('beta_users').select('onboarding_complete').eq('user_id',user.id).single()
      if(data?.onboarding_complete){router.replace('/dashboard');return}
      setUser(user);setBooting(false)
    })()
  },[router])

  // PRESERVED HANDLERS
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
      if(isFirstImport){setIsFirstImport(false);setShowSparkle(true);setTimeout(()=>setShowSparkle(false),4000);setStep('live')}
      else setStep('step4')
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
      if(isFirstImport){setIsFirstImport(false);setShowSparkle(true);setTimeout(()=>setShowSparkle(false),4000);setStep('live')}
      else setStep('step4')
    }catch(e){setCsvError(e.message||'Upload failed');setStep('csv')}
    finally{setCsvUploading(false)}
  }

  async function skipToDashboard(){await markDone();router.push('/dashboard')}

  if(booting)return(
    <div style={{minHeight:'100vh',background:'#070A18',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:28,height:28,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.08)',borderTopColor:'#21E6F3',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const msgs=isFirstImport?LOADING_MESSAGES:EXTRA_MSGS

  return(
    <main style={{position:'relative',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',background:'#070A18',fontFamily:"'Inter',system-ui,sans-serif",color:'#fff',overflow:'hidden'}}>
      <style>{CSS}</style>

      {/* ── BACKGROUND ── */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0}}>
        {/* Cyan glow left */}
        <div style={{position:'absolute',left:'-5%',top:'10%',width:500,height:500,borderRadius:'50%',background:'rgba(33,230,243,0.12)',filter:'blur(90px)'}}/>
        {/* Pink glow right */}
        <div style={{position:'absolute',right:'-5%',bottom:'10%',width:520,height:520,borderRadius:'50%',background:'rgba(255,47,174,0.11)',filter:'blur(100px)'}}/>
        {/* Violet center */}
        <div style={{position:'absolute',left:'40%',top:'40%',width:350,height:350,borderRadius:'50%',background:'rgba(139,92,246,0.07)',filter:'blur(80px)'}}/>
        {/* Star grid */}
        <div style={{position:'absolute',inset:0,opacity:0.08,backgroundImage:'radial-gradient(rgba(255,255,255,0.5) 1px,transparent 1px)',backgroundSize:'28px 28px'}}/>
      </div>

      {showSparkle&&<Sparkle/>}
      {showUpsell&&pendingPlatform&&<ProUpsellModal platform={PLATFORMS[pendingPlatform]} onSkip={handleUpsellSkip}/>}
      <FeedbackBubble/>

      {/* ── CARD ── */}
      <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:480}}>
        {/* Neon glow rim */}
        <div style={{position:'absolute',inset:-1,borderRadius:31,background:'linear-gradient(135deg,rgba(33,230,243,0.7) 0%,rgba(139,92,246,0.3) 50%,rgba(255,47,174,0.7) 100%)',zIndex:-1}}/>
        {/* Glass card */}
        <div className="ob-card" style={{
          borderRadius:30,border:'1px solid rgba(255,255,255,0.08)',
          background:'rgba(8,10,25,0.88)',backdropFilter:'blur(24px)',
          padding:'28px 30px 24px',
          boxShadow:'0 0 60px rgba(33,230,243,0.12),0 0 100px rgba(255,47,174,0.1),0 20px 60px rgba(0,0,0,0.5)',
        }}>

          {/* Logo + progress inside card */}
          {!['loading'].includes(step)&&(
            <header>
              <OBLogo/>
              {showProgress&&<OBProgress current={stepNum}/>}
            </header>
          )}

          {/* ══ STEP: PLATFORM (Connect Account) ══ */}
          {step==='platform'&&(
            <div style={{animation:'fadeUp 0.3s ease both'}}>
              <OBEyebrow>Step 1 of 3</OBEyebrow>
              <OBHeading title="Start tracking your streams" sub="Choose your platform so CamCash can import your tip history and build your first insights."/>

              {/* Platform selector — compact tabs not big cards */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:600,color:'rgba(166,168,189,0.7)',marginBottom:8,letterSpacing:'0.06em',textTransform:'uppercase'}}>Platform</div>
                <div className="ob-platform-row" style={{display:'flex',gap:8}}>
                  {Object.entries(PLATFORMS).map(([key,p])=>{
                    const sel=platformId===key
                    return(
                      <button key={key} onClick={()=>setPlatformId(key)} style={{
                        flex:1,padding:'10px 8px',borderRadius:12,textAlign:'center',
                        background:sel?'rgba(33,230,243,0.1)':'rgba(255,255,255,0.04)',
                        border:sel?'1.5px solid rgba(33,230,243,0.8)':'1px solid rgba(255,255,255,0.1)',
                        boxShadow:sel?'0 0 16px rgba(33,230,243,0.2)':'none',
                        cursor:'pointer',transition:'all 0.2s',
                      }}>
                        <div style={{width:32,height:32,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,margin:'0 auto 5px',...p.iconStyle}}>{p.short}</div>
                        <div style={{fontSize:11,fontWeight:700,color:sel?'#fff':'rgba(255,255,255,0.45)'}}>{p.label}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Broadcaster type */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:600,color:'rgba(166,168,189,0.7)',marginBottom:8,letterSpacing:'0.06em',textTransform:'uppercase'}}>I broadcast as</div>
                <div className="ob-broadcaster-row" style={{display:'flex',gap:7}}>
                  {['Female','Male','Trans','Couple'].map(t=>{
                    const sel=broadcasterType===t.toLowerCase()
                    return(
                      <button key={t} onClick={()=>setBroadcasterType(t.toLowerCase())} style={{
                        flex:1,padding:'8px 4px',borderRadius:10,fontSize:12,fontWeight:700,
                        background:sel?'rgba(33,230,243,0.1)':'rgba(255,255,255,0.04)',
                        border:sel?'1.5px solid rgba(33,230,243,0.7)':'1px solid rgba(255,255,255,0.1)',
                        color:sel?'#21E6F3':'rgba(166,168,189,0.7)',
                        boxShadow:sel?'0 0 12px rgba(33,230,243,0.15)':'none',
                        cursor:'pointer',transition:'all 0.18s',
                      }}>{t}</button>
                    )
                  })}
                </div>
              </div>

              <OBBtn onClick={()=>selectPlatform(platformId)} style={{marginBottom:10}}>
                Continue to Tip Import →
              </OBBtn>
              <div style={{textAlign:'center'}}>
                <button onClick={skipToDashboard} style={{background:'none',border:'none',fontSize:12,color:'rgba(33,230,243,0.65)',cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.color='#21E6F3'}
                  onMouseLeave={e=>e.currentTarget.style.color='rgba(33,230,243,0.65)'}
                >Skip for now</button>
              </div>
            </div>
          )}

          {/* ══ STEP: USERNAME ══ */}
          {step==='username'&&(
            <div style={{animation:'fadeUp 0.3s ease both'}}>
              <OBEyebrow>Step 1 of 3 — Chaturbate</OBEyebrow>
              <OBHeading title="Start tracking your streams" sub="Enter your Chaturbate username so we can open your token stats page directly."/>

              {/* Broadcaster type */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:600,color:'rgba(166,168,189,0.7)',marginBottom:7,letterSpacing:'0.06em',textTransform:'uppercase'}}>I broadcast as</div>
                <div style={{display:'flex',gap:7}}>
                  {['Female','Male','Trans','Couple'].map(t=>{
                    const sel=broadcasterType===t.toLowerCase()
                    return(
                      <button key={t} onClick={()=>setBroadcasterType(t.toLowerCase())} style={{
                        flex:1,padding:'8px 4px',borderRadius:10,fontSize:11,fontWeight:700,
                        background:sel?'rgba(33,230,243,0.1)':'rgba(255,255,255,0.04)',
                        border:sel?'1.5px solid rgba(33,230,243,0.7)':'1px solid rgba(255,255,255,0.1)',
                        color:sel?'#21E6F3':'rgba(166,168,189,0.7)',
                        boxShadow:sel?'0 0 12px rgba(33,230,243,0.15)':'none',
                        cursor:'pointer',transition:'all 0.18s',
                      }}>{t}</button>
                    )
                  })}
                </div>
              </div>

              {/* Username input */}
              <div style={{marginBottom:18}}>
                <div style={{fontSize:11,fontWeight:600,color:'rgba(166,168,189,0.7)',marginBottom:6,letterSpacing:'0.06em',textTransform:'uppercase'}}>Chaturbate username</div>
                <OBInput
                  value={cbUsername}
                  onChange={e=>{setCbUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,''));setCbUsernameError('')}}
                  onKeyDown={e=>e.key==='Enter'&&handleUsernameSubmit()}
                  placeholder="your_username"
                />
                {cbUsernameError&&<div style={{marginTop:6,fontSize:12,color:'#f87171'}}>⚠️ {cbUsernameError}</div>}
                {cbUsername&&(
                  <div style={{marginTop:6,fontSize:11,color:'rgba(100,116,139,0.7)'}}>
                    Your stats page: <span style={{color:'#21E6F3'}}>chaturbate.com/p/{cbUsername}/?tab=tokens</span>
                  </div>
                )}
                <div style={{marginTop:5,fontSize:10,color:'rgba(166,168,189,0.45)'}}>Exact username you use to broadcast (not display name)</div>
              </div>

              <OBBtn onClick={handleUsernameSubmit} style={{marginBottom:10}}>Continue to Tip Import →</OBBtn>
              <OBLinks links={[
                {label:'← Back',onClick:()=>setStep('platform')},
                {label:"Skip — I'll navigate there myself",onClick:()=>{setCbUsername('');setStep('paste')}},
              ]}/>
              <OBTrust/>
            </div>
          )}

          {/* ══ STEP: PASTE ══ */}
          {step==='paste'&&(
            <div style={{animation:'fadeUp 0.3s ease both'}}>
              <OBEyebrow>Step 2 of 3 — {platform.label}</OBEyebrow>
              <OBHeading title="Paste your tip history" sub={`Copy your earning rows from ${platform.label} and paste them below. We'll clean the data and detect everything automatically.`}/>

              {/* How to copy helper */}
              <div style={{borderRadius:12,border:'1px solid rgba(33,230,243,0.18)',background:'rgba(33,230,243,0.04)',padding:'11px 14px',marginBottom:12}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:8}}>
                  <div style={{fontSize:10,fontWeight:800,color:'rgba(33,230,243,0.85)',letterSpacing:'0.12em',textTransform:'uppercase'}}>How to copy from {platform.label}</div>
                  <a href={platform.earningsUrl(cbUsername)} target="_blank" rel="noreferrer" style={{flexShrink:0,padding:'4px 10px',borderRadius:8,border:'1px solid rgba(33,230,243,0.3)',background:'rgba(33,230,243,0.06)',color:'rgba(33,230,243,0.85)',fontSize:10,fontWeight:700,textDecoration:'none',whiteSpace:'nowrap'}}>Open earnings page ↗</a>
                </div>
                <ul style={{listStyle:'none',padding:0,margin:0}}>
                  {platform.instructions.split('. ').filter(Boolean).map((t,i)=>(
                    <li key={i} style={{fontSize:11,color:'rgba(166,168,189,0.85)',lineHeight:1.5,marginBottom:3,display:'flex',gap:6,alignItems:'flex-start'}}>
                      <span style={{color:'rgba(33,230,243,0.6)',flexShrink:0}}>·</span>{t.trim()}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Textarea */}
              <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)} placeholder={platform.placeholder}
                style={{width:'100%',height:130,resize:'none',borderRadius:12,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(5,8,22,0.92)',padding:'12px 14px',fontFamily:'monospace',fontSize:11,lineHeight:1.65,color:'#e2e8f0',outline:'none',transition:'border-color 0.2s,box-shadow 0.2s',marginBottom:parseError?8:12}}
                onFocus={e=>{e.target.style.borderColor='rgba(33,230,243,0.6)';e.target.style.boxShadow='0 0 0 3px rgba(33,230,243,0.08)'}}
                onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.1)';e.target.style.boxShadow='none'}}
              />

              {parseError&&<div style={{marginBottom:10,padding:'9px 12px',borderRadius:10,background:'rgba(248,113,113,0.07)',border:'1px solid rgba(248,113,113,0.22)',fontSize:12,color:'#f87171'}}>⚠️ {parseError}</div>}

              {/* Mini chips */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
                {['Open your earnings page','Highlight the rows','Copy and paste here'].map((t,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:6,fontSize:10,color:'rgba(166,168,189,0.8)'}}>
                    <div style={{width:18,height:18,borderRadius:'50%',border:'1px solid rgba(33,230,243,0.3)',background:'rgba(33,230,243,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,color:'#21E6F3',flexShrink:0}}>{i+1}</div>
                    <span>{t}</span>
                  </div>
                ))}
              </div>

              <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:8,marginBottom:4}}>
                <OBSecBtn onClick={()=>setStep('platform')} style={{height:46}}>← Back</OBSecBtn>
                <OBBtn onClick={handlePreview} disabled={!pasteText.trim()} style={{height:46,fontSize:13}}>Preview Import →</OBBtn>
              </div>
              <OBLinks links={[{label:'Upload CSV instead',onClick:()=>setStep('csv')},{label:'Track future tips instead',onClick:skipToDashboard}]}/>
              <OBTrust/>
            </div>
          )}

          {/* ══ STEP: CSV ══ */}
          {step==='csv'&&(
            <div style={{animation:'fadeUp 0.3s ease both'}}>
              <OBEyebrow>Step 2 of 3 — {platform.label}</OBEyebrow>
              <OBHeading title="Upload your CSV" sub="Export your earnings as a CSV file and drop it below."/>
              <div onClick={()=>!csvUploading&&csvRef.current?.click()}
                style={{border:'2px dashed rgba(255,255,255,0.1)',borderRadius:16,padding:'36px 20px',textAlign:'center',cursor:csvUploading?'not-allowed':'pointer',background:'rgba(255,255,255,0.02)',marginBottom:12,transition:'all 0.2s'}}
                onMouseEnter={e=>{if(!csvUploading){e.currentTarget.style.borderColor='rgba(33,230,243,0.35)';e.currentTarget.style.background='rgba(33,230,243,0.03)'}}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';e.currentTarget.style.background='rgba(255,255,255,0.02)'}}
              >
                <input ref={csvRef} type="file" accept=".csv,.txt" style={{display:'none'}} onChange={e=>{const f=e.target.files[0];if(f)handleCsvUpload(f)}}/>
                {csvUploading?(<><div style={{width:24,height:24,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.1)',borderTopColor:'#21E6F3',animation:'spin 0.8s linear infinite',margin:'0 auto 10px'}}/><div style={{fontSize:13,color:'#21E6F3',fontWeight:500}}>Uploading…</div></>):(<><div style={{fontSize:28,marginBottom:8}}>📁</div><div style={{fontSize:13,fontWeight:700,color:'#f8fafc',marginBottom:3}}>Drop your CSV here or click to browse</div><div style={{fontSize:11,color:'rgba(166,168,189,0.55)'}}>Supports {platform.label} export format</div></>)}
              </div>
              {csvError&&<div style={{marginBottom:12,padding:'9px 12px',borderRadius:10,background:'rgba(248,113,113,0.07)',border:'1px solid rgba(248,113,113,0.22)',fontSize:12,color:'#f87171'}}>⚠️ {csvError}</div>}
              <div style={{display:'flex',gap:8}}>
                <OBSecBtn onClick={()=>setStep('paste')} style={{flex:1}}>← Use paste instead</OBSecBtn>
                <OBSecBtn onClick={()=>setStep('platform')} style={{flex:1}}>← Back</OBSecBtn>
              </div>
              <OBTrust/>
            </div>
          )}

          {/* ══ STEP: PREVIEW ══ */}
          {step==='preview'&&preview&&(
            <div style={{animation:'fadeUp 0.3s ease both'}}>
              <OBEyebrow>Review Import</OBEyebrow>
              <OBHeading title="Review your import" sub="We found your tip history. Confirm everything looks right, then CamCash will build your dashboard."/>

              {/* Confirmed banner */}
              <div style={{borderRadius:12,border:'1px solid rgba(33,230,243,0.25)',background:'rgba(33,230,243,0.06)',padding:'12px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:30,height:30,borderRadius:10,background:'rgba(33,230,243,0.15)',border:'1px solid rgba(33,230,243,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0,animation:'checkIn 0.35s ease both'}}>✓</div>
                <div>
                  <div style={{fontSize:13,fontWeight:900,color:'#fff'}}>{preview.tipsDetected.toLocaleString()} tips found</div>
                  <div style={{fontSize:11,color:'rgba(166,168,189,0.75)'}}>CamCash detected earnings, fans, dates, and platform data.</div>
                </div>
              </div>

              {/* Stat grid */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:12}}>
                {[
                  {label:'Tips detected',value:preview.tipsDetected.toLocaleString(),color:'#21E6F3'},
                  {label:'Est. earnings',value:`$${preview.estimatedEarnings.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`,color:'#4ade80'},
                  {label:'Fans detected',value:preview.fansDetected.toLocaleString(),color:'#a78bfa'},
                  {label:'Date range',value:preview.dateRange,color:'#F8FAFC'},
                  {label:'Platform',value:platform.label,color:'#F8FAFC'},
                ].map(s=>(
                  <div key={s.label} style={{borderRadius:12,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.03)',padding:'11px 13px'}}>
                    <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.14em',color:'rgba(71,85,105,0.9)',marginBottom:5}}>{s.label}</div>
                    <div style={{fontSize:15,fontWeight:900,color:s.color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Sample rows */}
              <div style={{borderRadius:12,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.025)',marginBottom:12,overflow:'hidden'}}>
                <div style={{padding:'9px 13px',borderBottom:'1px solid rgba(255,255,255,0.07)',fontSize:11,fontWeight:800,color:'#fff'}}>Sample rows</div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',minWidth:440,borderCollapse:'collapse',fontSize:11}}>
                    <thead>
                      <tr style={{borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
                        {['Date','Fan','Tokens','Amount'].map(h=>(
                          <th key={h} style={{padding:'7px 12px',textAlign:'left',fontWeight:700,color:'rgba(71,85,105,0.9)',fontSize:9,textTransform:'uppercase',letterSpacing:'0.08em'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sampleRows.slice(0,4).map((r,i)=>(
                        <tr key={i} style={{borderBottom:i<3?'1px solid rgba(255,255,255,0.05)':'none'}}>
                          <td style={{padding:'7px 12px',color:'rgba(148,163,184,0.8)'}}>{r.date}</td>
                          <td style={{padding:'7px 12px',fontWeight:700,color:'#fff'}}>{r.fan}</td>
                          <td style={{padding:'7px 12px',color:'rgba(148,163,184,0.8)'}}>{r.tokens}</td>
                          <td style={{padding:'7px 12px',color:'#21E6F3'}}>${r.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {importError&&<div style={{marginBottom:10,padding:'9px 12px',borderRadius:10,background:'rgba(248,113,113,0.07)',border:'1px solid rgba(248,113,113,0.22)',fontSize:12,color:'#f87171'}}>⚠️ {importError}</div>}

              <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:8,marginBottom:4}}>
                <OBSecBtn onClick={()=>setStep('paste')} style={{height:46}}>← Back</OBSecBtn>
                <OBBtn onClick={handleImport} style={{height:46,fontSize:13}}>Import & Continue →</OBBtn>
              </div>
              <OBLinks links={[{label:'Paste more rows',onClick:()=>setStep('paste')},{label:'Upload CSV instead',onClick:()=>setStep('csv')},{label:'Track future tips instead',onClick:skipToDashboard}]}/>
              <OBTrust/>
            </div>
          )}

          {/* ══ STEP: LOADING / ANALYZING ══ */}
          {step==='loading'&&(
            <div style={{animation:'fadeUp 0.3s ease both'}}>
              {/* Logo shown in loading too */}
              <OBLogo/>
              {/* Custom 3-dot for loading — step 3 active */}
              <div style={{marginBottom:20}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',maxWidth:240,margin:'0 auto 6px'}}>
                  {[{n:1},{n:2},{n:3}].map((s,i)=>(
                    <div key={s.n} style={{display:'flex',alignItems:'center',flex:i<2?1:'none'}}>
                      <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,flexShrink:0,background:s.n<3?'linear-gradient(135deg,#21E6F3,#6C5CFF)':s.n===3?'linear-gradient(135deg,#21E6F3,#6C5CFF)':'rgba(255,255,255,0.05)',color:'#04101b',boxShadow:s.n===3?'0 0 20px rgba(33,230,243,0.6)':s.n<3?'0 0 14px rgba(33,230,243,0.4)':'none'}}>
                        {s.n<3?'✓':s.n}
                      </div>
                      {i<2&&<div style={{height:1.5,flex:1,background:'linear-gradient(90deg,#21E6F3,#FF2FAE)',margin:'0 3px'}}/>}
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',justifyContent:'space-between',maxWidth:240,margin:'0 auto'}}>
                  {['Stats','Tips','Done'].map((l,i)=>(
                    <div key={l} style={{width:28,textAlign:'center',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:i<2?'rgba(33,230,243,0.5)':'rgba(33,230,243,0.9)'}}>{l}</div>
                  ))}
                </div>
              </div>

              <div style={{textAlign:'center',marginBottom:20}}>
                <div style={{fontSize:9,fontWeight:900,letterSpacing:'0.25em',textTransform:'uppercase',color:'rgba(33,230,243,0.85)',marginBottom:8}}>Step 3 of 3</div>
                <h1 style={{fontSize:22,fontWeight:900,color:'#F8FAFC',letterSpacing:'-0.025em',marginBottom:7}}>Analyzing your data</h1>
                <p style={{fontSize:12,color:'#A6A8BD',lineHeight:1.6}}>This usually takes about 30–60 seconds.</p>
              </div>

              {/* Big progress bar */}
              <div style={{marginBottom:18}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontSize:10,color:'rgba(166,168,189,0.6)'}}>Progress</span>
                  <span style={{fontSize:10,color:'#21E6F3',fontWeight:700}}>{loadingProgress}%</span>
                </div>
                <div style={{height:8,borderRadius:100,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${loadingProgress}%`,background:'linear-gradient(90deg,#21E6F3,#6C5CFF,#FF2FAE)',borderRadius:100,boxShadow:'0 0 16px rgba(33,230,243,0.4)',transition:'width 0.1s linear'}}/>
                </div>
              </div>

              {/* Checklist */}
              <div style={{marginBottom:16}}>
                {LOADING_MESSAGES.map((m,i)=>{
                  const done=loadingProgress>=((i+1)/LOADING_MESSAGES.length)*95
                  const active=!done&&loadingProgress>=(i/LOADING_MESSAGES.length)*95
                  return(
                    <div key={m} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 0',borderBottom:i<LOADING_MESSAGES.length-1?'1px solid rgba(255,255,255,0.04)':'none',opacity:done||active?1:0.3,transition:'opacity 0.4s'}}>
                      <div style={{display:'flex',alignItems:'center',gap:9}}>
                        <div style={{width:20,height:20,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,background:done?'#21E6F3':active?'rgba(33,230,243,0.15)':'rgba(255,255,255,0.05)',border:done?'none':active?'1px solid rgba(33,230,243,0.4)':'1px solid rgba(255,255,255,0.1)',transition:'all 0.3s',boxShadow:done?'0 0 10px rgba(33,230,243,0.5)':active?'0 0 6px rgba(33,230,243,0.25)':'none'}}>
                          {done?<span style={{fontSize:10,fontWeight:900,color:'#04101b'}}>✓</span>:active?<div style={{width:6,height:6,borderRadius:'50%',border:'1.5px solid rgba(255,255,255,0.2)',borderTopColor:'#21E6F3',animation:'spin 0.8s linear infinite'}}/>:null}
                        </div>
                        <span style={{fontSize:12,color:done?'#fff':active?'#21E6F3':'rgba(148,163,184,0.6)',fontWeight:done?600:active?700:400}}>{m}</span>
                      </div>
                      <span style={{fontSize:10,fontWeight:700,color:done?'#21E6F3':active?'rgba(33,230,243,0.6)':'rgba(100,116,139,0.4)'}}>
                        {done?'Complete':active?'In progress':'Queued'}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Live stat counters */}
              <div style={{borderRadius:12,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.02)',padding:'12px 14px'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                  {[
                    {icon:'💵',label:'Earnings',value:preview?`$${(preview.estimatedEarnings*(loadingProgress/100)).toFixed(0)}`:'$0',sub:`+$${Math.round((preview?.estimatedEarnings||0)*0.12)} vs last 7d`},
                    {icon:'👥',label:'Fans',value:Math.round((preview?.fansDetected||0)*(loadingProgress/100)).toString(),sub:`+${Math.round((preview?.fansDetected||0)*0.08)} vs last 7d`},
                    {icon:'💎',label:'Tips',value:Math.round((preview?.tipsDetected||0)*(loadingProgress/100)).toString(),sub:`+${Math.round((preview?.tipsDetected||0)*0.05)} vs last 7d`},
                    {icon:'⏰',label:'Best Hours',value:loadingProgress>80?(preview?.bestHour||'–'):'…',sub:loadingProgress>80?'+2 windows':'calculating…'},
                  ].map(s=>(
                    <div key={s.label} style={{textAlign:'center'}}>
                      <div style={{fontSize:14,marginBottom:3}}>{s.icon}</div>
                      <div style={{fontSize:9,color:'rgba(166,168,189,0.6)',marginBottom:3,textTransform:'uppercase',letterSpacing:'0.06em'}}>{s.label}</div>
                      <div style={{fontSize:14,fontWeight:900,color:'#fff',fontVariantNumeric:'tabular-nums'}}>{s.value}</div>
                      <div style={{fontSize:9,color:'rgba(33,230,243,0.7)',marginTop:2}}>{s.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{textAlign:'center',marginTop:12,fontSize:11,color:'rgba(100,116,139,0.5)'}}>
                ⚡ Almost there! Crunching the good stuff…
              </div>
            </div>
          )}

          {/* ══ STEP: LIVE MODE DEMO ══ */}
          {step==='live'&&(
            <LiveModeDemo
              onInstall={()=>{window.open('https://chrome.google.com/webstore','_blank');setStep('done')}}
              onSkip={()=>setStep('done')}
            />
          )}

          {/* ══ STEP: STEP4 (additional imports) ══ */}
          {step==='step4'&&(
            <div style={{animation:'fadeUp 0.35s ease both'}}>
              <div style={{textAlign:'center',marginBottom:22}}>
                <div style={{width:56,height:56,borderRadius:20,background:'linear-gradient(135deg,#21E6F3,#6C5CFF,#FF2FAE)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,color:'#fff',margin:'0 auto 16px',boxShadow:'0 0 40px rgba(33,230,243,0.3),0 0 70px rgba(255,47,174,0.2)'}}>✓</div>
                <h1 style={{fontSize:20,fontWeight:900,color:'#fff',marginBottom:7}}>Make your dashboard smarter</h1>
                <p style={{fontSize:13,color:'#A6A8BD',lineHeight:1.6}}>Add more history or turn on live tracking so CamCash can find stronger patterns.</p>
              </div>
              {[
                {icon:'📥',title:'Add more history',sub:'Improve accuracy with more tip data',onClick:()=>{setPasteText('');setStep('paste')}},
                {icon:'📡',title:'Set up live tracking',sub:'Track future tips automatically',onClick:()=>window.open('https://chrome.google.com/webstore','_blank')},
                {icon:'📊',title:'Go to dashboard',sub:'See what CamCash found so far',onClick:()=>router.push('/dashboard')},
              ].map(a=>(
                <button key={a.title} onClick={a.onClick} style={{display:'flex',alignItems:'center',gap:12,padding:'13px 14px',width:'100%',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,cursor:'pointer',transition:'all 0.2s',textAlign:'left',marginBottom:8}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(33,230,243,0.3)';e.currentTarget.style.background='rgba(33,230,243,0.04)';e.currentTarget.style.transform='translateY(-1px)'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.08)';e.currentTarget.style.background='rgba(255,255,255,0.03)';e.currentTarget.style.transform=''}}
                >
                  <div style={{width:38,height:38,borderRadius:12,background:'rgba(33,230,243,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{a.icon}</div>
                  <div><div style={{fontSize:13,fontWeight:700,color:'#fff',marginBottom:1}}>{a.title}</div><div style={{fontSize:11,color:'rgba(100,116,139,0.8)'}}>{a.sub}</div></div>
                  <div style={{marginLeft:'auto',color:'rgba(100,116,139,0.5)',fontSize:14}}>→</div>
                </button>
              ))}
            </div>
          )}

          {/* ══ STEP: DONE (First Insights + You're all set) ══ */}
          {step==='done'&&importResult&&(
            <div style={{animation:'fadeUp 0.4s ease both',position:'relative'}}>
              {/* All steps checked */}
              <div style={{marginBottom:18}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',maxWidth:240,margin:'0 auto 6px'}}>
                  {[1,2,3].map((n,i)=>(
                    <div key={n} style={{display:'flex',alignItems:'center',flex:i<2?1:'none'}}>
                      <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,flexShrink:0,background:'linear-gradient(135deg,#21E6F3,#6C5CFF)',color:'#04101b',boxShadow:'0 0 14px rgba(33,230,243,0.4)'}}>✓</div>
                      {i<2&&<div style={{height:1.5,flex:1,background:'linear-gradient(90deg,#21E6F3,#FF2FAE)',margin:'0 3px'}}/>}
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',justifyContent:'space-between',maxWidth:240,margin:'0 auto'}}>
                  {['Stats','Tips','Done'].map(l=>(
                    <div key={l} style={{width:28,textAlign:'center',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'rgba(33,230,243,0.7)'}}>{l}</div>
                  ))}
                </div>
              </div>

              {/* Insights headline */}
              <div style={{textAlign:'center',marginBottom:18}}>
                <div style={{fontSize:9,fontWeight:900,letterSpacing:'0.25em',textTransform:'uppercase',color:'rgba(33,230,243,0.85)',marginBottom:8}}>First Insights</div>
                <h1 style={{fontSize:20,fontWeight:900,color:'#F8FAFC',letterSpacing:'-0.025em',marginBottom:7}}>Your first insights are ready</h1>
                <p style={{fontSize:12,color:'#A6A8BD',lineHeight:1.6}}>Here's a beautiful preview of what we found.</p>
              </div>

              {/* Stat cards */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:12}}>
                {[
                  {label:'Tips Imported',value:importResult.inserted,color:'#21E6F3',prefix:'',suffix:' tips',delay:'0s'},
                  {label:'Unique Fans',value:preview?.fansDetected||0,color:'#a78bfa',prefix:'',suffix:' fans',delay:'0.1s'},
                  {label:'Est. Earnings',value:parseFloat(preview?.estimatedEarnings||0),color:'#4ade80',prefix:'$',suffix:'',delay:'0.2s'},
                  {label:'Top Spender',value:1,color:'#FF2FAE',prefix:'',suffix:' found',delay:'0.3s'},
                ].map(s=>(
                  <div key={s.label} style={{borderRadius:12,border:'1px solid rgba(255,255,255,0.07)',background:'rgba(255,255,255,0.03)',padding:'12px 13px',animation:`fadeUp 0.35s ease ${s.delay} both`}}>
                    <div style={{fontSize:9,color:'rgba(71,85,105,0.9)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.12em'}}>{s.label}</div>
                    <div style={{fontSize:18,fontWeight:900,color:s.color}}><CountUp to={s.value} prefix={s.prefix} suffix={s.suffix} duration={900}/></div>
                  </div>
                ))}
              </div>

              {/* Best insight card */}
              <div style={{borderRadius:12,border:'1px solid rgba(255,47,174,0.2)',background:'rgba(255,47,174,0.04)',padding:'12px 14px',marginBottom:14}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                  <div style={{fontSize:18,flexShrink:0}}>⚡</div>
                  <div>
                    <div style={{fontSize:11,fontWeight:800,color:'rgba(255,47,174,0.85)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.08em'}}>Best first insight</div>
                    {preview?.bestHour?(
                      <p style={{fontSize:12,color:'rgba(248,250,252,0.9)',lineHeight:1.6}}>
                        Your earnings peak around <strong style={{color:'#FF2FAE'}}>{preview.bestHour}</strong>. That's your sweet spot — prioritize streaming then.
                      </p>
                    ):(
                      <p style={{fontSize:12,color:'rgba(166,168,189,0.7)',lineHeight:1.6}}>Not enough history yet for peak windows. Import more data to unlock this.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Email nudge */}
              <div style={{borderRadius:12,border:'1px solid rgba(255,255,255,0.07)',background:'rgba(255,255,255,0.03)',padding:'11px 13px',marginBottom:14,display:'flex',alignItems:'flex-start',gap:10}}>
                <div style={{fontSize:16,flexShrink:0}}>📧</div>
                <div>
                  <div style={{fontSize:12,fontWeight:800,color:'#fff',marginBottom:2}}>Check your email</div>
                  <div style={{fontSize:11,color:'rgba(166,168,189,0.7)',lineHeight:1.5}}>We sent you a walkthrough on importing more data. Use the <span style={{color:'#21E6F3',fontWeight:600}}>CSV Importer</span> in your sidebar anytime.</div>
                </div>
              </div>

              <OBBtn onClick={()=>router.push('/dashboard')} style={{marginBottom:10}}>Enter Dashboard →</OBBtn>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                <OBSecBtn onClick={()=>{setPasteText('');setStep('paste')}} style={{width:'100%',height:40,fontSize:12}}>Import More Data</OBSecBtn>
                <OBSecBtn onClick={()=>window.open('https://chrome.google.com/webstore','_blank')} style={{width:'100%',height:40,fontSize:12}}>Install Pretty Profits 🔮</OBSecBtn>
              </div>
              <p style={{fontSize:10,color:'rgba(100,116,139,0.6)',textAlign:'center',lineHeight:1.6}}>
                ℹ️ Recommended: import more history to make your stats smarter and more accurate. You can also do this later.
              </p>
            </div>
          )}

        </div>
      </div>
    </main>
  )
}

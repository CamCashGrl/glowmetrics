'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hlsdlaibnayzbfflxclj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc2RsYWlibmF5emJmZmx4Y2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjQwODUsImV4cCI6MjA4OTIwMDA4NX0.5FwPe35UL-o46FvBJX526La5o7jcbFaP1KVoLtI4U_M',
  { auth: { autoRefreshToken:true, persistSession:true, detectSessionInUrl:true } }
)

// ── Platforms ──────────────────────────────────────────────────
const PLATFORMS = [
  {
    id:'chaturbate', name:'Chaturbate', short:'CB', color:'#ff6b35',
    earningsUrl:(u)=> u ? `https://chaturbate.com/p/${u}/?tab=tokens` : 'https://chaturbate.com/accounts/settings/',
    hint:'Go to your profile → Token Stats tab. Select All Time. Highlight the table, copy, and paste below.',
    placeholder:`06/18/2026 2:32 PM\tusername123\t500\tspin the wheel\n06/18/2026 3:14 PM\twhaleking99\t1000\t\n06/18/2026 3:45 PM\tregularfan\t25\tgreat show`,
  },
  {
    id:'bongacams', name:'BongaCams', short:'BC', color:'#e53935',
    earningsUrl:()=>'https://bongamodels.com/reports/general',
    hint:'Go to Reports → General. Select your date range. Highlight all rows, copy, and paste below.',
    placeholder:`18.06.2026 14:32\tusername123\t500\t25.00\n18.06.2026 15:14\twhaleking99\t1000\t50.00\n18.06.2026 15:45\tregularfan\t25\t1.25`,
  },
  {
    id:'myfreecams', name:'MyFreeCams', short:'MFC', color:'#ed8936',
    earningsUrl:()=>'https://profiles.myfreecams.com/_/ext/token_sessions',
    hint:'Go to Token Sessions. Set your date range, highlight all rows, copy and paste below.',
    placeholder:`2026-06-18 14:32:00\tusername123\t500\tspin the wheel\n2026-06-18 15:14:00\twhaleking99\t1000\t\n2026-06-18 15:45:00\tregularfan\t25\tgreat show`,
  },
]
const TOKEN_RATES = { chaturbate:0.05, bongacams:0.04, myfreecams:0.05 }

// ── Loading messages ───────────────────────────────────────────
const FIRST_MSGS = ['Analyzing your data…','Cleaning up your tip history…','Matching dates and token values…','Identifying your top spenders…','Finding your best hours…','Organizing your fans…','Building your dashboard…','Presenting your results…']
const EXTRA_MSGS = ['Importing additional tip history…','Merging with your dashboard…','Updating your insights…']

// ── Paste parser ───────────────────────────────────────────────
function pasteToCSVBlob(rawText, platformId) {
  const rate = TOKEN_RATES[platformId]||0.05
  const lines = rawText.split('\n').map(l=>l.trim()).filter(Boolean)
  const headerKw = ['date','time','user','token','usd','tip','amount','note','message','from','type','stamp','earning']
  const csvRows = ['date_time,username,tokens,usd,note']
  let skipped=0
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
        if(Number.isInteger(n)&&n>=1&&tokens===null)tokens=n
        else if(!Number.isInteger(n)&&n<5000&&usd===null)usd=n
        else if(Number.isInteger(n)&&n>=1&&tokens===null)tokens=n
      }else if(col.length>0&&isNaN(parseFloat(col))){
        if(username===null&&col.length<=50&&!/\s{2,}/.test(col)&&col.length>1)username=col
        else if(note===''&&col.length>0)note=col
      }
    }
    if(!tokens||tokens<1){skipped++;continue}
    if(!usd)usd=+(tokens*rate).toFixed(2)
    const safeUser=(username||'anonymous').replace(/,/g,'')
    const safeNote=note.replace(/,/g,'')
    const isoTs=ts.toISOString().replace('T',' ').slice(0,19)
    csvRows.push(`${isoTs},${safeUser},${tokens},${usd},${safeNote}`)
  }
  return{blob:new Blob([csvRows.join('\n')],{type:'text/csv'}),rowCount:csvRows.length-1,skipped}
}

function tryParseDate(str){
  if(!str||str.length<8)return null
  let m
  m=str.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})/)
  if(m)return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00`)
  m=str.match(/^(\d{2})\.(\d{2})\.(\d{4})\s(\d{2}):(\d{2})/)
  if(m)return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00`)
  m=str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s(\d{1,2}):(\d{2})(?:\s?(AM|PM))?/i)
  if(m){let h=parseInt(m[4]);if(m[6]?.toUpperCase()==='PM'&&h<12)h+=12;if(m[6]?.toUpperCase()==='AM'&&h===12)h=0;return new Date(`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}T${String(h).padStart(2,'0')}:${m[5]}:00`)}
  m=str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if(m)return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`)
  const d=new Date(str);return isNaN(d.getTime())?null:d
}

function previewFromText(rawText,platformId){
  const{rowCount,skipped}=pasteToCSVBlob(rawText,platformId)
  const rate=TOKEN_RATES[platformId]||0.05
  const lines=rawText.split('\n').map(l=>l.trim()).filter(Boolean)
  const parsed=[]
  const headerKw=['date','time','user','token','usd','tip','amount','note','message','from','type','stamp','earning']
  for(const line of lines){
    const cols=line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c=>c.trim().replace(/^"|"$/g,''))
    if(cols.length<2)continue
    const lower=cols.map(c=>c.toLowerCase())
    if(lower.filter(c=>headerKw.some(k=>c.includes(k))).length>=2)continue
    let ts=null,tsIdx=-1
    for(let i=0;i<cols.length;i++){const d=tryParseDate(cols[i]);if(d){ts=d;tsIdx=i;break}}
    if(!ts)continue
    const rest=cols.filter((_,i)=>i!==tsIdx)
    let tokens=null,usd=null,username=null,note=''
    for(const col of rest){
      const n=parseFloat(col.replace(/[$,]/g,''))
      if(!isNaN(n)&&n>0){
        if(Number.isInteger(n)&&n>=1&&tokens===null)tokens=n
        else if(!Number.isInteger(n)&&n<5000&&usd===null)usd=n
        else if(Number.isInteger(n)&&n>=1&&tokens===null)tokens=n
      }else if(col.length>0&&isNaN(parseFloat(col))){
        if(username===null&&col.length<=50&&col.length>1)username=col
        else if(note===''&&col.length>0)note=col
      }
    }
    if(!tokens||tokens<1)continue
    if(!usd)usd=+(tokens*rate).toFixed(2)
    parsed.push({ts,username:username||'anonymous',tokens,usd,note})
  }
  if(!parsed.length)return null
  const totalUsd=parsed.reduce((s,r)=>s+r.usd,0)
  const fans=new Set(parsed.map(r=>r.username)).size
  const dates=parsed.map(r=>r.ts).sort((a,b)=>a-b)
  const topSpender=Object.entries(parsed.reduce((acc,r)=>{acc[r.username]=(acc[r.username]||0)+r.tokens;return acc},{})).sort((a,b)=>b[1]-a[1])[0]
  const hourCounts=parsed.reduce((acc,r)=>{const h=r.ts.getHours();acc[h]=(acc[h]||0)+r.tokens;return acc},{})
  const bestHour=Object.entries(hourCounts).sort((a,b)=>b[1]-a[1])[0]
  const fmtHour=h=>{const n=parseInt(h);return n===0?'12am':n<12?`${n}am`:n===12?'12pm':`${n-12}pm`}
  return{
    count:rowCount,skipped,usd:totalUsd.toFixed(2),fans,
    from:dates[0].toLocaleDateString('en-US',{month:'short',day:'numeric'}),
    to:dates[dates.length-1].toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
    sample:parsed.slice(0,3),
    topSpender:topSpender?{name:topSpender[0],tokens:topSpender[1]}:null,
    bestHour:bestHour?fmtHour(bestHour[0]):null,
  }
}

function hexRgb(hex){const h=hex.replace('#','');return`${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`}

// ── Sparkle ────────────────────────────────────────────────────
function Sparkle(){
  const canvasRef=useRef()
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    const ctx=canvas.getContext('2d')
    canvas.width=window.innerWidth;canvas.height=window.innerHeight
    const COLORS=['#00f5d4','#08d9ff','#ffffff','#a78bfa','#ff3ea5']
    const dots=Array.from({length:32},()=>({
      x:Math.random()*canvas.width,y:Math.random()*canvas.height,
      r:Math.random()*2+0.5,color:COLORS[Math.floor(Math.random()*COLORS.length)],
      alpha:Math.random()*0.8+0.2,alphaDir:Math.random()>0.5?1:-1,
      alphaSpeed:Math.random()*0.02+0.008,
      vx:(Math.random()-0.5)*0.25,vy:(Math.random()-0.5)*0.25,
    }))
    let frame=0;let raf
    const draw=()=>{
      ctx.clearRect(0,0,canvas.width,canvas.height)
      dots.forEach(d=>{
        d.x+=d.vx;d.y+=d.vy
        d.alpha+=d.alphaDir*d.alphaSpeed
        if(d.alpha>=1){d.alpha=1;d.alphaDir=-1}
        if(d.alpha<=0){d.alpha=0;d.alphaDir=1}
        if(d.x<-4)d.x=canvas.width+4;if(d.x>canvas.width+4)d.x=-4
        if(d.y<-4)d.y=canvas.height+4;if(d.y>canvas.height+4)d.y=-4
        ctx.save();ctx.globalAlpha=d.alpha;ctx.translate(d.x,d.y);ctx.fillStyle=d.color
        const s=d.r
        ctx.beginPath()
        ctx.moveTo(0,-s*2.5);ctx.lineTo(s*0.5,-s*0.5);ctx.lineTo(s*2.5,0);ctx.lineTo(s*0.5,s*0.5)
        ctx.lineTo(0,s*2.5);ctx.lineTo(-s*0.5,s*0.5);ctx.lineTo(-s*2.5,0);ctx.lineTo(-s*0.5,-s*0.5)
        ctx.closePath();ctx.fill();ctx.restore()
      })
      frame++
      if(frame<200)raf=requestAnimationFrame(draw)
      else{let op=1;const fade=()=>{op-=0.06;ctx.globalAlpha=op;if(op>0)requestAnimationFrame(fade);else ctx.clearRect(0,0,canvas.width,canvas.height)};fade()}
    }
    raf=requestAnimationFrame(draw)
    return()=>cancelAnimationFrame(raf)
  },[])
  return<canvas ref={canvasRef} style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:9999}}/>
}

// ── CountUp ────────────────────────────────────────────────────
function CountUp({to,prefix='',suffix='',duration=1000}){
  const[val,setVal]=useState(0)
  useEffect(()=>{
    const start=Date.now()
    const tick=()=>{
      const p=Math.min((Date.now()-start)/duration,1)
      const eased=1-Math.pow(1-p,3)
      setVal(Math.round(eased*to))
      if(p<1)requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  },[to,duration])
  return<>{prefix}{val.toLocaleString()}{suffix}</>
}

// ── Loading ────────────────────────────────────────────────────
function LoadingScreen({isFirst}){
  const msgs=isFirst?FIRST_MSGS:EXTRA_MSGS
  const[msgIdx,setMsgIdx]=useState(0)
  const[progress,setProgress]=useState(0)
  useEffect(()=>{
    const total=isFirst?6000:2000,start=Date.now()
    const pi=setInterval(()=>{const p=Math.min((Date.now()-start)/total,0.95);setProgress(Math.round(p*100))},60)
    const mi=setInterval(()=>setMsgIdx(i=>(i+1)%msgs.length),isFirst?900:700)
    return()=>{clearInterval(pi);clearInterval(mi)}
  },[isFirst,msgs.length])
  return(
    <div style={{textAlign:'center',padding:'60px 0'}}>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#08d9ff',marginBottom:24}}>Building your dashboard</div>
      <div style={{position:'relative',height:6,background:'rgba(255,255,255,0.08)',borderRadius:3,overflow:'hidden',maxWidth:400,margin:'0 auto 28px'}}>
        <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${progress}%`,borderRadius:3,background:'linear-gradient(90deg,#08d9ff,#4f7cff,#ff2fb3)',transition:'width 0.1s linear',boxShadow:'0 0 12px rgba(8,217,255,0.5)'}}/>
        <div style={{position:'absolute',left:0,top:0,height:'100%',width:'100%',background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)',animation:'shimmer 1.4s infinite'}}/>
      </div>
      <div style={{fontSize:15,color:'#f8fafc',fontWeight:500,marginBottom:8,minHeight:24}}>{msgs[msgIdx]}</div>
      <div style={{fontSize:13,color:'rgba(148,163,184,0.6)',marginBottom:32}}>{progress}% complete</div>
      {isFirst&&(
        <div style={{display:'flex',gap:24,justifyContent:'center',flexWrap:'wrap'}}>
          {['No password required','Your data stays private','You stay in control'].map(t=>(
            <div key={t} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'rgba(148,163,184,0.6)'}}>
              <span style={{color:'#08d9ff'}}>✓</span>{t}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Pro Upsell Modal ───────────────────────────────────────────
function ProUpsellModal({platform,onSkip}){
  return(
    <div style={{position:'fixed',inset:0,zIndex:9998,background:'rgba(4,6,18,0.88)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',animation:'fadeUp 0.25s ease both'}}>
      <div style={{width:'100%',maxWidth:520,background:'linear-gradient(180deg,rgba(14,18,42,0.97),rgba(8,10,28,0.99))',borderRadius:24,overflow:'hidden',position:'relative',boxShadow:'0 0 60px rgba(8,217,255,0.15),0 0 120px rgba(255,47,179,0.1),0 32px 80px rgba(0,0,0,0.6)'}}>
        <div style={{position:'absolute',inset:0,borderRadius:24,padding:1,background:'linear-gradient(135deg,rgba(8,217,255,0.6),rgba(79,124,255,0.3),rgba(255,47,179,0.6))',WebkitMask:'linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0)',WebkitMaskComposite:'xor',maskComposite:'exclude',pointerEvents:'none'}}/>
        <div style={{padding:'28px'}}>
          <div style={{textAlign:'center',marginBottom:24}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#a78bfa',marginBottom:8}}>Unlock All Platforms</div>
            <h2 style={{fontSize:20,fontWeight:800,color:'#ffffff',marginBottom:6}}>You're adding {platform.name}</h2>
            <p style={{fontSize:13,color:'rgba(148,163,184,0.8)',lineHeight:1.6}}>Multi-platform tracking is a Pro feature. Upgrade to sync all platforms and see your full picture.</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
            <div style={{background:'rgba(167,139,250,0.08)',border:'1.5px solid rgba(167,139,250,0.4)',borderRadius:14,padding:'18px 16px',position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:0,right:0,background:'linear-gradient(135deg,#a78bfa,#7c3aed)',borderRadius:'0 14px 0 10px',padding:'3px 10px',fontSize:10,fontWeight:700,color:'#fff',letterSpacing:'0.05em'}}>BEST DEAL</div>
              <div style={{fontSize:11,color:'#a78bfa',fontWeight:700,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.07em'}}>Early Adopter</div>
              <div style={{fontSize:26,fontWeight:800,color:'#ffffff',lineHeight:1}}>$9.99</div>
              <div style={{fontSize:11,color:'rgba(148,163,184,0.7)',marginBottom:4}}>/month · locked forever</div>
              <div style={{fontSize:11,color:'rgba(100,116,139,0.8)',textDecoration:'line-through',marginBottom:14}}>$19.99/mo after 100 users</div>
              {['All 5 platforms','Save history forever','AI learns your patterns','Fan behavior analysis','Predictive coaching','Lifetime price lock ✦'].map(f=>(
                <div key={f} style={{display:'flex',gap:6,alignItems:'center',fontSize:12,color:'rgba(203,213,225,0.9)',marginBottom:5}}>
                  <span style={{color:'#a78bfa',fontSize:13}}>✓</span>{f}
                </div>
              ))}
              <button onClick={()=>window.open('https://www.camcashgrl.com/pricing','_blank')} style={{width:'100%',marginTop:14,padding:'10px',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#a78bfa,#7c3aed)',color:'#fff',fontSize:13,fontWeight:700}}>Lock in $9.99/mo →</button>
            </div>
            <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:'18px 16px'}}>
              <div style={{fontSize:11,color:'rgba(148,163,184,0.7)',fontWeight:700,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.07em'}}>Standard</div>
              <div style={{fontSize:26,fontWeight:800,color:'#ffffff',lineHeight:1}}>$19.99</div>
              <div style={{fontSize:11,color:'rgba(148,163,184,0.7)',marginBottom:20}}>/month</div>
              {['All 5 platforms','Save history forever','AI learns your patterns','Fan behavior analysis','Predictive coaching'].map(f=>(
                <div key={f} style={{display:'flex',gap:6,alignItems:'center',fontSize:12,color:'rgba(148,163,184,0.8)',marginBottom:5}}>
                  <span style={{color:'#08d9ff',fontSize:13}}>✓</span>{f}
                </div>
              ))}
              <button onClick={()=>window.open('https://www.camcashgrl.com/pricing','_blank')} style={{width:'100%',marginTop:14,padding:'10px',borderRadius:10,border:'1px solid rgba(255,255,255,0.12)',cursor:'pointer',background:'rgba(255,255,255,0.05)',color:'rgba(148,163,184,0.8)',fontSize:13,fontWeight:600}}>Get Standard →</button>
            </div>
          </div>
          <div style={{background:'rgba(8,217,255,0.06)',border:'1px solid rgba(8,217,255,0.15)',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:12,color:'rgba(148,163,184,0.8)',textAlign:'center'}}>
            ✅ <span style={{color:'#ffffff'}}>Free tier always exists</span> — your current platform stays free forever.
          </div>
          <div style={{textAlign:'center'}}>
            <button onClick={onSkip} style={{background:'none',border:'none',fontSize:12,color:'rgba(100,116,139,0.7)',cursor:'pointer',textDecoration:'underline'}}>Skip for now — continue with one platform</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Global styles ──────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',system-ui,sans-serif}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{0%{transform:translateX(-120%)}100%{transform:translateX(220%)}}
  @keyframes cardShimmer{0%{transform:translateX(-120%)}100%{transform:translateX(220%)}}
  @keyframes borderPulse{0%,100%{opacity:0.7}50%{opacity:1}}
  @keyframes glowPulse{0%,100%{box-shadow:0 0 24px rgba(8,217,255,0.15),0 0 0 1.5px rgba(8,217,255,0.2)}50%{box-shadow:0 0 48px rgba(8,217,255,0.3),0 0 0 1.5px rgba(8,217,255,0.4)}}

  .ob-card{
    position:relative;
    width:100%;max-width:860px;
    background:linear-gradient(180deg,rgba(12,16,40,0.95) 0%,rgba(6,8,24,0.98) 100%);
    border-radius:28px;
    box-shadow:
      0 0 0 1px rgba(8,217,255,0.15),
      0 0 60px rgba(8,217,255,0.08),
      0 0 120px rgba(255,47,179,0.06),
      0 40px 100px rgba(0,0,0,0.6),
      inset 0 1px 0 rgba(255,255,255,0.07);
    backdrop-filter:blur(24px);
    -webkit-backdrop-filter:blur(24px);
    padding:40px 48px;
  }
  .ob-card::before{
    content:'';position:absolute;inset:0;border-radius:28px;padding:1px;
    background:linear-gradient(135deg,rgba(8,217,255,0.6) 0%,rgba(79,124,255,0.25) 40%,rgba(255,47,179,0.55) 100%);
    -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
    -webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;
    animation:borderPulse 3s ease-in-out infinite;
  }

  .plat-card{
    position:relative;cursor:pointer;
    background:rgba(255,255,255,0.03);
    border:1px solid rgba(255,255,255,0.09);
    border-radius:18px;padding:28px 16px 22px;
    display:flex;flex-direction:column;align-items:center;gap:12px;
    transition:all 0.2s ease;
  }
  .plat-card:hover{
    transform:translateY(-2px);
    border-color:rgba(8,217,255,0.3);
    box-shadow:0 0 20px rgba(8,217,255,0.12),0 8px 24px rgba(0,0,0,0.3);
    background:rgba(8,217,255,0.04);
  }
  .plat-card.selected{
    background:linear-gradient(180deg,rgba(8,217,255,0.09),rgba(79,124,255,0.06));
    border:1.5px solid rgba(8,217,255,0.65);
    box-shadow:0 0 28px rgba(8,217,255,0.2),0 0 56px rgba(255,47,179,0.06),inset 0 0 20px rgba(8,217,255,0.04);
  }

  .btn-cta{
    width:100%;padding:16px;border-radius:14px;border:1px solid rgba(255,255,255,0.18);
    background:linear-gradient(90deg,#08d9ff 0%,#4f7cff 45%,#ff2fb3 100%);
    color:#fff;font-size:16px;font-weight:800;cursor:pointer;letter-spacing:0.01em;
    box-shadow:0 0 18px rgba(8,217,255,0.35),0 0 30px rgba(255,47,179,0.25),inset 0 1px 0 rgba(255,255,255,0.25);
    transition:all 180ms ease;
  }
  .btn-cta:hover{transform:translateY(-1px);box-shadow:0 0 28px rgba(8,217,255,0.5),0 0 48px rgba(255,47,179,0.35),inset 0 1px 0 rgba(255,255,255,0.25);}
  .btn-cta:active{transform:scale(0.99);}

  .btn-back{
    padding:14px 24px;border-radius:14px;
    background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.12);
    color:rgba(148,163,184,0.9);font-size:14px;font-weight:600;cursor:pointer;
    transition:all 0.2s ease;
  }
  .btn-back:hover{background:rgba(255,255,255,0.09);border-color:rgba(255,255,255,0.2);}

  .btn-ghost{
    padding:14px 20px;border-radius:14px;
    background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.1);
    color:rgba(148,163,184,0.8);font-size:14px;font-weight:600;cursor:pointer;
    transition:all 0.2s ease;
  }
  .btn-ghost:hover{background:rgba(255,255,255,0.08);border-color:rgba(8,217,255,0.25);}

  .skip-link{background:none;border:none;font-size:13px;color:rgba(8,217,255,0.8);cursor:pointer;transition:color 0.2s;}
  .skip-link:hover{color:#08d9ff;}

  .paste-area{
    width:100%;padding:16px;
    background:rgba(4,6,18,0.7);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:14px;
    color:#e2e8f0;font-size:13px;font-family:'Courier New',monospace;line-height:1.7;
    resize:vertical;transition:border-color 0.2s,box-shadow 0.2s;
    min-height:160px;
  }
  .paste-area:focus{outline:none;border-color:rgba(8,217,255,0.4);box-shadow:0 0 0 3px rgba(8,217,255,0.08);}
  .paste-area::placeholder{color:rgba(100,116,139,0.7);font-family:'Courier New',monospace;font-size:12px;}

  .action-card{
    display:flex;align-items:center;gap:14px;padding:16px 18px;
    background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);
    border-radius:14px;cursor:pointer;transition:all 0.2s ease;text-align:left;width:100%;
  }
  .action-card:hover{border-color:rgba(8,217,255,0.2);background:rgba(8,217,255,0.04);transform:translateY(-1px);}

  .stat-card{position:relative;overflow:hidden;}
  .stat-card::after{content:'';position:absolute;top:0;left:0;width:60%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent);animation:cardShimmer 2.2s ease 0.4s both;}

  .trust-line{display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;color:rgba(100,116,139,0.6);margin-top:20px;}
`

// ── Step progress ──────────────────────────────────────────────
function StepProgress({stepIdx,show}){
  if(!show)return null
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:0,marginBottom:8}}>
      {[0,1,2].map((i)=>(
        <div key={i} style={{display:'flex',alignItems:'center'}}>
          <div style={{
            width:36,height:36,borderRadius:'50%',flexShrink:0,
            background:i<stepIdx?'linear-gradient(135deg,#08d9ff,#4f7cff)':i===stepIdx?'linear-gradient(135deg,#08d9ff,#4f7cff)':'rgba(255,255,255,0.06)',
            border:i<=stepIdx?'none':'1px solid rgba(255,255,255,0.14)',
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:13,fontWeight:700,
            color:i<=stepIdx?'#06070f':'rgba(255,255,255,0.35)',
            boxShadow:i===stepIdx?'0 0 18px rgba(8,217,255,0.55)':i<stepIdx?'0 0 12px rgba(8,217,255,0.3)':'none',
            transition:'all 0.4s',
          }}>
            {i<stepIdx?'✓':i+1}
          </div>
          {i<2&&<div style={{width:80,height:1,background:i<stepIdx?'linear-gradient(90deg,#08d9ff,#4f7cff)':'rgba(255,255,255,0.09)',boxShadow:i<stepIdx?'0 0 8px rgba(8,217,255,0.4)':'none',transition:'all 0.4s'}}/>}
        </div>
      ))}
    </div>
  )
}

// ── Logo ───────────────────────────────────────────────────────
function Logo(){
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:20}}>
      <div style={{width:40,height:40,borderRadius:12,background:'linear-gradient(135deg,#08d9ff,#4f7cff,#ff2fb3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:800,color:'#fff',boxShadow:'0 0 24px rgba(8,217,255,0.45)'}}>$</div>
      <span style={{fontSize:22,fontWeight:800,background:'linear-gradient(90deg,#ffffff,#08d9ff)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Cam<span style={{background:'linear-gradient(90deg,#ff2fb3,#a78bfa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Cash</span></span>
    </div>
  )
}

// ── Trust line ─────────────────────────────────────────────────
function TrustLine(){
  return<div className="trust-line"><span style={{fontSize:14}}>🔒</span>Your data is stored securely and never shared.</div>
}

// ── Live Mode Demo Component ───────────────────────────────────
function LiveModeDemo({onInstall, onSkip}){
  const PROMPTS = [
    { id:1, type:'whale', icon:'🐋', title:'Greet Returning Fan', body:'whaleking99 just entered. He tipped $180 last stream. Say hi by name.', impact:'+$40 avg when acknowledged' },
    { id:2, type:'tip',   icon:'💡', title:'Mention Your Tip Menu', body:'You have 22 active viewers and no tip in 7 minutes. Mention your toy or wheel menu.', impact:'+34% tip rate after prompt' },
    { id:3, type:'goal',  icon:'🎯', title:'Refresh the Room Goal', body:'Tips slowed down. Try a smaller, faster goal to restart momentum.', impact:'Recovers dead zones in ~4 min' },
  ]
  const [activeIdx, setActiveIdx] = useState(0)
  const [dismissed, setDismissed] = useState([])
  const [earnings, setEarnings] = useState(42.50)
  const [score, setScore] = useState(74)

  useEffect(() => {
    const t = setInterval(() => {
      setEarnings(e => +(e + (Math.random() * 2.5)).toFixed(2))
      setScore(s => Math.min(98, s + Math.floor(Math.random() * 3)))
    }, 2200)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      setActiveIdx(i => (i + 1) % PROMPTS.length)
    }, 3500)
    return () => clearInterval(t)
  }, [])

  const current = PROMPTS[activeIdx]

  return (
    <div style={{animation:'fadeUp 0.3s ease both'}}>
      <div style={{textAlign:'center', marginBottom:24}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#08d9ff',marginBottom:12}}>Live Mode Preview</div>
        <h1 style={{fontSize:26,fontWeight:800,color:'#ffffff',marginBottom:8}}>This is CamCash during your stream</h1>
        <p style={{fontSize:14,color:'rgba(148,163,184,0.8)',lineHeight:1.6,maxWidth:460,margin:'0 auto'}}>
          While you stream, CamCash watches your room and tells you exactly what to do to earn more.
        </p>
      </div>

      {/* mock extension UI */}
      <div style={{background:'rgba(4,6,18,0.8)',border:'1px solid rgba(8,217,255,0.2)',borderRadius:20,padding:'20px',marginBottom:16,position:'relative',overflow:'hidden'}}>
        {/* shimmer line at top */}
        <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:'linear-gradient(90deg,transparent,#08d9ff,#4f7cff,#ff2fb3,transparent)',animation:'shimmer 2.5s linear infinite'}}/>

        {/* top stats bar */}
        <div style={{display:'flex',gap:10,marginBottom:16}}>
          {[
            {label:'Live Score', value:`${score}/100`, color:'#08d9ff'},
            {label:'Earnings/hr', value:`$${(earnings*2.4).toFixed(0)}/hr`, color:'#4ade80'},
            {label:'Prompts followed', value:'5/7', color:'#a78bfa'},
          ].map(s=>(
            <div key={s.label} style={{flex:1,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:'10px 12px'}}>
              <div style={{fontSize:10,color:'rgba(148,163,184,0.5)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>{s.label}</div>
              <div style={{fontSize:16,fontWeight:800,color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* live coaching prompt */}
        <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(8,217,255,0.25)',borderRadius:14,padding:'16px',transition:'all 0.4s',boxShadow:'0 0 20px rgba(8,217,255,0.08)'}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:12}}>
            <div style={{width:40,height:40,borderRadius:12,background:'rgba(8,217,255,0.1)',border:'1px solid rgba(8,217,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{current.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:700,color:'#08d9ff',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>Coach Prompt</div>
              <div style={{fontSize:13,fontWeight:700,color:'#ffffff',marginBottom:4}}>{current.title}</div>
              <div style={{fontSize:13,color:'rgba(148,163,184,0.8)',lineHeight:1.5}}>{current.body}</div>
            </div>
          </div>
          <div style={{fontSize:11,color:'rgba(74,222,128,0.8)',marginBottom:12,display:'flex',alignItems:'center',gap:4}}>
            <span>📈</span> {current.impact}
          </div>
          <div style={{display:'flex',gap:8}}>
            {['✓ Done','⏸ Snooze','✕ Ignore'].map((label,i)=>(
              <button key={label} style={{flex:i===0?2:1,padding:'8px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12,fontWeight:700,background:i===0?'linear-gradient(90deg,#08d9ff,#4f7cff)':'rgba(255,255,255,0.06)',color:i===0?'#06070f':'rgba(148,163,184,0.7)',transition:'all 0.15s'}}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* prompt dots */}
        <div style={{display:'flex',justifyContent:'center',gap:6,marginTop:14}}>
          {PROMPTS.map((_,i)=>(
            <div key={i} onClick={()=>setActiveIdx(i)} style={{width:i===activeIdx?20:6,height:6,borderRadius:3,background:i===activeIdx?'#08d9ff':'rgba(255,255,255,0.15)',transition:'all 0.3s',cursor:'pointer'}}/>
          ))}
        </div>
      </div>

      <button className="btn-cta" onClick={onInstall} style={{marginBottom:10}}>
        Install Live Tracker — it's free →
      </button>
      <div style={{textAlign:'center'}}>
        <button className="skip-link" onClick={onSkip}>Skip — go to dashboard first</button>
      </div>
      <TrustLine/>
    </div>
  )
}
export default function OnboardingPage(){
  const router=useRouter()
  const[user,setUser]=useState(null)
  const[booting,setBooting]=useState(true)
  const[step,setStep]=useState('platform')
  const[platformId,setPlatformId]=useState('chaturbate')
  const[cbUsername,setCbUsername]=useState('')
  const[cbUsernameError,setCbUsernameError]=useState('')
  const[pasteText,setPasteText]=useState('')
  const[previewData,setPreviewData]=useState(null)
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
  const csvRef=useRef()

  const platform=PLATFORMS.find(p=>p.id===platformId)||PLATFORMS[0]
  const stepIdx={platform:0,username:0,paste:1,csv:1,preview:2,loading:2,live:2,step4:2,done:2}[step]??0

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

  function handlePlatformSelect(id){
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
    const preview=previewFromText(pasteText,platformId)
    if(!preview||preview.count===0){setParseError("We couldn't find any tip rows in that paste. Make sure you copied the full table including dates and token amounts.");return}
    setPreviewData(preview);setStep('preview')
  }

  async function handleImport(){
    if(!user)return
    setImportError('');setStep('loading')
    try{
      const{data:{session}}=await supabase.auth.getSession()
      if(!session)throw new Error('Not logged in')
      const{blob}=pasteToCSVBlob(pasteText,platformId)
      const file=new File([blob],'pasted_import.csv',{type:'text/csv'})
      const minWait=isFirstImport?5500:1800
      const[res]=await Promise.all([
        fetch('/api/upload',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:(()=>{const f=new FormData();f.append('file',file);f.append('platform',platform.name);return f})()}),
        new Promise(r=>setTimeout(r,minWait)),
      ])
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
    setCsvUploading(true);setCsvError('');setStep('loading')
    try{
      const{data:{session}}=await supabase.auth.getSession()
      if(!session)throw new Error('Not logged in')
      const form=new FormData();form.append('file',file);form.append('platform',platform.name)
      const minWait=isFirstImport?5500:1800
      const[res]=await Promise.all([fetch('/api/upload',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:form}),new Promise(r=>setTimeout(r,minWait))])
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
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#07111f,#0b0d18,#120e1f)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:32,height:32,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.1)',borderTopColor:'#08d9ff',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const showProgress=!['done','loading'].includes(step)

  return(
    <div style={{
      minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      padding:'24px 20px',
      background:`
        radial-gradient(circle at 18% 20%, rgba(8,217,255,0.2) 0%, rgba(8,217,255,0.06) 30%, transparent 55%),
        radial-gradient(circle at 82% 80%, rgba(255,47,179,0.18) 0%, rgba(255,47,179,0.05) 30%, transparent 55%),
        radial-gradient(circle at 50% 50%, rgba(79,124,255,0.06) 0%, transparent 60%),
        linear-gradient(135deg,#07111f 0%,#0b0d18 45%,#120e1f 100%)
      `,
    }}>
      <style>{GLOBAL_CSS}</style>
      {showSparkle&&<Sparkle/>}
      {showUpsell&&pendingPlatform&&<ProUpsellModal platform={PLATFORMS.find(p=>p.id===pendingPlatform)} onSkip={handleUpsellSkip}/>}

      <div className="ob-card">
        {/* Header */}
        <div style={{textAlign:'center',marginBottom:28}}>
          <Logo/>
          <StepProgress stepIdx={stepIdx} show={showProgress}/>
        </div>

        {/* ── PLATFORM ── */}
        {step==='platform'&&(
          <div style={{animation:'fadeUp 0.3s ease both'}}>
            <div style={{textAlign:'center',marginBottom:28}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#08d9ff',marginBottom:12}}>Step 1 of 3</div>
              <h1 style={{fontSize:28,fontWeight:800,color:'#ffffff',marginBottom:10,lineHeight:1.2}}>Where do you stream?</h1>
              <p style={{fontSize:14,color:'rgba(148,163,184,0.8)',lineHeight:1.65,maxWidth:480,margin:'0 auto'}}>
                Choose your platform so CamCash can import your tip history and turn it into insights in under a minute.
              </p>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
              {PLATFORMS.map(p=>(
                <button key={p.id} className={`plat-card${platformId===p.id?' selected':''}`} onClick={()=>handlePlatformSelect(p.id)}>
                  {platformId===p.id&&(
                    <div style={{position:'absolute',top:12,right:12,width:22,height:22,borderRadius:'50%',background:'linear-gradient(135deg,#08d9ff,#4f7cff)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'#06070f',boxShadow:'0 0 10px rgba(8,217,255,0.6)'}}>✓</div>
                  )}
                  <div style={{width:60,height:60,borderRadius:16,background:platformId===p.id?`linear-gradient(135deg,${p.color},${p.color}bb)`:`rgba(${hexRgb(p.color)},0.14)`,border:platformId===p.id?'none':`1px solid rgba(${hexRgb(p.color)},0.25)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:800,color:platformId===p.id?'#fff':p.color,boxShadow:platformId===p.id?`0 4px 20px rgba(${hexRgb(p.color)},0.4)`:'none',transition:'all 0.2s'}}>{p.short}</div>
                  <span style={{fontSize:13,fontWeight:700,color:platformId===p.id?'#ffffff':'rgba(148,163,184,0.75)',textAlign:'center'}}>{p.name}</span>
                </button>
              ))}
            </div>

            <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:16,padding:'18px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:16}}>
              <div style={{width:48,height:48,borderRadius:14,flexShrink:0,background:'rgba(8,217,255,0.1)',border:'1px solid rgba(8,217,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>⚡</div>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:'#08d9ff',marginBottom:4}}>Paste once. Get insights fast.</div>
                <div style={{fontSize:13,color:'rgba(148,163,184,0.7)',lineHeight:1.5}}>Copy and paste your tip history one time. We'll handle the rest and unlock powerful analytics in about 60 seconds.</div>
              </div>
            </div>

            <button className="btn-cta" onClick={()=>handlePlatformSelect(platformId)}>Continue with {platform.name} →</button>
            <div style={{textAlign:'center',marginTop:14}}>
              <button className="skip-link" onClick={skipToDashboard}>Skip for now <span style={{fontSize:11}}>›</span></button>
            </div>
            <TrustLine/>
          </div>
        )}

        {/* ── USERNAME ── */}
        {step==='username'&&(
          <div style={{animation:'fadeUp 0.3s ease both'}}>
            <div style={{textAlign:'center',marginBottom:28}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#08d9ff',marginBottom:12}}>Step 1 of 3 — Chaturbate</div>
              <h1 style={{fontSize:28,fontWeight:800,color:'#ffffff',marginBottom:10}}>What's your Chaturbate username?</h1>
              <p style={{fontSize:14,color:'rgba(148,163,184,0.8)',lineHeight:1.65}}>We'll open your token stats page directly so you can copy your tip history.</p>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:600,color:'rgba(148,163,184,0.7)',marginBottom:8}}>Chaturbate username</div>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'rgba(100,116,139,0.8)',fontWeight:500,pointerEvents:'none',fontFamily:'monospace'}}>chaturbate.com/p/</span>
                <input type="text" value={cbUsername} onChange={e=>{setCbUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,''));setCbUsernameError('')}} onKeyDown={e=>e.key==='Enter'&&handleUsernameSubmit()} placeholder="yourname" autoFocus
                  style={{width:'100%',padding:'14px 14px 14px 190px',background:'rgba(4,6,18,0.7)',border:`1px solid ${cbUsernameError?'rgba(248,113,113,0.5)':'rgba(255,255,255,0.1)'}`,borderRadius:14,color:'#e2e8f0',fontSize:14,fontFamily:'monospace',outline:'none',transition:'border-color 0.2s'}}/>
              </div>
              {cbUsernameError&&<div style={{marginTop:8,fontSize:12,color:'#f87171'}}>⚠️ {cbUsernameError}</div>}
              {cbUsername&&<div style={{marginTop:8,fontSize:12,color:'rgba(100,116,139,0.7)'}}>Your stats page: <span style={{color:'#08d9ff'}}>chaturbate.com/p/{cbUsername}/?tab=tokens</span></div>}
            </div>
            <button className="btn-cta" onClick={handleUsernameSubmit} style={{marginBottom:12}}>Continue →</button>
            <div style={{display:'flex',gap:16,justifyContent:'center'}}>
              <button className="skip-link" onClick={()=>setStep('platform')}>← Back</button>
              <span style={{color:'rgba(100,116,139,0.4)',fontSize:13}}>·</span>
              <button className="skip-link" onClick={()=>{setCbUsername('');setStep('paste')}}>Skip — I'll navigate there myself</button>
            </div>
            <TrustLine/>
          </div>
        )}

        {/* ── PASTE ── */}
        {step==='paste'&&(
          <div style={{animation:'fadeUp 0.3s ease both'}}>
            <div style={{textAlign:'center',marginBottom:24}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#08d9ff',marginBottom:12}}>Step 2 of 3 — {platform.name.toUpperCase()}</div>
              <h1 style={{fontSize:28,fontWeight:800,color:'#ffffff',marginBottom:10}}>Paste your tip history</h1>
              <p style={{fontSize:14,color:'rgba(148,163,184,0.8)',lineHeight:1.65}}>
                Copy your earnings rows from {platform.name} and paste them below.<br/>CamCash will clean the data automatically.
              </p>
            </div>

            {/* how-to panel */}
            <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:16,padding:'18px 20px',marginBottom:14}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,marginBottom:12}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#08d9ff',marginBottom:6}}>How to copy from {platform.name}</div>
                  <p style={{fontSize:13,color:'rgba(148,163,184,0.8)',lineHeight:1.6}}>{platform.hint}</p>
                </div>
                <button onClick={()=>window.open(platform.earningsUrl(cbUsername),'_blank')}
                  style={{flexShrink:0,padding:'8px 16px',borderRadius:10,background:'transparent',border:'1px solid rgba(8,217,255,0.4)',color:'#08d9ff',fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',transition:'all 0.2s'}}>
                  Open earnings page ↗
                </button>
              </div>
              <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
                {['No password required','You control what gets imported','Takes about 60 seconds'].map(t=>(
                  <div key={t} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'rgba(148,163,184,0.75)'}}>
                    <div style={{width:16,height:16,borderRadius:'50%',background:'rgba(8,217,255,0.15)',border:'1px solid rgba(8,217,255,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#08d9ff',fontWeight:700,flexShrink:0}}>✓</div>
                    {t}
                  </div>
                ))}
              </div>
            </div>

            <textarea className="paste-area" value={pasteText} onChange={e=>setPasteText(e.target.value)}
              placeholder={`Paste your ${platform.name} tip history here…\n\nExample:\n${platform.placeholder}`}
              style={{marginBottom:parseError?10:14}}/>

            {parseError&&<div style={{marginBottom:14,padding:'10px 14px',borderRadius:10,background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.25)',fontSize:13,color:'#f87171'}}>⚠️ {parseError}</div>}

            {/* 3-step helper */}
            <div style={{display:'flex',alignItems:'center',marginBottom:20,gap:0}}>
              {[['Open your earnings\nor tip history'],['Highlight the rows\nyou want'],['Copy and paste\nthem here']].map(([t],i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',flex:1}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:10,flex:1}}>
                    <div style={{width:26,height:26,borderRadius:'50%',background:'rgba(8,217,255,0.12)',border:'1px solid rgba(8,217,255,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#08d9ff',flexShrink:0,marginTop:1}}>{i+1}</div>
                    <span style={{fontSize:12,color:'rgba(148,163,184,0.7)',lineHeight:1.4,whiteSpace:'pre-line'}}>{t}</span>
                  </div>
                  {i<2&&<div style={{width:1,height:36,background:'rgba(255,255,255,0.08)',flexShrink:0,margin:'0 16px'}}/>}
                </div>
              ))}
            </div>

            <div style={{display:'flex',gap:10,marginBottom:14}}>
              <button className="btn-back" onClick={()=>setStep('platform')}>← Back</button>
              <button className="btn-cta" style={{flex:1}} onClick={handlePreview}>Preview Import →</button>
            </div>
            <div style={{textAlign:'center',display:'flex',gap:16,justifyContent:'center'}}>
              <button className="skip-link" onClick={()=>setStep('csv')}>Upload CSV instead</button>
              <span style={{color:'rgba(100,116,139,0.4)',fontSize:13}}>·</span>
              <button className="skip-link" onClick={skipToDashboard}>Track future tips instead</button>
            </div>
            <TrustLine/>
          </div>
        )}

        {/* ── CSV ── */}
        {step==='csv'&&(
          <div style={{animation:'fadeUp 0.3s ease both'}}>
            <div style={{textAlign:'center',marginBottom:24}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#08d9ff',marginBottom:12}}>Step 2 of 3 — {platform.name.toUpperCase()}</div>
              <h1 style={{fontSize:28,fontWeight:800,color:'#ffffff',marginBottom:10}}>Upload your CSV</h1>
              <p style={{fontSize:14,color:'rgba(148,163,184,0.8)',lineHeight:1.65}}>Export your earnings as a CSV file and drop it below.</p>
            </div>
            <div onClick={()=>!csvUploading&&csvRef.current?.click()}
              style={{border:'2px dashed rgba(255,255,255,0.12)',borderRadius:16,padding:'44px 20px',textAlign:'center',cursor:csvUploading?'not-allowed':'pointer',background:'rgba(255,255,255,0.02)',marginBottom:16,transition:'all 0.2s'}}>
              <input ref={csvRef} type="file" accept=".csv,.txt" style={{display:'none'}} onChange={e=>{const f=e.target.files[0];if(f)handleCsvUpload(f)}}/>
              {csvUploading?(
                <><div style={{width:28,height:28,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.1)',borderTopColor:'#08d9ff',animation:'spin 0.8s linear infinite',margin:'0 auto 12px'}}/><div style={{fontSize:14,color:'#08d9ff',fontWeight:500}}>Uploading…</div></>
              ):(
                <><div style={{fontSize:32,marginBottom:10}}>📁</div><div style={{fontSize:14,fontWeight:700,color:'#f8fafc',marginBottom:4}}>Drop your CSV here or click to browse</div><div style={{fontSize:12,color:'rgba(148,163,184,0.6)'}}>Supports {platform.name} export format</div></>
              )}
            </div>
            {csvError&&<div style={{marginBottom:16,padding:'10px 14px',borderRadius:10,background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.25)',fontSize:13,color:'#f87171'}}>⚠️ {csvError}</div>}
            <div style={{display:'flex',gap:10}}>
              <button className="btn-back" onClick={()=>setStep('paste')}>← Use paste instead</button>
              <button className="btn-ghost" onClick={()=>setStep('platform')}>← Back</button>
            </div>
            <TrustLine/>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {step==='preview'&&previewData&&(
          <div style={{animation:'fadeUp 0.3s ease both'}}>
            <div style={{textAlign:'center',marginBottom:24}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#08d9ff',marginBottom:12}}>Step 3 of 3</div>
              <h1 style={{fontSize:28,fontWeight:800,color:'#ffffff',marginBottom:10}}>Here's what we found</h1>
              <p style={{fontSize:14,color:'rgba(148,163,184,0.8)'}}>Review before importing.</p>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
              {[{label:'Tips found',value:previewData.count.toLocaleString(),color:'#08d9ff'},{label:'Est. earnings',value:`$${previewData.usd}`,color:'#4ade80'},{label:'Unique fans',value:previewData.fans.toLocaleString(),color:'#f59e0b'}].map(s=>(
                <div key={s.label} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:'16px 14px',textAlign:'center'}}>
                  <div style={{fontSize:11,color:'rgba(148,163,184,0.6)',marginBottom:6}}>{s.label}</div>
                  <div style={{fontSize:22,fontWeight:800,color:s.color}}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:'12px 16px',marginBottom:14,fontSize:13,color:'rgba(148,163,184,0.7)'}}>
              <span style={{color:'rgba(148,163,184,0.5)'}}>Date range: </span>
              <span style={{color:'#f8fafc',fontWeight:600}}>{previewData.from} – {previewData.to}</span>
              {previewData.skipped>0&&<span style={{marginLeft:16,color:'#f59e0b'}}>⚠️ {previewData.skipped} rows skipped</span>}
            </div>
            {(previewData.topSpender||previewData.bestHour)&&(
              <div style={{background:'rgba(8,217,255,0.05)',border:'1px solid rgba(8,217,255,0.15)',borderRadius:12,padding:'14px 16px',marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#08d9ff',marginBottom:10}}>First insights detected</div>
                <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                  {previewData.topSpender&&<div style={{background:'rgba(255,255,255,0.04)',borderRadius:8,padding:'8px 12px',fontSize:12,color:'rgba(148,163,184,0.8)'}}>🐋 Top spender: <span style={{color:'#f8fafc',fontWeight:600}}>{previewData.topSpender.name}</span> ({previewData.topSpender.tokens.toLocaleString()} tokens)</div>}
                  {previewData.bestHour&&<div style={{background:'rgba(255,255,255,0.04)',borderRadius:8,padding:'8px 12px',fontSize:12,color:'rgba(148,163,184,0.8)'}}>⏰ Best hour: <span style={{color:'#f8fafc',fontWeight:600}}>{previewData.bestHour}</span></div>}
                </div>
              </div>
            )}
            <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,marginBottom:14,overflow:'hidden'}}>
              <div style={{padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.07)',fontSize:11,fontWeight:700,color:'rgba(148,163,184,0.5)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Sample rows</div>
              {previewData.sample.map((r,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',borderBottom:i<previewData.sample.length-1?'1px solid rgba(255,255,255,0.06)':'none'}}>
                  <div style={{fontSize:11,color:'rgba(148,163,184,0.5)',minWidth:100}}>{r.ts.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
                  <div style={{fontSize:13,color:'#f8fafc',flex:1}}>{r.username}</div>
                  <div style={{fontSize:13,fontWeight:700,color:'#08d9ff'}}>{r.tokens.toLocaleString()}</div>
                  <div style={{fontSize:12,color:'#4ade80'}}>${r.usd.toFixed(2)}</div>
                </div>
              ))}
            </div>
            {importError&&<div style={{marginBottom:14,padding:'10px 14px',borderRadius:10,background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.25)',fontSize:13,color:'#f87171'}}>⚠️ {importError}</div>}
            <div style={{display:'flex',gap:10,marginBottom:14}}>
              <button className="btn-back" onClick={()=>setStep('paste')}>← Edit paste</button>
              <button className="btn-cta" style={{flex:1}} onClick={handleImport}>Import {previewData.count.toLocaleString()} tips →</button>
            </div>
            <div style={{textAlign:'center'}}>
              <button className="skip-link" onClick={()=>setStep('csv')}>Try CSV instead</button>
            </div>
            <TrustLine/>
          </div>
        )}

        {/* ── LOADING ── */}
        {step==='loading'&&<LoadingScreen isFirst={isFirstImport}/>}

        {/* ── LIVE MODE DEMO ── */}
        {step==='live'&&(
          <LiveModeDemo
            onInstall={()=>{ window.open('https://chrome.google.com/webstore','_blank'); setStep('done') }}
            onSkip={()=>setStep('done')}
          />
        )}

        {/* ── STEP 4 ── */}
        {step==='step4'&&(
          <div style={{animation:'fadeUp 0.3s ease both'}}>
            <div style={{textAlign:'center',marginBottom:28}}>
              <div style={{fontSize:36,marginBottom:16}}>✅</div>
              <h1 style={{fontSize:26,fontWeight:800,color:'#ffffff',marginBottom:8}}>Make your dashboard smarter</h1>
              <p style={{fontSize:14,color:'rgba(148,163,184,0.8)',lineHeight:1.6}}>Add more history or turn on live tracking so CamCash can find stronger patterns.</p>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
              {[{icon:'📥',title:'Add more history',sub:'Improve accuracy with more tip data',action:()=>{setPasteText('');setStep('paste')},color:'#08d9ff'},{icon:'📡',title:'Set up live tracking',sub:'Track future tips automatically while you stream',action:()=>window.open('https://chrome.google.com/webstore','_blank'),color:'#a78bfa'},{icon:'📊',title:'Go to dashboard',sub:'See what CamCash found so far',action:()=>router.push('/dashboard'),color:'#4ade80'}].map(a=>(
                <button key={a.title} className="action-card" onClick={a.action}>
                  <div style={{fontSize:20,width:44,height:44,borderRadius:12,background:`rgba(${a.color==='#08d9ff'?'8,217,255':a.color==='#a78bfa'?'167,139,250':'74,222,128'},0.1)`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{a.icon}</div>
                  <div><div style={{fontSize:14,fontWeight:700,color:'#f8fafc',marginBottom:2}}>{a.title}</div><div style={{fontSize:12,color:'rgba(148,163,184,0.6)'}}>{a.sub}</div></div>
                  <div style={{marginLeft:'auto',color:'rgba(148,163,184,0.4)',fontSize:16}}>→</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {step==='done'&&importResult&&(
          <div style={{animation:'fadeUp 0.4s ease both',textAlign:'center'}}>
            <div style={{position:'relative',display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:20}}>
              <div style={{width:76,height:76,borderRadius:'50%',background:'radial-gradient(circle,rgba(8,217,255,0.2) 0%,transparent 70%)',border:'1.5px solid rgba(8,217,255,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:34,boxShadow:'0 0 40px rgba(8,217,255,0.2),0 0 0 8px rgba(8,217,255,0.06)',animation:'glowPulse 2.5s ease-in-out infinite'}}>✦</div>
            </div>
            <h1 style={{fontSize:28,fontWeight:800,color:'#ffffff',marginBottom:8}}>Your dashboard is ready</h1>
            <p style={{fontSize:14,color:'rgba(148,163,184,0.8)',lineHeight:1.6,maxWidth:400,margin:'0 auto 28px'}}>We imported your tip history and found your first insights.</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:24}}>
              {[{label:'Tips imported',value:importResult.inserted,color:'#08d9ff',prefix:'',suffix:'',delay:'0s'},{label:'Unique fans',value:previewData?.fans||0,color:'#f59e0b',prefix:'',suffix:'',delay:'0.15s'},{label:'Est. earnings',value:parseFloat(previewData?.usd||0),color:'#4ade80',prefix:'$',suffix:'',delay:'0.3s'},{label:'Top spender',value:1,color:'#a78bfa',prefix:'',suffix:' found',delay:'0.45s'}].map(s=>(
                <div key={s.label} className="stat-card"
                  style={{background:'rgba(255,255,255,0.03)',border:`1px solid rgba(${s.color==='#08d9ff'?'8,217,255':s.color==='#f59e0b'?'245,158,11':s.color==='#4ade80'?'74,222,128':'167,139,250'},0.2)`,borderRadius:14,padding:'18px 14px',boxShadow:`0 0 20px rgba(${s.color==='#08d9ff'?'8,217,255':s.color==='#f59e0b'?'245,158,11':s.color==='#4ade80'?'74,222,128':'167,139,250'},0.06)`,animation:`fadeUp 0.4s ease ${s.delay} both`}}>
                  <div style={{fontSize:11,color:'rgba(148,163,184,0.5)',marginBottom:8}}>{s.label}</div>
                  <div style={{fontSize:24,fontWeight:800,color:s.color}}><CountUp to={s.value} prefix={s.prefix} suffix={s.suffix} duration={1000}/></div>
                </div>
              ))}
            </div>
            {importResult.skipped>0&&<div style={{fontSize:12,color:'rgba(100,116,139,0.6)',marginBottom:20}}>({importResult.skipped} duplicate rows skipped — that's normal)</div>}
            <button className="btn-cta" onClick={()=>router.push('/dashboard')} style={{marginBottom:10}}>Go to Dashboard →</button>
            <div style={{display:'flex',gap:10}}>
              <button className="btn-ghost" style={{flex:1}} onClick={()=>{setPasteText('');setStep('paste')}}>Add more history</button>
              <button className="btn-ghost" style={{flex:1}} onClick={()=>window.open('https://chrome.google.com/webstore','_blank')}>Set up live tracking</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

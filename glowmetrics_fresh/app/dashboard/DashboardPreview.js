'use client'
// ============================================================
// CAMCASH — POST-ONBOARDING DASHBOARD (Refined)
// DashboardPreview.js
// ============================================================

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = {
  bg:     '#12131a',
  card:   'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
  cyan:   '#22D3EE',
  pink:   '#EC4899',
  indigo: '#7C5CFF',
  gold:   '#F59E0B',
  green:  '#10B981',
  white:  '#F1F5F9',
  text:   '#94A3B8',
  muted:  '#475569',
  grad:   'linear-gradient(90deg,#22D3EE,#7C5CFF,#EC4899)',
}

const safeNum = (v, f=0) => { const n=parseFloat(v); return isNaN(n)||!isFinite(n)?f:n }
const fmt$ = v => `$${safeNum(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const fmtN = v => safeNum(v).toLocaleString('en-US')
const fmtDateTime = d => { if(!d) return '—'; return new Date(d).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) }

const glass = (extra={}) => ({
  borderRadius:24, border:`1px solid ${C.border}`,
  background:'rgba(255,255,255,0.04)',
  backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
  padding:'22px 24px', position:'relative', overflow:'hidden', ...extra,
})

const pill = (color=C.cyan) => ({
  display:'inline-flex', alignItems:'center',
  padding:'5px 14px', borderRadius:100,
  background:`${color}14`, border:`1px solid ${color}30`,
  fontSize:12, fontWeight:700, color, whiteSpace:'nowrap',
})

const primaryBtn = (extra={}) => ({
  display:'inline-flex', alignItems:'center', justifyContent:'center',
  borderRadius:100, border:'none', cursor:'pointer',
  background:C.grad, color:'#000', fontWeight:800, fontSize:13,
  padding:'11px 24px', boxShadow:'0 0 28px rgba(255,61,196,0.3)',
  transition:'transform 0.15s, box-shadow 0.15s', whiteSpace:'nowrap', ...extra,
})

const secondaryBtn = (extra={}) => ({
  display:'inline-flex', alignItems:'center', justifyContent:'center',
  borderRadius:100, border:`1px solid rgba(255,255,255,0.14)`,
  background:'rgba(255,255,255,0.06)', color:C.white,
  fontWeight:600, fontSize:13, padding:'11px 24px',
  cursor:'pointer', transition:'background 0.15s', whiteSpace:'nowrap', ...extra,
})

function TopLine({ color='rgba(34,211,238,0.5)' }) {
  return <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${color},transparent)`}}/>
}

function SectionLabel({ children }) {
  return <div style={{fontSize:10,fontWeight:800,letterSpacing:'0.2em',textTransform:'uppercase',color:C.muted,marginBottom:12}}>{children}</div>
}

// ── EXPORTS ───────────────────────────────────────────────────

export function getDashboardReadiness({ totalTips=0, totalSessions=0, totalFans=0, totalEarnings=0 }) {
  if (!totalTips||totalTips===0) return 'no_data'
  if (totalTips<25||totalSessions<3||totalFans<5||totalEarnings<10) return 'very_low_data'
  if (totalTips<100||totalSessions<8||totalFans<20||totalEarnings<50) return 'partial_data'
  return 'full_data'
}

export function getDashboardStage({ tipCount=0, sessionCount=0, totalEarnings=0 }) {
  if (tipCount===0) return 'empty'
  const r = getDashboardReadiness({ totalTips:tipCount, totalSessions:sessionCount, totalEarnings })
  return r==='full_data' ? 'ready' : 'preview'
}

export function getPlanAccess(userPlan='free', trackedPlatformCount=0) {
  const isPro = userPlan==='pro'
  return { isPro, isFree:!isPro, canTrackMultiplePlatforms:isPro, canComparePlatforms:isPro,
    freePlatformLimitReached:!isPro&&trackedPlatformCount>=1 }
}

export function getFeatureLockState({ feature, userPlan='free', totalTips=0, totalSessions=0, totalFans=0, totalEarnings=0, totalStreamMinutes=0, importedPlatforms=[], liveModeSessions=0 }) {
  const isPro=userPlan==='pro', platformCount=importedPlatforms?.length||0
  const rules = {
    bestStreamingTimes:    { needsData:totalSessions<3||totalTips<25, requiresPro:false, dataMessage:'Unlocks after 3+ sessions with timestamps.', proMessage:null },
    topFans:               { needsData:totalFans<5||totalTips<10, requiresPro:false, dataMessage:'Unlocks after more fan and tip activity.', proMessage:null },
    whales:                { needsData:totalFans<10||totalEarnings<50, requiresPro:false, dataMessage:'Unlocks after enough repeat fan activity.', proMessage:null },
    platformComparison:    { needsData:isPro&&platformCount<2, requiresPro:!isPro, dataMessage:'Import at least 2 platforms to compare earnings.', proMessage:'Upgrade to Pro to compare earnings across platforms.' },
    multiPlatformTracking: { needsData:false, requiresPro:!isPro, dataMessage:null, proMessage:'Upgrade to Pro to track more than one platform.' },
    crossPlatformBestTimes:{ needsData:isPro&&(platformCount<2||totalSessions<3), requiresPro:!isPro, dataMessage:'Import sessions from at least 2 platforms to unlock this.', proMessage:'Upgrade to Pro to unlock cross-platform best times.' },
    sessionPerformance:    { needsData:totalSessions<3, requiresPro:false, dataMessage:'Unlocks after multiple completed sessions.', proMessage:null },
    averageHourly:         { needsData:totalSessions<3||totalStreamMinutes<60, requiresPro:false, dataMessage:'Unlocks after at least 60 minutes of tracked stream time.', proMessage:null },
    liveScore:             { needsData:liveModeSessions<1, requiresPro:false, dataMessage:'Unlocks after your first Live Mode stream.', proMessage:null },
    retention:             { needsData:totalSessions<5||totalFans<20, requiresPro:false, dataMessage:'Unlocks after more repeat fan activity.', proMessage:null },
    forecasting:           { needsData:totalSessions<8||totalEarnings<50, requiresPro:false, dataMessage:'Unlocks after more earnings history.', proMessage:null },
  }
  const rule=rules[feature]
  if (!rule) return { locked:false, lockType:null, message:null }
  if (rule.requiresPro) return { locked:true, lockType:'requires_pro', message:rule.proMessage }
  if (rule.needsData) return { locked:true, lockType:'needs_data', message:rule.dataMessage }
  return { locked:false, lockType:null, message:null }
}

export const canShowBestHours    = ({ tipCount, sessionCount }) => tipCount>=25&&sessionCount>=3
export const canShowWhales       = ({ uniqueFanCount, totalEarnings }) => uniqueFanCount>=5&&totalEarnings>=50
export const canShowPlatformComp = ({ platformCount, sessionCount }) => platformCount>=2&&sessionCount>=4
export const canShowSessionPerf  = ({ sessionCount }) => sessionCount>=3
export const canShowRetention    = ({ uniqueFanCount, dateRangeDays }) => uniqueFanCount>=10&&dateRangeDays>=7
export const canShowHourlyRate   = ({ sessionCount, totalStreamMinutes }) => sessionCount>=3&&totalStreamMinutes>=60

export function LockedInsightCard({ title, description, lockType='needs_data', requirement, ctaLabel, ctaAction }) {
  const isData=lockType==='needs_data'
  const color=isData?C.cyan:C.pink
  return (
    <div style={{...glass({background:`${color}08`,border:`1px solid ${color}22`,padding:'16px 18px'})}}>
      <TopLine color={`${color}60`}/>
      <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
        <div style={{width:32,height:32,borderRadius:9,background:`${color}18`,border:`1px solid ${color}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{isData?'📊':'✦'}</div>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
            <div style={{fontSize:13,fontWeight:700,color:C.white}}>{title}</div>
            <span style={{...pill(color),fontSize:10,padding:'2px 9px'}}>{isData?'Training':'Pro'}</span>
          </div>
          <div style={{fontSize:11,color:C.text,lineHeight:1.6,marginBottom:requirement?7:0}}>{description}</div>
          {requirement&&<div style={{fontSize:10,color:C.muted,marginBottom:ctaLabel?10:0}}>◦ {requirement}</div>}
          {ctaLabel&&ctaAction&&<button onClick={ctaAction} style={{padding:'5px 13px',borderRadius:100,border:`1px solid ${color}40`,background:`${color}12`,color,fontSize:11,fontWeight:700,cursor:'pointer'}}>{ctaLabel}</button>}
        </div>
      </div>
    </div>
  )
}

export function EmptyDashboard({ onImport, onLiveMode }) {
  return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:24,fontFamily:"'Inter',system-ui,sans-serif",position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at top left,rgba(0,245,255,0.10),transparent 35%),radial-gradient(circle at top right,rgba(255,61,196,0.10),transparent 35%)',pointerEvents:'none'}}/>
      <div style={{maxWidth:460,width:'100%',textAlign:'center',position:'relative',zIndex:1}}>
        <div style={{width:68,height:68,borderRadius:20,background:C.grad,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,margin:'0 auto 22px',boxShadow:'0 0 40px rgba(34,211,238,0.2),0 0 80px rgba(236,72,153,0.1)'}}>$</div>
        <div style={{fontSize:24,fontWeight:900,color:C.white,letterSpacing:'-0.025em',marginBottom:10}}>Your CamCash dashboard is ready ✨</div>
        <div style={{fontSize:14,color:C.text,lineHeight:1.7,marginBottom:28,maxWidth:340,margin:'0 auto 28px'}}>Import your first tips or start Live Mode to unlock your personal earnings insights.</div>
        <div style={{display:'flex',flexDirection:'column',gap:10,maxWidth:300,margin:'0 auto'}}>
          <button onClick={onImport} style={primaryBtn({width:'100%',padding:'13px',fontSize:14})}>Import My Tips →</button>
          <button onClick={onLiveMode} style={secondaryBtn({width:'100%',padding:'12px',fontSize:13})}>Start Live Mode</button>
        </div>
      </div>
    </div>
  )
}

export function DashboardPreview({ tips=[], analytics, userPlan='free', onAddHistory, onContinue, onUpgrade, onLiveMode }) {
  const router = useRouter()

  const totalTips     = tips.length
  const totalUSD      = safeNum(tips.reduce((s,t)=>s+safeNum(t.usd),0))
  const totalTokens   = tips.reduce((s,t)=>s+(parseInt(t.tokens)||0),0)
  const hasUSD        = totalUSD>0
  const isEstimated   = !hasUSD&&totalTokens>0

  const platforms     = [...new Set(tips.map(t=>t.platform).filter(p=>p&&p!=='Unknown'))]
  const platformCount = platforms.length
  const primaryPlatform = platforms[0] || null

  const fans          = [...new Set(tips.map(t=>(t.username||'').toLowerCase()).filter(Boolean))]
  const totalFans     = fans.length
  const totalSessions = analytics?.meaningfulSessionCount||0
  const totalEarnings = totalUSD
  const totalStreamMinutes = analytics?.totalStreamMinutes||0
  const liveModeSessions = 0

  const recentTips    = [...tips].sort((a,b)=>new Date(b.date_time||b.dateRaw)-new Date(a.date_time||a.dateRaw)).slice(0,8)
  const mostRecentTip = recentTips[0]||null
  const avgTip        = totalTips>0&&hasUSD ? totalUSD/totalTips : 0
  const maxTip        = tips.length>0 ? safeNum(Math.max(...tips.map(t=>safeNum(t.usd)))) : 0

  const fanTotals={}, fanCounts={}
  let biggestSingle=null, biggestSingleAmt=0
  tips.forEach(t=>{
    const u=(t.username||'anonymous').toLowerCase()
    fanTotals[u]=safeNum(fanTotals[u])+safeNum(t.usd)
    fanCounts[u]=(fanCounts[u]||0)+1
    if(safeNum(t.usd)>biggestSingleAmt){biggestSingleAmt=safeNum(t.usd);biggestSingle=t.username}
  })
  const topByTotal = Object.entries(fanTotals).sort((a,b)=>b[1]-a[1])[0]
  const topByCount = Object.entries(fanCounts).sort((a,b)=>b[1]-a[1])[0]

  const readiness = getDashboardReadiness({ totalTips, totalSessions, totalFans, totalEarnings })
  const isPro = userPlan==='pro'

  const progressItems = [
    { label:'Account created', done:true },
    { label:'Onboarding completed', done:true },
    { label:'Import your first tips', done:totalTips>0 },
    { label:'Complete 3+ sessions', done:totalSessions>=3 },
    { label:'Add 25+ tips', done:totalTips>=25 },
    { label:'Start Live Mode', done:liveModeSessions>=1 },
    { label:'Unlock full insights', done:readiness==='full_data' },
  ]
  const progressPct = Math.round((progressItems.filter(i=>i.done).length/progressItems.length)*100)

  const lockArgs = { userPlan, totalTips, totalSessions, totalFans, totalEarnings, totalStreamMinutes, importedPlatforms:platforms, liveModeSessions }
  const ALL_PLATFORMS = ['Chaturbate','BongaCams','MyFreeCams','Stripchat','CamSoda']

  const unlockRows = [
    { label:'Best Streaming Times', req:'3+ sessions with timestamps', done:totalSessions>=3, status: totalSessions>=2?'Almost ready':'Training' },
    { label:'Live Mode Score', req:'Start your first Live Mode session', done:liveModeSessions>=1, status:'Ready after first stream' },
    { label:'Platform Insights', req:'Choose your first tracked platform', done:platformCount>=1, status:platformCount>=1?'Active':'Unlocks soon' },
  ]

  return (
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:"'Inter',system-ui,sans-serif",color:C.white,position:'relative'}}>
      <div style={{position:'fixed',inset:0,background:'radial-gradient(circle at top left,rgba(0,245,255,0.08),transparent 35%),radial-gradient(circle at top right,rgba(255,61,196,0.08),transparent 35%)',pointerEvents:'none',zIndex:0}}/>

      <div style={{position:'relative',zIndex:1,maxWidth:920,margin:'0 auto',padding:'32px 20px 64px'}}>

        {/* ── 1. HERO ── */}
        <div style={{...glass({marginBottom:16,padding:'28px 28px 24px'})}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:C.grad,borderRadius:'24px 24px 0 0'}}/>
          <div style={{fontSize:10,fontWeight:800,letterSpacing:'0.22em',textTransform:'uppercase',color:C.cyan,marginBottom:10}}>CamCash Dashboard</div>
          <h1 style={{fontSize:24,fontWeight:900,color:C.white,letterSpacing:'-0.025em',lineHeight:1.2,marginBottom:8}}>Your first earnings snapshot is ready ✨</h1>
          <p style={{fontSize:14,color:C.text,lineHeight:1.65,marginBottom:4,maxWidth:560}}>CamCash found your first earnings data. Add more history to unlock your best times, top fans, and deeper trends.</p>
          <p style={{fontSize:11,color:C.muted,fontStyle:'italic',marginBottom:20}}>Early data shown now. Accuracy improves as you add more sessions.</p>

          {/* Stat pills */}
          <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:22}}>
            {[
              { label:`${fmtN(totalTips)} tips imported`, color:C.cyan },
              { label:`${fmtN(totalFans)} fans found`, color:C.pink },
              { label:hasUSD?`${fmt$(totalUSD)} detected`:isEstimated?`${fmtN(totalTokens)} tokens`:'No earnings yet', color:C.gold },
              { label:`${fmtN(totalSessions)} sessions found`, color:C.green },
            ].map((p,i)=>(
              <span key={i} style={pill(p.color)}>{p.label}</span>
            ))}
          </div>

          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <button onClick={onAddHistory} style={primaryBtn()}>Import More Data →</button>
            <button onClick={onLiveMode} style={secondaryBtn()}>Open Live Mode</button>
          </div>
        </div>

        {/* ── 2. FREE PLAN ── */}
        {!isPro&&(
          <div style={{...glass({marginBottom:16,padding:'16px 22px'})}}>
            <TopLine color="rgba(124,92,255,0.5)"/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontSize:13,fontWeight:800,color:C.white,marginBottom:3}}>Free plan</div>
                <div style={{fontSize:12,color:C.text,lineHeight:1.55}}>Track 1 platform for free. Choose your first platform to start building your dashboard.</div>
                <div style={{fontSize:11,color:C.muted,marginTop:4}}>Your free plan includes 1 active platform. Pro unlocks multi-platform tracking and comparisons.</div>
              </div>
              <button onClick={onUpgrade} style={primaryBtn({fontSize:12,padding:'9px 18px'})}>Upgrade to Pro</button>
            </div>
          </div>
        )}

        {/* ── 3. SNAPSHOT CARDS ── */}
        <SectionLabel>Your snapshot</SectionLabel>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:20}}>
          {[
            { label:'Earnings Detected', value:hasUSD?fmt$(totalUSD):'Not started', color:C.gold },
            { label:'Tips Imported', value:totalTips>0?fmtN(totalTips):'Not started', color:C.cyan },
            { label:'Fans Detected', value:totalFans>0?fmtN(totalFans):'Not started', color:C.pink },
            { label:'Sessions', value:totalSessions>0?fmtN(totalSessions):'Not started', color:C.green },
            { label:'Avg $/Hour', value:canShowHourlyRate({sessionCount:totalSessions,totalStreamMinutes})?fmt$(analytics?.avgPerHour||0):'Needs more data', color:C.indigo, helper:!canShowHourlyRate({sessionCount:totalSessions,totalStreamMinutes})?'Unlocks after 60+ tracked minutes':null },
          ].map(s=>(
            <div key={s.label} style={{...glass({padding:'14px 16px'})}}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${s.color}70,transparent)`,borderRadius:'24px 24px 0 0'}}/>
              <div style={{fontSize:10,color:C.muted,marginBottom:5,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.1em'}}>{s.label}</div>
              <div style={{fontSize:20,fontWeight:900,color:s.color,lineHeight:1.1}}>{s.value}</div>
              {s.helper&&<div style={{fontSize:9,color:C.muted,marginTop:3,lineHeight:1.4}}>{s.helper}</div>}
            </div>
          ))}
        </div>

        {/* ── 4. WHAT CAMCASH FOUND ── */}
        <SectionLabel>What CamCash found so far</SectionLabel>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12,marginBottom:20}}>

          {/* Earnings */}
          <div style={glass()}>
            <TopLine color="rgba(245,158,11,0.5)"/>
            <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:14}}>
              <div style={{width:32,height:32,borderRadius:9,background:'rgba(245,158,11,0.12)',border:'1px solid rgba(245,158,11,0.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}>💵</div>
              <div style={{fontSize:14,fontWeight:800,color:C.white}}>Earnings Snapshot</div>
            </div>
            {hasUSD?(
              <>
                <div style={{fontSize:28,fontWeight:900,color:C.gold,marginBottom:12}}>{fmt$(totalUSD)}</div>
                {[['Tips imported',fmtN(totalTips)],['Average tip',avgTip>0?fmt$(avgTip):'—'],['Largest tip',maxTip>0?fmt$(maxTip):'—'],['Most recent',mostRecentTip?fmt$(safeNum(mostRecentTip.usd)):'—']].map(([l,v])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.04)',fontSize:12}}>
                    <span style={{color:C.muted,fontSize:11}}>{l}</span>
                    <span style={{color:C.white,fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </>
            ):(
              <div style={{fontSize:12,color:C.muted,lineHeight:1.6}}>Waiting for your first import.</div>
            )}
          </div>

          {/* Top supporters */}
          <div style={glass()}>
            <TopLine color="rgba(236,72,153,0.5)"/>
            <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:14}}>
              <div style={{width:32,height:32,borderRadius:9,background:'rgba(236,72,153,0.12)',border:'1px solid rgba(236,72,153,0.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}>⭐</div>
              <div style={{fontSize:14,fontWeight:800,color:C.white}}>Top Supporters So Far</div>
            </div>
            {topByTotal?(
              <>
                {[
                  {label:'Top supporter',icon:'👑',value:topByTotal[0],sub:fmt$(topByTotal[1])+' total'},
                  {label:'Most frequent',icon:'🔄',value:topByCount?.[0]||'—',sub:`${topByCount?.[1]||0} tips`},
                  {label:'Biggest single',icon:'💎',value:biggestSingle||'—',sub:maxTip>0?fmt$(maxTip):'—'},
                  {label:'Most recent',icon:'⏱',value:mostRecentTip?.username||'—',sub:mostRecentTip?fmtDateTime(mostRecentTip.date_time||mostRecentTip.dateRaw):'—'},
                ].map(({label,icon,value,sub})=>(
                  <div key={label} style={{display:'flex',alignItems:'center',gap:9,padding:'7px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                    <div style={{width:26,height:26,borderRadius:7,background:'rgba(255,255,255,0.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>{icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10,color:C.muted,marginBottom:1}}>{label}</div>
                      <div style={{fontSize:12,fontWeight:700,color:C.white}}>{value}</div>
                    </div>
                    <div style={{fontSize:11,color:C.text}}>{sub}</div>
                  </div>
                ))}
                <div style={{marginTop:10,fontSize:11,color:C.muted,lineHeight:1.5}}>Import more history to reveal true whales and repeat supporters.</div>
              </>
            ):(
              <div style={{fontSize:12,color:C.muted}}>Still learning — supporters will appear after more tip activity.</div>
            )}
          </div>
        </div>

        {/* ── 5. NEXT BEST STEP ── */}
        <div style={{...glass({marginBottom:20,background:'rgba(124,92,255,0.06)',border:'1px solid rgba(124,92,255,0.18)',padding:'20px 24px'})}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:C.grad,borderRadius:'24px 24px 0 0'}}/>
          <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:16}}>
            <div style={{flex:1,minWidth:220}}>
              <div style={{fontSize:14,fontWeight:800,color:C.white,marginBottom:6}}>Your next best step</div>
              <div style={{fontSize:13,color:C.text,lineHeight:1.6}}>
                {platformCount===0
                  ? 'Choose your first platform and import your first full session.'
                  : totalSessions<3
                  ? 'Add at least 2 more sessions so CamCash can calculate your best streaming times.'
                  : 'Keep adding history — more data unlocks stronger insights.'}
              </div>
            </div>
            <div style={{display:'flex',gap:9,flexWrap:'wrap'}}>
              <button onClick={platformCount===0?onAddHistory:onAddHistory} style={primaryBtn({fontSize:12})}>
                {platformCount===0?'Choose Platform →':'Import More Data →'}
              </button>
              <button onClick={onLiveMode} style={secondaryBtn({fontSize:12})}>Start Live Mode</button>
            </div>
          </div>
        </div>

        {/* ── 6. TRAINING PROGRESS ── */}
        <div style={{...glass({marginBottom:20})}}>
          <TopLine color="rgba(34,211,238,0.4)"/>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:800,color:C.white,marginBottom:2}}>Dashboard is {progressPct}% trained</div>
              <div style={{fontSize:11,color:C.muted}}>CamCash gets smarter as your history grows.</div>
            </div>
            <div style={{fontSize:16,fontWeight:900,color:C.cyan}}>{progressPct}%</div>
          </div>
          <div style={{height:6,borderRadius:100,background:'rgba(255,255,255,0.06)',overflow:'hidden',marginBottom:18}}>
            <div style={{height:'100%',width:`${progressPct}%`,background:C.grad,borderRadius:100,transition:'width 0.6s ease'}}/>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {unlockRows.map(row=>(
              <div key={row.label} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:12,background:row.done?'rgba(16,185,129,0.06)':'rgba(255,255,255,0.03)',border:`1px solid ${row.done?'rgba(16,185,129,0.2)':'rgba(255,255,255,0.06)'}`}}>
                <div style={{width:20,height:20,borderRadius:'50%',flexShrink:0,background:row.done?'rgba(16,185,129,0.2)':'rgba(255,255,255,0.05)',border:`1px solid ${row.done?'rgba(16,185,129,0.4)':'rgba(255,255,255,0.1)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,color:row.done?C.green:C.muted}}>
                  {row.done?'✓':''}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:row.done?C.white:C.text}}>{row.label}</div>
                  <div style={{fontSize:10,color:C.muted}}>{row.req}</div>
                </div>
                <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:100,background:row.done?'rgba(16,185,129,0.15)':'rgba(255,255,255,0.05)',border:`1px solid ${row.done?'rgba(16,185,129,0.3)':'rgba(255,255,255,0.08)'}`,color:row.done?C.green:C.muted,whiteSpace:'nowrap'}}>
                  {row.done?'✓ Active':row.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 7. PLATFORM TRACKING ── */}
        <SectionLabel>Choose your first tracked platform</SectionLabel>
        <div style={{...glass({marginBottom:20,padding:'18px 22px'})}}>
          <TopLine color="rgba(124,92,255,0.4)"/>
          {primaryPlatform?(
            <>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                <span style={pill(C.cyan)}>✓ {primaryPlatform} active</span>
                {!isPro&&<span style={{fontSize:11,color:C.muted}}>Free plan — 1 platform included</span>}
              </div>
              {!isPro&&(
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8}}>
                  {ALL_PLATFORMS.filter(p=>p!==primaryPlatform).map(p=>(
                    <button key={p} onClick={onUpgrade} style={{padding:'9px 12px',borderRadius:12,border:'1px solid rgba(236,72,153,0.18)',background:'rgba(236,72,153,0.04)',color:C.muted,fontSize:11,fontWeight:600,cursor:'pointer',textAlign:'left'}}>
                      {p}<br/><span style={{color:C.pink,fontSize:10}}>Requires Pro</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ):(
            <>
              <div style={{fontSize:12,color:C.text,marginBottom:14}}>Your imported data is saved. Pick the platform you want CamCash to focus on first.</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8}}>
                {ALL_PLATFORMS.map(p=>(
                  <button key={p} onClick={onAddHistory} style={{padding:'10px 14px',borderRadius:12,border:`1px solid rgba(34,211,238,0.22)`,background:'rgba(34,211,238,0.05)',color:C.white,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                    {p}<br/><span style={{color:C.cyan,fontSize:10,fontWeight:600}}>Free</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── 8. COMING ALIVE ── */}
        <SectionLabel>Coming alive as you add more data</SectionLabel>
        <div style={{fontSize:11,color:C.muted,marginBottom:12}}>CamCash gets smarter as your history grows.</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:10,marginBottom:20}}>
          <LockedInsightCard title="Best Streaming Times" description="See which hours earn you more so you stop guessing when to go live." lockType="needs_data" requirement="Unlocks after 3+ sessions with timestamps." ctaLabel="Import More Data" ctaAction={onAddHistory}/>
          <LockedInsightCard title="Live Mode Score" description="Review how your stream performed compared to your baseline." lockType="needs_data" requirement="Unlocks after your first Live Mode stream." ctaLabel="Start Live Mode" ctaAction={onLiveMode}/>
          <LockedInsightCard title="Platform Comparison" description="Which cam site pays you best by hour, day, and fan type." lockType={isPro?'needs_data':'requires_pro'} requirement={isPro?'Import at least 2 platforms to compare earnings.':'Upgrade to Pro to compare earnings across platforms.'} ctaLabel={isPro?'Add Platform':'Upgrade to Pro'} ctaAction={isPro?onAddHistory:onUpgrade}/>
          <LockedInsightCard title="Cross-Platform Best Times" description="Your best earning windows across all platforms combined." lockType={isPro?'needs_data':'requires_pro'} requirement={isPro?'Import sessions from at least 2 platforms.':'Upgrade to Pro to see which platform performs best by day and hour.'} ctaLabel={isPro?'Import More Data':'Upgrade to Pro'} ctaAction={isPro?onAddHistory:onUpgrade}/>
        </div>

        {/* ── 9. QUICK TOOLS ── */}
        <SectionLabel>Use CamCash while your dashboard learns</SectionLabel>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10,marginBottom:20}}>
          {[
            {icon:'🎬',title:'Room Title Generator',desc:'Create clickable stream titles in one click.',cta:'Open Tool',action:()=>router.push('/guides/chaturbate-room-title-generator')},
            {icon:'🪙',title:'Token Calculator',desc:'Convert tokens to estimated USD instantly.',cta:'Open Tool',action:()=>router.push('/dashboard?tab=token-calc')},
            {icon:'🔴',title:'Live Mode',desc:'Track tips and get coaching while you stream.',cta:'Start Live Mode',action:onLiveMode},
            {icon:'🗓️',title:'Stream Planner',desc:'Plan your schedule around your best earning windows.',cta:'Open Planner',action:()=>router.push('/dashboard?tab=stream-planner')},
          ].map(t=>(
            <div key={t.title} style={{...glass({padding:'16px 18px'})}}>
              <div style={{fontSize:20,marginBottom:8}}>{t.icon}</div>
              <div style={{fontSize:12,fontWeight:700,color:C.white,marginBottom:4}}>{t.title}</div>
              <div style={{fontSize:11,color:C.text,lineHeight:1.55,marginBottom:12}}>{t.desc}</div>
              <button onClick={t.action} style={secondaryBtn({fontSize:11,padding:'7px 14px',borderRadius:100})}>{t.cta}</button>
            </div>
          ))}
        </div>

        {/* ── 10. RECENT ACTIVITY ── */}
        <SectionLabel>Recent activity</SectionLabel>
        <div style={glass()}>
          <TopLine color="rgba(34,211,238,0.35)"/>
          {recentTips.length>0?(
            recentTips.map((t,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:i<recentTips.length-1?'1px solid rgba(255,255,255,0.04)':'none'}}>
                <div style={{width:5,height:5,borderRadius:'50%',background:C.cyan,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.white}}>{t.username||'anonymous'}</div>
                  <div style={{fontSize:10,color:C.muted}}>{fmtDateTime(t.date_time||t.dateRaw)} · {t.platform&&t.platform!=='Unknown'?t.platform:'Platform not selected yet'}</div>
                </div>
                <div style={{fontSize:12,fontWeight:700,color:C.gold}}>{safeNum(t.usd)>0?fmt$(t.usd):t.tokens?`${t.tokens} tkn`:'—'}</div>
              </div>
            ))
          ):(
            <div style={{fontSize:12,color:C.muted,textAlign:'center',padding:'20px 0'}}>No activity yet. Your imports, Live Mode sessions, and tracked tips will appear here.</div>
          )}
        </div>

      </div>
    </div>
  )
}

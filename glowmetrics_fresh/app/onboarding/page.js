'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const PLATFORMS = [
  {
    id: 'chaturbate', label: 'Chaturbate',
    steps: [
      'Open your Chaturbate broadcaster account.',
      'Go to your Token Stats page.',
      'Copy your token stats into a new Google Sheet.',
      'In Google Sheets, choose File → Download → Comma Separated Values (.csv).',
      'Upload that CSV file below.',
    ],
  },
  {
    id: 'bongacams', label: 'BongaCams',
    steps: [
      'Open your BongaCams broadcaster account.',
      'Go to your Token Stats page.',
      'Copy your token stats into a new Google Sheet.',
      'In Google Sheets, choose File → Download → Comma Separated Values (.csv).',
      'Upload that CSV file below.',
    ],
  },
  {
    id: 'myfreecams', label: 'MyFreeCams',
    steps: [
      'Open your MyFreeCams broadcaster account.',
      'Go to your Token Stats page.',
      'Copy your token stats into a new Google Sheet.',
      'In Google Sheets, choose File → Download → Comma Separated Values (.csv).',
      'Upload that CSV file below.',
    ],
  },
]

const DEMO_TIPPERS = ['xo_bella','darkwolf99','tip_king','vip_lover','night_owl','rose_fan','bigspender','goldenfan']
const DEMO_AMOUNTS = [5,10,15,25,50,100,25,75,200]

function randomTip() {
  return {
    id: Math.random().toString(36).slice(2),
    user: DEMO_TIPPERS[Math.floor(Math.random() * DEMO_TIPPERS.length)],
    tokens: DEMO_AMOUNTS[Math.floor(Math.random() * DEMO_AMOUNTS.length)],
    time: new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' }),
  }
}

function MiniDashPreview() {
  const [tips, setTips] = useState([
    { id:'1', user:'darkwolf99', tokens:200, time:'9:41 PM' },
    { id:'2', user:'tip_king',   tokens:100, time:'9:43 PM' },
    { id:'3', user:'xo_bella',   tokens:50,  time:'9:44 PM' },
  ])
  const [newTip, setNewTip] = useState(null)

  useEffect(() => {
    let t
    function go() {
      t = setTimeout(() => {
        const tip = randomTip()
        setNewTip(tip.id)
        setTips(p => [tip,...p].slice(0,3))
        setTimeout(() => setNewTip(null), 700)
        go()
      }, 2800 + Math.random()*2200)
    }
    go()
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, overflow:'hidden' }}>
      <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ width:6, height:6, borderRadius:'50%', background:'#ff1493', display:'inline-block', animation:'pulse 1.6s ease-in-out infinite' }} />
        <span style={{ fontSize:10, fontWeight:700, color:'#ff1493', letterSpacing:'0.08em', textTransform:'uppercase' }}>Live Tips</span>
        <span style={{ marginLeft:'auto', fontSize:10, color:'rgba(255,255,255,0.2)' }}>Demo</span>
      </div>
      {tips.map(tip => (
        <div key={tip.id} style={{
          display:'flex', alignItems:'center', gap:8, padding:'8px 14px',
          borderBottom:'1px solid rgba(255,255,255,0.04)',
          background: newTip===tip.id ? 'rgba(0,157,255,0.07)' : 'transparent',
          transition:'background 0.4s',
        }}>
          <span style={{ fontSize:11, fontWeight:800, minWidth:44, fontVariantNumeric:'tabular-nums',
            color: tip.tokens>=100 ? '#009DFF' : tip.tokens>=25 ? '#FF1493' : 'rgba(255,255,255,0.25)' }}>
            {tip.tokens}tk
          </span>
          <span style={{ color:'rgba(255,255,255,0.7)', fontWeight:600, fontSize:11, flex:1 }}>{tip.user}</span>
          <span style={{ color:'rgba(255,255,255,0.18)', fontSize:10 }}>{tip.time}</span>
        </div>
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(255,20,147,0.4)}50%{opacity:0.6;box-shadow:0 0 0 4px rgba(255,20,147,0)}}`}</style>
    </div>
  )
}

function LiveModeDemo() {
  const [tips, setTips] = useState([
    { id:'1', user:'xo_bella',   tokens:50,  time:'9:41 PM' },
    { id:'2', user:'darkwolf99', tokens:25,  time:'9:42 PM' },
    { id:'3', user:'tip_king',   tokens:100, time:'9:43 PM' },
    { id:'4', user:'vip_lover',  tokens:5,   time:'9:43 PM' },
  ])
  const [totalTokens, setTotalTokens] = useState(180)
  const [totalUsd, setTotalUsd]       = useState(9.00)
  const [elapsed, setElapsed]         = useState(312)
  const [newTip, setNewTip]           = useState(null)

  useEffect(() => {
    const c = setInterval(() => setElapsed(e => e+1), 1000)
    return () => clearInterval(c)
  }, [])

  useEffect(() => {
    let t
    function go() {
      t = setTimeout(() => {
        const tip = randomTip()
        setNewTip(tip.id)
        setTips(p => [tip,...p].slice(0,10))
        setTotalTokens(n => n+tip.tokens)
        setTotalUsd(n => Math.round((n+tip.tokens*0.05)*100)/100)
        setTimeout(() => setNewTip(null), 600)
        go()
      }, 2000 + Math.random()*3000)
    }
    go()
    return () => clearTimeout(t)
  }, [])

  const mm  = Math.floor(elapsed/60).toString().padStart(2,'0')
  const ss  = (elapsed%60).toString().padStart(2,'0')
  const dph = elapsed > 0 ? ((totalUsd/elapsed)*3600).toFixed(2) : '0.00'

  return (
    <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, overflow:'hidden', marginBottom:16 }}>
      <div style={{ background:'rgba(0,157,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.05)', padding:'8px 14px', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ width:7, height:7, borderRadius:'50%', background:'#FF1493', display:'inline-block', animation:'lmpulse 1.4s ease-in-out infinite' }} />
        <span style={{ fontSize:11, fontWeight:700, color:'#FF1493', letterSpacing:'0.08em', textTransform:'uppercase' }}>Live Mode Demo</span>
        <span style={{ marginLeft:'auto', fontSize:11, color:'rgba(255,255,255,0.15)' }}>Simulated stream</span>
      </div>
      <div style={{ display:'flex', minHeight:220 }}>
        <div style={{ width:140, borderRight:'1px solid rgba(255,255,255,0.05)', padding:'14px 12px', display:'flex', flexDirection:'column', gap:16 }}>
          {[
            { label:'Session',   value:`${mm}:${ss}`,                color:'rgba(255,255,255,0.4)' },
            { label:'Tokens',    value:totalTokens.toLocaleString(), color:'#FF1493' },
            { label:'Earned',    value:`$${totalUsd.toFixed(2)}`,    color:'#009DFF' },
            { label:'$/hr pace', value:`$${dph}`,                    color:'#009DFF', sm:true },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.2)', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:3 }}>{s.label}</div>
              <div style={{ fontSize:s.sm?15:19, fontWeight:800, color:s.color, fontVariantNumeric:'tabular-nums' }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ flex:1, overflowY:'auto', maxHeight:220 }}>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.2)', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', padding:'12px 14px 6px' }}>Live Tips</div>
          {tips.map(tip => (
            <div key={tip.id} style={{
              display:'flex', alignItems:'center', gap:10, padding:'7px 14px',
              borderBottom:'1px solid rgba(255,255,255,0.03)',
              background: newTip===tip.id ? 'rgba(0,157,255,0.07)' : 'transparent',
              transition:'background 0.3s',
            }}>
              <span style={{ fontSize:11, fontWeight:800, minWidth:42, fontVariantNumeric:'tabular-nums',
                color: tip.tokens>=100 ? '#009DFF' : tip.tokens>=25 ? '#FF1493' : 'rgba(255,255,255,0.2)' }}>
                {tip.tokens}tk
              </span>
              <span style={{ color:'rgba(255,255,255,0.65)', fontWeight:600, fontSize:12, flex:1 }}>{tip.user}</span>
              <span style={{ color:'rgba(255,255,255,0.18)', fontSize:11 }}>{tip.time}</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes lmpulse{0%,100%{opacity:1}50%{opacity:0.15}}`}</style>
    </div>
  )
}

export default function OnboardingPage() {
  const router   = useRouter()
  const supabase = createClientComponentClient()
  const dropRef  = useRef(null)

  const [step,        setStep]        = useState(1)
  const [selPlatform, setSelPlatform] = useState('chaturbate')
  const [csvFile,     setCsvFile]     = useState(null)
  const [dragging,    setDragging]    = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadDone,  setUploadDone]  = useState(false)
  const [showSkip,    setShowSkip]    = useState(false)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    const { data:{ subscription } } = supabase.auth.onAuthStateChange(() => setLoading(false))
    supabase.auth.getSession().then(() => setLoading(false))
    return () => subscription.unsubscribe()
  }, [])

  const platform = PLATFORMS.find(p => p.id === selPlatform)

  function handleDrop(e) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith('.csv')) { setCsvFile(f); setUploadError(null) }
  }

  async function handleUpload() {
    if (!csvFile) return
    setUploading(true); setUploadError(null)
    try {
      const { data:{ session } } = await supabase.auth.getSession()
      const fd = new FormData()
      fd.append('file', csvFile)
      fd.append('platform', selPlatform)
      const res = await fetch('/api/upload-csv', {
        method:'POST',
        headers: session?.access_token ? { Authorization:`Bearer ${session.access_token}` } : {},
        body: fd,
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error||'Upload failed') }
      setUploadDone(true)
      setTimeout(() => setStep(2), 1400)
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  function handleFinish() {
    setStep(5)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  const PROGRESS = ['Import History','Review Insights','Start Tracking Live']

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#030712', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, borderRadius:'50%', border:'2px solid rgba(0,157,255,0.12)', borderTopColor:'#009DFF', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#030712}

        .ob-root{
          min-height:100vh;
          background:
            radial-gradient(circle at 18% 8%, rgba(0,168,255,0.18) 0%, transparent 28%),
            radial-gradient(circle at 85% 15%, rgba(255,0,170,0.16) 0%, transparent 30%),
            radial-gradient(circle at 70% 90%, rgba(109,53,255,0.12) 0%, transparent 35%),
            linear-gradient(135deg, #030712 0%, #050816 45%, #080012 100%);
          display:flex;flex-direction:column;align-items:center;
          padding:36px 20px 80px;
          font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
          position:relative;overflow-x:hidden;
        }

        .ob-glow-lines{
          pointer-events:none;position:fixed;bottom:0;right:0;width:420px;height:340px;
          background:
            radial-gradient(ellipse 80% 60% at 100% 100%, rgba(0,157,255,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 90%, rgba(109,53,255,0.07) 0%, transparent 50%);
          z-index:0;
        }

        .ob-wrap{position:relative;z-index:1;width:100%;max-width:1060px;}

        /* progress */
        .ob-progress{display:flex;align-items:center;justify-content:center;gap:0;margin-bottom:36px}
        .ob-prog-step{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.22);padding:0 14px}
        .ob-prog-step.active{color:#009DFF}
        .ob-prog-step.done{color:rgba(255,255,255,0.45)}
        .ob-prog-dot{width:20px;height:20px;border-radius:50%;border:1.5px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0}
        .ob-prog-step.active .ob-prog-dot{background:#009DFF;border-color:#009DFF;color:#fff;box-shadow:0 0 12px rgba(0,157,255,0.5)}
        .ob-prog-step.done .ob-prog-dot{background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.2);color:rgba(255,255,255,0.6)}
        .ob-prog-line{width:40px;height:1px;background:rgba(255,255,255,0.08)}

        /* two-col layout */
        .ob-layout{display:grid;grid-template-columns:1fr 340px;gap:20px;width:100%}
        @media(max-width:860px){.ob-layout{grid-template-columns:1fr}}

        /* main card */
        .ob-card{
          background:rgba(255,255,255,0.035);
          border:1px solid rgba(255,255,255,0.09);
          border-radius:20px;padding:36px 36px 32px;
          backdrop-filter:blur(12px);
          box-shadow:0 0 0 1px rgba(0,157,255,0.04), 0 24px 64px rgba(0,0,0,0.5);
        }

        .ob-eyebrow{font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
          background:linear-gradient(90deg,#009DFF,#FF1493);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
          margin-bottom:10px}
        .ob-heading{font-size:26px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:8px}
        .ob-sub-main{font-size:14px;color:rgba(255,255,255,0.45);line-height:1.65;margin-bottom:6px}
        .ob-sub-minor{font-size:13px;color:rgba(255,255,255,0.3);line-height:1.6;margin-bottom:22px}

        /* platform tabs */
        .ob-pf-tabs{display:flex;gap:8px;margin-bottom:20px}
        .ob-pf-tab{
          flex:1;padding:10px 8px;border-radius:10px;
          border:1px solid rgba(255,255,255,0.10);
          background:rgba(255,255,255,0.035);
          color:rgba(255,255,255,0.45);font-size:13px;font-weight:600;
          cursor:pointer;transition:all 0.18s;text-align:center;font-family:inherit;
        }
        .ob-pf-tab:hover{
          border-color:rgba(0,157,255,0.45);color:rgba(255,255,255,0.8);
          background:rgba(0,157,255,0.06);
          box-shadow:0 0 12px rgba(0,157,255,0.15);
        }
        .ob-pf-tab.active{
          background:linear-gradient(90deg,rgba(0,157,255,0.22),rgba(255,20,147,0.22));
          border:1px solid rgba(255,255,255,0.55);
          box-shadow:0 0 20px rgba(255,20,147,0.2), inset 0 1px 0 rgba(255,255,255,0.12);
          color:#fff;
        }

        /* step list */
        .ob-steps-list{list-style:none;margin-bottom:20px;
          background:rgba(255,255,255,0.025);
          border:1px solid rgba(255,255,255,0.07);
          border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:11px}
        .ob-steps-list li{display:flex;gap:10px;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.55;align-items:flex-start}
        .ob-step-num{flex-shrink:0;width:21px;height:21px;border-radius:50%;
          background:linear-gradient(135deg,rgba(0,157,255,0.22),rgba(255,20,147,0.18));
          border:1px solid rgba(255,255,255,0.12);
          color:#fff;font-size:10px;font-weight:700;
          display:flex;align-items:center;justify-content:center;margin-top:1px}

        /* notes */
        .ob-note{display:flex;align-items:flex-start;gap:10px;
          background:rgba(255,255,255,0.025);
          border:1px solid rgba(255,255,255,0.07);
          border-radius:10px;padding:11px 14px;margin-bottom:10px;
          font-size:12.5px;color:rgba(255,255,255,0.38);line-height:1.55}
        .ob-note strong{color:rgba(255,255,255,0.7);font-weight:600}

        /* upload zone */
        .ob-drop{
          border:1.5px dashed rgba(255,255,255,0.18);
          background:rgba(255,255,255,0.025);
          border-radius:18px;padding:32px 24px;text-align:center;cursor:pointer;
          transition:all 0.2s;margin-bottom:14px;position:relative;
          box-shadow:inset 0 0 30px rgba(0,157,255,0.04);
        }
        .ob-drop:hover,.ob-drop.drag{
          border-color:rgba(0,157,255,0.55);
          background:rgba(0,157,255,0.05);
          box-shadow:inset 0 0 30px rgba(0,157,255,0.08),0 0 0 1px rgba(0,157,255,0.15);
        }
        .ob-drop.has-file{
          border-color:rgba(255,20,147,0.55);
          background:rgba(255,20,147,0.04);
          box-shadow:inset 0 0 30px rgba(255,20,147,0.06);
        }
        .ob-drop input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}

        /* primary button */
        .ob-btn-primary{
          width:100%;padding:15px;
          background:linear-gradient(90deg,#009DFF 0%,#6D35FF 45%,#FF1493 100%);
          border:none;border-radius:12px;
          color:#fff;font-size:15px;font-weight:700;
          cursor:pointer;font-family:inherit;letter-spacing:0.01em;
          box-shadow:0 0 18px rgba(0,157,255,0.4),0 0 28px rgba(255,20,147,0.3);
          margin-bottom:10px;transition:all 0.18s;
        }
        .ob-btn-primary:hover:not(:disabled){
          transform:translateY(-2px);
          box-shadow:0 0 24px rgba(0,157,255,0.65),0 0 38px rgba(255,20,147,0.5);
        }
        .ob-btn-primary:disabled{
          background:rgba(255,255,255,0.06);
          box-shadow:none;color:rgba(255,255,255,0.25);
          cursor:not-allowed;transform:none;
        }

        .ob-btn-ghost{
          width:100%;padding:12px;background:transparent;
          border:1px solid rgba(255,255,255,0.09);border-radius:12px;
          color:rgba(255,255,255,0.3);font-size:13px;font-weight:500;
          cursor:pointer;font-family:inherit;transition:all 0.15s;
        }
        .ob-btn-ghost:hover{border-color:rgba(255,255,255,0.18);color:rgba(255,255,255,0.55)}

        .ob-divider{height:1px;background:rgba(255,255,255,0.06);margin:18px 0}
        .ob-error{font-size:13px;color:#f87171;margin:8px 0;text-align:center}
        .ob-success-msg{font-size:13px;font-weight:700;margin:8px 0;text-align:center;
          background:linear-gradient(90deg,#009DFF,#FF1493);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}

        /* right sidebar card */
        .ob-side-card{
          background:rgba(255,255,255,0.03);
          border:1px solid rgba(255,255,255,0.07);
          border-radius:20px;padding:24px 22px;
          backdrop-filter:blur(10px);
          height:fit-content;
          position:sticky;top:30px;
        }
        .ob-side-title{font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
          color:rgba(255,255,255,0.3);margin-bottom:14px}
        .ob-benefit{display:flex;align-items:center;gap:10px;
          padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.05);
          font-size:13px;color:rgba(255,255,255,0.55);}
        .ob-benefit:last-child{border-bottom:none}
        .ob-benefit-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;
          background:linear-gradient(135deg,#009DFF,#FF1493)}

        /* link card */
        .ob-link-card{display:flex;align-items:center;gap:12px;
          background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
          border-radius:12px;padding:13px 16px;text-decoration:none;
          color:rgba(255,255,255,0.7);font-size:13px;font-weight:600;
          margin-bottom:10px;transition:all 0.15s}
        .ob-link-card:hover{border-color:rgba(0,157,255,0.3);background:rgba(0,157,255,0.04)}
        .ob-link-card-sub{font-size:12px;color:rgba(255,255,255,0.25);font-weight:400;margin-top:2px}

        /* warning box */
        .ob-warning-box{display:flex;gap:12px;align-items:flex-start;
          background:rgba(0,157,255,0.05);border:1px solid rgba(0,157,255,0.15);
          border-radius:14px;padding:16px;margin-bottom:24px}
        .ob-warning-text{font-size:13px;color:rgba(255,255,255,0.45);line-height:1.7}
        .ob-warning-text strong{color:#009DFF;font-weight:600}

        .ob-ext-box{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
          border-radius:12px;padding:16px;margin-bottom:18px;
          font-size:13px;color:rgba(255,255,255,0.4);line-height:1.65;text-align:center}
        .ob-done{text-align:center;padding:48px 0}

        /* modal */
        .ob-modal-backdrop{position:fixed;inset:0;background:rgba(2,3,8,0.94);
          backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;
          z-index:100;padding:16px}
        .ob-modal{background:#0d0a1a;
          border:1px solid rgba(255,20,147,0.2);
          border-radius:20px;padding:36px 28px;max-width:400px;width:100%;text-align:center;
          box-shadow:0 0 60px rgba(255,20,147,0.15),0 24px 64px rgba(0,0,0,0.7)}

        @media(max-width:600px){
          .ob-card{padding:24px 20px!important}
          .ob-heading{font-size:21px!important}
          .ob-pf-tabs{flex-direction:column!important}
          .ob-progress{gap:0}
          .ob-prog-step{padding:0 8px;font-size:10px}
        }
      `}</style>

      <div className="ob-root">
        <div className="ob-glow-lines" />

        <div className="ob-wrap">
          {/* Progress indicator */}
          <div className="ob-progress">
            {PROGRESS.map((label, i) => (
              <>
                <div key={label} className={`ob-prog-step ${step===i+1?'active':''} ${step>i+1?'done':''}`}>
                  <div className="ob-prog-dot">{step>i+1?'✓':i+1}</div>
                  {label}
                </div>
                {i < PROGRESS.length-1 && <div className="ob-prog-line" key={`l${i}`} />}
              </>
            ))}
          </div>

          {/* STEP 1 */}
          {step===1 && (
            <div className="ob-layout">
              {/* Left: main onboarding */}
              <div className="ob-card">
                <div className="ob-eyebrow">Step 1 · Import your tip history</div>
                <div className="ob-heading">Unlock your CamCash dashboard</div>
                <div className="ob-sub-main">
                  Import your past tip history so CamCash can find your best hours, top fans, whale tippers, and earnings patterns.
                </div>
                <div className="ob-sub-minor">
                  Choose your platform, follow the quick steps, and upload your CSV when you're ready.
                </div>

                <div className="ob-pf-tabs">
                  {PLATFORMS.map(p => (
                    <button key={p.id} className={`ob-pf-tab ${selPlatform===p.id?'active':''}`}
                      onClick={() => { setSelPlatform(p.id); setCsvFile(null); setUploadError(null); setUploadDone(false) }}>
                      {p.label}
                    </button>
                  ))}
                </div>

                <ul className="ob-steps-list">
                  {platform.steps.map((s,i) => (
                    <li key={i}><span className="ob-step-num">{i+1}</span><span>{s}</span></li>
                  ))}
                </ul>

                {!uploadDone ? <>
                  <div
                    ref={dropRef}
                    className={`ob-drop ${csvFile?'has-file':''} ${dragging?'drag':''}`}
                    onDragOver={e=>{e.preventDefault();setDragging(true)}}
                    onDragLeave={()=>setDragging(false)}
                    onDrop={handleDrop}
                  >
                    <input type="file" accept=".csv" onChange={e => { setCsvFile(e.target.files[0]||null); setUploadError(null) }} />
                    <div style={{ fontSize:32, marginBottom:8 }}>{csvFile?'✅':'📂'}</div>
                    <div style={{ fontSize:15, fontWeight:700, color:'rgba(255,255,255,0.75)', marginBottom:4 }}>
                      {csvFile ? csvFile.name : 'Drop your CSV here'}
                    </div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.28)' }}>
                      {csvFile ? 'Ready to upload' : 'or click to browse your files'}
                    </div>
                  </div>
                  {uploadError && <div className="ob-error">{uploadError}</div>}

                  <button className="ob-btn-primary" onClick={handleUpload} disabled={!csvFile||uploading}>
                    {uploading ? 'Importing your tip history…' : 'Upload CSV & Unlock Dashboard →'}
                  </button>
                </> : (
                  <div className="ob-success-msg">✓ Your tip history is importing… taking you to the next step.</div>
                )}

                <div className="ob-note">
                  <span style={{ flexShrink:0 }}>✉️</span>
                  <span>We also sent these steps to your email, so you can come back anytime.</span>
                </div>

                <div className="ob-divider" />
                <div className="ob-note" style={{ marginBottom:12 }}>
                  <span style={{ flexShrink:0 }}>💡</span>
                  <span>You can skip this for now and import later from your dashboard under <strong>Import</strong>.</span>
                </div>
                <button className="ob-btn-ghost" onClick={() => setShowSkip(true)}>Skip for now</button>
              </div>

              {/* Right: benefits + mini preview */}
              <div className="ob-side-card">
                <div className="ob-side-title">What CamCash unlocks after import</div>

                {[
                  'Your best hours to stream',
                  'Your highest-value fans',
                  'Which platform earns the most',
                  'Sessions that made the most money',
                  'Fans worth re-engaging',
                ].map(b => (
                  <div key={b} className="ob-benefit">
                    <span className="ob-benefit-dot" />
                    {b}
                  </div>
                ))}

                <div style={{ height:16 }} />
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.18)', marginBottom:10 }}>
                  Live tip preview
                </div>
                <MiniDashPreview />

                <div style={{ marginTop:14, padding:'10px 12px', background:'linear-gradient(135deg,rgba(0,157,255,0.08),rgba(255,20,147,0.08))', borderRadius:10, border:'1px solid rgba(255,255,255,0.07)', fontSize:12, color:'rgba(255,255,255,0.4)', lineHeight:1.6, textAlign:'center' }}>
                  Import once. CamCash tracks everything going forward automatically.
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step===2 && (
            <div style={{ width:'100%', maxWidth:620, margin:'0 auto' }}>
              <div className="ob-card">
                <div className="ob-eyebrow">Step 2 · Live mode</div>
                <div className="ob-heading">Your dashboard during a stream</div>
                <div className="ob-sub-main" style={{ marginBottom:20 }}>Real-time tips, session earnings, and $/hr pace — all updating live as your stream runs.</div>
                <LiveModeDemo />
                <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
                  <span style={{ fontSize:20 }}>🔴</span>
                  <div><div>Open Live Mode</div><div className="ob-link-card-sub">camcashgrl.com/live — keep this open during streams</div></div>
                </a>
                <button className="ob-btn-primary" onClick={() => setStep(3)}>Next: Download Extension →</button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step===3 && (
            <div style={{ width:'100%', maxWidth:620, margin:'0 auto' }}>
              <div className="ob-card">
                <div className="ob-eyebrow">Step 3 · Browser extension</div>
                <div className="ob-heading">Auto-import tips every stream</div>
                <div className="ob-sub-main" style={{ marginBottom:20 }}>Install the CamCash extension and your tips sync automatically every time you go live — no CSV needed going forward.</div>

                <div className="ob-ext-box">
                  🧩 Once installed, just go live on Chaturbate, BongaCams, or MFC.<br />
                  Tips appear in your dashboard and live mode in real time.
                </div>

                <a href="https://chrome.google.com/webstore/detail/camcash" target="_blank" rel="noopener noreferrer"
                  className="ob-link-card" style={{ borderColor:'rgba(0,157,255,0.25)', background:'rgba(0,157,255,0.04)', marginBottom:18 }}>
                  <span style={{ fontSize:20 }}>⬇️</span>
                  <div>
                    <div style={{ color:'#009DFF' }}>Download CamCash Extension</div>
                    <div className="ob-link-card-sub">Chrome Web Store · Free</div>
                  </div>
                </a>

                <div style={{ fontSize:13, color:'rgba(255,255,255,0.3)', marginBottom:12, lineHeight:1.6 }}>Monitor your streams from anywhere:</div>
                <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
                  <span style={{ fontSize:20 }}>🔴</span>
                  <div><div>Live Mode</div><div className="ob-link-card-sub">Your private real-time stream view</div></div>
                </a>
                <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
                  <span style={{ fontSize:20 }}>🌐</span>
                  <div><div>Public Live Mode</div><div className="ob-link-card-sub">camcashgrl.com/live — shareable during streams</div></div>
                </a>

                <button className="ob-btn-primary" style={{ marginTop:8 }} onClick={() => setStep(4)}>Next: Enter Dashboard →</button>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step===4 && (
            <div style={{ width:'100%', maxWidth:620, margin:'0 auto' }}>
              <div className="ob-card">
                <div className="ob-eyebrow">Almost there</div>
                <div className="ob-heading">Before you go in — heads up</div>
                <div className="ob-sub-main" style={{ marginBottom:20 }}>Your dashboard is set up and ready. Just one thing to know:</div>

                <div className="ob-warning-box">
                  <span style={{ fontSize:18, flexShrink:0, marginTop:1 }}>ℹ️</span>
                  <div className="ob-warning-text">
                    <strong>Your dashboard will be empty until your first stream or CSV import.</strong>
                    <br /><br />
                    To see your historical earnings, top tippers, and trends right away — import a CSV.
                    Find the <strong>CSV Importer</strong> in the side navigation at any time.
                  </div>
                </div>

                <button className="ob-btn-primary" onClick={handleFinish}>Enter my dashboard →</button>
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {step===5 && (
            <div style={{ width:'100%', maxWidth:620, margin:'0 auto' }}>
              <div className="ob-card">
                <div className="ob-done">
                  <div style={{ fontSize:52, marginBottom:16 }}>✨</div>
                  <div style={{ fontSize:26, fontWeight:800, marginBottom:8,
                    background:'linear-gradient(90deg,#009DFF,#6D35FF,#FF1493)',
                    WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                    You're all set
                  </div>
                  <div style={{ fontSize:14, color:'rgba(255,255,255,0.3)' }}>Taking you to your dashboard…</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showSkip && (
        <div className="ob-modal-backdrop" onClick={() => setShowSkip(false)}>
          <div className="ob-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:36, marginBottom:14 }}>⚠️</div>
            <div style={{ fontSize:19, fontWeight:700, color:'#fff', marginBottom:10 }}>Skip importing your data?</div>
            <div style={{ fontSize:14, color:'rgba(255,255,255,0.4)', lineHeight:1.7, marginBottom:26 }}>
              Without a CSV, your earnings history, top fans, and best hours won't show up yet.
              <br /><br />
              You can always import from <strong style={{ color:'rgba(255,255,255,0.7)' }}>Import CSV</strong> in the sidebar whenever you're ready.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <button className="ob-btn-primary" onClick={() => setShowSkip(false)}>Go back and upload</button>
              <button className="ob-btn-ghost" onClick={() => { setShowSkip(false); setStep(2) }}>Skip for now — I understand</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

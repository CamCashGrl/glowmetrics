'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const PLATFORMS = [
  {
    id: 'chaturbate', label: 'Chaturbate',
    steps: [
      'Log in to your Chaturbate broadcaster account and go to your Token Stats page.',
      'Copy your token stats data.',
      'Paste it into a new Google Sheet.',
      'In Google Sheets: File → Download → Comma Separated Values (.csv).',
      'Upload that CSV file below.',
    ],
  },
  {
    id: 'bongacams', label: 'BongaCams',
    steps: [
      'Log in to your BongaCams broadcaster account and find your Token Stats page.',
      'Copy your token stats data.',
      'Paste it into a new Google Sheet.',
      'In Google Sheets: File → Download → Comma Separated Values (.csv).',
      'Upload that CSV file below.',
    ],
  },
  {
    id: 'myfreecams', label: 'MyFreeCams',
    steps: [
      'Log in to your MyFreeCams account and find your Token Stats page.',
      'Copy your token stats data.',
      'Paste it into a new Google Sheet.',
      'In Google Sheets: File → Download → Comma Separated Values (.csv).',
      'Upload that CSV file below.',
    ],
  },
]

const DEMO_TIPPERS = ['xo_bella','darkwolf99','tip_king','vip_lover','night_owl','rose_fan','bigspender','mystery_m','goldenfan','starlover']
const DEMO_AMOUNTS = [5,10,15,25,50,100,25,10,5,20,2,1,75,200]

function randomTip() {
  return {
    id: Math.random().toString(36).slice(2),
    user: DEMO_TIPPERS[Math.floor(Math.random() * DEMO_TIPPERS.length)],
    tokens: DEMO_AMOUNTS[Math.floor(Math.random() * DEMO_AMOUNTS.length)],
    time: new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' }),
  }
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
    <div style={{ background:'#0d0f1e', border:'1px solid rgba(0,229,204,0.15)', borderRadius:12, overflow:'hidden', marginBottom:16 }}>
      {/* top bar */}
      <div style={{ background:'rgba(0,229,204,0.05)', borderBottom:'1px solid rgba(0,229,204,0.1)', padding:'7px 14px', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ width:7, height:7, borderRadius:'50%', background:'#00e5cc', display:'inline-block', animation:'lmpulse 1.4s ease-in-out infinite' }} />
        <span style={{ fontSize:11, fontWeight:700, color:'#00e5cc', letterSpacing:'0.08em', textTransform:'uppercase' }}>Live Mode Demo</span>
        <span style={{ marginLeft:'auto', fontSize:11, color:'#2a3550' }}>Simulated stream</span>
      </div>

      <div style={{ display:'flex', minHeight:250 }}>
        {/* stats */}
        <div style={{ width:140, borderRight:'1px solid rgba(255,255,255,0.05)', padding:'14px 12px', display:'flex', flexDirection:'column', gap:16 }}>
          {[
            { label:'Session',   value:`${mm}:${ss}`,                color:'#94a3b8' },
            { label:'Tokens',    value:totalTokens.toLocaleString(), color:'#00e5cc' },
            { label:'Earned',    value:`$${totalUsd.toFixed(2)}`,    color:'#00e5cc' },
            { label:'$/hr pace', value:`$${dph}`,                    color:'#f59e0b', sm:true },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize:9, color:'#2a3550', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:3 }}>{s.label}</div>
              <div style={{ fontSize:s.sm?15:19, fontWeight:800, color:s.color, fontVariantNumeric:'tabular-nums' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* feed */}
        <div style={{ flex:1, overflowY:'auto', maxHeight:250 }}>
          <div style={{ fontSize:9, color:'#2a3550', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', padding:'12px 14px 6px' }}>Live Tips</div>
          {tips.map(tip => (
            <div key={tip.id} style={{
              display:'flex', alignItems:'center', gap:10, padding:'7px 14px',
              borderBottom:'1px solid rgba(255,255,255,0.03)',
              background: newTip===tip.id ? 'rgba(0,229,204,0.07)' : 'transparent',
              transition:'background 0.3s',
            }}>
              <span style={{ fontSize:11, fontWeight:800, minWidth:42, fontVariantNumeric:'tabular-nums',
                color: tip.tokens>=100 ? '#f59e0b' : tip.tokens>=25 ? '#00e5cc' : '#334155' }}>
                {tip.tokens}tk
              </span>
              <span style={{ color:'#cbd5e1', fontWeight:600, fontSize:12, flex:1 }}>{tip.user}</span>
              <span style={{ color:'#1e2d40', fontSize:11 }}>{tip.time}</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes lmpulse{0%,100%{opacity:1}50%{opacity:0.2}}`}</style>
    </div>
  )
}

export default function OnboardingPage() {
  const router   = useRouter()
  const supabase = createClientComponentClient()

  const [step,            setStep]            = useState(1)
  const [selPlatform,     setSelPlatform]     = useState('chaturbate')
  const [csvFile,         setCsvFile]         = useState(null)
  const [uploading,       setUploading]       = useState(false)
  const [uploadError,     setUploadError]     = useState(null)
  const [uploadDone,      setUploadDone]      = useState(false)
  const [showSkip,        setShowSkip]        = useState(false)
  const [loading,         setLoading]         = useState(true)

  useEffect(() => {
    const { data:{ subscription } } = supabase.auth.onAuthStateChange(() => setLoading(false))
    supabase.auth.getSession().then(() => setLoading(false))
    return () => subscription.unsubscribe()
  }, [])

  const platform = PLATFORMS.find(p => p.id === selPlatform)

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
      setTimeout(() => setStep(2), 1200)
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

  const progressSteps = [
    { label:'Import Data', active:step===1, done:step>1 },
    { label:'Live Mode',   active:step===2, done:step>2 },
    { label:'Extension',   active:step===3, done:step>3 },
    { label:'Dashboard',   active:step===4, done:step>=5 },
  ]

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0a0b14', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:30, height:30, borderRadius:'50%', border:'2px solid rgba(0,229,204,0.1)', borderTopColor:'#00e5cc', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#0a0b14}

        .ob-root{
          min-height:100vh;
          background:#0a0b14;
          background-image:
            radial-gradient(ellipse 60% 35% at 20% 0%,rgba(168,85,247,0.07) 0%,transparent 60%),
            radial-gradient(ellipse 50% 30% at 80% 100%,rgba(0,229,204,0.06) 0%,transparent 60%);
          display:flex;flex-direction:column;align-items:center;
          padding:40px 16px 80px;
          font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
        }

        .ob-progress{display:flex;align-items:center;margin-bottom:32px}
        .ob-step-pill{display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;color:#2a3550;transition:all 0.2s}
        .ob-step-pill.active{color:#00e5cc;background:rgba(0,229,204,0.08)}
        .ob-step-pill.done{color:#22c55e;background:rgba(34,197,94,0.08)}
        .ob-step-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0}
        .ob-step-line{width:24px;height:1px;background:rgba(255,255,255,0.06)}

        .ob-card{
          width:100%;max-width:580px;
          background:#13151f;
          border:1px solid rgba(255,255,255,0.07);
          border-radius:20px;padding:36px 40px;
          box-shadow:0 24px 64px rgba(0,0,0,0.6);
        }

        .ob-eyebrow{font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#00e5cc;margin-bottom:6px}
        .ob-heading{font-size:22px;font-weight:800;color:#f8fafc;line-height:1.25;margin-bottom:6px}
        .ob-sub{font-size:14px;color:#64748b;line-height:1.6;margin-bottom:24px}

        .ob-pf-tabs{display:flex;gap:8px;margin-bottom:20px}
        .ob-pf-tab{flex:1;padding:10px 8px;border-radius:10px;border:1px solid rgba(255,255,255,0.07);background:#0d0f1e;color:#334155;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s;text-align:center;font-family:inherit}
        .ob-pf-tab:hover{border-color:rgba(0,229,204,0.3);color:#94a3b8}
        .ob-pf-tab.active{border-color:#00e5cc;color:#00e5cc;background:rgba(0,229,204,0.06);box-shadow:0 0 0 1px #00e5cc}

        .ob-steps-list{list-style:none;margin-bottom:20px;background:#0d0f1e;border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:10px}
        .ob-steps-list li{display:flex;gap:10px;font-size:13px;color:#475569;line-height:1.55;align-items:flex-start}
        .ob-step-num{flex-shrink:0;width:20px;height:20px;border-radius:50%;background:rgba(0,229,204,0.1);color:#00e5cc;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px}

        .ob-email-note{display:flex;align-items:flex-start;gap:10px;background:rgba(0,229,204,0.04);border:1px solid rgba(0,229,204,0.1);border-radius:10px;padding:12px 14px;margin-bottom:20px;font-size:13px;color:#475569;line-height:1.5}

        .ob-upload-zone{border:1.5px dashed rgba(255,255,255,0.08);border-radius:12px;padding:24px 20px;text-align:center;cursor:pointer;transition:all 0.15s;margin-bottom:8px;position:relative}
        .ob-upload-zone:hover{border-color:#00e5cc;background:rgba(0,229,204,0.03)}
        .ob-upload-zone.has-file{border-color:#22c55e;background:rgba(34,197,94,0.04)}
        .ob-upload-zone input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}

        .ob-btn-primary{
          width:100%;padding:14px;
          background:#00e5cc;
          border:none;border-radius:12px;
          color:#0a0b14;font-size:15px;font-weight:800;
          cursor:pointer;font-family:inherit;letter-spacing:0.01em;
          box-shadow:0 4px 20px rgba(0,229,204,0.2);
          margin-bottom:10px;transition:all 0.15s;
        }
        .ob-btn-primary:hover:not(:disabled){background:#00ccb5;box-shadow:0 6px 24px rgba(0,229,204,0.3);transform:translateY(-1px)}
        .ob-btn-primary:disabled{opacity:0.3;cursor:not-allowed;transform:none;box-shadow:none}

        .ob-btn-ghost{width:100%;padding:12px;background:transparent;border:1px solid rgba(255,255,255,0.08);border-radius:12px;color:#334155;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s}
        .ob-btn-ghost:hover{border-color:rgba(0,229,204,0.25);color:#64748b}

        .ob-link-card{display:flex;align-items:center;gap:12px;background:#0d0f1e;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px 16px;text-decoration:none;color:#cbd5e1;font-size:13px;font-weight:600;margin-bottom:10px;transition:border-color 0.15s}
        .ob-link-card:hover{border-color:rgba(0,229,204,0.3)}
        .ob-link-card-sub{font-size:12px;color:#2a3550;font-weight:400;margin-top:2px}

        .ob-divider{height:1px;background:rgba(255,255,255,0.06);margin:20px 0}
        .ob-error{font-size:13px;color:#f87171;margin:10px 0;text-align:center}
        .ob-success{font-size:13px;color:#22c55e;margin:10px 0;text-align:center;font-weight:600}

        .ob-warning-box{display:flex;gap:12px;align-items:flex-start;background:rgba(0,229,204,0.04);border:1px solid rgba(0,229,204,0.12);border-radius:12px;padding:16px;margin-bottom:24px}
        .ob-warning-text{font-size:13px;color:#475569;line-height:1.7}
        .ob-warning-text strong{color:#00e5cc;font-weight:600}

        .ob-ext-box{background:#0d0f1e;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px;margin-bottom:20px;font-size:13px;color:#475569;line-height:1.6;text-align:center}
        .ob-done{text-align:center;padding:32px 0}

        .ob-modal-backdrop{position:fixed;inset:0;background:rgba(4,5,10,0.92);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px}
        .ob-modal{background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px 28px;max-width:380px;width:100%;text-align:center}

        @media(max-width:560px){.ob-card{padding:24px 20px!important}.ob-heading{font-size:19px!important}.ob-pf-tabs{flex-direction:column!important}}
      `}</style>

      <div className="ob-root">
        <div className="ob-progress">
          {progressSteps.map((s,i) => (
            <>
              <div key={s.label} className={`ob-step-pill ${s.active?'active':''} ${s.done?'done':''}`}>
                <span className="ob-step-dot" />{s.label}
              </div>
              {i < progressSteps.length-1 && <div className="ob-step-line" key={`l${i}`} />}
            </>
          ))}
        </div>

        <div className="ob-card">

          {/* STEP 1 */}
          {step===1 && <>
            <div className="ob-eyebrow">Step 1 · Import your history</div>
            <div className="ob-heading">Get your tip data into CamCash</div>
            <div className="ob-sub">Pick your platform, follow the steps to export your CSV, then upload it here. CamCash works with Chaturbate, BongaCams, and MyFreeCams.</div>

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

            <div className="ob-email-note">
              <span style={{ fontSize:16, flexShrink:0 }}>✉️</span>
              <span>An email has been sent to you with full instructions on how to import your historical data.</span>
            </div>

            <div className="ob-email-note" style={{ marginBottom:20 }}>
              <span style={{ fontSize:16, flexShrink:0 }}>💡</span>
              <span>You can always import your CSV later on our dashboard — it's under <strong style={{ color:'#00e5cc' }}>Import CSV</strong> in the side bar navigation.</span>
            </div>

            {!uploadDone ? <>
              <div className={`ob-upload-zone ${csvFile?'has-file':''}`}>
                <input type="file" accept=".csv" onChange={e => { setCsvFile(e.target.files[0]||null); setUploadError(null) }} />
                <div style={{ fontSize:26, marginBottom:6 }}>{csvFile?'✅':'📂'}</div>
                <div style={{ fontSize:14, fontWeight:600, color:'#cbd5e1', marginBottom:3 }}>
                  {csvFile?'File ready to upload':'Click to choose your CSV file'}
                </div>
                {csvFile
                  ? <div style={{ fontSize:13, color:'#22c55e', fontWeight:600, marginTop:4 }}>{csvFile.name}</div>
                  : <div style={{ fontSize:12, color:'#2a3550' }}>.csv files only</div>
                }
              </div>
              {uploadError && <div className="ob-error">{uploadError}</div>}
              <br />
              <button className="ob-btn-primary" onClick={handleUpload} disabled={!csvFile||uploading}>
                {uploading?'Uploading…':'Upload CSV →'}
              </button>
            </> : <div className="ob-success">✓ CSV uploaded! Moving to next step…</div>}

            <div className="ob-divider" />
            <button className="ob-btn-ghost" onClick={() => setShowSkip(true)}>Skip — I'll import later</button>
          </>}

          {/* STEP 2 */}
          {step===2 && <>
            <div className="ob-eyebrow">Step 2 · Live mode</div>
            <div className="ob-heading">Your dashboard during a stream</div>
            <div className="ob-sub">Real-time tips, session earnings, and $/hr pace — all updating live as your stream runs.</div>
            <LiveModeDemo />
            <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
              <span style={{ fontSize:20 }}>🔴</span>
              <div><div>Open Live Mode</div><div className="ob-link-card-sub">camcashgrl.com/live — keep this open during streams</div></div>
            </a>
            <button className="ob-btn-primary" onClick={() => setStep(3)}>Next: Download Extension →</button>
          </>}

          {/* STEP 3 */}
          {step===3 && <>
            <div className="ob-eyebrow">Step 3 · Browser extension</div>
            <div className="ob-heading">Auto-import tips every stream</div>
            <div className="ob-sub">Install the CamCash extension and your tips sync automatically every time you go live — no CSV needed going forward.</div>

            <div className="ob-ext-box">
              🧩 Once installed, just go live on Chaturbate, BongaCams, or MFC.<br />
              Tips appear in your dashboard and live mode in real time.
            </div>

            <a href="https://chrome.google.com/webstore/detail/camcash" target="_blank" rel="noopener noreferrer"
              className="ob-link-card" style={{ borderColor:'rgba(0,229,204,0.25)', background:'rgba(0,229,204,0.04)' }}>
              <span style={{ fontSize:20 }}>⬇️</span>
              <div>
                <div style={{ color:'#00e5cc' }}>Download CamCash Extension</div>
                <div className="ob-link-card-sub">Chrome Web Store · Free</div>
              </div>
            </a>

            <div className="ob-divider" />
            <div style={{ fontSize:13, color:'#475569', marginBottom:14, lineHeight:1.6 }}>Monitor your streams from anywhere:</div>

            <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
              <span style={{ fontSize:20 }}>🔴</span>
              <div><div>Live Mode</div><div className="ob-link-card-sub">Your private real-time stream view</div></div>
            </a>
            <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
              <span style={{ fontSize:20 }}>🌐</span>
              <div><div>Public Live Mode</div><div className="ob-link-card-sub">camcashgrl.com/live — shareable during streams</div></div>
            </a>

            <button className="ob-btn-primary" style={{ marginTop:8 }} onClick={() => setStep(4)}>Next: Enter Dashboard →</button>
          </>}

          {/* STEP 4 */}
          {step===4 && <>
            <div className="ob-eyebrow">Almost there</div>
            <div className="ob-heading">Before you go in — heads up</div>
            <div className="ob-sub">Your dashboard is set up and ready. Just one thing to know:</div>

            <div className="ob-warning-box">
              <span style={{ fontSize:18, flexShrink:0, marginTop:1 }}>ℹ️</span>
              <div className="ob-warning-text">
                <strong>Your dashboard will be empty until your first stream or CSV import.</strong>
                <br /><br />
                To see your historical earnings, top tippers, and trends right away — import a CSV.
                Find the <strong>CSV Importer</strong> in the side navigation at any time.
                You can import CSVs from any platform whenever you're ready.
              </div>
            </div>

            <button className="ob-btn-primary" onClick={handleFinish}>Enter my dashboard →</button>
          </>}

          {/* STEP 5 */}
          {step===5 && (
            <div className="ob-done">
              <div style={{ fontSize:48, marginBottom:16, color:'#00e5cc' }}>✓</div>
              <div style={{ fontSize:22, fontWeight:700, color:'#f8fafc', marginBottom:8 }}>You're all set</div>
              <div style={{ fontSize:14, color:'#475569' }}>Taking you to your dashboard…</div>
            </div>
          )}

        </div>
      </div>

      {showSkip && (
        <div className="ob-modal-backdrop" onClick={() => setShowSkip(false)}>
          <div className="ob-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:32, marginBottom:14 }}>⚠️</div>
            <div style={{ fontSize:18, fontWeight:700, color:'#f8fafc', marginBottom:8 }}>Skip importing your data?</div>
            <div style={{ fontSize:14, color:'#475569', lineHeight:1.6, marginBottom:24 }}>
              Without a CSV we can't import your historical tips. Your earnings history, top tippers,
              and trends won't show until you upload one.
              <br /><br />
              You can always import a CSV later from the side nav.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <button className="ob-btn-primary" onClick={() => setShowSkip(false)}>Go back and upload</button>
              <button className="ob-btn-ghost" onClick={() => { setShowSkip(false); setStep(2) }}>Skip anyway — I understand</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

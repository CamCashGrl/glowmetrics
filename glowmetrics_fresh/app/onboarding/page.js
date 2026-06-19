'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const IMPORT_STEPS = [
  'Open your broadcaster account and go to your Token Stats page.',
  'Copy your token stats data.',
  'Paste it into a new Google Sheet.',
  'In Google Sheets, choose File → Download → Comma Separated Values (.csv).',
  'Upload that CSV file below.',
]

const DEMO_TIPPERS = ['darkwolf99','tip_king','xo_bella','vip_lover','rose_fan','goldenfan']
const DEMO_AMOUNTS = [5,10,25,50,100,200,75]

function randomTip() {
  return {
    id: Math.random().toString(36).slice(2),
    user: DEMO_TIPPERS[Math.floor(Math.random() * DEMO_TIPPERS.length)],
    tokens: DEMO_AMOUNTS[Math.floor(Math.random() * DEMO_AMOUNTS.length)],
  }
}

function LiveModeDemo() {
  const [tips, setTips] = useState([
    { id:'1', user:'xo_bella',   tokens:50  },
    { id:'2', user:'darkwolf99', tokens:25  },
    { id:'3', user:'tip_king',   tokens:100 },
    { id:'4', user:'vip_lover',  tokens:5   },
  ])
  const [totalTokens, setTotalTokens] = useState(180)
  const [totalUsd, setTotalUsd]       = useState(9.00)
  const [elapsed, setElapsed]         = useState(312)
  const [newTip, setNewTip]           = useState(null)

  useEffect(() => {
    const c = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(c)
  }, [])

  useEffect(() => {
    let t
    function go() {
      t = setTimeout(() => {
        const tip = randomTip()
        setNewTip(tip.id)
        setTips(p => [tip, ...p].slice(0, 8))
        setTotalTokens(n => n + tip.tokens)
        setTotalUsd(n => Math.round((n + tip.tokens * 0.05) * 100) / 100)
        setTimeout(() => setNewTip(null), 700)
        go()
      }, 2200 + Math.random() * 2800)
    }
    go()
    return () => clearTimeout(t)
  }, [])

  const mm  = Math.floor(elapsed / 60).toString().padStart(2, '0')
  const ss  = (elapsed % 60).toString().padStart(2, '0')
  const dph = elapsed > 0 ? ((totalUsd / elapsed) * 3600).toFixed(2) : '0.00'

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ background: 'rgba(0,157,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF1493', display: 'inline-block', animation: 'lmpulse 1.4s ease-in-out infinite' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#FF1493', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Live Mode Demo</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>Simulated</span>
      </div>
      <div style={{ display: 'flex' }}>
        <div style={{ width: 130, borderRight: '1px solid rgba(255,255,255,0.05)', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Session',   value: `${mm}:${ss}`,                color: 'rgba(255,255,255,0.4)' },
            { label: 'Tokens',    value: totalTokens.toLocaleString(), color: '#FF1493' },
            { label: 'Earned',    value: `$${totalUsd.toFixed(2)}`,    color: '#009DFF' },
            { label: '$/hr',      value: `$${dph}`,                    color: '#009DFF', sm: true },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: s.sm ? 14 : 17, fontWeight: 800, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: 200 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '10px 14px 5px' }}>Live Tips</div>
          {tips.map(tip => (
            <div key={tip.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              background: newTip === tip.id ? 'rgba(0,157,255,0.07)' : 'transparent',
              transition: 'background 0.35s',
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, minWidth: 40, fontVariantNumeric: 'tabular-nums', color: tip.tokens >= 100 ? '#009DFF' : tip.tokens >= 25 ? '#FF1493' : 'rgba(255,255,255,0.2)' }}>{tip.tokens}tk</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 11, flex: 1 }}>{tip.user}</span>
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

  const [step,        setStep]        = useState(1)
  const [csvFile,     setCsvFile]     = useState(null)
  const [dragging,    setDragging]    = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadDone,  setUploadDone]  = useState(false)
  const [showSkip,    setShowSkip]    = useState(false)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => setLoading(false))
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
      const { data: { session } } = await supabase.auth.getSession()
      const fd = new FormData()
      fd.append('file', csvFile)
      const res = await fetch('/api/upload-csv', {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: fd,
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Upload failed') }
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

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(0,157,255,0.15)', borderTopColor: '#009DFF', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #020617; }

        .ob-root {
          min-height: 100vh;
          background:
            radial-gradient(circle at 18% 12%, rgba(0,157,255,0.16), transparent 28%),
            radial-gradient(circle at 82% 18%, rgba(255,20,147,0.14), transparent 30%),
            radial-gradient(circle at 72% 88%, rgba(109,53,255,0.18), transparent 34%),
            linear-gradient(135deg, #020617 0%, #050816 45%, #090014 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 24px 80px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .ob-wrap { width: 100%; max-width: 1180px; }

        /* progress */
        .ob-progress {
          display: flex; align-items: center; justify-content: center;
          gap: 0; margin-bottom: 40px;
        }
        .ob-prog-step {
          display: flex; align-items: center; gap: 8px;
          font-size: 12px; font-weight: 600;
          color: rgba(255,255,255,0.22); padding: 0 16px;
        }
        .ob-prog-step.active { color: #009DFF; }
        .ob-prog-step.done   { color: rgba(255,255,255,0.45); }
        .ob-prog-dot {
          width: 22px; height: 22px; border-radius: 50%;
          border: 1.5px solid currentColor;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; flex-shrink: 0;
        }
        .ob-prog-step.active .ob-prog-dot {
          background: #009DFF; border-color: #009DFF; color: #fff;
          box-shadow: 0 0 14px rgba(0,157,255,0.6);
        }
        .ob-prog-line { width: 44px; height: 1px; background: rgba(255,255,255,0.07); }

        /* two-column */
        .ob-layout {
          display: grid;
          grid-template-columns: 58% 1fr;
          gap: 28px;
          align-items: start;
          width: 100%;
        }
        @media (max-width: 860px) {
          .ob-layout { grid-template-columns: 1fr; }
        }

        /* main card */
        .ob-card {
          background: rgba(8,12,28,0.72);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 28px;
          padding: 40px;
          backdrop-filter: blur(18px);
          box-shadow:
            0 24px 80px rgba(0,0,0,0.45),
            0 0 40px rgba(0,157,255,0.08),
            0 0 50px rgba(255,20,147,0.06);
        }
        @media (max-width: 600px) {
          .ob-card { padding: 28px 22px !important; border-radius: 20px !important; }
        }

        /* eyebrow */
        .ob-eyebrow {
          font-size: 11px; font-weight: 800;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: #FF1493; margin-bottom: 12px;
        }

        /* heading */
        .ob-heading {
          font-size: 42px; font-weight: 900; color: #fff;
          line-height: 1.05; margin-bottom: 14px;
        }
        @media (max-width: 860px) { .ob-heading { font-size: 30px !important; } }
        @media (max-width: 600px) { .ob-heading { font-size: 24px !important; } }

        /* body text */
        .ob-sub {
          font-size: 15px; color: rgba(226,232,240,0.72);
          line-height: 1.65; margin-bottom: 6px;
        }
        .ob-sub-minor {
          font-size: 13px; color: rgba(167,176,197,0.7);
          line-height: 1.6; margin-bottom: 26px;
        }


        /* instruction card */
        .ob-steps-wrap {
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 18px 20px;
          margin-bottom: 20px;
        }
        .ob-steps-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(255,255,255,0.3);
          margin-bottom: 12px;
        }
        .ob-steps-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
        .ob-steps-list li {
          display: flex; gap: 10px;
          font-size: 13px; color: rgba(226,232,240,0.65);
          line-height: 1.55; align-items: flex-start;
        }
        .ob-step-num {
          flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
          background: linear-gradient(135deg, #7C3AED, #FF1493);
          color: #fff; font-size: 10px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          margin-top: 1px;
          box-shadow: 0 0 8px rgba(124,58,237,0.4);
        }

        /* upload zone */
        .ob-drop {
          background: rgba(255,255,255,0.035);
          border: 1.5px dashed rgba(0,213,255,0.35);
          border-radius: 22px; padding: 28px 24px;
          text-align: center; cursor: pointer;
          transition: all 0.2s; margin-bottom: 18px;
          position: relative;
          box-shadow: inset 0 0 30px rgba(0,157,255,0.06);
        }
        .ob-drop:hover, .ob-drop.drag {
          border-color: rgba(0,213,255,0.7);
          background: rgba(0,157,255,0.06);
          box-shadow:
            inset 0 0 30px rgba(0,157,255,0.1),
            0 0 0 1px rgba(0,213,255,0.2);
        }
        .ob-drop.has-file {
          border-color: rgba(255,20,147,0.55);
          background: rgba(255,20,147,0.04);
          box-shadow: inset 0 0 30px rgba(255,20,147,0.07);
        }
        .ob-drop input {
          position: absolute; inset: 0;
          opacity: 0; cursor: pointer; width: 100%; height: 100%;
        }

        /* CTA button — NOT full width on desktop */
        .ob-btn-row {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .ob-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 56px;
          padding: 0 34px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(90deg, #009DFF 0%, #6D35FF 48%, #FF1493 100%);
          color: #ffffff;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 0.01em;
          cursor: pointer;
          font-family: inherit;
          transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease, opacity 180ms ease;
          box-shadow:
            0 0 18px rgba(0,157,255,0.65),
            0 0 34px rgba(255,20,147,0.45),
            inset 0 1px 0 rgba(255,255,255,0.25);
          white-space: nowrap;
        }
        .ob-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          filter: brightness(1.08);
          box-shadow:
            0 0 24px rgba(0,157,255,0.85),
            0 0 46px rgba(255,20,147,0.65),
            inset 0 1px 0 rgba(255,255,255,0.35);
        }
        .ob-btn-primary:disabled {
          background: rgba(255,255,255,0.07);
          box-shadow: none;
          color: rgba(255,255,255,0.25);
          cursor: not-allowed;
          transform: none;
          filter: none;
        }
        @media (max-width: 600px) {
          .ob-btn-primary { width: 100%; }
          .ob-btn-row { flex-direction: column; align-items: stretch; }
        }

        /* secondary/full-width variant for step pages */
        .ob-btn-primary-full {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          height: 56px;
          padding: 0 24px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(90deg, #009DFF 0%, #6D35FF 48%, #FF1493 100%);
          color: #ffffff;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.01em;
          cursor: pointer;
          font-family: inherit;
          margin-bottom: 10px;
          transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
          box-shadow:
            0 0 18px rgba(0,157,255,0.55),
            0 0 30px rgba(255,20,147,0.35),
            inset 0 1px 0 rgba(255,255,255,0.2);
        }
        .ob-btn-primary-full:hover {
          transform: translateY(-2px);
          filter: brightness(1.08);
          box-shadow:
            0 0 24px rgba(0,157,255,0.8),
            0 0 44px rgba(255,20,147,0.6),
            inset 0 1px 0 rgba(255,255,255,0.3);
        }

        .ob-skip-link {
          background: none; border: none; cursor: pointer;
          font-family: inherit; font-size: 13px;
          color: rgba(226,232,240,0.68);
          transition: color 0.15s; text-decoration: underline;
          text-underline-offset: 3px;
          text-decoration-color: rgba(226,232,240,0.25);
        }
        .ob-skip-link:hover { color: #fff; }

        /* notes */
        .ob-note {
          display: flex; align-items: flex-start; gap: 9px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 11px 14px;
          margin-bottom: 10px;
          font-size: 12.5px; color: rgba(226,232,240,0.55);
          line-height: 1.55;
        }
        .ob-note strong { color: rgba(255,255,255,0.8); font-weight: 600; }

        .ob-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 16px 0; }

        .ob-error   { font-size: 13px; color: #f87171; margin: 6px 0; text-align: center; }
        .ob-success {
          font-size: 14px; font-weight: 700; margin: 8px 0; text-align: center;
          background: linear-gradient(90deg, #009DFF, #FF1493);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* right column */
        .ob-side-card {
          background: rgba(8,12,28,0.62);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 28px; padding: 32px;
          backdrop-filter: blur(16px);
          box-shadow:
            0 24px 80px rgba(0,0,0,0.38),
            0 0 34px rgba(255,20,147,0.08);
          position: sticky; top: 32px;
        }
        .ob-side-title {
          font-size: 16px; font-weight: 800; color: #fff;
          margin-bottom: 4px;
        }
        .ob-side-sub {
          font-size: 12.5px; color: rgba(167,176,197,0.65);
          line-height: 1.55; margin-bottom: 20px;
        }
        .ob-benefit {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
          font-size: 13px; color: rgba(226,232,240,0.7);
        }
        .ob-benefit:last-child { border-bottom: none; }
        .ob-benefit-dot {
          width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #009DFF, #FF1493);
          box-shadow: 0 0 6px rgba(0,157,255,0.5);
        }
        .ob-mini-stats {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 8px; margin-top: 20px; margin-bottom: 12px;
        }
        .ob-mini-stat {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; padding: 12px 13px;
        }
        .ob-mini-stat-label {
          font-size: 10px; color: rgba(255,255,255,0.28);
          font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
          margin-bottom: 4px;
        }
        .ob-mini-stat-value {
          font-size: 18px; font-weight: 800; color: #fff;
          font-variant-numeric: tabular-nums;
        }
        .ob-mini-chart {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 12px 14px;
          display: flex; align-items: flex-end; gap: 5px;
          height: 60px;
        }
        .ob-bar {
          flex: 1; border-radius: 4px 4px 0 0;
          background: linear-gradient(180deg, rgba(0,157,255,0.5), rgba(109,53,255,0.4));
          min-height: 6px;
          box-shadow: 0 0 8px rgba(0,157,255,0.25);
        }

        /* link card */
        .ob-link-card {
          display: flex; align-items: center; gap: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 13px 16px;
          text-decoration: none; color: rgba(255,255,255,0.7);
          font-size: 13px; font-weight: 600;
          margin-bottom: 10px; transition: all 0.15s;
        }
        .ob-link-card:hover {
          border-color: rgba(0,157,255,0.3);
          background: rgba(0,157,255,0.05);
        }
        .ob-link-card-sub { font-size: 12px; color: rgba(255,255,255,0.25); font-weight: 400; margin-top: 2px; }

        /* warning */
        .ob-warning-box {
          display: flex; gap: 12px; align-items: flex-start;
          background: rgba(0,157,255,0.05);
          border: 1px solid rgba(0,157,255,0.15);
          border-radius: 14px; padding: 16px; margin-bottom: 24px;
        }
        .ob-warning-text { font-size: 13px; color: rgba(226,232,240,0.65); line-height: 1.7; }
        .ob-warning-text strong { color: #009DFF; font-weight: 600; }

        .ob-ext-box {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 16px; margin-bottom: 18px;
          font-size: 13px; color: rgba(255,255,255,0.4);
          line-height: 1.65; text-align: center;
        }

        .ob-done { text-align: center; padding: 56px 0; }

        /* modal */
        .ob-modal-backdrop {
          position: fixed; inset: 0; background: rgba(2,3,8,0.94);
          backdrop-filter: blur(14px);
          display: flex; align-items: center; justify-content: center;
          z-index: 100; padding: 16px;
        }
        .ob-modal {
          background: #080c1c;
          border: 1px solid rgba(255,20,147,0.22);
          border-radius: 24px; padding: 38px 30px;
          max-width: 400px; width: 100%;
          text-align: center;
          box-shadow: 0 0 60px rgba(255,20,147,0.14), 0 24px 64px rgba(0,0,0,0.7);
        }
      `}</style>

      <div className="ob-root">
        <div className="ob-wrap">

          {/* Progress */}
          <div className="ob-progress">
            {['Import History', 'Review Insights', 'Start Tracking Live'].map((label, i) => (
              <>
                <div key={label} className={`ob-prog-step ${step === i+1 ? 'active' : ''} ${step > i+1 ? 'done' : ''}`}>
                  <div className="ob-prog-dot">{step > i+1 ? '✓' : i+1}</div>
                  {label}
                </div>
                {i < 2 && <div className="ob-prog-line" key={`l${i}`} />}
              </>
            ))}
          </div>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className="ob-layout">

              {/* LEFT */}
              <div className="ob-card">
                <div className="ob-eyebrow">Step 1 · Import your tip history</div>
                <h1 className="ob-heading">Unlock your CamCash dashboard</h1>
                <p className="ob-sub">Import your past tip history so CamCash can find your best hours, top fans, whale tippers, and earnings patterns.</p>
                <p className="ob-sub-minor">Choose your platform, follow the quick steps, and upload your CSV when you're ready.</p>

                {/* Instructions */}
                <div className="ob-steps-wrap">
                  <div className="ob-steps-label">Import steps</div>
                  <ul className="ob-steps-list">
                    {IMPORT_STEPS.map((s, i) => (
                      <li key={i}><span className="ob-step-num">{i+1}</span><span>{s}</span></li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: 'rgba(167,176,197,0.6)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13 }}>📺</span>
                    <span>Multiple platforms supported — <strong style={{ color: 'rgba(226,232,240,0.75)', fontWeight: 600 }}>Chaturbate, BongaCams, MyFreeCams</strong></span>
                  </div>
                </div>

                {/* Upload zone */}
                {!uploadDone ? (
                  <>
                    <div
                      className={`ob-drop ${csvFile ? 'has-file' : ''} ${dragging ? 'drag' : ''}`}
                      onDragOver={e => { e.preventDefault(); setDragging(true) }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                    >
                      <input type="file" accept=".csv" onChange={e => { setCsvFile(e.target.files[0] || null); setUploadError(null) }} />
                      <div style={{ fontSize: 34, marginBottom: 8 }}>{csvFile ? '✅' : '📂'}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: csvFile ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)', marginBottom: 4 }}>
                        {csvFile ? csvFile.name : 'Drop your CSV here'}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(167,176,197,0.55)' }}>
                        {csvFile ? 'Ready to upload' : 'or click to browse your files'}
                      </div>
                    </div>

                    {uploadError && <div className="ob-error">{uploadError}</div>}

                    <div className="ob-btn-row">
                      <button className="ob-btn-primary" onClick={handleUpload} disabled={!csvFile || uploading}>
                        {uploading ? 'Importing…' : 'Upload CSV & Unlock Dashboard →'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="ob-success">✓ Your tip history is importing… moving to the next step.</div>
                )}

                <div className="ob-divider" />

                <div className="ob-note">
                  <span style={{ flexShrink: 0 }}>✉️</span>
                  <span>We also sent these steps to your email, so you can come back anytime.</span>
                </div>
                <div className="ob-note" style={{ marginBottom: 14 }}>
                  <span style={{ flexShrink: 0 }}>💡</span>
                  <span>You can skip this for now and import later from your dashboard under <strong>Import</strong>.</span>
                </div>

                <button className="ob-skip-link" onClick={() => setShowSkip(true)}>Skip for now</button>
              </div>

              {/* RIGHT */}
              <div className="ob-side-card">
                <div className="ob-side-title">What CamCash unlocks after import</div>
                <div className="ob-side-sub">Once your history is in, CamCash turns old tips into clear earning patterns.</div>

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

                {/* Mini stat cards */}
                <div className="ob-mini-stats">
                  <div className="ob-mini-stat">
                    <div className="ob-mini-stat-label">Best Hour</div>
                    <div className="ob-mini-stat-value" style={{ color: '#009DFF' }}>10 PM</div>
                  </div>
                  <div className="ob-mini-stat">
                    <div className="ob-mini-stat-label">Top Fan</div>
                    <div className="ob-mini-stat-value" style={{ color: '#FF1493' }}>$248</div>
                  </div>
                  <div className="ob-mini-stat">
                    <div className="ob-mini-stat-label">Platform</div>
                    <div className="ob-mini-stat-value" style={{ fontSize: 13, paddingTop: 3, color: '#A78BFA' }}>Chaturbate</div>
                  </div>
                  <div className="ob-mini-stat">
                    <div className="ob-mini-stat-label">Best Session</div>
                    <div className="ob-mini-stat-value" style={{ color: '#34D399', fontSize: 15 }}>$312</div>
                  </div>
                </div>

                {/* Mini chart */}
                <div className="ob-mini-chart">
                  {[30, 55, 42, 70, 88, 60, 95, 65, 78, 85].map((h, i) => (
                    <div key={i} className="ob-bar" style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', textAlign: 'center', marginTop: 6, letterSpacing: '0.05em' }}>
                  EARNINGS BY HOUR · PREVIEW
                </div>

                <div style={{ marginTop: 16, padding: '12px 14px', background: 'linear-gradient(135deg,rgba(0,157,255,0.07),rgba(255,20,147,0.07))', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', fontSize: 12, color: 'rgba(226,232,240,0.55)', lineHeight: 1.6, textAlign: 'center' }}>
                  Import once. CamCash tracks everything going forward automatically.
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div style={{ width: '100%', maxWidth: 620, margin: '0 auto' }}>
              <div className="ob-card">
                <div className="ob-eyebrow">Step 2 · Live mode</div>
                <h1 className="ob-heading" style={{ fontSize: 30 }}>Your dashboard during a stream</h1>
                <p className="ob-sub" style={{ marginBottom: 20 }}>Real-time tips, session earnings, and $/hr pace — all updating live as your stream runs.</p>
                <LiveModeDemo />
                <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
                  <span style={{ fontSize: 20 }}>🔴</span>
                  <div><div>Open Live Mode</div><div className="ob-link-card-sub">camcashgrl.com/live — keep this open during streams</div></div>
                </a>
                <button className="ob-btn-primary-full" onClick={() => setStep(3)}>Next: Download Extension →</button>
              </div>
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div style={{ width: '100%', maxWidth: 620, margin: '0 auto' }}>
              <div className="ob-card">
                <div className="ob-eyebrow">Step 3 · Browser extension</div>
                <h1 className="ob-heading" style={{ fontSize: 30 }}>Auto-import tips every stream</h1>
                <p className="ob-sub" style={{ marginBottom: 20 }}>Install the CamCash extension and your tips sync automatically every time you go live — no CSV needed going forward.</p>
                <div className="ob-ext-box">
                  🧩 Once installed, just go live on Chaturbate, BongaCams, or MFC.<br />
                  Tips appear in your dashboard and live mode in real time.
                </div>
                <a href="https://chrome.google.com/webstore/detail/camcash" target="_blank" rel="noopener noreferrer"
                  className="ob-link-card" style={{ borderColor: 'rgba(0,157,255,0.25)', background: 'rgba(0,157,255,0.04)', marginBottom: 18 }}>
                  <span style={{ fontSize: 20 }}>⬇️</span>
                  <div>
                    <div style={{ color: '#009DFF' }}>Download CamCash Extension</div>
                    <div className="ob-link-card-sub">Chrome Web Store · Free</div>
                  </div>
                </a>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>Monitor your streams from anywhere:</div>
                <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
                  <span style={{ fontSize: 20 }}>🔴</span>
                  <div><div>Live Mode</div><div className="ob-link-card-sub">Your private real-time stream view</div></div>
                </a>
                <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
                  <span style={{ fontSize: 20 }}>🌐</span>
                  <div><div>Public Live Mode</div><div className="ob-link-card-sub">camcashgrl.com/live — shareable during streams</div></div>
                </a>
                <button className="ob-btn-primary-full" style={{ marginTop: 8 }} onClick={() => setStep(4)}>Next: Enter Dashboard →</button>
              </div>
            </div>
          )}

          {/* ── STEP 4 ── */}
          {step === 4 && (
            <div style={{ width: '100%', maxWidth: 620, margin: '0 auto' }}>
              <div className="ob-card">
                <div className="ob-eyebrow">Almost there</div>
                <h1 className="ob-heading" style={{ fontSize: 30 }}>Before you go in — heads up</h1>
                <p className="ob-sub" style={{ marginBottom: 22 }}>Your dashboard is set up and ready. Just one thing to know:</p>
                <div className="ob-warning-box">
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
                  <div className="ob-warning-text">
                    <strong>Your dashboard will be empty until your first stream or CSV import.</strong>
                    <br /><br />
                    To see your historical earnings, top tippers, and trends right away — import a CSV.
                    Find the <strong>CSV Importer</strong> in the side navigation at any time.
                  </div>
                </div>
                <button className="ob-btn-primary-full" onClick={handleFinish}>Enter my dashboard →</button>
              </div>
            </div>
          )}

          {/* ── STEP 5 ── */}
          {step === 5 && (
            <div style={{ width: '100%', maxWidth: 620, margin: '0 auto' }}>
              <div className="ob-card">
                <div className="ob-done">
                  <div style={{ fontSize: 56, marginBottom: 18 }}>✨</div>
                  <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 10,
                    background: 'linear-gradient(90deg,#009DFF,#6D35FF,#FF1493)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                    You're all set
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(167,176,197,0.6)' }}>Taking you to your dashboard…</div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Skip modal */}
      {showSkip && (
        <div className="ob-modal-backdrop" onClick={() => setShowSkip(false)}>
          <div className="ob-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 38, marginBottom: 14 }}>⚠️</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 10 }}>Skip importing your data?</div>
            <div style={{ fontSize: 14, color: 'rgba(226,232,240,0.55)', lineHeight: 1.7, marginBottom: 28 }}>
              Without a CSV, your earnings history, top fans, and best hours won't show up yet.
              <br /><br />
              You can always import from <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Import CSV</strong> in the sidebar whenever you're ready.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="ob-btn-primary-full" onClick={() => setShowSkip(false)}>Go back and upload</button>
              <button className="ob-skip-link" style={{ padding: '10px 0' }} onClick={() => { setShowSkip(false); setStep(2) }}>
                Skip for now — I understand
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

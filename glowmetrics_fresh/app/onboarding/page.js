'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const PLATFORMS = [
  {
    id: 'chaturbate',
    label: 'Chaturbate',
    color: '#F97316',
    steps: [
      'Log in to your Chaturbate broadcaster account.',
      'Go to chaturbate.com/stats/ and open your token stats page.',
      'Click "Export" — select CSV format and download the file.',
      'Open in Google Sheets: File → Import, then File → Download → CSV.',
      'Upload that CSV file below.',
    ],
  },
  {
    id: 'bongacams',
    label: 'BongaCams',
    color: '#EC4899',
    steps: [
      'Log in to your BongaCams broadcaster account.',
      'Go to your Earnings or Statistics page in your broadcaster dashboard.',
      'Find the export option and download as CSV.',
      'Open in Google Sheets: File → Import, then File → Download → CSV.',
      'Upload that CSV file below.',
    ],
  },
  {
    id: 'myfreecams',
    label: 'MyFreeCams',
    color: '#8B5CF6',
    steps: [
      'Log in to your MyFreeCams broadcaster account.',
      'Navigate to your earnings or token history section.',
      'Download your data as a CSV file.',
      'Open in Google Sheets: File → Import, then File → Download → CSV.',
      'Upload that CSV file below.',
    ],
  },
]

const DEMO_TIPPERS = ['xo_bella', 'darkwolf99', 'tip_king', 'vip_lover', 'night_owl', 'rose_fan', 'bigspender', 'mystery_m']
const DEMO_AMOUNTS = [5, 10, 15, 25, 50, 100, 25, 10, 5, 20]
function randomTip() {
  return {
    id: Math.random().toString(36).slice(2),
    user: DEMO_TIPPERS[Math.floor(Math.random() * DEMO_TIPPERS.length)],
    tokens: DEMO_AMOUNTS[Math.floor(Math.random() * DEMO_AMOUNTS.length)],
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  }
}

function LiveModeDemo() {
  const [tips, setTips] = useState([
    { id: '1', user: 'xo_bella', tokens: 50, time: '9:41 PM' },
    { id: '2', user: 'darkwolf99', tokens: 25, time: '9:42 PM' },
    { id: '3', user: 'tip_king', tokens: 100, time: '9:43 PM' },
  ])
  const [totalTokens, setTotalTokens] = useState(175)
  const [totalUsd, setTotalUsd] = useState(8.75)
  const [elapsed, setElapsed] = useState(312)
  const [newTip, setNewTip] = useState(null)
  const feedRef = useRef(null)

  useEffect(() => {
    const clock = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(clock)
  }, [])

  useEffect(() => {
    let timeout
    function scheduleTip() {
      const delay = 2500 + Math.random() * 3500
      timeout = setTimeout(() => {
        const tip = randomTip()
        setNewTip(tip.id)
        setTips(prev => [tip, ...prev].slice(0, 12))
        setTotalTokens(t => t + tip.tokens)
        setTotalUsd(u => Math.round((u + tip.tokens * 0.05) * 100) / 100)
        setTimeout(() => setNewTip(null), 800)
        scheduleTip()
      }, delay)
    }
    scheduleTip()
    return () => clearTimeout(timeout)
  }, [])

  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0')
  const secs = (elapsed % 60).toString().padStart(2, '0')
  const dph = elapsed > 0 ? ((totalUsd / elapsed) * 3600).toFixed(2) : '0.00'

  return (
    <div style={{
      background: '#0a0814',
      borderRadius: 12,
      border: '1px solid rgba(168,85,247,0.2)',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 13,
    }}>
      <div style={{
        background: 'rgba(168,85,247,0.15)',
        borderBottom: '1px solid rgba(168,85,247,0.2)',
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#a855f7', display: 'inline-block', animation: 'lm-pulse 1.2s ease-in-out infinite' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Live Mode Demo</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#4a3a6a' }}>Simulated stream</span>
      </div>

      <div style={{ display: 'flex', minHeight: 280 }}>
        <div style={{
          width: 130,
          borderRight: '1px solid rgba(168,85,247,0.12)',
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 10, color: '#5a4a7a', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Session</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#e2d9f3', fontVariantNumeric: 'tabular-nums' }}>{mins}:{secs}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#5a4a7a', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Tokens</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#a855f7', fontVariantNumeric: 'tabular-nums' }}>{totalTokens.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#5a4a7a', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Earned</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#2ec77a', fontVariantNumeric: 'tabular-nums' }}>${totalUsd.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#5a4a7a', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>$/hr pace</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#00d4c8', fontVariantNumeric: 'tabular-nums' }}>${dph}</div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '12px 0', overflowY: 'auto', maxHeight: 280 }} ref={feedRef}>
          <div style={{ fontSize: 10, color: '#5a4a7a', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 14px 8px' }}>Live Tips</div>
          {tips.map(tip => (
            <div key={tip.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              transition: 'background 0.3s',
              background: newTip === tip.id ? 'rgba(168,85,247,0.12)' : 'transparent',
            }}>
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                color: tip.tokens >= 100 ? '#f59e0b' : tip.tokens >= 50 ? '#a855f7' : '#00d4c8',
                minWidth: 36,
                fontVariantNumeric: 'tabular-nums',
              }}>{tip.tokens}tk</span>
              <span style={{ color: '#c4b5e8', fontWeight: 600, fontSize: 12, flex: 1 }}>{tip.user}</span>
              <span style={{ color: '#3a2a5a', fontSize: 11 }}>{tip.time}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes lm-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [step, setStep] = useState(1)
  const [selectedPlatform, setSelectedPlatform] = useState('chaturbate')
  const [csvFile, setCsvFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadDone, setUploadDone] = useState(false)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setLoading(false)
    })
    supabase.auth.getSession().then(() => setLoading(false))
    return () => subscription.unsubscribe()
  }, [])

  const platform = PLATFORMS.find(p => p.id === selectedPlatform)

  async function handleUpload() {
    if (!csvFile) return
    setUploading(true)
    setUploadError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const formData = new FormData()
      formData.append('file', csvFile)
      formData.append('platform', selectedPlatform)
      const res = await fetch('/api/upload-csv', {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Upload failed')
      }
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
    { label: 'Import Data', active: step === 1 || step === 2, done: step > 2 },
    { label: 'Live Mode', active: step === 2, done: step > 2 },
    { label: 'Extension', active: step === 3, done: step > 3 },
    { label: 'Dashboard', active: step === 4, done: step >= 5 },
  ]

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080b14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #1e2536', borderTopColor: '#00d4c8', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080b14; }
        .ob-root {
          min-height: 100vh;
          background: #080b14;
          background-image:
            radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,210,200,0.07) 0%, transparent 70%),
            radial-gradient(ellipse 40% 30% at 85% 85%, rgba(160,80,255,0.06) 0%, transparent 60%);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 16px 80px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .ob-progress { display: flex; align-items: center; margin-bottom: 32px; gap: 0; }
        .ob-step-pill {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 20px;
          font-size: 12px; font-weight: 600; color: #3a4460;
          background: transparent; transition: all 0.2s;
        }
        .ob-step-pill.active { color: #00d4c8; background: rgba(0,212,200,0.1); }
        .ob-step-pill.done { color: #2ec77a; background: rgba(46,199,122,0.1); }
        .ob-step-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
        .ob-step-line { width: 24px; height: 1px; background: #1e2536; }
        .ob-card {
          width: 100%; max-width: 580px;
          background: #0d1120; border: 1px solid #1a2035;
          border-radius: 20px; padding: 36px 40px;
          box-shadow: 0 0 0 1px rgba(0,212,200,0.03), 0 24px 64px rgba(0,0,0,0.5);
        }
        .ob-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #00d4c8; margin-bottom: 6px; }
        .ob-heading { font-size: 22px; font-weight: 700; color: #eef2ff; line-height: 1.25; margin-bottom: 6px; }
        .ob-sub { font-size: 14px; color: #4a5568; line-height: 1.6; margin-bottom: 24px; }
        .ob-platform-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
        .ob-platform-tab {
          flex: 1; padding: 10px 8px; border-radius: 10px;
          border: 1px solid #1e2a40; background: #080b14;
          color: #4a5568; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; text-align: center; font-family: inherit;
        }
        .ob-platform-tab:hover { border-color: #2a3550; color: #6b7a9e; }
        .ob-platform-tab.active { border-color: var(--pc); color: var(--pc); background: rgba(0,0,0,0.3); box-shadow: 0 0 0 1px var(--pc); }
        .ob-steps-list {
          list-style: none; margin-bottom: 20px;
          background: #060912; border: 1px solid #141928;
          border-radius: 12px; padding: 16px 18px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .ob-steps-list li { display: flex; gap: 10px; font-size: 13px; color: #7a8aa8; line-height: 1.55; align-items: flex-start; }
        .ob-step-num {
          flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%;
          background: rgba(0,212,200,0.12); color: #00d4c8;
          font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; margin-top: 1px;
        }
        .ob-email-note {
          display: flex; align-items: flex-start; gap: 10px;
          background: rgba(0,212,200,0.05); border: 1px solid rgba(0,212,200,0.12);
          border-radius: 10px; padding: 12px 14px; margin-bottom: 20px;
          font-size: 13px; color: #6b8fa8; line-height: 1.5;
        }
        .ob-upload-zone {
          border: 1.5px dashed #1e2a40; border-radius: 12px;
          padding: 24px 20px; text-align: center; cursor: pointer;
          transition: all 0.15s; margin-bottom: 8px; position: relative;
        }
        .ob-upload-zone:hover { border-color: #00d4c8; background: rgba(0,212,200,0.03); }
        .ob-upload-zone.has-file { border-color: #2ec77a; background: rgba(46,199,122,0.04); }
        .ob-upload-zone input[type=file] { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
        .ob-upload-icon { font-size: 26px; margin-bottom: 6px; }
        .ob-upload-label { font-size: 14px; font-weight: 600; color: #c8d0e8; margin-bottom: 3px; }
        .ob-upload-hint { font-size: 12px; color: #3a4460; }
        .ob-upload-filename { font-size: 13px; color: #2ec77a; font-weight: 600; margin-top: 4px; }
        .ob-error { font-size: 13px; color: #e05252; margin: 10px 0; text-align: center; }
        .ob-success-msg { font-size: 13px; color: #2ec77a; margin: 10px 0; text-align: center; font-weight: 600; }
        .ob-btn-primary {
          width: 100%; padding: 14px;
          background: linear-gradient(135deg, #00d4c8, #a050ff);
          border: none; border-radius: 12px; color: #fff;
          font-size: 15px; font-weight: 700; cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          margin-bottom: 10px; font-family: inherit; letter-spacing: 0.01em;
        }
        .ob-btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .ob-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
        .ob-btn-ghost {
          width: 100%; padding: 12px;
          background: transparent; border: 1px solid #1e2a40;
          border-radius: 12px; color: #4a5568; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; font-family: inherit;
        }
        .ob-btn-ghost:hover { border-color: #2a3550; color: #6b7a9e; }
        .ob-divider { height: 1px; background: #1a2035; margin: 20px 0; }
        .ob-modal-backdrop {
          position: fixed; inset: 0; background: rgba(5,7,15,0.88);
          backdrop-filter: blur(8px); display: flex;
          align-items: center; justify-content: center; z-index: 100; padding: 16px;
        }
        .ob-modal {
          background: #0d1120; border: 1px solid #1e2a40;
          border-radius: 16px; padding: 32px 28px;
          max-width: 380px; width: 100%; text-align: center;
        }
        .ob-modal-icon { font-size: 36px; margin-bottom: 14px; }
        .ob-modal-heading { font-size: 18px; font-weight: 700; color: #eef2ff; margin-bottom: 8px; }
        .ob-modal-body { font-size: 14px; color: #4a5568; line-height: 1.6; margin-bottom: 24px; }
        .ob-modal-actions { display: flex; flex-direction: column; gap: 10px; }
        .ob-link-card {
          display: flex; align-items: center; gap: 12px;
          background: #060912; border: 1px solid #141928;
          border-radius: 10px; padding: 14px 16px;
          text-decoration: none; color: #c8d0e8; font-size: 13px; font-weight: 600;
          transition: border-color 0.15s; margin-bottom: 10px;
        }
        .ob-link-card:hover { border-color: #00d4c8; }
        .ob-link-card-icon { font-size: 20px; flex-shrink: 0; }
        .ob-link-card-sub { font-size: 12px; color: #3a4460; font-weight: 400; margin-top: 2px; }
        .ob-warning-box {
          display: flex; gap: 12px; align-items: flex-start;
          background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.2);
          border-radius: 12px; padding: 16px; margin-bottom: 24px;
        }
        .ob-warning-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
        .ob-warning-text { font-size: 13px; color: #9a8060; line-height: 1.6; }
        .ob-warning-text strong { color: #fbbf24; font-weight: 700; }
        .ob-done { text-align: center; padding: 32px 0; }
        .ob-done-icon { font-size: 52px; margin-bottom: 16px; }
        .ob-done-heading { font-size: 22px; font-weight: 700; color: #eef2ff; margin-bottom: 8px; }
        .ob-done-sub { font-size: 14px; color: #4a5568; }
        .ob-ext-highlight {
          background: rgba(0,212,200,0.06); border: 1px solid rgba(0,212,200,0.15);
          border-radius: 12px; padding: 16px; margin-bottom: 20px;
          font-size: 13px; color: #6b8fa8; line-height: 1.6; text-align: center;
        }
        .ob-download-btn {
          display: flex; align-items: center; gap: 12px;
          background: linear-gradient(135deg, rgba(0,212,200,0.12), rgba(160,80,255,0.1));
          border: 1px solid rgba(0,212,200,0.35);
          border-radius: 12px; padding: 16px 20px;
          text-decoration: none; color: #00d4c8;
          font-size: 14px; font-weight: 700;
          transition: all 0.15s; margin-bottom: 10px;
          cursor: pointer;
        }
        .ob-download-btn:hover { border-color: #00d4c8; background: linear-gradient(135deg, rgba(0,212,200,0.18), rgba(160,80,255,0.15)); transform: translateY(-1px); }
        .ob-download-btn-icon { font-size: 22px; flex-shrink: 0; }
        .ob-download-btn-sub { font-size: 12px; color: #4a7a8a; font-weight: 400; margin-top: 2px; }
        @media (max-width: 560px) {
          .ob-card { padding: 24px 20px; }
          .ob-platform-tabs { flex-direction: column; }
          .ob-heading { font-size: 19px; }
        }
      `}</style>

      <div className="ob-root">
        <div className="ob-progress">
          {progressSteps.map((s, i) => (
            <>
              <div key={s.label} className={`ob-step-pill ${s.active ? 'active' : ''} ${s.done ? 'done' : ''}`}>
                <span className="ob-step-dot" />
                {s.label}
              </div>
              {i < progressSteps.length - 1 && <div className="ob-step-line" key={`line-${i}`} />}
            </>
          ))}
        </div>

        <div className="ob-card">

          {/* ── STEP 1: Platform + CSV ── */}
          {step === 1 && (
            <>
              <div className="ob-eyebrow">Step 1 · Import your history</div>
              <div className="ob-heading">Get your tip data into CamCash</div>
              <div className="ob-sub">Pick your platform, follow the steps to export your CSV, then upload it here. CamCash works with Chaturbate, BongaCams, and MyFreeCams.</div>

              <div className="ob-platform-tabs">
                {PLATFORMS.map(p => (
                  <button
                    key={p.id}
                    className={`ob-platform-tab ${selectedPlatform === p.id ? 'active' : ''}`}
                    style={{ '--pc': p.color }}
                    onClick={() => { setSelectedPlatform(p.id); setCsvFile(null); setUploadError(null); setUploadDone(false) }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <ul className="ob-steps-list">
                {platform.steps.map((s, i) => (
                  <li key={i}>
                    <span className="ob-step-num">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>

              <div className="ob-email-note">
                <span style={{ fontSize: 16, flexShrink: 0 }}>✉️</span>
                <span>An email has been sent to you with full instructions on how to import your historical data.</span>
              </div>

              {!uploadDone ? (
                <>
                  <div className={`ob-upload-zone ${csvFile ? 'has-file' : ''}`}>
                    <input type="file" accept=".csv" onChange={e => { setCsvFile(e.target.files[0] || null); setUploadError(null) }} />
                    <div className="ob-upload-icon">{csvFile ? '✅' : '📂'}</div>
                    <div className="ob-upload-label">{csvFile ? 'File ready to upload' : 'Click to choose your CSV file'}</div>
                    {csvFile
                      ? <div className="ob-upload-filename">{csvFile.name}</div>
                      : <div className="ob-upload-hint">.csv files only</div>
                    }
                  </div>
                  {uploadError && <div className="ob-error">{uploadError}</div>}
                  <br />
                  <button className="ob-btn-primary" onClick={handleUpload} disabled={!csvFile || uploading}>
                    {uploading ? 'Uploading…' : 'Upload CSV →'}
                  </button>
                </>
              ) : (
                <div className="ob-success-msg">✓ CSV uploaded! Moving to next step…</div>
              )}

              <div className="ob-divider" />
              <button className="ob-btn-ghost" onClick={() => setShowSkipConfirm(true)}>
                Skip — I'll import later
              </button>
            </>
          )}

          {/* ── STEP 2: Live mode demo ── */}
          {step === 2 && (
            <>
              <div className="ob-eyebrow">Step 2 · Live mode</div>
              <div className="ob-heading">This is your dashboard during a stream</div>
              <div className="ob-sub">Real-time tips, session earnings, and $/hr pace — all updating live as your stream runs.</div>

              <LiveModeDemo />

              <div style={{ marginTop: 20, marginBottom: 20 }}>
                <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
                  <span className="ob-link-card-icon">🔴</span>
                  <div>
                    <div>Open Live Mode</div>
                    <div className="ob-link-card-sub">camcashgrl.com/live — keep this open during streams</div>
                  </div>
                </a>
              </div>

              <button className="ob-btn-primary" onClick={() => setStep(3)}>
                Next: Download Extension →
              </button>
            </>
          )}

          {/* ── STEP 3: Extension ── */}
          {step === 3 && (
            <>
              <div className="ob-eyebrow">Step 3 · Browser extension</div>
              <div className="ob-heading">Auto-import tips every stream</div>
              <div className="ob-sub">Install the CamCash extension and your tips sync automatically every time you go live — no CSV needed going forward.</div>

              <div className="ob-ext-highlight">
                🧩 Once installed, just go live on Chaturbate, BongaCams, or MFC.<br />
                Your tips will appear in your dashboard and live mode in real time.
              </div>

              <a
                href="/camcash-extension.zip"
                download="camcash-extension.zip"
                className="ob-download-btn"
              >
                <span className="ob-download-btn-icon">⬇️</span>
                <div>
                  <div>Download CamCash Extension</div>
                  <div className="ob-download-btn-sub">Free · camcash-extension.zip</div>
                </div>
              </a>

              <div className="ob-divider" />

              <div style={{ fontSize: 13, color: '#4a5568', marginBottom: 14, lineHeight: 1.6 }}>
                Monitor your streams from anywhere:
              </div>

              <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
                <span className="ob-link-card-icon">🔴</span>
                <div>
                  <div>Live Mode</div>
                  <div className="ob-link-card-sub">Your private real-time stream view</div>
                </div>
              </a>

              <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
                <span className="ob-link-card-icon">🌐</span>
                <div>
                  <div>Public Live Mode</div>
                  <div className="ob-link-card-sub">camcashgrl.com/live — shareable link during streams</div>
                </div>
              </a>

              <button className="ob-btn-primary" style={{ marginTop: 8 }} onClick={() => setStep(4)}>
                Next: Enter Dashboard →
              </button>
            </>
          )}

          {/* ── STEP 4: Pre-dashboard warning ── */}
          {step === 4 && (
            <>
              <div className="ob-eyebrow">Almost there</div>
              <div className="ob-heading">Before you go in — heads up</div>
              <div className="ob-sub">Your dashboard is set up and ready. Just one thing to know:</div>

              <div className="ob-warning-box">
                <span className="ob-warning-icon">⚠️</span>
                <div className="ob-warning-text">
                  <strong>Your dashboard will be empty until your first stream or CSV import.</strong><br /><br />
                  To see your historical earnings, top tippers, and trends right away — import a CSV. You can find the <strong>CSV Importer</strong> in the side navigation anytime. You can import CSVs from any platform at any time.
                </div>
              </div>

              <button className="ob-btn-primary" onClick={handleFinish}>
                🚀 Enter my dashboard
              </button>
            </>
          )}

          {/* ── STEP 5: Done ── */}
          {step === 5 && (
            <div className="ob-done">
              <div className="ob-done-icon">🎉</div>
              <div className="ob-done-heading">You're all set!</div>
              <div className="ob-done-sub">Taking you to your dashboard…</div>
            </div>
          )}

        </div>
      </div>

      {/* ── Skip confirm modal ── */}
      {showSkipConfirm && (
        <div className="ob-modal-backdrop" onClick={() => setShowSkipConfirm(false)}>
          <div className="ob-modal" onClick={e => e.stopPropagation()}>
            <div className="ob-modal-icon">⚠️</div>
            <div className="ob-modal-heading">Skip importing your data?</div>
            <div className="ob-modal-body">
              Without a CSV we can't import your historical tips. Your earnings history, top tippers, and trends won't show until you upload one.
              <br /><br />
              You can always import a CSV later from the side nav.
            </div>
            <div className="ob-modal-actions">
              <button className="ob-btn-primary" onClick={() => setShowSkipConfirm(false)}>
                Go back and upload
              </button>
              <button className="ob-btn-ghost" onClick={() => { setShowSkipConfirm(false); setStep(2) }}>
                Skip anyway — I understand
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

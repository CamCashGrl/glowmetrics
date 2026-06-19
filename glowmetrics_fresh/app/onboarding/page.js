'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { T } from '../../lib/tracking'

// CamCash palette
const C = {
  bg:       '#07111F',
  card:     '#0E1A2B',
  panel:    '#13233A',
  border:   '#1E314D',
  cyan:     '#38D5E8',
  teal:     '#2DD4BF',
  blue:     '#3B82F6',
  white:    '#F8FAFC',
  text:     '#94A3B8',
}

const PLATFORMS = [
  {
    id: 'chaturbate',
    label: 'Chaturbate',
    emoji: '🟣',
    color: C.cyan,
    steps: [
      'Log into Chaturbate as a broadcaster',
      'Go to Stats & Data → Token Stats',
      'Set your date range (last 90 days works great)',
      'Click "Download CSV" or "Export"',
      'Upload that file below ↓',
    ],
    tip: 'Look for a file named something like chaturbate_token_stats.csv',
  },
  {
    id: 'bongacams',
    label: 'BongaCams',
    emoji: '🔴',
    color: C.teal,
    steps: [
      'Log into your BongaCams model account',
      'Go to Statistics → Earnings History',
      'Select your date range and click Export',
      'Save the CSV file to your computer',
      'Upload that file below ↓',
    ],
    tip: 'BongaCams exports include date, username, tokens, and USD',
  },
  {
    id: 'myfreecams',
    label: 'MyFreeCams',
    emoji: '🟠',
    color: C.blue,
    steps: [
      'Log into your MFC model account',
      'Go to Model Admin → Token Stats',
      'Click Transaction History and set your date range',
      'Click Export CSV',
      'Upload that file below ↓',
    ],
    tip: 'MFC exports are very detailed — all transaction types included',
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
    { id: '1', user: 'xo_bella',   tokens: 50,  time: '9:41 PM' },
    { id: '2', user: 'darkwolf99', tokens: 25,  time: '9:42 PM' },
    { id: '3', user: 'tip_king',   tokens: 100, time: '9:43 PM' },
  ])
  const [totalTokens, setTotalTokens] = useState(175)
  const [totalUsd, setTotalUsd] = useState(8.75)
  const [elapsed, setElapsed] = useState(312)
  const [newTip, setNewTip] = useState(null)

  useEffect(() => {
    const clock = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(clock)
  }, [])

  useEffect(() => {
    let timeout
    function scheduleTip() {
      timeout = setTimeout(() => {
        const tip = randomTip()
        setNewTip(tip.id)
        setTips(prev => [tip, ...prev].slice(0, 12))
        setTotalTokens(t => t + tip.tokens)
        setTotalUsd(u => Math.round((u + tip.tokens * 0.05) * 100) / 100)
        setTimeout(() => setNewTip(null), 800)
        scheduleTip()
      }, 2500 + Math.random() * 3500)
    }
    scheduleTip()
    return () => clearTimeout(timeout)
  }, [])

  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0')
  const secs = (elapsed % 60).toString().padStart(2, '0')
  const dph  = elapsed > 0 ? ((totalUsd / elapsed) * 3600).toFixed(2) : '0.00'

  return (
    <div style={{ background: C.panel, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden', fontSize: 13 }}>
      <div style={{ background: `${C.cyan}18`, borderBottom: `1px solid ${C.border}`, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.cyan, display: 'inline-block', animation: 'lm-pulse 1.2s ease-in-out infinite' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: C.cyan, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Live Mode Demo</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: C.text }}>Simulated stream</span>
      </div>
      <div style={{ display: 'flex', minHeight: 260 }}>
        <div style={{ width: 130, borderRight: `1px solid ${C.border}`, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'Session', value: `${mins}:${secs}`, color: C.white },
            { label: 'Tokens',  value: totalTokens.toLocaleString(), color: C.cyan },
            { label: 'Earned',  value: `$${totalUsd.toFixed(2)}`, color: C.teal },
            { label: '$/hr pace', value: `$${dph}`, color: C.blue },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: C.text, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: label === 'Tokens' ? 22 : label === 'Session' ? 20 : 18, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: '12px 0', overflowY: 'auto', maxHeight: 260 }}>
          <div style={{ fontSize: 10, color: C.text, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 14px 8px' }}>Live Tips</div>
          {tips.map(tip => (
            <div key={tip.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 14px', borderBottom: `1px solid ${C.border}30`,
              transition: 'background 0.3s',
              background: newTip === tip.id ? `${C.cyan}12` : 'transparent',
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, minWidth: 36, fontVariantNumeric: 'tabular-nums', color: tip.tokens >= 100 ? C.blue : tip.tokens >= 50 ? C.cyan : C.teal }}>{tip.tokens}tk</span>
              <span style={{ color: C.white, fontWeight: 600, fontSize: 12, flex: 1 }}>{tip.user}</span>
              <span style={{ color: C.text, fontSize: 11 }}>{tip.time}</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes lm-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  )
}

export default function OnboardingPage() {
  const router  = useRouter()
  const supabase = createClientComponentClient()

  const [user,           setUser]           = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [step,           setStep]           = useState(1)
  const [selectedPlatform, setSelectedPlatform] = useState('chaturbate')
  const [uploading,      setUploading]      = useState(false)
  const [uploadDone,     setUploadDone]     = useState(false)
  const [uploadError,    setUploadError]    = useState(null)
  const [dragOver,       setDragOver]       = useState(false)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    const check = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.replace('/login'); return }
      const { data: profile } = await supabase
        .from('beta_users').select('onboarding_complete').eq('user_id', u.id).single()
      if (profile?.onboarding_complete) { router.replace('/dashboard'); return }
      setUser(u)
      setLoading(false)
    }
    check()
  }, [router])

  const platform = PLATFORMS.find(p => p.id === selectedPlatform)

  const handleFile = async (file) => {
    if (!file || !user) return
    T.csvUploadStarted()
    setUploading(true)
    setUploadError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setUploadError('Not logged in'); setUploading(false); return }
      const fd = new FormData()
      fd.append('file', file)
      fd.append('platform', platform.label)
      const res    = await fetch('/api/upload-csv', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: fd })
      const result = await res.json()
      if (!res.ok || result.error) {
        T.csvUploadFailed(result.error || 'upload_failed')
        setUploadError(result.error || 'Upload failed — check the platform selection and try again')
        setUploading(false)
        return
      }
      await supabase.from('beta_users').upsert(
        { user_id: user.id, email: user.email, onboarding_complete: true, signed_up_at: user.created_at },
        { onConflict: 'user_id' }
      )
      T.csvUploadCompleted(result?.inserted || 0, 0)
      setUploadDone(true)
      setTimeout(() => setStep(2), 1200)
    } catch (err) {
      T.csvUploadFailed(err.message || 'exception')
      setUploadError(err.message || 'Something went wrong')
    } finally {
      setUploading(false)
    }
  }

  const handleFinish = () => { setStep(5); setTimeout(() => router.push('/dashboard'), 1500) }

  const progressSteps = [
    { label: 'Import Data', active: step === 1, done: step > 1 },
    { label: 'Live Mode',   active: step === 2, done: step > 2 },
    { label: 'Extension',   active: step === 3, done: step > 3 },
    { label: 'Dashboard',   active: step === 4, done: step >= 5 },
  ]

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${C.border}`, borderTopColor: C.cyan, animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; }
        .ob-root {
          min-height: 100vh;
          background: ${C.bg};
          background-image:
            radial-gradient(ellipse 60% 40% at 50% 0%, ${C.cyan}0f 0%, transparent 70%),
            radial-gradient(ellipse 40% 30% at 85% 85%, ${C.blue}0a 0%, transparent 60%);
          display: flex; flex-direction: column; align-items: center;
          padding: 40px 16px 80px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .ob-progress { display: flex; align-items: center; margin-bottom: 32px; }
        .ob-step-pill {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 20px;
          font-size: 12px; font-weight: 600; color: ${C.text};
          transition: all 0.2s;
        }
        .ob-step-pill.active { color: ${C.cyan}; background: ${C.cyan}14; }
        .ob-step-pill.done   { color: ${C.teal}; background: ${C.teal}14; }
        .ob-step-dot  { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
        .ob-step-line { width: 24px; height: 1px; background: ${C.border}; }
        .ob-card {
          width: 100%; max-width: 620px;
          background: ${C.card}; border: 1px solid ${C.border};
          border-radius: 20px; padding: 36px 40px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.4);
        }
        .ob-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${C.cyan}; margin-bottom: 6px; }
        .ob-heading  { font-size: 22px; font-weight: 700; color: ${C.white}; line-height: 1.25; margin-bottom: 6px; }
        .ob-sub      { font-size: 14px; color: ${C.text}; line-height: 1.65; margin-bottom: 24px; }
        .ob-platform-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
        .ob-platform-tab {
          flex: 1; padding: 10px 8px; border-radius: 10px;
          border: 1px solid ${C.border}; background: ${C.panel};
          color: ${C.text}; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; text-align: center; font-family: inherit;
        }
        .ob-platform-tab:hover  { border-color: ${C.cyan}60; color: ${C.white}; }
        .ob-platform-tab.active { border-color: var(--pc); color: var(--pc); background: ${C.bg}; box-shadow: 0 0 0 1px var(--pc); }
        .ob-steps-list {
          list-style: none; margin-bottom: 14px;
          background: ${C.panel}; border: 1px solid ${C.border};
          border-radius: 12px; padding: 16px 18px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .ob-steps-list li { display: flex; gap: 10px; font-size: 13px; color: ${C.text}; line-height: 1.55; align-items: flex-start; }
        .ob-step-num {
          flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%;
          font-size: 11px; font-weight: 800;
          display: flex; align-items: center; justify-content: center; margin-top: 1px;
        }
        .ob-plat-tip {
          margin-bottom: 20px; padding: 9px 12px; border-radius: 9px;
          font-size: 12px; line-height: 1.5;
          background: var(--pt-bg); border: 1px solid var(--pt-border); color: var(--pt-color);
        }
        .ob-video-wrap {
          margin-bottom: 24px; border-radius: 14px; overflow: hidden;
          border: 1px solid ${C.border};
        }
        .ob-video-header {
          padding: 12px 16px; background: ${C.panel};
          border-bottom: 1px solid ${C.border};
          display: flex; align-items: center; gap: 10px;
        }
        .ob-upload-zone {
          border: 1.5px dashed ${C.border}; border-radius: 12px;
          padding: 28px 20px; text-align: center; cursor: pointer;
          transition: all 0.15s; margin-bottom: 8px; background: ${C.panel};
        }
        .ob-upload-zone:hover, .ob-upload-zone.drag { border-color: ${C.cyan}; background: ${C.cyan}08; }
        .ob-error       { font-size: 13px; color: #f87171; margin: 10px 0; }
        .ob-success-msg { font-size: 13px; color: ${C.teal}; margin: 10px 0; font-weight: 600; }
        .ob-btn-primary {
          width: 100%; padding: 14px;
          background: linear-gradient(135deg, ${C.cyan}, ${C.blue});
          border: none; border-radius: 12px; color: #fff;
          font-size: 15px; font-weight: 700; cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          margin-bottom: 10px; font-family: inherit;
          box-shadow: 0 6px 24px ${C.cyan}28;
        }
        .ob-btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .ob-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .ob-btn-ghost {
          width: 100%; padding: 12px;
          background: transparent; border: 1px solid ${C.border};
          border-radius: 12px; color: ${C.text}; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; font-family: inherit;
        }
        .ob-btn-ghost:hover { border-color: ${C.cyan}60; color: ${C.white}; }
        .ob-divider { height: 1px; background: ${C.border}; margin: 20px 0; }
        .ob-modal-backdrop {
          position: fixed; inset: 0; background: rgba(7,17,31,0.9);
          backdrop-filter: blur(8px); display: flex;
          align-items: center; justify-content: center; z-index: 100; padding: 16px;
        }
        .ob-modal {
          background: ${C.card}; border: 1px solid ${C.border};
          border-radius: 16px; padding: 32px 28px;
          max-width: 380px; width: 100%; text-align: center;
        }
        .ob-link-card {
          display: flex; align-items: center; gap: 12px;
          background: ${C.panel}; border: 1px solid ${C.border};
          border-radius: 10px; padding: 14px 16px;
          text-decoration: none; color: ${C.white}; font-size: 13px; font-weight: 600;
          transition: border-color 0.15s; margin-bottom: 10px;
        }
        .ob-link-card:hover { border-color: ${C.cyan}; }
        .ob-link-card-sub { font-size: 12px; color: ${C.text}; font-weight: 400; margin-top: 2px; }
        .ob-warning-box {
          display: flex; gap: 12px; align-items: flex-start;
          background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.2);
          border-radius: 12px; padding: 16px; margin-bottom: 24px;
        }
        .ob-warning-text { font-size: 13px; color: ${C.text}; line-height: 1.65; }
        .ob-warning-text strong { color: ${C.cyan}; font-weight: 700; }
        .ob-ext-highlight {
          background: ${C.panel}; border: 1px solid ${C.border};
          border-radius: 12px; padding: 16px; margin-bottom: 20px;
          font-size: 13px; color: ${C.text}; line-height: 1.65; text-align: center;
        }
        .ob-download-btn {
          display: flex; align-items: center; gap: 12px;
          background: linear-gradient(135deg, ${C.cyan}18, ${C.blue}12);
          border: 1px solid ${C.cyan}50;
          border-radius: 12px; padding: 16px 20px;
          text-decoration: none; color: ${C.cyan};
          font-size: 14px; font-weight: 700;
          transition: all 0.15s; margin-bottom: 10px;
        }
        .ob-download-btn:hover { border-color: ${C.cyan}; transform: translateY(-1px); }
        .ob-download-btn-sub { font-size: 12px; color: ${C.text}; font-weight: 400; margin-top: 2px; }
        @keyframes spin   { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @media (max-width: 560px) {
          .ob-card { padding: 24px 20px; }
          .ob-platform-tabs { flex-direction: column; }
          .ob-heading { font-size: 19px; }
        }
      `}</style>

      <div className="ob-root">

        {/* Progress */}
        <div className="ob-progress">
          {progressSteps.map((s, i) => (
            <>
              <div key={s.label} className={`ob-step-pill ${s.active ? 'active' : ''} ${s.done ? 'done' : ''}`}>
                <span className="ob-step-dot" />{s.label}
              </div>
              {i < progressSteps.length - 1 && <div className="ob-step-line" key={`l${i}`} />}
            </>
          ))}
        </div>

        <div className="ob-card">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              <div className="ob-eyebrow">Step 1 · Import your history</div>
              <div className="ob-heading">Let&apos;s get your stats loaded</div>
              <div className="ob-sub">Watch the short video, export your CSV from your platform, and upload it below. Your full dashboard unlocks instantly.</div>

              {/* Video */}
              <div className="ob-video-wrap">
                <div className="ob-video-header">
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: `linear-gradient(135deg,${C.cyan},${C.blue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>▶</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>How to upload your CSV</div>
                    <div style={{ fontSize: 11, color: C.text }}>Watch first — takes 2 minutes</div>
                  </div>
                </div>
                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, background: '#000' }}>
                  <iframe
                    src="https://www.youtube.com/embed/IJyzM7Pntyc?rel=0&modestbranding=1&mute=1"
                    title="How to upload your CSV to CamCash"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                  />
                </div>
              </div>

              {/* Platform tabs */}
              <div className="ob-platform-tabs">
                {PLATFORMS.map(p => (
                  <button
                    key={p.id}
                    className={`ob-platform-tab ${selectedPlatform === p.id ? 'active' : ''}`}
                    style={{ '--pc': p.color }}
                    onClick={() => { setSelectedPlatform(p.id); setUploadError(null); setUploadDone(false) }}
                  >
                    {p.emoji} {p.label}
                  </button>
                ))}
              </div>

              {/* Export steps */}
              <ul className="ob-steps-list">
                {platform.steps.map((s, i) => (
                  <li key={i}>
                    <span className="ob-step-num" style={{ background: `${platform.color}20`, border: `1px solid ${platform.color}40`, color: platform.color }}>{i + 1}</span>
                    <span style={{ color: i === platform.steps.length - 1 ? C.white : C.text, fontWeight: i === platform.steps.length - 1 ? 600 : 400 }}>{s}</span>
                  </li>
                ))}
              </ul>

              {/* Tip */}
              <div className="ob-plat-tip" style={{ '--pt-bg': `${platform.color}0d`, '--pt-border': `${platform.color}25`, '--pt-color': platform.color }}>
                💡 {platform.tip}
              </div>

              {/* Upload */}
              {!uploadDone ? (
                <>
                  <div
                    className={`ob-upload-zone${dragOver ? ' drag' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                    onClick={() => fileRef.current?.click()}
                  >
                    <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) handleFile(f) }} />
                    {uploading ? (
                      <>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', border: `2px solid ${C.border}`, borderTopColor: C.cyan, animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
                        <div style={{ fontSize: 14, color: C.cyan, fontWeight: 600 }}>Processing your file…</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 34, marginBottom: 8 }}>📂</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 4 }}>Drop your CSV here</div>
                        <div style={{ fontSize: 13, color: C.text }}>or click to browse · .csv files only</div>
                      </>
                    )}
                  </div>
                  {uploadError && <div className="ob-error">⚠️ {uploadError}</div>}
                </>
              ) : (
                <div className="ob-success-msg">✓ CSV uploaded! Moving to next step…</div>
              )}

              <div className="ob-divider" />
              <button className="ob-btn-ghost" onClick={() => setShowSkipConfirm(true)}>Skip — I'll import later</button>
            </>
          )}

          {/* ── STEP 2: Live Mode ── */}
          {step === 2 && (
            <>
              <div className="ob-eyebrow">Step 2 · Live mode</div>
              <div className="ob-heading">Your dashboard during a stream</div>
              <div className="ob-sub">Real-time tips, session earnings, and $/hr pace — all updating live as your stream runs.</div>
              <LiveModeDemo />
              <div style={{ marginTop: 20, marginBottom: 20 }}>
                <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
                  <span style={{ fontSize: 20 }}>🔴</span>
                  <div>
                    <div>Open Live Mode</div>
                    <div className="ob-link-card-sub">camcashgrl.com/live — keep open during streams</div>
                  </div>
                </a>
              </div>
              <button className="ob-btn-primary" onClick={() => setStep(3)}>Next: Download Extension →</button>
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
                Your tips appear in your dashboard and live mode in real time.
              </div>
              <a href="/camcash-extension.zip" download="camcash-extension.zip" className="ob-download-btn">
                <span style={{ fontSize: 22 }}>⬇️</span>
                <div>
                  <div>Download CamCash Extension</div>
                  <div className="ob-download-btn-sub">Free · camcash-extension.zip</div>
                </div>
              </a>
              <div className="ob-divider" />
              <div style={{ fontSize: 13, color: C.text, marginBottom: 14, lineHeight: 1.6 }}>Monitor your streams from anywhere:</div>
              <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
                <span style={{ fontSize: 20 }}>🔴</span>
                <div><div>Live Mode</div><div className="ob-link-card-sub">Your private real-time stream view</div></div>
              </a>
              <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
                <span style={{ fontSize: 20 }}>🌐</span>
                <div><div>Public Live Mode</div><div className="ob-link-card-sub">camcashgrl.com/live — shareable during streams</div></div>
              </a>
              <button className="ob-btn-primary" style={{ marginTop: 8 }} onClick={() => setStep(4)}>Next: Enter Dashboard →</button>
            </>
          )}

          {/* ── STEP 4: Warning ── */}
          {step === 4 && (
            <>
              <div className="ob-eyebrow">Almost there</div>
              <div className="ob-heading">Before you go in — heads up</div>
              <div className="ob-sub">Your dashboard is ready. Just one thing to know:</div>
              <div className="ob-warning-box">
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
                <div className="ob-warning-text">
                  <strong>Your dashboard will be empty until your first stream or CSV import.</strong><br /><br />
                  To see earnings history, top tippers, and trends right away — import a CSV. Find the <strong>CSV Importer</strong> in the side nav anytime.
                </div>
              </div>
              <button className="ob-btn-primary" onClick={handleFinish}>🚀 Enter my dashboard</button>
            </>
          )}

          {/* ── STEP 5: Done ── */}
          {step === 5 && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.white, marginBottom: 8 }}>You&apos;re all set!</div>
              <div style={{ fontSize: 14, color: C.text }}>Taking you to your dashboard…</div>
            </div>
          )}

        </div>
      </div>

      {/* Skip modal */}
      {showSkipConfirm && (
        <div className="ob-modal-backdrop" onClick={() => setShowSkipConfirm(false)}>
          <div className="ob-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 8 }}>Skip importing your data?</div>
            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.65, marginBottom: 24 }}>
              Without a CSV we can&apos;t show your historical tips, earnings history, or top tippers.<br /><br />
              You can always import a CSV later from the side nav.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="ob-btn-primary" onClick={() => setShowSkipConfirm(false)}>Go back and upload</button>
              <button className="ob-btn-ghost" onClick={() => { setShowSkipConfirm(false); setStep(2) }}>Skip anyway — I understand</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

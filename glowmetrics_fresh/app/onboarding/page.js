'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { T } from '../../lib/tracking'

const PLATFORMS = [
  {
    id: 'chaturbate',
    label: 'Chaturbate',
    emoji: '🟣',
    color: '#22D3EE',
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
    color: '#EC4899',
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
    color: '#F59E0B',
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
    { id: '1', user: 'xo_bella', tokens: 50, time: '9:41 PM' },
    { id: '2', user: 'darkwolf99', tokens: 25, time: '9:42 PM' },
    { id: '3', user: 'tip_king', tokens: 100, time: '9:43 PM' },
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
      background: '#0a0f1e', borderRadius: 12,
      border: '1px solid rgba(124,92,255,0.2)',
      overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13,
    }}>
      <div style={{
        background: 'rgba(124,92,255,0.15)', borderBottom: '1px solid rgba(124,92,255,0.2)',
        padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7C5CFF', display: 'inline-block', animation: 'lm-pulse 1.2s ease-in-out infinite' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#7C5CFF', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Live Mode Demo</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>Simulated stream</span>
      </div>
      <div style={{ display: 'flex', minHeight: 280 }}>
        <div style={{ width: 130, borderRight: '1px solid rgba(124,92,255,0.12)', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Session</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#F1F5F9', fontVariantNumeric: 'tabular-nums' }}>{mins}:{secs}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Tokens</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#7C5CFF', fontVariantNumeric: 'tabular-nums' }}>{totalTokens.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Earned</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#10B981', fontVariantNumeric: 'tabular-nums' }}>${totalUsd.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>$/hr pace</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#22D3EE', fontVariantNumeric: 'tabular-nums' }}>${dph}</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 0', overflowY: 'auto', maxHeight: 280 }}>
          <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 14px 8px' }}>Live Tips</div>
          {tips.map(tip => (
            <div key={tip.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)',
              transition: 'background 0.3s',
              background: newTip === tip.id ? 'rgba(124,92,255,0.12)' : 'transparent',
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: tip.tokens >= 100 ? '#F59E0B' : tip.tokens >= 50 ? '#7C5CFF' : '#22D3EE', minWidth: 36, fontVariantNumeric: 'tabular-nums' }}>{tip.tokens}tk</span>
              <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: 12, flex: 1 }}>{tip.user}</span>
              <span style={{ color: '#475569', fontSize: 11 }}>{tip.time}</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes lm-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [selectedPlatform, setSelectedPlatform] = useState('chaturbate')
  const [uploading, setUploading] = useState(false)
  const [uploadDone, setUploadDone] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    const check = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.replace('/login'); return }
      const { data: profile } = await supabase
        .from('beta_users')
        .select('onboarding_complete')
        .eq('user_id', u.id)
        .single()
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
      const res = await fetch('/api/upload-csv', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      })
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

  const handleFinish = () => {
    setStep(5)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  const progressSteps = [
    { label: 'Import Data', active: step === 1, done: step > 1 },
    { label: 'Live Mode',   active: step === 2, done: step > 2 },
    { label: 'Extension',  active: step === 3, done: step > 3 },
    { label: 'Dashboard',  active: step === 4, done: step >= 5 },
  ]

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#05070f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #1e2d45', borderTopColor: '#22D3EE', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #05070f; }
        .ob-root {
          min-height: 100vh;
          background: #05070f;
          background-image:
            radial-gradient(circle at 20% 20%, rgba(34,211,238,0.12), transparent 40%),
            radial-gradient(circle at 80% 80%, rgba(236,72,153,0.12), transparent 40%);
          display: flex; flex-direction: column; align-items: center;
          padding: 40px 16px 80px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .ob-progress { display: flex; align-items: center; margin-bottom: 32px; gap: 0; }
        .ob-step-pill {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 20px;
          font-size: 12px; font-weight: 600; color: #475569;
          background: transparent; transition: all 0.2s;
        }
        .ob-step-pill.active { color: #22D3EE; background: rgba(34,211,238,0.1); }
        .ob-step-pill.done   { color: #10B981; background: rgba(16,185,129,0.1); }
        .ob-step-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
        .ob-step-line { width: 24px; height: 1px; background: #1e2d45; }
        .ob-card {
          width: 100%; max-width: 620px;
          background: #121826; border: 1px solid #1e2d45;
          border-radius: 20px; padding: 36px 40px;
          box-shadow: 0 0 0 1px rgba(34,211,238,0.03), 0 24px 64px rgba(0,0,0,0.5);
        }
        .ob-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #22D3EE; margin-bottom: 6px; }
        .ob-heading  { font-size: 22px; font-weight: 700; color: #F1F5F9; line-height: 1.25; margin-bottom: 6px; }
        .ob-sub      { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px; }
        .ob-platform-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
        .ob-platform-tab {
          flex: 1; padding: 10px 8px; border-radius: 10px;
          border: 1px solid #1e2d45; background: #05070f;
          color: #475569; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; text-align: center; font-family: inherit;
        }
        .ob-platform-tab:hover { border-color: rgba(255,255,255,0.2); color: #94A3B8; }
        .ob-platform-tab.active { border-color: var(--pc); color: var(--pc); background: rgba(0,0,0,0.3); box-shadow: 0 0 0 1px var(--pc); }
        .ob-steps-list {
          list-style: none; margin-bottom: 14px;
          background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px; padding: 16px 18px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .ob-steps-list li { display: flex; gap: 10px; font-size: 13px; color: #94A3B8; line-height: 1.55; align-items: flex-start; }
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
          border: 1px solid rgba(34,211,238,0.2);
          box-shadow: 0 0 40px rgba(34,211,238,0.07);
        }
        .ob-video-header {
          padding: 12px 16px; background: rgba(15,20,32,0.95);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex; align-items: center; gap: 10px;
        }
        .ob-video-icon {
          width: 26px; height: 26px; border-radius: 7px;
          background: linear-gradient(135deg,#EC4899,#7C5CFF);
          display: flex; align-items: center; justify-content: center; font-size: 12px;
        }
        .ob-upload-zone {
          border: 2px dashed rgba(34,211,238,0.25); border-radius: 12px;
          padding: 28px 20px; text-align: center; cursor: pointer;
          transition: all 0.15s; margin-bottom: 8px;
          background: rgba(34,211,238,0.03);
        }
        .ob-upload-zone:hover, .ob-upload-zone.drag { border-color: rgba(34,211,238,0.6); background: rgba(34,211,238,0.07); }
        .ob-error       { font-size: 13px; color: #F87171; margin: 10px 0; }
        .ob-success-msg { font-size: 13px; color: #10B981; margin: 10px 0; font-weight: 600; }
        .ob-btn-primary {
          width: 100%; padding: 14px;
          background: linear-gradient(135deg, #22D3EE, #7C5CFF);
          border: none; border-radius: 12px; color: #fff;
          font-size: 15px; font-weight: 700; cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          margin-bottom: 10px; font-family: inherit; letter-spacing: 0.01em;
          box-shadow: 0 8px 28px rgba(34,211,238,0.2);
        }
        .ob-btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .ob-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
        .ob-btn-ghost {
          width: 100%; padding: 12px;
          background: transparent; border: 1px solid #1e2d45;
          border-radius: 12px; color: #475569; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; font-family: inherit;
        }
        .ob-btn-ghost:hover { border-color: rgba(255,255,255,0.2); color: #94A3B8; }
        .ob-divider { height: 1px; background: #1e2d45; margin: 20px 0; }
        .ob-modal-backdrop {
          position: fixed; inset: 0; background: rgba(5,7,15,0.88);
          backdrop-filter: blur(8px); display: flex;
          align-items: center; justify-content: center; z-index: 100; padding: 16px;
        }
        .ob-modal {
          background: #121826; border: 1px solid #1e2d45;
          border-radius: 16px; padding: 32px 28px;
          max-width: 380px; width: 100%; text-align: center;
        }
        .ob-link-card {
          display: flex; align-items: center; gap: 12px;
          background: rgba(0,0,0,0.3); border: 1px solid #1e2d45;
          border-radius: 10px; padding: 14px 16px;
          text-decoration: none; color: #F1F5F9; font-size: 13px; font-weight: 600;
          transition: border-color 0.15s; margin-bottom: 10px;
        }
        .ob-link-card:hover { border-color: #22D3EE; }
        .ob-link-card-sub { font-size: 12px; color: #475569; font-weight: 400; margin-top: 2px; }
        .ob-warning-box {
          display: flex; gap: 12px; align-items: flex-start;
          background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.2);
          border-radius: 12px; padding: 16px; margin-bottom: 24px;
        }
        .ob-warning-text { font-size: 13px; color: #94A3B8; line-height: 1.6; }
        .ob-warning-text strong { color: #F59E0B; font-weight: 700; }
        .ob-ext-highlight {
          background: rgba(34,211,238,0.06); border: 1px solid rgba(34,211,238,0.15);
          border-radius: 12px; padding: 16px; margin-bottom: 20px;
          font-size: 13px; color: #94A3B8; line-height: 1.6; text-align: center;
        }
        .ob-download-btn {
          display: flex; align-items: center; gap: 12px;
          background: linear-gradient(135deg, rgba(34,211,238,0.12), rgba(124,92,255,0.1));
          border: 1px solid rgba(34,211,238,0.35);
          border-radius: 12px; padding: 16px 20px;
          text-decoration: none; color: #22D3EE;
          font-size: 14px; font-weight: 700;
          transition: all 0.15s; margin-bottom: 10px;
        }
        .ob-download-btn:hover { border-color: #22D3EE; transform: translateY(-1px); }
        .ob-download-btn-sub { font-size: 12px; color: #475569; font-weight: 400; margin-top: 2px; }
        .ob-done { text-align: center; padding: 32px 0; }
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes checkPop { 0%{transform:scale(0)} 70%{transform:scale(1.2)} 100%{transform:scale(1)} }
        @media (max-width: 560px) {
          .ob-card { padding: 24px 20px; }
          .ob-platform-tabs { flex-direction: column; }
          .ob-heading { font-size: 19px; }
        }
      `}</style>

      <div className="ob-root">

        {/* Progress bar */}
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

          {/* ── STEP 1: Video + Platform + CSV ── */}
          {step === 1 && (
            <>
              <div className="ob-eyebrow">Step 1 · Import your history</div>
              <div className="ob-heading">Let&apos;s get your stats loaded 💰</div>
              <div className="ob-sub">Watch the short video, then export your CSV and upload it below. Your full dashboard unlocks instantly.</div>

              {/* YouTube tutorial */}
              <div className="ob-video-wrap">
                <div className="ob-video-header">
                  <div className="ob-video-icon">▶</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>How to upload your CSV</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>Watch first — takes 2 minutes</div>
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
                    <span
                      className="ob-step-num"
                      style={{ background: `${platform.color}20`, border: `1px solid ${platform.color}40`, color: platform.color }}
                    >{i + 1}</span>
                    <span style={{ fontWeight: i === platform.steps.length - 1 ? 600 : 400, color: i === platform.steps.length - 1 ? '#F1F5F9' : '#94A3B8' }}>{s}</span>
                  </li>
                ))}
              </ul>

              {/* Platform tip */}
              <div
                className="ob-plat-tip"
                style={{
                  '--pt-bg': `${platform.color}0d`,
                  '--pt-border': `${platform.color}25`,
                  '--pt-color': platform.color,
                }}
              >
                💡 {platform.tip}
              </div>

              {/* Upload zone */}
              {!uploadDone ? (
                <>
                  <div
                    className={`ob-upload-zone${dragOver ? ' drag' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                    onClick={() => fileRef.current?.click()}
                  >
                    <input
                      ref={fileRef}
                      type="file" accept=".csv,.txt"
                      style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files[0]; if (f) handleFile(f) }}
                    />
                    {uploading ? (
                      <>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid rgba(34,211,238,0.2)', borderTopColor: '#22D3EE', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
                        <div style={{ fontSize: 14, color: '#22D3EE', fontWeight: 600 }}>Processing your file…</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>Drop your CSV here</div>
                        <div style={{ fontSize: 13, color: '#475569' }}>or click to browse · .csv files only</div>
                      </>
                    )}
                  </div>
                  {uploadError && <div className="ob-error">⚠️ {uploadError}</div>}
                </>
              ) : (
                <div className="ob-success-msg">✓ CSV uploaded! Moving to next step…</div>
              )}

              <div className="ob-divider" />
              <button className="ob-btn-ghost" onClick={() => setShowSkipConfirm(true)}>
                Skip — I&apos;ll import later
              </button>
            </>
          )}

          {/* ── STEP 2: Live Mode demo ── */}
          {step === 2 && (
            <>
              <div className="ob-eyebrow">Step 2 · Live mode</div>
              <div className="ob-heading">This is your dashboard during a stream</div>
              <div className="ob-sub">Real-time tips, session earnings, and $/hr pace — all updating live as your stream runs.</div>

              <LiveModeDemo />

              <div style={{ marginTop: 20, marginBottom: 20 }}>
                <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
                  <span style={{ fontSize: 20 }}>🔴</span>
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

              <a href="/camcash-extension.zip" download="camcash-extension.zip" className="ob-download-btn">
                <span style={{ fontSize: 22 }}>⬇️</span>
                <div>
                  <div>Download CamCash Extension</div>
                  <div className="ob-download-btn-sub">Free · camcash-extension.zip</div>
                </div>
              </a>

              <div className="ob-divider" />

              <div style={{ fontSize: 13, color: '#475569', marginBottom: 14, lineHeight: 1.6 }}>Monitor your streams from anywhere:</div>

              <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
                <span style={{ fontSize: 20 }}>🔴</span>
                <div>
                  <div>Live Mode</div>
                  <div className="ob-link-card-sub">Your private real-time stream view</div>
                </div>
              </a>

              <a href="/live" target="_blank" rel="noopener noreferrer" className="ob-link-card">
                <span style={{ fontSize: 20 }}>🌐</span>
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
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>⚠️</span>
                <div className="ob-warning-text">
                  <strong>Your dashboard will be empty until your first stream or CSV import.</strong><br /><br />
                  To see your historical earnings, top tippers, and trends right away — import a CSV. You can find the <strong>CSV Importer</strong> in the side navigation anytime.
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
              <div style={{ fontSize: 52, marginBottom: 16, animation: 'checkPop 0.5s ease both' }}>🎉</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#F1F5F9', marginBottom: 8 }}>You&apos;re all set!</div>
              <div style={{ fontSize: 14, color: '#475569' }}>Taking you to your dashboard…</div>
            </div>
          )}

        </div>
      </div>

      {/* Skip confirm modal */}
      {showSkipConfirm && (
        <div className="ob-modal-backdrop" onClick={() => setShowSkipConfirm(false)}>
          <div className="ob-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9', marginBottom: 8 }}>Skip importing your data?</div>
            <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, marginBottom: 24 }}>
              Without a CSV we can&apos;t import your historical tips. Your earnings history, top tippers, and trends won&apos;t show until you upload one.
              <br /><br />
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

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { track } from '../../../lib/track'

export default function ChaturbateOnboardingPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [step, setStep] = useState(1) // 1 = Stats, 2 = Tips (CSV), 3 = Done
  const [broadcasterType, setBroadcasterType] = useState('female')
  const [username, setUsername] = useState('')
  const [statsToken, setStatsToken] = useState('')
  const [tokenHelpOpen, setTokenHelpOpen] = useState(false)
  const [subStep, setSubStep] = useState(1) // 1=broadcaster type, 2=username, 3=token
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    // onAuthStateChange fires first if there's a session in the URL hash (magic link / PKCE)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        setAuthLoading(false)
      }
    })
    // Fallback: read existing cookie-based session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user)
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Auto-extract token from a pasted URL like chaturbate.com/statsapi/?username=...&token=abc
  function parseTokenInput(raw) {
    const trimmed = raw.trim()
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : 'https://' + trimmed)
      const t = url.searchParams.get('token')
      const u = url.searchParams.get('username')
      if (t) {
        setStatsToken(t)
        if (u && !username) setUsername(u)
        return
      }
    } catch {}
    setStatsToken(trimmed)
  }

  function validateStep1() {
    const errs = {}
    if (!username.trim()) errs.username = 'Enter your Chaturbate username first.'
    if (!statsToken.trim()) {
      errs.statsToken = 'Paste your Stats API token to continue, or upload a CSV instead.'
    } else if (statsToken.trim().startsWith('{') || statsToken.includes('"token_balance"')) {
      errs.statsToken = 'That looks like the JSON page, not the token. Copy the token from the browser URL or Stats API token field.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleConnect() {
    if (!validateStep1()) return
    setLoading(true)
    try {
      track('onboarding_connect_clicked', { broadcaster_type: broadcasterType })

      const res = await fetch('/api/onboarding/save-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chaturbate_username: username.trim(),
          chaturbate_stats_token: statsToken.trim(),
          broadcaster_type: broadcasterType,
        }),
      })

      const result = await res.json()
      if (res.status === 401) {
        setErrors({ submit: 'Session expired — please refresh and try again.' })
        return
      }
      if (!res.ok) throw new Error(result.error || 'Failed to save profile')

      track('onboarding_connect_success')

      // Trigger initial stats sync
      fetch('/api/chaturbate/stats-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      }).catch(() => {}) // fire-and-forget

      setStep(2)
    } catch (err) {
      track('onboarding_connect_error', { error: err.message })
      setErrors({ submit: err.message || 'Something went wrong. Try again.' })
    } finally {
      setLoading(false)
    }
  }

  function handleSkipToCSV() {
    track('onboarding_skip_to_csv')
    router.push('/dashboard?onboarding=csv')
  }

  function handleSkipToken() {
    track('onboarding_skip_token')
    router.push('/dashboard?onboarding=skipped')
  }

  function handleFinish() {
    track('onboarding_finish')
    setStep(3)
    setTimeout(() => router.push('/dashboard'), 1200)
  }

  const BROADCASTER_TYPES = [
    { value: 'female', label: 'Female' },
    { value: 'male', label: 'Male' },
    { value: 'trans', label: 'Trans' },
    { value: 'couple', label: 'Couple' },
  ]

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#080b14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #1e2536', borderTopColor: '#00d4c8', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ob-root {
          min-height: 100vh;
          background: #080b14;
          background-image:
            radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,210,200,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 40% 30% at 80% 80%, rgba(160,80,255,0.07) 0%, transparent 60%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 32px 16px 64px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* ── Progress bar ── */
        .ob-progress {
          display: flex;
          align-items: center;
          gap: 0;
          margin-bottom: 28px;
        }
        .ob-step-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.03em;
          color: #5a6480;
          background: transparent;
          transition: all 0.2s;
        }
        .ob-step-pill.active {
          color: #00d4c8;
          background: rgba(0,212,200,0.1);
        }
        .ob-step-pill.done {
          color: #2ec77a;
          background: rgba(46,199,122,0.1);
        }
        .ob-step-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }
        .ob-step-line {
          width: 32px;
          height: 1px;
          background: #1e2536;
        }

        /* ── Card ── */
        .ob-card {
          width: 100%;
          max-width: 520px;
          background: #0d1120;
          border: 1px solid #1a2035;
          border-radius: 20px;
          padding: 32px 36px;
          box-shadow:
            0 0 0 1px rgba(0,212,200,0.04),
            0 24px 64px rgba(0,0,0,0.5);
        }

        /* ── Header ── */
        .ob-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #00d4c8;
          margin-bottom: 6px;
        }
        .ob-heading {
          font-size: 22px;
          font-weight: 700;
          color: #eef2ff;
          line-height: 1.2;
          margin-bottom: 20px;
        }

        /* ── Broadcaster type ── */
        .ob-section-label {
          font-size: 12px;
          font-weight: 600;
          color: #4a5568;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .ob-type-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 24px;
        }
        .ob-type-btn {
          padding: 7px 18px;
          border-radius: 20px;
          border: 1px solid #1e2a40;
          background: #0a0e1a;
          color: #6b7a9e;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        .ob-type-btn:hover {
          border-color: #00d4c8;
          color: #00d4c8;
        }
        .ob-type-btn.selected {
          border-color: #00d4c8;
          background: rgba(0,212,200,0.1);
          color: #00d4c8;
          box-shadow: 0 0 0 1px rgba(0,212,200,0.3);
        }

        /* ── Form fields ── */
        .ob-field {
          margin-bottom: 20px;
        }
        .ob-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #c8d0e8;
          margin-bottom: 7px;
        }
        .ob-input {
          width: 100%;
          padding: 11px 14px;
          background: #080b14;
          border: 1px solid #1e2a40;
          border-radius: 10px;
          color: #eef2ff;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          font-family: inherit;
        }
        .ob-input::placeholder { color: #3a4460; }
        .ob-input:focus {
          border-color: #00d4c8;
          box-shadow: 0 0 0 3px rgba(0,212,200,0.1);
        }
        .ob-input.error { border-color: #e05252; }
        .ob-helper {
          font-size: 12px;
          color: #4a5568;
          margin-top: 5px;
          line-height: 1.5;
        }
        .ob-error-msg {
          font-size: 12px;
          color: #e05252;
          margin-top: 5px;
        }

        /* ── Token help ── */
        .ob-help-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          color: #00d4c8;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          margin-bottom: 16px;
          transition: opacity 0.15s;
        }
        .ob-help-toggle:hover { opacity: 0.8; }
        .ob-help-chevron {
          font-size: 10px;
          transition: transform 0.2s;
        }
        .ob-help-chevron.open { transform: rotate(90deg); }

        .ob-help-body {
          background: #060912;
          border: 1px solid #141928;
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 16px;
        }
        .ob-help-list {
          list-style: none;
          margin-bottom: 10px;
        }
        .ob-help-list li {
          display: flex;
          gap: 8px;
          align-items: baseline;
          font-size: 12px;
          color: #6b7a9e;
          line-height: 1.6;
        }
        .ob-help-list li + li { margin-top: 2px; }
        .ob-help-num {
          flex-shrink: 0;
          font-size: 10px;
          font-weight: 700;
          color: #00d4c8;
          width: 14px;
          text-align: right;
        }
        .ob-help-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          color: #00d4c8;
          text-decoration: none;
          opacity: 0.85;
          transition: opacity 0.15s;
        }
        .ob-help-link:hover { opacity: 1; }

        /* ── CTA ── */
        .ob-submit-error {
          font-size: 12px;
          color: #e05252;
          margin-bottom: 10px;
          text-align: center;
        }
        .ob-btn-primary {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #00d4c8, #a050ff);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: opacity 0.15s, transform 0.1s;
          margin-bottom: 10px;
        }
        .ob-btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .ob-btn-primary:active:not(:disabled) { transform: translateY(0); }
        .ob-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .ob-lock-text {
          text-align: center;
          font-size: 11px;
          color: #3a4460;
          margin-bottom: 18px;
        }
        .ob-secondary-links {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
        }
        .ob-link-btn {
          background: none;
          border: none;
          color: #4a5568;
          font-size: 12px;
          cursor: pointer;
          padding: 0;
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: color 0.15s;
          font-family: inherit;
        }
        .ob-link-btn:hover { color: #6b7a9e; }

        /* ── Step 2: Tips / CSV ── */
        .ob-step2 { text-align: center; padding: 20px 0; }
        .ob-success-icon {
          width: 56px;
          height: 56px;
          background: rgba(46,199,122,0.15);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin: 0 auto 16px;
        }
        .ob-step2-heading {
          font-size: 20px;
          font-weight: 700;
          color: #eef2ff;
          margin-bottom: 8px;
        }
        .ob-step2-sub {
          font-size: 14px;
          color: #6b7a9e;
          line-height: 1.6;
          margin-bottom: 28px;
          max-width: 480px;
          margin-left: auto;
          margin-right: auto;
        }
        .ob-step2-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 20px;
        }
        .ob-option-card {
          background: #0d1120;
          border: 1px solid #1a2035;
          border-radius: 12px;
          padding: 18px;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .ob-option-card:hover {
          border-color: #00d4c8;
          box-shadow: 0 0 0 1px rgba(0,212,200,0.15);
        }
        .ob-option-icon { font-size: 20px; margin-bottom: 8px; }
        .ob-option-title {
          font-size: 13px;
          font-weight: 700;
          color: #c8d0e8;
          margin-bottom: 4px;
        }
        .ob-option-desc { font-size: 12px; color: #4a5568; line-height: 1.5; }

        .ob-btn-finish {
          width: 100%;
          padding: 13px;
          background: linear-gradient(135deg, #00d4c8, #a050ff);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .ob-btn-finish:hover { opacity: 0.9; }

        /* ── Step 3: Done ── */
        .ob-done {
          text-align: center;
          padding: 40px 0;
        }
        .ob-done-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .ob-done-heading {
          font-size: 22px;
          font-weight: 700;
          color: #eef2ff;
          margin-bottom: 8px;
        }
        .ob-done-sub { font-size: 14px; color: #6b7a9e; }

        /* ── Optional advanced section ── */
        .ob-optional-section {
          margin-top: 28px;
          padding-top: 20px;
          border-top: 1px solid #1a2035;
        }
        .ob-optional-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #3a4460;
          margin-bottom: 10px;
        }
        .ob-optional-hint {
          font-size: 12px;
          color: #4a5568;
          line-height: 1.5;
          margin-bottom: 8px;
        }

        /* ── Mobile ── */
        @media (max-width: 560px) {
          .ob-card { padding: 24px 20px; }
          .ob-step2-options { grid-template-columns: 1fr; }
          .ob-heading { font-size: 19px; }
        }
      `}</style>

      <div className="ob-root">
        {/* Progress pills */}
        <div className="ob-progress">
          {[
            { label: 'Stats', s: 1 },
            { label: 'Tips', s: 2 },
            { label: 'Done', s: 3 },
          ].map((p, i) => (
            <>
              <div
                key={p.s}
                className={`ob-step-pill ${step === p.s ? 'active' : step > p.s ? 'done' : ''}`}
              >
                <span className="ob-step-dot" />
                {p.label}
              </div>
              {i < 2 && <div className="ob-step-line" key={`line-${i}`} />}
            </>
          ))}
        </div>

        <div className="ob-card">
          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              {/* ── SUB-STEP 1a: Broadcaster type ── */}
              {subStep === 1 && (
                <>
                  <div className="ob-eyebrow">Step 1a of 3 · Connect Chaturbate</div>
                  <div className="ob-heading">Start tracking your streams</div>

                  <div className="ob-section-label">I broadcast as</div>
                  <div className="ob-type-grid">
                    {BROADCASTER_TYPES.map((t) => (
                      <button
                        key={t.value}
                        className={`ob-type-btn ${broadcasterType === t.value ? 'selected' : ''}`}
                        onClick={() => setBroadcasterType(t.value)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <button
                    className="ob-btn-primary"
                    onClick={() => setSubStep(2)}
                  >
                    Continue →
                  </button>
                </>
              )}

              {/* ── SUB-STEP 1b: Username ── */}
              {subStep === 2 && (
                <>
                  <div className="ob-eyebrow">Step 1b of 3 · Connect Chaturbate</div>
                  <div className="ob-heading">Your Chaturbate username</div>

                  <div className="ob-field">
                    <label className="ob-label">Chaturbate username</label>
                    <input
                      className={`ob-input ${errors.username ? 'error' : ''}`}
                      placeholder="your_username"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value)
                        if (errors.username) setErrors((p) => ({ ...p, username: null }))
                      }}
                      autoComplete="off"
                      spellCheck={false}
                      autoFocus
                    />
                    {errors.username && <div className="ob-error-msg">{errors.username}</div>}
                  </div>

                  <button
                    className="ob-btn-primary"
                    onClick={() => {
                      if (!username.trim()) {
                        setErrors((p) => ({ ...p, username: 'Enter your Chaturbate username first.' }))
                        return
                      }
                      setErrors((p) => ({ ...p, username: null }))
                      setSubStep(3)
                    }}
                  >
                    Continue →
                  </button>

                  <div className="ob-secondary-links" style={{ marginTop: 12 }}>
                    <button className="ob-link-btn" onClick={() => setSubStep(1)}>← Back</button>
                  </div>
                </>
              )}

              {/* ── SUB-STEP 1c: Stats API token ── */}
              {subStep === 3 && (
                <>
                  <div className="ob-eyebrow">Step 1c of 3 · Connect Chaturbate</div>
                  <div className="ob-heading">Your Stats API token</div>

                  <div className="ob-field">
                    <label className="ob-label">Stats API Token</label>
                    <input
                      className={`ob-input ${errors.statsToken ? 'error' : ''}`}
                      placeholder="Paste your Stats API token here"
                      value={statsToken}
                      onChange={(e) => {
                        parseTokenInput(e.target.value)
                        if (errors.statsToken) setErrors((p) => ({ ...p, statsToken: null }))
                      }}
                      autoComplete="off"
                      spellCheck={false}
                      autoFocus
                    />
                    {errors.statsToken && <div className="ob-error-msg">{errors.statsToken}</div>}
                  </div>

                  <button
                    className="ob-help-toggle"
                    onClick={() => setTokenHelpOpen((o) => !o)}
                  >
                    <span className={`ob-help-chevron ${tokenHelpOpen ? 'open' : ''}`}>▶</span>
                    How to find your Stats API token
                  </button>

                  {tokenHelpOpen && (
                    <div className="ob-help-body">
                      <ul className="ob-help-list">
                        <li><span className="ob-help-num">1.</span> Log in to Chaturbate with your broadcaster account.</li>
                        <li><span className="ob-help-num">2.</span> Go to <strong style={{color:'#c8d0e8'}}>chaturbate.com/statsapi/authtoken/</strong></li>
                        <li><span className="ob-help-num">3.</span> Find the <strong style={{color:'#c8d0e8'}}>Stats API</strong> section and click <strong style={{color:'#c8d0e8'}}>Generate Token</strong> if empty.</li>
                        <li><span className="ob-help-num">4.</span> Copy the token or the full URL and paste it above.</li>
                      </ul>
                      <a
                        href="https://chaturbate.com/statsapi/authtoken/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ob-help-link"
                      >
                        Open token page ↗
                      </a>
                    </div>
                  )}

                  {errors.submit && <div className="ob-submit-error">{errors.submit}</div>}

                  <button
                    className="ob-btn-primary"
                    onClick={handleConnect}
                    disabled={loading}
                  >
                    {loading ? 'Connecting…' : 'Connect Chaturbate →'}
                  </button>

                  <div className="ob-lock-text">🔒 Your token is stored securely and never shared.</div>

                  <div className="ob-secondary-links">
                    <button className="ob-link-btn" onClick={handleSkipToCSV}>
                      Upload CSV instead
                    </button>
                    <span style={{ color: '#1e2536' }}>·</span>
                    <button className="ob-link-btn" onClick={handleSkipToken}>
                      I'll connect my token later
                    </button>
                  </div>

                  <div className="ob-secondary-links" style={{ marginTop: 12 }}>
                    <button className="ob-link-btn" onClick={() => setSubStep(2)}>← Back</button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div className="ob-step2">
              <div className="ob-success-icon">✓</div>
              <div className="ob-step2-heading">Chaturbate connected!</div>
              <div className="ob-step2-sub">
                Your stats are syncing in the background. Want to import your full tip history too?
                A CSV upload fills in your older data immediately.
              </div>

              <div className="ob-step2-options">
                <div
                  className="ob-option-card"
                  onClick={() => router.push('/dashboard?onboarding=csv')}
                >
                  <div className="ob-option-icon">📂</div>
                  <div className="ob-option-title">Upload CSV</div>
                  <div className="ob-option-desc">
                    Import your full Chaturbate tip history right now. Takes under 2 minutes.
                  </div>
                </div>
                <div className="ob-option-card" onClick={handleFinish}>
                  <div className="ob-option-icon">📊</div>
                  <div className="ob-option-title">Go to dashboard</div>
                  <div className="ob-option-desc">
                    Skip for now. Your Stats API will pull data automatically over time.
                  </div>
                </div>
              </div>

              <button className="ob-btn-finish" onClick={handleFinish}>
                Go to my dashboard →
              </button>

              {/* Optional: Events API */}
              <div className="ob-optional-section">
                <div className="ob-optional-label">Optional · Advanced</div>
                <div className="ob-optional-hint">
                  Want real-time tip alerts while you stream? You can connect your Events API token
                  in Settings anytime — it's not required to use GlowMetrics.
                </div>
                <button
                  className="ob-link-btn"
                  onClick={() => router.push('/dashboard/settings?tab=tokens')}
                >
                  Set up live tip tracking later →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div className="ob-done">
              <div className="ob-done-icon">🎉</div>
              <div className="ob-done-heading">You're all set!</div>
              <div className="ob-done-sub">Taking you to your dashboard…</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

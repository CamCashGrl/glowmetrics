'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { track } from '../../../lib/track'

export default function ChaturbateOnboardingPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [step, setStep] = useState(1)
  const [broadcasterType, setBroadcasterType] = useState('female')
  const [username, setUsername] = useState('')
  const [statsToken, setStatsToken] = useState('')
  const [tokenHelpOpen, setTokenHelpOpen] = useState(false)
  const [subStep, setSubStep] = useState(1)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        setAuthLoading(false)
      }
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user)
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

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
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()

      if (userError || !currentUser) {
        setErrors({ submit: 'Please refresh the page and try again.' })
        setLoading(false)
        return
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          chaturbate_username: username.trim(),
          chaturbate_stats_token: statsToken.trim(),
          chaturbate_token_type: 'stats',
          broadcaster_type: broadcasterType,
        })
        .eq('id', currentUser.id)

      if (error) throw error
      setStep(2)
    } catch (err) {
      setErrors({ submit: err.message || 'Something went wrong. Try again.' })
    } finally {
      setLoading(false)
    }
  }

  function handleSkipToCSV() {
    router.push('/dashboard?onboarding=csv')
  }

  function handleSkipToken() {
    router.push('/dashboard?onboarding=skipped')
  }

  function handleFinish() {
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
        /* styles omitted for brevity — full styles in main onboarding page */
      `}</style>

      <div style={{ minHeight: '100vh', background: '#080b14', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: 520, background: '#0d1120', border: '1px solid #1a2035', borderRadius: 20, padding: '32px 36px' }}>
          {step === 1 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#00d4c8', marginBottom: 6 }}>Connect Chaturbate Stats API</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#eef2ff', marginBottom: 20 }}>Link your Chaturbate account</div>

              {subStep === 1 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5568', textTransform: 'uppercase', marginBottom: 10 }}>I broadcast as</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                    {BROADCASTER_TYPES.map(t => (
                      <button key={t.value} onClick={() => setBroadcasterType(t.value)} style={{
                        padding: '7px 18px', borderRadius: 20, border: `1px solid ${broadcasterType === t.value ? '#00d4c8' : '#1e2a40'}`,
                        background: broadcasterType === t.value ? 'rgba(0,212,200,0.1)' : '#0a0e1a',
                        color: broadcasterType === t.value ? '#00d4c8' : '#6b7a9e',
                        fontSize: 13, fontWeight: 500, cursor: 'pointer',
                      }}>{t.label}</button>
                    ))}
                  </div>
                  <button onClick={() => setSubStep(2)} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg,#00d4c8,#a050ff)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Continue →</button>
                </>
              )}

              {subStep === 2 && (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#c8d0e8', marginBottom: 7 }}>Chaturbate username</label>
                    <input
                      style={{ width: '100%', padding: '11px 14px', background: '#080b14', border: `1px solid ${errors.username ? '#e05252' : '#1e2a40'}`, borderRadius: 10, color: '#eef2ff', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                      placeholder="your_username"
                      value={username}
                      onChange={e => { setUsername(e.target.value); setErrors(p => ({ ...p, username: null })) }}
                      autoComplete="off"
                      autoFocus
                    />
                    {errors.username && <div style={{ fontSize: 12, color: '#e05252', marginTop: 5 }}>{errors.username}</div>}
                  </div>
                  <button onClick={() => { if (!username.trim()) { setErrors(p => ({ ...p, username: 'Enter your Chaturbate username first.' })); return; } setSubStep(3) }} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg,#00d4c8,#a050ff)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>Continue →</button>
                  <button onClick={() => setSubStep(1)} style={{ background: 'none', border: 'none', color: '#4a5568', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>← Back</button>
                </>
              )}

              {subStep === 3 && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#c8d0e8', marginBottom: 7 }}>Stats API Token</label>
                    <input
                      style={{ width: '100%', padding: '11px 14px', background: '#080b14', border: `1px solid ${errors.statsToken ? '#e05252' : '#1e2a40'}`, borderRadius: 10, color: '#eef2ff', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                      placeholder="Paste your Stats API token here"
                      value={statsToken}
                      onChange={e => { parseTokenInput(e.target.value); setErrors(p => ({ ...p, statsToken: null })) }}
                      autoComplete="off"
                      autoFocus
                    />
                    {errors.statsToken && <div style={{ fontSize: 12, color: '#e05252', marginTop: 5 }}>{errors.statsToken}</div>}
                  </div>

                  <button onClick={() => setTokenHelpOpen(o => !o)} style={{ background: 'none', border: 'none', color: '#00d4c8', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, transform: tokenHelpOpen ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▶</span>
                    How to find your Stats API token
                  </button>

                  {tokenHelpOpen && (
                    <div style={{ background: '#060912', border: '1px solid #141928', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 12, color: '#6b7a9e', lineHeight: 1.6 }}>
                      <ol style={{ paddingLeft: 16 }}>
                        <li>Log in to Chaturbate with your broadcaster account.</li>
                        <li>Go to <strong style={{ color: '#c8d0e8' }}>chaturbate.com/statsapi/authtoken/</strong></li>
                        <li>Find the Stats API section and click <strong style={{ color: '#c8d0e8' }}>Generate Token</strong> if empty.</li>
                        <li>Copy the token or full URL and paste it above.</li>
                      </ol>
                    </div>
                  )}

                  {errors.submit && <div style={{ fontSize: 12, color: '#e05252', marginBottom: 10, textAlign: 'center' }}>{errors.submit}</div>}

                  <button onClick={handleConnect} disabled={loading} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg,#00d4c8,#a050ff)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10, opacity: loading ? 0.5 : 1 }}>
                    {loading ? 'Connecting…' : 'Connect Chaturbate →'}
                  </button>
                  <div style={{ textAlign: 'center', fontSize: 11, color: '#3a4460', marginBottom: 16 }}>🔒 Your token is stored securely and never shared.</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
                    <button onClick={handleSkipToCSV} style={{ background: 'none', border: 'none', color: '#4a5568', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Upload CSV instead</button>
                    <button onClick={handleSkipToken} style={{ background: 'none', border: 'none', color: '#4a5568', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>I'll connect later</button>
                  </div>
                  <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <button onClick={() => setSubStep(2)} style={{ background: 'none', border: 'none', color: '#4a5568', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>← Back</button>
                  </div>
                </>
              )}
            </>
          )}

          {step === 2 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 56, height: 56, background: 'rgba(46,199,122,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 16px' }}>✓</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#eef2ff', marginBottom: 8 }}>Chaturbate connected!</div>
              <div style={{ fontSize: 14, color: '#6b7a9e', marginBottom: 28, lineHeight: 1.6 }}>Your stats are syncing in the background.</div>
              <button onClick={handleFinish} style={{ width: '100%', padding: 13, background: 'linear-gradient(135deg,#00d4c8,#a050ff)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Go to my dashboard →</button>
            </div>
          )}

          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#eef2ff', marginBottom: 8 }}>You're all set!</div>
              <div style={{ fontSize: 14, color: '#6b7a9e' }}>Taking you to your dashboard…</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

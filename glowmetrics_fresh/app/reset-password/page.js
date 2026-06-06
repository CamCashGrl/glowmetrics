'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [password, setPassword]         = useState('')
  const [confirm, setConfirm]           = useState('')
  const [loading, setLoading]           = useState(false)
  const [success, setSuccess]           = useState(false)
  const [error, setError]               = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [expired, setExpired]           = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })

    // If no recovery event fires within 1.5 s, check session; mark expired if absent
    const timer = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) setExpired(true)
        else setSessionReady(true)
      })
    }, 1500)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError("Passwords don't match")
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      setError(err.message)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 2000)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.09)',
    color: 'white',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'border-color 0.15s',
    marginBottom: 12,
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#05070f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'DM Sans', 'Inter', sans-serif",
    }}>
      {/* Ambient background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 600, height: 600, top: '-10%', right: '-5%', background: 'radial-gradient(circle,rgba(124,92,255,0.08),transparent 65%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, bottom: '5%', left: '-10%', background: 'radial-gradient(circle,rgba(236,72,153,0.07),transparent 65%)', filter: 'blur(60px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg,#7C5CFF,#EC4899)',
            fontSize: 20, fontWeight: 900, color: 'white', marginBottom: 12,
            boxShadow: '0 0 24px rgba(124,92,255,0.35)',
          }}>$</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'white', letterSpacing: -0.4 }}>
            Cam<span style={{ background: 'linear-gradient(90deg,#7C5CFF,#EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Cash</span>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(10,14,26,0.92)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '36px 32px',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 0 0 1px rgba(124,92,255,0.06), 0 24px 60px rgba(0,0,0,0.6)',
        }}>
          {expired && !sessionReady ? (
            /* ── Expired state ── */
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⏰</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 12 }}>
                Reset link expired
              </div>
              <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.7, marginBottom: 24 }}>
                This reset link has expired. Request a new one.
              </div>
              <a href="/forgot-password" style={{
                display: 'inline-block',
                padding: '11px 28px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #7C5CFF, #EC4899)',
                color: 'white',
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
                boxShadow: '0 0 20px rgba(124,92,255,0.3)',
              }}>
                Request new link →
              </a>
            </div>
          ) : success ? (
            /* ── Success state ── */
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 12 }}>
                Password updated!
              </div>
              <div style={{ fontSize: 14, color: '#94a3b8' }}>
                Redirecting to your dashboard…
              </div>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'white', marginBottom: 8 }}>
                  Create New Password
                </div>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  Enter a new password for your account.
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <input
                  type="password"
                  placeholder="New password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(124,92,255,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0 }}
                  onFocus={e => e.target.style.borderColor = 'rgba(124,92,255,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
                />

                {error && (
                  <div style={{ fontSize: 12, color: '#f87171', marginTop: 10, marginBottom: 4 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !sessionReady}
                  style={{
                    width: '100%',
                    marginTop: 16,
                    padding: '13px 0',
                    borderRadius: 10,
                    background: (loading || !sessionReady)
                      ? 'rgba(124,92,255,0.2)'
                      : 'linear-gradient(135deg, #7C5CFF, #EC4899)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: 15,
                    border: 'none',
                    cursor: (loading || !sessionReady) ? 'not-allowed' : 'pointer',
                    boxShadow: (loading || !sessionReady) ? 'none' : '0 0 24px rgba(124,92,255,0.3)',
                    transition: 'all 0.2s',
                  }}
                >
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

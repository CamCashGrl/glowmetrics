'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://www.camcashgrl.com/reset-password',
    })
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setSuccess(true)
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
          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 12 }}>
                Check your email
              </div>
              <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.7 }}>
                We sent you a reset link. It may take a minute to arrive.
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'white', marginBottom: 8 }}>
                  Reset Your Password
                </div>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  Enter your email and we'll send you a reset link.
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <input
                  type="email"
                  placeholder="Email address"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(124,92,255,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
                />

                {error && (
                  <div style={{ fontSize: 12, color: '#f87171', marginTop: 8, marginBottom: 4 }}>
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  style={{ width: '100%', marginTop: 16, padding: '13px 0' }}
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </Button>
              </form>
            </>
          )}
        </div>

        {/* Back link */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a href="/login" style={{ fontSize: 13, color: '#475569', textDecoration: 'none' }}>
            ← Back to login
          </a>
        </div>
      </div>
    </div>
  )
}

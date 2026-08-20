'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'

// Standalone page behind the "Submit a Feature Request" link in the landing
// footer. It reuses the exact same feedback pipeline as the site-wide
// FeedbackWidget and the dashboard feedback modal: persist to Supabase first
// (so it always shows up in /admin even if the email fails), then fire the
// notification email — never blocking the "thanks" confirmation on either one.
export default function FeatureRequestPage() {
  const [type, setType] = useState('feature')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const CYAN = '#22D3EE'
  const PINK = '#EC4899'

  const TYPES = [
    { id: 'feature', label: '✨ Feature Request', color: CYAN },
    { id: 'bug', label: '🐛 Bug Report', color: '#f87171' },
  ]

  async function handleSubmit(e) {
    e.preventDefault()
    if (!message.trim() || submitting) return
    setSubmitting(true)

    const typeLabel = type === 'feature' ? 'Feature Request' : 'Bug Report'
    const contact = email.trim() ? `\n\nReply to: ${email.trim()}` : ''

    let userId = null
    try {
      const { data } = await supabase.auth.getUser()
      userId = data?.user?.id ?? null
    } catch (_) {}

    const payload = {
      message: `[${typeLabel}] ${message.trim()}${contact}`,
      page_url: typeof window !== 'undefined' ? window.location.href : '',
      page_title: typeof document !== 'undefined' ? document.title : '',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      user_id: userId,
      created_at: new Date().toISOString(),
    }

    try { await supabase.from('feedback').insert([payload]) } catch (_) {}

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (_) {}

    try {
      await supabase.from('analytics_events').insert([{
        event_name: 'feedback_submitted',
        properties: { type, source: 'feature_request_page', message_length: message.trim().length },
        user_id: userId,
      }])
    } catch (_) {}

    setSubmitting(false)
    setSubmitted(true)
  }

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: '#f1f5f9',
    fontSize: 14,
    padding: '12px 14px',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle = {
    fontSize: 12,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: 6,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#05070f', fontFamily: "'Inter', sans-serif", color: '#f1f5f9' }}>
      {/* Ambient glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 600, height: 600, top: '-10%', right: '-5%', background: 'radial-gradient(circle,rgba(34,211,238,0.09),transparent 65%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, bottom: '10%', left: '-10%', background: 'radial-gradient(circle,rgba(236,72,153,0.07),transparent 65%)', filter: 'blur(60px)' }} />
      </div>

      {/* Nav */}
      <nav style={{ position: 'relative', zIndex: 10, padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg,${CYAN},${PINK})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: 'white' }}>$</div>
          <span style={{ fontSize: 17, fontWeight: 800, color: 'white', letterSpacing: -0.4 }}>Cam<span style={{ background: `linear-gradient(90deg,${CYAN},${PINK})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Cash</span></span>
        </a>
        <a href="/landing" style={{ fontSize: 13, color: '#475569', textDecoration: 'none' }}>← Back</a>
      </nav>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 600, margin: '0 auto', padding: '64px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: '#f1f5f9', marginBottom: 12, lineHeight: 1.2 }}>
            Tell Us What To Build
          </h1>
          <p style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.7, maxWidth: 440, margin: '0 auto' }}>
            CamCash gets better because creators ask for things. Tell us what would make it more useful — or what&apos;s broken — and it goes straight to the team.
          </p>
        </div>

        <div style={{ background: 'rgba(15,20,32,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '32px 28px' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🙏</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>Thank you!</div>
              <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>
                Your {type === 'feature' ? 'feature request' : 'bug report'} is in. We read every single one.
              </div>
              <Button as="a" href="/landing" style={{ padding: '11px 26px', fontSize: 14 }}>Back to CamCash</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {TYPES.map(({ id, label, color }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setType(id)}
                    style={{
                      flex: 1, padding: '11px 12px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                      background: type === id ? `${color}20` : 'rgba(255,255,255,0.04)',
                      border: type === id ? `1px solid ${color}50` : '1px solid rgba(255,255,255,0.08)',
                      color: type === id ? color : '#94a3b8',
                    }}
                  >{label}</button>
                ))}
              </div>

              <div>
                <label style={labelStyle}>
                  {type === 'feature' ? 'Your idea' : "What's broken"}
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={type === 'feature'
                    ? 'e.g. I wish I could see my earnings by day of week…'
                    : 'e.g. When I upload a CSV from Chaturbate, it shows an error…'}
                  style={{ ...inputStyle, minHeight: 140, resize: 'vertical', lineHeight: 1.6 }}
                  onFocus={e => e.target.style.borderColor = 'rgba(34,211,238,0.4)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              <div>
                <label style={labelStyle}>Email <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600, color: '#475569' }}>(optional — so we can follow up)</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(34,211,238,0.4)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              <Button type="submit" disabled={!message.trim() || submitting} style={{ width: '100%', padding: '13px 0' }}>
                {submitting ? 'Sending…' : type === 'feature' ? '✨ Submit Feature Request' : '🐛 Submit Bug Report'}
              </Button>

              <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', lineHeight: 1.6 }}>
                Need help with something instead? <a href="/contact" style={{ color: '#7C5CFF', textDecoration: 'none' }}>Contact us</a>.
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

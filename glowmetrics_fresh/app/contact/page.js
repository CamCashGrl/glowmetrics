'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'

export default function ContactPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError('Please fill in all fields.')
      return
    }
    setError('')
    setSubmitting(true)

    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, created_at: new Date().toISOString() }),
      })
      setSubmitted(true)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function goToHelp() {
    const { data } = await supabase.auth.getUser()
    if (data?.user) {
      router.push('/dashboard?tab=help')
    } else {
      router.push('/landing')
    }
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

  return (
    <div style={{ minHeight: '100vh', background: '#05070f', fontFamily: "'Inter', sans-serif", color: '#f1f5f9' }}>
      {/* Ambient glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 600, height: 600, top: '-10%', right: '-5%', background: 'radial-gradient(circle,rgba(124,92,255,0.08),transparent 65%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, bottom: '10%', left: '-10%', background: 'radial-gradient(circle,rgba(236,72,153,0.07),transparent 65%)', filter: 'blur(60px)' }} />
      </div>

      {/* Nav */}
      <nav style={{ position: 'relative', zIndex: 10, padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#22D3EE,#EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: 'white' }}>$</div>
          <span style={{ fontSize: 17, fontWeight: 800, color: 'white', letterSpacing: -0.4 }}>Cam<span style={{ background: 'linear-gradient(90deg,#22D3EE,#EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Cash</span></span>
        </a>
        <a href="/landing" style={{ fontSize: 13, color: '#475569', textDecoration: 'none' }}>← Back</a>
      </nav>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 600, margin: '0 auto', padding: '64px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: '#f1f5f9', marginBottom: 12, lineHeight: 1.2 }}>
            Get In Touch
          </h1>
          <p style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.7, maxWidth: 440, margin: '0 auto' }}>
            Have a question, need help, or want to talk? Send us a message and a real person will respond.
          </p>
        </div>

        <div style={{ background: 'rgba(15,20,32,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '32px 28px' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>Message sent!</div>
              <div style={{ fontSize: 14, color: '#94a3b8' }}>We'll get back to you soon.</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Name</label>
                <input type="text" value={form.name} onChange={set('name')} placeholder="Your name" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Email</label>
                <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Message</label>
                <textarea value={form.message} onChange={set('message')} placeholder="How can we help?" style={{ ...inputStyle, minHeight: 130, resize: 'vertical' }} />
              </div>
              {error && <div style={{ fontSize: 13, color: '#f87171' }}>{error}</div>}
              <Button type="submit" disabled={submitting} style={{ width: '100%', padding: '13px 0' }}>
                {submitting ? 'Sending…' : 'Send Message'}
              </Button>
            </form>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button onClick={goToHelp} style={{ background: 'none', border: 'none', color: '#7C5CFF', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
            Need help with your CSV upload?
          </button>
        </div>
      </div>
    </div>
  )
}

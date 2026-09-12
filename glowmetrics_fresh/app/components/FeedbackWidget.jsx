'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!message.trim()) return
    setSubmitting(true)

    const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
    const pageTitle = typeof window !== 'undefined' ? document.title : ''
    const userAgent = typeof window !== 'undefined' ? navigator.userAgent : ''
    const referrer = typeof window !== 'undefined' ? document.referrer : ''
    const createdAt = new Date().toISOString()

    let userId = null
    try {
      const { data } = await supabase.auth.getUser()
      userId = data?.user?.id ?? null
    } catch (_) {}

    const payload = {
      message: message.trim(),
      page_url: pageUrl,
      page_title: pageTitle,
      user_agent: userAgent,
      referrer,
      user_id: userId,
      created_at: createdAt,
    }

    try {
      await supabase.from('feedback').insert([payload])
    } catch (_) {}

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
        properties: { page_url: pageUrl, message_length: message.trim().length },
        user_id: userId,
      }])
    } catch (_) {}

    setSubmitting(false)
    setSubmitted(true)
  }

  function openPanel() {
    setOpen(true)
  }

  function closePanel() {
    setOpen(false)
    setTimeout(() => {
      setSubmitted(false)
      setMessage('')
    }, 300)
  }

  return (
    <>
      {/* Floating icon button — kept small and low z-index so it never sits on
          top of card content or chart tooltips; the slide-out panel below is
          the only part that intentionally goes to a high z-index. */}
      <button
        onClick={openPanel}
        title="Send feedback"
        aria-label="Send feedback"
        style={{
          position: 'fixed',
          bottom: 'max(18px, env(safe-area-inset-bottom))',
          right: 'max(18px, env(safe-area-inset-right))',
          zIndex: 30,
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: 'rgba(15,20,32,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: '#94a3b8',
          fontSize: 16,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(124,92,255,0.4)'
          e.currentTarget.style.color = '#f1f5f9'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
          e.currentTarget.style.color = '#94a3b8'
        }}
      >
        💬
      </button>

      {/* Overlay + panel */}
      {open && (
        <>
          <div
            onClick={closePanel}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 9998,
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              maxWidth: 400,
              background: '#0f1420',
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              animation: 'fw-slide 0.3s ease both',
              fontFamily: 'inherit',
            }}
          >
            <style>{`
              @keyframes fw-slide { from { transform: translateX(100%); } to { transform: translateX(0); } }
            `}</style>

            {/* Header */}
            <div style={{ padding: '24px 24px 0', position: 'relative' }}>
              <button
                onClick={closePanel}
                style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: '#475569', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
              >✕</button>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>
                Help us improve CamCash
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.65 }}>
                Found something confusing? Have an idea? Ran into a bug? Tell us anything.
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {submitted ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16 }}>
                  <div style={{ fontSize: 40 }}>💜</div>
                  <div style={{ fontSize: 15, color: '#f1f5f9', fontWeight: 700, lineHeight: 1.6 }}>
                    Thanks! Every message is read by a real person and helps improve CamCash.
                  </div>
                </div>
              ) : (
                <>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="What's on your mind?"
                    style={{
                      width: '100%',
                      minHeight: 120,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      color: '#f1f5f9',
                      fontSize: 14,
                      padding: '12px 14px',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !message.trim()}
                    style={{
                      width: '100%',
                      padding: '13px 0',
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #7C5CFF, #EC4899)',
                      border: 'none',
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: submitting || !message.trim() ? 'not-allowed' : 'pointer',
                      opacity: submitting || !message.trim() ? 0.6 : 1,
                      fontFamily: 'inherit',
                      transition: 'opacity 0.2s ease',
                    }}
                  >
                    {submitting ? 'Sending…' : 'Send Feedback'}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

"use client"
import { useState } from 'react'
import { C } from './theme'
import { InlineSpinner } from './ui'
import { TEXT_LIMITS } from '../../lib/collab/constants'
import { validateInterestInput } from '../../lib/collab/validation'
import { createInterest, friendlyErrorMessage } from './data'

export default function ExpressInterestModal({ post, userId, onClose, onSubmitted }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const { valid, errors, data } = validateInterestInput({ introductionMessage: message })
    if (!valid) { setError(errors.introductionMessage); return }

    setSubmitting(true)
    try {
      const interest = await createInterest(post.id, userId, data.introduction_message)
      setSuccess(true)
      setTimeout(() => onSubmitted?.(interest), 800)
    } catch (err) {
      setError(friendlyErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 650, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 440, background: '#0b0f1c', border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ height: 4, background: 'linear-gradient(90deg,#22D3EE,#a855f7,#EC4899)' }} />
        <div style={{ padding: 24 }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🤝</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 6 }}>Interest sent!</div>
              <p style={{ color: C.text, fontSize: 12.5 }}>The creator has been notified inside CamCash.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: C.white, margin: 0 }}>I'm Interested</h3>
                <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>
              <p style={{ fontSize: 12.5, color: C.text, marginBottom: 12 }}>
                Sending interest on <strong style={{ color: C.white }}>{post.title}</strong>. Add a short intro so they know why you're a good fit.
              </p>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={TEXT_LIMITS.introductionMessage.max}
                placeholder="Optional: introduce yourself…"
                style={{ width: '100%', minHeight: 90, padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: C.white, fontSize: 13, resize: 'vertical', outline: 'none' }}
              />
              {error && <div style={{ fontSize: 11.5, color: C.red, marginTop: 6 }}>{error}</div>}
              <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
                Your email address is never shared. CamCash does not verify arrangements between creators.
              </div>
              <button type="submit" disabled={submitting} style={{
                width: '100%', marginTop: 16, padding: '12px', borderRadius: 12, border: 'none', cursor: submitting ? 'wait' : 'pointer',
                background: submitting ? 'rgba(255,255,255,0.08)' : 'linear-gradient(90deg,#22D3EE,#a855f7)',
                color: submitting ? C.muted : '#05070f', fontWeight: 800, fontSize: 13.5,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {submitting ? (<><InlineSpinner /> Sending…</>) : 'Send Interest'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

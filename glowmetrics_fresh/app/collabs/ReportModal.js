"use client"
import { useState } from 'react'
import { C } from './theme'
import { InlineSpinner } from './ui'
import { REPORT_REASONS, TEXT_LIMITS } from '../../lib/collab/constants'
import { validateReportInput } from '../../lib/collab/validation'
import { createReport, friendlyErrorMessage } from './data'

export default function ReportModal({ collabPostId, reportedUserId, label = 'Report', onClose, onSubmitted }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError('')
    const { valid, errors: validationErrors, data } = validateReportInput({ reason, details, collabPostId, reportedUserId })
    setErrors(validationErrors)
    if (!valid) return

    setSubmitting(true)
    try {
      await createReport(data)
      setSuccess(true)
      setTimeout(() => onSubmitted?.(), 900)
    } catch (err) {
      setServerError(friendlyErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 420, background: '#0b0f1c', border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ height: 4, background: C.red }} />
        <div style={{ padding: 24 }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginBottom: 6 }}>Report submitted</div>
              <p style={{ color: C.text, fontSize: 12.5 }}>Thanks for helping keep the community safe. Our team will review this.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ fontSize: 15.5, fontWeight: 800, color: C.white, margin: 0 }}>{label}</h3>
                <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6, display: 'block' }}>Reason</label>
              <select value={reason} onChange={e => setReason(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: C.white, fontSize: 13, marginBottom: 6 }}>
                <option value="">Select a reason…</option>
                {REPORT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {errors.reason && <div style={{ fontSize: 11.5, color: C.red, marginBottom: 10 }}>{errors.reason}</div>}

              <label style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6, display: 'block' }}>Details (optional)</label>
              <textarea
                value={details}
                onChange={e => setDetails(e.target.value)}
                maxLength={TEXT_LIMITS.reportDetails.max}
                style={{ width: '100%', minHeight: 80, padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: C.white, fontSize: 13, resize: 'vertical', outline: 'none' }}
              />
              {errors.details && <div style={{ fontSize: 11.5, color: C.red, marginTop: 6 }}>{errors.details}</div>}
              {serverError && <div style={{ fontSize: 11.5, color: C.red, marginTop: 10 }}>{serverError}</div>}

              <button type="submit" disabled={submitting} style={{
                width: '100%', marginTop: 16, padding: '12px', borderRadius: 12, border: 'none', cursor: submitting ? 'wait' : 'pointer',
                background: submitting ? 'rgba(255,255,255,0.08)' : C.red, color: submitting ? C.muted : '#1a0505', fontWeight: 800, fontSize: 13.5,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {submitting ? (<><InlineSpinner /> Submitting…</>) : 'Submit Report'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

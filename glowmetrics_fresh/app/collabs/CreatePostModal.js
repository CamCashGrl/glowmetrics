"use client"
import { useState } from 'react'
import { C } from './theme'
import { InlineSpinner } from './ui'
import {
  COLLAB_TYPES, PLATFORMS, PARTICIPATION_MODES, EXPERIENCE_LEVELS, TEXT_LIMITS,
} from '../../lib/collab/constants'
import { validateCollabPostInput } from '../../lib/collab/validation'
import { createPost, updatePost, friendlyErrorMessage } from './data'

const fieldStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`,
  background: 'rgba(255,255,255,0.03)', color: C.white, fontSize: 13.5, outline: 'none',
}
const labelStyle = { fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6, display: 'block' }
const errStyle = { fontSize: 11.5, color: C.red, marginTop: 4 }

function Field({ label, required, error, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}{required && <span style={{ color: C.pink }}> *</span>}</label>
      {children}
      {error && <div style={errStyle}>{error}</div>}
    </div>
  )
}

const initialForm = {
  title: '', description: '', collabType: '', platforms: [], participationMode: 'either',
  proposedDate: '', dateIsFlexible: true, creatorNiche: '', experiencePreference: 'any',
  goals: '', requirements: '', boundaries: '', city: '', stateOrRegion: '', ageRequirement: '',
  audienceSizePreference: '', tagsText: '', expiresAt: '', acknowledgedNoVerification: false,
}

function formFromPost(post) {
  return {
    title: post.title, description: post.description, collabType: post.collab_type,
    platforms: post.platforms || [], participationMode: post.participation_mode,
    proposedDate: post.proposed_date || '', dateIsFlexible: post.date_is_flexible,
    creatorNiche: post.creator_niche || '', experiencePreference: post.experience_preference || 'any',
    goals: post.goals || '', requirements: post.requirements || '', boundaries: post.boundaries || '',
    city: post.city || '', stateOrRegion: post.state_or_region || '', ageRequirement: post.age_requirement || '',
    audienceSizePreference: post.audience_size_preference || '', tagsText: (post.tags || []).join(', '),
    expiresAt: post.expires_at ? post.expires_at.slice(0, 10) : '', acknowledgedNoVerification: true,
  }
}

export default function CreatePostModal({ onClose, onCreated, post = null }) {
  const isEdit = !!post
  const [form, setForm] = useState(() => (post ? formFromPost(post) : initialForm))
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState('')

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function togglePlatform(value) {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(value) ? f.platforms.filter(p => p !== value) : [...f.platforms, value],
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError('')
    const tags = form.tagsText.split(',').map(t => t.trim()).filter(Boolean)
    const { valid, errors: validationErrors, data } = validateCollabPostInput({ ...form, tags })
    setErrors(validationErrors)
    if (!valid) return

    setSubmitting(true)
    try {
      const saved = isEdit ? await updatePost(post.id, data) : await createPost(data)
      setSuccess(true)
      setTimeout(() => onCreated?.(saved), 900)
    } catch (err) {
      setServerError(friendlyErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', overflowY: 'auto' }} onClick={onClose}>
      <div
        style={{ width: '100%', maxWidth: 640, background: '#0b0f1c', border: `1px solid ${C.border}`, borderRadius: 20, boxShadow: '0 0 60px rgba(34,211,238,0.12)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ height: 4, background: 'linear-gradient(90deg,#22D3EE,#a855f7,#EC4899)' }} />
        <div style={{ padding: '24px 28px 28px', maxHeight: '85vh', overflowY: 'auto' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.white, marginBottom: 6 }}>{isEdit ? 'Changes saved' : 'Your collab post is live'}</div>
              <p style={{ color: C.text, fontSize: 13 }}>{isEdit ? 'Your collaboration post has been updated.' : 'Other creators can now find and respond to it.'}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 19, fontWeight: 800, color: C.white, margin: 0 }}>{isEdit ? 'Edit Collaboration Post' : 'Post a Collaboration'}</h2>
                <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Field label="Post Title" required error={errors.title}>
                  <input style={fieldStyle} value={form.title} onChange={e => set('title', e.target.value)} maxLength={TEXT_LIMITS.title.max} placeholder="e.g. Looking for a duo stream partner this weekend" />
                </Field>

                <Field label="Collaboration Type" required error={errors.collabType}>
                  <select style={fieldStyle} value={form.collabType} onChange={e => set('collabType', e.target.value)}>
                    <option value="">Select a type…</option>
                    {COLLAB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>

                <Field label="Description" required error={errors.description}>
                  <textarea style={{ ...fieldStyle, minHeight: 100, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} maxLength={TEXT_LIMITS.description.max} placeholder="What are you planning, and what kind of creator are you looking for?" />
                </Field>

                <Field label="Platform(s)" required error={errors.platforms}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {PLATFORMS.map(p => {
                      const active = form.platforms.includes(p.value)
                      return (
                        <button type="button" key={p.value} onClick={() => togglePlatform(p.value)}
                          style={{
                            padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            border: `1px solid ${active ? C.cyan : C.border}`,
                            background: active ? 'rgba(34,211,238,0.14)' : 'rgba(255,255,255,0.03)',
                            color: active ? C.cyan : C.text,
                          }}>
                          {p.label}
                        </button>
                      )
                    })}
                  </div>
                </Field>

                <Field label="Online, In-Person, or Either" required error={errors.participationMode}>
                  <select style={fieldStyle} value={form.participationMode} onChange={e => set('participationMode', e.target.value)}>
                    {PARTICIPATION_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </Field>

                <Field label="Proposed Date" required error={errors.proposedDate}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.text, marginBottom: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.dateIsFlexible} onChange={e => set('dateIsFlexible', e.target.checked)} />
                    Date is flexible
                  </label>
                  {!form.dateIsFlexible && (
                    <input type="date" style={fieldStyle} value={form.proposedDate} onChange={e => set('proposedDate', e.target.value)} />
                  )}
                </Field>

                <Field label="Creator Niche or Category" required error={errors.creatorNiche}>
                  <input style={fieldStyle} value={form.creatorNiche} onChange={e => set('creatorNiche', e.target.value)} maxLength={TEXT_LIMITS.creatorNiche.max} placeholder="e.g. GFE, cosplay, fitness, alt" />
                </Field>

                <Field label="Experience Preference" required error={errors.experiencePreference}>
                  <select style={fieldStyle} value={form.experiencePreference} onChange={e => set('experiencePreference', e.target.value)}>
                    {EXPERIENCE_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </Field>

                <Field label="Collaboration Goals" required error={errors.goals}>
                  <textarea style={{ ...fieldStyle, minHeight: 70, resize: 'vertical' }} value={form.goals} onChange={e => set('goals', e.target.value)} maxLength={TEXT_LIMITS.goals.max} placeholder="What do you hope to get out of this collab?" />
                </Field>

                <Field label="Requirements or Boundaries" required error={errors.requirements || errors.boundaries}>
                  <textarea style={{ ...fieldStyle, minHeight: 70, resize: 'vertical', marginBottom: 8 }} value={form.requirements} onChange={e => set('requirements', e.target.value)} maxLength={TEXT_LIMITS.requirements.max} placeholder="Requirements (e.g. must have X followers, verified only)" />
                  <textarea style={{ ...fieldStyle, minHeight: 70, resize: 'vertical' }} value={form.boundaries} onChange={e => set('boundaries', e.target.value)} maxLength={TEXT_LIMITS.boundaries.max} placeholder="Boundaries (what's off the table)" />
                </Field>

                <div style={{ borderTop: `1px solid ${C.border}`, margin: '4px 0', paddingTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Optional</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <Field label="City"><input style={fieldStyle} value={form.city} onChange={e => set('city', e.target.value)} maxLength={TEXT_LIMITS.city.max} /></Field>
                      <Field label="State / Region"><input style={fieldStyle} value={form.stateOrRegion} onChange={e => set('stateOrRegion', e.target.value)} maxLength={TEXT_LIMITS.stateOrRegion.max} /></Field>
                    </div>
                    <Field label="Age Requirement (18+ only)" error={errors.ageRequirement}>
                      <input type="number" min={18} style={fieldStyle} value={form.ageRequirement} onChange={e => set('ageRequirement', e.target.value)} placeholder="18" />
                    </Field>
                    <Field label="Audience Size Preference">
                      <input style={fieldStyle} value={form.audienceSizePreference} onChange={e => set('audienceSizePreference', e.target.value)} maxLength={TEXT_LIMITS.audienceSizePreference.max} placeholder="e.g. similar size, no preference" />
                    </Field>
                    <Field label="Tags (comma-separated)" error={errors.tags}>
                      <input style={fieldStyle} value={form.tagsText} onChange={e => set('tagsText', e.target.value)} placeholder="cosplay, weekend, first-time" />
                    </Field>
                    <Field label="Expiration Date">
                      <input type="date" style={fieldStyle} value={form.expiresAt} onChange={e => set('expiresAt', e.target.value)} />
                    </Field>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, color: C.text, cursor: 'pointer', lineHeight: 1.5 }}>
                  <input type="checkbox" style={{ marginTop: 2 }} checked={form.acknowledgedNoVerification} onChange={e => set('acknowledgedNoVerification', e.target.checked)} />
                  I understand that CamCash does not verify arrangements, payments, travel plans, or agreements made between creators.
                </label>
                {errors.acknowledgedNoVerification && <div style={errStyle}>{errors.acknowledgedNoVerification}</div>}

                {serverError && <div style={{ ...errStyle, background: 'rgba(248,113,113,0.08)', padding: '10px 12px', borderRadius: 10 }}>{serverError}</div>}

                <button type="submit" disabled={submitting}
                  style={{
                    marginTop: 4, padding: '13px', borderRadius: 12, border: 'none', cursor: submitting ? 'wait' : 'pointer',
                    background: submitting ? 'rgba(255,255,255,0.08)' : 'linear-gradient(90deg,#22D3EE,#a855f7,#EC4899)',
                    color: submitting ? C.muted : '#05070f', fontWeight: 800, fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {submitting
                    ? (<><InlineSpinner /> {isEdit ? 'Saving…' : 'Publishing…'}</>)
                    : (isEdit ? 'Save Changes' : 'Publish Collaboration')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

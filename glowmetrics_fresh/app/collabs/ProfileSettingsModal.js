"use client"
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { C } from './theme'
import { InlineSpinner } from './ui'
import { PROFILE_EXPERIENCE_LEVELS, TEXT_LIMITS } from '../../lib/collab/constants'
import { sanitizeText } from '../../lib/collab/validation'

const fieldStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`,
  background: 'rgba(255,255,255,0.03)', color: C.white, fontSize: 13.5, outline: 'none',
}
const labelStyle = { fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6, display: 'block' }

const SOCIAL_KEYS = [
  { key: 'twitter', label: 'X / Twitter' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'website', label: 'Website / Linktree' },
]

// This is the only place CamCash currently lets a creator set the collab-facing
// profile fields added in supabase/migrations/20260716192202_create_collab_board.sql
// (display_name, avatar_url, bio, niche, region, experience, social links,
// collab_visible) — there is no pre-existing account/profile settings page to
// extend, so this stays scoped to the Collab Board rather than becoming a
// general-purpose profile editor.
export default function ProfileSettingsModal({ userId, profile, onClose, onSaved }) {
  const [form, setForm] = useState({
    display_name: profile?.display_name || '',
    avatar_url: profile?.avatar_url || '',
    bio: profile?.bio || '',
    creator_niche: profile?.creator_niche || '',
    region: profile?.region || '',
    experience_level: profile?.experience_level || '',
    collab_visible: profile?.collab_visible !== false,
    social_links: profile?.social_links || {},
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(key, value) { setForm(f => ({ ...f, [key]: value })) }
  function setSocial(key, value) { setForm(f => ({ ...f, social_links: { ...f.social_links, [key]: value } })) }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    const bio = sanitizeText(form.bio)
    if (bio.length > TEXT_LIMITS.bio.max) { setError(`Bio must be ${TEXT_LIMITS.bio.max} characters or fewer.`); return }

    setSaving(true)
    try {
      const socialLinks = Object.fromEntries(Object.entries(form.social_links).filter(([, v]) => v && v.trim()))
      const { error: err } = await supabase.from('profiles').update({
        display_name: sanitizeText(form.display_name) || null,
        avatar_url: form.avatar_url.trim() || null,
        bio: bio || null,
        creator_niche: sanitizeText(form.creator_niche) || null,
        region: sanitizeText(form.region) || null,
        experience_level: form.experience_level || null,
        collab_visible: form.collab_visible,
        social_links: socialLinks,
      }).eq('id', userId)
      if (err) throw err
      onSaved?.({ ...form, social_links: Object.fromEntries(Object.entries(form.social_links).filter(([, v]) => v && v.trim())) })
    } catch (err) {
      setError('Could not save your profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 520, background: '#0b0f1c', border: `1px solid ${C.border}`, borderRadius: 20, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ height: 4, background: 'linear-gradient(90deg,#22D3EE,#a855f7,#EC4899)' }} />
        <div style={{ padding: '24px 28px 28px', maxHeight: '85vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.white, margin: 0 }}>My Creator Profile</h2>
              <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Shown to other creators on the Collab Board only.</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Display Name</label>
              <input style={fieldStyle} value={form.display_name} onChange={e => set('display_name', e.target.value)} maxLength={60} placeholder="How other creators will see you" />
            </div>
            <div>
              <label style={labelStyle}>Avatar Image URL</label>
              <input style={fieldStyle} value={form.avatar_url} onChange={e => set('avatar_url', e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <label style={labelStyle}>Bio</label>
              <textarea style={{ ...fieldStyle, minHeight: 80, resize: 'vertical' }} value={form.bio} onChange={e => set('bio', e.target.value)} maxLength={TEXT_LIMITS.bio.max} placeholder="A short intro for potential collaborators" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Creator Niche</label>
                <input style={fieldStyle} value={form.creator_niche} onChange={e => set('creator_niche', e.target.value)} maxLength={60} />
              </div>
              <div>
                <label style={labelStyle}>General Region</label>
                <input style={fieldStyle} value={form.region} onChange={e => set('region', e.target.value)} maxLength={80} placeholder="e.g. US - Southeast" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Experience Level</label>
              <select style={fieldStyle} value={form.experience_level} onChange={e => set('experience_level', e.target.value)}>
                <option value="">Prefer not to say</option>
                {PROFILE_EXPERIENCE_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Social Links (optional, shown publicly on Collab Board)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SOCIAL_KEYS.map(s => (
                  <input key={s.key} style={fieldStyle} placeholder={s.label} value={form.social_links[s.key] || ''} onChange={e => setSocial(s.key, e.target.value)} />
                ))}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.text, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.collab_visible} onChange={e => set('collab_visible', e.target.checked)} />
              Show my profile to other creators on the Collab Board
            </label>

            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6, background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: 10 }}>
              Never share your legal name, home address, phone number, or exact location here.
            </div>

            {error && <div style={{ fontSize: 11.5, color: C.red }}>{error}</div>}

            <button type="submit" disabled={saving} style={{
              padding: '12px', borderRadius: 12, border: 'none', cursor: saving ? 'wait' : 'pointer',
              background: saving ? 'rgba(255,255,255,0.08)' : 'linear-gradient(90deg,#22D3EE,#a855f7,#EC4899)',
              color: saving ? C.muted : '#05070f', fontWeight: 800, fontSize: 13.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {saving ? (<><InlineSpinner /> Saving…</>) : 'Save Profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

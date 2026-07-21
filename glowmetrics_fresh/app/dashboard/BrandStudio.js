'use client'
import { useEffect, useState } from 'react'
import BrandProfileEditor from './brandStudio/BrandProfileEditor'
import BioGenerator from '../tools/profile-studio/components/BioGenerator'
import TipMenuGenerator from '../tools/profile-studio/components/TipMenuGenerator'
import DraftsPanel from '../tools/profile-studio/components/DraftsPanel'
import { T, GRADIENT } from '../tools/profile-studio/components/theme'

// Brand Studio is the logged-in workspace built on top of the same engine
// as the public Creator Profile Studio (/tools/profile-studio) — same
// creator_profiles / generated_bios / tip_menus tables, same
// lib/profileStudio prompt builder, safety rules, and pricing engine.
// The public page stays the free acquisition funnel; this tab is the saved,
// ongoing workspace: one Brand Profile, prefilled generators, and a history
// of everything that's been generated.
//
// New generators (Stream Title, Social Post, Branding Assistant, Content
// Calendar, ...) plug in by adding one more entry to TABS below and a
// matching component — they should reuse `profile` + `handleProfileChange`
// exactly like Bio/Tip Menu do, never build a second prompt/profile system.
const TABS = [
  { id: 'profile', label: 'Brand Profile', icon: '🪪' },
  { id: 'bio', label: 'Bio Generator', icon: '✍️' },
  { id: 'tipmenu', label: 'Tip Menu Generator', icon: '💸' },
  { id: 'drafts', label: 'History', icon: '📁' },
]

export default function BrandStudio({ user, isPro }) {
  const [tab, setTab] = useState('profile')
  const [profile, setProfile] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/profile-studio/profile')
      .then(async res => {
        if (cancelled || !res.ok) return
        const data = await res.json()
        setProfile(data.profile || {})
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleProfileChange = patch => setProfile(prev => ({ ...(prev || {}), ...patch }))

  const handleSaveProfile = async () => {
    const res = await fetch('/api/profile-studio/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
    if (!res.ok) throw new Error('Failed to save brand profile')
    const data = await res.json()
    setProfile(data.profile || profile)
  }

  const hasStageName = !!profile?.displayName?.trim()

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 900, color: T.white, letterSpacing: '-0.02em', margin: '0 0 6px' }}>
          Brand <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Studio</span>
        </h1>
        <p style={{ fontSize: 14, color: T.muted, margin: 0, maxWidth: 640, lineHeight: 1.6 }}>
          Your saved creator identity, bios, and tip menus — set up your Brand Profile once and every generator below stays consistent with it.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 18px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 13.5,
              border: `1px solid ${tab === t.id ? 'rgba(22,244,255,0.7)' : T.border}`,
              background: tab === t.id ? 'rgba(22,244,255,0.12)' : 'rgba(255,255,255,0.03)',
              color: tab === t.id ? T.white : T.muted,
              boxShadow: tab === t.id ? '0 0 18px rgba(22,244,255,0.16)' : 'none',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {!loading && !hasStageName && tab !== 'profile' && (
        <div style={{ marginBottom: 18, fontSize: 13, color: T.cyan, background: 'rgba(22,244,255,0.08)', border: '1px solid rgba(22,244,255,0.25)', borderRadius: 10, padding: '12px 16px' }}>
          💡 Set up your <button onClick={() => setTab('profile')} style={{ background: 'none', border: 'none', color: T.cyan, fontWeight: 800, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Brand Profile</button> first so your bios and tip menus stay consistent with your stage name, persona, and boundaries.
        </div>
      )}

      {loading ? (
        <div style={{ color: T.muted, fontSize: 13, padding: 40, textAlign: 'center' }}>Loading your brand profile…</div>
      ) : (
        <>
          {tab === 'profile' && (
            <BrandProfileEditor profile={profile} onChange={handleProfileChange} onSave={handleSaveProfile} />
          )}
          {tab === 'bio' && (
            <BioGenerator isLoggedIn sharedProfile={profile} onSharedProfileChange={handleProfileChange} />
          )}
          {tab === 'tipmenu' && (
            <TipMenuGenerator isLoggedIn sharedProfile={profile} onSharedProfileChange={handleProfileChange} />
          )}
          {tab === 'drafts' && <DraftsPanel isLoggedIn />}
        </>
      )}
    </div>
  )
}

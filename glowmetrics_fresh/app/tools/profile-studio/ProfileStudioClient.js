'use client'
import { useEffect, useState } from 'react'
import { PageShell, T, GRADIENT, Badge, SecondaryButton } from './components/theme'
import BioGenerator from './components/BioGenerator'
import TipMenuGenerator from './components/TipMenuGenerator'
import DraftsPanel from './components/DraftsPanel'

const TABS = [
  { id: 'bio', label: 'Bio Generator', icon: '✍️' },
  { id: 'tipmenu', label: 'Tip Menu Generator', icon: '💸' },
  { id: 'drafts', label: 'My Drafts', icon: '📁' },
]

export default function ProfileStudioClient() {
  const [tab, setTab] = useState('bio')
  const [authState, setAuthState] = useState('loading') // loading | out | in
  const [isPro, setIsPro] = useState(false)
  const [sharedProfile, setSharedProfile] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/profile-studio/profile')
      .then(async res => {
        if (cancelled) return
        if (res.status === 401) { setAuthState('out'); return }
        const data = await res.json()
        setAuthState('in')
        setIsPro(!!data.isPro)
        setSharedProfile(data.profile || {})
      })
      .catch(() => { if (!cancelled) setAuthState('out') })
    return () => { cancelled = true }
  }, [])

  const handleSharedProfileChange = (patch) => {
    setSharedProfile(prev => ({ ...(prev || {}), ...patch }))
  }

  const handleSaveProfile = async () => {
    if (!sharedProfile) return
    await fetch('/api/profile-studio/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sharedProfile),
    })
  }

  const isLoggedIn = authState === 'in'

  return (
    <PageShell>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 20px 100px' }}>
        <nav aria-label="breadcrumb" style={{ marginBottom: 24, fontSize: 12 }}>
          <a href="/landing" style={{ color: T.cyan, textDecoration: 'none' }}>Home</a>
          <span style={{ margin: '0 8px', color: T.faint }}>›</span>
          <a href="/tools" style={{ color: T.cyan, textDecoration: 'none' }}>Tools</a>
          <span style={{ margin: '0 8px', color: T.faint }}>›</span>
          <span style={{ color: T.faint }}>Creator Profile Studio</span>
        </nav>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <Badge color={T.cyan}>Cam Bio Generator</Badge>
            <Badge color={T.pink}>Tip Menu Generator</Badge>
            {isLoggedIn && <Badge color={isPro ? T.gold : T.muted}>{isPro ? 'Pro plan' : 'Free plan'}</Badge>}
          </div>
          <h1 style={{ fontSize: 'clamp(28px,4.5vw,44px)', fontWeight: 900, color: T.white, lineHeight: 1.08, marginBottom: 14, letterSpacing: '-0.03em' }}>
            Creator Profile <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Studio</span>
          </h1>
          <p style={{ fontSize: 16, color: T.muted, maxWidth: 620, margin: '0 auto', lineHeight: 1.7 }}>
            Build a bio and a tip menu that actually sound like your business — personalized to your persona, platforms, boundaries, and pricing. What you enter in one tool carries into the other.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 30, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="ps-btn"
              style={{
                padding: '11px 22px', borderRadius: 14, cursor: 'pointer', fontWeight: 800, fontSize: 14,
                border: `1px solid ${tab === t.id ? 'rgba(22,244,255,0.7)' : T.border}`,
                background: tab === t.id ? 'rgba(22,244,255,0.12)' : 'rgba(255,255,255,0.03)',
                color: tab === t.id ? T.white : T.muted,
                boxShadow: tab === t.id ? '0 0 18px rgba(22,244,255,0.16)' : 'none',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {isLoggedIn && sharedProfile && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <SecondaryButton onClick={handleSaveProfile} title="Save your persona, platforms, boundaries, and pricing so both tools stay prefilled next time">💾 Save profile for next time</SecondaryButton>
          </div>
        )}

        {tab === 'bio' && (
          <BioGenerator isLoggedIn={isLoggedIn} isPro={isPro} sharedProfile={sharedProfile} onSharedProfileChange={handleSharedProfileChange} />
        )}
        {tab === 'tipmenu' && (
          <TipMenuGenerator isLoggedIn={isLoggedIn} isPro={isPro} sharedProfile={sharedProfile} onSharedProfileChange={handleSharedProfileChange} />
        )}
        {tab === 'drafts' && <DraftsPanel isLoggedIn={isLoggedIn} />}
      </div>
    </PageShell>
  )
}

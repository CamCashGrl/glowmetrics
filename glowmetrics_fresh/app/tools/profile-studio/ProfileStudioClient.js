'use client'
import { useEffect, useState } from 'react'
import { PageShell, T, GRADIENT, SecondaryButton, Accordion } from './components/theme'
import BioGenerator from './components/BioGenerator'
import TipMenuGenerator from './components/TipMenuGenerator'
import DraftsPanel from './components/DraftsPanel'
import {
  Hero, TrustStrip, ExampleResults, HowItWorksCompact, SupportedFormatsCompact,
  ComparisonCompact, PrivacyCompact, CreatorStylePresets, WrittenGuides, FAQSection, FinalCTA,
} from './components/MarketingSections'

const TABS = [
  { id: 'bio', label: 'Bio Generator', icon: '✍️', desc: 'Create short and full bios for cam platforms, subscription pages, social media, and promotional use.' },
  { id: 'tipmenu', label: 'Tip Menu Generator', icon: '💸', desc: 'Build an editable menu with platform-aware pricing, creator-earnings estimates, categories, limits, and boundaries.' },
  { id: 'drafts', label: 'My Drafts', icon: '📁', desc: 'Open, rename, duplicate, continue editing, or delete saved bios and tip menus.' },
]

export default function ProfileStudioClient() {
  const [tab, setTab] = useState('bio')
  const [authState, setAuthState] = useState('loading') // loading | out | in
  // Free and usable signed-out — starts populated so both tools work
  // immediately; only overwritten with saved data once we know the visitor
  // is signed in.
  const [sharedProfile, setSharedProfile] = useState({})
  // Bumped whenever a creator-style preset is applied, forcing both wizards
  // to remount and re-read their initial state from sharedProfile — neither
  // wizard re-reads sharedProfile after its own first render otherwise.
  const [presetVersion, setPresetVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/profile-studio/profile')
      .then(async res => {
        if (cancelled) return
        if (res.status === 401) { setAuthState('out'); return }
        const data = await res.json()
        setAuthState('in')
        setSharedProfile(data.profile || {})
      })
      .catch(() => { if (!cancelled) setAuthState('out') })
    return () => { cancelled = true }
  }, [])

  const handleSharedProfileChange = (patch) => {
    setSharedProfile(prev => ({ ...(prev || {}), ...patch }))
  }

  const handleSaveProfile = async () => {
    await fetch('/api/profile-studio/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sharedProfile),
    })
  }

  const isLoggedIn = authState === 'in'

  const goToTool = (which) => {
    setTab(which)
    requestAnimationFrame(() => {
      document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  // Presets only suggest persona/tone/audience/compatible categories — they
  // never touch services or boundaries, which the creator still confirms
  // themselves in the wizard.
  const applyPreset = (preset) => {
    setSharedProfile(prev => ({
      ...(prev || {}),
      personaTags: preset.personaTags,
      tone: preset.tone,
      desiredAudience: preset.desiredAudience,
      tipMenuCategories: preset.categories,
    }))
    setPresetVersion(v => v + 1)
    goToTool('bio')
  }

  return (
    <PageShell>
      <nav aria-label="site" style={{
        padding: '8px 32px', borderBottom: `1px solid ${T.border}`, display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0,
        background: 'rgba(5,7,19,0.92)', backdropFilter: 'blur(16px)', zIndex: 40,
      }}>
        <a href="/landing" style={{ fontWeight: 800, fontSize: 14, color: T.muted, textDecoration: 'none', letterSpacing: '-0.2px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CamCash</span>
        </a>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <a href="/tools" style={{ fontSize: 12.5, color: T.muted, textDecoration: 'none' }}>All Tools</a>
          <a href="/tools/cam-model-name-generator" style={{ fontSize: 12.5, color: T.muted, textDecoration: 'none' }}>Name Generator</a>
          <a href="/blog" style={{ fontSize: 12.5, color: T.muted, textDecoration: 'none' }}>Blog</a>
          <a href={isLoggedIn ? '/dashboard' : '/login'} style={{ fontSize: 12.5, color: T.muted, textDecoration: 'none' }}>
            {isLoggedIn ? 'Dashboard' : 'Sign in'}
          </a>
        </div>
      </nav>

      {/* Compact hero + real generator, all in the first viewport — no
          marketing content is placed before this. */}
      <div id="generator" style={{ maxWidth: 1180, margin: '0 auto', padding: '6px 20px 0', scrollMarginTop: 60 }}>
        <Hero />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="ps-btn"
              style={{
                padding: '8px 16px', borderRadius: 14, cursor: 'pointer', fontWeight: 800, fontSize: 13.5,
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

        <p style={{ textAlign: 'center', fontSize: 12, color: T.faint, maxWidth: 480, margin: '0 auto 8px', lineHeight: 1.4 }}>
          {TABS.find(t => t.id === tab)?.desc}
        </p>

        {isLoggedIn && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <SecondaryButton onClick={handleSaveProfile} title="Save your persona, platforms, boundaries, and pricing so both tools stay prefilled next time">💾 Save profile for next time</SecondaryButton>
          </div>
        )}

        {tab === 'bio' && (
          <BioGenerator key={presetVersion} isLoggedIn={isLoggedIn} sharedProfile={sharedProfile} onSharedProfileChange={handleSharedProfileChange} />
        )}
        {tab === 'tipmenu' && (
          <TipMenuGenerator key={presetVersion} isLoggedIn={isLoggedIn} sharedProfile={sharedProfile} onSharedProfileChange={handleSharedProfileChange} />
        )}
        {tab === 'drafts' && <DraftsPanel isLoggedIn={isLoggedIn} />}
      </div>

      <div style={{ maxWidth: 900, margin: '32px auto 0', padding: '0 20px' }}>
        <TrustStrip />
      </div>

      {/* Everything below is secondary/educational — collapsed by default so
          it never competes with the generator above for attention. */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px 20px 90px' }}>
        <Accordion title="Start with a creator style">
          <CreatorStylePresets onSelectPreset={applyPreset} />
        </Accordion>
        <Accordion title="See an example result">
          <ExampleResults />
        </Accordion>
        <Accordion title="How it works">
          <HowItWorksCompact />
        </Accordion>
        <Accordion title="Supported platforms and formats">
          <SupportedFormatsCompact />
        </Accordion>
        <Accordion title="Privacy, safety, and boundaries">
          <PrivacyCompact />
        </Accordion>
        <Accordion title="Why use a creator-specific generator?">
          <ComparisonCompact />
        </Accordion>
        <Accordion title="More guides">
          <WrittenGuides />
        </Accordion>

        <div style={{ marginTop: 24 }}>
          <FAQSection />
        </div>

        <div style={{ marginTop: 24 }}>
          <FinalCTA onGoTo={goToTool} />
        </div>
      </div>
    </PageShell>
  )
}

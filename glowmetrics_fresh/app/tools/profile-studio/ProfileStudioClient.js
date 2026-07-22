'use client'
import { useEffect, useState } from 'react'
import { PageShell, T, GRADIENT, Accordion } from './components/theme'
import BioGenerator from './components/BioGenerator'
import TipMenuGenerator from './components/TipMenuGenerator'
import DraftsPanel from './components/DraftsPanel'
import Button from '../../../components/ui/Button'
import { track } from '../../../lib/track'
import {
  Hero, WhatYouGet, SupportedFormats, ExampleResults, HowItWorks, PlatformFormats,
  ComparisonSection, PrivacySection, CreatorStylePresets, WrittenGuides, FAQSection,
  MoreFreeTools, FinalCTA,
} from './components/MarketingSections'

const TABS = [
  { id: 'bio', label: 'Bio Generator', icon: '✍️', desc: 'Create short and full bios for cam platforms, subscription pages, social media, and promotional use.' },
  { id: 'tipmenu', label: 'Tip Menu Generator', icon: '💸', desc: 'Build an editable menu with platform-aware pricing, creator-earnings estimates, categories, limits, and boundaries.' },
  { id: 'drafts', label: 'My Drafts', icon: '📁', desc: 'Open, rename, duplicate, continue editing, or delete saved bios and tip menus.' },
]

// Page order per the redesign brief: compact hero -> generator -> results
// (results live inside the generator components) -> supporting content as
// collapsed accordions -> compact FAQ -> small final CTA. Every accordion's
// content is the same, unmodified MarketingSections component as before —
// only where it sits on the page and whether it starts open/closed changed.
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
  const [generatorStarted, setGeneratorStarted] = useState(false)

  useEffect(() => {
    track('page_viewed', { page: 'profile_studio' })
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

  const markGeneratorStarted = () => {
    if (!generatorStarted) {
      track('generator_started')
      setGeneratorStarted(true)
    }
  }

  const goToTool = (which) => {
    setTab(which)
    markGeneratorStarted()
    requestAnimationFrame(() => {
      document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const handleTabClick = (id) => {
    setTab(id)
    markGeneratorStarted()
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
    track('preset_selected', { preset: preset.id })
    goToTool('bio')
  }

  return (
    <PageShell>
      <nav aria-label="site" style={{
        padding: '16px 32px', borderBottom: `1px solid ${T.border}`, display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0,
        background: 'rgba(5,7,19,0.92)', backdropFilter: 'blur(16px)', zIndex: 40,
      }}>
        <a href="/landing" style={{ fontWeight: 800, fontSize: 15, color: T.white, textDecoration: 'none', letterSpacing: '-0.2px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CamCash</span>
        </a>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <a href="/tools" style={{ fontSize: 13, color: T.muted, textDecoration: 'none' }}>Free tools</a>
          <a href="/blog" style={{ fontSize: 13, color: T.muted, textDecoration: 'none' }}>Blog</a>
          <Button as="a" href={isLoggedIn ? '/dashboard' : '/login'} style={{ padding: '7px 18px', fontSize: 13 }}>
            {isLoggedIn ? 'Dashboard' : 'Sign in'}
          </Button>
        </div>
      </nav>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '18px 20px 0' }}>
        <nav aria-label="breadcrumb" style={{ marginBottom: 14, fontSize: 11.5 }}>
          <a href="/landing" style={{ color: T.cyan, textDecoration: 'none' }}>Home</a>
          <span style={{ margin: '0 6px', color: T.faint }}>›</span>
          <a href="/tools" style={{ color: T.cyan, textDecoration: 'none' }}>Tools</a>
          <span style={{ margin: '0 6px', color: T.faint }}>›</span>
          <span style={{ color: T.faint }}>Creator Profile Studio</span>
        </nav>
        <Hero onGoTo={goToTool} />
      </div>

      <div id="generator" style={{ maxWidth: 1180, margin: '0 auto', padding: '4px 20px 0', scrollMarginTop: 76 }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => handleTabClick(t.id)}
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

        <p style={{ textAlign: 'center', fontSize: 12.5, color: T.faint, maxWidth: 480, margin: '0 auto 22px', lineHeight: 1.6 }}>
          {TABS.find(t => t.id === tab)?.desc}
        </p>

        {isLoggedIn && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <a href="#" onClick={e => { e.preventDefault(); handleSaveProfile() }} style={{ fontSize: 12.5, color: T.cyan, textDecoration: 'none' }} title="Save your persona, platforms, boundaries, and pricing so both tools stay prefilled next time">💾 Save profile for next time</a>
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

      <div style={{ maxWidth: 760, margin: '48px auto 0', padding: '0 20px' }}>
        <Accordion title="See example results" icon="✨" defaultOpen>
          <ExampleResults />
        </Accordion>
        <Accordion title="Start with a creator style" icon="🎨" subtitle="Quick-start presets — you still confirm services and boundaries yourself">
          <CreatorStylePresets onSelectPreset={applyPreset} />
        </Accordion>
        <Accordion title="What you'll get" icon="🎯">
          <WhatYouGet />
        </Accordion>
        <Accordion title="How it works" icon="ℹ️">
          <HowItWorks />
        </Accordion>
        <Accordion title="Supported platforms" icon="💻">
          <PlatformFormats />
        </Accordion>
        <Accordion title="Supported formats & menu types" icon="📋">
          <SupportedFormats />
        </Accordion>
        <Accordion title="Privacy & boundaries" icon="🛡️">
          <PrivacySection />
        </Accordion>
        <Accordion title="Why this is different from generic AI" icon="⭐">
          <ComparisonSection />
        </Accordion>
        <Accordion title="Guides: bios, pricing, and tip menus" icon="📖">
          <WrittenGuides />
        </Accordion>
        <Accordion title="Common questions" icon="❓">
          <FAQSection />
        </Accordion>
      </div>

      <div style={{ maxWidth: 1180, margin: '32px auto 0', padding: '0 20px 100px' }}>
        <MoreFreeTools />
        <FinalCTA onGoTo={goToTool} />
      </div>
    </PageShell>
  )
}

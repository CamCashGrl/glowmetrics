'use client'
import { useState } from 'react'
import Image from 'next/image'
import { T, Card, Badge, GRADIENT, PrimaryButton, SecondaryButton } from './theme'
import { FAQS } from './faqData'
import { BIO_FORMATS, MENU_STYLES } from '../../../../lib/profileStudio/constants'

function SectionHeading({ eyebrow, title, sub }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 32, maxWidth: 680, marginLeft: 'auto', marginRight: 'auto' }}>
      {eyebrow && <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.cyan, marginBottom: 10 }}>{eyebrow}</div>}
      <h2 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 900, color: T.white, marginBottom: sub ? 10 : 0, letterSpacing: '-0.02em' }}>{title}</h2>
      {sub && <p style={{ fontSize: 15, color: T.muted, lineHeight: 1.6, margin: 0 }}>{sub}</p>}
    </div>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────
// Compact by design: the full generator sits directly below this, so the
// hero's only job is "explain in one breath, then get out of the way."
export function Hero({ onGoTo }) {
  return (
    <div className="ps-fade" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 32, alignItems: 'center', marginBottom: 28 }} data-hero-grid>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.cyan, marginBottom: 10 }}>Creator Profile Studio</div>
        <h1 style={{ fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 900, color: T.white, lineHeight: 1.15, marginBottom: 10, letterSpacing: '-0.03em' }}>
          <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Cam Bio Generator</span> and Tip Menu Builder
        </h1>
        <p style={{ fontSize: 15.5, color: T.muted, lineHeight: 1.6, marginBottom: 16, maxWidth: 480 }}>
          Create a magnetic, platform-ready bio and a balanced tip menu — free, in seconds, no account required.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <PrimaryButton onClick={() => onGoTo('bio')}>Start Building ↓</PrimaryButton>
        </div>
        <p style={{ fontSize: 12.5, color: T.faint }}>100% free · No credit card · No account required to try it</p>
      </div>

      <Card highlight style={{ padding: 18 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.faint, marginBottom: 10 }}>Example result</div>
        <p style={{ fontSize: 13, lineHeight: 1.55, color: T.soft, marginBottom: 10, borderLeft: `2px solid ${T.cyan}`, paddingLeft: 10 }}>
          "Bratty, playful, and always up for a game. Favorite my room so you don't miss it — tip, tease, and let's make it a good one."
        </p>
        <div style={{ borderTop: `1px solid ${T.borderSoft}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[['Say Hello', '25 tok'], ['Outfit Change', '100 tok'], ['Private Show Interest', '500 tok']].map(([name, price]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.muted }}>
              <span>{name}</span><span style={{ color: T.cyan, fontWeight: 700 }}>{price}</span>
            </div>
          ))}
        </div>
      </Card>
      <style>{`@media (max-width: 900px) { div[data-hero-grid] { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}

// ── What you'll get ──────────────────────────────────────────────────────
const FEATURES = [
  { icon: '🎯', title: 'Personalized to Your Brand', desc: 'Uses your selected personality, tone, services, audience, and brand style instead of producing generic text.' },
  { icon: '🛡️', title: 'Built Around Your Boundaries', desc: 'Only selected services and approved activities may appear in generated output.' },
  { icon: '💰', title: 'Smarter Tip Pricing', desc: 'Balances entry-level, mid-range, and premium tips based on platform payout, your goals, effort, duration, and exclusivity.' },
  { icon: '✏️', title: 'Ready to Edit and Use', desc: 'Edit, copy, save, reorder, and export the supported result types.' },
]

// ── Creator style presets ──────────────────────────────────────────────────
// Presets only suggest persona/tone/audience/compatible categories — they
// never auto-select services, boundaries, toys, or pricing. The creator
// still confirms every service and limit themselves in the wizard.
export const CREATOR_STYLE_PRESETS = [
  { id: 'bratty_princess', label: 'Bratty Princess', personaTags: ['Bratty princess', 'Playful', 'Luxury'], tone: ['Bratty', 'Playful', 'Confident'], desiredAudience: 'viewers who like a bit of a challenge and playful teasing', categories: ['Greetings and attention', 'Dominant commands', 'Games', 'Goals'] },
  { id: 'soft_domme', label: 'Soft Domme', personaTags: ['Soft domme', 'Luxury'], tone: ['Dominant', 'Sweet', 'Confident'], desiredAudience: 'viewers who want gentle control and warmth', categories: ['Dominant commands', 'Compliments', 'Roleplay', 'Goals'] },
  { id: 'strict_domme', label: 'Strict Domme', personaTags: ['Strict domme', 'Findom'], tone: ['Dominant', 'Direct', 'Mysterious'], desiredAudience: 'viewers who want firm direction and structure', categories: ['Dominant commands', 'Custom requests', 'Goals'] },
  { id: 'girl_next_door', label: 'Girl Next Door', personaTags: ['Girl next door', 'Natural', 'Playful'], tone: ['Sweet', 'Friendly', 'Playful'], desiredAudience: 'viewers who want relaxed, genuine conversation', categories: ['Greetings and attention', 'Compliments', 'Games', 'Social promotion'] },
  { id: 'non_nude_entertainer', label: 'Non-Nude Entertainer', personaTags: ['Non-nude creator', 'Playful', 'Funny'], tone: ['Playful', 'Friendly', 'Confident'], desiredAudience: 'viewers who enjoy personality-driven entertainment without nudity', categories: ['Non-nude activities', 'Games', 'Dancing', 'Outfit actions'] },
  { id: 'girlfriend_experience', label: 'Girlfriend Experience', personaTags: ['Girlfriend experience', 'Playful'], tone: ['Sweet', 'Flirty', 'Friendly'], desiredAudience: 'viewers looking for a warm, personal connection', categories: ['Greetings and attention', 'Compliments', 'Roleplay', 'Fan club promotion'] },
  { id: 'gamer', label: 'Gamer', personaTags: ['Gamer', 'Funny', 'Playful'], tone: ['Playful', 'Friendly', 'Confident'], desiredAudience: 'viewers who bond over games and banter', categories: ['Games', 'Spin wheel', 'Roll the dice', 'Social promotion'] },
  { id: 'luxury_creator', label: 'Luxury Creator', personaTags: ['Luxury', 'Findom'], tone: ['Luxury', 'Confident', 'Mysterious'], desiredAudience: 'high-spending viewers who want an exclusive, upscale experience', categories: ['Goals', 'Custom requests', 'Private show prompts'] },
  { id: 'toy_focused_creator', label: 'Toy-Focused Creator', personaTags: ['Playful', 'Flirty'], tone: ['Playful', 'Flirty', 'Confident'], desiredAudience: 'viewers who enjoy interactive toy control', categories: ['Toy actions', 'Lovense levels', 'Goals'] },
]

export function CreatorStylePresets({ onSelectPreset }) {
  return (
    <div style={{ marginBottom: 56 }}>
      <SectionHeading eyebrow="Quick start" title="Start With a Creator Style" sub="Suggests a persona, tone, and audience — you still choose your own services and boundaries in the wizard." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {CREATOR_STYLE_PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => onSelectPreset(p)}
            className="ps-btn"
            style={{ textAlign: 'left', padding: '16px 18px', borderRadius: 14, cursor: 'pointer', border: `1px solid ${T.border}`, background: T.card }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, color: T.white, marginBottom: 6 }}>{p.label}</div>
            <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>{p.tone.slice(0, 3).join(' · ')}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export function WhatYouGet() {
  return (
    <div style={{ marginBottom: 56 }}>
      <SectionHeading eyebrow="What you'll get" title="Built for real creator workflows" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {FEATURES.map(f => (
          <Card key={f.title}>
            <div style={{ fontSize: 26, marginBottom: 12 }}>{f.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.white, marginBottom: 8 }}>{f.title}</div>
            <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>{f.desc}</div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── Supported formats/types overview ──────────────────────────────────────
export function SupportedFormats() {
  return (
    <div style={{ marginBottom: 56 }}>
      <SectionHeading eyebrow="Every format, one tool" title="15 bio formats. 14 tip menu types." sub="Every one uses its own generation rules — not one generic template stretched across all of them." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="ps-grid-2">
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.cyan, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bio formats</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {BIO_FORMATS.map(f => <Badge key={f.id} color={T.cyan}>{f.label}</Badge>)}
            <Badge color={T.gold}>Existing Bio Audit &amp; Rewrite</Badge>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.pink, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tip menu types</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {MENU_STYLES.map(s => <Badge key={s.id} color={T.pink}>{s.label}</Badge>)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Example results ──────────────────────────────────────────────────────
// Static, reviewed examples — never live-generated, so this section works
// even without a configured AI key and never varies between page loads.
const BIO_EXAMPLES = [
  {
    id: 'bratty_chaturbate', label: 'Bratty Chaturbate Bio', platform: 'Chaturbate', format: 'Chaturbate bio',
    persona: 'Bratty princess', tone: 'Bratty, Playful',
    text: "Bratty, spoiled, and used to getting my way — especially when you tip right. I stream weeknights and love a good tip-goal challenge. Favorite my room and check my tip menu if you want my attention tonight.",
    cta: 'Favorite my room · Check my tip menu', activities: 'Games, Tip goals',
  },
  {
    id: 'soft_domme', label: 'Soft Domme Profile', platform: 'MyFreeCams', format: 'MyFreeCams bio',
    persona: 'Soft domme', tone: 'Dominant, Sweet',
    text: "Soft-spoken but very much in control. I like guiding you gently — a compliment here, a small task there — and building something that feels personal. Come say hello and join my club for the regulars.",
    cta: 'Come say hello · Join the club', activities: 'Roleplay, Fan club',
  },
  {
    id: 'non_nude_bio', label: 'Non-Nude Creator Bio', platform: 'Stripchat', format: 'Stripchat bio',
    persona: 'Non-nude creator', tone: 'Playful, Friendly',
    text: "Fully clothed, fully entertaining. I run a non-nude room built around games, dancing, and genuine conversation — no explicit content, just a good time. Follow me and check tonight's game menu.",
    cta: 'Follow me', activities: 'Games, Dancing, Non-nude activities',
  },
]

const TIP_MENU_EXAMPLES = [
  {
    id: 'beginner_balanced', label: 'Beginner Balanced Menu', payout: 'Chaturbate — 100 tokens ≈ $5.00',
    rules: 'Tips are non-refundable. Custom requests are reviewed before approval.',
    items: [
      { name: 'Say Hello', tier: 'Entry', price: '10 tok', usd: '$0.50', vis: 'Public' },
      { name: 'Outfit Change', tier: 'Mid', price: '100 tok', usd: '$5.00', vis: 'Public' },
      { name: 'Custom Request', tier: 'Premium', price: '400 tok', usd: '$20.00', vis: 'Approval required' },
    ],
  },
  {
    id: 'non_nude_menu', label: 'Non-Nude Menu', payout: 'MyFreeCams — 100 tokens ≈ $5.00',
    rules: 'No nudity at any tier. Non-nude activities only.',
    items: [
      { name: 'Compliment Round', tier: 'Entry', price: '15 tok', usd: '$0.75', vis: 'Public' },
      { name: 'Dance Break', tier: 'Mid', price: '120 tok', usd: '$6.00', vis: 'Public' },
      { name: 'Cosplay Moment', tier: 'Premium', price: '350 tok', usd: '$17.50', vis: 'Public' },
    ],
  },
  {
    id: 'toy_focused_menu', label: 'Toy-Focused Menu', payout: 'Chaturbate — 100 tokens ≈ $5.00',
    rules: 'Toy intensity capped at moderate. Long-duration control is private-only.',
    items: [
      { name: 'Toy Pulse', tier: 'Entry', price: '20 tok', usd: '$1.00', vis: 'Public' },
      { name: 'Lovense Level Up', tier: 'Mid', price: '150 tok', usd: '$7.50', vis: 'Public' },
      { name: 'Extended Toy Control (3 min)', tier: 'Premium', price: '600 tok', usd: '$30.00', vis: 'Private-only' },
    ],
  },
]

function PresetTabs({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className="ps-btn"
          style={{
            padding: '6px 14px', borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: 12,
            border: `1px solid ${value === o.id ? 'rgba(255,43,174,0.6)' : T.border}`,
            background: value === o.id ? 'rgba(255,43,174,0.12)' : 'rgba(255,255,255,0.03)',
            color: value === o.id ? T.white : T.muted,
          }}
        >{o.label}</button>
      ))}
    </div>
  )
}

export function ExampleResults() {
  const [tab, setTab] = useState('bio')
  const [bioExampleId, setBioExampleId] = useState(BIO_EXAMPLES[0].id)
  const [menuExampleId, setMenuExampleId] = useState(TIP_MENU_EXAMPLES[0].id)
  const bioExample = BIO_EXAMPLES.find(b => b.id === bioExampleId)
  const menuExample = TIP_MENU_EXAMPLES.find(m => m.id === menuExampleId)

  return (
    <div style={{ marginBottom: 56 }}>
      <SectionHeading eyebrow="See it in action" title="Example results" sub="Static, reviewed examples — real output shape, not generic marketing copy." />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
        {[{ id: 'bio', label: 'Bio Example' }, { id: 'tipmenu', label: 'Tip Menu Example' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="ps-btn"
            style={{
              padding: '9px 20px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 13,
              border: `1px solid ${tab === t.id ? 'rgba(22,244,255,0.7)' : T.border}`,
              background: tab === t.id ? 'rgba(22,244,255,0.14)' : 'rgba(255,255,255,0.03)',
              color: tab === t.id ? T.white : T.muted,
            }}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'bio' ? (
        <>
          <PresetTabs options={BIO_EXAMPLES} value={bioExampleId} onChange={setBioExampleId} />
          <Card highlight style={{ maxWidth: 560, margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <Badge color={T.cyan}>{bioExample.platform}</Badge>
              <Badge color={T.pink}>{bioExample.persona}</Badge>
              <Badge color={T.gold}>{bioExample.tone}</Badge>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: T.soft, marginBottom: 12 }}>"{bioExample.text}"</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: T.faint, marginBottom: 8 }}>
              <span>{bioExample.text.length} characters</span>
              <span>CTA: {bioExample.cta}</span>
            </div>
            <div style={{ fontSize: 11.5, color: T.faint, marginBottom: 12 }}>Approved activities only: {bioExample.activities}</div>
            <SecondaryButton>📋 Copy (example)</SecondaryButton>
          </Card>
        </>
      ) : (
        <>
          <PresetTabs options={TIP_MENU_EXAMPLES} value={menuExampleId} onChange={setMenuExampleId} />
          <Card highlight style={{ maxWidth: 560, margin: '0 auto' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.white, marginBottom: 4 }}>{menuExample.label}</div>
            <div style={{ fontSize: 12, color: T.cyan, marginBottom: 14, fontWeight: 600 }}>Payout assumption: {menuExample.payout}</div>
            {menuExample.items.map(item => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5, padding: '8px 0', borderBottom: `1px solid ${T.borderSoft}` }}>
                <div>
                  <span style={{ color: T.soft }}>{item.name}</span>
                  <span style={{ color: T.faint, fontSize: 10.5, marginLeft: 8 }}>{item.tier}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: T.cyan, fontWeight: 700 }}>{item.price}</span>
                  <span style={{ color: T.faint, fontSize: 11.5 }}>{item.usd}</span>
                  <Badge color={item.vis === 'Public' ? T.green : T.gold} style={{ fontSize: 9 }}>{item.vis}</Badge>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 14, fontSize: 12, color: T.muted, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px' }}>
              Estimated earnings shown per item · {menuExample.rules}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

// ── How it works ─────────────────────────────────────────────────────────
const STEPS_HOW = [
  { n: 1, title: 'Tell Us About Your Brand', desc: 'Select your persona, tone, platforms, services, boundaries, audience, and goals.' },
  { n: 2, title: 'Generate the Right Format', desc: 'CamCash builds output specifically structured for your selected platform and use case.' },
  { n: 3, title: 'Edit, Save, and Use', desc: 'Adjust wording, pricing, order, categories, and visibility before you use the result.' },
]

export function HowItWorks() {
  return (
    <div style={{ marginBottom: 56 }}>
      <SectionHeading eyebrow="How it works" title="Three steps, no guesswork" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {STEPS_HOW.map(s => (
          <Card key={s.n}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: GRADIENT, color: '#050713',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, marginBottom: 14,
            }}>{s.n}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.white, marginBottom: 8 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>{s.desc}</div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── Platform formats ──────────────────────────────────────────────────────
const PLATFORM_FORMAT_NOTES = [
  { platform: 'Chaturbate', note: 'A fuller room bio with personality, show style, schedule, menu direction, and a favorite-room call to action.' },
  { platform: 'MyFreeCams', note: 'A profile-oriented bio with personality, club appeal, room expectations, and member-focused wording.' },
  { platform: 'BongaCams', note: 'A concise, room-friendly profile emphasizing interaction, schedule, public and private options, and favorites.' },
  { platform: 'Stripchat', note: 'Interactive room energy with games, goals, and show type up front, plus a follow call to action.' },
  { platform: 'CamSoda', note: 'Lively and social, leading with entertainment style and audience participation.' },
  { platform: 'OnlyFans', note: 'A subscription-focused bio built around content style and a clear subscribe call to action — no room pricing.' },
  { platform: 'Fansly', note: 'Niche and content-forward, built for tiered subscriptions rather than live-room language.' },
  { platform: 'X', note: 'A short, attention-grabbing profile with a clear identity, niche, and link-oriented call to action.' },
  { platform: 'Instagram', note: 'A safer social-facing bio that avoids explicit room details and focuses on brand, personality, and link direction.' },
]

export function PlatformFormats() {
  return (
    <div style={{ marginBottom: 56 }}>
      <SectionHeading eyebrow="Platform-aware" title="Every format adapts to where you post it" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
        {PLATFORM_FORMAT_NOTES.map(p => (
          <Card key={p.platform} style={{ padding: 18 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: T.cyan, marginBottom: 8 }}>{p.platform}</div>
            <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6 }}>{p.note}</div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── Generic AI vs CamCash ─────────────────────────────────────────────────
export function ComparisonSection() {
  const labels = [
    'Uses your persona', 'Includes only approved services', 'Adds a purpose-driven CTA',
    'Matches platform format', 'Respects boundaries', 'Avoids invented claims',
  ]
  return (
    <div style={{ marginBottom: 56 }}>
      <SectionHeading eyebrow="Why it's different" title="Generic AI vs. CamCash" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="ps-grid-2">
        <Card style={{ opacity: 0.75 }}>
          <Badge color={T.faint}>Generic AI</Badge>
          <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.7, marginTop: 14 }}>
            "Hey, I'm fun and flirty and love meeting new people. Come chat with me!"
          </p>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {labels.map(l => <div key={l} style={{ fontSize: 12.5, color: T.faint }}>✕ {l}</div>)}
          </div>
        </Card>
        <Card highlight>
          <Badge color={T.cyan}>CamCash</Badge>
          <p style={{ fontSize: 14, color: T.soft, lineHeight: 1.7, marginTop: 14 }}>
            "Bratty, playful, and always up for a game — I stream weeknights and love a good tip-goal challenge. Favorite my room so you don't miss it, and check my tip menu for tonight's games."
          </p>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {labels.map(l => <div key={l} style={{ fontSize: 12.5, color: T.green }}>✓ {l}</div>)}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── Privacy & boundaries ──────────────────────────────────────────────────
export function PrivacySection() {
  return (
    <div style={{ marginBottom: 56 }}>
      <SectionHeading eyebrow="Trust" title="Privacy and boundaries come first" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 26, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.white, marginBottom: 8 }}>Creator Privacy</div>
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>You never need to enter your legal name, exact address, private phone number, or personal contact information.</div>
        </Card>
        <Card>
          <div style={{ fontSize: 26, marginBottom: 12 }}>🛡️</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.white, marginBottom: 8 }}>Creator-Controlled Output</div>
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>The generator won't intentionally add a service, activity, or promise you didn't approve.</div>
        </Card>
      </div>
    </div>
  )
}

// ── Written content (SEO) ───────────────────────────────────────────────────
const ARTICLES = [
  {
    title: 'What Makes a Good Cam Bio?', points: [
      'A strong opening line that hooks a reader in the first sentence',
      'A clear persona instead of generic filler ("fun and flirty")',
      'A realistic sense of what viewers can expect from your room',
      'Only the services you actually offer, stated clearly',
      'Your schedule, so viewers know when to come back',
      'A specific call to action, not just "come chat"',
      'Boundaries acknowledged if you want them public',
      'Short paragraphs that are easy to scan on a phone',
    ],
  },
  {
    title: 'How to Price a Cam Tip Menu', points: [
      'Entry-level items should be quick and low-effort so anyone can participate',
      'Mid-tier actions reward a bit more time or attention',
      'Premium items should reflect real effort, duration, or exclusivity',
      'Factor in your actual payout rate, not just the token number',
      'Longer or more exclusive actions should cost more, not less',
      'Avoid underpricing anything that takes several minutes',
    ],
  },
  {
    title: 'Common Tip Menu Mistakes', points: [
      'Too many cheap items and nothing for bigger spenders',
      'No premium option at all',
      'A multi-minute action priced like a 10-second reaction',
      'Several near-identical items that just confuse the choice',
      'Vague item descriptions viewers can\'t picture',
      'No stated rules for custom requests or refunds',
      'No cooldowns on intense or disruptive actions',
      'Treating the token count as the dollar amount instead of converting it',
    ],
  },
  {
    title: 'Public Versus Private Menu Items', points: [
      'Public items should be things you\'re comfortable performing in front of the whole room',
      'Anything more intense or exclusive belongs private-only',
      'Custom requests should require your approval before being accepted',
      'Never promise a specific outcome for a custom request in the menu text',
      'Being explicit about what\'s public vs. private avoids awkward mid-show surprises',
    ],
  },
]

export function WrittenGuides() {
  return (
    <div style={{ marginBottom: 56 }}>
      <SectionHeading eyebrow="Guides" title="Get more from both generators" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {ARTICLES.map(a => (
          <Card key={a.title}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.white, marginBottom: 12 }}>{a.title}</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: T.muted, fontSize: 13, lineHeight: 1.7 }}>
              {a.points.map(p => <li key={p}>{p}</li>)}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── FAQ ────────────────────────────────────────────────────────────────────
export function FAQSection() {
  const [open, setOpen] = useState(null)
  return (
    <div style={{ marginBottom: 56 }}>
      <SectionHeading eyebrow="FAQ" title="Common questions" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 760, margin: '0 auto' }}>
        {FAQS.map((f, i) => (
          <div key={f.q} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="ps-btn"
              style={{ width: '100%', textAlign: 'left', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ fontSize: 14.5, fontWeight: 700, color: T.white }}>{f.q}</span>
              <span style={{ color: T.cyan, fontSize: 18, transform: open === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s' }}>+</span>
            </button>
            {open === i && <div style={{ padding: '0 20px 16px' }}><p style={{ fontSize: 13.5, lineHeight: 1.7, color: T.muted, margin: 0 }}>{f.a}</p></div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── More free tools + Etsy promo ──────────────────────────────────────────
// Same links/copy/code as the existing post-generation Etsy block inside
// TipMenuGenerator.js (untouched) — this page-level version is visible
// regardless of which tab a visitor used, per the redesign brief.
export function MoreFreeTools() {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24, fontSize: 13 }}>
        <a href="/tools" style={{ color: T.cyan, textDecoration: 'none' }}>→ All free CamCash tools</a>
        <a href="/tools/cam-model-name-generator" style={{ color: T.cyan, textDecoration: 'none' }}>→ Cam model name generator</a>
        <a href="/guides/cam-model-token-calculator" style={{ color: T.cyan, textDecoration: 'none' }}>→ Token calculator</a>
        <a href="/guides/cam-model-room-title-generator" style={{ color: T.cyan, textDecoration: 'none' }}>→ Room title generator</a>
        <a href="/guides/cam-model-income-tracker" style={{ color: T.cyan, textDecoration: 'none' }}>→ Cam model income tracker</a>
        <a href="/blog/how-to-increase-cam-earnings" style={{ color: T.cyan, textDecoration: 'none' }}>→ How to increase cam earnings</a>
        <a href="/blog/best-cam-model-tools" style={{ color: T.cyan, textDecoration: 'none' }}>→ Best cam model tools</a>
      </div>

      <Card highlight style={{ padding: 24, borderColor: 'rgba(255,43,174,0.25)' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
          <Image src="/blog-images/spin_the_wheel_cover.png" alt="Spin-the-Wheel Template Pack for cam models cover art by Pretty Profitz" width={120} height={155} style={{ width: 120, height: 'auto', borderRadius: 10, display: 'block' }} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.white, margin: '0 0 8px', textAlign: 'center' }}>Want a designed, printable tip menu?</div>
        <p style={{ fontSize: 13.5, color: T.muted, margin: '0 0 14px', lineHeight: 1.6, textAlign: 'center' }}>
          Pretty Profitz sells ready-made tip menu templates (320+ styles), a Roll-the-Dice game template, and the Spin-the-Wheel Template Pack — all editable, Etsy-instant-download.
        </p>
        <p style={{ fontSize: 13.5, color: T.muted, margin: '0 0 16px', lineHeight: 1.6, textAlign: 'center' }}>
          Use code <strong style={{ color: T.white }}>PRETTY70</strong> at checkout for 70% off.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <a href="https://prettyprofitz.etsy.com" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: GRADIENT, color: '#050713', padding: '11px 22px', borderRadius: 10, fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>Shop on Etsy →</a>
        </div>
      </Card>
    </div>
  )
}

// ── Final CTA ──────────────────────────────────────────────────────────────
export function FinalCTA({ onGoTo }) {
  return (
    <Card highlight style={{ textAlign: 'center', padding: '48px 32px', marginBottom: 56 }}>
      <h2 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 900, color: T.white, marginBottom: 14, letterSpacing: '-0.02em' }}>Ready to Build Your Creator Profile?</h2>
      <p style={{ fontSize: 15, color: T.muted, marginBottom: 24, maxWidth: 460, margin: '0 auto 24px' }}>Free to generate, no account required to try it.</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <PrimaryButton onClick={() => onGoTo('bio')}>Generate My Bio</PrimaryButton>
        <SecondaryButton onClick={() => onGoTo('tipmenu')}>Create My Tip Menu</SecondaryButton>
      </div>
    </Card>
  )
}

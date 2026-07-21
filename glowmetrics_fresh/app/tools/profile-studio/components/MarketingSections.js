'use client'
import { useState } from 'react'
import { T, Card, Badge, GRADIENT, PrimaryButton, SecondaryButton } from './theme'
import { FAQS } from './faqData'

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
export function Hero({ onGoTo }) {
  return (
    <div className="ps-fade" style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 40, alignItems: 'center', marginBottom: 56 }} data-hero-grid>
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          <Badge color={T.cyan}>Cam Bio Generator</Badge>
          <Badge color={T.pink}>Tip Menu Generator</Badge>
          <Badge color={T.green}>100% Free</Badge>
        </div>
        <h1 style={{ fontSize: 'clamp(26px,3.8vw,38px)', fontWeight: 900, color: T.white, lineHeight: 1.15, marginBottom: 14, letterSpacing: '-0.03em' }}>
          Free <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Cam Bio Generator</span> &amp; <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Tip Menu Generator</span>
        </h1>
        <p style={{ fontSize: 17, color: T.soft, fontWeight: 600, lineHeight: 1.5, marginBottom: 14 }}>
          Build a bio that sounds like you—and a tip menu designed for your show.
        </p>
        <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.7, marginBottom: 24, maxWidth: 480 }}>
          Generate a personalized, platform-ready cam bio for Chaturbate, MyFreeCams, Stripchat, CamSoda, OnlyFans, Fansly, X, or Instagram, plus a balanced tip menu, based on your persona, services, boundaries, audience, and pricing goals.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <PrimaryButton onClick={() => onGoTo('bio')}>Create My Bio</PrimaryButton>
          <SecondaryButton onClick={() => onGoTo('tipmenu')}>Build My Tip Menu</SecondaryButton>
        </div>
        <p style={{ fontSize: 13, color: T.faint, marginBottom: 14 }}>Free to generate. Create an account only when you want to save your work.</p>
        <div style={{ fontSize: 12.5, color: T.muted, display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
          {['Personalized results', 'Boundaries respected', 'Editable output', 'Platform-ready formats'].map((t, i) => (
            <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span style={{ color: T.faint }}>•</span>} <span style={{ color: T.cyan }}>✓</span> {t}
            </span>
          ))}
        </div>
      </div>

      <Card highlight style={{ padding: 22 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          <Badge color={T.cyan}>Chaturbate format</Badge>
          <Badge color={T.green}>Boundaries checked</Badge>
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: T.soft, marginBottom: 12, borderLeft: `2px solid ${T.cyan}`, paddingLeft: 12 }}>
          "Bratty, playful, and always up for a game. I stream weeknights and love a good tip-goal challenge — favorite my room so you don't miss it. Tip, tease, and let's make it a good one."
        </p>
        <div style={{ fontSize: 11, color: T.faint, marginBottom: 18 }}>312 characters · Persona: Bratty princess, Playful</div>

        <div style={{ borderTop: `1px solid ${T.borderSoft}`, paddingTop: 14 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <Badge color={T.pink}>Balanced menu</Badge>
            <Badge color={T.gold}>Pricing balanced</Badge>
          </div>
          {[
            ['Say Hello', 25, '$1.25'],
            ['Outfit Change', 100, '$5.00'],
            ['Private Show Interest', 500, '$25.00'],
          ].map(([name, price, usd]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.soft, padding: '6px 0', borderBottom: `1px solid ${T.borderSoft}` }}>
              <span>{name}</span>
              <span style={{ color: T.cyan, fontWeight: 700 }}>{price} tok <span style={{ color: T.faint, fontWeight: 500 }}>· {usd}</span></span>
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

// ── Example results ──────────────────────────────────────────────────────
export function ExampleResults() {
  const [tab, setTab] = useState('bio')
  return (
    <div style={{ marginBottom: 56 }}>
      <SectionHeading eyebrow="See it in action" title="Example results" sub="Real output shape — not generic marketing copy." />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
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
        <Card highlight style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <Badge color={T.cyan}>MyFreeCams</Badge>
            <Badge color={T.pink}>Full cam profile</Badge>
            <Badge color={T.gold}>Confident, Warm</Badge>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: T.soft, marginBottom: 12 }}>
            "Hey, I'm Luna — West Coast based, here most weeknights around 8. I like real conversation more than scripted chat, and I run a room that's playful but genuine. Come say hello, join my club for the regulars-only extras, and check my tip menu for the games we play. Favorite the room so you don't miss me live."
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: T.faint, marginBottom: 12 }}>
            <span>612 characters</span>
            <span>Tone: Confident, Friendly</span>
          </div>
          <SecondaryButton>📋 Copy (example)</SecondaryButton>
        </Card>
      ) : (
        <Card highlight style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.white, marginBottom: 4 }}>Luna's Tip Menu</div>
          <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>Categories: Greetings · Games · Toy actions · Private show prompts</div>
          {[
            { name: 'Say Hello', price: '25 tok', usd: '$1.25', vis: 'Public' },
            { name: 'Roll the Dice', price: '75 tok', usd: '$3.75', vis: 'Public' },
            { name: 'Lovense Level Up', price: '200 tok', usd: '$10.00', vis: 'Public' },
            { name: 'Private Show Interest', price: '750 tok', usd: '$37.50', vis: 'Approval required' },
          ].map(item => (
            <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5, padding: '8px 0', borderBottom: `1px solid ${T.borderSoft}` }}>
              <span style={{ color: T.soft }}>{item.name}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: T.cyan, fontWeight: 700 }}>{item.price}</span>
                <span style={{ color: T.faint, fontSize: 11.5 }}>{item.usd}</span>
                <Badge color={item.vis === 'Public' ? T.green : T.gold} style={{ fontSize: 9 }}>{item.vis}</Badge>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 14, fontSize: 12, color: T.muted, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px' }}>
            Estimated earnings shown per item · Rules: tips are non-refundable, custom requests are reviewed before approval.
          </div>
        </Card>
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

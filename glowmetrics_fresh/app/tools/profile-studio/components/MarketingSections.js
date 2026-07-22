'use client'
import { useState } from 'react'
import { T, Card, Badge, GRADIENT, PrimaryButton, SecondaryButton } from './theme'
import { FAQS } from './faqData'
import { BIO_FORMATS, MENU_STYLES } from '../../../../lib/profileStudio/constants'

// ── Hero ─────────────────────────────────────────────────────────────────
// Compact by design — no side sample card, no CTA buttons that scroll to
// the tool, since the tab selector and the real wizard sit directly below
// this in the page, already in the first viewport.
export function Hero() {
  return (
    <div className="ps-fade" style={{ textAlign: 'center', marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.cyan, marginBottom: 5 }}>
        Creator Profile Studio
      </div>
      <h1 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 900, color: T.white, lineHeight: 1.12, marginBottom: 7, letterSpacing: '-0.02em' }}>
        Free <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Cam Bio Generator</span> &amp; <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Tip Menu Generator</span>
      </h1>
      <p style={{ fontSize: 14.5, color: T.muted, maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
        Personalized, platform-ready bios and balanced tip menus — free to generate, no account required to try it.
      </p>
    </div>
  )
}

// ── Trust strip ────────────────────────────────────────────────────────────
const TRUST_ITEMS = [
  { label: 'Personalized to your brand', desc: 'Uses your persona, tone, and services.' },
  { label: 'Built around your boundaries', desc: 'Only approved activities can appear.' },
  { label: 'Smarter tip-menu pricing', desc: 'Priced by effort, duration, and exclusivity.' },
  { label: 'Editable and ready to use', desc: 'Edit, copy, save, and export.' },
]

export function TrustStrip() {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px 30px',
      padding: '16px 0', borderTop: `1px solid ${T.borderSoft}`, borderBottom: `1px solid ${T.borderSoft}`,
    }}>
      {TRUST_ITEMS.map(t => (
        <div key={t.label} style={{ fontSize: 12.5, color: T.muted, maxWidth: 230 }}>
          <span style={{ color: T.cyan, fontWeight: 800, marginRight: 5 }}>✓</span>
          <strong style={{ color: T.soft }}>{t.label}.</strong> {t.desc}
        </div>
      ))}
    </div>
  )
}

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
    <div>
      <p style={{ fontSize: 12.5, color: T.faint, marginBottom: 14 }}>Suggests a persona, tone, and audience — you still choose your own services and boundaries in the wizard.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
        {CREATOR_STYLE_PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => onSelectPreset(p)}
            className="ps-btn"
            style={{ textAlign: 'left', padding: '13px 15px', borderRadius: 12, cursor: 'pointer', border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.02)' }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 800, color: T.white, marginBottom: 4 }}>{p.label}</div>
            <div style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.4 }}>{p.tone.slice(0, 3).join(' · ')}</div>
          </button>
        ))}
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
    <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
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
    <div>
      <p style={{ fontSize: 12.5, color: T.faint, marginBottom: 14 }}>Static, reviewed examples — this is a preview, not your generated result.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[{ id: 'bio', label: 'Bio Example' }, { id: 'tipmenu', label: 'Tip Menu Example' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="ps-btn"
            style={{
              padding: '8px 16px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 12.5,
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
          <Card style={{ padding: 18 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <Badge color={T.cyan}>{bioExample.platform}</Badge>
              <Badge color={T.pink}>{bioExample.persona}</Badge>
              <Badge color={T.gold}>{bioExample.tone}</Badge>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.65, color: T.soft, marginBottom: 12 }}>"{bioExample.text}"</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: T.faint, marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <span>{bioExample.text.length} characters</span>
              <span>CTA: {bioExample.cta}</span>
            </div>
            <div style={{ fontSize: 11, color: T.faint }}>Approved activities only: {bioExample.activities}</div>
          </Card>
        </>
      ) : (
        <>
          <PresetTabs options={TIP_MENU_EXAMPLES} value={menuExampleId} onChange={setMenuExampleId} />
          <Card style={{ padding: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.white, marginBottom: 4 }}>{menuExample.label}</div>
            <div style={{ fontSize: 11.5, color: T.cyan, marginBottom: 12, fontWeight: 600 }}>Payout assumption: {menuExample.payout}</div>
            {menuExample.items.map(item => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '7px 0', borderBottom: `1px solid ${T.borderSoft}` }}>
                <div>
                  <span style={{ color: T.soft }}>{item.name}</span>
                  <span style={{ color: T.faint, fontSize: 10, marginLeft: 8 }}>{item.tier}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: T.cyan, fontWeight: 700 }}>{item.price}</span>
                  <span style={{ color: T.faint, fontSize: 11 }}>{item.usd}</span>
                  <Badge color={item.vis === 'Public' ? T.green : T.gold} style={{ fontSize: 9 }}>{item.vis}</Badge>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 12, fontSize: 11.5, color: T.muted, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '9px 12px' }}>
              Estimated earnings shown per item · {menuExample.rules}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

// ── How it works ─────────────────────────────────────────────────────────
export function HowItWorksCompact() {
  return (
    <ol style={{ margin: 0, paddingLeft: 20, color: T.muted, fontSize: 13.5, lineHeight: 2 }}>
      <li><strong style={{ color: T.white }}>Tell us about your brand.</strong> Select your persona, tone, platform, services, and boundaries.</li>
      <li><strong style={{ color: T.white }}>Choose a bio or tip-menu format.</strong> Pick from 15 bio formats or 14 tip-menu types, each with its own generation rules.</li>
      <li><strong style={{ color: T.white }}>Generate, edit, copy, or save.</strong> Adjust wording, pricing, and order before you use it.</li>
    </ol>
  )
}

// ── Supported platforms and formats ─────────────────────────────────────────
const PLATFORM_FORMAT_NOTES = [
  { platform: 'Chaturbate', note: 'Room personality, show style, schedule, menu direction, favorite-room CTA.' },
  { platform: 'MyFreeCams', note: 'Personality, club appeal, room expectations, member-focused wording.' },
  { platform: 'BongaCams', note: 'Concise, interaction-focused, public/private options, favorites.' },
  { platform: 'Stripchat', note: 'Interactive room energy, games, goals, show type, follow CTA.' },
  { platform: 'CamSoda', note: 'Lively and social, entertainment style, audience participation.' },
  { platform: 'OnlyFans', note: 'Subscription-focused, content style, subscribe CTA — no room pricing.' },
  { platform: 'Fansly', note: 'Niche and content-forward, built for tiered subscriptions.' },
  { platform: 'X', note: 'Short, attention-grabbing, clear identity, link-oriented CTA.' },
  { platform: 'Instagram', note: 'Social-safe, avoids explicit room details, brand and link focus.' },
]

export function SupportedFormatsCompact() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 20 }}>
        {PLATFORM_FORMAT_NOTES.map(p => (
          <div key={p.platform} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderSoft}` }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: T.cyan, marginBottom: 3 }}>{p.platform}</div>
            <div style={{ fontSize: 11, color: T.faint, lineHeight: 1.4 }}>{p.note}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.cyan, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>15 bio formats</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {BIO_FORMATS.map(f => <Badge key={f.id} color={T.cyan}>{f.label}</Badge>)}
          <Badge color={T.gold}>Existing Bio Audit &amp; Rewrite</Badge>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.pink, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>14 tip menu types</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {MENU_STYLES.map(s => <Badge key={s.id} color={T.pink}>{s.label}</Badge>)}
        </div>
      </div>
    </div>
  )
}

// ── Privacy, safety, and boundaries ────────────────────────────────────────
export function PrivacyCompact() {
  return (
    <ul style={{ margin: 0, paddingLeft: 20, color: T.muted, fontSize: 13.5, lineHeight: 1.9 }}>
      <li>You control your boundaries — only approved services and activities can appear in generated output.</li>
      <li>You never need to enter your legal name, exact address, phone number, or other personal contact information.</li>
      <li>The generator won't intentionally add a service, activity, or promise you didn't approve.</li>
      <li>Every result is editable before you use it.</li>
    </ul>
  )
}

// ── Why use a creator-specific generator? ──────────────────────────────────
export function ComparisonCompact() {
  const labels = [
    'Uses your persona', 'Includes only approved services', 'Adds a purpose-driven CTA',
    'Matches platform format', 'Respects boundaries', 'Avoids invented claims',
  ]
  return (
    <div>
      <p style={{ fontSize: 13, color: T.faint, marginBottom: 8, lineHeight: 1.6 }}>
        Generic AI: <em style={{ color: T.muted, fontStyle: 'italic' }}>"Hey, I'm fun and flirty and love meeting new people. Come chat with me!"</em>
      </p>
      <p style={{ fontSize: 13, color: T.soft, marginBottom: 14, lineHeight: 1.6 }}>
        CamCash: <em style={{ fontStyle: 'italic' }}>"Bratty, playful, and always up for a game — I stream weeknights and love a good tip-goal challenge. Favorite my room so you don't miss it, and check my tip menu for tonight's games."</em>
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
        {labels.map(l => <span key={l} style={{ fontSize: 12, color: T.green }}>✓ {l}</span>)}
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
      'Only the services you actually offer, stated clearly',
      'A specific call to action, not just "come chat"',
    ],
  },
  {
    title: 'How to Price a Cam Tip Menu', points: [
      'Entry-level items should be quick and low-effort',
      'Premium items should reflect real effort, duration, or exclusivity',
      'Factor in your actual payout rate, not just the token number',
      'Avoid underpricing anything that takes several minutes',
    ],
  },
  {
    title: 'Common Tip Menu Mistakes', points: [
      'Too many cheap items and nothing for bigger spenders',
      'A multi-minute action priced like a 10-second reaction',
      'No stated rules for custom requests or refunds',
      'Treating the token count as the dollar amount instead of converting it',
    ],
  },
  {
    title: 'Public Versus Private Menu Items', points: [
      'Public items should be things you\'re comfortable performing in front of the whole room',
      'Anything more intense or exclusive belongs private-only',
      'Custom requests should require your approval before being accepted',
      'Being explicit about what\'s public vs. private avoids awkward mid-show surprises',
    ],
  },
]

export function WrittenGuides() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
      {ARTICLES.map(a => (
        <div key={a.title}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: T.white, marginBottom: 8 }}>{a.title}</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: T.muted, fontSize: 12.5, lineHeight: 1.7 }}>
            {a.points.map(p => <li key={p}>{p}</li>)}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ── FAQ ────────────────────────────────────────────────────────────────────
export function FAQSection() {
  const [open, setOpen] = useState(null)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.cyan, marginBottom: 14 }}>FAQ</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {FAQS.map((f, i) => (
          <div key={f.q} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="ps-btn"
              style={{ width: '100%', textAlign: 'left', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 700, color: T.white }}>{f.q}</span>
              <span style={{ color: T.cyan, fontSize: 18, transform: open === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s' }}>+</span>
            </button>
            {open === i && <div style={{ padding: '0 18px 14px' }}><p style={{ fontSize: 13, lineHeight: 1.7, color: T.muted, margin: 0 }}>{f.a}</p></div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Final CTA ──────────────────────────────────────────────────────────────
export function FinalCTA({ onGoTo }) {
  return (
    <Card highlight style={{ textAlign: 'center', padding: '32px 24px' }}>
      <h2 style={{ fontSize: 'clamp(19px,2.4vw,24px)', fontWeight: 900, color: T.white, marginBottom: 8, letterSpacing: '-0.02em' }}>Ready to Build Your Creator Profile?</h2>
      <p style={{ fontSize: 13.5, color: T.muted, marginBottom: 18, maxWidth: 420, margin: '0 auto 18px' }}>Free to generate, no account required to try it.</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <PrimaryButton onClick={() => onGoTo('bio')}>Generate My Bio</PrimaryButton>
        <SecondaryButton onClick={() => onGoTo('tipmenu')}>Create My Tip Menu</SecondaryButton>
      </div>
    </Card>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import Button from '../../components/ui/Button'
import SiteFooter from '../components/SiteFooter'
import { PRODUCTS, getProductBySlug } from '../../lib/shop-products'

// ─── Design tokens (matches CamCashGrl brand system) ───────────────────────
const C = {
  cyan: '#16F4FF',
  cyanSoft: '#48E9FF',
  pink: '#FF2BAE',
  purple: '#7C5CFF',
  gold: '#FFC857',
  white: '#FFFFFF',
  text: '#D7D9EA',
  muted: '#8D93AA',
  faint: '#5E647C',
  card: 'rgba(12,16,34,0.78)',
  cardSoft: 'rgba(13,17,38,0.72)',
  border: 'rgba(255,255,255,0.09)',
  grad: 'linear-gradient(90deg,#16F4FF 0%,#55B8FF 28%,#7C5CFF 52%,#FF2BAE 100%)',
}

const PDF_URL = '/downloads/vip-client-mini-tracker.pdf'
const IMG = (name) => `/blog-images/vip-tracker/${name}`

const FULL_PRODUCT = getProductBySlug('vip-client-tracker-1299') || PRODUCTS[0]

const GALLERY = [
  { src: IMG('page-master-list-web.jpg'), lg: IMG('page-master-list-lg.jpg'), alt: 'VIP Master List page' },
  { src: IMG('page-tip-spending-web.jpg'), lg: IMG('page-tip-spending-lg.jpg'), alt: 'Tip & Spending History page' },
  { src: IMG('page-session-log-web.jpg'), lg: IMG('page-session-log-lg.jpg'), alt: 'Streaming Session Log page' },
]

const FEATURES = [
  { icon: '👑', title: 'VIP Master List', desc: 'Keep all of your regulars and highest-value clients organized in one place.' },
  { icon: '🗒️', title: 'VIP Profile', desc: 'Record creator-safe notes, preferences, communication details, favorite platforms, and relationship history.' },
  { icon: '🎥', title: 'Streaming Session Log', desc: 'Track your streaming schedule, hours, earnings, and top supporters to identify your most productive sessions.' },
  { icon: '💸', title: 'Tip & Spending History', desc: 'Log purchases, tips, and important spending milestones over time.' },
  { icon: '📊', title: 'Platform Tip Tracker', desc: 'Compare activity across different platforms and monitor your earnings at a glance.' },
]

const WHY_POINTS = [
  'Stay organized',
  'Remember important client details',
  'Track your best sessions',
  'Spot spending trends',
  'Build stronger repeat relationships',
  'Works as a printable PDF',
  'Editable in Canva',
  'Creator-safe layouts',
]

const FREE_TOOLS = [
  {
    icon: '💰',
    title: 'Token Calculator',
    desc: 'Convert tokens into real earnings instantly.',
    href: '/guides/cam-model-token-calculator',
    accent: C.cyan,
  },
  {
    icon: '✏️',
    title: 'Room Title Generator',
    desc: 'Generate better room titles for your streams.',
    href: '/guides/cam-model-room-title-generator',
    accent: C.pink,
  },
  {
    icon: '#️⃣',
    title: 'Hashtag Generator',
    desc: 'Create optimized hashtags in seconds.',
    href: '/guides/cam-model-room-title-generator?tab=hashtags',
    accent: C.purple,
  },
]

const UPGRADE_GALLERY = [
  { src: IMG('full-cover-web.jpg'), lg: IMG('full-cover-lg.jpg'), alt: 'Pretty Profitz VIP Client Tracker cover' },
  { src: IMG('full-whats-included-web.jpg'), lg: IMG('full-whats-included-lg.jpg'), alt: "What's included in the full VIP Client Tracker" },
  { src: IMG('full-charts-web.jpg'), lg: IMG('full-charts-lg.jpg'), alt: 'Monthly VIP Overview and VIP Relationship Scorecard pages' },
  { src: IMG('full-master-list-preview-web.jpg'), lg: IMG('full-master-list-preview-lg.jpg'), alt: 'VIP Master List page from the full workbook' },
]

const UPGRADE_BULLETS = [
  '30+ Premium Creator Business Worksheets',
  'Monthly Overview Dashboard',
  'VIP Relationship Scorecards',
  'Follow-Up Planner',
  'Re-Engagement Planner',
  'VIP Tier Builder',
  'Revenue & Earnings Logs',
  'Creator Response & Boundary Templates',
  'Printable PDF',
  'Editable Canva Template',
]

const ETSY_PROMO_CODE = 'PRETTY20'

const CAMCASH_PLATFORMS = ['Chaturbate', 'BongaCams', 'MyFreeCams', 'Stripchat', 'CamSoda']

const CAMCASH_QUICK_POINTS = [
  'Free analytics dashboard for cam models',
  'Upload a CSV — see results instantly',
  'Know your top tippers & best hours',
  'Compare Chaturbate, BongaCams, MyFreeCams & more',
  'Start free · Pro from $19.99/mo',
]

const CAMCASH_SCREENSHOTS = [
  { src: '/blog-images/camcash-earnings-stats.webp', alt: 'CamCash dashboard showing monthly earnings, average $/hour, return rate, and tonight\'s forecast' },
  { src: '/blog-images/camcash-best-hours-heatmap.webp', alt: 'CamCash revenue timing and platform ROI heatmap by day of week' },
  { src: '/blog-images/camcash-fan-intelligence.webp', alt: 'CamCash Fan Intelligence panel showing top VIP fans and lifetime spend' },
]

const CAMCASH_FREE_FEATURES = [
  'Track 1 cam platform',
  'Upload tip history by CSV',
  'Basic earnings dashboard & session analytics',
  'Live tip detection & real-time alerts',
  'Basic Live Mode coaching',
  'Top 3 fans & basic fan insights',
]

const CAMCASH_PRO_FEATURES = [
  'Track all supported platforms at once',
  'Full permanent tip history',
  'Full fan profiles & CRM tools',
  'Cross-platform earnings comparisons',
  'Advanced Live Mode coaching',
  'Private-session analytics',
  'Churn & re-engagement insights',
  'Full best-time analysis, Stream Planner & Money Map',
  'Advanced recommendations & reports',
]

const FAQS = [
  { q: 'Is it free?', a: 'Yes. The VIP Client Mini Tracker is completely free to download, with no signup or email required.' },
  { q: 'Can I edit it in Canva?', a: 'Yes. The tracker is designed to work as an editable Canva template as well as a printable PDF, so you can customize colors, fonts, and layout.' },
  { q: 'Does it work on mobile?', a: 'Yes. You can fill it out digitally on your phone or tablet, or print it out and fill it in by hand.' },
  { q: 'Can I print it?', a: 'Yes. It is formatted as a print-ready PDF that works on standard letter-size paper.' },
  { q: 'What information should I record?', a: 'Track usernames, platforms, preferences, boundaries, session notes, tips, and spending patterns — keep it creator-safe and only record what helps you serve your VIPs better.' },
  { q: 'What is CamCash?', a: 'CamCash is a free analytics dashboard for cam models and content creators. Upload a tip history CSV from Chaturbate, BongaCams, MyFreeCams, Stripchat, or CamSoda and CamCash automatically shows your top tippers, peak earning hours, best-performing sessions, and platform comparisons.' },
  { q: 'Is CamCash free to use?', a: 'Yes. CamCash has a free tier forever — track one platform, upload CSVs, and see a basic earnings dashboard with no credit card required. The Pro tier ($19.99/mo or $99/yr) unlocks all platforms, full tip history, advanced fan CRM tools, and more.' },
]

// ─── Small building blocks ──────────────────────────────────────────────────
function SectionLabel({ children, color = C.cyan }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color,
        marginBottom: 14,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  )
}

function Sparkles({ active }) {
  if (!active) return null
  const dots = Array.from({ length: 22 })
  return (
    <span
      aria-hidden="true"
      style={{ position: 'absolute', inset: -30, pointerEvents: 'none', overflow: 'visible' }}
    >
      {dots.map((_, i) => {
        const angle = (i / dots.length) * Math.PI * 2
        const dist = 60 + Math.random() * 70
        const x = Math.cos(angle) * dist
        const y = Math.sin(angle) * dist
        const size = 3 + Math.random() * 4
        const colors = [C.cyan, C.pink, C.gold, C.white, C.purple]
        const color = colors[i % colors.length]
        const delay = Math.random() * 0.15
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: size,
              height: size,
              borderRadius: '50%',
              background: color,
              boxShadow: `0 0 8px ${color}`,
              '--tx': `${x}px`,
              '--ty': `${y}px`,
              animation: `vip-spark 0.9s ease-out ${delay}s forwards`,
            }}
          />
        )
      })}
    </span>
  )
}

function DownloadButton({ size = 'large' }) {
  const [burst, setBurst] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  const handleClick = useCallback(() => {
    setBurst(true)
    setDownloaded(true)
    setTimeout(() => setBurst(false), 950)
  }, [])

  const big = size === 'large'

  return (
    <a
      href={PDF_URL}
      download
      onClick={handleClick}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: big ? '18px 40px' : '14px 28px',
        borderRadius: 18,
        fontSize: big ? 18 : 15,
        fontWeight: 850,
        color: '#FFFFFF',
        textDecoration: 'none',
        background: C.grad,
        boxShadow:
          '0 0 26px rgba(22,244,255,0.28), 0 0 36px rgba(255,43,174,0.26), 0 16px 38px rgba(0,0,0,0.45)',
        transition: 'transform 180ms ease, box-shadow 180ms ease, filter 180ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.filter = 'brightness(1.06)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.filter = ''
      }}
    >
      <Sparkles active={burst} />
      {downloaded ? '✨ Downloaded — Enjoy!' : '⬇ Download Free PDF'}
    </a>
  )
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 22,
        padding: '28px 24px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 42px rgba(0,0,0,0.28)',
        transition: 'transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-6px)'
        e.currentTarget.style.borderColor = 'rgba(22,244,255,0.5)'
        e.currentTarget.style.boxShadow =
          '0 0 0 1px rgba(22,244,255,0.2), 0 0 30px rgba(22,244,255,0.22), 0 22px 46px rgba(0,0,0,0.35)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.borderColor = C.border
        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 42px rgba(0,0,0,0.28)'
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          display: 'grid',
          placeItems: 'center',
          fontSize: 24,
          marginBottom: 16,
          background: 'linear-gradient(135deg, rgba(22,244,255,0.16), rgba(255,43,174,0.16))',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {icon}
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 800, color: C.white, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
        {title}
      </h3>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: C.text, margin: 0 }}>{desc}</p>
    </div>
  )
}

function CheckItem({ children }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
      <span
        style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'rgba(22,244,255,0.14)',
          border: `1px solid ${C.cyan}`,
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          color: C.cyan,
          marginTop: 1,
        }}
      >
        ✓
      </span>
      <span style={{ fontSize: 15.5, color: C.text, lineHeight: 1.5 }}>{children}</span>
    </li>
  )
}

function ToolCard({ icon, title, desc, href, accent }) {
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        borderRadius: 22,
        padding: '32px 26px',
        background: `linear-gradient(160deg, ${accent}14, rgba(12,16,34,0.85))`,
        border: `1px solid ${accent}40`,
        transition: 'transform 200ms ease, border-color 200ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.borderColor = accent
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.borderColor = `${accent}40`
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontSize: 19, fontWeight: 800, color: C.white, margin: '0 0 8px' }}>{title}</h3>
      <p style={{ fontSize: 14.5, color: C.text, lineHeight: 1.6, margin: '0 0 20px', flex: 1 }}>{desc}</p>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          padding: '10px 18px',
          borderRadius: 12,
          fontSize: 13.5,
          fontWeight: 800,
          color: '#06101A',
          background: accent,
        }}
      >
        Try Tool →
      </span>
    </a>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      style={{
        borderRadius: 18,
        border: `1px solid ${C.border}`,
        background: C.cardSoft,
        overflow: 'hidden',
        marginBottom: 12,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '18px 22px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 700, color: C.white }}>{q}</span>
        <span
          style={{
            flexShrink: 0,
            width: 26,
            height: 26,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: C.cyan,
            border: `1px solid ${C.cyan}`,
            fontSize: 15,
            transform: open ? 'rotate(45deg)' : 'none',
            transition: 'transform 180ms ease',
          }}
        >
          +
        </span>
      </button>
      {open && (
        <p style={{ margin: 0, padding: '0 22px 20px', fontSize: 14.5, lineHeight: 1.65, color: C.text }}>{a}</p>
      )}
    </div>
  )
}

function Lightbox({ item, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!item) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(4,6,16,0.86)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <img
        src={item.lg}
        alt={item.alt}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 'min(92vw, 640px)',
          maxHeight: '90vh',
          borderRadius: 18,
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 0 40px rgba(22,244,255,0.22), 0 30px 80px rgba(0,0,0,0.6)',
        }}
      />
      <button
        onClick={onClose}
        aria-label="Close preview"
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: C.white,
          fontSize: 18,
          cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────
export default function FreeVipTrackerClient() {
  const [lightboxItem, setLightboxItem] = useState(null)
  const [activeUpgradeImg, setActiveUpgradeImg] = useState(0)

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 18% 30%, rgba(0,229,255,0.20), transparent 34%), radial-gradient(circle at 82% 45%, rgba(255,43,174,0.22), transparent 36%), radial-gradient(circle at 50% 0%, rgba(124,92,255,0.12), transparent 42%), linear-gradient(135deg, #050713 0%, #080B1A 48%, #120719 100%)',
        color: C.white,
      }}
    >
      <style>{`
        @keyframes vip-spark {
          0%   { transform: translate(-50%,-50%) translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(-50%,-50%) translate(var(--tx),var(--ty)) scale(0); opacity: 0; }
        }
        .vip-grid-5 { display:grid; grid-template-columns: repeat(5,1fr); gap:20px; }
        .vip-grid-3 { display:grid; grid-template-columns: repeat(3,1fr); gap:24px; }
        .vip-hero { display:grid; grid-template-columns: 1.05fr 0.95fr; gap:48px; align-items:center; }
        @media (max-width: 980px) {
          .vip-grid-5 { grid-template-columns: repeat(2,1fr); }
          .vip-grid-3 { grid-template-columns: 1fr; }
          .vip-hero { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .vip-grid-5 { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Top bar */}
      <div
        style={{
          borderBottom: `1px solid ${C.border}`,
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <a href="/" style={{ textDecoration: 'none', fontWeight: 800, fontSize: 16, color: C.white, letterSpacing: '-0.2px' }}>
          💜 CamCash
        </a>
        <Button as="a" href="/login" style={{ padding: '9px 20px', fontSize: 13 }}>
          Start Free →
        </Button>
      </div>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '64px 24px 40px' }}>
        <div className="vip-hero">
          <div>
            <div
              style={{
                display: 'inline-block',
                fontSize: 12.5,
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: C.gold,
                background: 'rgba(255,200,87,0.1)',
                border: '1px solid rgba(255,200,87,0.3)',
                borderRadius: 999,
                padding: '6px 14px',
                marginBottom: 20,
              }}
            >
              100% Free · No Signup Required
            </div>
            <h1
              style={{
                fontSize: 'clamp(34px, 5vw, 54px)',
                fontWeight: 850,
                letterSpacing: '-0.04em',
                lineHeight: 1.06,
                margin: '0 0 20px',
                textShadow: '0 0 30px rgba(255,255,255,0.08)',
              }}
            >
              Free VIP Client{' '}
              <span
                style={{
                  background: C.grad,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Mini Tracker
              </span>
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.6, color: C.text, margin: '0 0 32px', maxWidth: 520 }}>
              Stay organized, keep better client notes, and track your streaming business with this free
              printable workbook and editable Canva template.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
              <DownloadButton />
              <Button as="a" href="/tools" variant="secondary" style={{ padding: '18px 30px', fontSize: 15 }}>
                View Free Creator Tools
              </Button>
            </div>
            <p style={{ fontSize: 13.5, color: C.faint, margin: 0 }}>
              No signup required · Printable PDF · Editable Canva template
            </p>
          </div>

          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: 'min(100%, 380px)' }}>
              {/* fanned pages behind */}
              <img
                src={IMG('page-master-list-web.jpg')}
                alt=""
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 22,
                  left: -34,
                  width: '86%',
                  borderRadius: 14,
                  transform: 'rotate(-10deg)',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.55)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  opacity: 0.85,
                }}
              />
              <img
                src={IMG('page-session-log-web.jpg')}
                alt=""
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 22,
                  right: -34,
                  width: '86%',
                  borderRadius: 14,
                  transform: 'rotate(10deg)',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.55)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  opacity: 0.85,
                }}
              />
              <img
                src={IMG('cover-web.jpg')}
                alt="VIP Client Mini Tracker cover"
                style={{
                  position: 'relative',
                  width: '100%',
                  borderRadius: 18,
                  border: '1px solid rgba(255,255,255,0.14)',
                  boxShadow:
                    '0 0 0 1px rgba(22,244,255,0.18), 0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(255,43,174,0.18)',
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────── */}
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 24px' }}>
        <SectionLabel>What's Included</SectionLabel>
        <h2
          style={{
            fontSize: 'clamp(26px, 3.4vw, 36px)',
            fontWeight: 800,
            textAlign: 'center',
            margin: '0 0 40px',
            letterSpacing: '-0.02em',
          }}
        >
          Everything you need to manage your VIPs
        </h2>
        <div className="vip-grid-5">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </section>

      {/* ── WORKBOOK PREVIEW ───────────────────────────────────── */}
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 24px' }}>
        <SectionLabel color={C.pink}>Take A Look Inside</SectionLabel>
        <h2 style={{ fontSize: 'clamp(26px, 3.4vw, 36px)', fontWeight: 800, textAlign: 'center', margin: '0 0 40px', letterSpacing: '-0.02em' }}>
          Workbook Preview
        </h2>
        <div className="vip-grid-3">
          {GALLERY.map((item) => (
            <button
              key={item.src}
              onClick={() => setLightboxItem(item)}
              style={{
                padding: 0,
                border: `1px solid ${C.border}`,
                borderRadius: 20,
                overflow: 'hidden',
                cursor: 'zoom-in',
                background: C.cardSoft,
                boxShadow: '0 18px 42px rgba(0,0,0,0.32)',
                transition: 'transform 200ms ease, box-shadow 200ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px)'
                e.currentTarget.style.boxShadow = '0 0 26px rgba(22,244,255,0.22), 0 24px 50px rgba(0,0,0,0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = ''
                e.currentTarget.style.boxShadow = '0 18px 42px rgba(0,0,0,0.32)'
              }}
            >
              <img
                src={item.src}
                alt={item.alt}
                loading="lazy"
                style={{ width: '100%', display: 'block' }}
              />
            </button>
          ))}
        </div>
      </section>

      {/* ── WHY USE IT ─────────────────────────────────────────── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>
        <div
          style={{
            borderRadius: 26,
            border: `1px solid ${C.border}`,
            background:
              'radial-gradient(circle at 0% 0%, rgba(22,244,255,0.12), transparent 42%), radial-gradient(circle at 100% 100%, rgba(255,43,174,0.10), transparent 46%), rgba(12,16,34,0.82)',
            padding: '44px 40px',
          }}
        >
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 800, margin: '0 0 26px', letterSpacing: '-0.02em', textAlign: 'center' }}>
            Designed for Serious Creators
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, columns: 2, columnGap: 32 }}>
            {WHY_POINTS.map((p) => (
              <CheckItem key={p}>{p}</CheckItem>
            ))}
          </ul>
        </div>
      </section>

      {/* ── DOWNLOAD CTA ───────────────────────────────────────── */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px', textAlign: 'center' }}>
        <div
          style={{
            borderRadius: 30,
            padding: '1px',
            background: 'linear-gradient(135deg, rgba(22,244,255,0.95), rgba(124,92,255,0.45), rgba(255,43,174,0.95))',
            boxShadow: '-20px 0 70px rgba(22,244,255,0.18), 20px 0 70px rgba(255,43,174,0.2), 0 30px 90px rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              borderRadius: 29,
              background: 'rgba(8,11,26,0.94)',
              padding: '52px 36px',
            }}
          >
            <h2 style={{ fontSize: 'clamp(26px, 3.4vw, 36px)', fontWeight: 850, margin: '0 0 14px', letterSpacing: '-0.03em' }}>
              Download Your Free VIP Client Mini Tracker
            </h2>
            <p style={{ fontSize: 15.5, color: C.text, margin: '0 0 30px' }}>
              Instant download. No email, no account, no catch.
            </p>
            <DownloadButton />
            <p style={{ marginTop: 22, fontSize: 13.5, color: C.faint }}>
              No signup required. &nbsp;·&nbsp; Printable PDF. &nbsp;·&nbsp; Editable Canva template.
            </p>
          </div>
        </div>
      </section>

      {/* ── FREE TOOLS ─────────────────────────────────────────── */}
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 24px' }}>
        <SectionLabel>Free Creator Tools</SectionLabel>
        <h2 style={{ fontSize: 'clamp(26px, 3.4vw, 36px)', fontWeight: 800, textAlign: 'center', margin: '0 0 40px', letterSpacing: '-0.02em' }}>
          More free tools to grow your business
        </h2>
        <div className="vip-grid-3">
          {FREE_TOOLS.map((t) => (
            <ToolCard key={t.title} {...t} />
          ))}
        </div>
      </section>

      {/* ── UPGRADE ────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '48px 24px' }}>
        <SectionLabel color={C.gold}>Level Up</SectionLabel>
        <h2 style={{ fontSize: 'clamp(26px, 3.4vw, 36px)', fontWeight: 800, textAlign: 'center', margin: '0 0 40px', letterSpacing: '-0.02em' }}>
          Ready for the Complete Workbook?
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 320px) 1fr',
            gap: 36,
            alignItems: 'center',
            borderRadius: 26,
            border: `1px solid ${C.border}`,
            background: C.card,
            padding: 32,
          }}
          className="vip-upgrade-card"
        >
          <div>
            <button
              onClick={() => setLightboxItem(UPGRADE_GALLERY[activeUpgradeImg])}
              style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'zoom-in' }}
            >
              <img
                src={UPGRADE_GALLERY[activeUpgradeImg].src}
                alt={UPGRADE_GALLERY[activeUpgradeImg].alt}
                loading="lazy"
                style={{
                  width: '100%',
                  borderRadius: 18,
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                }}
              />
            </button>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {UPGRADE_GALLERY.map((img, i) => (
                <button
                  key={img.src}
                  onClick={() => setActiveUpgradeImg(i)}
                  style={{
                    flex: 1,
                    padding: 0,
                    borderRadius: 10,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: 'rgba(5,9,24,0.72)',
                    border: i === activeUpgradeImg ? `2px solid ${C.cyan}` : '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <img src={img.src} alt="" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: C.white, margin: '0 0 6px' }}>
              Pretty Profitz VIP Client Tracker
            </h3>
            <p style={{ fontSize: 15, color: C.muted, margin: '0 0 20px' }}>
              Client organization, business tracking, client management, and creator resources — everything
              in the mini tracker, plus a complete system for growing VIP relationships.
            </p>
            <ul style={{ listStyle: 'none', margin: '0 0 26px', padding: 0, columns: 2, columnGap: 24 }}>
              {UPGRADE_BULLETS.map((b) => (
                <li key={b} style={{ fontSize: 14, color: C.text, marginBottom: 10, display: 'flex', gap: 8 }}>
                  <span style={{ color: C.gold }}>★</span> {b}
                </li>
              ))}
            </ul>
            <a
              href={FULL_PRODUCT.etsyUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '16px 34px',
                borderRadius: 16,
                fontSize: 16,
                fontWeight: 800,
                color: C.white,
                textDecoration: 'none',
                background: C.grad,
                boxShadow: '0 0 24px rgba(22,244,255,0.28), 0 0 34px rgba(255,43,174,0.26), 0 14px 34px rgba(0,0,0,0.45)',
              }}
            >
              View on Etsy →
            </a>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 800,
                  color: C.gold,
                  background: 'rgba(255,200,87,0.1)',
                  border: '1px solid rgba(255,200,87,0.3)',
                  borderRadius: 999,
                  padding: '7px 14px',
                }}
              >
                🎁 Use code <strong>{ETSY_PROMO_CODE}</strong> for 20% off at Etsy checkout
              </span>
              <a href="/shop" style={{ fontSize: 13.5, fontWeight: 700, color: C.cyan, textDecoration: 'none' }}>
                Browse the full Pretty Profitz shop →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT IS CAMCASH ────────────────────────────────────── */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 24px 48px' }} aria-labelledby="what-is-camcash">
        <div
          style={{
            borderRadius: 26,
            border: '1px solid rgba(22,244,255,0.28)',
            background: 'linear-gradient(135deg, rgba(22,244,255,0.08), rgba(255,43,174,0.08))',
            padding: '44px 40px',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h2 id="what-is-camcash" style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              Skip the spreadsheets. Try CamCash.
            </h2>
            <p style={{ fontSize: 15.5, color: C.text, margin: 0 }}>
              Trackers are great for client notes. For your actual numbers, CamCash does the math for you.
            </p>
          </div>

          <div className="vip-camcash-intro" style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: 28, alignItems: 'center', marginBottom: 36 }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {CAMCASH_QUICK_POINTS.map((p) => (
                <li key={p} style={{ display: 'flex', gap: 10, fontSize: 15, color: C.text, marginBottom: 13, lineHeight: 1.4 }}>
                  <span style={{ color: C.cyan, flexShrink: 0, fontWeight: 800 }}>✓</span> {p}
                </li>
              ))}
            </ul>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              {CAMCASH_SCREENSHOTS.map((s) => (
                <img
                  key={s.src}
                  src={s.src}
                  alt={s.alt}
                  loading="lazy"
                  style={{
                    width: '100%',
                    borderRadius: 14,
                    border: `1px solid ${C.border}`,
                    boxShadow: '0 14px 34px rgba(0,0,0,0.35)',
                    display: 'block',
                  }}
                />
              ))}
            </div>
          </div>

          <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.cyan, textAlign: 'center', margin: '0 0 14px' }}>
            Platforms We Support
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 36 }}>
            {CAMCASH_PLATFORMS.map((p) => (
              <span
                key={p}
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: C.white,
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${C.border}`,
                  borderRadius: 999,
                  padding: '8px 16px',
                }}
              >
                {p}
              </span>
            ))}
          </div>

          <div className="vip-tier-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
            <div style={{ borderRadius: 20, border: `1px solid ${C.border}`, background: C.cardSoft, padding: '24px 22px' }}>
              <h3 style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.cyan, margin: '0 0 4px' }}>
                Free Tier
              </h3>
              <p style={{ fontSize: 22, fontWeight: 800, color: C.white, margin: '0 0 16px' }}>$0 / forever</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {CAMCASH_FREE_FEATURES.map((f) => (
                  <li key={f} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: C.text, marginBottom: 9, lineHeight: 1.5 }}>
                    <span style={{ color: C.cyan, flexShrink: 0 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ borderRadius: 20, border: `1px solid rgba(255,43,174,0.4)`, background: C.cardSoft, padding: '24px 22px' }}>
              <h3 style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.pink, margin: '0 0 4px' }}>
                Pro Tier
              </h3>
              <p style={{ fontSize: 22, fontWeight: 800, color: C.white, margin: '0 0 16px' }}>$19.99 / mo <span style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>or $99/yr</span></p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {CAMCASH_PRO_FEATURES.map((f) => (
                  <li key={f} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: C.text, marginBottom: 9, lineHeight: 1.5 }}>
                    <span style={{ color: C.pink, flexShrink: 0 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Button as="a" href="/login" style={{ padding: '16px 34px', fontSize: 16 }}>
              Start Free with CamCash →
            </Button>
            <p style={{ fontSize: 13, color: C.faint, margin: '14px 0 0' }}>
              No credit card required. See full plan details on the{' '}
              <a href="/pricing" style={{ color: C.cyan, textDecoration: 'none' }}>pricing page</a>.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '24px 24px 48px' }}>
        <SectionLabel>FAQ</SectionLabel>
        <h2 style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 800, textAlign: 'center', margin: '0 0 32px', letterSpacing: '-0.02em' }}>
          Questions? We've got answers.
        </h2>
        {FAQS.map((f) => (
          <FaqItem key={f.q} q={f.q} a={f.a} />
        ))}
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px 90px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(28px, 3.6vw, 40px)', fontWeight: 850, margin: '0 0 26px', letterSpacing: '-0.03em' }}>
          Start Organizing Your VIP Clients Today
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
          <DownloadButton />
          <Button as="a" href="/tools" variant="secondary" style={{ padding: '18px 30px', fontSize: 15 }}>
            Browse Creator Tools
          </Button>
        </div>
      </section>

      <Lightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />

      <style>{`
        @media (max-width: 720px) {
          .vip-upgrade-card { grid-template-columns: 1fr !important; }
          .vip-tier-grid { grid-template-columns: 1fr !important; }
          .vip-camcash-intro { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <SiteFooter />
    </div>
  )
}

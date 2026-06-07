'use client'
import { useState } from 'react'

const S = {
  bg:         '#0F1117',
  surface:    '#1A1F2E',
  card:       '#1E2435',
  border:     'rgba(255,255,255,0.07)',
  text:       '#8B92A0',
  textMid:    '#C1C7D4',
  textStrong: '#F0F2F6',
  accent:     '#6366F1',
  accentSoft: 'rgba(99,102,241,0.12)',
  green:      '#10B981',
  pink:       '#EC4899',
  gradient:   'linear-gradient(135deg, #6366F1, #EC4899)',
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      borderBottom: `1px solid ${S.border}`,
      paddingBottom: 12, marginBottom: 12,
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', textAlign: 'left', background: 'none', border: 'none',
        cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: 12, padding: 0,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: S.textStrong, lineHeight: 1.5 }}>{q}</span>
        <span style={{ color: S.accent, fontSize: 18, flexShrink: 0, marginTop: 1 }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <p style={{ margin: '10px 0 0', fontSize: 14, color: S.textMid, lineHeight: 1.7 }}>{a}</p>
      )}
    </div>
  )
}

export default function BlogLayout({
  title,
  summary,
  author = 'CamCashGrl Team',
  publishedDate,
  lastUpdated,
  faqs = [],
  relatedTools = [],
  relatedBlogs = [],
  relatedGuides = [],
  children,
}) {
  return (
    <div style={{ background: S.bg, minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      {/* Nav */}
      <div style={{
        borderBottom: `1px solid ${S.border}`, padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: S.surface,
      }}>
        <nav aria-label="Breadcrumb">
          <ol style={{ display: 'flex', gap: '6px', alignItems: 'center', listStyle: 'none', margin: 0, padding: 0 }}>
            {[['Home', '/'], ['Blog', '/blog'], [title, null]].map(([label, href], i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {i > 0 && <span style={{ color: S.text, fontSize: '12px' }}>/</span>}
                {href
                  ? <a href={href} style={{ fontSize: '12px', color: S.text, textDecoration: 'none' }}>{label}</a>
                  : <span style={{ fontSize: '12px', color: S.textMid, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>}
              </li>
            ))}
          </ol>
        </nav>
        <a href="/landing" style={{
          padding: '6px 14px', borderRadius: '7px', textDecoration: 'none',
          background: S.gradient, color: '#fff', fontSize: '12px', fontWeight: 700,
        }}>Try GlowMetrics free →</a>
      </div>

      {/* Hero */}
      <div style={{
        padding: 'clamp(40px, 6vw, 72px) 20px clamp(28px, 3vw, 40px)',
        textAlign: 'center',
        background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%)',
        borderBottom: `1px solid ${S.border}`,
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h1 style={{
            fontSize: 'clamp(24px, 4.5vw, 42px)', fontWeight: 900, color: S.textStrong,
            margin: '0 0 14px', letterSpacing: '-0.03em', lineHeight: 1.2,
          }}>{title}</h1>
          <p style={{
            fontSize: 'clamp(14px, 1.8vw, 16px)', color: S.textMid, lineHeight: 1.7,
            margin: '0 0 18px', maxWidth: 580, marginLeft: 'auto', marginRight: 'auto',
          }}>{summary}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', fontSize: 12, color: S.text }}>
            {author && <span>✍️ {author}</span>}
            {publishedDate && <span>📅 {publishedDate}</span>}
            {lastUpdated && <span>🔄 Updated {lastUpdated}</span>}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(28px, 4vw, 48px) 20px' }}>

        {/* Article content */}
        <div style={{
          fontSize: 15, color: S.textMid, lineHeight: 1.8,
        }}>
          {children}
        </div>

        {/* FAQs */}
        {faqs.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: S.textStrong, marginBottom: 20 }}>Frequently asked questions</h2>
            {faqs.map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a} />)}
          </div>
        )}

        {/* Related tools */}
        {relatedTools.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: S.textStrong, marginBottom: 14 }}>Related tools</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {relatedTools.map((t, i) => (
                <a key={i} href={t.href} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 16px', borderRadius: 10, textDecoration: 'none',
                  background: S.card, border: `1px solid ${S.border}`,
                  transition: 'border-color 0.15s',
                }}>
                  <span style={{ fontSize: 22 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: S.textStrong }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: S.text, marginTop: 2 }}>{t.description}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Related articles */}
        {(relatedBlogs.length > 0 || relatedGuides.length > 0) && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: S.textStrong, marginBottom: 14 }}>Keep reading</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              {[...relatedBlogs, ...relatedGuides].map((item, i) => (
                <a key={i} href={item.href} style={{
                  padding: '14px 16px', borderRadius: 10, textDecoration: 'none',
                  background: S.card, border: `1px solid ${S.border}`,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.textStrong, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: S.text, lineHeight: 1.5 }}>{item.description}</div>
                </a>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

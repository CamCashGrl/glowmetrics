// Shared shell for /features/* product landing pages.
// Mirrors the nav/breadcrumb/FAQ/footer structure already established in
// app/guides/* pages, using the real dashboard color tokens from
// app/dashboard/Sidebar.js so these pages feel like the same product,
// not a separate marketing template.
import Button from './ui/Button'

export const T = {
  bg: '#05070f',
  card: '#0d1322',
  border: 'rgba(255,255,255,0.08)',
  borderSoft: 'rgba(255,255,255,0.06)',
  cyan: '#22D3EE',
  pink: '#EC4899',
  gold: '#F59E0B',
  green: '#10B981',
  purple: '#a855f7',
  white: '#F1F5F9',
  muted: '#475569',
  text: '#94A3B8',
}

export const s = {
  h1: { fontSize: 40, fontWeight: 900, color: T.white, lineHeight: 1.15, marginBottom: 18, letterSpacing: '-0.02em' },
  h2: { fontSize: 26, fontWeight: 800, color: T.white, marginBottom: 14, letterSpacing: '-0.01em', marginTop: 0 },
  h3: { fontSize: 17, fontWeight: 700, color: T.white, marginBottom: 8, marginTop: 0 },
  p: { fontSize: 16, lineHeight: 1.8, color: T.text, marginBottom: 16, marginTop: 0 },
  section: { marginBottom: 52 },
  card: { padding: '20px 22px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`, marginBottom: 12 },
}

export function Checklist({ items, color = T.cyan }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 44 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ color, fontWeight: 800, fontSize: 15, lineHeight: 1.55, flexShrink: 0 }}>✓</span>
          <span style={{ fontSize: 15, color: '#CBD5E1', lineHeight: 1.55 }}>{item}</span>
        </div>
      ))}
    </div>
  )
}

export function FaqBlock({ items }) {
  return (
    <div>
      {items.map(({ q, a }, i) => (
        <details key={i} style={{ borderBottom: `1px solid ${T.borderSoft}`, paddingBottom: 16, marginBottom: 16 }}>
          <summary style={{ fontSize: 16, fontWeight: 700, color: T.white, cursor: 'pointer', listStyle: 'none', paddingBottom: 4 }}>{q}</summary>
          <p style={{ ...s.p, marginTop: 10, marginBottom: 0, fontSize: 14 }}>{a}</p>
        </details>
      ))}
    </div>
  )
}

export function faqSchemaFrom(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }
}

export default function FeatureLayout({
  schema = [],
  breadcrumb = [],
  eyebrow,
  h1,
  subhead,
  heroNote,
  primaryCta,
  children,
  faq,
  finalCta,
  related = [],
}) {
  return (
    <>
      {schema.map((obj, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }} />
      ))}

      <div style={{ background: T.bg, minHeight: '100vh', color: T.text, fontFamily: 'Inter, sans-serif' }}>
        <nav style={{ padding: '20px 40px', borderBottom: `1px solid ${T.borderSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="/landing" style={{ fontWeight: 700, fontSize: 15, color: 'white', textDecoration: 'none', letterSpacing: '-0.2px' }}>💜 CamCash</a>
          <Button as="a" href="/login" style={{ padding: '8px 20px', fontSize: 13 }}>Start Free →</Button>
        </nav>

        <article style={{ maxWidth: 820, margin: '0 auto', padding: '60px 24px 100px' }}>
          <nav style={{ marginBottom: 24, fontSize: 13 }} aria-label="breadcrumb">
            <a href="/landing" style={{ color: T.cyan, textDecoration: 'none' }}>Home</a>
            {breadcrumb.map((b, i) => (
              <span key={i}>
                <span style={{ margin: '0 8px', color: T.muted }}>›</span>
                {b.href ? <a href={b.href} style={{ color: T.cyan, textDecoration: 'none' }}>{b.label}</a> : <span style={{ color: T.muted }}>{b.label}</span>}
              </span>
            ))}
          </nav>

          {eyebrow && (
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.cyan, marginBottom: 12 }}>{eyebrow}</div>
          )}
          <h1 style={s.h1}>{h1}</h1>
          <p style={{ fontSize: 19, lineHeight: 1.7, color: '#CBD5E1', marginBottom: 24, paddingLeft: 20, borderLeft: `3px solid ${T.cyan}` }}>
            {subhead}
          </p>

          <div style={{ padding: '20px 24px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(236,72,153,0.08))', border: `1px solid rgba(34,211,238,0.25)`, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>{heroNote}</div>
            <Button as="a" href={primaryCta.href}>{primaryCta.label} →</Button>
          </div>

          {children}

          {faq && (
            <section style={s.section}>
              <h2 style={s.h2}>Questions creators ask</h2>
              <FaqBlock items={faq} />
            </section>
          )}

          {finalCta && (
            <div style={{ padding: '40px 32px', borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`, textAlign: 'center', marginTop: 20, marginBottom: 48 }}>
              <h2 style={{ ...s.h2, marginBottom: 10 }}>{finalCta.headline}</h2>
              <p style={{ ...s.p, maxWidth: 520, margin: '0 auto 24px' }}>{finalCta.sub}</p>
              <Button as="a" href={finalCta.href} style={{ padding: '14px 36px', fontSize: 16 }}>{finalCta.label} →</Button>
            </div>
          )}

          {related.length > 0 && (
            <div style={{ paddingTop: 20, borderTop: `1px solid ${T.borderSoft}` }}>
              <div style={{ fontSize: 15, color: T.muted, marginBottom: 14 }}>Related</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {related.map(({ href, label }) => (
                  <a key={href} href={href} style={{ padding: '6px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`, color: T.cyan, fontSize: 13, textDecoration: 'none' }}>{label}</a>
                ))}
              </div>
            </div>
          )}
        </article>

        <footer style={{ borderTop: `1px solid ${T.borderSoft}`, padding: '32px 40px', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: T.muted }}>© 2026 CamCash — Built for cam models who want to grow</p>
        </footer>
      </div>
    </>
  )
}

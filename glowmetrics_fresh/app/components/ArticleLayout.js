// Shared editorial layout for all blog + guide articles.
// Provides: compact nav, centered article container, minimal footer.
// Each article page supplies its own breadcrumb array + children content.
import Button from '../../components/ui/Button'

const C = {
  bg:      '#0d0f14',
  border:  'rgba(255,255,255,0.07)',
  muted:   '#475569',
  text:    '#94a3b8',
  white:   '#f1f5f9',
}

export default function ArticleLayout({ children, breadcrumb = [], schema }) {
  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      )}

      {/* ── Compact nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(13,15,20,0.97)',
        borderBottom: `1px solid ${C.border}`,
        backdropFilter: 'blur(8px)',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '52px',
      }}>
        <a href="/" style={{ textDecoration: 'none', fontWeight: 700, fontSize: '15px', color: C.white, letterSpacing: '-0.2px' }}>
          💜 CamCash
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {[
            { label: 'Home',       href: '/' },
            { label: 'Blog',       href: '/blog' },
            { label: 'Free tools', href: '/tools' },
          ].map(({ label, href }) => (
            <a key={href} href={href} style={{
              color: C.muted, fontSize: '13px', textDecoration: 'none',
              padding: '4px 10px', borderRadius: '6px',
            }}>
              {label}
            </a>
          ))}
          <Button as="a" href="/landing" variant="secondary" style={{ marginLeft: '8px', padding: '5px 12px', fontSize: '12px' }}>
            Free account
          </Button>
        </div>
      </nav>

      {/* ── Article container ── */}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '36px 20px 80px' }}>

        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <nav aria-label="breadcrumb" style={{ fontSize: '12px', color: C.muted, marginBottom: '20px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
            <a href="/" style={{ color: C.muted, textDecoration: 'none' }}>Home</a>
            {breadcrumb.map(({ label, href }, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#2d3748' }}>›</span>
                {href
                  ? <a href={href} style={{ color: C.muted, textDecoration: 'none' }}>{label}</a>
                  : <span style={{ color: '#64748b' }}>{label}</span>
                }
              </span>
            ))}
          </nav>
        )}

        {/* Article content */}
        <article>{children}</article>

      </div>

      {/* ── Minimal footer ── */}
      <footer style={{
        borderTop: `1px solid ${C.border}`,
        padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '8px',
      }}>
        <span style={{ fontSize: '12px', color: C.muted }}>
          © 2026 <a href="/" style={{ color: C.muted, textDecoration: 'none' }}>CamCashGrl</a> — free analytics for cam models
        </span>
        <div style={{ display: 'flex', gap: '16px' }}>
          {[
            { label: 'Blog',      href: '/blog' },
            { label: 'Guides',    href: '/guides' },
            { label: 'Extension', href: '/extension' },
            { label: 'Pricing',   href: '/pricing' },
          ].map(({ label, href }) => (
            <a key={href} href={href} style={{ fontSize: '12px', color: C.muted, textDecoration: 'none' }}>
              {label}
            </a>
          ))}
        </div>
      </footer>

    </div>
  )
}

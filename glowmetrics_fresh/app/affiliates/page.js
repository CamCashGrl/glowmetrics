export const metadata = {
  title: 'Affiliates & Partners',
  description: 'Partner with CamCash — explore affiliate and partnership opportunities for creators, educators, and communities.',
  alternates: { canonical: 'https://www.camcashgrl.com/affiliates' },
}

export default function AffiliatesPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#05070f', fontFamily: "'Inter', sans-serif", color: '#f1f5f9' }}>
      {/* Ambient glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 600, height: 600, top: '-10%', right: '-5%', background: 'radial-gradient(circle,rgba(124,92,255,0.09),transparent 65%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, bottom: '10%', left: '-10%', background: 'radial-gradient(circle,rgba(236,72,153,0.07),transparent 65%)', filter: 'blur(60px)' }} />
      </div>

      {/* Nav */}
      <nav style={{ position: 'relative', zIndex: 10, padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#22D3EE,#EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: 'white' }}>$</div>
          <span style={{ fontSize: 17, fontWeight: 800, color: 'white', letterSpacing: -0.4 }}>Cam<span style={{ background: 'linear-gradient(90deg,#22D3EE,#EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Cash</span></span>
        </a>
        <a href="/landing" style={{ fontSize: 13, color: '#475569', textDecoration: 'none' }}>← Back</a>
      </nav>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 600, margin: '0 auto', padding: '72px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>🤝</div>

        <h1 style={{ fontSize: 36, fontWeight: 900, color: '#f1f5f9', marginBottom: 16, lineHeight: 1.2 }}>
          Partner With{' '}
          <span style={{ background: 'linear-gradient(90deg, #7C5CFF, #EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            CamCash
          </span>
        </h1>

        <div style={{ background: 'rgba(15,20,32,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '32px 28px', marginBottom: 28, textAlign: 'left' }}>
          <p style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.8, margin: '0 0 20px' }}>
            We're currently exploring partnerships with creators, educators, communities, and businesses whose audiences can benefit from CamCash. While our affiliate program is still being developed, we're happy to connect with potential partners and learn more about your audience.
          </p>
          <p style={{ fontSize: 15, color: '#f1f5f9', fontWeight: 700, margin: 0 }}>
            Interested in working together?
          </p>
        </div>

        <a
          href="/contact"
          style={{
            display: 'inline-block',
            padding: '14px 40px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, #7C5CFF, #EC4899)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 800,
            textDecoration: 'none',
            boxShadow: '0 0 32px rgba(124,92,255,0.3)',
          }}
        >
          Contact Us
        </a>
      </div>
    </div>
  )
}

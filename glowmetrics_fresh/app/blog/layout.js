export default function BlogLayout({ children }) {
  return (
    <>
      {children}
      <div style={{
        background: '#0F1117',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: 'clamp(32px, 5vw, 56px) 20px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{
            fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: '#16F4FF', marginBottom: 10,
          }}>
            Pretty Profitz Shop
          </div>
          <h2 style={{
            fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800, color: '#FFFFFF',
            margin: '0 0 12px', letterSpacing: '-0.03em', lineHeight: 1.2,
          }}>
            Scripts, kits &amp; tools made by a creator, for creators
          </h2>
          <a href="/shop" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 32px', borderRadius: 16, fontSize: 16, fontWeight: 800,
            color: '#FFFFFF', textDecoration: 'none',
            background: 'linear-gradient(90deg, #16F4FF 0%, #7C5CFF 48%, #FF2BAE 100%)',
            boxShadow: '0 0 24px rgba(22,244,255,0.28), 0 0 34px rgba(255,43,174,0.26), 0 14px 34px rgba(0,0,0,0.45)',
          }}>
            🛍️ Visit the Shop →
          </a>
        </div>
      </div>
    </>
  )
}

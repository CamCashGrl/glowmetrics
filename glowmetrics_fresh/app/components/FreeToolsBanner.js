'use client'

export default function FreeToolsBanner() {
  return (
    <section
      style={{
        background: '#080c18',
        borderTop: '1px solid rgba(168,85,247,0.15)',
        borderBottom: '1px solid rgba(168,85,247,0.15)',
        padding: '48px 40px',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a855f7', marginBottom: '10px' }}>
            Free Tools
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#f1f5f9', margin: '0 0 8px' }}>
            Try our free cam model tools
          </h2>
          <p style={{ fontSize: '15px', color: '#64748b', margin: 0 }}>
            No sign-up required. Use them right now, for free.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Creator Profile Studio */}
          <a
            href="/tools/profile-studio"
            style={{
              display: 'block',
              background: 'linear-gradient(135deg, rgba(22,244,255,0.08), rgba(255,43,174,0.08))',
              border: '1px solid rgba(22,244,255,0.28)',
              borderRadius: '12px',
              padding: '28px 24px',
              textDecoration: 'none',
              transition: 'border-color 0.2s, background 0.2s',
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>✍️</div>
            <div style={{ fontSize: '17px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>
              Creator Profile Studio
            </div>
            <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 16px', lineHeight: '1.6' }}>
              Build a platform-ready bio and a smartly priced tip menu, personalized to your persona and boundaries.
            </p>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#16F4FF' }}>
              Try it free →
            </span>
          </a>

          {/* Cam Model Name Generator */}
          <a
            href="/tools/cam-model-name-generator"
            style={{
              display: 'block',
              background: 'rgba(255,43,174,0.06)',
              border: '1px solid rgba(255,43,174,0.22)',
              borderRadius: '12px',
              padding: '28px 24px',
              textDecoration: 'none',
              transition: 'border-color 0.2s, background 0.2s',
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>💫</div>
            <div style={{ fontSize: '17px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>
              Cam Model Name Generator
            </div>
            <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 16px', lineHeight: '1.6' }}>
              Generate stage name ideas with brand strength scoring and domain availability checks.
            </p>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#ff2bae' }}>
              Try it free →
            </span>
          </a>

          {/* Room Title Generator */}
          <a
            href="/guides/chaturbate-room-title-generator"
            style={{
              display: 'block',
              background: 'rgba(168,85,247,0.07)',
              border: '1px solid rgba(168,85,247,0.25)',
              borderRadius: '12px',
              padding: '28px 24px',
              textDecoration: 'none',
              transition: 'border-color 0.2s, background 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(168,85,247,0.13)'
              e.currentTarget.style.borderColor = 'rgba(168,85,247,0.5)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(168,85,247,0.07)'
              e.currentTarget.style.borderColor = 'rgba(168,85,247,0.25)'
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>✏️</div>
            <div style={{ fontSize: '17px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>
              Chaturbate Room Title Generator
            </div>
            <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 16px', lineHeight: '1.6' }}>
              Generate click-worthy room titles that get views. Built specifically for Chaturbate — free to use, no account needed.
            </p>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#a855f7' }}>
              Try it free →
            </span>
          </a>

          {/* Token Calculator */}
          <a
            href="/guides/chaturbate-token-calculator"
            style={{
              display: 'block',
              background: 'rgba(34,211,238,0.06)',
              border: '1px solid rgba(34,211,238,0.2)',
              borderRadius: '12px',
              padding: '28px 24px',
              textDecoration: 'none',
              transition: 'border-color 0.2s, background 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(34,211,238,0.12)'
              e.currentTarget.style.borderColor = 'rgba(34,211,238,0.4)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(34,211,238,0.06)'
              e.currentTarget.style.borderColor = 'rgba(34,211,238,0.2)'
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>💰</div>
            <div style={{ fontSize: '17px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>
              Chaturbate Token Calculator
            </div>
            <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 16px', lineHeight: '1.6' }}>
              Instantly convert Chaturbate tokens to USD. See exactly what you earned. Works for any token amount or payout rate.
            </p>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#22d3ee' }}>
              Try it free →
            </span>
          </a>

          {/* Income Tracker */}
          <a
            href="/guides/cam-model-income-tracker"
            style={{
              display: 'block',
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.22)',
              borderRadius: '12px',
              padding: '28px 24px',
              textDecoration: 'none',
              transition: 'border-color 0.2s, background 0.2s',
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>📊</div>
            <div style={{ fontSize: '17px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>
              Cam Model Income Tracker
            </div>
            <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 16px', lineHeight: '1.6' }}>
              See real earnings by session, hour, platform, and fan — not just a total token count.
            </p>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#10b981' }}>
              Try it free →
            </span>
          </a>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <a href="/tools" style={{ fontSize: '13px', color: '#a855f7', textDecoration: 'none' }}>
            → See all free tools
          </a>
        </div>
      </div>
    </section>
  )
}

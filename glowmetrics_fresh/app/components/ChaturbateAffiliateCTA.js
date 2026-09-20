'use client'

const AFFILIATE_URL = 'https://chaturbate.com/in/?tour=5zjT&campaign=IEYPs&track=default'

export default function ChaturbateAffiliateCTA() {
  return (
    <div
      style={{
        background: 'rgba(168,85,247,0.07)',
        border: '1px solid rgba(168,85,247,0.25)',
        borderRadius: '12px',
        padding: '32px',
        margin: '40px 0',
        textAlign: 'center',
      }}
    >
      <h3 style={{ fontSize: '22px', fontWeight: '700', color: '#f1f5f9', margin: '0 0 8px' }}>
        Ready to start streaming on Chaturbate?
      </h3>
      <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 20px', lineHeight: '1.6' }}>
        Sign up free and start earning — then use CamCash to track your tips and grow your income.
      </p>
      <a
        href={AFFILIATE_URL}
        target="_blank"
        rel="noopener noreferrer sponsored nofollow"
        style={{
          display: 'inline-block',
          background: '#f97316',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: '700',
          padding: '10px 28px',
          borderRadius: '9999px',
          textDecoration: 'none',
          border: 'none',
          boxShadow: '0 4px 14px rgba(249,115,22,0.35)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#ea580c' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#f97316' }}
      >
        Sign Up →
      </a>
    </div>
  )
}

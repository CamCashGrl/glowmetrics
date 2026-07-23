'use client'

import { T } from './theme'

// Reuses the same logo mark + link pattern as app/pricing/PricingClient.js's
// TopBar, extended with the Dashboard / Free Tools / Blog / Store links shown
// in the CamCash marketing nav (app/landing/LandingClient.js).
export default function StoreTopBar() {
  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/tools', label: 'Free Tools' },
    { href: '/blog', label: 'Blog' },
    { href: '/store', label: 'Store', active: true },
  ]

  return (
    <div
      className="store-topbar"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        rowGap: 10,
        padding: '16px 32px',
        background: 'rgba(5,7,19,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(124,92,255,0.2)',
      }}
    >
      <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            background: T.gradientPrimary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 900,
            color: '#06101A',
            boxShadow: '0 0 14px rgba(22,244,255,0.3)',
            flexShrink: 0,
          }}
        >
          $
        </span>
        <span style={{ fontSize: 17, fontWeight: 800, color: T.white, letterSpacing: '-0.4px', whiteSpace: 'nowrap' }}>
          Cam
          <span
            style={{
              background: T.gradientPrimary,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Cash
          </span>
          ™
        </span>
      </a>

      <nav
        className="store-topbar-nav"
        style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}
        aria-label="Primary"
      >
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            aria-current={link.active ? 'page' : undefined}
            style={{
              fontSize: 14,
              fontWeight: link.active ? 700 : 500,
              color: link.active ? T.pink : T.text,
              textDecoration: 'none',
              paddingBottom: 4,
              whiteSpace: 'nowrap',
              borderBottom: link.active ? `2px solid ${T.pink}` : '2px solid transparent',
            }}
          >
            {link.label}
          </a>
        ))}
      </nav>

      <style>{`
        @media (max-width: 480px) {
          .store-topbar { padding: 14px 16px; }
          .store-topbar-nav { width: 100%; justify-content: flex-start; gap: 16px; }
        }
      `}</style>
    </div>
  )
}

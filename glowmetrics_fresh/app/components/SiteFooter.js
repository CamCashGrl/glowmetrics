'use client'

import { useState } from 'react'

function FooterLink({ href, children }) {
  const [hovered, setHovered] = useState(false)
  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        fontSize: '13px',
        lineHeight: '1.6',
        marginBottom: '6px',
        color: hovered ? '#a855f7' : '#64748b',
        textDecoration: 'none',
        transition: 'color 0.15s ease',
      }}
    >
      {children}
    </a>
  )
}

export default function SiteFooter({ sidebarOffset = 0 }) {
  return (
    <footer
      style={{
        background: '#050810',
        borderTop: '1px solid rgba(168,85,247,0.15)',
        padding: '48px 40px 32px',
        marginTop: 'auto',
        marginLeft: sidebarOffset,
        boxSizing: 'border-box',
        width: sidebarOffset ? `calc(100% - ${sidebarOffset}px)` : '100%',
        overflowX: 'hidden',
      }}
    >
      <div
        style={{
          maxWidth: '100%',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '40px',
        }}
      >
        {/* Blog Posts */}
        <div>
          <h4
            style={{
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#a855f7',
              marginBottom: '16px',
              marginTop: '0',
            }}
          >
            Blog Posts
          </h4>
          <FooterLink href="/blog/best-cam-model-tools">Best Cam Model Tools to Track Tips</FooterLink>
          <FooterLink href="/blog/cam-model-earnings">How Much Do Cam Models Make?</FooterLink>
          <FooterLink href="/blog/cam-model-taxes">Cam Model Taxes Guide</FooterLink>
          <FooterLink href="/blog/how-much-do-chaturbate-models-make">How Much Do Chaturbate Models Make?</FooterLink>
          <FooterLink href="/blog/how-to-build-loyal-fans">How to Build Loyal Fans</FooterLink>
          <FooterLink href="/blog/how-to-get-more-tips-on-myfreecams">Get More Tips on MyFreeCams</FooterLink>
          <FooterLink href="/blog/how-to-get-veiws-on-chaturbate">Get More Viewers on Chaturbate</FooterLink>
          <FooterLink href="/blog/how-to-increase-cam-earnings">Increase Cam Earnings With Data</FooterLink>
          <FooterLink href="/blog/how-to-make-more-money-on-chaturbate">Make More Money on Chaturbate</FooterLink>
          <FooterLink href="/blog/how-to-re-engage-whales-and-top-tippers">Re-Engage Your Top Tippers</FooterLink>
          <FooterLink href="/blog/why-cam-income-is-inconsistent">Why Cam Income Is Inconsistent</FooterLink>
          <FooterLink href="/blog/why-cam-streams-arent-making-money">Why Streams Aren&apos;t Making Money</FooterLink>
        </div>

        {/* Free Guides & Tools */}
        <div>
          <h4
            style={{
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#a855f7',
              marginBottom: '16px',
              marginTop: '0',
            }}
          >
            Free Guides &amp; Tools
          </h4>
          <FooterLink href="/guides/chaturbate-earnings-tracker">Chaturbate Earnings Tracker</FooterLink>
          <FooterLink href="/guides/cam-model-analytics">Cam Model Analytics Dashboard</FooterLink>
          <FooterLink href="/guides/how-to-increase-cam-tips">How to Increase Cam Tips</FooterLink>
          <FooterLink href="/guides/bongacams-analytics">BongaCams Analytics</FooterLink>
          <FooterLink href="/guides/best-time-to-stream-chaturbate">Best Time to Stream on Chaturbate</FooterLink>
          <FooterLink href="/guides/cam-model-top-tippers">Cam Model Top Tipper Tracker</FooterLink>
          <FooterLink href="/guides/cam-model-income-tracker">Cam Model Income Tracker</FooterLink>
          <FooterLink href="/guides/myfreecams-analytics">MyFreeCams Analytics</FooterLink>
          <FooterLink href="/guides/chaturbate-token-tracker">Chaturbate Token Tracker</FooterLink>
          <FooterLink href="/guides/cam-model-revenue-dashboard">Cam Model Revenue Dashboard</FooterLink>
          <FooterLink href="/guides/cam-model-session-breakdown">Cam Model Session Breakdown</FooterLink>
          <FooterLink href="/guides/chaturbate-best-hours">Chaturbate Best Hours to Stream</FooterLink>
          <FooterLink href="/guides/cam-model-room-title-generator">Cam Model Room Title Generator</FooterLink>
          <FooterLink href="/guides/cam-model-token-calculator">Cam Model Token Calculator</FooterLink>
        </div>

        {/* Main Pages */}
        <div>
          <h4
            style={{
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#a855f7',
              marginBottom: '16px',
              marginTop: '0',
            }}
          >
            Main Pages
          </h4>
          <FooterLink href="/">Home</FooterLink>
          <FooterLink href="/pricing">Pricing</FooterLink>
          <FooterLink href="/extension">Chrome Extension</FooterLink>
          <FooterLink href="/demo">Live Demo</FooterLink>
          <FooterLink href="/blog">All Blog Posts</FooterLink>
          <FooterLink href="/guides">All Free Tools &amp; Guides</FooterLink>
          <FooterLink href="/dashboard">Dashboard</FooterLink>
          <FooterLink href="/live">Live Mode</FooterLink>
        </div>
      </div>

      <div
        style={{
          maxWidth: '100%',
          margin: '40px auto 0',
          paddingTop: '24px',
          borderTop: '1px solid rgba(168,85,247,0.08)',
          textAlign: 'center',
          fontSize: '12px',
          color: '#64748b',
        }}
      >
        &copy; 2026 CamCash &middot; camcashgrl.com
      </div>
    </footer>
  )
}

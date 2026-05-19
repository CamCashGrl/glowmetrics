import SiteFooter from '../components/SiteFooter'

export const metadata = {
  title: 'Free Cam Model Tools & Guides — Earnings Trackers, Analytics | CamCash',
  description:
    'Free tools and guides for cam models: earnings trackers, token calculators, analytics dashboards, and platform-specific guides for Chaturbate, BongaCams, and MyFreeCams.',
}

const guides = [
  {
    slug: 'chaturbate-earnings-tracker',
    title: 'Chaturbate Earnings Tracker',
    description: 'See exactly what you earned per session, hour, and tipper.',
  },
  {
    slug: 'cam-model-analytics',
    title: 'Cam Model Analytics',
    description: 'Data-driven insights to grow your income across all platforms.',
  },
  {
    slug: 'how-to-increase-cam-tips',
    title: 'How to Increase Cam Tips',
    description: 'Data-proven strategies to get more and bigger tips.',
  },
  {
    slug: 'bongacams-analytics',
    title: 'BongaCams Analytics',
    description: 'Track your BongaCams earnings and top fans.',
  },
  {
    slug: 'best-time-to-stream-chaturbate',
    title: 'Best Time to Stream on Chaturbate',
    description: 'Find your personal peak hours based on your own data.',
  },
  {
    slug: 'cam-model-top-tippers',
    title: 'Top Tipper Tracker',
    description: 'Know your most valuable fans and what drives their tipping.',
  },
  {
    slug: 'cam-model-income-tracker',
    title: 'Cam Model Income Tracker',
    description: 'Free earnings dashboard for all major cam platforms.',
  },
  {
    slug: 'myfreecams-analytics',
    title: 'MyFreeCams Analytics',
    description: 'Track MFC earnings, top fans, and peak hours.',
  },
  {
    slug: 'chaturbate-token-tracker',
    title: 'Chaturbate Token Tracker',
    description: 'Convert tokens to USD and track your earnings history.',
  },
  {
    slug: 'cam-model-revenue-dashboard',
    title: 'Revenue Dashboard',
    description: 'Real analytics and real results for serious cam models.',
  },
  {
    slug: 'cam-model-session-breakdown',
    title: 'Session Breakdown',
    description: 'See exactly what happened in each of your streams.',
  },
  {
    slug: 'chaturbate-best-hours',
    title: 'Chaturbate Best Hours',
    description: 'Find when you earn the most on Chaturbate.',
  },
  {
    slug: 'chaturbate-room-title-generator',
    title: 'Room Title Generator',
    description: 'Generate viral Chaturbate room titles that get clicks.',
  },
  {
    slug: 'chaturbate-token-calculator',
    title: 'Token Calculator',
    description: 'Instantly convert Chaturbate tokens to USD.',
  },
]

export default function GuidesPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#05070f',
        color: '#e2e8f0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '64px 24px 48px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#a855f7',
            marginBottom: '16px',
          }}
        >
          Free Tools &amp; Guides
        </div>
        <h1
          style={{
            fontSize: '36px',
            fontWeight: '800',
            color: '#f1f5f9',
            margin: '0 0 16px',
            lineHeight: '1.2',
          }}
        >
          Cam Model Tools, Trackers &amp; Analytics Guides
        </h1>
        <p
          style={{
            fontSize: '16px',
            color: '#94a3b8',
            margin: '0',
            lineHeight: '1.7',
            maxWidth: '620px',
          }}
        >
          Free earnings trackers, token calculators, and analytics dashboards built for cam models
          on Chaturbate, MyFreeCams, BongaCams, and more.
        </p>
      </div>

      {/* Grid */}
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '0 24px 80px',
          width: '100%',
          boxSizing: 'border-box',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '20px',
        }}
      >
        {guides.map((guide) => (
          <a
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            style={{
              display: 'block',
              background: '#0d1117',
              border: '1px solid rgba(168,85,247,0.12)',
              borderRadius: '12px',
              padding: '24px',
              textDecoration: 'none',
              transition: 'border-color 0.2s ease, background 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(168,85,247,0.4)'
              e.currentTarget.style.background = '#110d1a'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(168,85,247,0.12)'
              e.currentTarget.style.background = '#0d1117'
            }}
          >
            <h2
              style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#f1f5f9',
                margin: '0 0 8px',
                lineHeight: '1.4',
              }}
            >
              {guide.title}
            </h2>
            <p
              style={{
                fontSize: '13px',
                color: '#64748b',
                margin: '0 0 16px',
                lineHeight: '1.6',
              }}
            >
              {guide.description}
            </p>
            <span
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#a855f7',
              }}
            >
              Open tool →
            </span>
          </a>
        ))}
      </div>

      <SiteFooter />
    </div>
  )
}

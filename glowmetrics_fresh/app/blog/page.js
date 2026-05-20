import SiteFooter from '../components/SiteFooter'

export const metadata = {
  title: 'Cam Model Blog — Tips, Strategies & Earnings Guides | CamCash',
  description:
    'Free guides for cam models: how to increase earnings, track tips, build loyal fans, handle taxes, and grow on Chaturbate, MyFreeCams, and BongaCams.',
}

const posts = [
  {
    slug: 'best-cam-model-tools',
    title: 'Best Cam Model Tools',
    description: 'The top tools cam models use to track tips, analyze earnings, and grow income.',
  },
  {
    slug: 'cam-model-earnings',
    title: 'How Much Do Cam Models Make?',
    description: 'Real numbers on cam model income across platforms.',
  },
  {
    slug: 'cam-model-taxes',
    title: 'Cam Model Taxes Guide',
    description: 'What to track, what to deduct, and how to file as a cam model.',
  },
  {
    slug: 'how-much-do-chaturbate-models-make',
    title: 'How Much Do Chaturbate Models Make?',
    description: 'Per-hour earnings data for Chaturbate broadcasters.',
  },
  {
    slug: 'how-to-build-loyal-fans',
    title: 'How to Build Loyal Fans',
    description: 'Build a fanbase that comes back and tips consistently.',
  },
  {
    slug: 'how-to-get-more-tips-on-myfreecams',
    title: 'Get More Tips on MyFreeCams',
    description: 'Proven strategies to increase tips on MFC.',
  },
  {
    slug: 'how-to-get-veiws-on-chaturbate',
    title: 'Get More Viewers on Chaturbate',
    description: 'How to climb the rankings and get more traffic on Chaturbate.',
  },
  {
    slug: 'how-to-increase-cam-earnings',
    title: 'Increase Cam Earnings With Data',
    description: 'Use your own data to stream smarter and earn more.',
  },
  {
    slug: 'how-to-make-more-money-on-chaturbate',
    title: 'Make More Money on Chaturbate',
    description: '11 data-proven strategies to boost your Chaturbate income.',
  },
  {
    slug: 'how-to-re-engage-whales-and-top-tippers',
    title: 'Re-Engage Your Top Tippers',
    description: 'Win back your biggest spenders before they go cold.',
  },
  {
    slug: 'why-cam-income-is-inconsistent',
    title: 'Why Cam Income Is Inconsistent',
    description: 'The real reasons earnings fluctuate and how to stabilize them.',
  },
  {
    slug: 'why-cam-streams-arent-making-money',
    title: "Why Streams Aren't Making Money",
    description: 'Common mistakes that kill cam session earnings.',
  },
]

export default function BlogPage() {
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
          CamCash Blog
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
          Cam Model Tips, Strategies &amp; Earnings Guides
        </h1>
        <p
          style={{
            fontSize: '16px',
            color: '#94a3b8',
            margin: '0',
            lineHeight: '1.7',
            maxWidth: '600px',
          }}
        >
          Free guides to help you earn more, stream smarter, and build a loyal fanbase on
          Chaturbate, MyFreeCams, BongaCams, and beyond.
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
        {posts.map((post) => (
          <a
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="blog-card"
            style={{
              display: 'block',
              background: '#0d1117',
              border: '1px solid rgba(168,85,247,0.12)',
              borderRadius: '12px',
              padding: '24px',
              textDecoration: 'none',
              transition: 'border-color 0.2s ease, background 0.2s ease',
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
              {post.title}
            </h2>
            <p
              style={{
                fontSize: '13px',
                color: '#64748b',
                margin: '0 0 16px',
                lineHeight: '1.6',
              }}
            >
              {post.description}
            </p>
            <span
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#a855f7',
              }}
            >
              Read more →
            </span>
          </a>
        ))}
      </div>

      <SiteFooter />
      <style>{`
        .blog-card:hover { border-color: rgba(168,85,247,0.4) !important; background: #110d1a !important; }
      `}</style>
    </div>
  )
}

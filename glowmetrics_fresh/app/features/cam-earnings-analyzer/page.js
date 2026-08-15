import FeatureLayout, { T, s, faqSchemaFrom, Checklist } from '../../../components/FeatureLayout'

export const metadata = {
  title: 'Cam Model Earnings Analyzer | Track Tips, Tokens, Sessions & Fans | CamCash',
  description: 'Upload a Chaturbate, BongaCams, or MyFreeCams tip-history CSV and see earnings, sessions, $/hour, top fans, and platform performance instantly.',
  keywords: ['camgirl earnings tracker', 'cam model earnings tracker', 'chaturbate tracker', 'chaturbate token stats', 'chaturbate token calculator'],
  alternates: { canonical: 'https://www.camcashgrl.com/features/cam-earnings-analyzer' },
  openGraph: {
    title: 'Cam Model Earnings Analyzer | CamCash',
    description: 'Upload a tip-history CSV and immediately understand earnings, sessions, $/hour, fans, and platform performance.',
    url: 'https://www.camcashgrl.com/features/cam-earnings-analyzer',
    type: 'website',
    images: [{ url: 'https://www.camcashgrl.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cam Model Earnings Analyzer | CamCash',
    description: 'Upload a tip-history CSV and immediately understand earnings, sessions, $/hour, fans, and platform performance.',
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Cam Model Earnings Analyzer',
  description: 'Upload your tip-history CSV and turn raw tips into earnings, sessions, $/hour, and fan analytics.',
  url: 'https://www.camcashgrl.com/features/cam-earnings-analyzer',
  isPartOf: { '@type': 'WebSite', name: 'CamCash', url: 'https://www.camcashgrl.com' },
}

const faq = [
  { q: 'What is a camgirl earnings tracker?', a: 'A camgirl earnings tracker organizes your income, tips, tokens, sessions, hours, and fan activity so you can understand how your streams actually perform over time, instead of reading raw rows in a CSV.' },
  { q: 'Can I use a Chaturbate CSV?', a: 'Yes. Chaturbate is one of the supported CSV imports, alongside BongaCams and MyFreeCams. Export your Token Stats CSV from Chaturbate and upload it directly.' },
  { q: 'Does CamCash calculate earnings per hour?', a: 'Yes. Once your imported history has enough qualifying session data, CamCash calculates an hourly earnings rate from your sessions — not just a total-divided-by-hours estimate.' },
  { q: 'Is this the same as a token calculator?', a: 'Not quite. A token calculator converts a token amount to USD. The earnings analyzer looks at your actual imported history — sessions, hours, fans, and performance patterns — to show what is really driving your income.' },
  { q: 'Is the earnings analyzer free?', a: 'The core analyzer is free: upload one platform\'s CSV and see your earnings, sessions, and basic $/hour breakdown at no cost. Creator Pro adds full historical depth, multi-platform comparison, and deeper session analytics.' },
]

export default function CamEarningsAnalyzerFeaturePage() {
  return (
    <FeatureLayout
      schema={[webPageSchema, faqSchemaFrom(faq)]}
      breadcrumb={[{ label: 'Cam Earnings Analyzer' }]}
      eyebrow="CamCash Feature"
      h1="Stop guessing what made a stream profitable."
      subhead="Upload your tip-history CSV and let CamCash turn rows of transactions into a clear picture of how you actually earn — by session, by hour, and by fan."
      heroNote="Free to start — upload one platform, no credit card"
      primaryCta={{ label: 'Analyze My Earnings', href: '/landing' }}
      faq={faq}
      finalCta={{
        headline: 'See what your data has been trying to tell you.',
        sub: 'Upload your CSV and get earnings, sessions, $/hour, and fan activity in one dashboard — free to start.',
        label: 'Analyze My Earnings',
        href: '/landing',
      }}
      related={[
        { href: '/guides/chaturbate-earnings-tracker', label: 'Chaturbate earnings tracker guide' },
        { href: '/guides/cam-model-token-calculator', label: 'Token calculator' },
        { href: '/features/top-fans', label: 'Top Fans' },
        { href: '/features/best-hours', label: 'Best Hours' },
        { href: '/features/multi-platform-analytics', label: 'Multi-Platform Analytics' },
      ]}
    >
      <Checklist items={[
        'Total earnings, tips, and tokens broken down by session',
        'Your real $/hour — calculated, not guessed',
        'Which sessions actually earned their keep',
        'Your top fans, in the same view as your earnings',
      ]} />

      {/* PRODUCT PROOF */}
      <section style={s.section}>
        <h2 style={s.h2}>From raw tips to a Command Center</h2>
        <p style={s.p}>
          A CSV export tells you what happened. It doesn't tell you what to do next. CamCash's Command Center organizes your imported history into total earnings, qualifying sessions, hourly performance, and fan activity — the same view you land on every time you check your dashboard.
        </p>
        <div style={{ borderRadius: 16, border: `1px solid ${T.border}`, background: T.card, padding: 24, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.muted, marginBottom: 16 }}>Command Center — example layout</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {[
              { label: 'Total Earnings', color: T.green },
              { label: 'Qualifying Sessions', color: T.cyan },
              { label: '$/Hour', color: T.gold },
              { label: 'Unique Fans', color: T.purple },
            ].map(({ label, color }) => (
              <div key={label} style={{ padding: '16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderSoft}` }}>
                <div style={{ width: 36, height: 8, borderRadius: 4, background: color, marginBottom: 10, opacity: 0.8 }} />
                <div style={{ fontSize: 12, color: T.text }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <p style={{ ...s.p, fontSize: 13, color: T.muted, marginTop: 8 }}>Actual figures come from your imported history — CamCash never estimates a number it can't calculate from real data.</p>
      </section>

      {/* VALUE SECTIONS */}
      <section style={s.section}>
        <h2 style={s.h2}>Turn a tip tracker into a decision tool</h2>
        <p style={s.p}>A useful tracker should help you answer real questions, not just add up totals:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {[
            { icon: '🎥', title: 'Which sessions were worth my time', body: 'See qualifying sessions ranked by earnings and $/hour, not just total tokens.' },
            { icon: '⏰', title: 'When your earning rate is strongest', body: 'Hourly performance from your own history — paired with the Best Hours feature for a full schedule.' },
            { icon: '👑', title: 'Which supporters matter most', body: 'Fan activity surfaces alongside earnings, so you can see who is actually driving your income.' },
            { icon: '🎯', title: 'Is one platform more efficient', body: 'If you track more than one platform, compare hourly performance instead of just totals.' },
          ].map(({ icon, title, body }) => (
            <div key={title} style={{ ...s.card, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 22 }}>{icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{title}</div>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6 }}>{body}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Built for real creator exports</h2>
        <p style={s.p}>
          CamCash is built around supported creator tip-history sources: <strong style={{ color: 'white' }}>Chaturbate, BongaCams, and MyFreeCams</strong>. The system normalizes imported history before analysis so you're not rebuilding rows by hand or reconciling formats across platforms.
        </p>
        <p style={s.p}>
          With enough qualifying history, CamCash can surface a best earning window, session patterns, and platform comparisons. Sparse data stays sparse — the analyzer shows an honest "not enough data yet" state instead of inventing a conclusion to fill a card.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Free vs. Creator Pro</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <div style={s.card}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.cyan, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Free</div>
            <p style={{ ...s.p, fontSize: 14, marginBottom: 0 }}>Upload one platform's CSV and see your total earnings, session count, basic $/hour, and recent tip activity — no credit card, no time limit.</p>
          </div>
          <div style={{ ...s.card, border: `1px solid rgba(168,85,247,0.3)`, background: 'rgba(168,85,247,0.05)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.purple, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Creator Pro</div>
            <p style={{ ...s.p, fontSize: 14, marginBottom: 0 }}>Full permanent history, deeper session analytics, and multi-platform comparison across every supported platform you track.</p>
          </div>
        </div>
      </section>
    </FeatureLayout>
  )
}

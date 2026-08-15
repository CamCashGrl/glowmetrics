import FeatureLayout, { T, s, faqSchemaFrom, Checklist } from '../../../components/FeatureLayout'

export const metadata = {
  title: 'Top Fans Tracker for Cam Models | VIP & Supporter Insights | CamCash',
  description: 'See which fans actually drive your earnings, how often they return, and who deserves your attention next — CamCash Top Fans, built from your real tip history.',
  keywords: ['camgirl fan tracker', 'cam model fan tracker', 'top fans', 'VIP fan tracker', 'chaturbate tip tracker'],
  alternates: { canonical: 'https://www.camcashgrl.com/features/top-fans' },
  openGraph: {
    title: 'Top Fans Tracker for Cam Models | CamCash',
    description: 'Identify the supporters who actually drive your income and understand their activity patterns.',
    url: 'https://www.camcashgrl.com/features/top-fans',
    type: 'website',
    images: [{ url: 'https://www.camcashgrl.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Top Fans Tracker for Cam Models | CamCash',
    description: 'Identify the supporters who actually drive your income and understand their activity patterns.',
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Top Fans Tracker for Cam Models',
  description: 'See which fans drive your earnings, how often they return, and which supporters deserve your attention.',
  url: 'https://www.camcashgrl.com/features/top-fans',
  isPartOf: { '@type': 'WebSite', name: 'CamCash', url: 'https://www.camcashgrl.com' },
}

const faq = [
  { q: 'What does the Top Fans tracker show?', a: 'Lifetime value, tip count, recent activity, and repeat patterns for each fan in your imported history — ranked so you can see who actually drives your income at a glance.' },
  { q: 'Can I see my highest-spending fans for free?', a: "Yes. The free plan shows your top three fans by lifetime spend. Creator Pro unlocks your full ranked fan list and tier breakdown." },
  { q: 'Will CamCash tell me exactly when a fan will return?', a: "No. It can surface a recurring timing pattern when the data supports it, but it will not turn one or two tips into false certainty. Sparse history stays labeled as sparse." },
  { q: 'Is fan tracking only for Chaturbate?', a: 'No — it works with any supported platform export (Chaturbate, BongaCams, MyFreeCams). Available fan data depends on what your source CSV includes.' },
  { q: 'What are Whales, Sharks, and Regulars?', a: "CamCash's fan tiers, based on total spend and recent activity: Whales are your highest lifetime spenders, Sharks are strong repeat tippers below that, and Regulars tip consistently at a smaller scale. Tier breakdowns are a Creator Pro feature." },
]

export default function TopFansFeaturePage() {
  return (
    <FeatureLayout
      schema={[webPageSchema, faqSchemaFrom(faq)]}
      breadcrumb={[{ label: 'Top Fans' }]}
      eyebrow="CamCash Feature"
      h1="Know who actually drives your income."
      subhead="Your biggest supporters aren't just usernames in a tip log. CamCash turns fan history into a prioritized view of who deserves your attention."
      heroNote="Free preview: your top 3 fans, no credit card"
      primaryCta={{ label: 'Find My Top Fans', href: '/landing' }}
      faq={faq}
      finalCta={{
        headline: 'See who is actually paying your bills.',
        sub: 'Upload your CSV and see your top fans ranked by lifetime value, recency, and repeat behavior.',
        label: 'Find My Top Fans',
        href: '/landing',
      }}
      related={[
        { href: '/guides/cam-model-top-tippers', label: 'Cam model top tippers guide' },
        { href: '/blog/how-to-re-engage-whales-and-high-tipping-fans', label: 'Re-engaging whales & top tippers' },
        { href: '/blog/how-to-build-loyal-fans', label: 'How to build loyal fans' },
        { href: '/features/cam-earnings-analyzer', label: 'Earnings Analyzer' },
        { href: '/features/best-hours', label: 'Best Hours' },
      ]}
    >
      <Checklist items={[
        'Your top fans ranked by lifetime value',
        'How often each one actually comes back',
        "Who's tipping consistently vs. who's gone quiet",
        'Where fan activity overlaps with your best hours',
      ]} />

      <section style={s.section}>
        <h2 style={s.h2}>From a list of usernames to a priority list</h2>
        <p style={s.p}>
          A raw tip export can show hundreds of names without telling you which relationships matter most. CamCash's Top Fans view groups your imported history by fan so you can see lifetime value, tip count, recency, and recurring behavior in one place — the same list that powers the Top Fans tab in your dashboard.
        </p>
        <div style={{ borderRadius: 16, border: `1px solid ${T.border}`, background: T.card, padding: 24, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.muted, marginBottom: 16 }}>Top Fans — example layout</div>
          {[
            { tier: 'Whale', color: T.gold },
            { tier: 'Shark', color: T.cyan },
            { tier: 'Regular', color: T.purple },
          ].map(({ tier, color }) => (
            <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${T.borderSoft}` }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}22`, border: `1px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👑</div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 8, width: '40%', background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 6 }} />
                <div style={{ fontSize: 11, color: color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tier}</div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ ...s.p, fontSize: 13, color: T.muted, marginTop: 8 }}>Names, amounts, and tiers shown here are illustrative — your dashboard uses your actual imported tip history.</p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Find return patterns without pretending to know too much</h2>
        <p style={s.p}>
          When the data supports it, CamCash can identify recurring timing patterns and flag fans who may be approaching a typical return window. When a fan only appears once or twice, the product says so instead of manufacturing a prediction — CamCash never invents an insight it can't back with real history.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Connect fans to your stream strategy</h2>
        <p style={s.p}>
          Fan intelligence becomes more useful once you can see how it overlaps with your earning windows — that's why Top Fans and <a href="/features/best-hours" style={{ color: T.cyan, textDecoration: 'none' }}>Best Hours</a> work together in Stream Planner. A supporter who repeatedly shows up around a strong session window is more actionable than a static lifetime total.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Free vs. Creator Pro</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <div style={s.card}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.cyan, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Free</div>
            <p style={{ ...s.p, fontSize: 14, marginBottom: 0 }}>See your top 3 fans by lifetime spend — enough to prove the concept before you commit to anything.</p>
          </div>
          <div style={{ ...s.card, border: `1px solid rgba(168,85,247,0.3)`, background: 'rgba(168,85,247,0.05)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.purple, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Creator Pro</div>
            <p style={{ ...s.p, fontSize: 14, marginBottom: 0 }}>Your full ranked fan list, Whale/Shark/Regular tiers, and return-window patterns inside Stream Planner.</p>
          </div>
        </div>
      </section>
    </FeatureLayout>
  )
}

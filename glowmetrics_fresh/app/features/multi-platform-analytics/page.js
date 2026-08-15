import FeatureLayout, { T, s, faqSchemaFrom, Checklist } from '../../../components/FeatureLayout'

export const metadata = {
  title: 'Multi-Platform Cam Model Analytics | Compare Chaturbate, BongaCams & MFC | CamCash',
  description: 'Compare your earnings, hours, sessions, and hourly performance across Chaturbate, BongaCams, and MyFreeCams in one dashboard with CamCash.',
  keywords: ['cam platform comparison', 'Chaturbate vs BongaCams earnings', 'multi platform cam tracker', 'cam model analytics'],
  alternates: { canonical: 'https://www.camcashgrl.com/features/multi-platform-analytics' },
  openGraph: {
    title: 'Multi-Platform Cam Model Analytics | CamCash',
    description: 'Compare supported platform earnings, hours, sessions, fans, and hourly performance in one dashboard.',
    url: 'https://www.camcashgrl.com/features/multi-platform-analytics',
    type: 'website',
    images: [{ url: 'https://www.camcashgrl.com/blog-images/camcash-platform-comparsion-dashboard.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Multi-Platform Cam Model Analytics | CamCash',
    description: 'Compare supported platform earnings, hours, sessions, fans, and hourly performance in one dashboard.',
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Multi-Platform Cam Model Analytics',
  description: 'Compare your cam earnings, hours, sessions, fans, and hourly performance across supported platforms in one dashboard.',
  url: 'https://www.camcashgrl.com/features/multi-platform-analytics',
  isPartOf: { '@type': 'WebSite', name: 'CamCash', url: 'https://www.camcashgrl.com' },
}

const faq = [
  { q: 'Which platforms does CamCash support?', a: 'Current supported CSV imports are Chaturbate, BongaCams, and MyFreeCams, subject to the export format available for each platform.' },
  { q: 'Can I compare platforms on the free plan?', a: 'Free tracks one platform and its analytics. Comparing multiple platforms side by side is a Creator Pro feature.' },
  { q: 'Does platform comparison only compare total earnings?', a: 'No. CamCash compares earnings, hours, sessions, and hourly performance where your imported data supports those metrics for each platform.' },
  { q: 'Why can platform totals differ from my account total?', a: 'Some platform-level figures are scoped to qualifying or meaningful sessions, while your account-wide total includes every recorded tip. CamCash labels those scopes instead of treating them as identical.' },
  { q: 'Does CamCash support CamSoda or Stripchat?', a: 'Not for CSV import today — platform selection during onboarding covers Chaturbate, BongaCams, and MyFreeCams. If that changes, this page will be updated to reflect it.' },
]

export default function MultiPlatformAnalyticsFeaturePage() {
  return (
    <FeatureLayout
      schema={[webPageSchema, faqSchemaFrom(faq)]}
      breadcrumb={[{ label: 'Multi-Platform Analytics' }]}
      eyebrow="CamCash Feature"
      h1="One dashboard for every platform you work on."
      subhead="When you work across platforms, separate spreadsheets make it harder to answer one simple question: where is your time actually paying off?"
      heroNote="Free: 1 platform · Pro: full comparison"
      primaryCta={{ label: 'Compare My Platforms', href: '/landing' }}
      faq={faq}
      finalCta={{
        headline: 'Find out where your time actually pays off.',
        sub: 'Import history from every platform you stream on and compare earnings, hours, and $/hour side by side.',
        label: 'Compare My Platforms',
        href: '/landing',
      }}
      related={[
        { href: '/blog/how-much-do-bongacams-models-make', label: 'BongaCams earnings' },
        { href: '/blog/how-much-do-myfreecams-models-make', label: 'MyFreeCams earnings' },
        { href: '/blog/camcash-vs-camdash-vs-cb-cam-insights', label: 'CamCash vs. CamDash vs. CB Cam Insights' },
        { href: '/features/cam-earnings-analyzer', label: 'Earnings Analyzer' },
      ]}
    >
      <Checklist items={[
        'Earnings, hours, and sessions per platform',
        'Real $/hour comparison, not just totals',
        'Your best day and time on each platform',
        "Where your time is actually paying off",
      ]} />

      <section style={s.section}>
        <h2 style={s.h2}>Compare the work, not just the totals</h2>
        <p style={s.p}>
          A platform that produces more tokens can still produce a lower return for your time. The Platforms tab compares earnings, hours, sessions, and hourly performance so platform decisions rest on more than raw totals.
        </p>
        <img
          src="/blog-images/camcash-platform-comparsion-dashboard.png"
          alt="CamCash multi-platform comparison dashboard showing earnings and hourly performance across Chaturbate, BongaCams, and MyFreeCams"
          style={{ width: '100%', borderRadius: 16, border: `1px solid ${T.border}`, display: 'block' }}
        />
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Bring your supported history together</h2>
        <p style={s.p}>
          CamCash is built around supported imports — <strong style={{ color: 'white' }}>Chaturbate, BongaCams, and MyFreeCams</strong>. Each platform keeps its own source data while the dashboard applies consistent analytics definitions wherever a comparison is actually valid.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Cross-platform context for scheduling</h2>
        <p style={s.p}>
          Once more than one platform is available, CamCash can compare performance by platform and time, so your schedule can rest on evidence instead of habit — feeding directly into <a href="/features/best-hours" style={{ color: T.cyan, textDecoration: 'none' }}>Best Hours</a>.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Free vs. Creator Pro</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <div style={s.card}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.cyan, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Free</div>
            <p style={{ ...s.p, fontSize: 14, marginBottom: 0 }}>Track one platform and see its full analytics.</p>
          </div>
          <div style={{ ...s.card, border: `1px solid rgba(168,85,247,0.3)`, background: 'rgba(168,85,247,0.05)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.purple, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Creator Pro</div>
            <p style={{ ...s.p, fontSize: 14, marginBottom: 0 }}>Track every supported platform and compare earnings, hours, and $/hour side by side.</p>
          </div>
        </div>
      </section>
    </FeatureLayout>
  )
}

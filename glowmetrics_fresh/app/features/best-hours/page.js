import FeatureLayout, { T, s, faqSchemaFrom, Checklist } from '../../../components/FeatureLayout'

export const metadata = {
  title: 'Best Hours to Stream for Cam Models | Find Your Highest-Earning Windows | CamCash',
  description: 'Find the days and hours that produce your strongest earning rate, built from your own stream history — not generic Chaturbate hours advice.',
  keywords: ['best time to cam', 'chaturbate hours', 'chaturbate schedule', 'best hours to stream', 'camgirl schedule'],
  alternates: { canonical: 'https://www.camcashgrl.com/features/best-hours' },
  openGraph: {
    title: 'Best Hours to Stream for Cam Models | CamCash',
    description: 'Find the days and hours producing the strongest earning rate from your own stream history.',
    url: 'https://www.camcashgrl.com/features/best-hours',
    type: 'website',
    images: [{ url: 'https://www.camcashgrl.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best Hours to Stream for Cam Models | CamCash',
    description: 'Find the days and hours producing the strongest earning rate from your own stream history.',
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Best Hours to Stream for Cam Models',
  description: 'Find the days and hours that produce your strongest earning rate from your real stream history.',
  url: 'https://www.camcashgrl.com/features/best-hours',
  isPartOf: { '@type': 'WebSite', name: 'CamCash', url: 'https://www.camcashgrl.com' },
}

const faq = [
  { q: 'How does CamCash find my best time to stream?', a: 'Stream Planner analyzes your session history and looks for day/time windows with enough qualifying sessions to make a fair comparison, ranked by earnings per hour — not just total tips.' },
  { q: 'Is this the same as Chaturbate\'s platform-wide peak hours?', a: 'No. Platform-wide traffic (commonly 8 PM–2 AM EST, heaviest on Saturdays) describes the average room, not yours. A model with a mostly European audience or a loyal base of regulars will see a different personal peak — CamCash builds your schedule from your own history.' },
  { q: 'Does CamCash use UTC or my local time?', a: 'Your schedule is shown in your resolved local timezone, not UTC — so the window you see is the clock you actually stream by.' },
  { q: 'What if I don\'t have enough history yet?', a: 'Stream Planner shows an honest early-signal or "not enough data yet" state instead of pretending a handful of sessions proves a best time. It will also flag untested but promising windows next to your strong ones once you have some history.' },
  { q: 'Is Best Hours free?', a: 'Free users see today\'s recommended plan. Creator Pro unlocks the full weekly schedule, fan-return-window overlays, and progress tracking against your plan.' },
]

export default function BestHoursFeaturePage() {
  return (
    <FeatureLayout
      schema={[webPageSchema, faqSchemaFrom(faq)]}
      breadcrumb={[{ label: 'Best Hours' }]}
      eyebrow="CamCash Feature"
      h1="Stream when your time is worth more."
      subhead="Your best streaming time should come from your own history — not a generic schedule someone posted online."
      heroNote="Free: today's plan · Pro: full weekly schedule"
      primaryCta={{ label: 'Find My Best Hours', href: '/landing' }}
      faq={faq}
      finalCta={{
        headline: 'Build a schedule from your own evidence.',
        sub: 'Upload your CSV and see the days and hours that actually earn — not the ones you\'ve just been assuming.',
        label: 'Find My Best Hours',
        href: '/landing',
      }}
      related={[
        { href: '/guides/chaturbate-best-hours', label: 'Chaturbate best hours guide' },
        { href: '/guides/best-time-to-stream-chaturbate', label: 'Best time to stream on Chaturbate' },
        { href: '/features/top-fans', label: 'Top Fans' },
        { href: '/features/cam-earnings-analyzer', label: 'Earnings Analyzer' },
      ]}
    >
      <Checklist items={[
        'The days and hours with your strongest $/hour',
        'The session count behind every recommendation',
        'Your schedule shown in your own local time',
        'Untested windows worth trying next',
      ]} />

      <section style={s.section}>
        <h2 style={s.h2}>Best time is not the same as most tips</h2>
        <p style={s.p}>
          A single hour can produce the most total tips simply because you stream there more often. Stream Planner evaluates session history so the recommendation reflects earning <em>performance</em> — dollars per hour streamed — not raw activity volume.
        </p>
        <div style={{ borderRadius: 16, border: `1px solid ${T.border}`, background: T.card, padding: 24, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.muted, marginBottom: 16 }}>Stream Planner — example window comparison</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 100 }}>
            {[38, 52, 30, 70, 45, 25, 60].map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '6px 6px 0 0', background: h === 70 ? `linear-gradient(180deg, ${T.cyan}, ${T.purple})` : 'rgba(255,255,255,0.08)' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: T.muted }}>
            <span>Sun</span><span>Mon</span><span>Tue</span><span style={{ color: T.cyan, fontWeight: 700 }}>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
          </div>
        </div>
        <p style={{ ...s.p, fontSize: 13, color: T.muted, marginTop: 8 }}>Illustrative only — your real window comparison is calculated from your imported session history.</p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>See the pattern, not just a clock time</h2>
        <p style={s.p}>
          A useful best-window result should tell you more than "9 PM." Stream Planner pairs the window with session count and hourly performance, and — where you also track fan activity — can flag windows where your top supporters have historically shown up. It can also surface untested windows sitting right next to a strong one, worth trying next.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Turn a best-hour insight into a weekly plan</h2>
        <p style={s.p}>
          The point of finding a strong window isn't to admire a chart — it's to decide what to test next. Stream Planner turns the strongest evidence in your history into a practical weekly plan you can actually follow.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Free vs. Creator Pro</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <div style={s.card}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.cyan, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Free</div>
            <p style={{ ...s.p, fontSize: 14, marginBottom: 0 }}>See today's recommended stream window based on your history.</p>
          </div>
          <div style={{ ...s.card, border: `1px solid rgba(168,85,247,0.3)`, background: 'rgba(168,85,247,0.05)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.purple, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Creator Pro</div>
            <p style={{ ...s.p, fontSize: 14, marginBottom: 0 }}>Your full 7-day plan, fan-window overlays, and progress tracking against the schedule.</p>
          </div>
        </div>
      </section>
    </FeatureLayout>
  )
}

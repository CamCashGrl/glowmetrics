import FeatureLayout, { T, s, faqSchemaFrom, Checklist } from '../../../components/FeatureLayout'

export const metadata = {
  title: 'Live Mode Coaching for Cam Models | Real-Time Stream Analytics | CamCash',
  description: 'See what is happening while you are still live. Track pace, goals, and fan activity in real time with CamCash Live Mode, then react before the session ends.',
  keywords: ['cam model live coaching', 'live stream earnings tracker', 'cam model stream tracker', 'real time cam analytics'],
  alternates: { canonical: 'https://www.camcashgrl.com/features/live-mode' },
  openGraph: {
    title: 'Live Mode Coaching for Cam Models | CamCash',
    description: 'See what is happening while still live and react to pace, goals, fan activity, and coaching signals.',
    url: 'https://www.camcashgrl.com/features/live-mode',
    type: 'website',
    images: [{ url: 'https://www.camcashgrl.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Live Mode Coaching for Cam Models | CamCash',
    description: 'See what is happening while still live and react to pace, goals, fan activity, and coaching signals.',
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Live Mode Coaching for Cam Models',
  description: 'See what is happening while still live and react to pace, goals, fan activity, and coaching signals.',
  url: 'https://www.camcashgrl.com/features/live-mode',
  isPartOf: { '@type': 'WebSite', name: 'CamCash', url: 'https://www.camcashgrl.com' },
}

const faq = [
  { q: 'What is Live Mode?', a: 'Live Mode is the real-time layer of CamCash — it tracks your current session\'s pace, tip activity, and goal progress while you\'re still streaming, instead of only reporting on it afterward.' },
  { q: 'Does Live Mode replace post-stream analytics?', a: 'No, it complements them. Live Mode helps during the stream; Command Center and Analytics help you review what happened once it\'s over.' },
  { q: 'What does Live Mode coach on?', a: 'Depending on available signals: earnings pace against your own baseline, goal progress, and fan or high-tipper activity during the current session.' },
  { q: 'Is Live Mode free?', a: 'Basic Live Mode — current tips, live earnings, and a recent tip feed — is available on the free plan. The full coaching experience, including pace-vs-baseline comparisons and post-stream recap, is a Creator Pro feature.' },
  { q: 'What if I don\'t have stream history yet?', a: 'Live Mode still tracks the current session in real time. Import your past history later to compare this stream against your normal performance.' },
]

export default function LiveModeFeaturePage() {
  return (
    <FeatureLayout
      schema={[webPageSchema, faqSchemaFrom(faq)]}
      breadcrumb={[{ label: 'Live Mode' }]}
      eyebrow="CamCash Feature"
      h1="See what's happening while you're still live."
      subhead="Post-stream analytics tell you what happened. Live Mode is built for the moment when you can still do something about it."
      heroNote="Free: basic Live Mode · Pro: full coaching"
      primaryCta={{ label: 'Start Live Mode', href: '/landing' }}
      faq={faq}
      finalCta={{
        headline: 'React while the session is still happening.',
        sub: 'Track pace, goals, and fan activity live — then get a recap once you\'re done.',
        label: 'Start Live Mode',
        href: '/landing',
      }}
      related={[
        { href: '/features/best-hours', label: 'Best Hours' },
        { href: '/features/top-fans', label: 'Top Fans' },
        { href: '/blog/what-to-do-when-cam-room-is-slow', label: 'What to do when your room is slow' },
        { href: '/features/cam-earnings-analyzer', label: 'Earnings Analyzer' },
      ]}
    >
      <Checklist items={[
        "Your current session's pace vs. your average",
        'Live tip activity as it happens',
        'Goal progress in real time',
        'A recap once you\'re done streaming',
      ]} />

      <section style={s.section}>
        <h2 style={s.h2}>From reporting to real-time decisions</h2>
        <p style={s.p}>
          A post-stream report can tell you a session slowed down — an hour too late to matter. Live Mode is built for the moment you can still change what happens next: current earnings pace, tip activity, and goal progress, live in the room.
        </p>
        <div style={{ borderRadius: 16, border: `1px solid ${T.border}`, background: T.card, padding: 24, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.pink, boxShadow: `0 0 8px ${T.pink}` }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.pink }}>Live Mode — example layout</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderSoft}` }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>Pace vs. your average</div>
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '72%', background: `linear-gradient(90deg, ${T.cyan}, ${T.green})` }} />
              </div>
            </div>
            <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderSoft}` }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>Session goal</div>
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '45%', background: `linear-gradient(90deg, ${T.gold}, ${T.pink})` }} />
              </div>
            </div>
          </div>
        </div>
        <p style={{ ...s.p, fontSize: 13, color: T.muted, marginTop: 8 }}>Illustrative — real Live Mode figures come from the current session as it happens.</p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Coaching should be timely, not noisy</h2>
        <p style={s.p}>
          A useful coaching system shouldn't fire generic messages every few minutes. CamCash uses defined triggers so a prompt only appears when there's a reason for it — and the interface prioritizes the one action that matters most right now.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Built as the execution layer</h2>
        <p style={s.p}>
          <a href="/features/cam-earnings-analyzer" style={{ color: T.cyan, textDecoration: 'none' }}>Command Center</a> helps you understand what happened. <a href="/features/best-hours" style={{ color: T.cyan, textDecoration: 'none' }}>Stream Planner</a> helps decide when to show up. Live Mode is where that plan meets the live room.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Free vs. Creator Pro</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <div style={s.card}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.cyan, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Free</div>
            <p style={{ ...s.p, fontSize: 14, marginBottom: 0 }}>Current tips, live earnings, and a recent tip feed while you stream.</p>
          </div>
          <div style={{ ...s.card, border: `1px solid rgba(168,85,247,0.3)`, background: 'rgba(168,85,247,0.05)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.purple, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Creator Pro</div>
            <p style={{ ...s.p, fontSize: 14, marginBottom: 0 }}>Full coaching: pace vs. your baseline, goal-tracking prompts, and a post-stream recap.</p>
          </div>
        </div>
      </section>
    </FeatureLayout>
  )
}

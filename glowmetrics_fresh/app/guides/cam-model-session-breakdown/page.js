import Button from '../../../components/ui/Button'

export const metadata = {
  title: 'Cam Model Session Breakdown',
  description: 'Break down each cam session by earnings, tips, top fans, and timing — so you know exactly what made a session strong or slow.',
  alternates: { canonical: 'https://www.camcashgrl.com/guides/cam-model-session-breakdown' },
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Cam Model Session Breakdown',
  description: 'Break down each cam session by earnings, tips, top fans, and timing — so you know exactly what made a session strong or slow.',
  url: 'https://www.camcashgrl.com/guides/cam-model-session-breakdown',
  author: { '@type': 'Organization', name: 'CamCash', url: 'https://www.camcashgrl.com' },
  publisher: { '@type': 'Organization', name: 'CamCash', url: 'https://www.camcashgrl.com' },
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://www.camcashgrl.com/guides/cam-model-session-breakdown' },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'What is a cam model session breakdown?', acceptedAnswer: { '@type': 'Answer', text: 'A session breakdown analyzes a single streaming session from your tip history — showing earnings per hour, which fans tipped and when, and whether income built up over the session or was concentrated early.' } },
    { '@type': 'Question', name: 'Why does session-level data matter more than monthly totals?', acceptedAnswer: { '@type': 'Answer', text: 'Monthly totals hide which sessions actually worked. Breaking earnings down by session shows what made a stream strong or slow, so you can repeat what worked instead of guessing.' } },
    { '@type': 'Question', name: 'What does front-loaded vs. back-loaded income mean?', acceptedAnswer: { '@type': 'Answer', text: "Front-loaded income means most tips came early in the session; back-loaded means tips built up toward the end. Knowing which pattern is typical for you helps you plan goals and pacing during a stream." } },
    { '@type': 'Question', name: 'How does CamCash generate session breakdowns?', acceptedAnswer: { '@type': 'Answer', text: 'CamCash processes your uploaded tip history CSV and automatically groups tips into individual sessions, calculating earnings per hour, top tippers, and timing patterns for each one.' } },
  ],
}

export default function CamModelSessionBreakdown() {
  return (
    <div style={{ background: '#05070f', minHeight: '100vh', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <nav style={{ padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/landing" style={{ fontWeight: 700, fontSize: 15, color: 'white', textDecoration: 'none', letterSpacing: '-0.2px' }}>💜 CamCash</a>
        <Button as="a" href="/login" style={{ padding: '8px 20px', fontSize: 13 }}>Start Free →</Button>
      </nav>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '60px 24px 100px' }}>
        <h1 style={{ fontSize: 40, fontWeight: 900, color: 'white', lineHeight: 1.15, marginBottom: 20, letterSpacing: '-0.02em' }}>
          Cam Model Session Breakdown
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.75, color: '#cbd5e1', marginBottom: 36, paddingLeft: 16, borderLeft: '3px solid #6366f1' }}>
          CamCash breaks down every session in your tip history — showing earnings per hour, which fans tipped and when, how each session compares to your average, and whether income was front-loaded or back-loaded. Understanding your session patterns is the fastest way to find out what actually makes a stream profitable.
        </p>
        <a href="/dashboard" style={{ display: 'inline-block', padding: '13px 32px', borderRadius: 9, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
          See My Session Breakdown →
        </a>

        <h2 style={{ fontSize: 24, fontWeight: 800, color: 'white', marginTop: 56, marginBottom: 18 }}>FAQ</h2>
        {faqSchema.mainEntity.map((item, i) => (
          <div key={i} style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>{item.name}</h3>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: '#94a3b8' }}>{item.acceptedAnswer.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

import Button from '../../../components/ui/Button'

export const metadata = {
  title: 'Cam Model Top Tipper Tracker',
  description: 'See which fans tip the most, how much they have spent lifetime, and when they last tipped — so you can protect your highest-value relationships.',
  alternates: { canonical: 'https://www.camcashgrl.com/guides/cam-model-top-tippers' },
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Cam Model Top Tipper Tracker',
  description: 'See which fans tip the most, how much they have spent lifetime, and when they last tipped — so you can protect your highest-value relationships.',
  url: 'https://www.camcashgrl.com/guides/cam-model-top-tippers',
  author: { '@type': 'Organization', name: 'CamCash', url: 'https://www.camcashgrl.com' },
  publisher: { '@type': 'Organization', name: 'CamCash', url: 'https://www.camcashgrl.com' },
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://www.camcashgrl.com/guides/cam-model-top-tippers' },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'How much of my income comes from top tippers?', acceptedAnswer: { '@type': 'Answer', text: 'The top 10–15% of fans typically drive 60–70% of total income for most models, which is why tracking and protecting those relationships matters more than chasing new viewers alone.' } },
    { '@type': 'Question', name: 'How does CamCash identify top tippers?', acceptedAnswer: { '@type': 'Answer', text: 'CamCash ranks every tipper in your uploaded history by lifetime spend, average tip size, and days since their last tip, so you can see at a glance who your most valuable fans are.' } },
    { '@type': 'Question', name: 'What does days since last tip tell me?', acceptedAnswer: { '@type': 'Answer', text: 'It flags fans who used to tip regularly but have gone quiet, so you can re-engage them before they churn completely instead of only noticing after they are already gone.' } },
    { '@type': 'Question', name: 'What data do I need to see my top tippers?', acceptedAnswer: { '@type': 'Answer', text: 'Upload your tip history CSV from Chaturbate or BongaCams. CamCash processes it and ranks your fans automatically — no manual spreadsheet work required.' } },
  ],
}

export default function CamModelTopTippers() {
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
          Your Top Tippers
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.75, color: '#cbd5e1', marginBottom: 36, paddingLeft: 16, borderLeft: '3px solid #6366f1' }}>
          The top 10–15% of your fans typically drive 60–70% of your total income. CamCash ranks every tipper in your history by lifetime spend, average tip size, and days since last tip — so you always know who your most valuable fans are and can re-engage them before they go cold.
        </p>
        <a href="/dashboard" style={{ display: 'inline-block', padding: '13px 32px', borderRadius: 9, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
          See My Top Tippers →
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

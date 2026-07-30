import Button from '../../../components/ui/Button'

export const metadata = {
  title: 'Cam Model Analytics',
  description: 'See your cam model analytics — earnings per hour, top fans, peak streaming windows, and platform comparisons — all in one dashboard.',
  alternates: { canonical: 'https://www.camcashgrl.com/guides/cam-model-analytics' },
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Cam Model Analytics Dashboard',
  description: 'See your cam model analytics — earnings per hour, top fans, peak streaming windows, and platform comparisons — all in one dashboard.',
  url: 'https://www.camcashgrl.com/guides/cam-model-analytics',
  author: { '@type': 'Organization', name: 'CamCash', url: 'https://www.camcashgrl.com' },
  publisher: { '@type': 'Organization', name: 'CamCash', url: 'https://www.camcashgrl.com' },
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://www.camcashgrl.com/guides/cam-model-analytics' },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'What is cam model analytics?', acceptedAnswer: { '@type': 'Answer', text: 'Cam model analytics is the practice of analyzing your tip history to see real earnings per hour, which fans drive the most income, your peak streaming windows, and how your platforms compare — instead of relying on raw platform totals alone.' } },
    { '@type': 'Question', name: 'What data does CamCash use for analytics?', acceptedAnswer: { '@type': 'Answer', text: 'CamCash builds your dashboard from your Chaturbate or BongaCams tip history CSV. Upload the export from your platform and CamCash processes it into earnings, fan, and session analytics automatically.' } },
    { '@type': 'Question', name: 'How long does it take to see my analytics?', acceptedAnswer: { '@type': 'Answer', text: 'Uploading your CSV and seeing your full dashboard typically takes under two minutes.' } },
    { '@type': 'Question', name: 'Can I compare earnings across platforms?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. CamCash shows your earnings per hour on each platform side by side, so you can see which platform is actually the best use of your streaming time.' } },
  ],
}

export default function CamModelAnalytics() {
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
          Cam Model Analytics Dashboard
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.75, color: '#cbd5e1', marginBottom: 36, paddingLeft: 16, borderLeft: '3px solid #6366f1' }}>
          CamCash turns your Chaturbate or BongaCams tip history into a full analytics dashboard — showing your real earnings per hour, which fans drive most of your income, your peak streaming windows, and how your platforms compare side by side. Upload your CSV and see your numbers in under two minutes.
        </p>
        <a href="/dashboard" style={{ display: 'inline-block', padding: '13px 32px', borderRadius: 9, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
          Open My Analytics Dashboard →
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

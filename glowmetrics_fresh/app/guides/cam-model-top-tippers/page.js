import Button from '../../../components/ui/Button'

export const metadata = {
  title: 'Cam Model Top Tipper Tracker',
  description: 'See which fans tip the most, how much they have spent lifetime, and when they last tipped — so you can protect your highest-value relationships.',
  alternates: { canonical: 'https://www.camcashgrl.com/guides/cam-model-top-tippers' },
}

export default function CamModelTopTippers() {
  return (
    <div style={{ background: '#05070f', minHeight: '100vh', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
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
      </div>
    </div>
  )
}

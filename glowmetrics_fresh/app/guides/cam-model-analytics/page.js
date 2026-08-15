import Button from '../../../components/ui/Button'

export const metadata = {
  title: 'Cam Model Analytics: Earnings, Top Fans & Peak Hours',
  description: 'Free cam model analytics dashboard — your real earnings per hour, top fans, peak streaming windows, and platform comparisons, all in one place.',
  alternates: { canonical: 'https://www.camcashgrl.com/guides/cam-model-analytics' },
}

export default function CamModelAnalytics() {
  return (
    <div style={{ background: '#05070f', minHeight: '100vh', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
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
      </div>
    </div>
  )
}

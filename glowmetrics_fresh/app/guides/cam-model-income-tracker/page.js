import Button from '../../../components/ui/Button'

export const metadata = {
  title: 'Cam Model Income Tracker',
  description: 'Track your cam model income by session, hour, platform, and fan — and find out exactly where your money comes from.',
  alternates: { canonical: 'https://www.camcashgrl.com/guides/cam-model-income-tracker' },
}

export default function CamModelIncomeTracker() {
  return (
    <div style={{ background: '#05070f', minHeight: '100vh', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
      <nav style={{ padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/landing" style={{ fontWeight: 700, fontSize: 15, color: 'white', textDecoration: 'none', letterSpacing: '-0.2px' }}>💜 CamCash</a>
        <Button as="a" href="/login" style={{ padding: '8px 20px', fontSize: 13 }}>Start Free →</Button>
      </nav>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '60px 24px 100px' }}>
        <h1 style={{ fontSize: 40, fontWeight: 900, color: 'white', lineHeight: 1.15, marginBottom: 20, letterSpacing: '-0.02em' }}>
          Cam Model Income Tracker
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.75, color: '#cbd5e1', marginBottom: 36, paddingLeft: 16, borderLeft: '3px solid #6366f1' }}>
          Tracking total monthly tokens tells you almost nothing. CamCash tracks your cam income by session, hour of day, platform, and individual fan — so you can see your real earnings per hour, identify your peak windows, and know which fans are responsible for most of your income. Upload your CSV to get started.
        </p>
        <a href="/dashboard" style={{ display: 'inline-block', padding: '13px 32px', borderRadius: 9, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
          Track My Income →
        </a>
      </div>
    </div>
  )
}

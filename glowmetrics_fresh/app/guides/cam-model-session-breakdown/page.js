import Button from '../../../components/ui/Button'

export const metadata = {
  title: 'Cam Model Session Breakdown',
  description: 'Break down each cam session by earnings, tips, top fans, and timing — so you know exactly what made a session strong or slow.',
  alternates: { canonical: 'https://www.camcashgrl.com/guides/cam-model-session-breakdown' },
}

export default function CamModelSessionBreakdown() {
  return (
    <div style={{ background: '#05070f', minHeight: '100vh', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
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
      </div>
    </div>
  )
}

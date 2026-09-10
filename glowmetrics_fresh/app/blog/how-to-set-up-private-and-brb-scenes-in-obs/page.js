import ArticleLayout from '../../components/ArticleLayout'

export const metadata = {
  title: 'How to Set Up Private and BRB Scenes in OBS for Cam Models',
  description: 'Create reusable OBS scenes for BRB, starting, technical issues, and private-show transitions so your stream workflow is faster and less error-prone.',
  alternates: { canonical: 'https://www.camcashgrl.com/blog/how-to-set-up-private-and-brb-scenes-in-obs' },
  openGraph: { title: 'How to Set Up Private and BRB Scenes in OBS for Cam Models', description: 'Create reusable OBS scenes for BRB, starting, technical issues, and private-show transitions so your stream workflow is faster and less error-prone.', url: 'https://www.camcashgrl.com/blog/how-to-set-up-private-and-brb-scenes-in-obs', type: 'article' },
  twitter: { card: 'summary_large_image', title: 'How to Set Up Private and BRB Scenes in OBS for Cam Models', description: 'Create reusable OBS scenes for BRB, starting, technical issues, and private-show transitions so your stream workflow is faster and less error-prone.' },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Set Up Private and BRB Scenes in OBS for Cam Models',
  description: 'Create reusable OBS scenes for BRB, starting, technical issues, and private-show transitions so your stream workflow is faster and less error-prone.',
  url: 'https://www.camcashgrl.com/blog/how-to-set-up-private-and-brb-scenes-in-obs',
  datePublished: '2026-08-26',
  dateModified: '2026-08-26',
  author: { '@type': 'Organization', name: 'CamCashGrl', url: 'https://www.camcashgrl.com' },
  publisher: { '@type': 'Organization', name: 'CamCashGrl', url: 'https://www.camcashgrl.com' },
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://www.camcashgrl.com/blog/how-to-set-up-private-and-brb-scenes-in-obs' },
}

const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
    { '@type': 'Question', name: 'What OBS scenes should a cam model have?', acceptedAnswer: { '@type': 'Answer', text: 'At minimum, consider a live scene, BRB scene, starting scene, and simple technical-recovery scene.' } },
    { '@type': 'Question', name: 'Can an OBS scene protect a private show?', acceptedAnswer: { '@type': 'Answer', text: 'It can control the video output on the machine, but it does not automatically change the state of your other cam platforms. Private-show safety requires a broader workflow.' } },
    { '@type': 'Question', name: 'How many OBS scenes are too many?', acceptedAnswer: { '@type': 'Answer', text: 'There is no universal limit. Keep only scenes you can recognize and switch reliably while live.' } },
  ] }
const s = {
  meta: { fontSize: '12px', color: '#475569', marginBottom: '28px', display: 'flex', gap: '16px', flexWrap: 'wrap' },
  h1: { fontSize: '34px', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.15, marginBottom: '24px', letterSpacing: '-0.025em' },
  h2: { fontSize: '24px', lineHeight: 1.25, color: '#f1f5f9', fontWeight: 800, margin: '38px 0 16px' },
  h3: { fontSize: '18px', lineHeight: 1.3, color: '#e2e8f0', fontWeight: 700, margin: '28px 0 12px' },
  p: { fontSize: '15px', lineHeight: 1.8, color: '#94a3b8', margin: '0 0 20px' },
  intro: { fontSize: '17px', lineHeight: 1.75, color: '#cbd5e1', margin: '0 0 28px' },
  quickAnswer: { background: 'rgba(22,244,255,0.06)', border: '1px solid rgba(22,244,255,0.16)', borderRadius: '12px', padding: '20px 24px', marginBottom: '30px' },
  quickLabel: { fontSize: '11px', fontWeight: 800, color: '#16F4FF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' },
  box: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px 24px', margin: '24px 0 30px' },
  ul: { color: '#94a3b8', paddingLeft: 22, lineHeight: 1.8, marginBottom: 22 },
  li: { marginBottom: 8 },
  midCta: { background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '12px', padding: '22px 24px', margin: '32px 0' },
  midCtaT: { fontSize: '16px', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px' },
  midCtaBody: { fontSize: '14px', color: '#64748b', lineHeight: 1.65, marginBottom: '16px' },
  midCtaBtn: { display: 'inline-block', padding: '9px 22px', borderRadius: '7px', background: '#10b981', color: 'white', fontWeight: 600, fontSize: '14px', textDecoration: 'none' },
  finalCta: { background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(139,92,246,0.08) 100%)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '14px', padding: '36px 28px', margin: '44px 0 36px', textAlign: 'center' },
  finalCtaH: { fontSize: '22px', fontWeight: 800, color: '#f1f5f9', marginBottom: '12px', letterSpacing: '-0.02em' },
  finalCtaSub: { fontSize: '14px', color: '#64748b', lineHeight: 1.7, marginBottom: '20px' },
  finalCtaBtn: { display: 'inline-block', padding: '13px 36px', borderRadius: '9px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontWeight: 700, fontSize: '16px', textDecoration: 'none' },
  faqSection: { marginTop: '48px', paddingTop: '32px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  faqH: { fontSize: '20px', fontWeight: 700, color: '#e2e8f0', marginBottom: '24px', letterSpacing: '-0.01em' },
  faqItem: { marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  faqQ: { fontSize: '15px', fontWeight: 700, color: '#c7d2fe', marginBottom: '8px' },
  faqA: { fontSize: '14px', color: '#94a3b8', lineHeight: 1.75 },
  link: { color: '#a5b4fc', textDecoration: 'none' },
}
export default function BlogPost() {
  return (
    <ArticleLayout
      schema={[schema, faqSchema]}
      breadcrumb={[{ label: 'Blog', href: '/blog' }, { label: 'How to Set Up Private and BRB Scenes in OBS for Cam Models' }]}
    >
      <div style={s.meta}><span>CamCashGrl</span><span>Updated August 2026</span></div>
      <h1 style={s.h1}>How to Set Up Private and BRB Scenes in OBS for Cam Models</h1>
      <p style={s.intro}>If you use OBS regularly, reusable scenes can save you from making last-second changes during a live show. BRB, starting-soon, technical-issue, and private-transition scenes are especially useful when you need to change what your audience sees quickly.</p>
      <h2 style={s.h2}>Why scenes matter</h2><p style={s.p}>A scene is a prepared visual state. Instead of turning off sources individually, you can switch to a prebuilt layout with the correct camera, text, background, and audio behavior.</p>
      <h2 style={s.h2}>Build four basic scenes</h2><ul style={s.ul}><li style={s.li}><strong>Starting:</strong> a simple screen while you finish setup.</li><li style={s.li}><strong>Live:</strong> your normal camera and overlays.</li><li style={s.li}><strong>BRB:</strong> a neutral away message.</li><li style={s.li}><strong>Technical issue:</strong> a fallback scene when your camera or network needs attention.</li></ul>
      <h2 style={s.h2}>Private-show transitions need extra care</h2><p style={s.p}>A private transition should never be treated as merely another OBS scene. The scene controls your video output, but each other cam platform still has its own room state and rules. Use the scene as one part of the workflow, not the whole solution.</p>
      <h2 style={s.h2}>Make your scenes boring to operate</h2><p style={s.p}>Put the same controls in the same location. Give scenes clear names. Keep important audio sources obvious. The goal is to reduce decisions while you are live.</p>
      <div style={s.midCta}><div style={s.midCtaT}>Test every scene before you need it</div><p style={s.midCtaBody}>Switch through your scenes while recording locally. Confirm the camera, audio, text, and transitions work exactly as expected.</p></div>
      <h2 style={s.h2}>Create a recovery scene</h2><p style={s.p}>If your webcam disappears or your encoder needs restarting, a recovery scene buys you time without leaving viewers staring at a broken feed. Keep it simple and easy to select.</p>

      <div style={s.finalCta}>
        <div style={s.finalCtaH}>Turn stream history into better decisions.</div>
        <p style={s.finalCtaSub}>CamCashGrl helps models track earnings, sessions, fans, platforms, and the hours that actually perform best for them.</p>
        <a href="/landing" style={s.finalCtaBtn}>Start Tracking Free →</a>
      </div>

      <div style={s.faqSection}>
        <h2 style={s.faqH}>Frequently Asked Questions</h2>
        <div style={s.faqItem}><div style={s.faqQ}>What OBS scenes should a cam model have?</div><p style={s.faqA}>At minimum, consider a live scene, BRB scene, starting scene, and simple technical-recovery scene.</p></div>
        <div style={s.faqItem}><div style={s.faqQ}>Can an OBS scene protect a private show?</div><p style={s.faqA}>It can control the video output on the machine, but it does not automatically change the state of your other cam platforms. Private-show safety requires a broader workflow.</p></div>
        <div style={s.faqItem}><div style={s.faqQ}>How many OBS scenes are too many?</div><p style={s.faqA}>There is no universal limit. Keep only scenes you can recognize and switch reliably while live.</p></div>
      </div>
    </ArticleLayout>
  )
}

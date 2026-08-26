import ArticleLayout from '../../components/ArticleLayout'

const schema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to Use MyFreeCams With OBS: External Broadcasting Setup',
  description: 'A practical MyFreeCams OBS setup guide covering the ModelWeb connection, Stream Key, OBS settings, camera, audio, preview, and common setup mistakes.',
  url: 'https://www.camcashgrl.com/blog/how-to-use-myfreecams-with-obs',
  datePublished: '2026-08-26',
  dateModified: '2026-08-26',
  author: { '@type': 'Organization', name: 'CamCashGrl', url: 'https://www.camcashgrl.com' },
  publisher: { '@type': 'Organization', name: 'CamCashGrl', url: 'https://www.camcashgrl.com' },
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://www.camcashgrl.com/blog/how-to-use-myfreecams-with-obs' },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'Do I need to be logged into MFC ModelWeb when using OBS?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. MyFreeCams says models must be logged into ModelWeb to broadcast even when using an external broadcaster such as OBS.' } },
    { '@type': 'Question', name: 'Where do I find my MFC Stream Key?', acceptedAnswer: { '@type': 'Answer', text: 'In ModelWeb, open Options → External Broadcaster → Stream Key & URL, then click Stream Key to copy it.' } },
    { '@type': 'Question', name: 'What OBS settings should I start with for MFC?', acceptedAnswer: { '@type': 'Answer', text: 'MFC currently recommends starting with x264, 3000 kbps at 1280×720, 30 FPS, and 160 kbps audio.' } }
  ],
}

export const metadata = {
  title: 'How to Use MyFreeCams With OBS: External Broadcasting Setup',
  description: 'A practical MyFreeCams OBS setup guide covering the ModelWeb connection, Stream Key, OBS settings, camera, audio, preview, and common setup mistakes.',
  alternates: { canonical: 'https://www.camcashgrl.com/blog/how-to-use-myfreecams-with-obs' },
  openGraph: {
    title: 'How to Use MyFreeCams With OBS: External Broadcasting Setup',
    description: DESCRIPTION,
    url: CANONICAL,
    type: 'article',
    images: [{ url: 'https://www.camcashgrl.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How to Use MyFreeCams With OBS: External Broadcasting Setup',
    description: DESCRIPTION,
  },
}

const s = {
  p: { fontSize: '15px', lineHeight: 1.8, color: '#94a3b8', margin: '0 0 20px' },
  h2: { fontSize: '24px', lineHeight: 1.25, color: '#f1f5f9', fontWeight: 800, margin: '38px 0 16px' },
  h3: { fontSize: '18px', lineHeight: 1.3, color: '#e2e8f0', fontWeight: 800, margin: '28px 0 12px' },
  ul: { color: '#94a3b8', paddingLeft: 22, lineHeight: 1.8, marginBottom: 22 },
  li: { marginBottom: 8 },
  box: { background: 'rgba(22,244,255,0.05)', border: '1px solid rgba(22,244,255,0.14)', borderRadius: 16, padding: '20px 22px', margin: '24px 0' },
  cta: { background: 'linear-gradient(135deg, rgba(22,244,255,0.10), rgba(124,92,255,0.10))', border: '1px solid rgba(124,92,255,0.22)', borderRadius: 18, padding: '24px', margin: '34px 0' },
  link: { color: '#16F4FF', textDecoration: 'none', fontWeight: 700 },
}

export default function Page() {
  return (
    <ArticleLayout
      schema={schema}
      breadcrumb={[{ label: 'Blog', href: '/blog' }, { label: 'How to Use MyFreeCams With OBS: External Broadcasting Setup' }]}
    >
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: 28 }}>
        Active-model technical guide · August 2026
      </div>

      <h1 style={{ fontSize: 29, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.2, marginBottom: 24 }}>
        How to Use MyFreeCams With OBS: External Broadcasting Setup
      </h1>

      
<p style={s.p}>MyFreeCams currently supports external broadcasting with OBS and other RTMP broadcaster apps. The setup is straightforward once you know where the MFC Stream Key lives and how ModelWeb and OBS work together.</p>

<div style={s.box}>
  <strong style={{color:'#f1f5f9'}}>Quick answer:</strong>
  <span style={{color:'#94a3b8'}}> Log into MFC ModelWeb, open Options → External Broadcaster → Stream Key &amp; URL, copy the Stream Key, then open OBS → Settings → Stream and select MyFreeCams. MFC says you still need to stay logged into ModelWeb while using OBS.</span>
</div>

<h2 style={s.h2}>What you need</h2>
<ul style={s.ul}>
  <li style={s.li}>A MyFreeCams model account.</li>
  <li style={s.li}>OBS Studio installed on your computer.</li>
  <li style={s.li}>A webcam and microphone.</li>
  <li style={s.li}>A reliable internet connection.</li>
  <li style={s.li}>Your current MFC Stream Key.</li>
</ul>

<h2 style={s.h2}>Step 1: Open MFC ModelWeb</h2>
<p style={s.p}>Open MyFreeCams ModelWeb and log in with your model account. MFC states that models must remain logged into ModelWeb even when an external broadcaster such as OBS is sending the video.</p>

<h2 style={s.h2}>Step 2: Find the MFC Stream Key</h2>
<p style={s.p}>Inside ModelWeb, click <strong>Options</strong> in the lower-left area, select <strong>External Broadcaster</strong>, then open <strong>Stream Key &amp; URL</strong>. Click the Stream Key to copy it.</p>

<p style={s.p}>Treat the key like a credential. Do not put it in screenshots, public posts, or shared troubleshooting threads.</p>

<h2 style={s.h2}>Step 3: Connect OBS</h2>
<p style={s.p}>Open OBS and select <strong>Settings → Stream</strong>. MFC's current OBS documentation says to expand the Service selector, choose <strong>MyFreeCams</strong>, and paste your MFC Stream Key into the Stream Key field. MFC says not to change the server unless you are experiencing a connection problem.</p>

<h2 style={s.h2}>Step 4: Use MFC's starting OBS settings</h2>
<p style={s.p}>For a first OBS setup, MFC currently recommends the Software (x264) encoder, 3000 kbps at 1280×720, 30 FPS, and 160 kbps audio. MFC also lists 6 Mbps upload as a minimum and 12+ Mbps as recommended.</p>

<p style={s.p}>Start with the platform's recommended configuration before experimenting with higher resolution or frame rates.</p>

<h2 style={s.h2}>Step 5: Add your webcam and microphone</h2>
<p style={s.p}>In OBS, add your webcam as a <strong>Video Capture Device</strong>. Then choose the microphone you actually want to use in OBS rather than assuming the built-in microphone is the best option.</p>

<h2 style={s.h2}>Step 6: Test before you depend on it</h2>
<p style={s.p}>Check the camera preview, microphone levels, stream stability, and OBS statistics before starting a busy show. If the connection fails, change one thing at a time rather than changing every OBS setting simultaneously.</p>

<h2 style={s.h2}>Why use OBS on MFC?</h2>
<p style={s.p}>MFC says its external RTMP broadcaster path provides mixing tools, transitions, overlays, effects, and audio tools, and identifies OBS as one of its supported external broadcasters.</p>

<h2 style={s.h2}>If your OBS connection suddenly stops working</h2>
<p style={s.p}>Check your MFC password first. MFC says the Stream Key is linked to the model account password and is automatically regenerated when the password changes. Copy the current Stream Key from ModelWeb again before troubleshooting deeper.</p>

<h2 style={s.h2}>Related guides</h2>
<p style={s.p}><a href="/blog/how-to-set-up-split-streaming-on-multiple-cam-sites" style={s.link}>How to set up split streaming on multiple cam sites</a> covers the next step if you are building a multi-platform setup. For personal performance data, see the <a href="/guides/cam-model-analytics" style={s.link}>cam model analytics guide</a>.</p>


      <div style={s.cta}>
        <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#16F4FF', marginBottom: 8 }}>
          CamCashGrl
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
          Turn your own stream history into useful evidence.
        </div>
        <p style={{ ...s.p, marginBottom: 16 }}>
          Track earnings, sessions, fans, platforms, and your personal peak streaming patterns from your own data.
        </p>
        <a href="/landing" style={{ display: 'inline-flex', padding: '12px 20px', borderRadius: 12, background: 'linear-gradient(90deg, #16F4FF, #7C5CFF, #FF2BAE)', color: '#fff', textDecoration: 'none', fontWeight: 800 }}>
          Analyze My Earnings Free →
        </a>
      </div>

      <section style={{ marginTop: 38 }}>
        <h2 style={s.h2}>Frequently Asked Questions</h2>
        <div style={ marginBottom: 18 }>
  <div style={{ fontWeight: 800, color: '#e2e8f0', marginBottom: 7 }}>Do I need to be logged into MFC ModelWeb when using OBS?</div>
  <p style={...s.p, marginBottom: 0}>Yes. MyFreeCams says models must be logged into ModelWeb to broadcast even when using an external broadcaster such as OBS.</p>
</div>
<div style={ marginBottom: 18 }>
  <div style={{ fontWeight: 800, color: '#e2e8f0', marginBottom: 7 }}>Where do I find my MFC Stream Key?</div>
  <p style={...s.p, marginBottom: 0}>In ModelWeb, open Options → External Broadcaster → Stream Key & URL, then click Stream Key to copy it.</p>
</div>
<div style={ marginBottom: 18 }>
  <div style={{ fontWeight: 800, color: '#e2e8f0', marginBottom: 7 }}>What OBS settings should I start with for MFC?</div>
  <p style={...s.p, marginBottom: 0}>MFC currently recommends starting with x264, 3000 kbps at 1280×720, 30 FPS, and 160 kbps audio.</p>
</div>
      </section>
    </ArticleLayout>
  )
}

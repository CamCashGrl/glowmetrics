import ArticleLayout from '../../components/ArticleLayout'
import { s, articleSchema, articleMeta } from '../../../lib/blog-article-styles'

const SLUG = 'what-is-rtmp-for-cam-models'
const TITLE = 'What Is RTMP for Cam Models? Stream URLs, Keys and External Broadcasting Explained'
const DESC = 'RTMP explained for cam models: what the server URL and stream key each do, where they go in OBS, why a correct-looking setup still fails, and what changes when you multistream.'

const FAQS = [
  {
    q: 'What is RTMP?',
    a: 'RTMP is a streaming protocol used to deliver live video from broadcasting software to a server. For a cam model using OBS, it is the mechanism behind the server address and stream key the platform gives you.',
  },
  {
    q: 'What is the difference between a stream URL and a stream key?',
    a: 'The stream URL identifies the server that receives your broadcast — the address. The stream key identifies the stream as belonging to your account — the credential. The first is configuration; the second is sensitive.',
  },
  {
    q: 'Can I reuse an RTMP URL from a tutorial?',
    a: 'No. Use the current values supplied by the platform you are actually connecting to. A server address copied from a tutorial, a forum post or another site is one of the most common reasons a setup that looks correct will not connect.',
  },
  {
    q: 'Does every destination need its own RTMP settings?',
    a: 'Yes. Each destination can have its own connection information and technical requirements, which is why pasting identical settings everywhere is not a working multistreaming strategy.',
  },
]

export const metadata = articleMeta({ title: TITLE, description: DESC, slug: SLUG })
const schema = articleSchema({ title: TITLE, description: DESC, slug: SLUG, faqs: FAQS })

export default function Page() {
  return (
    <ArticleLayout
      schema={schema}
      breadcrumb={[{ label: 'Blog', href: '/blog' }, { label: 'What Is RTMP for Cam Models?' }]}
    >
      <div style={s.meta}><span>CamCash</span><span>Updated August 2026</span><span>4 min read</span></div>

      <h1 style={s.h1}>What Is RTMP for Cam Models? Stream URLs, Keys and External Broadcasting Explained</h1>

      <p style={s.intro}>
        If a cam site&rsquo;s instructions mention <strong style={s.strong}>RTMP</strong>, a
        <strong style={s.strong}> server URL</strong> or a <strong style={s.strong}>stream key</strong>,
        you are looking at the connection information that lets broadcasting software send your video
        to the platform. Two values, two different jobs, and only one of them is a secret.
      </p>

      <div style={s.answer}>
        <strong style={s.strong}>In one line:</strong> RTMP is the delivery mechanism. The server URL
        says <em>where</em> to send the stream. The stream key says <em>who</em> it belongs to.
      </div>

      <h2 style={s.h2}>RTMP in plain English</h2>
      <p style={s.p}>
        RTMP is a streaming protocol &mdash; a standard way for broadcasting systems to deliver live
        video to a server. You do not need to understand it any more deeply than that. For a model
        using OBS or another external broadcaster, its practical face is a server address and a
        unique key supplied by the platform.
      </p>

      <h2 style={s.h2}>The two values</h2>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr><th style={s.th}>Value</th><th style={s.th}>What it does</th><th style={s.th}>Sensitive?</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={s.td}><strong style={s.strong}>Stream URL / server</strong></td>
              <td style={s.td}>Identifies the endpoint that receives your broadcast</td>
              <td style={s.td}>No &mdash; but it must be the platform&rsquo;s current one</td>
            </tr>
            <tr>
              <td style={s.td}><strong style={s.strong}>Stream key</strong></td>
              <td style={s.td}>Identifies the stream as yours to the receiving service</td>
              <td style={s.td}>Yes &mdash; treat it like a password</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style={s.p}>
        Never publish a stream key in a screenshot or paste it into a public support thread. Anyone
        who has it can broadcast to your room.
      </p>

      <h2 style={s.h2}>Where it goes in OBS</h2>
      <p style={s.p}>
        OBS&rsquo;s streaming configuration has fields for the service or server and for the stream
        key. The exact location and the required values depend on the platform &mdash; some
        platforms appear as a named service, others need the raw server address.
      </p>
      <p style={s.p}>
        <strong style={s.strong}>Do not substitute an RTMP URL from a tutorial.</strong> Use the
        current information supplied by the platform you are connecting to. Platform-specific
        walkthroughs:{' '}
        <a href="/blog/how-touse-myfreecams-with-obs" style={s.link}>MyFreeCams</a> and{' '}
        <a href="/blog/chaturbate-obs-stream-key-setup" style={s.link}>Chaturbate</a>.
      </p>

      <h2 style={s.h2}>Why a correct-looking setup still fails</h2>
      <p style={s.p}>Connection problems usually come from one of these:</p>
      <ul style={s.ul}>
        <li style={s.li}>An incorrect or outdated server</li>
        <li style={s.li}>An expired or regenerated key &mdash; some platforms rotate the key when your password changes</li>
        <li style={s.li}>Network instability</li>
        <li style={s.li}>Settings the platform does not accept</li>
        <li style={s.li}>Account-side restrictions</li>
        <li style={s.li}>An OBS configuration problem unrelated to the connection</li>
      </ul>
      <p style={s.p}>
        Troubleshoot one variable at a time. Changing six settings at once and getting a working
        stream teaches you nothing you can reuse next time.
      </p>

      <h2 style={s.h2}>RTMP and multistreaming</h2>
      <p style={s.p}>
        If you send separate streams to several destinations, each destination can have its own
        connection information and its own technical requirements. That is precisely why
        &ldquo;paste the same settings everywhere&rdquo; is not a multistreaming strategy &mdash; see{' '}
        <a href="/blog/how-to-multistream-with-obs" style={s.link}>how to multistream cam sites with
        OBS</a>.
      </p>

      <div style={s.cta}>
        <div style={s.ctaTitle}>Once the stream is stable, look at the numbers</div>
        <p style={s.ctaText}>
          The setup is infrastructure. What it produces is the business. CamCash turns your tip
          history into session, hourly, fan and platform analytics from data you already have.
        </p>
        <a href="/landing" style={s.ctaBtn}>Start Tracking My Earnings &rarr;</a>
      </div>

      <div style={s.faq}>
        <h2 style={{ ...s.h2, marginTop: 0 }}>Frequently asked questions</h2>
        {FAQS.map(f => (
          <div key={f.q} style={s.faqItem}>
            <div style={s.faqQ}>{f.q}</div>
            <p style={{ ...s.faqA, marginBottom: 0 }}>{f.a}</p>
          </div>
        ))}
      </div>

      <div style={s.related}>
        <div style={s.relatedTitle}>Related reading</div>
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/how-to-find-myfreecams-stream-key" style={s.link}>&rarr; Finding your MyFreeCams stream key</a></p>
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/what-cam-sites-allow-external-broadcasting" style={s.link}>&rarr; Which cam sites allow external broadcasting?</a></p>
        <p style={{ ...s.p, marginBottom: 0 }}><a href="/blog/obs-dropped-frames-cam-stream" style={s.link}>&rarr; OBS dropped frames while camming</a></p>
      </div>
    </ArticleLayout>
  )
}

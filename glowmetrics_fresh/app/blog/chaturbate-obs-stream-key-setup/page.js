import ArticleLayout from '../../components/ArticleLayout'
import { s, articleSchema, articleMeta } from '../../../lib/blog-article-styles'

const SLUG = 'chaturbate-obs-stream-key-setup'
const TITLE = 'Chaturbate OBS Setup: Finding Your Stream Key and Server'
const DESC = 'Where Chaturbate hides the RTMP details, which regional server to pick, first-time OBS settings, and the connection problems that come from choosing the wrong ingest.'

const FAQS = [
  {
    q: 'Where is the Chaturbate stream key?',
    a: 'It is not in your account settings. Go to the Broadcast Yourself area, choose the option to use an external encoder, and open the RTMP/OBS broadcast information. The server address and stream key are shown together there.',
  },
  {
    q: 'Which server should I choose?',
    a: 'The one geographically closest to you from the list Chaturbate offers. Server choice affects latency and stability, not quality — a distant ingest adds delay between what you do and when chat sees it, which makes tip reactions feel off.',
  },
  {
    q: 'Do I use "Chaturbate" or "Custom" as the OBS service?',
    a: 'Whichever the current broadcast information page tells you. If it gives you an explicit server address, the custom service with that address pasted in is the reliable route. Do not type a server address you found on a forum — those change.',
  },
  {
    q: 'Is external encoding better than the browser broadcaster?',
    a: 'It is more capable, not automatically better. OBS gives you scenes, overlays and real audio control. It also gives you more ways to misconfigure a stream. If the browser broadcaster is working and you do not need overlays, there is no obligation to switch.',
  },
  {
    q: 'My stream connects but chat reacts late. Why?',
    a: 'Some delay is inherent to streaming, but a distant ingest server makes it worse, and so does a high keyframe interval. Pick a closer server and set the keyframe interval to 2 seconds before assuming the delay is unavoidable.',
  },
]

export const metadata = articleMeta({ title: TITLE, description: DESC, slug: SLUG })
const schema = articleSchema({ title: TITLE, description: DESC, slug: SLUG, faqs: FAQS })

export default function Page() {
  return (
    <ArticleLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      <div style={s.meta}><span>CamCash</span><span>Updated August 2026</span><span>6 min read</span></div>

      <h1 style={s.h1}>Chaturbate OBS Setup: Finding Your Stream Key and Server</h1>

      <p style={s.intro}>
        The hard part of setting up OBS for Chaturbate is not OBS &mdash; it is finding
        the RTMP details, which are not where most people look for them. They are not in
        account settings. Once you know the path, the rest is a five-minute job.
      </p>

      <div style={s.note}>
        Platform interfaces change, and so do server addresses. Take the server and key
        from the broadcast information page in your own account at the time you set up
        &mdash; never from a forum post, an old tutorial, or this article.
      </div>

      <h2 style={s.h2}>Where the stream key actually lives</h2>

      <p style={s.p}>
        It sits behind the broadcasting area rather than account settings, which is why
        it is so often described as hidden:
      </p>

      <div style={s.step}>
        <span style={s.stepNum}>STEP 1</span>
        <p style={{ ...s.p, marginBottom: 0 }}>
          Open the <strong style={s.strong}>Broadcast Yourself</strong> area from the
          main menu.
        </p>
      </div>

      <div style={s.step}>
        <span style={s.stepNum}>STEP 2</span>
        <p style={{ ...s.p, marginBottom: 0 }}>
          Choose the option to <strong style={s.strong}>use an external encoder to
          broadcast</strong>, rather than the in-browser broadcaster.
        </p>
      </div>

      <div style={s.step}>
        <span style={s.stepNum}>STEP 3</span>
        <p style={{ ...s.p, marginBottom: 0 }}>
          Open the <strong style={s.strong}>RTMP / OBS broadcast information</strong>.
          The server address and your stream key appear together here. This is the page
          to return to whenever a stream refuses to connect.
        </p>
      </div>

      <h2 style={s.h2}>Choosing a server</h2>

      <p style={s.p}>
        Chaturbate offers several regional ingest servers. This is the one setup choice
        with a genuinely wrong answer, and it is worth a moment&rsquo;s thought rather
        than taking whichever appears first.
      </p>

      <p style={s.p}>
        Pick the one geographically closest to you. A distant ingest does not make your
        picture worse, but it adds latency &mdash; the gap between something happening in
        front of your camera and chat seeing it. In camming that gap matters more than in
        most streaming, because the entire interaction loop is tip, react, respond. Add
        three seconds of delay and your reactions land after the moment has passed.
      </p>

      <p style={s.p}>
        If you cannot tell which is closest, try the nearest two across separate sessions
        and keep the one where chat feels more responsive.
      </p>

      <h2 style={s.h2}>OBS configuration</h2>

      <p style={s.p}>
        In <strong style={s.strong}>Settings &rarr; Stream</strong>, set the service and
        paste the server address and stream key from the broadcast information page. If
        Chaturbate appears as a named service in your OBS version, that works; if you
        were given an explicit server address, the custom service with that address is
        the more reliable route.
      </p>

      <p style={s.p}>
        Then in <strong style={s.strong}>Settings &rarr; Output</strong>, three settings
        matter more than the rest:
      </p>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead><tr><th style={s.th}>Setting</th><th style={s.th}>Start with</th><th style={s.th}>Why</th></tr></thead>
          <tbody>
            <tr><td style={s.td}>Encoder</td><td style={s.td}>Hardware (NVENC / AMF / Quick Sync) if available</td><td style={s.td}>Keeps the CPU free for everything else you run while streaming.</td></tr>
            <tr><td style={s.td}>Bitrate</td><td style={s.td}>Conservative for your upload &mdash; not the maximum</td><td style={s.td}>A stable stream beats a sharp one that stutters. Leave headroom.</td></tr>
            <tr><td style={s.td}>Keyframe interval</td><td style={s.td}>2 seconds, set explicitly</td><td style={s.td}>Left on automatic, this causes streams that connect but play back badly.</td></tr>
          </tbody>
        </table>
      </div>

      <p style={s.p}>
        For resolution, 720p at 30 fps is a sound starting point. Raise it once you have
        watched a full session hold steady, not before &mdash; and see{' '}
        <a href="/blog/what-upload-speed-do-you-need-for-camming" style={s.link}>how much
        upload you actually need</a> before deciding your connection can carry 1080p.
      </p>

      <h2 style={s.h2}>Protecting the key</h2>

      <p style={s.p}>
        Your stream key is a credential. Anyone holding it can broadcast to your room,
        and viewers would have no way to know it was not you.
      </p>

      <p style={s.p}>
        The realistic risk is not hacking &mdash; it is showing the broadcast information
        page on camera while setting up, or pasting a screenshot of it into a forum thread
        asking why the stream will not connect. Both happen regularly. Close that page
        before your camera goes on, and crop or redact before sharing anything from it.
      </p>

      <h2 style={s.h2}>Common failures</h2>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead><tr><th style={s.th}>Symptom</th><th style={s.th}>Likely cause</th></tr></thead>
          <tbody>
            <tr><td style={s.td}>Cannot connect at all</td><td style={s.td}>Server address typed from an outdated source, or a stale key. Re-copy both from the broadcast information page.</td></tr>
            <tr><td style={s.td}>Connects, drops after minutes</td><td style={s.td}>Bitrate too close to your upload ceiling. Lower it; prefer wired over wireless.</td></tr>
            <tr><td style={s.td}>Chat reacts noticeably late</td><td style={s.td}>Distant ingest server, or keyframe interval left on automatic.</td></tr>
            <tr><td style={s.td}>Picture degrades after 20&ndash;30 minutes</td><td style={s.td}>Thermal throttling under sustained encode. Hardware encoding usually reduces this.</td></tr>
            <tr><td style={s.td}>Frames dropping steadily</td><td style={s.td}>A bandwidth problem rather than a setup one &mdash; see the dropped frames guide below.</td></tr>
          </tbody>
        </table>
      </div>

      <div style={s.cta}>
        <div style={s.ctaTitle}>Track whether the upgrade paid off</div>
        <p style={s.ctaText}>
          CamCash turns your Chaturbate tip history into sessions, hourly rate and peak
          hours &mdash; so a change to your setup can be judged on earnings rather than
          on how the stream looked to you.
        </p>
        <a href="/landing" style={s.ctaBtn}>Track My Chaturbate Data Free &rarr;</a>
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
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/what-is-rtmp-for-cam-models" style={s.link}>&rarr; What RTMP and stream keys actually are</a></p>
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/obs-dropped-frames-cam-streaming" style={s.link}>&rarr; Fixing dropped frames</a></p>
        <p style={{ ...s.p, marginBottom: 0 }}><a href="/guides/chaturbate-earnings-tracker" style={s.link}>&rarr; Chaturbate earnings tracker</a></p>
      </div>
    </ArticleLayout>
  )
}

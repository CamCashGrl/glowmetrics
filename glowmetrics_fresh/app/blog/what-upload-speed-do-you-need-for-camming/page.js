import ArticleLayout from '../../components/ArticleLayout'
import { s, articleSchema, articleMeta } from '../../../lib/blog-article-styles'

const SLUG = 'what-upload-speed-do-you-need-for-camming'
const TITLE = 'What Upload Speed Do You Need for Camming?'
const DESC = 'Upload speed, not download, is what carries your stream. How to work out the figure you actually need, why headroom matters, and why the advertised number misleads.'

const FAQS = [
  {
    q: 'How much upload speed do I need to cam?',
    a: 'Take your intended video bitrate and allow roughly 1.5× that as sustained upload capacity. A 3000 kbps stream wants about 4.5 Mbps of dependable upload. The multiplier is headroom — configuring a stream to use every available kbps guarantees dropped frames the moment anything else touches the network.',
  },
  {
    q: 'Why does my 200 Mbps connection still drop frames?',
    a: 'Because that is almost certainly the download figure. Consumer connections are heavily asymmetric — 200 Mbps down can come with 10 Mbps up, or less. Streaming uses upload exclusively, so the advertised headline number tells you very little.',
  },
  {
    q: 'Is upload the same all day?',
    a: 'No, and this catches people out. Shared residential connections slow in the evening when the neighbourhood is online — which is exactly when most cam traffic happens. Always test at the hour you actually stream.',
  },
  {
    q: 'Does multistreaming multiply what I need?',
    a: 'It depends on the method. Through a relay service you upload once regardless of how many platforms receive it. Sending directly to each platform from your own machine multiplies the requirement by the number of destinations, which is beyond most home connections at three or more.',
  },
  {
    q: 'Is wifi enough if the speed test looks fine?',
    a: 'A speed test measures a short burst; streaming needs sustained capacity for hours. Wireless throughput fluctuates in ways a 15-second test will not reveal, which is why a connection that tests well can still drop frames intermittently. Wired is materially more reliable.',
  },
]

export const metadata = articleMeta({ title: TITLE, description: DESC, slug: SLUG })
const schema = articleSchema({ title: TITLE, description: DESC, slug: SLUG, faqs: FAQS })

export default function Page() {
  return (
    <ArticleLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      <div style={s.meta}><span>CamCash</span><span>Updated August 2026</span><span>5 min read</span></div>

      <h1 style={s.h1}>What Upload Speed Do You Need for Camming?</h1>

      <div style={s.answer}>
        <strong style={s.strong}>Roughly 1.5&times; your video bitrate, in sustained upload
        capacity.</strong> A 3000 kbps stream wants about 4.5 Mbps of dependable upload;
        6000 kbps wants around 9 Mbps. The extra half is headroom, and it is not optional
        &mdash; a stream configured to use every available kbps drops frames the moment
        anything else on the network wants bandwidth.
      </div>

      <h2 style={s.h2}>Upload, not download</h2>

      <p style={s.p}>
        This is the single most common confusion, and it explains most of the &ldquo;I
        have fast internet, why is my stream bad?&rdquo; cases.
      </p>

      <p style={s.p}>
        Streaming sends video out. It uses <em>upload</em> capacity almost exclusively.
        The number your provider advertises &mdash; and the big number on a speed test
        &mdash; is download, and consumer connections are deliberately asymmetric because
        most people consume far more than they send.
      </p>

      <p style={s.p}>
        A connection sold as 200 Mbps may carry 10 Mbps of upload, or less. That headline
        figure tells you nothing useful about whether it can carry a stream. Run a speed
        test and read the upload number specifically.
      </p>

      <h2 style={s.h2}>Working out your figure</h2>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr><th style={s.th}>If you stream at</th><th style={s.th}>Bitrate</th><th style={s.th}>Upload you want</th></tr>
          </thead>
          <tbody>
            <tr><td style={s.td}>720p 30fps, conservative</td><td style={s.td}>~2500 kbps</td><td style={s.td}>~4 Mbps</td></tr>
            <tr><td style={s.td}>720p 30fps, comfortable</td><td style={s.td}>~3000 kbps</td><td style={s.td}>~4.5 Mbps</td></tr>
            <tr><td style={s.td}>1080p 30fps</td><td style={s.td}>~4500 kbps</td><td style={s.td}>~7 Mbps</td></tr>
            <tr><td style={s.td}>1080p 60fps</td><td style={s.td}>~6000 kbps</td><td style={s.td}>~9 Mbps</td></tr>
          </tbody>
        </table>
      </div>

      <p style={s.p}>
        These are working starting points rather than rules &mdash; platforms set their own
        accepted maximums, and you should not exceed whichever ceiling is lower. What the
        table is really showing is the shape of the trade: every step up in resolution or
        frame rate costs upload capacity you may not have.
      </p>

      <div style={s.note}>
        <strong style={s.strong}>Test at the hour you stream.</strong> Shared residential
        connections slow noticeably in the evening, which is when most cam traffic happens.
        A morning test can overstate your real capacity by a wide margin.
      </div>

      <h2 style={s.h2}>Why headroom is the whole point</h2>

      <p style={s.p}>
        Suppose your upload tests at 5 Mbps. It is tempting to set a bitrate that uses
        close to all of it. Do not &mdash; for two reasons.
      </p>

      <p style={s.p}>
        First, upload speed is not constant. It fluctuates with network conditions, and a
        configuration that fits a good moment will not fit a bad one. Second, streaming is
        never the only thing using the connection: a phone syncing photos, a cloud backup
        waking up, another device in the house. Each briefly takes capacity your stream
        was already counting on.
      </p>

      <p style={s.p}>
        Headroom absorbs both. Without it, a stream is not stable &mdash; it is merely
        stable until something happens.
      </p>

      <h2 style={s.h2}>If your upload is genuinely limited</h2>

      <p style={s.p}>
        Plenty of models stream successfully on modest connections. What matters is
        matching your settings to reality rather than to what you wish you had.
      </p>

      <ul style={s.ul}>
        <li style={s.li}><strong style={s.strong}>Drop to 720p.</strong> At a constrained bitrate, 720p genuinely looks better than 1080p, because the same data covers fewer pixels. This is the single most effective change.</li>
        <li style={s.li}><strong style={s.strong}>Use 30 fps rather than 60.</strong> Halving the frame rate frees substantial bitrate, and for camming the difference is far less noticeable than for fast-motion content.</li>
        <li style={s.li}><strong style={s.strong}>Go wired.</strong> Removes fluctuation you cannot otherwise control &mdash; and fluctuation, not headline speed, is usually what breaks a stream.</li>
        <li style={s.li}><strong style={s.strong}>Reduce background motion.</strong> Movement costs bitrate. A busy patterned background under low bitrate looks worse than a plain one.</li>
        <li style={s.li}><strong style={s.strong}>Schedule backups away from streaming hours.</strong> Backup software runs when the machine looks idle, which can be precisely when you go live.</li>
      </ul>

      <h2 style={s.h2}>Multistreaming changes the arithmetic</h2>

      <p style={s.p}>
        If you broadcast to more than one platform, how you do it decides whether your
        upload requirement multiplies.
      </p>

      <p style={s.p}>
        Through a relay service you send one stream and the relay distributes it &mdash;
        so a 6000 kbps broadcast still needs about 9 Mbps whether it reaches one platform
        or four. Sending directly to each platform from your own machine means uploading a
        separate copy per destination: the same broadcast to three sites needs roughly 27
        Mbps, which is beyond most residential connections.
      </p>

      <p style={s.p}>
        That arithmetic, more than any software preference, is why most models who
        multistream use a relay. The full workflow is covered in{' '}
        <a href="/blog/how-to-set-up-split-streaming-on-multiple-cam-sites" style={s.link}>the
        split streaming guide</a>.
      </p>

      <div style={s.cta}>
        <div style={s.ctaTitle}>Stable stream, measurable results</div>
        <p style={s.ctaText}>
          Once your connection is no longer the limiting factor, the useful question is
          which sessions earn. CamCash builds hourly rate, peak hours and session
          comparisons from your own tip history.
        </p>
        <a href="/landing" style={s.ctaBtn}>Track My Earnings Free &rarr;</a>
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
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/obs-dropped-frames-cam-streaming" style={s.link}>&rarr; Fixing dropped frames</a></p>
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/what-is-rtmp-for-cam-models" style={s.link}>&rarr; RTMP, stream keys and bitrate explained</a></p>
        <p style={{ ...s.p, marginBottom: 0 }}><a href="/blog/cam-model-equipment-guide" style={s.link}>&rarr; Cam model equipment guide</a></p>
      </div>
    </ArticleLayout>
  )
}

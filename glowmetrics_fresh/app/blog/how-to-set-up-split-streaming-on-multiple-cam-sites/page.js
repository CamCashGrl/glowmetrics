import ArticleLayout from '../../components/ArticleLayout'
import { s, articleSchema, articleMeta } from '../../../lib/blog-article-styles'

const SLUG = 'how-to-set-up-split-streaming-on-multiple-cam-sites'
const TITLE = 'How to Split Stream on Multiple Cam Sites: OBS, RTMP & Bitrate Setup'
const DESC = 'A technical walkthrough of split streaming for cam models: OBS setup, RTMP destinations, bitrate and CPU budgeting, audio routing, testing, and troubleshooting.'

const FAQS = [
  {
    q: 'Do I need two computers to split stream?',
    a: 'No. One machine can send a single encode to multiple destinations, either through a restream relay service or through a plugin that duplicates the RTMP output. A second machine only becomes useful if you want genuinely different scenes or resolutions per platform, or if your CPU is already saturated by a single encode.',
  },
  {
    q: 'How much upload bandwidth do I need?',
    a: 'It depends entirely on your method. Through a relay service you upload one stream, so a 6000 kbps broadcast needs roughly 6000 kbps of headroom regardless of how many platforms receive it. Sending directly to three platforms from your own machine means uploading three copies — roughly 18,000 kbps for the same quality. This is the single biggest reason most models use a relay.',
  },
  {
    q: 'Will split streaming get my account banned?',
    a: 'That depends on the specific platform and sometimes on your specific contract. Some sites permit it, some restrict it, and studio or exclusivity agreements can override the general rule. Check each platform’s current terms and your own agreement before you go live on two sites at once — do not rely on what other models say is allowed.',
  },
  {
    q: 'Why does my stream look fine locally but pixelated on the second platform?',
    a: 'Usually because the second platform re-encodes to a lower bitrate ceiling than the first. Platforms do not all accept the same maximum bitrate or resolution. Set your encode to the lowest ceiling among your destinations, or accept that the stricter platform will look softer.',
  },
  {
    q: 'Can I have separate chat on each platform?',
    a: 'Yes, and you will need to. Each platform has its own chat that your viewers cannot see across. Most models designate one platform as the primary chat they actively work, and check the others on a timer or through a multi-chat dock in OBS.',
  },
]

export const metadata = articleMeta({ title: TITLE, description: DESC, slug: SLUG })
const schema = articleSchema({ title: TITLE, description: DESC, slug: SLUG, faqs: FAQS })

export default function Page() {
  return (
    <ArticleLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      <div style={s.meta}><span>CamCash</span><span>Updated August 2026</span><span>9 min read</span></div>

      <h1 style={s.h1}>How to Split Stream on Multiple Cam Sites: OBS, RTMP &amp; Bitrate Setup</h1>

      <p style={s.intro}>
        This is the technical side of multistreaming &mdash; encoder settings, RTMP
        destinations, bandwidth budgeting and troubleshooting. If you are still
        deciding <em>whether</em> a second platform is worth it, the strategic case
        is covered in{' '}
        <a href="/blog/cam-model-income-diversification" style={s.link}>diversifying your cam income</a>.
        This article assumes you have decided and want the workflow.
      </p>

      <div style={s.note}>
        <strong style={s.strong}>Before anything technical:</strong> platform rules
        on simultaneous streaming vary, change, and can be overridden by studio or
        exclusivity terms in your own agreement. Confirm the current rules for every
        site you plan to use, and your own contract, before going live on two at
        once. Nothing below should be read as a claim that a given platform permits it.
      </div>

      <h2 style={s.h2}>What split streaming actually is</h2>

      <p style={s.p}>
        Your encoder &mdash; OBS in most cases &mdash; takes your camera and audio,
        compresses them once into a video stream, and pushes that stream to a URL
        using RTMP. An RTMP destination is just an address plus a stream key: the
        address says which server to send to, the key says which account the stream
        belongs to.
      </p>

      <p style={s.p}>
        Split streaming means that one encode reaches more than one of those
        destinations. There are only two ways to do it, and the difference between
        them decides almost everything else about your setup:
      </p>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Method</th>
              <th style={s.th}>How it works</th>
              <th style={s.th}>Upload cost</th>
              <th style={s.th}>Trade-off</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={s.td}><strong style={s.strong}>Relay service</strong></td>
              <td style={s.td}>You send one stream to a relay; the relay duplicates it to each platform.</td>
              <td style={s.td}>One stream&rsquo;s worth, no matter how many platforms.</td>
              <td style={s.td}>A third party handles your video. Adds a little latency. Usually a paid tier for multiple destinations.</td>
            </tr>
            <tr>
              <td style={s.td}><strong style={s.strong}>Direct multi-output</strong></td>
              <td style={s.td}>A plugin makes OBS push the same encode to several RTMP URLs itself.</td>
              <td style={s.td}>Multiplied by the number of platforms.</td>
              <td style={s.td}>No third party, but your upload and CPU absorb the whole cost.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p style={s.p}>
        If your upload is anything short of excellent, use a relay. The bandwidth
        arithmetic below is usually the deciding factor rather than any preference
        about software.
      </p>

      <h2 style={s.h2}>Budget your bandwidth before you touch settings</h2>

      <p style={s.p}>
        Run an upload speed test, then take about 70&ndash;75% of the result as your
        working ceiling. The remainder is headroom &mdash; upload speed fluctuates,
        and a stream configured to use every last kbps will drop frames the moment
        anything else on your network wants bandwidth.
      </p>

      <p style={s.p}>
        With a relay, your total need is one stream: a 6000 kbps broadcast needs
        roughly 6000 kbps of working ceiling whether it lands on one platform or
        four. Going direct, multiply: the same 6000 kbps to three platforms needs
        around 18,000 kbps, which is beyond most residential connections.
      </p>

      <div style={s.note}>
        Test your upload at the time of day you actually stream, not in the morning.
        Shared residential connections slow noticeably in the evening, which is when
        most cam traffic happens.
      </div>

      <h2 style={s.h2}>Choose your resolution and bitrate for the strictest platform</h2>

      <p style={s.p}>
        Platforms do not all accept the same maximum bitrate or resolution, and a
        single encode has to satisfy all of them. Whatever your lowest destination
        ceiling is, that is your encode &mdash; sending above a platform&rsquo;s limit
        gets you re-encoded, rejected, or unstable, not rewarded.
      </p>

      <p style={s.p}>
        Look up the current accepted bitrate and resolution for each destination
        before configuring anything, then set OBS to the lowest of them. The
        practical consequence is that adding a stricter platform lowers quality
        everywhere, which is a real cost worth weighing.
      </p>

      <p style={s.p}>
        On resolution: 1080p at a constrained bitrate looks worse than 720p at the
        same bitrate, because the same data is spread across more pixels. If your
        ceiling is tight, 720p60 or 1080p30 will both look cleaner than 1080p60.
        Movement is what costs bitrate &mdash; a mostly static room tolerates lower
        settings than one with constant motion.
      </p>

      <h2 style={s.h2}>Encoder: hardware or software</h2>

      <p style={s.p}>
        In OBS, the encoder setting decides which part of your computer does the
        compression, and this is where split streaming most often goes wrong.
      </p>

      <ul style={s.ul}>
        <li style={s.li}>
          <strong style={s.strong}>Hardware encoding</strong> (NVENC on NVIDIA cards,
          AMF on AMD, Quick Sync on Intel) offloads the work to your GPU. This is
          almost always the right choice for camming, because it leaves the CPU free
          and because modern hardware encoders are good enough that the quality gap
          no longer matters at typical bitrates.
        </li>
        <li style={s.li}>
          <strong style={s.strong}>Software encoding</strong> (x264) uses the CPU. It
          can look marginally better at low bitrates, but it competes with everything
          else running &mdash; browser, chat windows, toy software &mdash; and going
          direct to multiple destinations multiplies that load.
        </li>
      </ul>

      <p style={s.p}>
        If OBS reports encoding overload, switch to hardware encoding first, before
        lowering resolution. It solves the problem more often than any other single
        change.
      </p>

      <h2 style={s.h2}>Setting up the destinations</h2>

      <div style={s.step}>
        <span style={s.stepNum}>STEP 1</span>
        <p style={{ ...s.p, marginBottom: 0 }}>
          <strong style={s.strong}>Collect each stream key.</strong> Every platform
          shows a server address and a stream key in its broadcaster or external-encoder
          settings. Treat a stream key like a password: anyone holding it can broadcast
          to your room. Never show these on camera, and regenerate any key that appears
          in a screenshot.
        </p>
      </div>

      <div style={s.step}>
        <span style={s.stepNum}>STEP 2</span>
        <p style={{ ...s.p, marginBottom: 0 }}>
          <strong style={s.strong}>Configure the primary destination.</strong> In OBS,
          set Service to Custom, then enter the server and key for the platform you
          consider primary. Get this working alone before adding anything else &mdash;
          debugging one stream is far easier than debugging three.
        </p>
      </div>

      <div style={s.step}>
        <span style={s.stepNum}>STEP 3</span>
        <p style={{ ...s.p, marginBottom: 0 }}>
          <strong style={s.strong}>Add the secondary destinations.</strong> Through a
          relay, you enter the other platforms&rsquo; keys in the relay&rsquo;s dashboard
          and point OBS only at the relay. Going direct, you add each additional RTMP
          URL and key in the multi-output plugin.
        </p>
      </div>

      <div style={s.step}>
        <span style={s.stepNum}>STEP 4</span>
        <p style={{ ...s.p, marginBottom: 0 }}>
          <strong style={s.strong}>Set keyframe interval to 2 seconds.</strong> Most
          platforms expect this, and leaving it on automatic is a common cause of a
          stream that connects but plays back badly on one site while looking fine on
          another.
        </p>
      </div>

      <h2 style={s.h2}>Audio routing</h2>

      <p style={s.p}>
        Audio is where split-streaming setups quietly go wrong, because problems are
        less visible than a frozen video feed. Two things matter most.
      </p>

      <p style={s.p}>
        First, be deliberate about which sources are captured. If you capture desktop
        audio wholesale, every notification, alert and browser tab goes out to every
        platform simultaneously. Capture the specific applications you intend to
        broadcast instead, and mute the rest.
      </p>

      <p style={s.p}>
        Second, watch your levels. Aim for peaks around &minus;6 dB with normal
        conversation nearer &minus;18 dB, and add a limiter so a sudden loud moment
        does not clip. Platforms process audio differently, so something that sounds
        acceptable on one can distort on another &mdash; leaving headroom protects you
        on all of them at once.
      </p>

      <h2 style={s.h2}>Scenes: one layout, or one per platform</h2>

      <p style={s.p}>
        A single encode means every platform sees identical video, including any
        on-screen text. That matters more than it first appears, because overlays
        naming a platform, its currency, or a platform-specific goal will be visible
        on the others too &mdash; which can read as an invitation to leave, and on some
        sites is a rules problem.
      </p>

      <p style={s.p}>
        The safe approach is one neutral scene: no platform names, no token amounts
        tied to one site&rsquo;s currency, no site-specific promotions burned into the
        overlay. Keep those in chat, where they stay on the platform they belong to.
        Genuinely per-platform visuals require a separate encode per destination,
        which means separate scene collections and considerably more machine.
      </p>

      <h2 style={s.h2}>Test before you go live</h2>

      <ol style={s.ol}>
        <li style={s.li}>Start the stream to all destinations while your room is private or offline, if the platforms allow it.</li>
        <li style={s.li}>Watch the OBS stats panel for dropped frames. Anything above about 1% sustained means bandwidth trouble; lower the bitrate and retest.</li>
        <li style={s.li}>Open each platform&rsquo;s own player and confirm the picture and sound actually arrive there. A green connection indicator in OBS only proves the handoff succeeded, not that the platform accepted and is serving the stream properly.</li>
        <li style={s.li}>Check for audio drift &mdash; if sound and picture separate on one platform but not another, that platform is re-encoding differently and the keyframe interval is the usual culprit.</li>
        <li style={s.li}>Run it for a full ten minutes. Most bandwidth and thermal problems only appear after several minutes of sustained load, not in the first thirty seconds.</li>
      </ol>

      <h2 style={s.h2}>Troubleshooting the common failures</h2>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Symptom</th>
              <th style={s.th}>Most likely cause</th>
              <th style={s.th}>What to try</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={s.td}>Dropped frames climbing steadily</td>
              <td style={s.td}>Upload bandwidth exceeded</td>
              <td style={s.td}>Lower the bitrate; if going direct, move to a relay so you upload once instead of three times.</td>
            </tr>
            <tr>
              <td style={s.td}>&ldquo;Encoding overloaded&rdquo; warning</td>
              <td style={s.td}>CPU saturated by software encoding</td>
              <td style={s.td}>Switch to hardware encoding; close browser tabs; lower resolution before frame rate.</td>
            </tr>
            <tr>
              <td style={s.td}>One platform fine, another stuttering</td>
              <td style={s.td}>Bitrate above that platform&rsquo;s ceiling</td>
              <td style={s.td}>Re-encode to the lowest ceiling among your destinations.</td>
            </tr>
            <tr>
              <td style={s.td}>Connects, then disconnects minutes later</td>
              <td style={s.td}>Unstable upload or wireless</td>
              <td style={s.td}>Move to wired ethernet; lower bitrate to widen headroom.</td>
            </tr>
            <tr>
              <td style={s.td}>Audio and video drift apart</td>
              <td style={s.td}>Keyframe interval not fixed</td>
              <td style={s.td}>Set keyframe interval to 2 seconds explicitly rather than automatic.</td>
            </tr>
            <tr>
              <td style={s.td}>Quality degrades after 20&ndash;30 minutes</td>
              <td style={s.td}>Thermal throttling</td>
              <td style={s.td}>Check temperatures under sustained load; hardware encoding usually reduces this considerably.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 style={s.h2}>Deciding whether the second platform earned its place</h2>

      <p style={s.p}>
        Once the technical side is stable, the workload question is worth settling
        properly. Split streaming does not double your income; it adds a second chat
        to monitor, a second set of regulars to remember, and a second payout schedule
        to reconcile.
      </p>

      <p style={s.p}>
        Track earnings and hours per platform separately for several weeks, then
        compare effective hourly rates. The honest comparison is not &ldquo;did the
        second platform make money&rdquo; but &ldquo;did my hourly rate across both
        beat my hourly rate on one.&rdquo; Divided attention often lowers earnings in
        the primary room enough to cancel out the secondary one &mdash; and that
        outcome is invisible unless you measure per platform.
      </p>

      <div style={s.cta}>
        <div style={s.ctaTitle}>See your per-platform hourly rate</div>
        <p style={s.ctaText}>
          CamCash tracks earnings and hours separately by platform, so you can compare
          effective $/hour on each and tell whether the second stream is actually
          paying for the extra workload.
        </p>
        <a href="/landing" style={s.ctaBtn}>Compare My Platforms Free &rarr;</a>
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
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/cam-model-income-diversification" style={s.link}>&rarr; Should you multistream at all? The strategic case</a></p>
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/cam-model-equipment-guide" style={s.link}>&rarr; Cam model equipment guide</a></p>
        <p style={{ ...s.p, marginBottom: 0 }}><a href="/guides/cam-model-income-tracker" style={s.link}>&rarr; Track income across platforms</a></p>
      </div>
    </ArticleLayout>
  )
}

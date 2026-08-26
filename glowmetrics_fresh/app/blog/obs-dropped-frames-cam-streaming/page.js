import ArticleLayout from '../../components/ArticleLayout'
import { s, articleSchema, articleMeta } from '../../../lib/blog-article-styles'

const SLUG = 'obs-dropped-frames-cam-streaming'
const TITLE = 'OBS Dropped Frames While Camming: How to Diagnose and Fix'
const DESC = 'Dropped frames, skipped frames and lagged frames are three different failures with three different fixes. How to tell which one you have from the OBS stats panel.'

const FAQS = [
  {
    q: 'What percentage of dropped frames is acceptable?',
    a: 'Below about 1% sustained is generally tolerable. Anything above that is visible to viewers as stuttering, and a figure that climbs steadily through a session means the problem is getting worse rather than being a brief blip.',
  },
  {
    q: 'Are dropped frames always a bandwidth problem?',
    a: 'Dropped frames specifically are, yes — they mean the network could not carry what you sent. But OBS reports three different counters and people commonly read the wrong one. Skipped frames mean the CPU could not keep up; lagged frames mean rendering could not. Different causes, different fixes.',
  },
  {
    q: 'Why do frames only start dropping 20 minutes in?',
    a: 'That pattern usually points at heat rather than network. Hardware throttles as it warms, so encoding that was comfortable when cold stops keeping up. It can also be an evening slowdown on a shared residential connection.',
  },
  {
    q: 'Will lowering my resolution fix dropped frames?',
    a: 'Lowering the bitrate fixes them. Resolution only helps indirectly, by letting you justify a lower bitrate. If you are dropping frames, reduce bitrate first — it is the setting that directly controls how much you are asking the network to carry.',
  },
  {
    q: 'Does wifi really matter that much?',
    a: 'Yes, and it is the most commonly ignored cause. Wireless throughput fluctuates constantly, and streaming is unusually sensitive to that because it needs sustained capacity, not peak speed. A wired connection removes an entire category of intermittent problems.',
  },
]

export const metadata = articleMeta({ title: TITLE, description: DESC, slug: SLUG })
const schema = articleSchema({ title: TITLE, description: DESC, slug: SLUG, faqs: FAQS })

export default function Page() {
  return (
    <ArticleLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      <div style={s.meta}><span>CamCash</span><span>Updated August 2026</span><span>7 min read</span></div>

      <h1 style={s.h1}>OBS Dropped Frames While Camming: How to Diagnose and Fix</h1>

      <p style={s.intro}>
        Most advice about dropped frames is wrong because it treats one symptom as one
        problem. OBS reports <strong style={s.strong}>three</strong> separate frame
        counters, they have three different causes, and the fix for one makes another
        worse. Reading the right number first saves an evening of changing settings at
        random.
      </p>

      <h2 style={s.h2}>Find out which failure you actually have</h2>

      <p style={s.p}>
        Open the OBS stats panel (View &rarr; Stats). Then match what you see:
      </p>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr><th style={s.th}>Counter</th><th style={s.th}>Means</th><th style={s.th}>Bottleneck</th><th style={s.th}>Fix direction</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={s.td}><strong style={s.strong}>Dropped</strong> (network)</td>
              <td style={s.td}>Encoded frames the network could not deliver</td>
              <td style={s.td}>Upload bandwidth</td>
              <td style={s.td}>Lower bitrate; go wired</td>
            </tr>
            <tr>
              <td style={s.td}><strong style={s.strong}>Skipped</strong> (encoding)</td>
              <td style={s.td}>The encoder could not compress fast enough</td>
              <td style={s.td}>CPU / encoder</td>
              <td style={s.td}>Switch to hardware encoding</td>
            </tr>
            <tr>
              <td style={s.td}><strong style={s.strong}>Lagged</strong> (rendering)</td>
              <td style={s.td}>OBS could not draw the scene in time</td>
              <td style={s.td}>GPU / scene complexity</td>
              <td style={s.td}>Simplify sources and effects</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p style={s.p}>
        This distinction matters because the fixes conflict. Switching to hardware
        encoding cures skipped frames and does nothing for dropped ones. Lowering the
        bitrate cures dropped frames and does nothing for lagged ones. Guessing means you
        may reduce quality without touching the actual cause.
      </p>

      <h2 style={s.h2}>Dropped frames: a bandwidth problem</h2>

      <p style={s.p}>
        Dropped frames mean you are asking the network to carry more than it reliably
        can. Work through these in order:
      </p>

      <div style={s.step}>
        <span style={s.stepNum}>FIRST</span>
        <p style={{ ...s.p, marginBottom: 0 }}>
          <strong style={s.strong}>Lower the bitrate by roughly 20% and watch.</strong>{' '}
          This is diagnosis as much as fix &mdash; if dropping stops, you have confirmed
          bandwidth. If it continues unchanged, you are probably reading the wrong counter.
        </p>
      </div>

      <div style={s.step}>
        <span style={s.stepNum}>SECOND</span>
        <p style={{ ...s.p, marginBottom: 0 }}>
          <strong style={s.strong}>Get off wireless.</strong> The most commonly ignored
          fix. Wireless throughput fluctuates constantly, and streaming needs sustained
          capacity rather than peak speed. A wired connection eliminates a whole class of
          intermittent problems that are otherwise very hard to pin down.
        </p>
      </div>

      <div style={s.step}>
        <span style={s.stepNum}>THIRD</span>
        <p style={{ ...s.p, marginBottom: 0 }}>
          <strong style={s.strong}>Find what else is using the connection.</strong>{' '}
          Cloud backup, system updates, another device streaming video. Backup software is
          a frequent offender because it deliberately runs when the machine seems idle
          &mdash; which can be exactly when you go live.
        </p>
      </div>

      <div style={s.step}>
        <span style={s.stepNum}>FOURTH</span>
        <p style={{ ...s.p, marginBottom: 0 }}>
          <strong style={s.strong}>Test your upload at streaming time.</strong> Not in the
          morning. Shared residential connections slow markedly in the evening, which is
          when most cam traffic happens. A morning speed test can be misleading by a wide
          margin.
        </p>
      </div>

      <h2 style={s.h2}>Skipped frames: an encoding problem</h2>

      <p style={s.p}>
        Skipped frames and the &ldquo;encoding overloaded&rdquo; warning mean your CPU is
        not compressing fast enough to keep up in real time.
      </p>

      <p style={s.p}>
        The single most effective fix is switching from software encoding (x264) to
        hardware encoding &mdash; NVENC on NVIDIA, AMF on AMD, Quick Sync on Intel. This
        moves the work to dedicated silicon and leaves the CPU for everything else you
        are running. Modern hardware encoders are good enough at typical cam bitrates that
        the historical quality argument for x264 no longer justifies the cost.
      </p>

      <p style={s.p}>
        If hardware encoding is not available, lower the resolution before the frame rate.
        Going from 1080p to 720p reduces encoding work substantially; dropping from 30 to
        15 fps makes movement look wrong for a comparatively small saving.
      </p>

      <h2 style={s.h2}>Lagged frames: a rendering problem</h2>

      <p style={s.p}>
        Lagged frames mean OBS could not compose the scene fast enough &mdash; before any
        encoding happened. This is about what is <em>in</em> your scene rather than how it
        is compressed.
      </p>

      <p style={s.p}>
        Usual causes: too many active sources, browser sources running animated overlays,
        video filters stacked on the camera, or a high-resolution capture being scaled
        down every frame. Disable sources one at a time to find the expensive one. Browser
        sources are worth suspecting first, since an animated alert overlay can cost more
        than the camera does.
      </p>

      <h2 style={s.h2}>The pattern that confuses everyone</h2>

      <p style={s.p}>
        <strong style={s.strong}>Everything is fine for twenty minutes, then degrades.</strong>{' '}
        Almost always thermal. Hardware runs cooler at the start of a session and throttles
        as it warms, so an encode that was comfortable when cold stops keeping up.
      </p>

      <p style={s.p}>
        Two things make this likely rather than the alternatives: it recurs at roughly the
        same point each session, and a break restores normal behaviour. Hardware encoding
        helps considerably because it generates less heat than a saturated CPU. Actual
        airflow helps more &mdash; a laptop encoding on a soft surface is the classic case.
      </p>

      <p style={s.p}>
        The competing explanation is an evening slowdown on a shared connection. You can
        separate them: if it happens twenty minutes into every session regardless of the
        hour, it is heat. If it happens at the same clock time regardless of when you
        started, it is the network.
      </p>

      <h2 style={s.h2}>Test properly</h2>

      <p style={s.p}>
        Change one setting, then run for a genuine ten minutes. Most of these problems do
        not appear in the first thirty seconds, which is why so much troubleshooting
        concludes prematurely that something worked. Bandwidth issues need sustained load
        to show, and thermal issues need time to build.
      </p>

      <div style={s.cta}>
        <div style={s.ctaTitle}>A stable stream is worth measuring</div>
        <p style={s.ctaText}>
          Once the technical problems are gone, the question is what your sessions
          actually earn. CamCash turns your tip history into hourly rate, peak hours and
          session comparisons.
        </p>
        <a href="/landing" style={s.ctaBtn}>Track My Sessions Free &rarr;</a>
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
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/what-upload-speed-do-you-need-for-camming" style={s.link}>&rarr; How much upload speed you need</a></p>
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/what-is-rtmp-for-cam-models" style={s.link}>&rarr; RTMP, stream keys and bitrate explained</a></p>
        <p style={{ ...s.p, marginBottom: 0 }}><a href="/blog/cam-model-equipment-guide" style={s.link}>&rarr; Cam model equipment guide</a></p>
      </div>
    </ArticleLayout>
  )
}

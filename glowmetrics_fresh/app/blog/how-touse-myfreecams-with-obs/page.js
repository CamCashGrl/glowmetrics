import ArticleLayout from '../../components/ArticleLayout'
import { s, articleSchema, articleMeta } from '../../../lib/blog-article-styles'

const SLUG = 'how-touse-myfreecams-with-obs'
const TITLE = 'How to Use MyFreeCams With OBS: External Broadcasting Setup'
const DESC = 'Connect OBS to MyFreeCams step by step: where the MFC Stream Key lives in ModelWeb, what to put in OBS Settings → Stream, and the starting encoder settings MFC recommends.'

const FAQS = [
  {
    q: 'Do I still need to be logged into ModelWeb if I broadcast with OBS?',
    a: 'Yes. MyFreeCams says models must remain logged into ModelWeb to broadcast even when an external broadcaster such as OBS is producing and sending the video. OBS handles the encoding; ModelWeb still handles your model account and the room itself.',
  },
  {
    q: 'Where is the MyFreeCams Stream Key?',
    a: 'In ModelWeb, open Options → External Broadcaster → Stream Key & URL, then click the Stream Key to copy it. That is the path MFC documents for OBS setup.',
  },
  {
    q: 'What OBS settings should I start with on MFC?',
    a: 'MFC currently recommends starting with the software x264 encoder at 3000 kbps, 1280x720 resolution, 30 FPS and 160 kbps audio. Get a stable broadcast on those before experimenting with a hardware encoder or a higher resolution.',
  },
  {
    q: 'My OBS connection worked last week and now it fails. What changed?',
    a: 'Check whether your MFC password changed. MFC ties the Stream Key to your model-account password and regenerates the key automatically when the password changes, which silently invalidates the key stored in OBS. Copy the current key from ModelWeb before troubleshooting anything else.',
  },
]

export const metadata = articleMeta({ title: TITLE, description: DESC, slug: SLUG })
const schema = articleSchema({ title: TITLE, description: DESC, slug: SLUG, faqs: FAQS })

export default function Page() {
  return (
    <ArticleLayout
      schema={schema}
      breadcrumb={[{ label: 'Blog', href: '/blog' }, { label: TITLE }]}
    >
      <div style={s.meta}><span>CamCash</span><span>Updated August 2026</span><span>6 min read</span></div>

      <h1 style={s.h1}>How to Use MyFreeCams With OBS: External Broadcasting Setup</h1>

      <p style={s.intro}>
        MyFreeCams supports external broadcasting over RTMP, and OBS is one of the
        broadcaster applications it documents. The setup is short once you know where
        the Stream Key lives &mdash; it is inside ModelWeb, not in your account settings,
        which is where most models look first.
      </p>

      <div style={s.answer}>
        <strong style={s.strong}>Quick answer:</strong> Log into MFC ModelWeb, open
        <strong style={s.strong}> Options &rarr; External Broadcaster &rarr; Stream Key &amp; URL</strong>,
        copy the Stream Key, then open <strong style={s.strong}>OBS &rarr; Settings &rarr; Stream</strong> and
        select MyFreeCams as the service. You still stay logged into ModelWeb while OBS sends the video.
      </div>

      <h2 style={s.h2}>What you need</h2>
      <ul style={s.ul}>
        <li style={s.li}>A MyFreeCams model account.</li>
        <li style={s.li}>OBS Studio installed on your computer.</li>
        <li style={s.li}>A webcam and a microphone.</li>
        <li style={s.li}>An internet connection that can sustain your chosen bitrate.</li>
        <li style={s.li}>Your <em>current</em> MFC Stream Key.</li>
      </ul>

      <h2 style={s.h2}>Step by step</h2>

      <div style={s.step}>
        <span style={s.stepNum}>STEP 1</span>
        <p style={{ ...s.p, marginBottom: 0 }}>
          <strong style={s.strong}>Open MFC ModelWeb and log in.</strong> MFC states that
          models must remain logged into ModelWeb even when an external broadcaster is
          sending the video. Closing ModelWeb because &ldquo;OBS is doing the work now&rdquo; is a
          common first mistake.
        </p>
      </div>

      <div style={s.step}>
        <span style={s.stepNum}>STEP 2</span>
        <p style={{ ...s.p, marginBottom: 0 }}>
          <strong style={s.strong}>Find the Stream Key.</strong> Inside ModelWeb, click
          <strong style={s.strong}> Options</strong> in the lower-left area, select
          <strong style={s.strong}> External Broadcaster</strong>, then open
          <strong style={s.strong}> Stream Key &amp; URL</strong>. Click the Stream Key to copy it.
          Treat it like a credential &mdash; not in screenshots, not in public posts, not in a
          shared troubleshooting thread.
        </p>
      </div>

      <div style={s.step}>
        <span style={s.stepNum}>STEP 3</span>
        <p style={{ ...s.p, marginBottom: 0 }}>
          <strong style={s.strong}>Connect OBS.</strong> Open
          <strong style={s.strong}> Settings &rarr; Stream</strong>, expand the Service selector,
          choose <strong style={s.strong}>MyFreeCams</strong>, and paste the Stream Key into the
          Stream Key field. MFC says not to change the server unless you are actually
          troubleshooting a connection problem.
        </p>
      </div>

      <div style={s.step}>
        <span style={s.stepNum}>STEP 4</span>
        <p style={{ ...s.p, marginBottom: 0 }}>
          <strong style={s.strong}>Use MFC&rsquo;s starting settings.</strong> For a first setup MFC
          currently recommends the software (x264) encoder, 3000 kbps at 1280&times;720, 30 FPS
          and 160 kbps audio, with 6 Mbps upload as a minimum and 12+ Mbps recommended.
          Get that working before changing anything.
        </p>
      </div>

      <div style={s.step}>
        <span style={s.stepNum}>STEP 5</span>
        <p style={{ ...s.p, marginBottom: 0 }}>
          <strong style={s.strong}>Add your camera and microphone.</strong> Add the webcam as a
          <strong style={s.strong}> Video Capture Device</strong>, then explicitly pick the microphone
          you want in OBS rather than letting it default to whichever input the system prefers.
        </p>
      </div>

      <div style={s.step}>
        <span style={s.stepNum}>STEP 6</span>
        <p style={{ ...s.p, marginBottom: 0 }}>
          <strong style={s.strong}>Test before you depend on it.</strong> Check the camera preview,
          microphone level, audio/video sync and the OBS statistics panel before a busy show.
          If the connection fails, change one thing at a time.
        </p>
      </div>

      <h2 style={s.h2}>Why bother with OBS at all?</h2>
      <p style={s.p}>
        MFC&rsquo;s external RTMP path gives you scenes, transitions, overlays, effects and audio
        tools that the browser broadcaster does not. That is genuinely useful if you run a
        structured show &mdash; a goal graphic, a second camera angle, a scene you switch to
        between sets.
      </p>
      <p style={s.p}>
        It is not automatically better. If your browser broadcast is stable and you do not
        need scene control, adding OBS mostly adds things that can break mid-show.
      </p>

      <h2 style={s.h2}>If your OBS connection suddenly stops working</h2>
      <p style={s.p}>
        Check your MFC password first. MFC links the Stream Key to your model-account password
        and regenerates the key automatically when the password changes &mdash; so a password
        change you made days ago is the usual reason a previously working OBS setup starts
        failing. Copy the current Stream Key from ModelWeb again before going any deeper.
      </p>

      <div style={s.note}>
        Platform interfaces, recommended bitrates and broadcaster requirements change. Check
        MFC&rsquo;s current ModelWeb and OBS documentation before relying on any specific figure
        here.
      </div>

      <div style={s.cta}>
        <div style={s.ctaTitle}>Did the OBS switch actually change your numbers?</div>
        <p style={s.ctaText}>
          A better-looking stream is only worth the setup time if it shows up in your results.
          CamCash turns your own tip history into session, hourly and platform comparisons, so
          you can put the weeks before and after a setup change side by side.
        </p>
        <a href="/landing" style={s.ctaBtn}>Analyze My Earnings Free &rarr;</a>
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
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/how-to-find-myfreecams-stream-key" style={s.link}>&rarr; Where to find your MyFreeCams stream key</a></p>
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/how-to-set-up-split-streaming-on-multiple-cam-sites" style={s.link}>&rarr; How to set up split streaming on multiple cam sites</a></p>
        <p style={{ ...s.p, marginBottom: 0 }}><a href="/guides/cam-model-analytics" style={s.link}>&rarr; Cam model analytics guide</a></p>
      </div>
    </ArticleLayout>
  )
}

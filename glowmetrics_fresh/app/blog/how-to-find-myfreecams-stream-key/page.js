import ArticleLayout from '../../components/ArticleLayout'
import { s, articleSchema, articleMeta } from '../../../lib/blog-article-styles'

const SLUG = 'how-to-find-myfreecams-stream-key'
const TITLE = 'How to Find Your MyFreeCams Stream Key and RTMP Settings'
const DESC = 'Where the MFC Stream Key actually lives in ModelWeb, what it does, why it changes without warning, and the order to troubleshoot an OBS connection that will not connect.'

const FAQS = [
  {
    q: 'Where is the MyFreeCams stream key?',
    a: 'Inside ModelWeb, not in your account settings. Log in, click Options, choose External Broadcaster, then open Stream Key & URL and copy the key. That is the path MFC documents for OBS setup, and it is why models searching account settings never find it.',
  },
  {
    q: 'Why did my MFC stream key stop working?',
    a: 'MFC ties the Stream Key to your model-account password and regenerates it automatically when the password changes. If you changed your password at any point, the key saved in OBS is stale. Copy the current one from ModelWeb before troubleshooting anything else.',
  },
  {
    q: 'What is the difference between the stream key and the RTMP URL?',
    a: 'The URL tells your broadcasting software where to send the stream. The stream key is the account-specific credential that identifies the broadcast as yours. Neither is your MFC username or your password, and neither should ever be shared.',
  },
  {
    q: 'Do I need ModelWeb open while OBS is streaming?',
    a: 'Yes. MFC says models must remain logged into ModelWeb even when an external application such as OBS is sending the video.',
  },
]

export const metadata = articleMeta({ title: TITLE, description: DESC, slug: SLUG })
const schema = articleSchema({ title: TITLE, description: DESC, slug: SLUG, faqs: FAQS })

export default function Page() {
  return (
    <ArticleLayout
      schema={schema}
      breadcrumb={[{ label: 'Blog', href: '/blog' }, { label: 'How to Find Your MyFreeCams Stream Key' }]}
    >
      <div style={s.meta}><span>CamCash</span><span>Updated August 2026</span><span>4 min read</span></div>

      <h1 style={s.h1}>How to Find Your MyFreeCams Stream Key and RTMP Settings</h1>

      <p style={s.intro}>
        If OBS is asking for a Stream Key and you cannot find one anywhere in MyFreeCams, you are
        almost certainly looking in the wrong place. The setting is not in your account settings.
        It is inside the ModelWeb broadcaster.
      </p>

      <div style={s.answer}>
        <strong style={s.strong}>Quick answer:</strong> ModelWeb &rarr;
        <strong style={s.strong}> Options</strong> &rarr;
        <strong style={s.strong}> External Broadcaster</strong> &rarr;
        <strong style={s.strong}> Stream Key &amp; URL</strong> &rarr; click the Stream Key to copy it.
      </div>

      <h2 style={s.h2}>Finding the key</h2>
      <ol style={s.ol}>
        <li style={s.li}>Open <strong style={s.strong}>MyFreeCams ModelWeb</strong>.</li>
        <li style={s.li}>Log into your model account.</li>
        <li style={s.li}>Click <strong style={s.strong}>Options</strong>.</li>
        <li style={s.li}>Choose <strong style={s.strong}>External Broadcaster</strong>.</li>
        <li style={s.li}>Select <strong style={s.strong}>Stream Key &amp; URL</strong>.</li>
        <li style={s.li}>Copy the Stream Key.</li>
      </ol>

      <h2 style={s.h2}>What the stream key actually is</h2>
      <p style={s.p}>
        The Stream Key identifies an incoming broadcast as belonging to your model account. Think
        of the RTMP server or URL as the <em>address</em> and the Stream Key as the
        <em> credential</em> that proves the stream arriving at that address is yours.
      </p>
      <p style={s.p}>
        <strong style={s.strong}>Do not post it publicly and do not send it to anyone.</strong> Anyone
        holding your key can send video to your room. It belongs in the same mental category as a
        password, not in the category of settings you paste into a support thread.
      </p>

      <h2 style={s.h2}>Where it goes in OBS</h2>
      <p style={s.p}>
        Open <strong style={s.strong}>Settings &rarr; Stream</strong>. MFC currently instructs models to
        select MyFreeCams from the Service selector and paste the key into the Stream Key field.
        The full walkthrough is in{' '}
        <a href="/blog/how-touse-myfreecams-with-obs" style={s.link}>how to use MyFreeCams with OBS</a>.
      </p>

      <h2 style={s.h2}>The key changed and nobody told you</h2>
      <p style={s.p}>
        This is the single most common cause of a setup that worked last month and fails today.
        MFC links the Stream Key to your model-account password. Change the password and the key is
        regenerated automatically &mdash; silently, as far as OBS is concerned.
      </p>
      <p style={s.p}>
        If you have changed your MFC password at any point since setting up OBS, go back to
        ModelWeb and copy the current key before you touch anything else.
      </p>

      <h2 style={s.h2}>Stream key vs RTMP URL vs login</h2>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr><th style={s.th}>Value</th><th style={s.th}>What it does</th><th style={s.th}>Share it?</th></tr>
          </thead>
          <tbody>
            <tr><td style={s.td}><strong style={s.strong}>RTMP / server URL</strong></td><td style={s.td}>Tells the broadcaster where to send the stream</td><td style={s.td}>Not sensitive, but use the current one</td></tr>
            <tr><td style={s.td}><strong style={s.strong}>Stream Key</strong></td><td style={s.td}>Identifies the stream as yours</td><td style={s.td}>Never</td></tr>
            <tr><td style={s.td}><strong style={s.strong}>Username / password</strong></td><td style={s.td}>Logs you into MFC and ModelWeb</td><td style={s.td}>Never</td></tr>
          </tbody>
        </table>
      </div>

      <h2 style={s.h2}>OBS still will not connect</h2>
      <p style={s.p}>Work through these in order, changing one thing at a time:</p>
      <ol style={s.ol}>
        <li style={s.li}>You are logged into ModelWeb.</li>
        <li style={s.li}>You copied the <em>current</em> Stream Key, not a saved one.</li>
        <li style={s.li}>MyFreeCams is selected in the OBS Service list.</li>
        <li style={s.li}>No stray spaces were included when the key was pasted.</li>
        <li style={s.li}>Your MFC password has not changed recently.</li>
        <li style={s.li}>Your connection can sustain the bitrate you selected.</li>
        <li style={s.li}>OBS is actually sending video &mdash; check the statistics panel.</li>
      </ol>
      <p style={s.p}>
        If the connection establishes but the stream is unstable, that is a different problem.{' '}
        <a href="/blog/obs-dropped-frames-cam-stream" style={s.link}>Dropped frames while camming</a>{' '}
        covers how to tell a network problem from an encoder problem.
      </p>

      <div style={s.note}>
        MFC&rsquo;s interface and instructions change over time. Check the current ModelWeb and OBS
        documentation before relying on any specific menu path here.
      </div>

      <div style={s.cta}>
        <div style={s.ctaTitle}>Once you are live, track what the setup produced</div>
        <p style={s.ctaText}>
          A working OBS setup is a means, not a result. CamCash turns your MFC tip history into
          session, hourly and fan analytics so you can see whether the change moved anything.
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
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/what-is-rtmp-for-cam-models" style={s.link}>&rarr; What is RTMP for cam models?</a></p>
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/how-touse-myfreecams-with-obs" style={s.link}>&rarr; How to use MyFreeCams with OBS</a></p>
        <p style={{ ...s.p, marginBottom: 0 }}><a href="/blog/how-to-get-started-on-myfreecams-as-a-model" style={s.link}>&rarr; Getting started on MyFreeCams as a model</a></p>
      </div>
    </ArticleLayout>
  )
}

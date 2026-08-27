import ArticleLayout from '../../components/ArticleLayout'
import { s, articleSchema, articleMeta } from '../../../lib/blog-article-styles'

const SLUG = 'what-is-mfc-share'
const TITLE = 'What Is MFC Share? How MyFreeCams Share Works for Models'
const DESC = 'What MFC Share is, where models run into it in ModelWeb, and why it is not the same thing as OBS, RTMP, external broadcasting or multistreaming.'

const FAQS = [
  {
    q: 'What is MFC Share?',
    a: 'MFC Share is a MyFreeCams platform feature associated with sharing tips across participating rooms. Because platform features change, check the current MyFreeCams documentation and your own ModelWeb settings for exactly how it behaves on your account today.',
  },
  {
    q: 'Is MFC Share the same as external broadcasting?',
    a: 'No. MFC Share is a MyFreeCams feature relating to tips and room behaviour. External broadcasting is the separate matter of using software such as OBS to produce and send your video. They solve entirely different problems and are configured in different places.',
  },
  {
    q: 'Where do models encounter MFC Share?',
    a: 'MFC’s current ModelWeb documentation includes a setting for whether MFC Share tips count toward countdowns, which means models often meet the feature while configuring tip and goal behaviour rather than while looking for it deliberately.',
  },
]

export const metadata = articleMeta({ title: TITLE, description: DESC, slug: SLUG })
const schema = articleSchema({ title: TITLE, description: DESC, slug: SLUG, faqs: FAQS })

export default function Page() {
  return (
    <ArticleLayout
      schema={schema}
      breadcrumb={[{ label: 'Blog', href: '/blog' }, { label: 'What Is MFC Share?' }]}
    >
      <div style={s.meta}><span>CamCash</span><span>Updated August 2026</span><span>4 min read</span></div>

      <h1 style={s.h1}>What Is MFC Share? How MyFreeCams Share Works for Models</h1>

      <p style={s.intro}>
        MFC Share is a MyFreeCams platform feature associated with sharing tips across
        participating rooms. Most models meet it by accident &mdash; while configuring countdowns
        or tip behaviour in ModelWeb &mdash; rather than by going looking for it, which is why it
        tends to get confused with the unrelated broadcasting settings sitting nearby.
      </p>

      <div style={s.answer}>
        <strong style={s.strong}>The short version:</strong> MFC Share is a MyFreeCams feature. It is
        not OBS, not RTMP, not an external broadcaster, and not multistreaming your camera to
        another website. Those are separate systems that happen to be discussed in the same
        setup conversations.
      </div>

      <h2 style={s.h2}>Where you run into it</h2>
      <p style={s.p}>
        MFC&rsquo;s current ModelWeb documentation includes a setting controlling whether MFC Share
        tips count toward countdowns. That places the feature squarely inside the part of your room
        configuration you touch when setting up goals and tip-driven mechanics &mdash; which is
        exactly why it appears mid-setup for models who were configuring something else.
      </p>

      <h2 style={s.h2}>MFC Share vs external broadcasting</h2>
      <p style={s.p}>These solve completely different problems:</p>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr><th style={s.th}>Term</th><th style={s.th}>What it actually is</th></tr>
          </thead>
          <tbody>
            <tr><td style={s.td}><strong style={s.strong}>MFC Share</strong></td><td style={s.td}>A MyFreeCams feature relating to tip sharing and countdown behaviour</td></tr>
            <tr><td style={s.td}><strong style={s.strong}>OBS</strong></td><td style={s.td}>External broadcasting software that produces and sends your video</td></tr>
            <tr><td style={s.td}><strong style={s.strong}>RTMP</strong></td><td style={s.td}>The streaming protocol used to deliver that video to a server</td></tr>
            <tr><td style={s.td}><strong style={s.strong}>Stream Key</strong></td><td style={s.td}>The account-specific credential identifying your broadcast</td></tr>
            <tr><td style={s.td}><strong style={s.strong}>MFC Alerts</strong></td><td style={s.td}>An external overlay and alert system</td></tr>
          </tbody>
        </table>
      </div>

      <p style={s.p}>
        You can use OBS without touching MFC Share, and you can use MFC Share without ever opening
        OBS. Knowing which problem each one solves makes troubleshooting dramatically faster,
        because it tells you which settings screen the answer is even on.
      </p>

      <h2 style={s.h2}>Why the confusion is so common</h2>
      <p style={s.p}>
        Models see OBS, RTMP, Stream Key, MFC Share, MFC Alerts and various bots discussed together
        in the same forum threads and setup guides, because they all come up during the same
        &ldquo;I am upgrading my room&rdquo; project. They are not interchangeable, they are not
        alternatives to each other, and a question about one will get you a useless answer if you
        ask it about another.
      </p>

      <h2 style={s.h2}>What to verify before relying on it</h2>
      <p style={s.p}>
        Check your current ModelWeb settings and MFC&rsquo;s official model documentation. Platform
        features get added, changed and retired, and an old screenshot or a two-year-old forum
        comment is not evidence of how the feature works on your account today.
      </p>

      <div style={s.note}>
        Platform feature behaviour and availability can change. Treat MFC&rsquo;s current
        documentation and your own ModelWeb panel as the authority, not this article.
      </div>

      <div style={s.cta}>
        <div style={s.ctaTitle}>See what your tip settings actually changed</div>
        <p style={s.ctaText}>
          Room mechanics are worth adjusting when they move your numbers. CamCash tracks tips,
          sessions and hourly rate from your own MFC history, so you can compare the weeks either
          side of a change instead of guessing.
        </p>
        <a href="/landing" style={s.ctaBtn}>Track My MFC Tips &rarr;</a>
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
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/myfreecams-tokens-explained" style={s.link}>&rarr; MyFreeCams tokens explained</a></p>
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/how-touse-myfreecams-with-obs" style={s.link}>&rarr; How to use MyFreeCams with OBS</a></p>
        <p style={{ ...s.p, marginBottom: 0 }}><a href="/blog/how-to-get-more-tips-on-myfreecams" style={s.link}>&rarr; How to get more tips on MyFreeCams</a></p>
      </div>
    </ArticleLayout>
  )
}

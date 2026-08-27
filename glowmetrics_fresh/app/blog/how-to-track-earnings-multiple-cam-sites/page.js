import ArticleLayout from '../../components/ArticleLayout'
import { s, articleSchema, articleMeta } from '../../../lib/blog-article-styles'

const SLUG = 'how-to-track-earnings-multiple-cam-sites'
const TITLE = 'How to Track Cam Model Earnings Across Multiple Cam Sites'
const DESC = 'A tracking system for multi-platform cam models: keep the raw platform data, add time, compare like periods, and answer which site is actually worth your hours.'

const FAQS = [
  {
    q: 'How do I compare earnings across different cam sites?',
    a: 'Record platform, session start and end, duration and earnings for every stream, then compare like periods — Tuesday evenings against Tuesday evenings, a full month against a full month. Totals alone cannot tell you which site is worth your time, because they hide how many hours produced them.',
  },
  {
    q: 'Should I convert every platform to dollars in one column?',
    a: 'Keep the platform and its native token or credit count as the source data, and derive converted figures from it. Overwriting original transaction values to make a spreadsheet look tidy destroys the only numbers you can verify against the platform later.',
  },
  {
    q: 'How many sessions do I need before I can trust the comparison?',
    a: 'Enough that one unusual night cannot carry the result. A single exceptional session distorts an average badly; what matters is whether a platform repeatedly performs well enough to justify the hours you spend there.',
  },
]

export const metadata = articleMeta({ title: TITLE, description: DESC, slug: SLUG })
const schema = articleSchema({ title: TITLE, description: DESC, slug: SLUG, faqs: FAQS })

export default function Page() {
  return (
    <ArticleLayout
      schema={schema}
      breadcrumb={[{ label: 'Blog', href: '/blog' }, { label: 'Tracking Earnings Across Multiple Cam Sites' }]}
    >
      <div style={s.meta}><span>CamCash</span><span>Updated August 2026</span><span>5 min read</span></div>

      <h1 style={s.h1}>How to Track Cam Model Earnings Across Multiple Cam Sites</h1>

      <p style={s.intro}>
        If you stream on several platforms, checking each site&rsquo;s balance separately makes one
        basic question surprisingly hard to answer: <strong style={s.strong}>which site is actually
        worth my time?</strong> Four balances tell you what you have. They do not tell you what
        produced it.
      </p>

      <div style={s.answer}>
        <strong style={s.strong}>What a working system needs:</strong> platform, native token total,
        session start and end, duration, and earnings &mdash; per session, kept separately. Totals
        without time cannot answer the question you are asking.
      </div>

      <h2 style={s.h2}>Keep the raw platform data</h2>
      <p style={s.p}>
        Record the platform and its native currency or token count as the source data, with the date
        or session period attached so you can compare like with like.
      </p>
      <p style={s.p}>
        Do not manually overwrite original transaction information to make a spreadsheet look
        cleaner. The original numbers are the only ones you can check against the platform, and
        once they are gone you cannot recompute anything when a conversion rate or an assumption
        changes.
      </p>

      <h2 style={s.h2}>Add time &mdash; this is the part people skip</h2>
      <p style={s.p}>
        Earnings without hours are close to meaningless for a decision. $100 in two hours and $100
        in ten hours are the same number and completely different businesses.
      </p>
      <ul style={s.ul}>
        <li style={s.li}>Stream start</li>
        <li style={s.li}>Stream end</li>
        <li style={s.li}>Total session duration</li>
        <li style={s.li}>Earnings</li>
        <li style={s.li}>Platform</li>
      </ul>
      <p style={s.p}>
        Five fields. From those you get earnings per hour, which is the number that actually changes
        decisions &mdash; see{' '}
        <a href="/blog/revenue-per-hour-cam-model" style={s.link}>revenue per hour for cam models</a>.
      </p>

      <h2 style={s.h2}>Compare like periods</h2>
      <p style={s.p}>
        Compare Tuesday evenings with Tuesday evenings, or a complete month with a complete month.
        Comparing a three-hour holiday stream on one site with a quiet weekday afternoon on another
        and calling the gap a platform difference is the single most common way models talk
        themselves out of a good site.
      </p>

      <h2 style={s.h2}>Patterns, not one lucky night</h2>
      <p style={s.p}>
        One exceptional session distorts an average badly, and it is usually the session you
        remember most vividly. The useful question is whether a platform performs well
        <em> repeatedly</em>, across comparable time windows &mdash; which is why session history and
        multiple observations matter more than any single result.
      </p>
      <p style={s.p}>
        If you have only a handful of sessions on a site, call the result an early signal rather than
        a conclusion.
      </p>

      <h2 style={s.h2}>A per-platform scorecard</h2>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr><th style={s.th}>Track</th><th style={s.th}>Because</th></tr>
          </thead>
          <tbody>
            <tr><td style={s.td}>Hours streamed</td><td style={s.td}>The cost side of the equation</td></tr>
            <tr><td style={s.td}>Earnings</td><td style={s.td}>The return</td></tr>
            <tr><td style={s.td}>Earnings per hour</td><td style={s.td}>The only fair comparison between sites</td></tr>
            <tr><td style={s.td}>Repeat supporters</td><td style={s.td}>Whether you are building something or churning</td></tr>
            <tr><td style={s.td}>Technical problems</td><td style={s.td}>Hidden cost that never shows up in earnings</td></tr>
            <tr><td style={s.td}>Time spent managing it</td><td style={s.td}>Setup and chat overhead is real work</td></tr>
          </tbody>
        </table>
      </div>

      <div style={s.cta}>
        <div style={s.ctaTitle}>Stop rebuilding the same spreadsheet</div>
        <p style={s.ctaText}>
          CamCash turns uploaded platform data into session, hourly, fan and platform comparisons,
          so multi-site tracking stops being a manual monthly job. Your raw token values stay intact.
        </p>
        <a href="/landing" style={s.ctaBtn}>Compare My Platforms &rarr;</a>
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
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/cam-model-income-spreadsheet-what-to-track" style={s.link}>&rarr; What to track in an earnings spreadsheet</a></p>
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/how-to-compare-cam-platform-payouts" style={s.link}>&rarr; How to compare cam site payouts</a></p>
        <p style={{ ...s.p, marginBottom: 0 }}><a href="/blog/how-to-upload-csv-to-camcash" style={s.link}>&rarr; How to upload a CSV to CamCash</a></p>
      </div>
    </ArticleLayout>
  )
}

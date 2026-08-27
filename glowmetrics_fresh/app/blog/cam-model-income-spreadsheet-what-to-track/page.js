import ArticleLayout from '../../components/ArticleLayout'
import { s, articleSchema, articleMeta } from '../../../lib/blog-article-styles'

const SLUG = 'cam-model-income-spreadsheet-what-to-track'
const TITLE = 'What Should a Cam Model Track in an Earnings Spreadsheet?'
const DESC = 'The minimum useful fields for a cam earnings spreadsheet, how to calculate hourly performance without fooling yourself, and when a spreadsheet stops being the right tool.'

const FAQS = [
  {
    q: 'What are the minimum fields for a cam model earnings spreadsheet?',
    a: 'Date, platform, session start, session end, duration, native tips or tokens, converted revenue if you use a consistent rate, and a notes column for anything unusual. Eight columns answer most business questions; a fortieth column you never fill in answers none.',
  },
  {
    q: 'How do I calculate hourly rate from a spreadsheet?',
    a: 'Earnings divided by session hours. Be careful with very short sessions — a strong twenty minutes produces a dramatic hourly figure that will not repeat across a full show, and averaging it in distorts everything around it.',
  },
  {
    q: 'When should I stop using a spreadsheet?',
    a: 'When maintaining it becomes the reason you stop updating it. The underlying questions stay simple; once answering them means manual joins across several sheets, automation is doing the same job with fewer abandoned months.',
  },
]

export const metadata = articleMeta({ title: TITLE, description: DESC, slug: SLUG })
const schema = articleSchema({ title: TITLE, description: DESC, slug: SLUG, faqs: FAQS })

export default function Page() {
  return (
    <ArticleLayout
      schema={schema}
      breadcrumb={[{ label: 'Blog', href: '/blog' }, { label: 'What to Track in an Earnings Spreadsheet' }]}
    >
      <div style={s.meta}><span>CamCash</span><span>Updated August 2026</span><span>5 min read</span></div>

      <h1 style={s.h1}>What Should a Cam Model Track in an Earnings Spreadsheet?</h1>

      <p style={s.intro}>
        A cam earnings spreadsheet does not need to be complicated. Its purpose is to answer business
        questions a platform balance cannot &mdash; and the most common reason a tracking system
        fails is not that it was too simple, but that it grew until nobody maintained it.
      </p>

      <h2 style={s.h2}>The minimum useful fields</h2>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr><th style={s.th}>Field</th><th style={s.th}>Why it is there</th></tr>
          </thead>
          <tbody>
            <tr><td style={s.td}>Date</td><td style={s.td}>Lets you compare like periods</td></tr>
            <tr><td style={s.td}>Platform</td><td style={s.td}>Without it, multi-site history is one meaningless blend</td></tr>
            <tr><td style={s.td}>Session start / end</td><td style={s.td}>The raw inputs for duration and time-of-day analysis</td></tr>
            <tr><td style={s.td}>Duration</td><td style={s.td}>Turns totals into rates</td></tr>
            <tr><td style={s.td}>Native tips / tokens</td><td style={s.td}>The verifiable source number</td></tr>
            <tr><td style={s.td}>Converted revenue</td><td style={s.td}>Only if you apply one consistent rate &mdash; and record which</td></tr>
            <tr><td style={s.td}>Notes</td><td style={s.td}>Contest, promotion, illness, outage &mdash; the reason a row is odd</td></tr>
          </tbody>
        </table>
      </div>

      <h2 style={s.h2}>Add context, not clutter</h2>
      <p style={s.p}>
        You can optionally record room type, contest participation, promotion, or anything else that
        might explain an unusual result. That is genuinely useful &mdash; six months later,
        &ldquo;why was that Tuesday enormous?&rdquo; has an answer.
      </p>
      <p style={s.p}>
        What is not useful is thirty fields you will never fill in. Every column you add is a column
        you must maintain after every session, and a spreadsheet abandoned in March tells you nothing
        in December.
      </p>

      <h2 style={s.h2}>Calculate hourly performance</h2>
      <p style={s.p}>
        Totals become useful once you know what produced them:
      </p>
      <div style={s.answer}>
        <strong style={s.strong}>Hourly rate = earnings &divide; session hours</strong>
      </div>
      <p style={s.p}>
        Be careful with very short sessions. A strong twenty minutes produces a spectacular hourly
        figure that will not survive a four-hour show, and averaging it in alongside full sessions
        distorts everything around it. Either exclude very short sessions from rate comparisons or
        flag them.
      </p>

      <h2 style={s.h2}>Keep platforms separate</h2>
      <p style={s.p}>
        If you stream on multiple sites, platform identity must stay attached to every row.
        Otherwise you cannot tell which site produced a result, which is usually the exact question
        you built the spreadsheet to answer &mdash; see{' '}
        <a href="/blog/how-to-track-earnings-multiple-cam-sites" style={s.link}>tracking earnings
        across multiple cam sites</a>.
      </p>

      <h2 style={s.h2}>Track repeat behaviour if you can</h2>
      <p style={s.p}>
        If your system also records fans, you can eventually ask whether strong sessions correlate
        with returning supporters &mdash; one of the more genuinely useful things a tracking habit
        produces.
      </p>
      <p style={s.p}>
        Keep fan identity and financial records secure, and collect only what you actually need.
      </p>

      <h2 style={s.h2}>The questions it should answer</h2>
      <ul style={s.ul}>
        <li style={s.li}>Which platform deserves more hours?</li>
        <li style={s.li}>Which days perform best?</li>
        <li style={s.li}>Which time windows are worth testing again?</li>
        <li style={s.li}>Did earnings improve after I changed my schedule?</li>
        <li style={s.li}>Which sessions were unusually strong, and why?</li>
      </ul>
      <p style={s.p}>
        If your spreadsheet cannot answer these, it is a record rather than a tool. And once
        answering them means manual joins across several sheets, automation is doing the same job
        with fewer abandoned months. For the tax side of the same records, see{' '}
        <a href="/blog/benefits-of-cam-model-bookkeeping" style={s.link}>the benefits of cam model
        bookkeeping</a>.
      </p>

      <div style={s.cta}>
        <div style={s.ctaTitle}>Skip the manual maintenance</div>
        <p style={s.ctaText}>
          CamCash builds the same fields from your imported tip history &mdash; sessions, hours,
          hourly rate, platforms and fans &mdash; without a monthly data-entry evening.
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
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/guides/cam-model-income-tracker" style={s.link}>&rarr; Cam model income tracker</a></p>
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/cam-model-taxes" style={s.link}>&rarr; Cam model taxes guide</a></p>
        <p style={{ ...s.p, marginBottom: 0 }}><a href="/blog/how-to-upload-csv-to-camcash" style={s.link}>&rarr; How to upload a CSV to CamCash</a></p>
      </div>
    </ArticleLayout>
  )
}

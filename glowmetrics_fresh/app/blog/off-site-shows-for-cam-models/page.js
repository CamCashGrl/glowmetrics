import ArticleLayout from '../../components/ArticleLayout'
import { s, articleSchema, articleMeta } from '../../../lib/blog-article-styles'

const SLUG = 'off-site-shows-for-cam-models'
const TITLE = 'Off-Site Shows for Cam Models: What You Give Up When You Leave the Platform'
const DESC = 'Booking a show off-platform removes the payment protection, dispute handling and anonymity the cam site provides. What replaces each one, and how to price for the difference.'

const FAQS = [
  {
    q: 'Why do off-site shows pay more per hour?',
    a: 'Because you keep the platform’s cut. That is a real difference, but it is not free money — the percentage the platform takes is partly payment for chargeback handling, identity separation, dispute resolution and enforcement. Off-site, you absorb all of those yourself.',
  },
  {
    q: 'What is the biggest risk of booking off-platform?',
    a: 'Payment. On-platform, tokens are settled before you perform and the site handles disputes. Off-site you can perform and then have the payment reversed, with no intermediary and little recourse. Payment cleared and irreversible before the show starts is the single most important rule.',
  },
  {
    q: 'Is it against the rules to arrange shows off-platform?',
    a: 'It depends entirely on the platform, and several restrict directing viewers elsewhere. Check the current terms of the site you met the client on before arranging anything — the consequence for getting this wrong is losing the account and the audience attached to it.',
  },
  {
    q: 'How should I price an off-site show?',
    a: 'Price the whole workflow, not the performance. Negotiation, scheduling, setup, the show itself and follow-up all consume time. A one-hour show that took ninety minutes of surrounding work is a ninety-minute job, and pricing it as an hour is how off-site work ends up paying less than streaming.',
  },
]

export const metadata = articleMeta({ title: TITLE, description: DESC, slug: SLUG })
const schema = articleSchema({ title: TITLE, description: DESC, slug: SLUG, faqs: FAQS })

export default function Page() {
  return (
    <ArticleLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      <div style={s.meta}><span>CamCash</span><span>Updated August 2026</span><span>6 min read</span></div>

      <h1 style={s.h1}>Off-Site Shows for Cam Models: What You Give Up When You Leave the Platform</h1>

      <p style={s.intro}>
        The appeal of an off-site booking is obvious: no platform cut, so the same show
        pays substantially more. The part worth thinking about is what that percentage
        was buying, because you do not stop needing those things when you stop paying
        for them &mdash; you just start providing them yourself.
      </p>

      <div style={s.note}>
        Several platforms restrict directing viewers off-site, and the penalty is
        usually the account. Check the current terms of the site where you met the
        client before arranging anything, and treat what other models say is tolerated
        as unreliable.
      </div>

      <h2 style={s.h2}>What the platform cut actually covers</h2>

      <p style={s.p}>
        It is easy to read the platform&rsquo;s percentage as pure overhead. It is more
        accurately a bundle of services, and going off-site unbundles them:
      </p>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr><th style={s.th}>On-platform</th><th style={s.th}>Off-site</th></tr>
          </thead>
          <tbody>
            <tr><td style={s.td}>Tokens settled before you perform</td><td style={s.td}>You must secure payment yourself, in advance</td></tr>
            <tr><td style={s.td}>Platform absorbs chargebacks and disputes</td><td style={s.td}>A reversal is your loss, with little recourse</td></tr>
            <tr><td style={s.td}>Your stage name is the only identity involved</td><td style={s.td}>Payment methods and accounts can carry real details</td></tr>
            <tr><td style={s.td}>Ban tools and moderation backed by the site</td><td style={s.td}>Blocking is all you have, and it is per-channel</td></tr>
            <tr><td style={s.td}>Earnings recorded for you</td><td style={s.td}>You keep your own records for tax purposes</td></tr>
            <tr><td style={s.td}>Someone to escalate to</td><td style={s.td}>Nobody</td></tr>
          </tbody>
        </table>
      </div>

      <p style={s.p}>
        Every row is manageable. The mistake is treating the higher rate as a pure gain
        rather than as compensation for taking on six new responsibilities.
      </p>

      <h2 style={s.h2}>Payment is the part that goes wrong</h2>

      <p style={s.p}>
        Almost every bad off-site story is a payment story. The structural problem is
        that on-platform you are paid before you perform by a system designed to make
        that irreversible, and off-site you frequently are not.
      </p>

      <p style={s.p}>
        Two rules cover most of it. First, payment clears and becomes irreversible
        before the show begins &mdash; not promised, not pending, not &ldquo;sent, check
        your app&rdquo;. Second, use payment methods intended for business, which do not
        attach your legal name or personal accounts to a stranger&rsquo;s transaction
        history.
      </p>

      <p style={s.p}>
        Be particularly wary of overpayment and refund requests. A client who sends more
        than agreed and asks for the difference back is running a recognised scam in
        which the original payment later reverses and your refund does not. There is no
        legitimate version of this request.
      </p>

      <h2 style={s.h2}>Privacy compounds off-platform</h2>

      <p style={s.p}>
        On a cam site, the platform sits between you and the client. Off-site that layer
        is gone, and the risk is cumulative rather than per-show: each booking is another
        person holding another route to contact you directly.
      </p>

      <p style={s.p}>
        Keep separate accounts for everything a client touches &mdash; email, payment,
        video platform, messaging. Not because any single show is dangerous, but because
        the boundary that protects you is the separation itself, and one convenient
        exception is usually where it fails.
      </p>

      <p style={s.p}>
        Store the minimum you need. A record that a booking happened and what you were
        paid is necessary for tax; a growing archive of clients&rsquo; personal details
        is a liability you have no reason to carry.
      </p>

      <h2 style={s.h2}>Price the workflow, not the hour</h2>

      <p style={s.p}>
        This is the calculation that determines whether off-site work is actually worth
        more, and it is usually done wrong. An off-site show is not just the show:
      </p>

      <ul style={s.ul}>
        <li style={s.li}>Negotiating what is included and what it costs</li>
        <li style={s.li}>Agreeing a time and handling the rescheduling that often follows</li>
        <li style={s.li}>Confirming payment has cleared</li>
        <li style={s.li}>Setting up outside your normal streaming environment</li>
        <li style={s.li}>The show</li>
        <li style={s.li}>Follow-up messages and record-keeping</li>
      </ul>

      <p style={s.p}>
        A one-hour show can easily be a two-hour job. Charged as one hour at a higher
        rate than streaming, it can still pay less per hour than simply streaming would
        have &mdash; which is the outcome models are most often surprised by, because the
        headline number looked better.
      </p>

      <h2 style={s.h2}>Testing it properly</h2>

      <p style={s.p}>
        If you want to try off-site work, treat it as an experiment with a defined
        review rather than a new permanent offer. Run a small number of bookings, record
        total time including everything above, and compare the effective hourly rate
        against your streaming rate for the same period.
      </p>

      <p style={s.p}>
        Do it with clients who already have a spending history with you rather than with
        strangers making large promises. Existing regulars are both the most likely to
        follow through and the least likely to be a problem &mdash; and a first off-site
        experiment is not the moment to also be evaluating whether someone is genuine.
      </p>

      <div style={s.cta}>
        <div style={s.ctaTitle}>Know the rate you are comparing against</div>
        <p style={s.ctaText}>
          Off-site pricing only makes sense against a real streaming hourly rate.
          CamCash calculates yours from your actual tip history, so the comparison is
          based on your numbers rather than an estimate.
        </p>
        <a href="/landing" style={s.ctaBtn}>Calculate My Hourly Rate &rarr;</a>
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
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/how-to-stay-safe-as-a-cam-model" style={s.link}>&rarr; How to stay safe as a cam model</a></p>
        <p style={{ ...s.p, marginBottom: 6 }}><a href="/blog/how-cam-models-stay-anonymous" style={s.link}>&rarr; How cam models stay anonymous</a></p>
        <p style={{ ...s.p, marginBottom: 0 }}><a href="/blog/cam-model-self-employment-tax-prep" style={s.link}>&rarr; Self-employment tax prep</a></p>
      </div>
    </ArticleLayout>
  )
}

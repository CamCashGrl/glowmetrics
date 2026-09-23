
import ArticleLayout from '../../components/ArticleLayout'

export const metadata = {
  title: 'BongaCams Queen of Queens 2026: How the Contest Works & How Models Can Prepare',
  description:
    'Learn how the BongaCams Queen of Queens contest works, how points are earned, weekly prizes, regional competitions, and what models should track before and during the contest.',
  keywords: [
    'BongaCams Queen of Queens',
    'BongaCams Queen of Queens 2026',
    'Queen of Queens BongaCams',
    'BongaCams contest',
    'BongaCams model competition',
    'BongaCams rankings',
    'BongaCams points',
    'BongaCams models',
  ],
  authors: [{ name: 'CamCash', url: 'https://www.camcashgrl.com' }],
  alternates: {
    canonical: 'https://www.camcashgrl.com/blog/bongacams-queen-of-queens',
  },
  openGraph: {
    title: 'BongaCams Queen of Queens 2026: How It Works',
    description:
      'A practical guide for BongaCams models covering Queen of Queens points, weekly contests, prizes, regions, and performance tracking.',
    url: 'https://www.camcashgrl.com/blog/bongacams-queen-of-queens',
    type: 'article',
    images: [
      {
        url: 'https://www.camcashgrl.com/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BongaCams Queen of Queens 2026',
    description:
      'How the BongaCams Queen of Queens contest works, how points are earned, and what models should track.',
  },
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline:
    'BongaCams Queen of Queens 2026: How the Contest Works & How Models Can Prepare',
  description:
    'A practical guide to the BongaCams Queen of Queens weekly competitions, points, regional contests, prizes, and performance tracking.',
  url: 'https://www.camcashgrl.com/blog/bongacams-queen-of-queens',
  datePublished: '2026-08-23',
  dateModified: '2026-08-23',
  author: {
    '@type': 'Person',
    name: 'Daphne Dawson',
    jobTitle: 'Cam Model',
  },
  publisher: {
    '@type': 'Organization',
    name: 'CamCash',
    url: 'https://www.camcashgrl.com',
  },
  mainEntityOfPage: {
    '@type': 'WebPage',
    '@id': 'https://www.camcashgrl.com/blog/bongacams-queen-of-queens',
  },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is BongaCams Queen of Queens?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Queen of Queens is a set of weekly BongaCams model competitions divided into five regional contests. Models compete based on points earned during the weekly competition period, with the top 100 in each contest receiving cash prizes.',
      },
    },
    {
      '@type': 'Question',
      name: 'How often is the BongaCams Queen of Queens contest held?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'BongaModels states that five Queen of Queens contests are held every week, one for each region: North American & Australian, International, Latin American, European, and CIS.',
      },
    },
    {
      '@type': 'Question',
      name: 'How are Queen of Queens points calculated?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'According to the BongaModels contest information, models receive 1 point for every 10 Tokens sent by members. Online time also adds a percentage to the current point total: 3% per hour from Monday through Thursday and 5% per hour from Friday through Sunday, subject to the platform rules and hourly point limit.',
      },
    },
    {
      '@type': 'Question',
      name: 'How much does the BongaCams Queen of Queens winner get?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The first-place winner of each regional Queen of Queens contest receives $1,000 and the Queen of Queens title. BongaModels also lists prizes for places 2 through 100.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I use my own earnings data to improve my Queen of Queens strategy?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Your own history can help you identify which days, hours, session lengths, and earning patterns have historically worked best for you. Historical data cannot guarantee a future contest result, but it can help you make more informed scheduling decisions.',
      },
    },
  ],
}

const prizeRows = [
  { place: '1st', prize: '$1,000 + Queen of Queens title' },
  { place: '2nd', prize: '$500' },
  { place: '3rd', prize: '$300' },
  { place: '4th–15th', prize: '$100' },
  { place: '16th–30th', prize: '$50' },
  { place: '31st–50th', prize: '$25' },
  { place: '51st–100th', prize: '$15' },
]

const regions = [
  'North American & Australian Queen of Queens',
  'International Queen of Queens',
  'Latin American Queen of Queens',
  'European Queen of Queens',
  'CIS Queen of Queens',
]

const trackingRows = [
  {
    metric: 'Tokens earned',
    why: 'Tokens directly contribute to contest points.',
    track: 'Tokens by day, session, and hour',
  },
  {
    metric: 'Hours online',
    why: 'Online time contributes to the contest point calculation.',
    track: 'Total hours and when those hours occurred',
  },
  {
    metric: 'Revenue per hour',
    why: 'More hours are not automatically better if your earning pace falls.',
    track: 'Earnings divided by hours streamed',
  },
  {
    metric: 'Best days',
    why: 'Your audience may be more active on certain days.',
    track: 'Historical earnings by day of week',
  },
  {
    metric: 'Top supporters',
    why: 'Returning high-value fans can materially affect a contest week.',
    track: 'Who tipped and when they last spent',
  },
]

const s = {
  meta: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    color: '#64748b',
    fontSize: '12px',
    marginBottom: '18px',
  },
  h1: {
    fontSize: 'clamp(32px, 6vw, 48px)',
    lineHeight: 1.08,
    letterSpacing: '-0.03em',
    color: '#f8fafc',
    marginBottom: '22px',
  },
  h2: {
    fontSize: '25px',
    lineHeight: 1.2,
    color: '#f1f5f9',
    marginTop: '42px',
    marginBottom: '14px',
  },
  h3: {
    fontSize: '18px',
    lineHeight: 1.3,
    color: '#e2e8f0',
    marginTop: '28px',
    marginBottom: '10px',
  },
  intro: {
    fontSize: '18px',
    lineHeight: 1.75,
    color: '#cbd5e1',
    marginBottom: '26px',
  },
  p: {
    fontSize: '15px',
    lineHeight: 1.8,
    color: '#94a3b8',
    marginBottom: '16px',
  },
  ul: {
    paddingLeft: '22px',
    color: '#94a3b8',
    lineHeight: 1.8,
  },
  li: {
    marginBottom: '8px',
  },
  callout: {
    padding: '22px',
    borderRadius: '14px',
    border: '1px solid rgba(99,102,241,.22)',
    background: 'rgba(99,102,241,.06)',
    margin: '26px 0',
  },
  calloutTitle: {
    fontSize: '13px',
    color: '#a5b4fc',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    marginBottom: '8px',
  },
  formula: {
    padding: '18px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,.035)',
    border: '1px solid rgba(255,255,255,.08)',
    color: '#f8fafc',
    fontWeight: 700,
    textAlign: 'center',
    margin: '18px 0 24px',
  },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,.08)',
    marginBottom: '22px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '560px',
  },
  th: {
    textAlign: 'left',
    padding: '11px 14px',
    background: 'rgba(255,255,255,.035)',
    color: '#e2e8f0',
    fontSize: '12px',
    borderBottom: '1px solid rgba(255,255,255,.08)',
  },
  td: {
    padding: '11px 14px',
    color: '#94a3b8',
    fontSize: '13px',
    borderBottom: '1px solid rgba(255,255,255,.05)',
  },
  tdBold: {
    fontWeight: 700,
    color: '#f1f5f9',
  },
  cta: {
    marginTop: '42px',
    padding: '28px',
    borderRadius: '16px',
    background: 'rgba(99,102,241,.08)',
    border: '1px solid rgba(99,102,241,.25)',
    textAlign: 'center',
  },
  ctaTitle: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#f8fafc',
    marginBottom: '8px',
  },
  ctaText: {
    color: '#94a3b8',
    lineHeight: 1.7,
    marginBottom: '18px',
  },
  ctaBtn: {
    display: 'inline-block',
    padding: '11px 18px',
    borderRadius: '9px',
    background: '#6366f1',
    color: 'white',
    textDecoration: 'none',
    fontWeight: 700,
  },
  faq: {
    marginTop: '18px',
  },
  faqItem: {
    borderBottom: '1px solid rgba(255,255,255,.07)',
    padding: '0 0 14px',
    marginBottom: '14px',
  },
  summary: {
    color: '#f1f5f9',
    fontWeight: 700,
    cursor: 'pointer',
    paddingBottom: '6px',
  },
  related: {
    marginTop: '38px',
    paddingTop: '24px',
    borderTop: '1px solid rgba(255,255,255,.07)',
  },
  relTitle: {
    fontSize: '11px',
    color: '#64748b',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    marginBottom: '10px',
  },
  relLink: {
    display: 'block',
    color: '#a5b4fc',
    textDecoration: 'none',
    fontSize: '14px',
    marginBottom: '8px',
  },
  promo: { background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.08))', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '12px', padding: '32px 24px', margin: '38px 0' },
  promoTitle: { fontSize: '18px', fontWeight: 800, color: '#f1f5f9', marginBottom: '12px' },
  promoButtons: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '18px' },
  promoBtn: { display: 'inline-block', padding: '12px 24px', borderRadius: '8px', color: '#fff', fontWeight: 700, fontSize: '14px', textDecoration: 'none', textAlign: 'center', cursor: 'pointer', border: 'none' },
  promoBtnModel: { background: 'linear-gradient(135deg, #f59e0b, #d97706)', transition: 'all 0.3s ease' },
  promoBtnCam: { background: 'linear-gradient(135deg, #ef4444, #dc2626)', transition: 'all 0.3s ease' },
}


export default function BongaCamsQueenOfQueensPage() {
  return (
    <ArticleLayout
      breadcrumb={[
        { label: 'Blog', href: '/blog' },
        { label: 'BongaCams Queen of Queens' },
      ]}
      schema={[articleSchema, faqSchema]}
    >
      <div style={s.meta}>
        <span>Daphne Dawson</span>
        <span>·</span>
        <span>Updated August 2026</span>
        <span>·</span>
        <span>10 min read</span>
        <span>·</span>
        <span>BongaCams Strategy</span>
      </div>

      <h1 style={s.h1}>
        BongaCams Queen of Queens 2026: How the Contest Works & How Models Can Prepare
      </h1>

      <p style={s.intro}>
        If you stream on BongaCams, Queen of Queens is one of the platform's
        most visible recurring competitions. But competing effectively is about
        more than staring at the leaderboard. You need to understand how points
        are earned, when the contest runs, what the prizes are, and which parts
        of your own performance you can actually measure.
      </p>

      <div style={s.callout}>
        <div style={s.calloutTitle}>Quick answer</div>
        <p style={{ ...s.p, marginBottom: 0 }}>
          BongaModels currently runs{' '}
          <strong style={{ color: '#f8fafc' }}>
            five Queen of Queens contests every week
          </strong>
          , divided by region. The platform says models receive points from
          Tokens and online time, and the top 100 models in each regional
          contest receive cash prizes. The first-place winner receives $1,000
          and the Queen of Queens title.
        </p>
      </div>

      <h2 style={s.h2}>What Is BongaCams Queen of Queens?</h2>

      <p style={s.p}>
        Queen of Queens is a recurring BongaModels competition for models.
        Rather than having one global leaderboard, BongaModels currently lists
        five regional competitions:
      </p>

      <ul style={s.ul}>
        {regions.map((region) => (
          <li key={region} style={s.li}>
            {region}
          </li>
        ))}
      </ul>

      <p style={s.p}>
        BongaModels says the competitions are held weekly and that the top 100
        models in each contest receive cash prizes. The current official
        information also identifies the first-place winner as the Queen of
        Queens for that regional contest.
      </p>

      <h2 style={s.h2}>When Does Queen of Queens Run?</h2>

      <p style={s.p}>
        The contest is a weekly competition. The current BongaModels contest
        information states that the weekly competition runs from{' '}
        <strong style={{ color: '#f1f5f9' }}>
          Monday at 00:00 through Sunday at 23:59:59 GMT+3
        </strong>
        . Because contest rules and schedules can change, check the live
        BongaModels contest page before planning a specific week.
      </p>

      <p style={s.p}>
        That weekly structure matters because your goal should not simply be to
        maximize one unusually strong session. You are trying to understand how
        your activity, earning pace, and audience behavior fit across the entire
        contest period.
      </p>

      <h2 style={s.h2}>How Are Queen of Queens Points Calculated?</h2>

      <p style={s.p}>
        According to BongaModels' current contest information, the basic point
        system works like this:
      </p>

      <div style={s.formula}>
        10 Tokens sent by members = 1 contest point
      </div>

      <p style={s.p}>
        Online time can also increase your current point total. BongaModels
        currently states that each accumulated hour online adds{' '}
        <strong style={{ color: '#f1f5f9' }}>
          3% from Monday through Thursday
        </strong>{' '}
        and{' '}
        <strong style={{ color: '#f1f5f9' }}>
          5% from Friday through Sunday
        </strong>
        . The platform also lists a maximum of 6,000 points per hour for the
        online-time component.
      </p>

      <p style={s.p}>
        The important takeaway for a model is that the contest isn't simply a
        raw-hours competition. Tokens and time interact with the contest's point
        system, so your own earning pace still matters.
      </p>

      <h2 style={s.h2}>What Are the Queen of Queens Prizes?</h2>

      <p style={s.p}>
        BongaModels currently lists the following prize structure for each of
        the five regional contests:
      </p>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Place</th>
              <th style={s.th}>Prize</th>
            </tr>
          </thead>

          <tbody>
            {prizeRows.map((row) => (
              <tr key={row.place}>
                <td style={{ ...s.td, ...s.tdBold }}>{row.place}</td>
                <td style={s.td}>{row.prize}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={s.p}>
        That means the contest is not simply winner-take-all. The top 100
        positions currently have a listed cash prize, with the first-place
        model also receiving the Queen of Queens title and associated
        visibility.
      </p>

      <h2 style={s.h2}>
        What Should BongaCams Models Track During Contest Week?
      </h2>

      <p style={s.p}>
        The leaderboard tells you where you stand. Your own data tells you{' '}
        <em>why</em> you are performing that way. Those are different things.
      </p>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Metric</th>
              <th style={s.th}>Why it matters</th>
              <th style={s.th}>What to track</th>
            </tr>
          </thead>

          <tbody>
            {trackingRows.map((row) => (
              <tr key={row.metric}>
                <td style={{ ...s.td, ...s.tdBold }}>{row.metric}</td>
                <td style={s.td}>{row.why}</td>
                <td style={s.td}>{row.track}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={s.h3}>1. Track your tokens by session</h3>

      <p style={s.p}>
        Don't wait until the end of the week to look at total earnings. Record
        how much you earned in each session. That lets you compare your
        strongest and weakest sessions instead of treating the entire week as
        one number.
      </p>

      <h3 style={s.h3}>2. Find your personal high-value hours</h3>

      <p style={s.p}>
        Generic advice about the "best time to stream" can be useful, but your
        own audience is more relevant. If your historical data shows that
        certain evening windows consistently produce stronger earnings per hour,
        that is information worth considering when you plan contest-week
        sessions.
      </p>

      <h3 style={s.h3}>3. Watch the cost of chasing hours</h3>

      <p style={s.p}>
        More time online can increase your opportunity to earn, but it can also
        lower your average earning pace if you stay online during weak periods.
        Track both total earnings and revenue per hour so you can see the
        difference.
      </p>

      <h3 style={s.h3}>
        4. Pay attention to returning high-value supporters
      </h3>

      <p style={s.p}>
        A contest week can make it tempting to focus entirely on the leaderboard.
        Don't forget the people who already know you. Your returning supporters
        can be a major part of your normal earning pattern, so knowing when they
        historically show up can help you make better scheduling decisions.
      </p>

      <h2 style={s.h2}>How to Prepare for a Queen of Queens Week</h2>

      <ul style={s.ul}>
        <li style={s.li}>
          <strong style={{ color: '#f1f5f9' }}>
            Review your previous sessions.
          </strong>{' '}
          Identify your strongest days, hours, and session lengths.
        </li>

        <li style={s.li}>
          <strong style={{ color: '#f1f5f9' }}>
            Set a realistic weekly target.
          </strong>{' '}
          Use your historical numbers instead of copying another model's goal.
        </li>

        <li style={s.li}>
          <strong style={{ color: '#f1f5f9' }}>
            Plan around your strongest audience windows.
          </strong>{' '}
          A longer schedule is not automatically a better schedule.
        </li>

        <li style={s.li}>
          <strong style={{ color: '#f1f5f9' }}>
            Keep your regulars engaged.
          </strong>{' '}
          Contest traffic is useful, but your existing audience still matters.
        </li>

        <li style={s.li}>
          <strong style={{ color: '#f1f5f9' }}>
            Track the week as it happens.
          </strong>{' '}
          Don't wait until Sunday night to discover which sessions actually
          worked.
        </li>
      </ul>

      <div style={s.cta}>
        <div style={s.ctaTitle}>
          Turn Contest Week Into Data You Can Actually Use
        </div>

        <p style={s.ctaText}>
          CamCash is built around the idea that your own earning history is more
          useful than generic advice. Track your sessions, compare earning
          pace, and see which parts of your schedule have historically worked
          best.
        </p>

        <a href="/landing" style={s.ctaBtn}>
          Analyze My Cam Data Free →
        </a>
      </div>

      <h2 style={s.h2}>
        What Queen of Queens Data Can — and Cannot — Tell You
      </h2>

      <p style={s.p}>
        Your historical numbers can help you make better decisions, but they
        cannot guarantee a contest result. A strong previous Friday does not
        guarantee another strong Friday, and a top supporter who tipped heavily
        last week may not be online this week.
      </p>

      <p style={s.p}>
        The useful question is therefore not "What will I earn?" It is "What
        patterns have actually worked for me before?" That distinction keeps
        your contest strategy grounded in evidence instead of wishful
        forecasting.
      </p>

      <h2 style={s.h2}>Was It Worth It? Reviewing the Week Afterwards</h2>

      <p style={s.p}>
        Preparation gets most of the attention, but the decision that actually
        compounds is the one you make <em>after</em> the contest: do you enter
        the next one? That question is impossible to answer from memory,
        because a contest week feels more productive than a normal week almost
        regardless of what it earned. Longer hours and a busier room create the
        impression of a good week even when the hourly rate fell.
      </p>

      <p style={s.p}>
        The only way to settle it is to compare contest week against a normal
        week using the same measures on both sides:
      </p>

      <ul style={s.ul}>
        <li style={s.li}>
          <strong style={{ color: '#f1f5f9' }}>Total hours streamed.</strong>{' '}
          Contest weeks almost always cost more hours than they feel like they
          did. Count them before you compare anything else.
        </li>

        <li style={s.li}>
          <strong style={{ color: '#f1f5f9' }}>Earnings per hour, not total earnings.</strong>{' '}
          Total earnings will usually be higher during a contest simply because
          you streamed more. If your hourly rate dropped, the contest bought
          you volume at a discount — which may still be worth it, but you
          should know that is the trade you made.
        </li>

        <li style={s.li}>
          <strong style={{ color: '#f1f5f9' }}>New regulars who stayed.</strong>{' '}
          This is the number that decides whether a contest was an investment
          or just a busy week. Count the supporters who first appeared during
          contest week and then tipped again in the two or three weeks after
          it. Contest traffic that never returns is worth far less than the
          raw totals suggest.
        </li>

        <li style={s.li}>
          <strong style={{ color: '#f1f5f9' }}>The week after.</strong>{' '}
          A contest that leaves you too depleted to stream normally afterwards
          has borrowed earnings from the following week rather than adding
          them. Compare the seven days after the contest against a typical
          week too.
        </li>
      </ul>

      <p style={s.p}>
        Run that comparison once and you will have a real answer for next time,
        specific to you rather than to whoever is posting screenshots. Some
        models find contests reliably profitable; others find the same hours
        earn more spent on a normal schedule with their existing regulars.
        Both outcomes are common, and neither is predictable in advance — which
        is exactly why it is worth measuring once instead of re-deciding on
        instinct every month.
      </p>

      <div style={s.promo}>
        <div style={s.promoTitle}>Ready to Join BongaCams?</div>
        <div style={s.promoButtons}>
          <a
            href="https://bongamodels.com?fuid=DaphneDawson&utm_source=camcashgrl&utm_medium=blog&utm_campaign=bongacams_signup"
            target="_blank"
            rel="noopener noreferrer"
            style={{...s.promoBtn, ...s.promoBtnModel}}
            
          >
            Interested in being a model?
          </a>
          <a
            href="https://bongacams.com?fuid=166966512&utm_source=camcashgrl&utm_medium=blog&utm_campaign=bongacams_viewer"
            target="_blank"
            rel="noopener noreferrer"
            style={{...s.promoBtn, ...s.promoBtnCam}}
            
          >
            Looking for a hot cam show?
          </a>
        </div>
      </div>

      <h2 style={s.h2}>Frequently Asked Questions</h2>

      <div style={s.faq}>
        {[
          [
            'What is BongaCams Queen of Queens?',
            'Queen of Queens is a set of weekly BongaModels model competitions divided into five regional contests. Models compete based on points earned during the weekly competition period, with the top 100 in each contest receiving cash prizes.',
          ],
          [
            'How often is the BongaCams Queen of Queens contest held?',
            'BongaModels states that five Queen of Queens contests are held every week, one for each region: North American & Australian, International, Latin American, European, and CIS.',
          ],
          [
            'How are Queen of Queens points calculated?',
            'According to BongaModels, models receive 1 point for every 10 Tokens sent by members. Online time also adds a percentage to the current point total: 3% per hour from Monday through Thursday and 5% per hour from Friday through Sunday, subject to the platform rules and hourly point limit.',
          ],
          [
            'How much does the BongaCams Queen of Queens winner get?',
            'The first-place winner of each regional contest receives $1,000 and the Queen of Queens title. BongaModels also lists prizes for places 2 through 100.',
          ],
          [
            'Can I use my own earnings data to improve my Queen of Queens strategy?',
            'Yes. Your own history can help identify which days, hours, session lengths, and earning patterns have historically worked best for you. Historical data cannot guarantee a future contest result, but it can support better scheduling decisions.',
          ],
        ].map(([q, a]) => (
          <details key={q} style={s.faqItem}>
            <summary style={s.summary}>{q}</summary>

            <p
              style={{
                ...s.p,
                marginTop: '8px',
                marginBottom: 0,
              }}
            >
              {a}
            </p>
          </details>
        ))}
      </div>

      <div style={s.related}>
        <div style={s.relTitle}>Related BongaCams content</div>

        <a
          href="/blog/how-much-do-bongacams-models-make"
          style={s.relLink}
        >
          → How Much Do BongaCams Models Make?
        </a>

        <a href="/blog/bongacams-payout-guide" style={s.relLink}>
          → BongaCams Payout Guide
        </a>

        <a
          href="/blog/bongacams-camscore-exsplained"
          style={s.relLink}
        >
          → BongaCams CamScore Explained
        </a>

        <a href="/blog/cam-model-earnings" style={s.relLink}>
          → Cam Model Earnings: The Complete Guide
        </a>

        <a href="/guides/cam-model-analytics" style={s.relLink}>
          → Cam Model Analytics
        </a>
      </div>
    </ArticleLayout>
  )
}

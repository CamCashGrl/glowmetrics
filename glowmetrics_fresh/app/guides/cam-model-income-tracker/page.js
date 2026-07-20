import ArticleLayout from '../../components/ArticleLayout'

export const metadata = {
  title: 'Free Cam Model Income Tracker: Earnings, Hours & Tips',
  description: 'Free cam model income tracker. See your real earnings by session, hour of day, platform, and individual fan — not just a total token count.',
  alternates: { canonical: 'https://www.camcashgrl.com/guides/cam-model-income-tracker' },
  openGraph: {
    title: 'Free Cam Model Income Tracker: Earnings, Hours & Tips',
    description: 'Free cam model income tracker. See your real earnings by session, hour of day, platform, and individual fan — not just a total token count.',
    url: 'https://www.camcashgrl.com/guides/cam-model-income-tracker',
    type: 'article',
    images: [{ url: 'https://www.camcashgrl.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Cam Model Income Tracker: Earnings, Hours & Tips',
    description: 'Free cam model income tracker. See your real earnings by session, hour of day, platform, and individual fan — not just a total token count.',
  },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Free Cam Model Income Tracker: Earnings, Hours & Tips',
  description: 'Free cam model income tracker. See your real earnings by session, hour of day, platform, and individual fan — not just a total token count.',
  url: 'https://www.camcashgrl.com/guides/cam-model-income-tracker',
  datePublished: '2026-01-01',
  dateModified: '2026-07-20',
  author: { '@type': 'Organization', name: 'CamCash', url: 'https://www.camcashgrl.com' },
  publisher: { '@type': 'Organization', name: 'CamCash', url: 'https://www.camcashgrl.com' },
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://www.camcashgrl.com/guides/cam-model-income-tracker' },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is the best way to track cam model income?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Track it at four levels: per session, per hour of day, per platform, and per fan. A single monthly total tells you that you earned a number — it never tells you why. Breaking earnings down across those four dimensions is what turns raw tip history into decisions you can act on.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do I need a spreadsheet to track cam income, or is there a free tool?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A spreadsheet works, but it requires manually exporting CSVs from each platform and rebuilding the same formulas every month. CamCash automates this — upload your CSV once and it calculates session earnings, $/hr by time of day, platform comparison, and top-fan spend automatically.',
      },
    },
    {
      '@type': 'Question',
      name: 'Should I use a spreadsheet or an automated tracker like CamCash?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "It depends what you're tracking. Spreadsheets are still the more flexible option for business expenses and tax categories, since they're built for arbitrary custom columns. CamCash is better suited to fan behavior, session patterns, and platform comparisons — the parts that require analyzing hundreds of timestamped rows, which is tedious by hand.",
      },
    },
    {
      '@type': 'Question',
      name: 'Should I track income in tokens or USD?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'USD, whenever your platform gives you a payout figure — it is the real source of truth. Use your platform’s token-to-dollar rate as a fallback only when a USD figure is not available, since that rate can vary by platform and payout tier.',
      },
    },
    {
      '@type': 'Question',
      name: 'How often should I review my income tracking data?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Weekly for session and hourly patterns, and every 2–3 months for peak-hour and platform-allocation decisions, since audience behavior shifts over time. Reviewing too infrequently means you keep acting on outdated peak windows; reviewing daily is usually just noise from normal session-to-session variance.',
      },
    },
  ],
}

const s = {
  h1:      { fontSize: '29px', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.2, marginBottom: '14px', letterSpacing: '-0.02em' },
  intro:   { fontSize: '16px', lineHeight: 1.75, color: '#cbd5e1', marginBottom: '32px', paddingLeft: '14px', borderLeft: '3px solid #6366f1' },
  h2:      { fontSize: '21px', fontWeight: 700, color: '#e2e8f0', marginBottom: '10px', marginTop: '40px', letterSpacing: '-0.01em' },
  h3:      { fontSize: '16px', fontWeight: 600, color: '#a5b4fc', marginBottom: '8px', marginTop: '22px' },
  p:       { fontSize: '15px', lineHeight: 1.75, color: '#94a3b8', marginBottom: '14px' },
  ul:      { paddingLeft: '20px', marginBottom: '16px' },
  li:      { fontSize: '15px', lineHeight: 1.7, color: '#94a3b8', marginBottom: '6px' },
  meta:    { fontSize: '12px', color: '#475569', marginBottom: '28px', display: 'flex', gap: '16px', flexWrap: 'wrap' },
  iLink:   { color: '#a5b4fc', textDecoration: 'none' },
  statGrid:{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '28px' },
  statCard:{ padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' },
  statVal: { fontSize: '22px', fontWeight: 800, color: '#10b981', marginBottom: '4px' },
  statLbl: { fontSize: '11px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' },
  card:    { borderRadius: '8px', border: '1px solid rgba(255,255,255,0.07)', marginBottom: '14px', overflow: 'hidden' },
  cardH:   { padding: '12px 16px', background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  cardT:   { fontSize: '15px', fontWeight: 700, color: '#f1f5f9' },
  cardB:   { padding: '14px 16px' },
  table:   { width: '100%', borderCollapse: 'collapse', marginBottom: '28px', fontSize: '14px' },
  th:      { padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' },
  td:      { padding: '11px 14px', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.04)', lineHeight: 1.55 },
  tdLabel: { padding: '11px 14px', color: '#c7d2fe', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.04)' },
  stepBox: { padding: '16px 20px', borderRadius: '10px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '10px', display: 'flex', gap: '14px', alignItems: 'flex-start' },
  stepNum: { minWidth: '28px', height: '28px', borderRadius: '50%', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: '#a5b4fc', flexShrink: 0 },
  stepBody:{ flex: 1 },
  stepT:   { fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' },
  stepD:   { fontSize: '13px', color: '#64748b', lineHeight: 1.6 },
  cta:     { background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(16,185,129,0.06) 100%)', border: '1px solid rgba(99,102,241,0.22)', borderRadius: '12px', padding: '28px 24px', margin: '36px 0', textAlign: 'center' },
  ctaH:    { fontSize: '19px', fontWeight: 800, color: '#f1f5f9', marginBottom: '10px', letterSpacing: '-0.01em' },
  ctaP:    { fontSize: '14px', color: '#94a3b8', lineHeight: 1.65, marginBottom: '20px', maxWidth: '480px', margin: '0 auto 20px' },
  ctaBtn:  { display: 'inline-block', padding: '11px 28px', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontWeight: 700, fontSize: '15px', textDecoration: 'none' },
  faqSection: { marginTop: '48px', paddingTop: '32px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  faqItem:    { marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  faqQ:       { fontSize: '15px', fontWeight: 600, color: '#c7d2fe', marginBottom: '8px' },
  faqA:       { fontSize: '14px', color: '#94a3b8', lineHeight: 1.75 },
  related: { marginTop: '36px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  relT:    { fontSize: '11px', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' },
  relLinks:{ display: 'flex', flexDirection: 'column', gap: '6px' },
  relLink: { fontSize: '14px', color: '#6366f1', textDecoration: 'none' },
}

const recordedItems = [
  'Gross earnings (tokens and/or USD)',
  'Estimated model payout after platform take',
  'Platform (Chaturbate, BongaCams, MyFreeCams, etc.)',
  'Tokens, when the platform pays in tokens rather than USD directly',
  'Private-show income, tracked separately from public tips',
  'Stream duration per session',
  'Earnings per hour streamed',
  'Top tippers, ranked by spend',
  'Daily, weekly, and monthly totals',
  'Business expenses, for models tracking profit and taxes',
]

const trackTable = [
  { metric: 'Total earnings', why: 'Measures overall revenue' },
  { metric: 'Hours streamed', why: 'Shows how much time was worked' },
  { metric: 'Earnings per hour', why: 'Identifies your most profitable sessions' },
  { metric: 'Platform', why: 'Compares performance across the sites you stream on' },
  { metric: 'Top tippers', why: 'Shows how concentrated your revenue is' },
  { metric: 'Private-show earnings', why: 'Separates private income from public tips' },
  { metric: 'Expenses', why: 'Needed for accurate profit and tax records' },
]

const dimensions = [
  { title: 'By session', desc: "Total earnings per stream, plus $/hr for that session. A 2-hour session earning $80 ($40/hr) is a better result than a 5-hour session earning $120 ($24/hr) — even though the second number looks bigger on its own." },
  { title: 'By hour of day', desc: 'Which hours actually produce your highest $/hr, not just which hours you happen to stream most. Your personal peak window is often different from platform-wide "best hours" advice.' },
  { title: 'By platform', desc: 'If you stream on more than one site, a bad week on one platform can drag your total down even while another is performing fine. Tracking $/hr per platform separately shows you where to spend more time.' },
  { title: 'By fan', desc: "Most income is concentrated in a small number of high-value regulars. Tracking spend per fan shows you who's actually driving your revenue — and lets you catch it early when one of them goes quiet." },
]

export default function CamModelIncomeTracker() {
  return (
    <ArticleLayout
      schema={[schema, faqSchema]}
      breadcrumb={[{ label: 'Guides', href: '/guides' }, { label: 'Cam Model Income Tracker' }]}
    >
      <div style={s.meta}>
        <span>CamCashGrl team</span>
        <span>Updated July 2026</span>
        <span>6 min read</span>
      </div>

      <h1 style={s.h1}>Cam Model Income Tracker</h1>

      <p style={s.intro}>
        Tracking total monthly tokens tells you almost nothing. CamCash tracks your cam income by session, hour of day, platform, and individual fan — so you can see your real earnings per hour, identify your peak windows, and know which fans are responsible for most of your income. Upload your CSV to get started.
      </p>

      <div style={{ margin: '0 0 32px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
        <img
          src="/blog-images/camcash-platform-comparsion-dashboard.png"
          alt="Cam model income tracker dashboard showing earnings by platform, stream session, and top tipper"
          style={{ width: '100%', display: 'block' }}
        />
      </div>

      <h2 style={s.h2}>What Is a Cam Model Income Tracker?</h2>
      <p style={s.p}>
        A cam model income tracker is a tool — a spreadsheet, an app, or an automated dashboard — that records your streaming earnings in enough detail to actually analyze them, instead of just totaling them up. At minimum, that means recording:
      </p>
      <ul style={s.ul}>
        {recordedItems.map((item, i) => <li key={i} style={s.li}>{item}</li>)}
      </ul>
      <p style={s.p}>
        Some models do this in a spreadsheet, some use a per-platform export, and some use an automated tool like CamCash. The right choice depends on how much manual entry you're willing to do versus how much you want calculated for you automatically — more on that trade-off below.
      </p>

      <h2 style={s.h2}>What Should Cam Models Track?</h2>
      <p style={s.p}>Not every number matters equally. These are the ones that actually change what you do next:</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Metric</th>
              <th style={s.th}>Why It Matters</th>
            </tr>
          </thead>
          <tbody>
            {trackTable.map(({ metric, why }, i) => (
              <tr key={i}>
                <td style={s.tdLabel}>{metric}</td>
                <td style={s.td}>{why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={s.statGrid}>
        <div style={s.statCard}>
          <div style={s.statVal}>4</div>
          <div style={s.statLbl}>Dimensions tracked</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statVal}>&lt;2 min</div>
          <div style={s.statLbl}>CSV upload to first insights</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statVal}>Free</div>
          <div style={s.statLbl}>No card required</div>
        </div>
      </div>

      <h2 style={s.h2}>Why a Monthly Total Isn't Enough</h2>
      <p style={s.p}>
        A single number at the end of the month tells you what happened, but never why. It can't tell you whether last Tuesday's session underperformed because of the hour, the platform, or because your top fan didn't show up. Without a breakdown, every good or bad month feels like a coin flip instead of something you can actually improve on.
      </p>

      <h2 style={s.h2}>The 4 Things Worth Tracking</h2>
      {dimensions.map(({ title, desc }, i) => (
        <div key={i} style={s.card}>
          <div style={s.cardH}>
            <div style={s.cardT}>{i + 1}. {title}</div>
          </div>
          <div style={s.cardB}>
            <p style={{ ...s.p, marginBottom: 0 }}>{desc}</p>
          </div>
        </div>
      ))}

      <h2 style={s.h2}>How to Track This Manually With a Spreadsheet</h2>
      <p style={s.p}>
        You can build this yourself from your platform's tip history export. Here's the manual version of what CamCash automates:
      </p>

      {[
        { n: '1', t: 'Export your tip history CSV', d: 'From each platform you stream on — Chaturbate, BongaCams, MyFreeCams, etc. Most broadcaster dashboards let you download a timestamped history of every tip.' },
        { n: '2', t: 'Tag every row with session, hour, and platform', d: 'Group each tip by which stream it happened in, the hour it came in, and which site it came from.' },
        { n: '3', t: 'Sum earnings and divide by hours streamed', d: 'This gives you $/hr for each session, hour window, and platform — the metric that actually matters, not just totals.' },
        { n: '4', t: 'Group by username to find top fans', d: 'Sort by lifetime spend to see who your highest-value regulars are and how often they typically tip.' },
        { n: '5', t: 'Refresh every few weeks', d: 'Peak hours and top fans shift over time, so re-run the breakdown every 2–3 months rather than treating one month’s numbers as permanent.' },
      ].map(({ n, t, d }) => (
        <div key={n} style={s.stepBox}>
          <div style={s.stepNum}>{n}</div>
          <div style={s.stepBody}>
            <div style={s.stepT}>{t}</div>
            <div style={s.stepD}>{d}</div>
          </div>
        </div>
      ))}

      <p style={{ ...s.p, marginTop: '16px' }}>
        For the hour-of-day piece specifically, see <a href="/guides/chaturbate-best-hours" style={s.iLink}>best hours to stream on Chaturbate</a>. For converting tokens to USD across platforms, see the <a href="/guides/cam-model-token-calculator" style={s.iLink}>cam model token calculator</a>.
      </p>

      <h2 style={s.h2}>Spreadsheet vs. Automated Cam Income Tracker</h2>
      <p style={s.p}>
        Neither approach is strictly better — they're good at different things:
      </p>
      <ul style={s.ul}>
        <li style={s.li}><strong style={{ color: '#e2e8f0' }}>Spreadsheets are flexible but require manual entry.</strong> You can add any custom column you want — expense categories, mileage, equipment costs — but you have to type or paste every row in yourself, every time.</li>
        <li style={s.li}><strong style={{ color: '#e2e8f0' }}>CamCash imports platform data</strong> directly from your CSV export, so session, hour, platform, and fan breakdowns are calculated automatically instead of built by hand.</li>
        <li style={s.li}><strong style={{ color: '#e2e8f0' }}>Spreadsheets are still useful for expenses and tax categories</strong> — that kind of freeform bookkeeping is exactly what they're built for.</li>
        <li style={s.li}><strong style={{ color: '#e2e8f0' }}>CamCash is better for fan behavior, session patterns, and platform comparisons</strong> — the analysis that requires crunching hundreds of timestamped rows, which is slow and error-prone by hand.</li>
      </ul>
      <p style={s.p}>
        Most models end up using both: CamCash for earnings analysis, a simple spreadsheet for expenses and tax prep. See <a href="/blog/cam-model-self-employment-tax-prep" style={s.iLink}>cam model self-employment tax prep</a> for what to track for that side of it.
      </p>

      <h2 style={s.h2}>How CamCash Automates Your Income Tracking</h2>
      <p style={s.p}>
        The manual version above works, but it means rebuilding the same spreadsheet every month. CamCash does it from a single CSV upload:
      </p>
      <ul style={s.ul}>
        <li style={s.li}>Session-by-session earnings and $/hr, calculated automatically from your upload</li>
        <li style={s.li}>Peak earning hours ranked by $/hr, not just total tips received</li>
        <li style={s.li}>Platform comparison if you stream on more than one site</li>
        <li style={s.li}>Top fans ranked by lifetime spend, with alerts when a regular goes quiet</li>
      </ul>
      <p style={s.p}>
        See <a href="/blog/why-cam-income-is-inconsistent" style={s.iLink}>why cam income is inconsistent</a> for the most common patterns this kind of tracking uncovers, and how to fix each one.
      </p>

      <div style={s.cta}>
        <div style={s.ctaH}>Track My Income →</div>
        <p style={s.ctaP}>
          Upload your CSV and see your earnings broken down by session, hour, platform, and fan — free, in under two minutes.
        </p>
        <a href="/dashboard" style={s.ctaBtn}>Track My Income →</a>
      </div>

      <div style={s.faqSection}>
        <h2 style={{ ...s.h2, marginTop: 0 }}>Cam Model Income Tracker FAQ</h2>

        <div style={s.faqItem}>
          <div style={s.faqQ}>What is the best way to track cam model income?</div>
          <p style={{ ...s.faqA, marginBottom: 0 }}>
            Track it at four levels: per session, per hour of day, per platform, and per fan. A single monthly total tells you that you earned a number — it never tells you why. Breaking earnings down across those four dimensions is what turns raw tip history into decisions you can act on.
          </p>
        </div>

        <div style={s.faqItem}>
          <div style={s.faqQ}>Do I need a spreadsheet to track cam income, or is there a free tool?</div>
          <p style={{ ...s.faqA, marginBottom: 0 }}>
            A spreadsheet works, but it requires manually exporting CSVs from each platform and rebuilding the same formulas every month. <a href="/landing" style={s.iLink}>CamCash</a> automates this — upload your CSV once and it calculates session earnings, $/hr by time of day, platform comparison, and top-fan spend automatically.
          </p>
        </div>

        <div style={s.faqItem}>
          <div style={s.faqQ}>Should I use a spreadsheet or an automated tracker like CamCash?</div>
          <p style={{ ...s.faqA, marginBottom: 0 }}>
            It depends what you're tracking. Spreadsheets are still the more flexible option for business expenses and tax categories, since they're built for arbitrary custom columns. CamCash is better suited to fan behavior, session patterns, and platform comparisons — the parts that require analyzing hundreds of timestamped rows, which is tedious by hand.
          </p>
        </div>

        <div style={s.faqItem}>
          <div style={s.faqQ}>Should I track income in tokens or USD?</div>
          <p style={{ ...s.faqA, marginBottom: 0 }}>
            USD, whenever your platform gives you a payout figure — it's the real source of truth. Use your platform's token-to-dollar rate as a fallback only when a USD figure isn't available, since that rate can vary by platform and payout tier.
          </p>
        </div>

        <div style={s.faqItem}>
          <div style={s.faqQ}>How often should I review my income tracking data?</div>
          <p style={{ ...s.faqA, marginBottom: 0 }}>
            Weekly for session and hourly patterns, and every 2–3 months for peak-hour and platform-allocation decisions, since audience behavior shifts over time.
          </p>
        </div>
      </div>

      <div style={s.related}>
        <div style={s.relT}>Related guides</div>
        <div style={s.relLinks}>
          <a href="/guides/chaturbate-best-hours" style={s.relLink}>→ Best hours to stream on Chaturbate</a>
          <a href="/guides/cam-model-token-calculator" style={s.relLink}>→ Free cam model token calculator</a>
          <a href="/guides/chaturbate-earnings-tracker" style={s.relLink}>→ Chaturbate earnings tracker</a>
          <a href="/guides/cam-model-top-tippers" style={s.relLink}>→ Cam model top tipper tracker</a>
          <a href="/blog/why-cam-income-is-inconsistent" style={s.relLink}>→ Why cam income is inconsistent (and how to fix it)</a>
          <a href="/blog/cam-model-earnings" style={s.relLink}>→ Cam model earnings: the complete guide</a>
        </div>
      </div>
    </ArticleLayout>
  )
}

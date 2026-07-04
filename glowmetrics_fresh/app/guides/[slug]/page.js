// app/guides/[slug]/page.js
// 12 keyword-targeted pages. Each one ranks for a specific search term
// and converts visitors directly to signups.
import Button from '../../../components/ui/Button'

const BASE = 'https://www.camcashgrl.com'

const GUIDES = {
  'chaturbate-earnings-tracker': {
    title: 'Chaturbate Earnings Tracker — Free Tool for Broadcasters',
    description: 'Track your Chaturbate tips, tokens, and hourly earnings automatically. See your best days, top fans, and peak hours in one dashboard.',
    ogTitle: 'Chaturbate Earnings Tracker (Free)',
    twitterTitle: 'Free Chaturbate Earnings Tracker',
    h1: 'Chaturbate Earnings Tracker',
    intro: 'CamCash is the easiest way to track your Chaturbate earnings. Upload your token history CSV and instantly see your total revenue, top fans, best streaming hours, and personalized tips to earn more — all free.',
    sections: [
      {
        h2: 'What You Can Track',
        body: 'Upload your Chaturbate token CSV to instantly see: total tokens earned and their USD value, your top tippers ranked by lifetime spend, peak earning hours across all your streams, best days of the week, session-by-session breakdowns with timeline analysis, and which fans are at risk of going cold.',
      },
      {
        h2: 'How to Export Your Chaturbate Data',
        body: 'Log in to Chaturbate → go to your model account → Stats & Data → Token Stats → select your date range → click Download CSV. Upload that file to CamCash and your entire earning history is analyzed instantly. No API key, no account access — just your CSV file.',
      },
      {
        h2: 'Insights You Get Immediately',
        body: 'CamCash shows you which fans contribute most to your income (whale detection), what time of day you earn the most on Chaturbate specifically, which day of the week performs best, and specific recommendations like "go live on Saturdays at 2 AM — that\'s your peak window based on your data."',
      },
      {
        h2: 'Why Token-to-USD Accuracy Matters',
        body: 'CamCash uses the correct Chaturbate payout rate ($0.05/token for broadcasters) and lets you adjust this in settings if your rate differs. Every dollar figure you see is your actual take-home — not Chaturbate\'s gross revenue figure.',
      },
    ],
    cta: 'Track Your Chaturbate Earnings Free',
  },

  'cam-model-analytics': {
    title: 'Cam Model Analytics Dashboard — Free for CB, BC & MFC',
    description: 'Analytics built for cam models on Chaturbate, BongaCams and MyFreeCams. See what\'s working, who your whales are, and when to go live.',
    ogTitle: 'Cam Model Analytics — Free Dashboard',
    twitterTitle: 'Cam Model Analytics Dashboard',
    h1: 'Cam Model Analytics Dashboard',
    intro: 'CamCash turns your raw earnings data into clear, actionable insights. Know exactly when to go live, which fans to focus on, and what\'s actually driving your income — without guesswork.',
    sections: [
      {
        h2: 'Works With Every Major Platform',
        body: 'CamCash supports Chaturbate, BongaCams, MyFreeCams, CamSoda, and Stripchat. Upload your CSV from any platform and see your full earnings picture in one place. Multi-platform comparison shows you where your time is most valuable — most models find one platform earns 3–6x more per hour than the other.',
      },
      {
        h2: 'Fan Intelligence — Whale Detection',
        body: 'Know exactly who your highest-value fans are, when they\'re most likely to be online, and how to keep them engaged. CamCash identifies your top spenders, tracks their tipping patterns, shows their churn risk, and generates personalized re-engagement messages when a high-value fan goes quiet.',
      },
      {
        h2: 'Session Breakdown',
        body: 'After every stream, CamCash shows a full breakdown: a timeline of when tips came in (5-minute buckets), which fans drove the most revenue, your peak earning moment, velocity trends (was your pace growing or dying?), and specific recommendations for what to do differently next time.',
      },
      {
        h2: 'Dependency Risk Alerts',
        body: 'If one fan is driving 50%+ of your income, CamCash flags it. Knowing your revenue concentration helps you diversify your audience before a key tipper disappears — the most common cause of sudden income drops for cam models.',
      },
    ],
    cta: 'Get Free Cam Model Analytics',
  },

  'how-to-increase-cam-tips': {
    title: 'How to Increase Cam Tips — What the Data Actually Shows',
    description: 'Data-backed strategies to get more tips per stream. Best goal sizes, timing, room title formulas, and fan engagement tactics that work.',
    ogTitle: 'How to Increase Cam Tips (Data-Backed)',
    twitterTitle: 'Increase Cam Tips',
    h1: 'How to Increase Cam Tips',
    intro: 'The fastest way to increase cam tips is to understand what\'s already working in your data — and do more of it. CamCash analyzes your earning history to give you personalized, data-backed strategies instead of generic advice.',
    sections: [
      {
        h2: 'Stream at Your Real Peak Hours',
        body: 'Most cam models have 2–3 hours per day when they earn significantly more than average. CamCash identifies your exact peak windows from your tip history. Going live consistently during these hours can increase your hourly earnings by 30–60% without changing anything else.',
      },
      {
        h2: 'Focus on Your High-Value Fans',
        body: 'In most accounts, 10–20% of fans generate 60–80% of revenue. CamCash identifies these "whales" automatically and tells you when they\'re likely to be online based on their historical tip patterns, how long since they last tipped, and exactly how to re-engage them with a personalized message.',
      },
      {
        h2: 'Use the Viral Room Title Formula',
        body: 'CamCash\'s Room Title Generator uses the Hook + Goal + Reward + Urgency formula proven to drive clicks and tips. It adapts to your toy (Lush, Domi, etc.), your token goal, and your stream mood to produce titles like "tip to control my Lush 🎮 → hit 500 = I lose control 😈 (tonight only)" instead of generic placeholder text.',
      },
      {
        h2: 'Understand Your Session Patterns',
        body: 'CamCash shows whether you earn more in the first or second half of streams, which fan contributed most to each session, your revenue velocity (is money coming in faster or slower as the stream goes on), and whether extending your stream would increase earnings based on your data.',
      },
      {
        h2: 'Pre-Tip Behavior Analysis',
        body: 'CamCash detects when in your streams tips tend to cluster. If your data shows most tips come 20–30 minutes into the stream, it tells you "don\'t end before this window." If tips cluster in bursts, it flags clustering behavior and suggests how to trigger more momentum.',
      },
    ],
    cta: 'See What\'s Working in Your Data',
  },

  'bongacams-analytics': {
    title: 'BongaCams Analytics — Free Earnings Tracker for Models',
    description: 'Track your BongaCams tips, top fans, and hourly earnings. Free analytics dashboard built specifically for BongaCams broadcasters.',
    ogTitle: 'BongaCams Analytics — Free Tracker',
    twitterTitle: 'BongaCams Analytics Tool',
    h1: 'BongaCams Analytics Dashboard',
    intro: 'CamCash gives you full analytics for your BongaCams earnings. Upload your transaction history CSV and instantly see your top fans, peak earning hours, and how BongaCams compares to Chaturbate or your other platforms.',
    sections: [
      {
        h2: 'How to Export Your BongaCams Data',
        body: 'Log in to your BongaCams model account → go to Statistics → Earnings History → select your date range → click Export. Upload the CSV file to CamCash for instant analysis. BongaCams exports in USD so no token conversion is needed.',
      },
      {
        h2: 'BongaCams vs Chaturbate — Real Comparison',
        body: 'If you stream on both platforms, CamCash shows you exactly how they compare: revenue per hour, average tip size, best performing days, and top fans on each platform. Most models discover one platform earns 3–5x more per hour than the other — knowing which one lets you shift your time strategically.',
      },
      {
        h2: 'BongaCams Peak Hours',
        body: 'BongaCams has a different audience than Chaturbate — European viewers, different time zones, different tipping behavior. CamCash computes your actual peak hours on BongaCams separately from your other platforms so you can schedule your streams to match your real audience, not generic advice.',
      },
      {
        h2: 'Fan Loyalty on BongaCams',
        body: 'CamCash tracks which BongaCams fans have tipped 3+ times, their lifetime value, and their risk of going cold. The fan loyalty stat shows you how sticky your BongaCams audience is compared to your other platforms.',
      },
    ],
    cta: 'Analyze Your BongaCams Earnings Free',
  },

  'best-time-to-stream-chaturbate': {
    title: 'Best Time to Stream on Chaturbate in 2026 — Peak Hours',
    description: 'When are the most viewers and tippers online on Chaturbate? Data on peak streaming windows by day, hour, and audience type.',
    ogTitle: 'Best Time to Stream on Chaturbate 2026',
    twitterTitle: 'Best Chaturbate Streaming Times',
    h1: 'Best Time to Stream on Chaturbate',
    intro: 'There\'s no universal "best time" to stream on Chaturbate — it depends entirely on your specific audience. CamCash analyzes your actual tip history to find the hours and days when your viewers are most active and spending.',
    sections: [
      {
        h2: 'Why Peak Hours Are Personal',
        body: 'Your top fans have their own schedules. A model whose biggest tippers are in Europe will have completely different peak hours than one with a US-based audience. CamCash finds your personal peak windows from your data — not generic advice based on average Chaturbate traffic.',
      },
      {
        h2: 'How CamCash Finds Your Peak Time',
        body: 'Upload your Chaturbate CSV and CamCash groups all your tips by UTC hour of day across every session. It then shows you exactly which hours average the highest revenue per active streaming day — accounting for session length so you get accurate earnings per hour, not inflated totals from long sessions.',
      },
      {
        h2: 'Real-Time Peak Alerts',
        body: 'Once CamCash knows your peak hours from your data, it shows live alerts in the dashboard when you\'re approaching your highest-earning window. If your best hour is 2 AM and it\'s 1:30 AM, you\'ll see: "Your peak earning hour starts in 30 minutes — go live now."',
      },
      {
        h2: 'Best Day of the Week',
        body: 'CamCash also identifies your best day of the week per platform. For many models it\'s Saturday on Chaturbate — but your specific data might show Monday is your highest-earning day. CamCash shows you the actual avg per active streaming day so high-session days don\'t skew the numbers.',
      },
    ],
    cta: 'Find Your Personal Peak Hours Free',
  },

  'cam-model-top-tippers': {
    title: 'Cam Model Top Tipper Tracker — Free Tool (Free)',
    description: 'See who your biggest tippers are across all platforms, when they last showed up, and which ones are overdue. Free fan tracker for cam models.',
    ogTitle: 'Top Tipper Tracker for Cam Models',
    twitterTitle: 'Cam Model Top Tipper Tracker',
    h1: 'Cam Model Top Tipper Tracker',
    intro: 'Knowing who your most valuable fans are and understanding their behavior is the highest-leverage thing a cam model can do to increase income. CamCash tracks every tipper across your history and gives you a complete picture.',
    sections: [
      {
        h2: 'Whale Detection',
        body: 'CamCash automatically identifies your "whales" — fans whose lifetime spend puts them in the top 5% of your audience. These fans often generate 40–60% of total revenue. Keeping them engaged is more valuable than finding new fans. CamCash shows their tier (Whale, Shark, Regular), last tip date, churn risk level, and predicted next tip timing.',
      },
      {
        h2: 'Fan Behavior Patterns',
        body: 'For each top fan, CamCash shows: total lifetime spend, number of tips, average tip size, days since last tip, their typical active hours (so you know when to go live to catch them), their churn risk level, and their spending velocity compared to your average fan.',
      },
      {
        h2: 'Re-engagement Messages',
        body: 'When a top tipper hasn\'t appeared in longer than their typical interval, CamCash generates a personalized re-engagement message tailored to their behavior. Big single-tippers get different messages than frequent micro-tippers. Fans who\'ve done private shows get different messages than tip-note fans.',
      },
      {
        h2: 'Dependency Risk',
        body: 'CamCash shows what percentage of your total revenue comes from your top 1, 3, and 5 fans. If one fan accounts for 50%+ of your income, you\'ll see a high-risk alert: "If this fan leaves, you lose half your revenue." This motivates audience diversification before it\'s a crisis.',
      },
    ],
    cta: 'See Your Top Fans Free',
  },

  'cam-model-income-tracker': {
    title: 'Cam Model Income Tracker — Free Tool for 2026',
    description: 'Track your cam model income across platforms automatically. See monthly trends, platform comparison, and hourly rate over time.',
    ogTitle: 'Cam Model Income Tracker (Free)',
    twitterTitle: 'Free Cam Model Income Tracker',
    h1: 'Cam Model Income Tracker',
    intro: 'CamCash is a free income tracker built specifically for cam models. Upload CSVs from any platform and get a complete picture of your earnings — by day, by session, by platform, and by fan.',
    sections: [
      {
        h2: 'Multi-Platform Income Tracking',
        body: 'Combine earnings from Chaturbate, BongaCams, MyFreeCams, CamSoda, and Stripchat into one dashboard. CamCash deduplicates imports automatically, so you can upload frequently without double-counting. The platform comparison shows you $/hour on each platform so you can see where your time is most valuable.',
      },
      {
        h2: 'Session-Level Breakdown',
        body: 'Every stream gets a full breakdown: total earned, revenue per minute, which fans contributed most, your peak earning moment in the session, velocity trend (momentum building or dying?), and a recommendation for what to do differently next time. This is what "what happened in my stream" actually looks like as data.',
      },
      {
        h2: 'Revenue Predictions',
        body: 'Based on your earning history, CamCash predicts what you\'re likely to earn in the next 7 and 30 days, and estimates tonight\'s stream earnings based on what you\'ve earned on the same day of the week historically. Predictions include confidence levels based on how much data you have.',
      },
      {
        h2: 'Configurable Token Rates',
        body: 'CamCash lets you set the token-to-USD rate per platform in Settings. This matters because Chaturbate\'s broadcaster rate ($0.05/token) differs from Stripchat and others. Every dollar figure you see reflects your actual payout, not the platform\'s gross.',
      },
    ],
    cta: 'Track Your Income Free',
  },

  'myfreecams-analytics': {
    title: 'MyFreeCams Analytics — Free Earnings Tracker for MFC',
    description: 'Track your MyFreeCams tips, top fans, and best streaming times. Free analytics dashboard built for MFC broadcasters.',
    ogTitle: 'MyFreeCams Analytics — Free Tracker',
    twitterTitle: 'MyFreeCams Analytics Tool',
    h1: 'MyFreeCams (MFC) Analytics',
    intro: 'CamCash supports MyFreeCams CSV exports. Upload your MFC token history and get the same deep analytics available for Chaturbate and BongaCams — top fans, peak hours, session breakdowns, and earning recommendations.',
    sections: [
      {
        h2: 'How to Export Your MFC Data',
        body: 'Log in to your MFC model account → go to Model Admin → Token Stats → Transaction History → select your date range → click Export CSV. Upload to CamCash for instant analysis. MFC uses the same token system as Chaturbate so token-to-USD conversion is handled automatically.',
      },
      {
        h2: 'MFC vs Other Platforms',
        body: 'If you stream on multiple platforms, CamCash shows you how MFC compares to Chaturbate and BongaCams in terms of revenue per hour, average tip size, and audience loyalty. Most models find their earnings vary dramatically by platform.',
      },
      {
        h2: 'MFC Fan Loyalty',
        body: 'MyFreeCams has a different audience dynamic than Chaturbate — MFC fans tend to be more regular and relationship-driven. CamCash identifies your most loyal MFC fans and shows you who is at risk of going cold, so you can reach out before they do.',
      },
    ],
    cta: 'Analyze Your MFC Earnings Free',
  },

  'chaturbate-token-tracker': {
    title: 'Chaturbate Token Tracker — See Every Tip in One Place',
    description: 'Track every Chaturbate token tip automatically. See your top tippers, tip frequency, and token totals without any manual logging.',
    ogTitle: 'Chaturbate Token Tracker (Free)',
    twitterTitle: 'Free Chaturbate Token Tracker',
    h1: 'Chaturbate Token Tracker',
    intro: 'CamCash automatically converts Chaturbate tokens to USD at the correct broadcaster rate and gives you a complete picture of your earnings by fan, session, hour, and day — no spreadsheets required.',
    sections: [
      {
        h2: 'Token to USD Conversion',
        body: 'Every token in your upload is automatically converted to USD at the standard Chaturbate broadcaster rate ($0.05/token). You see both your token totals and USD earnings side by side. The rate is configurable in Settings if your account has a different rate negotiated with Chaturbate.',
      },
      {
        h2: 'Who Sent the Most Tokens',
        body: 'CamCash ranks all your tippers by total tokens sent across your entire history. See your all-time top 10, how much each one has spent in USD, their average tip size, the last time they tipped, and their churn risk level.',
      },
      {
        h2: 'Token Flow by Session',
        body: 'Every session gets a timeline showing exactly when tokens came in — broken into 5-minute buckets. See your peak earning moment in each stream, what percentage of tokens came in the first vs second half, and which fan drove the most tokens in that session.',
      },
      {
        h2: 'Token Goal Analytics',
        body: 'CamCash tracks how often you hit your token goals and what your average session earns. The Room Title Generator uses this to create goal-based titles like "hit 500 → I react instantly" that are calibrated to your realistic earning pace.',
      },
    ],
    cta: 'Track Your Chaturbate Tokens Free',
  },

  'cam-model-revenue-dashboard': {
    title: 'Cam Model Revenue Dashboard — Free Multi-Platform Tool',
    description: 'One dashboard for all your cam model revenue across Chaturbate, BongaCams and MFC. Track earnings, compare platforms, spot trends.',
    ogTitle: 'Cam Model Revenue Dashboard (Free)',
    twitterTitle: 'Cam Model Revenue Dashboard',
    h1: 'Cam Model Revenue Dashboard',
    intro: 'CamCash is the analytics dashboard cam models actually need. Not generic social media analytics — earnings-specific insights that answer: where is my money coming from, when should I be live, and what do I do to earn more.',
    sections: [
      {
        h2: 'Everything in One Place',
        body: 'Overview stats, platform comparison, top fan profiles with behavior patterns, session breakdowns with timeline analysis, revenue velocity tracking, pre-tip behavior patterns, dependency risk alerts, live intelligence alerts, revenue predictions, and personalized recommendations — all driven by your CSV data from any cam platform.',
      },
      {
        h2: 'No Complicated Setup',
        body: 'There\'s no API to connect, no platform permissions to grant, no browser extension to install. Just export your CSV from Chaturbate or BongaCams, upload it to CamCash, and your full dashboard is ready in seconds.',
      },
      {
        h2: 'Decision Engine, Not Just Analytics',
        body: 'CamCash is designed to tell you what to DO — not just show you numbers. Every insight comes with a recommendation. "You earned 70% of your revenue in the first half of this stream" is followed by "open with a strong token goal immediately." "Your top fan hasn\'t tipped in 12 days" generates a re-engagement message.',
      },
      {
        h2: 'Privacy First',
        body: 'Your earnings data is stored securely in your account only. It\'s never shared, sold, or visible to anyone else. CamCash has no access to your cam platform account — everything goes through your exported CSV file.',
      },
    ],
    cta: 'Open Your Free Dashboard',
  },

  'cam-model-session-breakdown': {
    title: 'Cam Model Session Breakdown — What Happened Each Stream',
    description: 'See exactly what happened during every stream — tips timeline, whale activity, earnings per hour, and what to do differently next time.',
    ogTitle: 'Cam Model Session Breakdown Tool',
    twitterTitle: 'Cam Model Session Breakdown',
    h1: 'Cam Model Session Breakdown',
    intro: 'CamCash\'s session breakdown answers the question every cam model has after going offline: what actually happened in that stream and how do I earn more next time?',
    sections: [
      {
        h2: 'Timeline Analysis',
        body: 'Every session is broken into 5-minute buckets showing exactly when money came in. The timeline bar chart shows your peak earning moment highlighted in gold, slow periods, and tip spikes. You can see at a glance whether your stream front-loaded, back-loaded, or stayed consistent.',
      },
      {
        h2: 'Revenue Velocity',
        body: 'CamCash computes your earnings per minute for the first half and second half of every session. If your pace dropped 25%+ in the second half, it flags "earnings slowing" with a percentage change. If your second half outperformed the first, it shows "momentum building +40% vs first half."',
      },
      {
        h2: 'Top Contributors',
        body: 'For every session, CamCash ranks the top 3 fans by USD contribution with their percentage of total session revenue. If one fan drove 60%+ of a session, you\'ll see an orange concentration warning so you know to diversify in future streams.',
      },
      {
        h2: 'Revenue Gap vs Your Average',
        body: 'Every session card shows whether you outperformed or underperformed your historical average. "⚠️ $38 below your avg session ($90) — 42% shortfall" gives you a concrete number for how much a poor session cost you, making it real instead of abstract.',
      },
    ],
    cta: 'See Your Session Breakdown Free',
  },

  'chaturbate-best-hours': {
    title: 'Chaturbate Best Hours to Stream — Data by Day & Time',
    description: 'Which hours actually perform best on Chaturbate? Real data on peak tipping windows, best days of the week, and when whales show up.',
    ogTitle: 'Chaturbate Best Hours to Stream',
    twitterTitle: 'Chaturbate Best Streaming Hours',
    h1: 'Chaturbate Best Hours to Stream',
    intro: 'The best hours to stream on Chaturbate are different for every model. CamCash finds yours by analyzing every tip in your earning history and showing you exactly which hours generate the most revenue per active streaming day.',
    sections: [
      {
        h2: 'Your Data vs Generic Advice',
        body: 'Generic advice says "stream at 9 PM EST." Your data might say 2 AM UTC is your highest-earning hour — because that\'s when your actual top tippers are active. CamCash shows you the real numbers: avg USD per active streaming day at each hour, computed from your entire tip history in UTC.',
      },
      {
        h2: 'How the Heatmap Works',
        body: 'CamCash builds a 24-hour heatmap for each platform showing total earnings by hour. Darker cells = more money. The heatmap uses individual tip timestamps, not session start times, so the numbers accurately reflect when money came in rather than when you clicked Go Live.',
      },
      {
        h2: 'Live Peak Alerts',
        body: 'Once your peak hours are known, CamCash shows live alerts in the dashboard. "Your peak earning hour is 2 AM — go live now" or "Peak hour in 45 minutes — prep your stream." These fire in the Live Intelligence panel on the Overview tab whenever you\'re approaching your best window.',
      },
    ],
    cta: 'Find Your Best Hours Free',
  },
}

export async function generateStaticParams() {
  return Object.keys(GUIDES).map(slug => ({ slug }))
}

export async function generateMetadata({ params }) {
  const guide = GUIDES[params.slug]
  if (!guide) return { title: 'Guide Not Found | CamCash' }
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `${BASE}/guides/${params.slug}` },
    openGraph: {
      title: guide.ogTitle || guide.title,
      description: guide.description,
      url: `${BASE}/guides/${params.slug}`,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: guide.twitterTitle || guide.title,
      description: guide.description,
    },
  }
}

export default function GuidePage({ params }) {
  const guide = GUIDES[params.slug]

  if (!guide) {
    return (
      <div style={{ padding: 40, color: 'white', background: '#05070f', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
        <h1 style={{ color: 'white' }}>Guide not found</h1>
        <a href="/landing" style={{ color: '#22D3EE' }}>← Back to CamCash</a>
      </div>
    )
  }

  const s = {
    page: { background: '#05070f', minHeight: '100vh', color: '#94A3B8', fontFamily: 'Inter, sans-serif' },
    nav: { padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    logo: { fontWeight: 700, fontSize: 15, color: 'white', textDecoration: 'none', letterSpacing: '-0.2px' },
    article: { maxWidth: 760, margin: '0 auto', padding: '60px 24px 100px' },
    breadcrumb: { marginBottom: 24, fontSize: 13 },
    breadLink: { color: '#22D3EE', textDecoration: 'none' },
    breadSep: { margin: '0 8px', color: '#475569' },
    h1: { fontSize: 40, fontWeight: 900, color: 'white', lineHeight: 1.15, marginBottom: 20, letterSpacing: '-0.02em' },
    intro: { fontSize: 18, lineHeight: 1.7, color: '#CBD5E1', marginBottom: 40, paddingLeft: 20, borderLeft: '3px solid #22D3EE' },
    ctaBanner: { padding: '20px 24px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(236,72,153,0.08))', border: '1px solid rgba(34,211,238,0.25)', marginBottom: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 },
    ctaText: { fontSize: 15, fontWeight: 600, color: 'white' },
    ctaBtn: { padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(135deg, #22D3EE, #EC4899)', color: 'white', fontWeight: 700, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap' },
    section: { marginBottom: 40 },
    h2: { fontSize: 24, fontWeight: 800, color: 'white', marginBottom: 12, letterSpacing: '-0.01em' },
    body: { fontSize: 16, lineHeight: 1.8, color: '#94A3B8' },
    bottomCta: { marginTop: 64, padding: '40px 32px', borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' },
    bottomH2: { fontSize: 28, fontWeight: 900, color: 'white', marginBottom: 10, letterSpacing: '-0.02em' },
    bottomP: { fontSize: 15, color: '#94A3B8', marginBottom: 28 },
    bottomBtn: { display: 'inline-block', padding: '14px 40px', borderRadius: 12, background: 'linear-gradient(135deg, #22D3EE, #EC4899)', color: 'white', fontWeight: 800, fontSize: 16, textDecoration: 'none', boxShadow: '0 0 40px rgba(34,211,238,0.25)' },
    related: { marginTop: 48 },
    relatedTitle: { fontSize: 15, color: '#475569', marginBottom: 14 },
    relatedLinks: { display: 'flex', flexWrap: 'wrap', gap: 10 },
    relatedLink: { padding: '6px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#22D3EE', fontSize: 13, textDecoration: 'none' },
    footer: { borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px 40px', textAlign: 'center' },
    footerText: { fontSize: 12, color: '#475569' },
  }

  const related = Object.entries(GUIDES)
    .filter(([slug]) => slug !== params.slug)
    .slice(0, 4)

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <a href="/landing" style={s.logo}>💜 CamCash</a>
        <Button as="a" href="/login" style={{ padding: '8px 20px', fontSize: 13 }}>Start Free →</Button>
      </nav>

      <article style={s.article}>
        <nav style={s.breadcrumb} aria-label="breadcrumb">
          <a href="/landing" style={s.breadLink}>Home</a>
          <span style={s.breadSep}>›</span>
          <a href="/landing#guides" style={s.breadLink}>Guides</a>
          <span style={s.breadSep}>›</span>
          <span style={{ color: '#475569' }}>{guide.h1}</span>
        </nav>

        <h1 style={s.h1}>{guide.h1}</h1>
        <p style={s.intro}>{guide.intro}</p>

        <div style={s.ctaBanner}>
          <div style={s.ctaText}>Free during beta — no credit card, no limits</div>
          <a href="/login" style={s.ctaBtn}>{guide.cta} →</a>
        </div>

        {guide.sections.map((section, i) => (
          <section key={i} style={s.section}>
            <h2 style={s.h2}>{section.h2}</h2>
            <p style={s.body}>{section.body}</p>
          </section>
        ))}

        <div style={s.bottomCta}>
          <h2 style={s.bottomH2}>Ready to see your data?</h2>
          <p style={s.bottomP}>Upload your first CSV in under 2 minutes. Free for cam models during beta.</p>
          <a href="/login" style={s.bottomBtn}>{guide.cta} →</a>
        </div>

        <div style={s.related}>
          <div style={s.relatedTitle}>Related guides</div>
          <div style={s.relatedLinks}>
            {related.map(([slug, g]) => (
              <a key={slug} href={`/guides/${slug}`} style={s.relatedLink}>{g.h1}</a>
            ))}
          </div>
        </div>
      </article>

      <footer style={s.footer}>
        <p style={s.footerText}>© 2026 CamCash — Built for cam models who want to grow</p>
      </footer>
    </div>
  )
}

// app/guides/[slug]/page.js
// 4 keyword-targeted pages. Each one ranks for a specific search term
// and converts visitors directly to signups.
//
// Note: several slugs that used to live here (chaturbate-earnings-tracker,
// cam-model-analytics, best-time-to-stream-chaturbate, cam-model-top-tippers,
// cam-model-income-tracker, chaturbate-token-tracker, cam-model-session-breakdown,
// chaturbate-best-hours) now have their own dedicated app/guides/<slug>/page.js
// route, which Next.js resolves ahead of this dynamic [slug] route. Their
// entries here were unreachable dead code and have been removed — the
// dedicated pages are the live, edited content for those URLs.
import Button from '../../../components/ui/Button'

import { notFound } from 'next/navigation'

const BASE = 'https://www.camcashgrl.com'

const GUIDES = {
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
    notFound()
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

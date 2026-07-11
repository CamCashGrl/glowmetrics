import TokenCalculatorClient from './TokenCalculatorClient'
import Button from '../../../components/ui/Button'

export const metadata = {
  title: 'Cam Model Token Calculator: Convert Tokens to USD Fast',
  description: 'Free cam model token calculator for converting Chaturbate, BongaCams, MyFreeCams, and Stripchat tokens into estimated USD.',
  keywords: 'token calculator, chaturbate token calculator, cam model token calculator, tokens to usd, how much are tokens worth, cam model earnings, broadcaster payout rate',
  alternates: { canonical: 'https://www.camcashgrl.com/guides/cam-model-token-calculator' },
  openGraph: {
    title: 'Cam Model Token Calculator: Convert Tokens to USD Fast',
    description: 'Free cam model token calculator for converting Chaturbate, BongaCams, MyFreeCams, and Stripchat tokens into estimated USD.',
    url: 'https://www.camcashgrl.com/guides/cam-model-token-calculator',
    type: 'article',
    images: [{ url: 'https://www.camcashgrl.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cam Model Token Calculator: Convert Tokens to USD Fast',
    description: 'Free cam model token calculator for converting Chaturbate, BongaCams, MyFreeCams, and Stripchat tokens into estimated USD.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
}

export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 5 }

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'How much is one Chaturbate token worth?', acceptedAnswer: { '@type': 'Answer', text: 'One Chaturbate token is worth $0.05 to the broadcaster. Viewers purchase tokens at $0.10 each, meaning Chaturbate keeps 50% and the model receives 50%.' } },
    { '@type': 'Question', name: 'How much does BongaCams pay per token?', acceptedAnswer: { '@type': 'Answer', text: 'BongaCams pays approximately $0.025 per token to broadcasters — half of Chaturbate\'s rate. Viewers buy BongaCams tokens at roughly $0.068 each, so the model receives about 37% of what the viewer pays.' } },
    { '@type': 'Question', name: 'What is the MyFreeCams token rate?', acceptedAnswer: { '@type': 'Answer', text: 'MyFreeCams pays approximately $0.05 per token (about $5.00 per 100 tokens). The exact rate can vary slightly based on model level and promotional periods.' } },
    { '@type': 'Question', name: 'How much does Stripchat pay per token?', acceptedAnswer: { '@type': 'Answer', text: 'Stripchat pays approximately $0.05 per token. Rates can vary based on model tier and payment method, so always check your current rate in your Stripchat dashboard.' } },
    { '@type': 'Question', name: 'What is CamSoda\'s token payout rate?', acceptedAnswer: { '@type': 'Answer', text: 'CamSoda pays approximately $0.055 per token — slightly higher than most competitors at the standard tier. This makes 1,000 CamSoda tokens worth about $55 versus $50 on Chaturbate.' } },
    { '@type': 'Question', name: 'Do cam models pay taxes on token earnings?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. In the United States, cam model earnings are self-employment income. You will typically receive a 1099-NEC from platforms paying over $600/year. You are responsible for self-employment tax (15.3%) plus income tax. Keep detailed records of all earnings, and consider quarterly estimated tax payments.' } },
    { '@type': 'Question', name: 'What is the difference between viewer rate and broadcaster rate?', acceptedAnswer: { '@type': 'Answer', text: 'The viewer rate is what fans pay to purchase tokens. The broadcaster rate is the lower amount models actually receive. For example, on Chaturbate viewers pay $0.10/token but models receive $0.05/token. This split funds platform operations.' } },
    { '@type': 'Question', name: 'How can I increase my per-token earnings?', acceptedAnswer: { '@type': 'Answer', text: 'The per-token rate itself is fixed by the platform, but you can increase total earnings by negotiating a higher rate directly with your platform after reaching high traffic milestones, optimizing tip menu pricing, and using platform bonuses or promotional rate periods.' } },
    { '@type': 'Question', name: 'How do I calculate my hourly rate as a cam model?', acceptedAnswer: { '@type': 'Answer', text: 'Divide your total USD earnings for a session by the number of hours you streamed. For example, if you earned 2,000 tokens in 2 hours on Chaturbate: 2,000 × $0.05 = $100 ÷ 2 hours = $50/hr. Tools like CamCash track this automatically.' } },
    { '@type': 'Question', name: 'Which cam platform pays models the most?', acceptedAnswer: { '@type': 'Answer', text: 'CamSoda has a slightly higher standard rate ($0.055/token vs $0.05). However, overall earnings depend more on audience size, tip menu strategy, and streaming hours than the per-token rate. The best platform is the one where your audience is largest.' } },
    { '@type': 'Question', name: 'What is a tip menu and how does it affect earnings?', acceptedAnswer: { '@type': 'Answer', text: 'A tip menu is a list of actions tied to specific token amounts (e.g., 50 tokens = song request, 500 tokens = special request). Well-priced tip menus increase average tip size and give viewers clear goals — which directly increases your token income.' } },
    { '@type': 'Question', name: 'How many tokens do top Chaturbate models earn per hour?', acceptedAnswer: { '@type': 'Answer', text: 'Top Chaturbate models can earn 5,000–50,000+ tokens per hour during peak sessions. Average active models typically earn 500–2,000 tokens per hour. Using analytics tools to identify your best streaming hours and highest-tipping fans can significantly improve your average.' } },
    { '@type': 'Question', name: 'What is the minimum payout on Chaturbate?', acceptedAnswer: { '@type': 'Answer', text: 'Chaturbate\'s minimum payout is $50. Payments are issued every two weeks. Most models with moderate traffic reach this threshold easily within a single streaming session.' } },
    { '@type': 'Question', name: 'Can I negotiate a higher token rate with Chaturbate?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, high-traffic models can contact Chaturbate\'s model support to negotiate a higher per-token rate. This is not publicly advertised. Having consistent high viewership and earnings history strengthens your negotiating position.' } },
    { '@type': 'Question', name: 'How does the 1099-NEC threshold work for cam models?', acceptedAnswer: { '@type': 'Answer', text: 'If a cam platform pays you $600 or more in a calendar year, they are required to issue a 1099-NEC. However, you must report ALL earnings regardless of whether you receive a 1099. Keep your own records throughout the year.' } },
    { '@type': 'Question', name: 'What deductions can cam models claim on taxes?', acceptedAnswer: { '@type': 'Answer', text: 'Common deductions include: home office (dedicated streaming space), equipment (camera, lighting, microphone, computer), costumes and accessories used exclusively for work, platform fees, internet service, subscription services used for content, and professional services like accountants.' } },
  ],
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.camcashgrl.com' },
    { '@type': 'ListItem', position: 2, name: 'Guides', item: 'https://www.camcashgrl.com/guides' },
    { '@type': 'ListItem', position: 3, name: 'Token Calculator', item: 'https://www.camcashgrl.com/guides/cam-model-token-calculator' },
  ],
}

const appSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Cam Model Token Calculator',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  description: 'Free token to USD calculator for cam models. Supports Chaturbate, BongaCams, MyFreeCams, Stripchat, and CamSoda.',
  url: 'https://www.camcashgrl.com/guides/cam-model-token-calculator',
}

const S = {
  bg: '#14171C',
  surface: '#1C2028',
  card: '#21262F',
  accent: '#6366F1',
  accentLight: 'rgba(99,102,241,0.15)',
  accentBorder: 'rgba(99,102,241,0.3)',
  green: '#10B981',
  gold: '#F59E0B',
  white: '#F1F5F9',
  muted: '#6B7280',
  text: '#9CA3AF',
  border: 'rgba(255,255,255,0.07)',
}

export default function TokenCalculatorPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />

      <div style={{ background: S.bg, minHeight: '100vh', color: S.text, fontFamily: 'Inter, system-ui, sans-serif' }}>

        {/* NAV */}
        <nav style={{ padding: '18px 40px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: S.bg, zIndex: 50 }}>
          <a href="/landing" style={{ fontWeight: 700, fontSize: 15, color: S.white, textDecoration: 'none', letterSpacing: '-0.2px' }}>
            💜 CamCash
          </a>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <a href="/guides/cam-model-room-title-generator" style={{ fontSize: 13, color: S.muted, textDecoration: 'none' }}>Title Generator</a>
            <Button as="a" href="/login" style={{ padding: '8px 20px', fontSize: 13 }}>
              Start Free →
            </Button>
          </div>
        </nav>

        <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px 100px' }}>

          {/* BREADCRUMB */}
          <nav aria-label="breadcrumb" style={{ marginBottom: 28, fontSize: 13 }}>
            <a href="/landing" style={{ color: S.accent, textDecoration: 'none' }}>Home</a>
            <span style={{ margin: '0 8px', color: S.muted }}>›</span>
            <a href="/landing#guides" style={{ color: S.accent, textDecoration: 'none' }}>Guides</a>
            <span style={{ margin: '0 8px', color: S.muted }}>›</span>
            <span style={{ color: S.muted }}>Token Calculator</span>
          </nav>

          {/* HERO */}
          <div style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {['Free Tool', '5 Platforms', 'Real Payout Rates', 'Tax Tips Included'].map(chip => (
                <span key={chip} style={{ padding: '4px 12px', borderRadius: 20, background: S.accentLight, border: `1px solid ${S.accentBorder}`, fontSize: 12, color: S.accent, fontWeight: 600 }}>{chip}</span>
              ))}
            </div>
            <h1 style={{ fontSize: 48, fontWeight: 900, color: S.white, lineHeight: 1.1, marginBottom: 20, letterSpacing: '-0.03em' }}>
              Cam Model Token Calculator
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.7, color: '#CBD5E1', paddingLeft: 20, borderLeft: `3px solid ${S.accent}`, maxWidth: 680 }}>
              Enter any token amount and instantly see your USD earnings across all major cam platforms. Uses real broadcaster payout rates — not what viewers pay. See also: <a href="/blog/cam-model-earnings" style={{ color: S.accent, textDecoration: 'none' }}>how cam model earnings actually work</a>.
            </p>
          </div>

          {/* INTERACTIVE TOOL */}
          <TokenCalculatorClient />

          {/* TABLE OF CONTENTS */}
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 16, padding: '28px 32px', marginBottom: 52, marginTop: 52 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: S.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>In this guide</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px 24px' }}>
              {[
                ['#convert', 'Convert Cam Tokens to USD'],
                ['#chaturbate', 'Chaturbate Token Value'],
                ['#bongacams', 'BongaCams Token Value'],
                ['#myfreecams', 'MyFreeCams Token Value'],
                ['#platform-comparison', 'Platform Payout Comparison'],
                ['#broadcaster-vs-viewer', 'Broadcaster Rate vs Viewer Rate'],
                ['#token-tracking', 'Why Token Tracking Helps You Earn More'],
                ['#taxes', 'Taxes & Deductions for Cam Models'],
                ['#tip-menu', 'Building a Tip Menu That Converts'],
                ['#faq', 'Token Calculator FAQ'],
              ].map(([href, label]) => (
                <a key={href} href={href} style={{ fontSize: 14, color: S.accent, textDecoration: 'none', padding: '4px 0', display: 'block' }}>→ {label}</a>
              ))}
            </div>
          </div>

          {/* SECTION: CONVERT */}
          <section id="convert" style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>Convert Cam Tokens to USD</h2>
            <div style={{ width: 48, height: 3, background: S.accent, borderRadius: 2, marginBottom: 24 }} />
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 18 }}>
              When viewers buy tokens, they pay the retail price — but you receive a different, lower amount called the broadcaster rate. Understanding this split is fundamental to knowing your real income.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 28 }}>
              On Chaturbate, viewers pay approximately $0.10 per token. You receive $0.05 per token. That's a 50/50 split between you and the platform. Across most cam sites, this split ranges from roughly 35–55% in the model's favor — BongaCams sits at the lower end of that range.
            </p>

            {/* Quick reference cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
              {[
                { platform: 'Chaturbate', rate: '$0.05', per: 'per token', color: '#F59E0B' },
                { platform: 'BongaCams', rate: '$0.025', per: 'per token', color: '#8B5CF6' },
                { platform: 'MyFreeCams', rate: '$0.05', per: 'per token', color: '#3B82F6' },
                { platform: 'Stripchat', rate: '~$0.05', per: 'per token', color: '#EF4444' },
                { platform: 'CamSoda', rate: '$0.055', per: 'per token', color: '#10B981' },
              ].map(({ platform, rate, per, color }) => (
                <div key={platform} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, color: S.muted, marginBottom: 6 }}>{platform}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{rate}</div>
                  <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{per}</div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text }}>
              Notice CamSoda's $0.055 rate — that extra half-cent adds up. On 10,000 tokens, that's $550 vs $500 on Chaturbate. Over a month of streaming, the difference can be meaningful.
            </p>
          </section>

          {/* SECTION: CHATURBATE TOKEN VALUE */}
          <section id="chaturbate" style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>Chaturbate Token Value</h2>
            <div style={{ width: 48, height: 3, background: S.accent, borderRadius: 2, marginBottom: 24 }} />
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 18 }}>
              Chaturbate pays models <strong style={{ color: S.white }}>$0.05 per token</strong> at the standard broadcaster rate. Viewers purchase tokens at approximately $0.10 each, meaning Chaturbate keeps 50% and the model receives 50%.
            </p>
            <div style={{ background: S.surface, border: `1px solid ${S.accentBorder}`, borderRadius: 14, padding: '24px 28px', marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
                {[[100,'$5'],[500,'$25'],[1000,'$50'],[2000,'$100'],[5000,'$250'],[10000,'$500']].map(([t,u]) => (
                  <div key={t} style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <div style={{ fontSize: 13, color: S.muted, marginBottom: 4 }}>{t.toLocaleString()} tokens</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: S.gold }}>{u}</div>
                  </div>
                ))}
              </div>
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text }}>
              To track your Chaturbate token earnings over time and see how they translate to $/hr, use the <a href="/guides/chaturbate-token-tracker" style={{ color: S.accent, textDecoration: 'none' }}>Chaturbate token tracker</a>. For a full breakdown of what affects hourly rates, see the <a href="/blog/how-much-do-chaturbate-models-make" style={{ color: S.accent, textDecoration: 'none' }}>Chaturbate earnings guide</a>.
            </p>
          </section>

          {/* SECTION: BONGACAMS TOKEN VALUE */}
          <section id="bongacams" style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>BongaCams Token Value</h2>
            <div style={{ width: 48, height: 3, background: S.accent, borderRadius: 2, marginBottom: 24 }} />
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 18 }}>
              BongaCams pays models <strong style={{ color: S.white }}>$0.025 per token</strong> — half of Chaturbate's rate. Viewers buy BongaCams tokens at roughly $0.068 each, so the platform keeps a larger share of the split than Chaturbate does.
            </p>
            <div style={{ background: S.surface, border: `1px solid rgba(139,92,246,0.3)`, borderRadius: 14, padding: '24px 28px', marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
                {[[100,'$2.50'],[500,'$12.50'],[1000,'$25'],[2000,'$50'],[5000,'$125'],[10000,'$250']].map(([t,u]) => (
                  <div key={t} style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)' }}>
                    <div style={{ fontSize: 13, color: S.muted, marginBottom: 4 }}>{t.toLocaleString()} tokens</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#8B5CF6' }}>{u}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 13, color: S.muted, marginTop: 14, marginBottom: 0 }}>Values shown at the standard $0.025/token broadcaster rate.</p>
            </div>
          </section>

          {/* SECTION: MYFREECAMS TOKEN VALUE */}
          <section id="myfreecams" style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>MyFreeCams Token Value</h2>
            <div style={{ width: 48, height: 3, background: S.accent, borderRadius: 2, marginBottom: 24 }} />
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 18 }}>
              MyFreeCams pays approximately <strong style={{ color: S.white }}>$0.05 per token</strong> (about $5.00 per 100 tokens). The exact rate can vary slightly based on model level and promotional periods. MFC has a strong North American audience and is especially popular with models who prefer a freemium-style room format.
            </p>
            <div style={{ background: S.surface, border: `1px solid rgba(59,130,246,0.3)`, borderRadius: 14, padding: '24px 28px', marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
                {[[100,'$5'],[500,'$25'],[1000,'$50'],[2000,'$100'],[5000,'$250'],[10000,'$500']].map(([t,u]) => (
                  <div key={t} style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)' }}>
                    <div style={{ fontSize: 13, color: S.muted, marginBottom: 4 }}>{t.toLocaleString()} tokens</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#3B82F6' }}>{u}</div>
                  </div>
                ))}
              </div>
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text }}>
              To compare what you earn per hour across MFC and other platforms, the <a href="/guides/cam-model-income-tracker" style={{ color: S.accent, textDecoration: 'none' }}>cam model income tracker</a> lets you log earnings by platform and session to find your most profitable site.
            </p>
          </section>

          {/* SECTION: PLATFORM COMPARISON */}
          <section id="platform-comparison" style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>Platform Payout Comparison</h2>
            <div style={{ width: 48, height: 3, background: S.accent, borderRadius: 2, marginBottom: 24 }} />
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 24 }}>
              The per-token rate is just one factor in your earnings. Audience size, discoverability, tip menu optimization, and streaming hours matter as much or more. That said, here's how the platforms compare on raw payout rate:
            </p>

            <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 28 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(99,102,241,0.08)' }}>
                    {['Platform', 'Broadcaster Rate', '1,000 tokens = $', '5,000 tokens = $', 'Notes'].map(h => (
                      <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, color: S.accent, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { platform: 'Chaturbate', rate: 0.05, note: 'Most popular platform globally' },
                    { platform: 'BongaCams', rate: 0.025, note: 'Lower broadcaster rate than Chaturbate' },
                    { platform: 'MyFreeCams', rate: 0.05, note: 'Strong North American audience' },
                    { platform: 'Stripchat', rate: 0.05, note: 'Growing EU/global audience' },
                    { platform: 'CamSoda', rate: 0.055, note: 'Slightly higher rate' },
                  ].map(({ platform, rate, note }, i) => (
                    <tr key={platform} style={{ borderTop: `1px solid ${S.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '13px 20px', color: S.white, fontWeight: 600, fontSize: 14 }}>{platform}</td>
                      <td style={{ padding: '13px 20px', color: S.gold, fontWeight: 700, fontSize: 14 }}>${rate.toFixed(4)}</td>
                      <td style={{ padding: '13px 20px', color: S.green, fontWeight: 800, fontSize: 14 }}>${(1000 * rate).toFixed(2)}</td>
                      <td style={{ padding: '13px 20px', color: S.green, fontWeight: 800, fontSize: 14 }}>${(5000 * rate).toFixed(2)}</td>
                      <td style={{ padding: '13px 20px', color: S.muted, fontSize: 13 }}>{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text }}>
              Don't base your platform choice on the rate difference alone. A $0.005/token difference means $5 per 1,000 tokens. If one platform brings you 3× more viewers, that's far more valuable than the rate difference.
            </p>
          </section>

          {/* SECTION: BROADCASTER VS VIEWER */}
          <section id="broadcaster-vs-viewer" style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>Broadcaster Rate vs Viewer Rate</h2>
            <div style={{ width: 48, height: 3, background: S.accent, borderRadius: 2, marginBottom: 24 }} />
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 18 }}>
              When a viewer tips you 100 tokens, that feels like the transaction is between you and them — but it's actually a three-party exchange. The viewer paid roughly $10 for those 100 tokens. You receive $5. The platform pockets the other $5.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 18 }}>
              This is why you should always price your tip menu based on your broadcaster rate — not what you think viewers are spending. A 200-token tip that feels "big" to a viewer ($20 out of pocket) earns you only $10.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text }}>
              Use this reality to your advantage: frame tips in a way that feels affordable (tokens) while being clear about what you're providing. "500 tokens for a 10-minute private" lands better than "you're paying $25 for 10 minutes" — even though that's exactly what it is.
            </p>
          </section>

          {/* SECTION: TOKEN TRACKING */}
          <section id="token-tracking" style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>Why Token Tracking Helps You Earn More</h2>
            <div style={{ width: 48, height: 3, background: S.accent, borderRadius: 2, marginBottom: 24 }} />
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 18 }}>
              Converting tokens to USD tells you what a session was worth. But knowing <em>when</em> those tokens came in — and which fans sent them — is what actually moves your income up. The <a href="/guides/cam-model-income-tracker" style={{ color: S.accent, textDecoration: 'none' }}>cam model income tracker</a> and <a href="/guides/chaturbate-token-tracker" style={{ color: S.accent, textDecoration: 'none' }}>Chaturbate token tracker</a> log this data across sessions so patterns become visible over time. For a full picture of how earnings stack up, read the <a href="/blog/cam-model-earnings" style={{ color: S.accent, textDecoration: 'none' }}>cam model earnings guide</a>.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 24 }}>
              You can't control the platform's base rate — but you can significantly increase how many tokens flow in per hour:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { n: '01', title: 'Complete your profile', body: 'A complete bio, quality photos, and a real profile picture increase discoverability and trust, which brings in more viewers and tips — even though the per-token rate itself stays fixed.' },
                { n: '02', title: 'Negotiate your rate', body: 'After reaching consistent high traffic, you can contact Chaturbate model support to negotiate a higher per-token rate. This is rarely advertised but happens regularly for top performers.' },
                { n: '03', title: 'Price your tip menu strategically', body: 'Low-entry items at 25–50 tokens bring hesitant viewers into the tipping habit. High-ticket goals at 5,000–10,000 tokens create excitement and community momentum. Both ends of the menu matter.' },
                { n: '04', title: 'Use platform bonuses', body: 'Many platforms run promotional rate boosts for certain streaming hours, new models, or special events. Check your platform\'s model support page regularly.' },
                { n: '05', title: 'Stream during your peak hours', body: 'Analytics show that 2–3 hours within your personal streaming schedule consistently outperform the rest. Tools like CamCash identify exactly which hours and days are most profitable for your audience specifically.' },
                { n: '06', title: 'Activate tip goals and countdowns', body: 'Room-level goals (e.g., "2,000 tokens to unlock X") drive collective action. Countdowns create urgency. Both features are built into Chaturbate\'s room tools and meaningfully increase average tokens earned per stream.' },
              ].map(({ n, title, body }) => (
                <div key={n} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '20px 24px', display: 'flex', gap: 20 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: S.accent, minWidth: 32, opacity: 0.5 }}>{n}</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: S.white, marginBottom: 6 }}>{title}</div>
                    <div style={{ fontSize: 15, lineHeight: 1.7, color: S.text }}>{body}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION: HOURLY RATE */}
          <section id="hourly-rate" style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>Calculating Your Real Hourly Rate</h2>
            <div style={{ width: 48, height: 3, background: S.accent, borderRadius: 2, marginBottom: 24 }} />
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 18 }}>
              Total tokens earned doesn't tell you much on its own. Your hourly rate is the number that lets you make smart decisions about when to stream, for how long, and which goals to set.
            </p>
            <div style={{ background: S.surface, border: `1px solid ${S.accentBorder}`, borderRadius: 14, padding: '24px 28px', marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Simple formula</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: S.white, fontFamily: 'monospace' }}>
                Hourly Rate = (Total Tokens × Token Rate) ÷ Stream Hours
              </div>
              <div style={{ fontSize: 14, color: S.muted, marginTop: 10 }}>
                Example: 1,800 tokens × $0.05 = $90 ÷ 2 hours = <span style={{ color: S.green, fontWeight: 700 }}>$45/hr</span>
              </div>
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 18 }}>
              Track this number across multiple sessions. You'll quickly see patterns: Tuesday evenings at $60/hr, Sunday mornings at $18/hr. Once you know your actual hourly rate by day and time, you can stop streaming when it's unprofitable and double down when it's hot.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text }}>
              CamCash calculates this automatically from your CSV uploads — so you don't have to track it manually. It also shows which fans contributed most to each session, so you can identify your whale viewers.
            </p>
          </section>

          {/* SECTION: TAXES */}
          <section id="taxes" style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>Taxes & Deductions for Cam Models</h2>
            <div style={{ width: 48, height: 3, background: S.accent, borderRadius: 2, marginBottom: 24 }} />
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 18 }}>
              Cam model income is self-employment income in the United States. This means two things: you are responsible for reporting all earnings, and you can deduct legitimate business expenses.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
              <div style={{ background: S.card, border: `1px solid rgba(239,68,68,0.25)`, borderRadius: 14, padding: '22px 24px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>What you owe</div>
                {['Federal income tax (10–37% bracket)', 'Self-employment tax (15.3% on net profit)', 'State income tax (varies by state)', '1099-NEC from platforms paying $600+', 'Quarterly estimated payments (Form 1040-ES)'].map(item => (
                  <div key={item} style={{ fontSize: 14, color: S.text, padding: '7px 0', borderBottom: `1px solid ${S.border}`, lineHeight: 1.5 }}>⚠️ {item}</div>
                ))}
              </div>
              <div style={{ background: S.card, border: `1px solid rgba(16,185,129,0.25)`, borderRadius: 14, padding: '22px 24px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: S.green, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>What you can deduct</div>
                {['Home office (dedicated streaming space)', 'Equipment: camera, mic, lighting, PC', 'Costumes/accessories used for work', 'Internet and streaming services', 'Platform fees and commissions', 'Accountant or tax preparation fees'].map(item => (
                  <div key={item} style={{ fontSize: 14, color: S.text, padding: '7px 0', borderBottom: `1px solid ${S.border}`, lineHeight: 1.5 }}>✓ {item}</div>
                ))}
              </div>
            </div>

            <p style={{ fontSize: 15, lineHeight: 1.7, color: S.muted, background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '14px 18px' }}>
              <strong style={{ color: S.white }}>Disclaimer:</strong> This is general information only, not tax advice. Consult a CPA or tax professional familiar with self-employment income for guidance specific to your situation.
            </p>
          </section>

          {/* SECTION: TIP MENU */}
          <section id="tip-menu" style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>Building a Tip Menu That Converts</h2>
            <div style={{ width: 48, height: 3, background: S.accent, borderRadius: 2, marginBottom: 24 }} />
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 18 }}>
              Your tip menu is your pricing strategy. Every price point sends a signal. Too cheap signals low value. Too expensive stops tips entirely. Here's the structure that works:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 28 }}>
              {[
                { tier: 'Entry (25–75 tokens)', eg: 'Song request, shoutout, spin wheel', usd: '$1.25–$3.75', color: '#6366F1' },
                { tier: 'Engagement (100–300 tokens)', eg: 'Position change, outfit choice, toy tease', usd: '$5–$15', color: '#8B5CF6' },
                { tier: 'Big Tip (500–1,000 tokens)', eg: 'Special performance, DM access', usd: '$25–$50', color: '#F59E0B' },
                { tier: 'Whale Goal (5,000+ tokens)', eg: 'Special show, fan club, private room access', usd: '$250+', color: '#10B981' },
              ].map(({ tier, eg, usd, color }) => (
                <div key={tier} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 8 }}>{tier}</div>
                  <div style={{ fontSize: 13, color: S.text, lineHeight: 1.6, marginBottom: 8 }}>{eg}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: S.green }}>{usd} to you</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text }}>
              Review your tip menu analytics quarterly. If you're getting lots of entry tips but no whale tips, raise your mid-tier prices. If tips have stalled entirely, introduce new affordable entry-level options to restart momentum. If you run a dominant or tribute-based room, the whale-goal tier above is really its own pricing model — see the <a href="/blog/findom-kink-niche" style={{ color: S.accent, textDecoration: 'none' }}>findom and kink niche guide</a> for how to structure tiered tributes specifically.
            </p>
          </section>

          {/* FAQ SECTION */}
          <section id="faq" style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>Token Calculator FAQ</h2>
            <div style={{ width: 48, height: 3, background: S.accent, borderRadius: 2, marginBottom: 28 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {faqSchema.mainEntity.map(({ name, acceptedAnswer }) => (
                <div key={name} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '18px 24px', borderBottom: `1px solid ${S.border}` }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: S.white }}>{name}</span>
                  </div>
                  <div style={{ padding: '16px 24px' }}>
                    <p style={{ fontSize: 15, lineHeight: 1.7, color: S.text, margin: 0 }}>{acceptedAnswer.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* RELATED TOOLS */}
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: S.white, marginBottom: 20 }}>Related Tools & Guides</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {[
                { href: '/guides/chaturbate-token-tracker', label: 'Chaturbate Token Tracker', desc: 'Log and track tokens earned across sessions' },
                { href: '/guides/cam-model-income-tracker', label: 'Income Tracker', desc: 'Track $/hr, top fans, and session breakdowns' },
                { href: '/guides/chaturbate-best-hours', label: 'Best Hours to Stream', desc: 'Find your personal peak streaming times' },
                { href: '/blog/cam-model-earnings', label: 'Cam Model Earnings Guide', desc: 'How much models make and why it changes' },
                { href: '/blog/findom-kink-niche', label: 'Findom & Kink Niche Guide', desc: 'Tribute pricing tiers, boundaries, and platform differences' },
              ].map(({ href, label, desc }) => (
                <a key={href} href={href} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '18px 20px', textDecoration: 'none', display: 'block', transition: 'border-color 0.15s' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: S.accent, marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 13, color: S.muted, lineHeight: 1.5 }}>{desc}</div>
                </a>
              ))}
            </div>
          </section>

          {/* INTERNAL LINKS BLOCK */}
          <div style={{ marginTop: '36px', paddingTop: '24px', borderTop: `1px solid ${S.border}`, marginBottom: '36px' }}>
            <div style={{ fontSize: 11, color: S.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Related cam model tools:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <a href="/guides/cam-model-token-calculator" style={{ fontSize: 14, color: S.accent, textDecoration: 'none' }}>→ Free cam model token calculator</a>
              <a href="/guides/chaturbate-earnings-tracker" style={{ fontSize: 14, color: S.accent, textDecoration: 'none' }}>→ Chaturbate earnings tracker</a>
              <a href="/guides/chaturbate-token-tracker" style={{ fontSize: 14, color: S.accent, textDecoration: 'none' }}>→ Chaturbate token tracker</a>
              <a href="/guides/chaturbate-best-hours" style={{ fontSize: 14, color: S.accent, textDecoration: 'none' }}>→ Best hours to stream on Chaturbate</a>
              <a href="/guides/cam-model-income-tracker" style={{ fontSize: 14, color: S.accent, textDecoration: 'none' }}>→ Cam model income tracker</a>
            </div>
          </div>

          {/* BOTTOM CTA */}
          <div style={{ padding: '48px 40px', borderRadius: 20, background: `linear-gradient(135deg, ${S.accentLight}, rgba(16,185,129,0.08))`, border: `1px solid ${S.accentBorder}`, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Go beyond the calculator</div>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: S.white, marginBottom: 14, letterSpacing: '-0.02em' }}>See your complete earnings picture</h2>
            <p style={{ fontSize: 16, color: S.text, marginBottom: 32, lineHeight: 1.6, maxWidth: 520, margin: '0 auto 32px' }}>
              Upload your Chaturbate, BongaCams, or MFC CSV and get a full analytics dashboard — top fans, peak hours, session breakdowns, and personalized recommendations. Free during beta.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/login" style={{ display: 'inline-block', padding: '14px 36px', borderRadius: 12, background: S.accent, color: 'white', fontWeight: 800, fontSize: 16, textDecoration: 'none' }}>
                Start Tracking Free →
              </a>
              <a href="/demo" style={{ display: 'inline-block', padding: '14px 36px', borderRadius: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.text, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
                Try the CamCash demo →
              </a>
            </div>
          </div>

        </div>

        <footer style={{ borderTop: `1px solid ${S.border}`, padding: '32px 40px', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: S.muted }}>© 2026 CamCash — Built for cam models who want to grow</p>
        </footer>
      </div>
    </>
  )
}

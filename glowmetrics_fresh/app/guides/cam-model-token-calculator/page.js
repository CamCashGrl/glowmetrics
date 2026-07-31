import TokenCalculatorClient from './TokenCalculatorClient'
import Button from '../../../components/ui/Button'

export const metadata = {
  title: 'Cam Token Calculator: Chaturbate, MFC & Stripchat to USD | CamCash',
  description: 'Free cam token calculator for Chaturbate, MyFreeCams, Stripchat, BongaCams and CamSoda. Convert tokens into estimated model earnings and compare payout rates.',
  keywords: 'token calculator, chaturbate token calculator, cb token calculator, mfc token calculator, stripchat token conversion rate, cam model token calculator, tokens to usd, how much are tokens worth, cam model earnings, broadcaster payout rate',
  alternates: { canonical: 'https://www.camcashgrl.com/guides/cam-model-token-calculator' },
  openGraph: {
    title: 'Cam Token Calculator: Chaturbate, MFC & Stripchat to USD | CamCash',
    description: 'Free cam token calculator for Chaturbate, MyFreeCams, Stripchat, BongaCams and CamSoda. Convert tokens into estimated model earnings and compare payout rates.',
    url: 'https://www.camcashgrl.com/guides/cam-model-token-calculator',
    type: 'article',
    images: [{ url: 'https://www.camcashgrl.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cam Token Calculator: Chaturbate, MFC & Stripchat to USD | CamCash',
    description: 'Free cam token calculator for Chaturbate, MyFreeCams, Stripchat, BongaCams and CamSoda. Convert tokens into estimated model earnings and compare payout rates.',
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
    { '@type': 'Question', name: 'How much is one Chaturbate token worth?', acceptedAnswer: { '@type': 'Answer', text: 'One Chaturbate token is worth $0.05 to the broadcaster. Viewers purchase tokens at approximately $0.10 each, meaning Chaturbate keeps about 50% and the model receives 50%.' } },
    { '@type': 'Question', name: 'How much is 100 Chaturbate tokens?', acceptedAnswer: { '@type': 'Answer', text: '100 Chaturbate tokens equals $5.00 to the broadcaster, at the standard $0.05 per token rate. Viewers pay roughly $10 to purchase those 100 tokens.' } },
    { '@type': 'Question', name: 'How much is 1,000 MFC tokens worth?', acceptedAnswer: { '@type': 'Answer', text: '1,000 MyFreeCams tokens is worth approximately $50 at the standard $0.05 per token broadcaster rate. Always confirm your exact current rate in your MFC dashboard, since model level and promotions can affect it.' } },
    { '@type': 'Question', name: 'How much is 10,000 cam tokens in USD?', acceptedAnswer: { '@type': 'Answer', text: 'At the standard $0.05 per token rate used by Chaturbate, MyFreeCams, Stripchat, and CamSoda, 10,000 tokens equals about $500. On BongaCams, which pays $0.025 per token, 10,000 tokens equals about $250.' } },
    { '@type': 'Question', name: 'Which cam platform pays the most per token?', acceptedAnswer: { '@type': 'Answer', text: 'Chaturbate, MyFreeCams, Stripchat, and CamSoda all use a standard broadcaster rate of about $0.05 per token. BongaCams pays roughly half that, at $0.025 per token. Overall earnings depend far more on audience size and streaming hours than on the per-token rate.' } },
    { '@type': 'Question', name: 'Why does a viewer pay more than the model receives?', acceptedAnswer: { '@type': 'Answer', text: 'Viewers buy tokens at a retail price that is higher than what platforms pay broadcasters per token. On Chaturbate, for example, viewers pay about $0.10 per token while the model receives $0.05. The difference covers platform operating costs and profit.' } },
    { '@type': 'Question', name: 'Can studio models enter a custom token rate?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. If your studio or account agreement pays a different rate than the platform standard, select "Custom Rate" in the calculator above and enter your actual per-token payout to get an accurate estimate.' } },
    { '@type': 'Question', name: 'How do I calculate cam earnings per hour?', acceptedAnswer: { '@type': 'Answer', text: 'Divide your total USD earnings for a session by the hours you streamed. For example, 1,800 tokens at $0.05 each equals $90; divided by 2 hours of streaming, that is $45 per hour.' } },
    { '@type': 'Question', name: 'Are token rates the same on every platform?', acceptedAnswer: { '@type': 'Answer', text: 'No. Chaturbate, MyFreeCams, Stripchat, and CamSoda currently use a standard $0.05 per token broadcaster rate, while BongaCams pays about $0.025 per token. Rates can also vary by account tier, studio agreement, and promotional periods, so always confirm your actual rate in your platform dashboard.' } },
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

// Single source of truth for displayed rates: lib/constants.js PLATFORM_TOKEN_RATES.
// Keep this list in sync with TokenCalculatorClient.js — never hardcode a different value here.
const PLATFORM_RATES = [
  { platform: 'Chaturbate', rate: 0.05, color: '#F59E0B', note: 'Most popular platform globally' },
  { platform: 'MyFreeCams', rate: 0.05, color: '#3B82F6', note: 'Strong North American audience' },
  { platform: 'Stripchat', rate: 0.05, color: '#EF4444', note: 'Rate varies more by tier/payment method' },
  { platform: 'BongaCams', rate: 0.025, color: '#8B5CF6', note: 'Lower broadcaster rate than most platforms' },
  { platform: 'CamSoda', rate: 0.05, color: '#10B981', note: 'Standard rate, on par with most platforms' },
]

function ConversionGrid({ rate, color }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
      {[100, 500, 1000, 5000].map(t => (
        <div key={t} style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 12, color: S.muted, marginBottom: 4 }}>{t.toLocaleString()} tokens</div>
          <div style={{ fontSize: 20, fontWeight: 800, color }}>${(t * rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      ))}
    </div>
  )
}

function PlatformSection({ id, name, rate, color, borderColor, blurb, caveat, linkHref, linkLabel }) {
  return (
    <section id={id} style={{ marginBottom: 44 }}>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>{name} Token Value</h2>
      <div style={{ width: 40, height: 3, background: S.accent, borderRadius: 2, marginBottom: 20 }} />
      <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 18 }}>{blurb}</p>
      <div style={{ background: S.surface, border: `1px solid ${borderColor}`, borderRadius: 14, padding: '22px 24px', marginBottom: 16 }}>
        <ConversionGrid rate={rate} color={color} />
      </div>
      {caveat && <p style={{ fontSize: 13, color: S.muted, marginBottom: 16 }}>{caveat}</p>}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {linkHref && (
          <a href={linkHref} style={{ fontSize: 14, color: S.accent, textDecoration: 'none' }}>→ {linkLabel}</a>
        )}
        <a href="#calculator-top" style={{ fontSize: 13, color: S.muted, textDecoration: 'none' }}>↑ Back to calculator</a>
      </div>
    </section>
  )
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

        <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 24px 100px' }}>

          {/* BREADCRUMB */}
          <nav aria-label="breadcrumb" style={{ marginBottom: 14, fontSize: 13 }}>
            <a href="/landing" style={{ color: S.accent, textDecoration: 'none' }}>Home</a>
            <span style={{ margin: '0 8px', color: S.muted }}>›</span>
            <a href="/landing#guides" style={{ color: S.accent, textDecoration: 'none' }}>Guides</a>
            <span style={{ margin: '0 8px', color: S.muted }}>›</span>
            <span style={{ color: S.muted }}>Token Calculator</span>
          </nav>

          {/* HERO */}
          <div id="calculator-top" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {['Free Tool', '5 Platforms', 'Real Payout Rates', 'No Login Required'].map(chip => (
                <span key={chip} style={{ padding: '3px 10px', borderRadius: 20, background: S.accentLight, border: `1px solid ${S.accentBorder}`, fontSize: 11, color: S.accent, fontWeight: 600 }}>{chip}</span>
              ))}
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 900, color: S.white, lineHeight: 1.15, marginBottom: 10, letterSpacing: '-0.02em' }}>
              Cam Model Token Calculator: Convert Tokens to USD
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.55, color: '#CBD5E1', paddingLeft: 14, borderLeft: `3px solid ${S.accent}`, maxWidth: 680 }}>
              Converts cam-site tokens into estimated broadcaster earnings for Chaturbate, MyFreeCams, Stripchat, BongaCams, and CamSoda. Your payout isn't the same as what a viewer paid — enter your amount below, or switch to Custom Rate if your studio pays differently.
            </p>
          </div>

          {/* INTERACTIVE TOOL */}
          <TokenCalculatorClient />

          {/* METHODOLOGY */}
          <section id="methodology" style={{ marginTop: 44, marginBottom: 44 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>Rate Verification &amp; Methodology</h2>
            <div style={{ width: 40, height: 3, background: S.accent, borderRadius: 2, marginBottom: 18 }} />
            <p style={{ fontSize: 15, lineHeight: 1.75, color: S.text, marginBottom: 12 }}>
              Estimated earnings = tokens × broadcaster rate. Rates above reflect each platform's standard published payout structure, cross-checked against third-party token calculators. Where an exact current rate can't be verified from an official source, it's labeled as an estimated standard rate — your actual payout can differ based on studio agreements, account tier, or promotional periods, so always confirm the current rate in your own platform dashboard.
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.75, color: S.text, marginBottom: 12 }}>
              Want to know how many tokens you need to hit a specific dollar goal? Enter your token amount in the calculator above — the "Estimated Earnings" panel automatically shows the next $50 milestone and how many more tokens get you there.
            </p>
            <p style={{ fontSize: 13, color: S.muted }}>
              Rates last reviewed: July 2026, by the CamCash team.
            </p>
          </section>

          {/* QUICK REFERENCE TABLE */}
          <section id="quick-reference" style={{ marginBottom: 44 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>Quick Token Value Reference</h2>
            <div style={{ width: 40, height: 3, background: S.accent, borderRadius: 2, marginBottom: 20 }} />
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 20 }}>
              Viewers pay a retail price for tokens; you receive the lower broadcaster rate. On Chaturbate, for example, viewers pay about $0.10 per token while you receive $0.05 — a roughly 50/50 split. BongaCams keeps a larger share of that split than the other platforms.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              {PLATFORM_RATES.map(({ platform, rate, color }) => (
                <div key={platform} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, color: S.muted, marginBottom: 6 }}>{platform}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>${rate.toFixed(3).replace(/0$/, '')}</div>
                  <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>per token</div>
                </div>
              ))}
            </div>
          </section>

          {/* PLATFORM COMPARISON TABLE */}
          <section id="platform-comparison" style={{ marginBottom: 44 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>Platform Payout Comparison</h2>
            <div style={{ width: 40, height: 3, background: S.accent, borderRadius: 2, marginBottom: 20 }} />
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 20 }}>
              Four of the five platforms currently use the same standard $0.05 broadcaster rate — BongaCams is the outlier at roughly half that. Don't pick a platform on rate alone: audience size and streaming hours matter far more to total earnings.
            </p>
            <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 16, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(99,102,241,0.08)' }}>
                    {['Platform', 'Broadcaster Rate', '1,000 tokens = $', '5,000 tokens = $', 'Notes'].map(h => (
                      <th key={h} scope="col" style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, color: S.accent, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PLATFORM_RATES.map(({ platform, rate, note }, i) => (
                    <tr key={platform} style={{ borderTop: `1px solid ${S.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '13px 20px', color: S.white, fontWeight: 600, fontSize: 14 }}>{platform}</td>
                      <td style={{ padding: '13px 20px', color: S.gold, fontWeight: 700, fontSize: 14 }}>${rate.toFixed(3)}</td>
                      <td style={{ padding: '13px 20px', color: S.green, fontWeight: 800, fontSize: 14 }}>${(1000 * rate).toFixed(2)}</td>
                      <td style={{ padding: '13px 20px', color: S.green, fontWeight: 800, fontSize: 14 }}>${(5000 * rate).toFixed(2)}</td>
                      <td style={{ padding: '13px 20px', color: S.muted, fontSize: 13 }}>{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* JUMP LINKS */}
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 16, padding: '24px 28px', marginBottom: 44 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: S.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>Jump to a platform</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
              {[
                ['#chaturbate', 'Chaturbate'],
                ['#myfreecams', 'MyFreeCams'],
                ['#stripchat', 'Stripchat'],
                ['#bongacams', 'BongaCams'],
                ['#camsoda', 'CamSoda'],
                ['#broadcaster-vs-viewer', 'Viewer vs. Payout'],
                ['#hourly-rate', 'Earnings Per Hour'],
                ['#faq', 'FAQ'],
              ].map(([href, label]) => (
                <a key={href} href={href} style={{ fontSize: 14, color: S.accent, textDecoration: 'none' }}>→ {label}</a>
              ))}
            </div>
          </div>

          {/* PLATFORM SECTIONS */}
          <PlatformSection
            id="chaturbate"
            name="Chaturbate"
            rate={0.05}
            color={S.gold}
            borderColor={S.accentBorder}
            blurb={<>Chaturbate pays models <strong style={{ color: S.white }}>$0.05 per token</strong> at the standard broadcaster rate. Viewers purchase tokens at approximately $0.10 each, so Chaturbate keeps about 50% and the model receives 50%.</>}
            linkHref="/guides/chaturbate-token-tracker"
            linkLabel="Track your Chaturbate token earnings over time"
          />

          <PlatformSection
            id="myfreecams"
            name="MyFreeCams"
            rate={0.05}
            color="#3B82F6"
            borderColor="rgba(59,130,246,0.3)"
            blurb={<>MyFreeCams pays approximately <strong style={{ color: S.white }}>$0.05 per token</strong> (about $5.00 per 100 tokens). The exact rate can vary slightly by model level and promotional periods.</>}
            caveat="Estimated standard broadcaster rate. Verify your current rate in your MFC model dashboard."
            linkHref="/guides/cam-model-income-tracker"
            linkLabel="Compare MFC earnings against other platforms"
          />

          <PlatformSection
            id="stripchat"
            name="Stripchat"
            rate={0.05}
            color="#EF4444"
            borderColor="rgba(239,68,68,0.3)"
            blurb={<>Stripchat pays approximately <strong style={{ color: S.white }}>$0.05 per token</strong> at the standard rate. Stripchat's payout can vary more by model tier and payment method than most other platforms.</>}
            caveat="Estimated standard broadcaster rate. Verify the current rate in your Stripchat dashboard before relying on it."
            linkHref="/blog/cam-model-earnings"
            linkLabel="See how earnings break down across platforms"
          />

          <PlatformSection
            id="bongacams"
            name="BongaCams"
            rate={0.025}
            color="#8B5CF6"
            borderColor="rgba(139,92,246,0.3)"
            blurb={<>BongaCams pays models <strong style={{ color: S.white }}>$0.025 per token</strong> — about half of Chaturbate's rate. Viewers buy BongaCams tokens at roughly $0.068 each, so the platform keeps a larger share of the split.</>}
            linkHref="/blog/how-much-do-bongacams-models-make"
            linkLabel="Read the full BongaCams earnings guide"
          />

          <PlatformSection
            id="camsoda"
            name="CamSoda"
            rate={0.05}
            color={S.green}
            borderColor="rgba(16,185,129,0.3)"
            blurb={<>CamSoda pays approximately <strong style={{ color: S.white }}>$0.05 per token</strong> at the standard rate — on par with Chaturbate, MyFreeCams, and Stripchat rather than meaningfully higher or lower.</>}
            caveat="Estimated standard broadcaster rate. Verify the current rate in your CamSoda dashboard, since tier and promotions can affect it."
          />

          {/* BROADCASTER VS VIEWER */}
          <section id="broadcaster-vs-viewer" style={{ marginBottom: 44 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>Viewer Cost vs. Broadcaster Payout</h2>
            <div style={{ width: 40, height: 3, background: S.accent, borderRadius: 2, marginBottom: 20 }} />
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 16 }}>
              A token tip is really a three-party exchange. When a viewer tips 100 tokens on Chaturbate, they paid roughly $10 to buy those tokens — you receive $5, and the platform keeps the other $5. The rate difference is why your tip menu should be priced around your broadcaster rate, not around what you assume viewers are spending.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text }}>
              This split funds each platform's operating costs and varies by site — it's the same reason BongaCams' broadcaster rate is lower relative to what viewers pay there.
            </p>
          </section>

          {/* HOURLY RATE */}
          <section id="hourly-rate" style={{ marginBottom: 44 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>Calculate Cam Earnings Per Hour</h2>
            <div style={{ width: 40, height: 3, background: S.accent, borderRadius: 2, marginBottom: 20 }} />
            <div style={{ background: S.surface, border: `1px solid ${S.accentBorder}`, borderRadius: 14, padding: '22px 24px', marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: S.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Formula</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: S.white, fontFamily: 'monospace' }}>
                Hourly Rate = (Total Tokens × Token Rate) ÷ Stream Hours
              </div>
              <div style={{ fontSize: 14, color: S.muted, marginTop: 10 }}>
                Example: 1,800 tokens × $0.05 = $90 ÷ 2 hours = <span style={{ color: S.green, fontWeight: 700 }}>$45/hr</span>
              </div>
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text }}>
              Tracking this per session — not just your token total — is what shows which days and hours are actually worth streaming. The <a href="/guides/chaturbate-best-hours" style={{ color: S.accent, textDecoration: 'none' }}>best hours to stream guide</a> breaks down how to find your personal peak windows.
            </p>
          </section>

          {/* RELATED GUIDANCE */}
          <section id="related-guidance" style={{ marginBottom: 44 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>Taxes &amp; Earning More From Your Tokens</h2>
            <div style={{ width: 40, height: 3, background: S.accent, borderRadius: 2, marginBottom: 20 }} />
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 16 }}>
              Cam token payouts are generally treated as self-employment income in the US and require your own tax and expense records. Read the complete <a href="/blog/cam-model-taxes" style={{ color: S.accent, textDecoration: 'none' }}>Cam Model Taxes guide</a> for 1099 thresholds, deductions, and quarterly estimated-payment information.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: S.text, marginBottom: 16 }}>
              The per-token rate itself is fixed by the platform, but how much you earn per stream depends heavily on tip menu pricing and how well your room converts viewers into tippers. See <a href="/blog/how-to-increase-chaturbate-tips" style={{ color: S.accent, textDecoration: 'none' }}>How to Increase Chaturbate Tips</a> for menu structure and pricing that actually moves the needle.
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: S.muted }}>
              Need tip menu graphics and room titles ready to use? Pretty Profitz sells editable tip menu and spin-the-wheel templates on Etsy — use code <strong style={{ color: S.white }}>PRETTY70</strong> for 70% off at <a href="https://prettyprofitz.etsy.com" style={{ color: S.accent, textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">prettyprofitz.etsy.com</a>.
            </p>
          </section>

          {/* FAQ SECTION */}
          <section id="faq" style={{ marginBottom: 44 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: S.white, marginBottom: 8, letterSpacing: '-0.02em' }}>Token Calculator FAQ</h2>
            <div style={{ width: 40, height: 3, background: S.accent, borderRadius: 2, marginBottom: 24 }} />
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

          {/* AUTHOR / REVIEWER */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderRadius: 12, background: S.card, border: `1px solid ${S.border}`, marginBottom: 44, fontSize: 13, color: S.muted }}>
            <span style={{ fontSize: 18 }}>✓</span>
            <span>Written and maintained by the CamCash team. Broadcaster rates are checked against each platform's payout documentation and third-party token calculators — last reviewed July 2026.</span>
          </div>

          {/* RELATED TOOLS */}
          <section style={{ marginBottom: 44 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 20 }}>Related Tools &amp; Guides</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {[
                { href: '/guides/chaturbate-token-tracker', label: 'Chaturbate Token Tracker', desc: 'Log and track tokens earned across sessions' },
                { href: '/guides/cam-model-income-tracker', label: 'Income Tracker', desc: 'Track $/hr, top fans, and session breakdowns' },
                { href: '/guides/chaturbate-best-hours', label: 'Best Hours to Stream', desc: 'Find your personal peak streaming times' },
                { href: '/blog/cam-model-earnings', label: 'Cam Model Earnings Guide', desc: 'How much models make and why it changes' },
                { href: '/blog/cam-model-taxes', label: 'Cam Model Taxes Guide', desc: '1099s, deductions, and quarterly payments' },
                { href: '/tools/profile-studio', label: 'Creator Profile Studio', desc: 'Free AI bio and tip menu generator, no sign-up required' },
              ].map(({ href, label, desc }) => (
                <a key={href} href={href} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '18px 20px', textDecoration: 'none', display: 'block', transition: 'border-color 0.15s' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: S.accent, marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 13, color: S.muted, lineHeight: 1.5 }}>{desc}</div>
                </a>
              ))}
            </div>
          </section>

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
              <a href="/landing/demo" style={{ display: 'inline-block', padding: '14px 36px', borderRadius: 12, background: 'transparent', border: `1px solid ${S.border}`, color: S.text, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
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

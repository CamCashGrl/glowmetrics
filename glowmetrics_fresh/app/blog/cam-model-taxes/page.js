// app/blog/cam-model-taxes/page.js
export const metadata = {
  title: 'Cam Model Taxes: What to Track, What to Deduct, and How to File',
  description: 'Cam model income is taxable. Here\'s exactly what to track, what deductions you can claim, when to pay quarterly, and how to avoid the most common tax mistakes.',
  alternates: { canonical: 'https://www.camcashgrl.com/blog/cam-model-taxes' },
  openGraph: {
    title: 'Cam Model Taxes: What to Track, What to Deduct, and How to File',
    description: 'Everything cam models need to know about taxes — deductions, quarterly payments, and record-keeping.',
    url: 'https://www.camcashgrl.com/blog/cam-model-taxes',
    type: 'article',
  },
}

export default function CamModelTaxes() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Cam Model Taxes: What to Track, What to Deduct, and How to File',
    description: "Cam model income is taxable. Here's exactly what to track, what deductions you can claim, when to pay quarterly, and how to avoid the most common tax mistakes.",
    url: 'https://www.camcashgrl.com/blog/cam-model-taxes',
    datePublished: '2026-01-01',
    dateModified: '2026-04-27',
    author: { '@type': 'Organization', name: 'CamCash', url: 'https://www.camcashgrl.com' },
    publisher: { '@type': 'Organization', name: 'CamCash', url: 'https://www.camcashgrl.com', logo: { '@type': 'ImageObject', url: 'https://www.camcashgrl.com/og-image.png' } },
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://www.camcashgrl.com/blog/cam-model-taxes' },
  }
  const s = {
    page: { background: '#05070f', minHeight: '100vh', color: '#94A3B8', fontFamily: 'Inter, sans-serif' },
    nav: { padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    logo: { fontWeight: 800, fontSize: 20, color: 'white', textDecoration: 'none' },
    accent: { color: '#22D3EE' },
    navCta: { padding: '8px 20px', borderRadius: 8, background: 'linear-gradient(135deg, #22D3EE, #EC4899)', color: 'white', fontWeight: 700, fontSize: 13, textDecoration: 'none' },
    article: { maxWidth: 760, margin: '0 auto', padding: '60px 24px 100px' },
    bread: { marginBottom: 24, fontSize: 13 },
    breadLink: { color: '#22D3EE', textDecoration: 'none' },
    sep: { margin: '0 8px', color: '#475569' },
    h1: { fontSize: 38, fontWeight: 900, color: 'white', lineHeight: 1.15, marginBottom: 20, letterSpacing: '-0.02em' },
    intro: { fontSize: 18, lineHeight: 1.7, color: '#CBD5E1', marginBottom: 40, paddingLeft: 20, borderLeft: '3px solid #F59E0B' },
    h2: { fontSize: 26, fontWeight: 800, color: 'white', marginBottom: 12, marginTop: 48, letterSpacing: '-0.01em' },
    h3: { fontSize: 19, fontWeight: 700, color: '#22D3EE', marginBottom: 10, marginTop: 28 },
    p: { fontSize: 16, lineHeight: 1.85, color: '#94A3B8', marginBottom: 18 },
    ul: { paddingLeft: 20, marginBottom: 20 },
    li: { fontSize: 16, lineHeight: 1.85, color: '#94A3B8', marginBottom: 8 },
    warn: { padding: '16px 20px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: 20 },
    highlight: { padding: '16px 20px', borderRadius: 10, background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)', marginBottom: 20 },
    ctaBanner: { padding: '28px 32px', borderRadius: 16, background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(236,72,153,0.08))', border: '1px solid rgba(34,211,238,0.25)', margin: '48px 0', textAlign: 'center' },
    ctaBtn: { display: 'inline-block', padding: '12px 32px', borderRadius: 10, background: 'linear-gradient(135deg, #22D3EE, #EC4899)', color: 'white', fontWeight: 700, fontSize: 15, textDecoration: 'none' },
    related: { marginTop: 48, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)' },
    relatedLinks: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    relatedLink: { padding: '6px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#22D3EE', fontSize: 13, textDecoration: 'none' },
    footer: { borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px 40px', textAlign: 'center', fontSize: 12, color: '#475569' },
  }

  return (
    <div style={s.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <nav style={s.nav}>
        <a href="/" style={s.logo}>Cam<span style={s.accent}>Cash</span></a>
        <a href="/"\1>Start Free →</a>
      </nav>
      <article style={s.article}>
        <nav style={s.bread}>
          <a href="/" style={s.breadLink}>Home</a><span style={s.sep}>›</span>
          <a href="/blog/cam-model-earnings" style={s.breadLink}>Earnings</a><span style={s.sep}>›</span>
          <span style={{ color: '#475569' }}>Cam Model Taxes</span>
        </nav>

        <h1 style={s.h1}>Cam Model Taxes: What to Track, What to Deduct, and How to File</h1>
        <p style={s.intro}>Tax season is stressful for most people. For cam models who've been depositing income with no records, it's a crisis. The good news: cam model taxes aren't complicated once you understand the basics. Here's everything you need to know.</p>

        <div style={s.warn}>
          <strong style={{ color: '#F59E0B' }}>Note:</strong>
          <span style={{ color: '#94A3B8' }}> This is general educational information. Tax laws vary by country and individual situation. Consult a tax professional for advice specific to your circumstances.</span>
        </div>

        <h2 style={s.h2}>Yes, Cam Model Income Is Taxable</h2>
        <p style={s.p}>In the US, Canada, UK, and most other countries: cam model earnings are taxable income. It doesn't matter that it's adult content, paid in tokens, or processed by a third party like Chaturbate.</p>
        <p style={s.p}>Chaturbate issues a 1099-NEC to US models who earn over $600 in a calendar year — and sends a copy to the IRS. Even below that threshold, you're legally required to report the income.</p>
        <p style={s.p}>You're classified as a self-employed independent contractor, which means you're responsible for both the employee and employer portions of self-employment tax — 15.3% in the US on top of your regular income tax rate.</p>

        <h2 style={s.h2}>What You Need to Track</h2>

        <h3 style={s.h3}>Every dollar you earn, per platform</h3>
        <p style={s.p}>Track income by platform separately — Chaturbate, BongaCams, MyFreeCams, etc. This matters both for tax reporting and for understanding which platform actually earns you more per hour. CamCash keeps detailed earnings records by platform automatically once you upload your CSV data.</p>

        <h3 style={s.h3}>Every business expense</h3>
        <p style={s.p}>This is where most models lose money — by not tracking deductions they're entitled to.</p>

        <h2 style={s.h2}>Deductions Cam Models Can Claim</h2>

        {[
          { title: 'Equipment', items: ['Webcam, ring lights, microphones, lighting', 'Computer or tablet used for streaming', 'Phone if used for content creation'] },
          { title: 'Home office / streaming space', items: ['Dedicated room used exclusively for streaming', 'Proportional rent/mortgage and utilities', 'Internet service (portion used for work)'] },
          { title: 'Interactive toys and props', items: ['Lovense Lush, Domi, Edge — used in streams = business equipment', 'Costumes, lingerie, props purchased specifically for streaming'] },
          { title: 'Software and subscriptions', items: ['Streaming software, editing tools', 'Analytics tools including CamCash', 'Any platform subscriptions used for work'] },
          { title: 'Professional services', items: ['Accountant fees related to your cam business', 'Legal fees related to your business', 'Courses or education purchased to improve performance'] },
        ].map(({ title, items }) => (
          <div key={title} style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 8 }}>{title}</div>
            <ul style={{ ...s.ul, marginBottom: 0 }}>
              {items.map(item => <li key={item} style={s.li}>{item}</li>)}
            </ul>
          </div>
        ))}

        <p style={{ ...s.p, fontSize: 14, color: '#475569' }}>Key rule: expenses must be ordinary and necessary for your business. Keep receipts for everything.</p>

        <h2 style={s.h2}>Quarterly Estimated Taxes</h2>
        <p style={s.p}>This is where many new self-employed earners get blindsided. As a self-employed individual in the US, you're required to pay taxes quarterly — not just once a year.</p>

        <div style={s.highlight}>
          <strong style={{ color: 'white', display: 'block', marginBottom: 8 }}>US Quarterly Deadlines:</strong>
          <ul style={{ ...s.ul, marginBottom: 0 }}>
            {[['Q1', 'April 15'], ['Q2', 'June 15'], ['Q3', 'September 15'], ['Q4', 'January 15 (following year)']].map(([q, d]) => (
              <li key={q} style={{ ...s.li, marginBottom: 4 }}><strong style={{ color: 'white' }}>{q}:</strong> {d}</li>
            ))}
          </ul>
        </div>

        <p style={s.p}>Simple approach: set aside 25–30% of every payout into a separate savings account specifically for taxes. Don't touch it. Whatever's left after your annual filing is yours.</p>

        <h2 style={s.h2}>How to Stay Organized Year-Round</h2>
        <ul style={s.ul}>
          <li style={s.li}>Open a <strong style={{ color: 'white' }}>separate bank account</strong> for cam income — never mix with personal funds</li>
          <li style={s.li}>Record total income by platform every month</li>
          <li style={s.li}>Save receipts for any business purchases (phone photo is fine)</li>
          <li style={s.li}>Use CamCash for clean earnings records by platform and session — useful for tax reporting and your own tracking</li>
          <li style={s.li}>Schedule one meeting with an accountant before your first tax season</li>
        </ul>

        <h2 style={s.h2}>Reality Check</h2>
        {[
          { myth: '"I don\'t need to report it because it\'s paid in tokens"', reality: 'Tokens convert to USD. The USD value is taxable income. Chaturbate reports it to the IRS — so should you.' },
          { myth: '"I can\'t deduct anything because it\'s adult content"', reality: 'The IRS doesn\'t make content-based distinctions for business deductions. Legitimate business expenses are deductible regardless.' },
          { myth: '"I won\'t get caught if I don\'t report"', reality: 'Chaturbate issues 1099s above $600 directly to the IRS. The risk isn\'t worth the cost.' },
        ].map(({ myth, reality }) => (
          <div key={myth} style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(248,113,113,0.04)', border: '1px solid rgba(248,113,113,0.1)', marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: '#F87171', fontWeight: 700, marginBottom: 4 }}>Myth: {myth}</div>
            <div style={{ fontSize: 14, color: '#94A3B8' }}>Reality: {reality}</div>
          </div>
        ))}

        <h2 style={s.h2}>Quick Action Plan</h2>
        <ul style={s.ul}>
          {[
            'Open a separate bank account for your cam income today',
            'Set up a savings account — deposit 25–30% of every payout',
            'Download your earnings history from each platform monthly',
            'Keep a running folder of receipts for business purchases',
            'Schedule a meeting with an accountant before your first tax season',
            'File quarterly estimated taxes to avoid underpayment penalties',
          ].map((item, i) => <li key={i} style={s.li}><strong style={{ color: 'white' }}>{i + 1}.</strong> {item}</li>)}
        </ul>

        <h2 style={s.h2}>FAQ</h2>
        {[
          { q: 'Do I have to pay taxes if I made under $600?', a: 'In the US, Chaturbate won\'t issue a 1099 below $600, but you\'re still legally required to report all self-employment income regardless of amount.' },
          { q: 'What\'s the self-employment tax rate?', a: '15.3% on net earnings in the US (covering Social Security and Medicare), on top of your regular income tax rate. This surprises many new self-employed earners.' },
          { q: 'Can I write off my home streaming setup?', a: 'Yes, if the space is used regularly and exclusively for streaming. Document the square footage and calculate the proportion of your home dedicated to business use.' },
          { q: 'Should I form an LLC?', a: 'An LLC offers liability protection and may provide tax advantages depending on your income level. Discuss with an accountant once your cam income is consistent.' },
        ].map(({ q, a }, i) => (
          <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 6 }}>{q}</div>
            <p style={{ ...s.p, marginBottom: 0 }}>{a}</p>
          </div>
        ))}

        <div style={s.ctaBanner}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'white', marginBottom: 8 }}>Keep clean earnings records automatically</div>
          <div style={{ fontSize: 14, color: '#94A3B8', marginBottom: 20 }}>CamCash tracks your earnings by platform and session — perfect for tax time. Free.</div>
          <a href="/login" style={s.ctaBtn}>Start Free with CamCash →</a>
        </div>

                <div style={s.related}>
          <div style={s.relatedTitle}>Related articles</div>
          <div style={s.relatedLinks}>
            <a href="/blog/cam-model-earnings" style={s.relatedLink}>Cam Model Earnings Guide</a>
            <a href="/blog/best-cam-model-tools" style={s.relatedLink}>Best Cam Model Tools</a>
            <a href="/blog/how-to-increase-cam-earnings" style={s.relatedLink}>How to Increase Cam Earnings</a>
          </div>
        </div>
      </article>
      <footer style={s.footer}>© 2026 CamCash — Built for cam models who want to grow</footer>
    </div>
  )
}

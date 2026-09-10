export const metadata = {
  title: 'Terms of Service — CamCash',
  description: 'Terms of Service for CamCash, the free analytics tool for cam models.',
}

export default function TermsPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#080b14',
      color: '#eef2ff',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: '60px 20px 80px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <a href="/" style={{ fontSize: 13, color: '#00d4c8', textDecoration: 'none', display: 'inline-block', marginBottom: 32 }}>← Back to CamCash</a>

        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#eef2ff', marginBottom: 8, marginTop: 0 }}>Terms of Service</h1>
        <p style={{ fontSize: 13, color: '#475569', marginBottom: 48 }}>Last updated: June 2026</p>

        <Section title="1. About CamCash">
          <p>CamCash (&ldquo;CamCash,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is an analytics platform for cam models, operated at camcashgrl.com. CamCash helps you understand your earnings, top tippers, best streaming times, and more by analyzing data you provide.</p>
          <p>By creating an account or using CamCash, you agree to these Terms of Service. If you do not agree, do not use the service.</p>
        </Section>

        <Section title="2. User Responsibilities">
          <p>By using CamCash, you agree to:</p>
          <ul>
            <li>Provide accurate information when creating your account and connecting your platforms.</li>
            <li>Maintain only one account per person. Multiple accounts are not permitted.</li>
            <li>Keep your login credentials confidential and notify us immediately of any unauthorized access.</li>
            <li>Use CamCash only for lawful purposes and in accordance with these Terms.</li>
            <li>Not attempt to reverse-engineer, scrape, or interfere with the platform.</li>
          </ul>
        </Section>

        <Section title="3. Data We Store">
          <p>To provide the CamCash service, we store the following data:</p>
          <ul>
            <li><strong>Account information:</strong> your email address and encrypted password (via Supabase Auth).</li>
            <li><strong>Platform usernames:</strong> your Chaturbate, BongaCams, or MyFreeCams broadcaster username.</li>
            <li><strong>API tokens:</strong> your Chaturbate Stats API token or Events API token, stored encrypted.</li>
            <li><strong>Earnings and tip data:</strong> transaction records imported from your CSV uploads or synced via the Stats API, including tip amounts, timestamps, and tipper usernames.</li>
          </ul>
          <p>This data is used exclusively to power your personal analytics dashboard.</p>
        </Section>

        <Section title="4. Token Security">
          <p>Your platform API tokens are stored securely in our database with encryption at rest. We do not sell, share, rent, or disclose your tokens or earnings data to any third party. Your data is used solely to generate your personal analytics and is never used for advertising, resale, or any purpose other than providing the CamCash service.</p>
        </Section>

        <Section title="5. No Uptime or Accuracy Guarantee">
          <p>CamCash is provided &ldquo;as is&rdquo; without warranty of any kind. We do not guarantee:</p>
          <ul>
            <li>Uninterrupted or error-free access to the service.</li>
            <li>The accuracy, completeness, or timeliness of analytics or earnings data.</li>
            <li>That API syncs or CSV imports will succeed at all times.</li>
          </ul>
          <p>We are not liable for any decisions made based on information displayed in the dashboard.</p>
        </Section>

        <Section title="6. Pro Subscription">
          <p>CamCash offers a Pro subscription plan with access to additional features. By subscribing:</p>
          <ul>
            <li>You authorize us to charge your payment method on a monthly basis.</li>
            <li>You may cancel at any time — cancellation takes effect at the end of the current billing period.</li>
            <li>We do not offer refunds for partial billing periods.</li>
            <li>We reserve the right to change subscription pricing with 30 days&apos; notice.</li>
          </ul>
          <p>Payments are processed by Stripe. We do not store your payment card information.</p>
        </Section>

        <Section title="7. Account Termination">
          <p>We reserve the right to suspend or terminate your account at our discretion if you violate these Terms or engage in abusive behavior. You may delete your account at any time by emailing support@camcashgrl.com. Upon account deletion, your data will be removed from our systems within 30 days.</p>
        </Section>

        <Section title="8. Governing Law">
          <p>These Terms are governed by the laws of the United States. Any disputes will be resolved in the applicable courts of the United States.</p>
        </Section>

        <Section title="9. Contact">
          <p>If you have questions about these Terms, contact us at <a href="mailto:support@camcashgrl.com" style={{ color: '#00d4c8' }}>support@camcashgrl.com</a>.</p>
        </Section>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 48, paddingTop: 24, fontSize: 12, color: '#334155', textAlign: 'center' }}>
          <a href="/privacy" style={{ color: '#475569', textDecoration: 'none', marginRight: 16 }}>Privacy Policy</a>
          <a href="/" style={{ color: '#475569', textDecoration: 'none' }}>camcashgrl.com</a>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#00d4c8', marginBottom: 12, marginTop: 0 }}>{title}</h2>
      <div style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  )
}

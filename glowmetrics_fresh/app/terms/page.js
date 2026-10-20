export const metadata = {
  title: 'Terms of Service — CamCash',
  description: 'Terms of Service for CamCash, the analytics platform for cam models.',
}

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#080b14', color: '#eef2ff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", padding: '60px 20px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <a href="/" style={{ fontSize: 13, color: '#00d4c8', textDecoration: 'none', display: 'inline-block', marginBottom: 32 }}>← Back to CamCash</a>

        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#eef2ff', marginBottom: 8, marginTop: 0 }}>Terms of Service</h1>
        <p style={{ fontSize: 13, color: '#475569', marginBottom: 48 }}>Last updated: October 2026</p>

        <Section title="1. About CamCash">
          <p>CamCash (&ldquo;CamCash,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is an analytics platform for cam models, operated at camcashgrl.com. CamCash helps you understand earnings, fan activity, streaming performance, and related trends from data you provide or collect through supported CamCash tools.</p>
          <p>By creating an account or using CamCash, you agree to these Terms of Service. If you do not agree, do not use the service.</p>
        </Section>

        <Section title="2. User Responsibilities">
          <p>By using CamCash, you agree to:</p>
          <ul>
            <li>Provide accurate information when creating your account and connecting your platforms.</li>
            <li>Maintain only one account per person. Multiple accounts are not permitted.</li>
            <li>Keep your login credentials confidential and notify us immediately of unauthorized access.</li>
            <li>Use CamCash only for lawful purposes and in accordance with these Terms.</li>
            <li>Not attempt to reverse-engineer, scrape, or interfere with the platform.</li>
          </ul>
        </Section>

        <Section title="3. Data We Store">
          <p>To provide CamCash, we may store:</p>
          <ul>
            <li><strong>Account information:</strong> your email address and encrypted authentication data.</li>
            <li><strong>Platform usernames:</strong> supported broadcaster usernames you provide.</li>
            <li><strong>API or extension connection data:</strong> credentials or tokens needed to sync supported services, stored securely.</li>
            <li><strong>Earnings, tip, fan, session, and Live Mode data:</strong> records imported from CSVs, onboarding, supported APIs, browser extension capture, or Live Mode.</li>
          </ul>
          <p>You may upload more data than your current plan displays. CamCash may retain that additional data so it can be unlocked after an upgrade and so we can generate truthful locked previews or aggregate teaser messages. Stored data outside your plan limits does not become fully viewable merely because it was uploaded.</p>
        </Section>

        <Section title="4. Free Plan Limits">
          <p>The Free plan is designed to provide an ongoing useful preview of CamCash while reserving deeper analysis for Pro.</p>
          <ul>
            <li>Free provides detailed analytics for one selected analytics platform.</li>
            <li>Visible analytics are limited to a rolling 31-day window.</li>
            <li>You may upload additional platforms and older history; that extra data can be stored for platform comparison, locked previews, and future Pro access.</li>
            <li>Platform comparison may remain visible on Free, while other advanced insights can appear only as locked or blurred previews.</li>
            <li>Free Live Mode may be limited by number of streams and active minutes.</li>
          </ul>
        </Section>

        <Section title="5. Free Trial">
          <p>CamCash may offer a 7-day Pro trial. A trial is not the same as a fully paid Pro subscription.</p>
          <ul>
            <li>A payment method may be required to start the trial.</li>
            <li>The trial is limited to one analytics platform and a rolling 31 days of visible analytics.</li>
            <li>The trial includes platform comparison and up to two Live Mode sessions, each limited to 30 active minutes.</li>
            <li>Older uploaded history and additional-platform data may remain stored and locked during the trial.</li>
            <li>Unless you cancel before the trial ends, your selected paid subscription may begin automatically and your payment method may be charged.</li>
            <li>You can manage or cancel your subscription through the CamCash subscription-management controls or Stripe billing portal.</li>
          </ul>
          <p>Any trial-specific limits shown at the time you start the trial form part of these Terms.</p>
        </Section>

        <Section title="6. Token and Data Security">
          <p>Your supported platform connection data is stored securely. We do not sell your earnings or fan data. We use your stored information to provide CamCash analytics, product features, locked upgrade previews, account communications, and service operations.</p>
        </Section>

        <Section title="7. No Uptime or Accuracy Guarantee">
          <p>CamCash is provided &ldquo;as is&rdquo; without warranty of any kind. We do not guarantee:</p>
          <ul>
            <li>Uninterrupted or error-free access to the service.</li>
            <li>The accuracy, completeness, or timeliness of analytics or earnings data.</li>
            <li>That API syncs, browser capture, Live Mode, or CSV imports will succeed at all times.</li>
          </ul>
          <p>We are not liable for decisions made based on information displayed in the dashboard.</p>
        </Section>

        <Section title="8. Pro Subscription and Billing">
          <p>CamCash offers a Pro subscription with access to additional features. By subscribing:</p>
          <ul>
            <li>You authorize us and Stripe to charge your payment method according to the billing interval you select.</li>
            <li>Current standard pricing may include monthly or annual options shown on the pricing page at checkout.</li>
            <li>You may cancel at any time. Cancellation timing and access duration are determined by Stripe and the subscription state shown in your account.</li>
            <li>We do not guarantee refunds for partial billing periods unless required by law.</li>
            <li>We reserve the right to change subscription pricing with advance notice where required.</li>
          </ul>
          <p>Payments are processed by Stripe. We do not store your payment card number.</p>
        </Section>

        <Section title="9. Account Termination">
          <p>We reserve the right to suspend or terminate your account if you violate these Terms or abuse the service. You may request account deletion through available account controls or by contacting support. Data deletion timing may be subject to operational, legal, backup, or fraud-prevention requirements.</p>
        </Section>

        <Section title="10. Governing Law">
          <p>These Terms are governed by applicable United States law. Any disputes will be handled in the applicable courts or forums required by law.</p>
        </Section>

        <Section title="11. Contact">
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
      <div style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.8 }}>{children}</div>
    </div>
  )
}

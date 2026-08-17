export const metadata = {
  title: 'Free Cam Model Tools — Room Title Generator & Token Calculator | CamCash',
  description: 'Free tools for cam models. Generate viral Chaturbate room titles and instantly convert tokens to USD. No account required.',
}

import SiteFooter from '../components/SiteFooter'

export default function ToolsPage() {
  return (
    <div style={{ background: '#0a0814', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '60px 32px 48px' }}>

        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a855f7', marginBottom: '12px' }}>
            Free Tools
          </div>
          <h1 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: '800', margin: '0 0 16px', lineHeight: 1.15 }}>
            Free cam model tools
          </h1>
          <p style={{ fontSize: '17px', color: '#64748b', margin: 0, maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
            No sign-up. No credit card. Use them right now, completely free.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px,100%),1fr))', gap: '24px', marginBottom: '48px' }}>

          {/* Cam Model Name Generator */}
          <a href="/tools/cam-model-name-generator" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'rgba(255,43,174,0.06)',
              border: '1px solid rgba(255,43,174,0.22)',
              borderRadius: '16px',
              padding: '36px 28px',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>💫</div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', margin: '0 0 10px' }}>
                Cam Model Name Generator
              </h2>
              <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: '1.6', margin: '0 0 20px' }}>
                Generate cute, sexy, luxury, or bratty stage name ideas with brand strength scoring and domain availability checks.
              </p>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#ff2bae' }}>
                Try it free →
              </div>
            </div>
          </a>

          {/* Creator Profile Studio */}
          <a href="/tools/profile-studio" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(22,244,255,0.08), rgba(255,43,174,0.08))',
              border: '1px solid rgba(22,244,255,0.28)',
              borderRadius: '16px',
              padding: '36px 28px',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>✍️</div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', margin: '0 0 10px' }}>
                Creator Profile Studio
              </h2>
              <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: '1.6', margin: '0 0 20px' }}>
                Build a platform-ready cam bio and a fully editable, smartly priced tip menu — both personalized to your persona, boundaries, and goals.
              </p>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#16F4FF' }}>
                Try it free →
              </div>
            </div>
          </a>

          {/* Room Title Generator */}
          <a href="/guides/chaturbate-room-title-generator" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'rgba(168,85,247,0.07)',
              border: '1px solid rgba(168,85,247,0.25)',
              borderRadius: '16px',
              padding: '36px 28px',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>✏️</div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', margin: '0 0 10px' }}>
                Chaturbate Room Title Generator
              </h2>
              <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: '1.6', margin: '0 0 20px' }}>
                Generate click-worthy room titles that get you more viewers. Pick your vibe, your goal, your toy — get a title that converts.
              </p>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#a855f7' }}>
                Try it free →
              </div>
            </div>
          </a>

          {/* Token Calculator */}
          <a href="/guides/chaturbate-token-calculator" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'rgba(34,211,238,0.06)',
              border: '1px solid rgba(34,211,238,0.2)',
              borderRadius: '16px',
              padding: '36px 28px',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>💰</div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', margin: '0 0 10px' }}>
                Chaturbate Token Calculator
              </h2>
              <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: '1.6', margin: '0 0 20px' }}>
                Instantly convert any token amount to USD. See your real take-home pay at any payout rate. Works for tips, goals, and menus.
              </p>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#22d3ee' }}>
                Try it free →
              </div>
            </div>
          </a>

          {/* Income Tracker */}
          <a href="/guides/cam-model-income-tracker" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.22)',
              borderRadius: '16px',
              padding: '36px 28px',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>📊</div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', margin: '0 0 10px' }}>
                Cam Model Income Tracker
              </h2>
              <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: '1.6', margin: '0 0 20px' }}>
                See your real earnings by session, hour of day, platform, and individual fan — not just a total token count.
              </p>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>
                Try it free →
              </div>
            </div>
          </a>
        </div>

        {/* More tools coming */}
        <div style={{
          textAlign: 'center',
          padding: '32px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '12px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>🔜</div>
          <div style={{ fontSize: '15px', fontWeight: '600', color: '#f1f5f9', marginBottom: '6px' }}>More tools coming soon</div>
          <div style={{ fontSize: '14px', color: '#475569' }}>Best-time finder, fan re-engagement tool and more.</div>
        </div>

      </div>
      <SiteFooter />
    </div>
  )
}

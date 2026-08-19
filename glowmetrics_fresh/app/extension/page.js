export const metadata = {
  title: 'CamCash Chrome Extension — Automatically Track Cam Earnings',
  description: 'Install once and automatically sync live tips on Chaturbate, BongaCams, and MyFreeCams. Free cam earnings tracker. No spreadsheets.',
  alternates: { canonical: 'https://www.camcashgrl.com/extension' },
  openGraph: {
    title: 'CamCash Chrome Extension — Automatically Track Cam Earnings',
    description: 'Install once and automatically sync live tips. Free for cam models.',
    url: 'https://www.camcashgrl.com/extension',
    siteName: 'CamCash',
    type: 'website',
  },
}

import ExtensionDownloadButton from '../components/ExtensionDownloadButton'

// Matches the gradient in components/ui/Button.js — single source of truth
// for the app's signature CTA gradient.
const BRAND_GRADIENT = 'linear-gradient(90deg,#21E6F3,#6C5CFF,#FF2FAE)'

const C = {
  bg: '#040812',
  card: '#0d1424',
  border: 'rgba(168,85,247,0.15)',
  purple: '#a855f7',
  pink: '#ec4899',
  cyan: '#22d3ee',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#f87171',
  white: '#f1f5f9',
  text: '#94a3b8',
  muted: '#475569',
}

export default function ExtensionPage() {
  return (
    <div style={{ background: C.bg, color: C.white, minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* NAV */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(4,8,18,0.95)',
        borderBottom: `1px solid ${C.border}`,
        backdropFilter: 'blur(12px)',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '58px', gap: '12px',
      }}>
        <a href="/" style={{ textDecoration: 'none', fontWeight: '800', fontSize: '17px', color: C.white, letterSpacing: '-0.3px', flexShrink: 0 }}>
          💜 CamCash
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <a href="/" style={{ color: C.muted, fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>Analytics</a>
          <a href="/live" style={{ color: C.muted, fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>Go Live</a>
          <a href="/landing/demo" style={{ color: C.muted, fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>Demo</a>
          <ExtensionDownloadButton
            label="Install Free"
            style={{
              background: BRAND_GRADIENT,
              color: '#fff',
              textDecoration: 'none',
              padding: '7px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              whiteSpace: 'nowrap',
            }}
          />
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: '72px 24px 64px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Background glow */}
        <div style={{ position: 'absolute', width: 600, height: 600, top: '-10%', left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(168,85,247,0.08), transparent 60%)', filter: 'blur(80px)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: '640px', margin: '0 auto', position: 'relative' }}>

          {/* Status badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            padding: '5px 14px', borderRadius: '20px',
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.25)',
            marginBottom: '28px',
          }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: C.green, boxShadow: `0 0 7px ${C.green}`, flexShrink: 0 }} />
            <span style={{ fontSize: '12px', fontWeight: '700', color: C.green, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Free Chrome Extension
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(32px, 5.5vw, 54px)',
            fontWeight: '900',
            lineHeight: '1.08',
            letterSpacing: '-0.03em',
            color: C.white,
            margin: '0 0 20px',
          }}>
            Automatically Track<br />
            <span style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Cam Earnings
            </span>
          </h1>

          <p style={{
            fontSize: 'clamp(15px, 2.5vw, 18px)',
            color: C.text,
            lineHeight: '1.7',
            margin: '0 auto 36px',
            maxWidth: '460px',
          }}>
            Install once. Tips sync live. No spreadsheets, no manual entry — automatic earnings tracking while you stream.
          </p>

          {/* Primary CTA — direct download, no scroll */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
            <ExtensionDownloadButton
              label="📥 Install Chrome Extension — Free"
              style={{
                display: 'inline-block',
                background: BRAND_GRADIENT,
                color: '#fff',
                textDecoration: 'none',
                padding: '16px 32px',
                borderRadius: '12px',
                fontSize: '17px',
                fontWeight: '800',
                boxShadow: '0 0 14px rgba(33,230,243,0.16),0 0 28px rgba(255,47,174,0.10)',
              }}
            />
            <a href="/live" style={{
              display: 'inline-block',
              padding: '16px 24px',
              borderRadius: '12px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              color: C.text,
              textDecoration: 'none',
              fontSize: '15px',
              fontWeight: '600',
            }}>
              🔴 Open Live Dashboard
            </a>
          </div>

          {/* Trust indicators */}
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '28px' }}>
            {['Free to start', 'No passwords stored', '17 KB', 'Chrome only'].map(t => (
              <span key={t} style={{ fontSize: '12px', color: C.muted, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ color: C.green, fontWeight: '700' }}>✓</span> {t}
              </span>
            ))}
          </div>

          {/* Platform logos */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: C.muted, alignSelf: 'center', marginRight: '4px' }}>Works on:</span>
            {['Chaturbate', 'BongaCams', 'MyFreeCams'].map(p => (
              <span key={p} style={{
                fontSize: '12px', fontWeight: '600', color: C.muted,
                padding: '5px 13px', borderRadius: '20px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* EXTENSION POPUP PREVIEW */}
      <section style={{ padding: '0 24px 72px', textAlign: 'center' }}>
        <div style={{
          maxWidth: '300px', margin: '0 auto',
          background: '#0b1220',
          border: '1px solid rgba(168,85,247,0.3)',
          borderRadius: '16px',
          boxShadow: '0 0 48px rgba(168,85,247,0.15), 0 24px 60px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          textAlign: 'left',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(124,58,237,0.15))',
            borderBottom: '1px solid rgba(168,85,247,0.2)',
            padding: '14px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '14px', fontWeight: '800', color: C.white }}>💜 CamCash Live</span>
            <span style={{ background: 'rgba(239,68,68,0.18)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em' }}>
              🔴 LIVE
            </span>
          </div>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '13px', color: C.text, lineHeight: '1.8', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span>👁️ 94 viewers</span>
              <span style={{ color: C.muted }}>·</span>
              <span style={{ color: C.green }}>💰 $12.50 earned</span>
              <span style={{ color: C.muted }}>·</span>
              <span style={{ color: C.cyan }}>⚡ Rising</span>
            </div>
          </div>
          <div style={{ padding: '14px 16px', background: 'rgba(34,211,238,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '12px', color: C.cyan, lineHeight: '1.6' }}>
              💡 xDarkMatter3 is active — 87% tip probability
            </div>
          </div>
          <div style={{ padding: '12px 16px' }}>
            <div style={{ background: BRAND_GRADIENT, color: '#fff', padding: '9px 0', borderRadius: '8px', textAlign: 'center', fontSize: '12px', fontWeight: '700' }}>
              Open Dashboard →
            </div>
          </div>
          <div style={{ padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: C.muted }}>Chaturbate · Session 52:18</div>
          </div>
        </div>
      </section>

      {/* 3-STEP HOW IT WORKS */}
      <section style={{ padding: '0 24px 72px', background: 'rgba(255,255,255,0.012)', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', paddingTop: '56px', paddingBottom: '56px' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>How it works</div>
            <div style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: '800', color: C.white }}>Up and running in 60 seconds</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '20px' }}>
            {[
              {
                n: '1', icon: '📥', title: 'Install Extension',
                body: 'Download ZIP, unzip, open Chrome Extensions, enable Developer Mode, click Load Unpacked.',
              },
              {
                n: '2', icon: '🔗', title: 'Connect Account',
                body: 'Create your free CamCash account in 30 seconds. No credit card.',
              },
              {
                n: '3', icon: '⚡', title: 'Earnings Sync',
                body: 'Tips appear live as you stream. Everything tracked automatically.',
              },
            ].map(s => (
              <div key={s.n} style={{
                padding: '28px 22px', borderRadius: '16px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                textAlign: 'center',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: BRAND_GRADIENT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: '800', color: '#fff',
                  margin: '0 auto 14px',
                }}>
                  {s.n}
                </div>
                <div style={{ fontSize: '26px', marginBottom: '12px' }}>{s.icon}</div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: C.white, marginBottom: '8px' }}>{s.title}</div>
                <div style={{ fontSize: '13px', color: C.text, lineHeight: '1.6' }}>{s.body}</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <ExtensionDownloadButton
              label="📥 Download Extension — Free"
              style={{
                display: 'inline-block',
                background: BRAND_GRADIENT,
                color: '#fff',
                textDecoration: 'none',
                padding: '14px 32px',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '800',
              }}
            />
            <div style={{ fontSize: '12px', color: C.muted, marginTop: '10px' }}>
              Chrome → Extensions → Developer mode → Load unpacked
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE CARDS */}
      <section style={{ padding: '56px 24px 72px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: '800', color: C.white, marginBottom: '8px' }}>What it tracks</div>
            <div style={{ fontSize: '14px', color: C.muted }}>Everything you care about, automatically.</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {[
              { icon: '🔴', color: C.red,   title: 'Live Tip Tracking',    desc: 'Every tip detected the moment it hits — see your session total update in real time.' },
              { icon: '⚡', color: C.cyan,  title: 'Auto Earnings Sync',   desc: 'Zero manual entry. Everything is tracked automatically, every session.' },
              { icon: '📊', color: C.green, title: 'Session Bookkeeping',  desc: 'Every session logged with earnings, viewers, and tip breakdowns. Ready for tax time.' },
              { icon: '💰', color: C.amber, title: 'Payout Tracking',      desc: 'Know exactly what you earned across all platforms, all in one place.' },
            ].map(f => (
              <div key={f.title} style={{
                padding: '24px',
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: f.color + '18',
                  border: `1px solid ${f.color}28`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px', marginBottom: '14px',
                }}>
                  {f.icon}
                </div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: C.white, marginBottom: '8px' }}>{f.title}</div>
                <div style={{ fontSize: '13px', color: C.text, lineHeight: '1.65' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST SECTION */}
      <section style={{ padding: '0 24px 72px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div style={{
            background: 'rgba(16,185,129,0.05)',
            border: '1px solid rgba(16,185,129,0.18)',
            borderRadius: '16px',
            padding: '36px 32px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '24px',
            textAlign: 'center',
          }}>
            {[
              { icon: '🔒', title: 'No Passwords Stored',   desc: 'We never touch your platform login.' },
              { icon: '👑', title: 'Creator-Focused',       desc: 'Built for cam models — nothing else.' },
              { icon: '🛡️', title: 'Privacy-Safe',          desc: 'Your data stays yours. No selling.' },
              { icon: '🆓', title: 'Free to start',         desc: 'Live coaching + tip feed in the free tier.' },
            ].map(t => (
              <div key={t.title}>
                <div style={{ fontSize: '26px', marginBottom: '8px' }}>{t.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: C.white, marginBottom: '5px' }}>{t.title}</div>
                <div style={{ fontSize: '12px', color: C.muted, lineHeight: '1.5' }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FREE VS PRO — set expectations up front so nothing looks "broken" */}
      <section style={{ padding: '0 24px 72px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>What's free vs. what's Pro</div>
            <div style={{ fontSize: 'clamp(20px, 2.5vw, 26px)', fontWeight: '800', color: C.white }}>No surprises — here's exactly what you get</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
            <div style={{ padding: '26px', borderRadius: '16px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: C.green, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>🆓 Free to start</div>
              {[
                'Live tip feed while you stream',
                'Real-time AI coaching (whale alerts, dead-air prompts, streak tips)',
                'Works on Chaturbate, BongaCams, and MyFreeCams',
                'No account required to install',
              ].map(t => (
                <div key={t} style={{ display: 'flex', gap: '8px', fontSize: '13px', color: C.text, lineHeight: '1.6', marginBottom: '8px' }}>
                  <span style={{ color: C.green, flexShrink: 0 }}>✓</span><span>{t}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '26px', borderRadius: '16px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: C.amber, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>🔒 Requires Pro</div>
              {[
                'Tips saved permanently to your dashboard',
                'Historical trends — best hours, best days, revenue over time',
                'Top-fan tracking with churn-risk alerts',
                'Platform comparison ($/hr across sites)',
              ].map(t => (
                <div key={t} style={{ display: 'flex', gap: '8px', fontSize: '13px', color: C.text, lineHeight: '1.6', marginBottom: '8px' }}>
                  <span style={{ color: C.amber, flexShrink: 0 }}>✓</span><span>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <p style={{ fontSize: '12px', color: C.muted, textAlign: 'center', marginTop: '20px', lineHeight: '1.6' }}>
            Without Pro, your live tip feed and coaching still work every session — your tips just aren't kept after the session ends. If tips seem to "disappear" between streams, that's expected on the free plan, not a bug.
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding: '0 24px 100px', textAlign: 'center' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: '900', color: C.white, marginBottom: '14px', lineHeight: '1.15', letterSpacing: '-0.02em' }}>
            Ready to stop<br />guessing your earnings?
          </div>
          <p style={{ fontSize: '15px', color: C.muted, marginBottom: '32px', lineHeight: '1.65' }}>
            Install CamCash and your earnings start syncing automatically. Free, instant, no manual work.
          </p>
          <ExtensionDownloadButton
            label="📥 Install CamCash — Free"
            style={{
              display: 'inline-block',
              background: BRAND_GRADIENT,
              color: '#fff',
              textDecoration: 'none',
              padding: '18px 48px',
              borderRadius: '14px',
              fontSize: '18px',
              fontWeight: '800',
              boxShadow: '0 0 14px rgba(33,230,243,0.16),0 0 28px rgba(255,47,174,0.10)',
              marginBottom: '18px',
            }}
          />
          <div style={{ fontSize: '13px', color: C.muted }}>
            Already installed?{' '}
            <a href="/live" style={{ color: C.purple, fontWeight: '700', textDecoration: 'none' }}>
              Open Live Dashboard →
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '20px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
      }}>
        <div style={{ fontSize: '12px', color: C.muted }}>© 2026 CamCash — Built for cam models who want to grow</div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <a href="/" style={{ fontSize: '12px', color: C.muted, textDecoration: 'none' }}>Analytics Dashboard</a>
          <a href="/live" style={{ fontSize: '12px', color: C.muted, textDecoration: 'none' }}>Live Dashboard</a>
          <a href="/landing/demo" style={{ fontSize: '12px', color: C.muted, textDecoration: 'none' }}>Demo</a>
          <a href="#" style={{ fontSize: '12px', color: C.muted, textDecoration: 'none' }}>Privacy</a>
          <a href="#" style={{ fontSize: '12px', color: C.muted, textDecoration: 'none' }}>Terms</a>
        </div>
      </div>

    </div>
  )
}

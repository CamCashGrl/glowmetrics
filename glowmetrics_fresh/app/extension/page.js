export const metadata = {
  title: 'CamCash Chrome Extension — Free Real-Time Tip Tracking for Cam Models',
  description: 'Free Chrome extension for cam models. Auto-detect tips on Chaturbate, BongaCams, MyFreeCams and Stripchat. Works immediately — no account required. Real-time coaching and analytics.',
}

import SiteFooter from '../components/SiteFooter'
import FreeToolsBanner from '../components/FreeToolsBanner'

const C = {
  bg: '#040812', card: '#0d1424',
  border: 'rgba(168,85,247,0.15)', borderCyan: 'rgba(34,211,238,0.18)',
  purple: '#a855f7', pink: '#ec4899', cyan: '#22d3ee',
  green: '#10b981', gold: '#f59e0b', white: '#f1f5f9',
  text: '#94a3b8', muted: '#475569',
}

const navLink = {
  color: '#94a3b8', textDecoration: 'none',
  fontSize: '14px', fontWeight: '500',
  padding: '6px 10px',
}

const freeFeatures = [
  { icon: '📊', title: 'Tip Detection', desc: 'Auto-detects every tip on supported platforms instantly' },
  { icon: '🔴', title: 'Live Overlay', desc: 'See your stats without leaving your stream' },
  { icon: '🚨', title: 'Real-Time Alerts', desc: 'Whale alerts, high-tip notifications, momentum signals' },
  { icon: '🎯', title: 'Basic Coaching', desc: 'AI suggestions while you stream' },
  { icon: '📈', title: 'Session Analytics', desc: 'Current session earnings, viewers, tip rate' },
  { icon: '🌐', title: '4 Platforms', desc: 'Chaturbate, BongaCams, MyFreeCams, Stripchat' },
]

const accountFeatures = [
  'Save session history',
  'Track performance trends over time',
  'AI learns your patterns',
  'Fan behavior insights',
  'Multi-session intelligence',
  'Access your analytics from any device',
]

const steps = [
  { icon: '📥', title: 'Download', desc: 'Download the ZIP file above' },
  { icon: '📦', title: 'Unzip', desc: 'Unzip the folder on your computer' },
  { icon: '🔧', title: 'Developer Mode', desc: 'Go to Chrome → Extensions → turn on Developer Mode (top right toggle)' },
  { icon: '📂', title: 'Load Unpacked', desc: 'Click Load unpacked → select the unzipped camcash folder' },
  { icon: '🔴', title: 'Go Live', desc: 'Sign in with your CamCash account and go live' },
]

const tableRows = [
  ['Tip detection',          '✅', '✅', '✅'],
  ['Live overlay',           '✅', '✅', '✅'],
  ['Real-time alerts',       '✅', '✅', '✅'],
  ['Basic coaching',         '✅', '✅', '✅'],
  ['Save session history',   '❌', '✅', '✅'],
  ['AI pattern learning',    '❌', '✅', '✅'],
  ['Performance trends',     '❌', 'Limited', '✅ Full'],
  ['Fan behavior analysis',  '❌', '❌', '✅'],
  ['Multi-month tracking',   '❌', '❌', '✅'],
  ['Price',                  'Free', 'Free', '$9.99–19.99/mo'],
]

const blogPosts = [
  { href: '/blog/how-to-get-veiws-on-chaturbate',              title: 'How to Get More Viewers on Chaturbate' },
  { href: '/blog/how-to-make-more-money-on-chaturbate',        title: 'Make More Money on Chaturbate' },
  { href: '/blog/how-to-build-loyal-fans',                     title: 'Build a Loyal Fanbase That Tips' },
  { href: '/blog/best-cam-model-tools',                        title: 'Best Cam Model Tools' },
  { href: '/blog/how-to-re-engage-whales-and-top-tippers',     title: 'Re-Engage Your Top Tippers' },
  { href: '/blog/why-cam-streams-arent-making-money',          title: "Why Streams Aren't Making Money" },
]

export default function ExtensionPage() {
  return (
    <div style={{ background: C.bg, color: C.white, minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── 1. TOP NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(4,8,18,0.95)',
        borderBottom: `1px solid ${C.border}`,
        backdropFilter: 'blur(12px)',
        padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '60px',
      }}>
        <a href="/" style={{ textDecoration: 'none', fontWeight: '800', fontSize: '17px', color: C.white, letterSpacing: '-0.3px' }}>
          💜 CamCash
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <a href="/"        style={navLink}>Home</a>
          <a href="/demo"    style={navLink}>Demo</a>
          <a href="/pricing" style={navLink}>Pricing</a>
          <a href="/landing" style={{
            background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
            color: '#fff', textDecoration: 'none',
            padding: '7px 16px', borderRadius: '8px',
            fontSize: '13px', fontWeight: '700',
          }}>
            Create Account →
          </a>
        </div>
      </nav>

      {/* ── 2. HERO ── */}
      <section style={{
        paddingTop: '72px', paddingBottom: '80px',
        textAlign: 'center', padding: '72px 24px 80px',
      }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div style={{
            fontSize: '11px', fontWeight: '800', letterSpacing: '0.14em',
            textTransform: 'uppercase', color: C.cyan, marginBottom: '18px',
          }}>
            FREE · NO ACCOUNT REQUIRED
          </div>

          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: '900',
            lineHeight: '1.15', letterSpacing: '-0.02em',
            color: C.white, margin: '0 0 20px',
          }}>
            The extension that works the moment you install it
          </h1>

          <p style={{
            fontSize: 'clamp(15px, 2.5vw, 18px)', color: C.text,
            lineHeight: '1.7', margin: '0 0 36px',
          }}>
            CamCash auto-detects tips on Chaturbate, BongaCams, MyFreeCams, and Stripchat.
            Live coaching, real-time alerts, tip tracking — completely free.
          </p>

          <a href="#download" style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
            color: '#fff', textDecoration: 'none',
            padding: '16px 36px', borderRadius: '12px',
            fontSize: '17px', fontWeight: '800',
            boxShadow: '0 0 32px rgba(168,85,247,0.35)',
            marginBottom: '20px',
          }}>
            📥 Download Extension Free
          </a>

          <div style={{ marginBottom: '20px' }}>
            <a href="/landing" style={{
              color: C.muted, fontSize: '14px', textDecoration: 'none',
            }}>
              or create a free account for full analytics →
            </a>
          </div>

          <div style={{ fontSize: '12px', color: C.muted, letterSpacing: '0.04em' }}>
            v2.1.0 · Chrome · 17 KB · No account needed
          </div>

          {/* QR code — scan to open this page on mobile */}
          <div style={{ marginTop: '36px', display: 'inline-block', padding: '16px', background: '#fff', borderRadius: '14px', boxShadow: '0 0 32px rgba(168,85,247,0.25)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https%3A%2F%2Fwww.camcashgrl.com%2Fextension&color=7c3aed&bgcolor=ffffff&qzone=1"
              alt="QR code to download the CamCash extension"
              width="160" height="160"
              style={{ display: 'block', borderRadius: '6px' }}
            />
          </div>
          <div style={{ fontSize: '12px', color: C.muted, marginTop: '10px' }}>
            Scan to open on another device
          </div>
        </div>
      </section>

      {/* ── 3. LAUNCH PHASE TRANSPARENCY BANNER ── */}
      <section style={{ padding: '0 24px 60px' }}>
        <div style={{
          maxWidth: '760px', margin: '0 auto',
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: '16px', padding: '32px 36px',
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: C.white, margin: '0 0 12px' }}>
            🎉 Everything Is Free Right Now (Launch Phase)
          </h2>
          <p style={{ color: C.text, lineHeight: '1.7', margin: '0 0 8px', fontSize: '15px' }}>
            CamCash works <strong style={{ color: C.white }}>FREE</strong> with the extension — no account needed.
            <br />
            Create a free account to save analytics. After 100 users: free tier + optional premium.
          </p>
          <p style={{ color: C.muted, fontSize: '14px', margin: '0 0 16px', fontStyle: 'italic' }}>
            We&apos;re transparent about this because trust matters.
          </p>
          <a href="/pricing" style={{ color: C.green, fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>
            See our full pricing →
          </a>
        </div>
      </section>

      {/* ── 4. WHAT'S FREE WITHOUT AN ACCOUNT ── */}
      <section style={{ padding: '0 24px 60px' }}>
        <div style={{
          maxWidth: '760px', margin: '0 auto',
          background: C.card,
          border: '1px solid rgba(34,211,238,0.2)',
          borderRadius: '16px', padding: '40px 36px',
        }}>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: C.white, margin: '0 0 6px' }}>
            ✅ Free Extension (No Account Needed)
          </h2>
          <p style={{ color: C.text, fontSize: '14px', margin: '0 0 32px', fontWeight: '600' }}>
            Works offline. Works solo. Works forever free.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
          }}>
            {freeFeatures.map((f) => (
              <div key={f.title} style={{
                background: 'rgba(34,211,238,0.05)',
                border: '1px solid rgba(34,211,238,0.12)',
                borderRadius: '12px', padding: '20px',
              }}>
                <div style={{ fontSize: '26px', marginBottom: '10px' }}>{f.icon}</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: C.white, marginBottom: '6px' }}>{f.title}</div>
                <div style={{ fontSize: '13px', color: C.text, lineHeight: '1.5' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. WHAT YOU UNLOCK WITH A FREE ACCOUNT ── */}
      <section style={{ padding: '0 24px 60px' }}>
        <div style={{
          maxWidth: '760px', margin: '0 auto',
          background: 'rgba(168,85,247,0.06)',
          border: '1px solid rgba(168,85,247,0.22)',
          borderRadius: '16px', padding: '40px 36px',
        }}>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: C.white, margin: '0 0 6px' }}>
            🔓 Add a Free Account — Save Everything
          </h2>
          <p style={{ color: C.text, fontSize: '14px', margin: '0 0 28px', fontWeight: '600' }}>
            Still completely free. Just connected.
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {accountFeatures.map((feat) => (
              <li key={feat} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', color: C.white }}>
                <span style={{ color: C.purple, fontWeight: '800', fontSize: '16px' }}>✓</span>
                {feat}
              </li>
            ))}
          </ul>

          <a href="/landing" style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
            color: '#fff', textDecoration: 'none',
            padding: '13px 28px', borderRadius: '10px',
            fontSize: '15px', fontWeight: '800',
          }}>
            Create Free Account →
          </a>
        </div>
      </section>

      {/* ── 6. HOW IT WORKS / DOWNLOAD ── */}
      <section id="download" style={{ padding: '0 24px 72px', textAlign: 'center' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '26px', fontWeight: '800', color: C.white, margin: '0 0 40px' }}>
            Get started in 60 seconds
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '24px',
          }}>
            {steps.map((s, i) => (
              <div key={s.title} style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: '14px', padding: '28px 20px',
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: '800', color: '#fff',
                  margin: '0 auto 14px',
                }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>{s.icon}</div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: C.white, marginBottom: '8px' }}>{s.title}</div>
                <div style={{ fontSize: '13px', color: C.text, lineHeight: '1.6' }}>{s.desc}</div>
              </div>
            ))}
          </div>

          {/* Download button inside the how-it-works section */}
          <div style={{ marginTop: '40px' }}>
            <a
              href="/camcash-extension.zip"
              download
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                color: '#fff', textDecoration: 'none',
                padding: '15px 40px', borderRadius: '12px',
                fontSize: '16px', fontWeight: '800',
                boxShadow: '0 0 28px rgba(168,85,247,0.3)',
              }}
            >
              📥 Download ZIP — Free
            </a>
            <div style={{ fontSize: '12px', color: C.muted, marginTop: '12px' }}>
              Chrome → Extensions → Developer mode → Load unpacked
            </div>
          </div>

          <div style={{ textAlign: 'center', margin: '32px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#94A3B8', marginBottom: 16 }}>
              Or scan to download on your phone
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/qr-extension.png"
              alt="Scan to download CamCash extension"
              style={{ width: 160, height: 160, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <div style={{ fontSize: 12, color: '#475569', marginTop: 8 }}>
              Points to camcashgrl.com/extension
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. EXTENSION POPUP MOCKUP ── */}
      <section style={{ padding: '0 24px 72px', textAlign: 'center' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <p style={{
            fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em',
            textTransform: 'uppercase', color: C.muted, marginBottom: '24px',
          }}>
            What the overlay looks like
          </p>
          <div style={{
            maxWidth: '300px', margin: '0 auto',
            background: '#0b1220',
            border: '1px solid rgba(168,85,247,0.3)',
            borderRadius: '14px',
            boxShadow: '0 0 40px rgba(168,85,247,0.15), 0 20px 60px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            textAlign: 'left',
          }}>
            {/* Popup header */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(124,58,237,0.15))',
              borderBottom: '1px solid rgba(168,85,247,0.2)',
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '14px', fontWeight: '800', color: C.white }}>💜 CamCash Live</span>
              <span style={{
                background: 'rgba(239,68,68,0.2)', color: '#f87171',
                border: '1px solid rgba(239,68,68,0.3)',
                padding: '2px 8px', borderRadius: '20px',
                fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em',
              }}>
                🔴 LIVE
              </span>
            </div>

            {/* Stats */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '13px', color: C.text, lineHeight: '1.8' }}>
                <span>👁️ 94 viewers</span>
                <span style={{ margin: '0 10px', color: C.muted }}>·</span>
                <span style={{ color: C.green }}>💰 $12.50</span>
                <span style={{ margin: '0 10px', color: C.muted }}>·</span>
                <span style={{ color: C.cyan }}>⚡ Rising</span>
              </div>
            </div>

            {/* AI tip */}
            <div style={{
              padding: '14px 16px',
              background: 'rgba(34,211,238,0.04)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: '12px', color: C.cyan, lineHeight: '1.6' }}>
                💡 xDarkMatter3 is active — 87% tip probability
              </div>
            </div>

            {/* CTA */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{
                background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                color: '#fff', padding: '8px 0', borderRadius: '8px',
                textAlign: 'center', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
              }}>
                Open Dashboard →
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: C.muted }}>
                Chaturbate · Session 52:18
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. EARLY ADOPTER CTA BOX ── */}
      <section style={{ padding: '0 24px 72px' }}>
        <div style={{
          maxWidth: '760px', margin: '0 auto',
          background: 'rgba(236,72,153,0.07)',
          border: '1px solid rgba(236,72,153,0.3)',
          borderRadius: '16px', padding: '40px 36px',
          textAlign: 'center',
          boxShadow: '0 0 40px rgba(236,72,153,0.08)',
        }}>
          <h2 style={{ fontSize: '22px', fontWeight: '900', color: C.white, margin: '0 0 12px' }}>
            ⏰ Lock In Early Adopter Pricing Now
          </h2>
          <div style={{ fontSize: '28px', fontWeight: '900', color: C.pink, margin: '0 0 6px' }}>
            $9.99/month FOREVER — locked at signup
          </div>
          <div style={{ fontSize: '14px', color: C.muted, marginBottom: '8px', textDecoration: 'line-through' }}>
            Regular price after launch: $19.99/month
          </div>
          <div style={{ fontSize: '13px', color: C.text, marginBottom: '32px' }}>
            Limited to first 100 users.
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
            <a href="/landing?plan=early_adopter_monthly" style={{
              background: C.pink, color: '#fff', textDecoration: 'none',
              padding: '13px 22px', borderRadius: '10px',
              fontSize: '14px', fontWeight: '800',
              boxShadow: '0 0 24px rgba(236,72,153,0.3)',
            }}>
              Claim Early Adopter Monthly — $9.99/mo
            </a>
            <a href="/pricing" style={{
              background: 'transparent', color: C.white, textDecoration: 'none',
              padding: '13px 22px', borderRadius: '10px',
              fontSize: '14px', fontWeight: '700',
              border: '1px solid rgba(255,255,255,0.2)',
            }}>
              View Full Pricing
            </a>
          </div>

          <div style={{ fontSize: '12px', color: C.muted }}>
            Free tier always available. Early adopter offer expires at 100 users.
          </div>
        </div>
      </section>

      {/* ── 9. COMPARISON TABLE ── */}
      <section style={{ padding: '0 24px 72px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '26px', fontWeight: '800', color: C.white, margin: '0 0 32px', textAlign: 'center' }}>
            Extension Free vs Account vs Premium
          </h2>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Feature', 'Extension Only', '+ Free Account', '+ Premium'].map((h, i) => (
                    <th key={h} style={{
                      padding: '14px 16px', textAlign: i === 0 ? 'left' : 'center',
                      fontSize: '12px', fontWeight: '700', letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: i === 1 ? C.cyan : i === 2 ? C.purple : i === 3 ? C.pink : C.muted,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: ri < tableRows.length - 1 ? `1px solid rgba(255,255,255,0.04)` : 'none' }}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{
                        padding: '13px 16px',
                        textAlign: ci === 0 ? 'left' : 'center',
                        fontSize: '13px',
                        color: cell === '✅' ? C.green : cell === '❌' ? C.muted : ci === 0 ? C.white : C.text,
                        fontWeight: ci === 0 ? '600' : '400',
                      }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── 10. FREE TOOLS SECTION ── */}
      <section style={{ padding: '0 24px 72px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h2 style={{ fontSize: '26px', fontWeight: '800', color: C.white, margin: '0 0 10px' }}>
              Free Tools — No Account Needed
            </h2>
            <p style={{ fontSize: '15px', color: C.text, margin: 0 }}>
              Use these right now, completely free.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}>
            <a href="/guides/chaturbate-room-title-generator" style={{
              display: 'block', textDecoration: 'none',
              background: 'rgba(168,85,247,0.07)',
              border: '1px solid rgba(168,85,247,0.25)',
              borderRadius: '14px', padding: '28px 24px',
            }}>
              <div style={{ fontSize: '30px', marginBottom: '12px' }}>✏️</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: C.white, marginBottom: '10px' }}>
                Chaturbate Room Title Generator
              </div>
              <p style={{ fontSize: '14px', color: C.text, lineHeight: '1.6', margin: '0 0 18px' }}>
                Generate click-worthy room titles that get you more viewers. Free, instant.
              </p>
              <span style={{ fontSize: '14px', fontWeight: '700', color: C.purple }}>
                Try it free →
              </span>
            </a>

            <a href="/guides/chaturbate-token-calculator" style={{
              display: 'block', textDecoration: 'none',
              background: 'rgba(34,211,238,0.06)',
              border: '1px solid rgba(34,211,238,0.2)',
              borderRadius: '14px', padding: '28px 24px',
            }}>
              <div style={{ fontSize: '30px', marginBottom: '12px' }}>💰</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: C.white, marginBottom: '10px' }}>
                Chaturbate Token Calculator
              </div>
              <p style={{ fontSize: '14px', color: C.text, lineHeight: '1.6', margin: '0 0 18px' }}>
                Instantly convert tokens to USD. See your real take-home for any tip.
              </p>
              <span style={{ fontSize: '14px', fontWeight: '700', color: C.cyan }}>
                Try it free →
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* ── 11. BLOG & RESOURCES SECTION ── */}
      <section style={{ padding: '0 24px 72px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h2 style={{ fontSize: '26px', fontWeight: '800', color: C.white, margin: '0 0 10px' }}>
              Learn to Earn More
            </h2>
            <p style={{ fontSize: '15px', color: C.text, margin: 0 }}>
              Free guides written for cam models.
            </p>
          </div>

          <BlogGrid posts={blogPosts} />

          <div style={{ textAlign: 'center', marginTop: '28px' }}>
            <a href="/blog" style={{
              color: C.purple, fontSize: '14px', fontWeight: '700', textDecoration: 'none',
            }}>
              View all blog posts →
            </a>
          </div>
        </div>
      </section>

      {/* ── 12. TRANSPARENCY FOOTER SECTION ── */}
      <section style={{
        padding: '40px 24px',
        background: '#060b16',
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <p style={{ fontSize: '13px', color: C.muted, lineHeight: '1.8', margin: '0 0 16px' }}>
            Everything is free during launch. After 100 users, free tier includes core features.
            <br />
            Some features move to premium ($19.99/month or $9.99/month early adopter forever).
            <br />
            You&apos;ll get 30 days notice. No surprises.
          </p>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/pricing" style={{ color: C.muted, fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>
              View our full pricing →
            </a>
            <a href="#download" style={{ color: C.purple, fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>
              Download extension →
            </a>
          </div>
        </div>
      </section>

      {/* ── 13. FreeToolsBanner ── */}
      <FreeToolsBanner />

      {/* ── 14. SiteFooter ── */}
      <SiteFooter />
    </div>
  )
}

// ── Blog grid is a server-safe component (no hooks) ──
function BlogGrid({ posts }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '16px',
    }}>
      {posts.map((post) => (
        <BlogCard key={post.href} href={post.href} title={post.title} />
      ))}
    </div>
  )
}

// Static blog card without hover — hover handled via CSS class or simply styled
function BlogCard({ href, title }) {
  return (
    <a href={href} style={{
      display: 'block', textDecoration: 'none',
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: '12px', padding: '20px 22px',
      color: C.white, fontSize: '14px', fontWeight: '600',
      lineHeight: '1.5',
    }}>
      <span style={{ color: C.purple, marginRight: '6px' }}>→</span>
      {title}
    </a>
  )
}


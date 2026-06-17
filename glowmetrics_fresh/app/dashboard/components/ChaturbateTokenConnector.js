'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function ChaturbateTokenConnector({ user, onConnected }) {
  const [username, setUsername] = useState('')
  const [statsToken, setStatsToken] = useState('')
  const [eventsToken, setEventsToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [connected, setConnected] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!username.trim())   { setError('Username is required.'); return }
    if (!statsToken.trim()) { setError('Stats API token is required.'); return }

    setLoading(true)
    const { error: dbErr } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        chaturbate_username:   username.trim(),
        chaturbate_stats_token: statsToken.trim(),
        ...(eventsToken.trim() ? { chaturbate_api_token: eventsToken.trim() } : {}),
      })
    setLoading(false)

    if (dbErr) { setError(dbErr.message); return }

    setConnected(true)
    if (onConnected) onConnected()
  }

  if (connected) {
    return (
      <div style={{
        borderRadius: 14, border: '1px solid rgba(52,211,153,0.3)',
        background: 'rgba(52,211,153,0.06)', padding: '24px 28px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 22 }}>✅</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#34d399' }}>Connected! Live sync is now active.</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
            Chaturbate will now push live tips to your dashboard automatically.
          </div>
        </div>
      </div>
    )
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#fff',
    outline: 'none', width: '100%',
  }
  const labelStyle = {
    fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase', letterSpacing: '0.08em',
  }

  return (
    <div style={{
      borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(255,255,255,0.03)', padding: '28px 32px',
      maxWidth: 520,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <span style={{ fontSize: 22 }}>⚡</span>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>Connect Chaturbate Live Sync</div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Username */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle}>Your Chaturbate username</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)}
            placeholder="your_username" autoComplete="off" style={inputStyle} />
        </div>

        {/* ── SECTION 1: Stats API Token ── */}
        <div style={{
          border: '1px solid rgba(34,211,238,0.2)', borderRadius: 12,
          padding: '20px', display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#22d3ee' }}>📊 Stats API Token</span>
            <span style={{ fontSize: 11, background: 'rgba(34,211,238,0.15)', color: '#22d3ee', borderRadius: 6, padding: '2px 7px', fontWeight: 700 }}>Required</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Stats API Token</label>
            <input type="text" value={statsToken} onChange={e => setStatsToken(e.target.value)}
              placeholder="Paste token or full page URL" autoComplete="off"
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13 }} />
          </div>

          {/* How to find */}
          <div style={{
            background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '14px 16px', fontSize: 13, color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.75,
          }}>
            <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginBottom: 10 }}>How to get your Stats API token:</div>
            <ol style={{ paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li><strong style={{ color: 'rgba(255,255,255,0.7)' }}>Log in to Chaturbate</strong> — go to chaturbate.com with your broadcaster account</li>
              <li>
                <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Open the tokens page</strong>
                <div style={{ marginTop: 3 }}>
                  Click this direct link: <span style={{ color: '#22d3ee', fontFamily: 'monospace', fontSize: 12 }}>chaturbate.com/statsapi/authtoken/</span>
                  <br />Or navigate to: Settings → Privacy → Stats API Token
                </div>
              </li>
              <li>
                <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Copy the Stats API Token</strong>
                <div style={{ marginTop: 3 }}>
                  Look for the section that says <strong style={{ color: '#22d3ee' }}>Stats API</strong> and copy the token.
                  If it&apos;s empty, click &quot;Generate Token.&quot;
                </div>
                <div style={{
                  marginTop: 8, padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
                  fontSize: 12, color: '#f87171',
                }}>
                  ⚠️ <strong>DO NOT copy the JSON.</strong> If you see text like{' '}
                  <code style={{ fontFamily: 'monospace', fontSize: 11 }}>{'{'}&#34;username&#34;:&#34;...&#34;,&#34;token_balance&#34;:...{'}'}</code>{' '}
                  that is NOT the token. The token is a long alphanumeric code like{' '}
                  <code style={{ fontFamily: 'monospace', fontSize: 11 }}>kArDlU...udk3</code>
                </div>
              </li>
              <li>
                <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Paste it above</strong>
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                  <span>✅ Only the token (alphanumeric code)</span>
                  <span>✅ The complete URL from the browser address bar</span>
                  <span style={{ color: '#f87171' }}>❌ DO NOT paste the JSON content of the page</span>
                </div>
              </li>
            </ol>
          </div>

          {/* Visual diagram */}
          <div style={{
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(34,211,238,0.15)',
            borderRadius: 10, padding: '14px 16px', fontFamily: 'monospace', fontSize: 12,
            color: 'rgba(255,255,255,0.45)', lineHeight: 2,
          }}>
            <div style={{ color: '#22d3ee', marginBottom: 6, fontFamily: 'inherit' }}>chaturbate.com/statsapi/authtoken/</div>
            <div>
              <span style={{ color: '#22d3ee', fontWeight: 700 }}>📊 Stats API</span>
              <span style={{ color: '#34d399', fontWeight: 700, marginLeft: 6 }}>← THIS IS THE ONE YOU NEED</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', paddingLeft: 4 }}>H0piEMo8j3fTv0dquiYU6ZkDG0X6Zb6qgHp5WuO1g…</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', paddingLeft: 4 }}>[Generate Token]</div>
            <div style={{ marginTop: 6 }}>
              <span style={{ color: '#f59e0b' }}>💬 Events API</span>
              <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 6 }}>← (optional, for live tips)</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', paddingLeft: 4 }}>…</div>
            <div style={{ marginTop: 6 }}>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>📡 Broadcast API</span>
              <span style={{ color: 'rgba(255,255,255,0.25)', marginLeft: 6 }}>← (you don&apos;t need this)</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.25)', paddingLeft: 4 }}>…</div>
          </div>

          {/* Validation box */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '12px 16px', fontSize: 12,
            color: 'rgba(255,255,255,0.5)', lineHeight: 1.8,
          }}>
            <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>How to know if you copied correctly:</div>
            <div>✅ Correct: long code like <code style={{ fontFamily: 'monospace' }}>kArDlU...udk3</code></div>
            <div>✅ Correct: URL like <code style={{ fontFamily: 'monospace' }}>chaturbate.com/statsapi/?username=x&amp;token=abc…</code></div>
            <div style={{ color: '#f87171' }}>❌ Incorrect: JSON like <code style={{ fontFamily: 'monospace' }}>{'{'}&#34;username&#34;:&#34;...&#34;,&#34;token_balance&#34;:...{'}'}</code></div>
            <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.4)' }}>
              If you see JSON, look at the browser address bar — the token is in the URL.
            </div>
          </div>
        </div>

        {/* ── SECTION 2: Events API Token (optional) ── */}
        <div style={{
          border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12,
          padding: '20px', display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>💬 Events API Token</span>
            <span style={{ fontSize: 11, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: 6, padding: '2px 7px', fontWeight: 700 }}>Optional</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Events API Token (Optional)</label>
            <input type="text" value={eventsToken} onChange={e => setEventsToken(e.target.value)}
              placeholder="Paste your Events API token here" autoComplete="off"
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13 }} />
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Only needed for real-time live tip tracking</div>
          </div>

          <div style={{
            background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '14px 16px', fontSize: 13, color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.75,
          }}>
            <ol style={{ paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li>
                <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Same page, different section</strong>
                <div style={{ marginTop: 3 }}>
                  On the same <span style={{ color: '#22d3ee', fontFamily: 'monospace', fontSize: 12 }}>chaturbate.com/statsapi/authtoken/</span> page,
                  look for the <strong style={{ color: '#f59e0b' }}>Events API</strong> section.
                  It is a different token — do not reuse the Stats API token.
                </div>
              </li>
              <li>
                <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Generate and copy</strong>
                <div style={{ marginTop: 3 }}>If empty, click Generate Token. Copy and paste it into the field above.</div>
              </li>
            </ol>
            <div style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 8,
              background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.15)',
              fontSize: 12, color: 'rgba(255,255,255,0.6)',
            }}>
              💡 <strong style={{ color: '#22d3ee' }}>What&apos;s it for?</strong> With this token you&apos;ll see tips in real time on your dashboard while streaming — who tipped, how much, and when — instant.
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            borderRadius: 8, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
            padding: '10px 14px', fontSize: 13, color: '#f87171',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            background: loading ? 'rgba(52,211,153,0.4)' : '#34d399',
            color: '#0f172a', fontWeight: 800, fontSize: 14,
            border: 'none', borderRadius: 8, padding: '12px 20px',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
            marginTop: 4,
          }}
        >
          {loading ? 'Connecting…' : 'Connect Chaturbate →'}
        </button>
      </form>
    </div>
  )
}

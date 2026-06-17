'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function ChaturbateTokenConnector({ user, onConnected }) {
  const [username, setUsername] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [connected, setConnected] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!username.trim()) { setError('Username is required.'); return }
    if (!token.trim())    { setError('Events API token is required.'); return }

    setLoading(true)
    const { error: dbErr } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        chaturbate_username: username.trim(),
        chaturbate_api_token: token.trim(),
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

  return (
    <div style={{
      borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(255,255,255,0.03)', padding: '28px 32px',
      maxWidth: 480,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 22 }}>⚡</span>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>Connect Chaturbate Live Sync</div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Your Chaturbate username
          </label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="your_username"
            autoComplete="off"
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#fff',
              outline: 'none', width: '100%',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Your Events API token
          </label>
          <input
            type="text"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="paste token here"
            autoComplete="off"
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#fff',
              outline: 'none', width: '100%', fontFamily: 'monospace',
            }}
          />
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'rgba(255,255,255,0.5)',
          lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.65)', marginBottom: 4 }}>How to get your token:</div>
          <ol style={{ paddingLeft: 18, margin: 0 }}>
            <li>Log into Chaturbate</li>
            <li>Go to <span style={{ color: '#22d3ee', fontFamily: 'monospace', fontSize: 12 }}>chaturbate.com/statsapi/ts/token-stats/</span></li>
            <li>Click the <strong style={{ color: 'rgba(255,255,255,0.75)' }}>Events API</strong> tab</li>
            <li>Copy your token</li>
          </ol>
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

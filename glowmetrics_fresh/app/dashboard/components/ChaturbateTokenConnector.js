'use client';
import { useState } from 'react';
import { supabase } from '../../../lib/supabase';

const BROADCASTER_TYPES = [
  { value: 'female', label: '👩 Female' },
  { value: 'male', label: '👨 Male' },
  { value: 'trans', label: '⚧ Trans' },
  { value: 'couple', label: '👫 Couple' },
]

export default function ChaturbateTokenConnector({ user, onConnected }) {
  const [username, setUsername] = useState('');
  const [statsToken, setStatsToken] = useState('');
  const [eventsToken, setEventsToken] = useState('');
  const [broadcasterType, setBroadcasterType] = useState('female');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!username.trim()) { setError('Username is required.'); return; }
    if (!statsToken.trim()) { setError('Stats API token is required.'); return; }

    setLoading(true);
    const { error: upsertErr } = await supabase.from('profiles').upsert({
      id: user.id,
      chaturbate_username: username.trim(),
      chaturbate_stats_token: statsToken.trim(),
      broadcaster_type: broadcasterType,
      ...(eventsToken.trim() ? { chaturbate_api_token: eventsToken.trim() } : {}),
    });
    setLoading(false);

    if (upsertErr) { setError(upsertErr.message); return; }

    setSyncing(true);
    setConnected(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/chaturbate/stats-sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      setSyncResult(data);
    } catch {
      setSyncResult({ error: 'Sync failed — you can retry from the dashboard' });
    } finally {
      setSyncing(false);
      onConnected?.({ hasEventsToken: !!eventsToken.trim() });
    }
  }

  // ── Syncing state ──────────────────────────────────────────────────
  if (connected && syncing) {
    return (
      <Card>
        <Logo />
        <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
          <div style={styles.spinner} />
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>
            Syncing your Chaturbate tip history…
          </p>
        </div>
      </Card>
    );
  }

  // ── Success state ──────────────────────────────────────────────────
  if (connected && !syncing) {
    return (
      <Card>
        <Logo />
        <div style={{ textAlign: 'center', paddingBottom: 8 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <h3 style={{ color: '#f1f5f9', margin: '0 0 6px', fontSize: 20, fontWeight: 800 }}>
            Connected as {username}
          </h3>
          {syncResult?.inserted > 0 && (
            <p style={{ color: '#34d399', fontSize: 14, margin: '0 0 4px' }}>
              📊 {syncResult.inserted} tips imported from your Chaturbate history
            </p>
          )}
          {syncResult?.skipped > 0 && (
            <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 4px' }}>
              {syncResult.skipped} already existed — skipped
            </p>
          )}
          {syncResult?.inserted === 0 && syncResult?.total === 0 && (
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 4px' }}>
              No recent tip history found — upload a CSV for historical data
            </p>
          )}
          {syncResult?.error && (
            <p style={{ color: '#f87171', fontSize: 14, margin: '0 0 4px' }}>
              ⚠️ {syncResult.error}
            </p>
          )}
        </div>
      </Card>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────
  return (
    <Card>
      <Logo />

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h2 style={styles.title}>Connect Chaturbate</h2>
        <p style={styles.subtitle}>Import your full tip history automatically</p>
        <div style={styles.badge}>🔒 Read-only · Never acts on your account</div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Broadcaster type */}
        <Field label="I BROADCAST AS">
          <div style={{ display: 'flex', gap: 8 }}>
            {BROADCASTER_TYPES.map(bt => (
              <button
                key={bt.value}
                type="button"
                onClick={() => setBroadcasterType(bt.value)}
                style={{
                  flex: 1, padding: '9px 4px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: broadcasterType === bt.value ? 'rgba(124,92,255,0.2)' : 'rgba(255,255,255,0.04)',
                  border: broadcasterType === bt.value ? '1px solid rgba(124,92,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  color: broadcasterType === bt.value ? '#a78bfa' : 'rgba(255,255,255,0.45)',
                }}
              >
                {bt.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Username */}
        <Field label="CHATURBATE USERNAME">
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="your_username"
            autoComplete="off"
            style={styles.input}
          />
          <FieldHint>Exact username you use to broadcast (not display name)</FieldHint>
        </Field>

        {/* Stats API Token */}
        <div style={styles.tokenBlock('#22D3EE')}>
          <div style={styles.tokenBlockHeader}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#22D3EE' }}>📊 Stats API Token</span>
            <span style={styles.pill('#22D3EE')}>Required</span>
          </div>

          <Field label="STATS API TOKEN">
            <input
              type="text"
              value={statsToken}
              onChange={e => setStatsToken(e.target.value)}
              placeholder="Paste token or full page URL"
              autoComplete="off"
              style={{ ...styles.input, fontFamily: 'monospace', fontSize: 13 }}
            />
          </Field>

          {/* How-to steps */}
          <div style={styles.howToBox}>
            <div style={styles.howToTitle}>How to get your Stats API token:</div>
            <ol style={styles.ol}>
              <li>
                <strong style={styles.strong}>Log in to Chaturbate</strong> — go to chaturbate.com with your broadcaster account
              </li>
              <li>
                <strong style={styles.strong}>Open the token page</strong>
                <div style={{ marginTop: 4 }}>
                  Click this direct link:{' '}
                  <a
                    href="https://chaturbate.com/statsapi/authtoken/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.link}
                  >
                    chaturbate.com/statsapi/authtoken/
                  </a>
                  <br />
                  Or navigate to: <span style={{ color: '#94a3b8' }}>Settings → Privacy → Stats API Token</span>
                </div>
              </li>
              <li>
                <strong style={styles.strong}>Copy the Stats API Token</strong>
                <div style={{ marginTop: 4 }}>
                  Look for the section that says <strong style={{ color: '#22D3EE' }}>Stats API</strong> and copy the token.
                  If it&apos;s empty, click &quot;Generate Token.&quot;
                </div>
                <div style={styles.warningBox}>
                  ⚠️ <strong>DO NOT copy the JSON.</strong> If you see text like{' '}
                  <code style={styles.code}>{'{'}&#34;username&#34;:&#34;...&#34;,&#34;token_balance&#34;:...{'}'}</code>{' '}
                  that is NOT the token. The token is a long alphanumeric code like{' '}
                  <code style={styles.code}>kArDlU…udk3</code>
                </div>
              </li>
              <li>
                <strong style={styles.strong}>Paste it in the field above</strong>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                  <span>✅ Only the token (alphanumeric code)</span>
                  <span>✅ The complete URL from the browser address bar</span>
                  <span style={{ color: '#f87171' }}>❌ DO NOT paste the JSON content of the page</span>
                </div>
              </li>
            </ol>
          </div>

          {/* Visual diagram */}
          <div style={styles.diagram}>
            <div style={{ color: '#22D3EE', marginBottom: 6, fontFamily: 'monospace', fontSize: 12 }}>
              chaturbate.com/statsapi/authtoken/
            </div>
            <div>
              <span style={{ color: '#22D3EE', fontWeight: 700 }}>📊 Stats API</span>
              <span style={{ color: '#34d399', fontWeight: 700, marginLeft: 8 }}>← THIS IS THE ONE YOU NEED</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', paddingLeft: 4, fontSize: 11 }}>
              H0piEMo8j3fTv0dquiYU6ZkDG0X6Zb6qgHp5WuO1g…
            </div>
            <div style={{ color: 'rgba(255,255,255,0.25)', paddingLeft: 4, fontSize: 11 }}>[Generate Token]</div>
            <div style={{ marginTop: 8 }}>
              <span style={{ color: '#f59e0b' }}>💬 Events API</span>
              <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 8, fontSize: 11 }}>← (optional, for live tips)</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.25)', paddingLeft: 4, fontSize: 11 }}>…</div>
            <div style={{ marginTop: 6 }}>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>📡 Broadcast API</span>
              <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 8, fontSize: 11 }}>← (you don&apos;t need this)</span>
            </div>
          </div>

          {/* Validation box */}
          <div style={styles.validationBox}>
            <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
              How to know if you copied correctly:
            </div>
            <div>✅ Correct: long code like <code style={styles.code}>kArDlU…udk3</code></div>
            <div>✅ Correct: URL like <code style={styles.code}>chaturbate.com/statsapi/?username=x&amp;token=abc…</code></div>
            <div style={{ color: '#f87171' }}>
              ❌ Incorrect: JSON like <code style={styles.code}>{'{'}&#34;username&#34;:&#34;...&#34;,&#34;token_balance&#34;:...{'}'}</code>
            </div>
            <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.4)' }}>
              If you see JSON, look at the browser address bar — the token is in the URL.
            </div>
          </div>
        </div>

        {/* Events API Token (optional) */}
        <div style={styles.tokenBlock('#f59e0b')}>
          <div style={styles.tokenBlockHeader}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>💬 Events API Token</span>
            <span style={styles.pill('#f59e0b')}>Optional</span>
          </div>

          <Field label="EVENTS API TOKEN (OPTIONAL)">
            <input
              type="text"
              value={eventsToken}
              onChange={e => setEventsToken(e.target.value)}
              placeholder="Paste your Events API token here"
              autoComplete="off"
              style={{ ...styles.input, fontFamily: 'monospace', fontSize: 13 }}
            />
            <FieldHint>Only needed for real-time live tip tracking</FieldHint>
          </Field>

          <div style={styles.howToBox}>
            <ol style={styles.ol}>
              <li>
                <strong style={styles.strong}>Same page, different section</strong>
                <div style={{ marginTop: 3 }}>
                  On the same{' '}
                  <span style={{ color: '#22D3EE', fontFamily: 'monospace', fontSize: 12 }}>chaturbate.com/statsapi/authtoken/</span>{' '}
                  page, look for the <strong style={{ color: '#f59e0b' }}>Events API</strong> section.
                  It is a different token — do not reuse the Stats API token.
                </div>
              </li>
              <li>
                <strong style={styles.strong}>Generate and copy</strong>
                <div style={{ marginTop: 3 }}>
                  If empty, click Generate Token. Copy and paste it into the field above.
                </div>
              </li>
            </ol>
            <div style={{ ...styles.infoBox, marginTop: 12 }}>
              💡 <strong style={{ color: '#22D3EE' }}>What&apos;s it for?</strong> With this token you&apos;ll see tips
              in real time on your dashboard while streaming — who tipped, how much, and when — instant.
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={styles.errorBox}>{error}</div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            ...styles.button,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Connecting…' : 'Connect Chaturbate →'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#475569', margin: 0 }}>
          🔒 Your token is stored securely and never shared with anyone.
        </p>
      </form>
    </Card>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Card({ children }) {
  return (
    <div style={{
      background: 'linear-gradient(145deg, #0d1117 0%, #111827 100%)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 20,
      padding: '36px 32px',
      maxWidth: 520,
      width: '100%',
      boxShadow: '0 0 0 1px rgba(34,211,238,0.06), 0 24px 48px rgba(0,0,0,0.5), 0 0 60px rgba(34,211,238,0.04)',
      fontFamily: "'Inter', sans-serif",
      color: '#94a3b8',
    }}>
      {children}
    </div>
  );
}

function Logo() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 18,
        background: 'linear-gradient(135deg, #22D3EE, #EC4899)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 28,
        fontWeight: 900,
        color: '#fff',
        boxShadow: '0 0 32px rgba(34,211,238,0.3), 0 8px 24px rgba(0,0,0,0.4)',
      }}>
        $
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

function FieldHint({ children }) {
  return <div style={{ fontSize: 12, color: '#475569' }}>{children}</div>;
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = {
  title: {
    color: '#f1f5f9',
    fontSize: 22,
    fontWeight: 800,
    margin: '0 0 6px',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 14,
    margin: '0 0 14px',
  },
  badge: {
    display: 'inline-block',
    padding: '5px 14px',
    borderRadius: 20,
    background: 'rgba(16,185,129,0.1)',
    border: '1px solid rgba(16,185,129,0.25)',
    color: '#10b981',
    fontSize: 12,
    fontWeight: 700,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  input: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 14,
    color: '#f1f5f9',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  },
  tokenBlock: (color) => ({
    border: `1px solid ${color}30`,
    borderRadius: 14,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    background: `${color}06`,
  }),
  tokenBlockHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  pill: (color) => ({
    fontSize: 11,
    background: `${color}18`,
    color: color,
    borderRadius: 6,
    padding: '2px 8px',
    fontWeight: 700,
  }),
  howToBox: {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: '14px 16px',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.75,
  },
  howToTitle: {
    fontWeight: 700,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 10,
  },
  ol: {
    paddingLeft: 18,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  strong: {
    color: 'rgba(255,255,255,0.75)',
  },
  link: {
    color: '#22D3EE',
    fontFamily: 'monospace',
    fontSize: 12,
    textDecoration: 'none',
  },
  warningBox: {
    marginTop: 8,
    padding: '8px 12px',
    borderRadius: 8,
    background: 'rgba(248,113,113,0.08)',
    border: '1px solid rgba(248,113,113,0.2)',
    fontSize: 12,
    color: '#f87171',
  },
  diagram: {
    background: 'rgba(0,0,0,0.45)',
    border: '1px solid rgba(34,211,238,0.12)',
    borderRadius: 10,
    padding: '14px 16px',
    fontFamily: 'monospace',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 2,
  },
  validationBox: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.8,
  },
  infoBox: {
    padding: '8px 12px',
    borderRadius: 8,
    background: 'rgba(34,211,238,0.06)',
    border: '1px solid rgba(34,211,238,0.15)',
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  errorBox: {
    borderRadius: 8,
    background: 'rgba(248,113,113,0.08)',
    border: '1px solid rgba(248,113,113,0.2)',
    padding: '10px 14px',
    fontSize: 13,
    color: '#f87171',
  },
  button: {
    background: 'linear-gradient(135deg, #22D3EE, #EC4899)',
    color: '#fff',
    fontWeight: 800,
    fontSize: 15,
    border: 'none',
    borderRadius: 10,
    padding: '14px 20px',
    width: '100%',
    transition: 'opacity 0.15s',
    boxShadow: '0 8px 24px rgba(34,211,238,0.25)',
    letterSpacing: 0.2,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 11,
    background: 'rgba(255,255,255,0.06)',
    padding: '1px 4px',
    borderRadius: 4,
  },
  spinner: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '2px solid rgba(168,85,247,0.2)',
    borderTop: '2px solid #a855f7',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 16px',
  },
};

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import SiteFooter from '../components/SiteFooter';

const C = {
  bg: '#0a0814',
  card: 'rgba(15,20,32,0.9)',
  border: 'rgba(168,85,247,0.2)',
  purple: '#a855f7',
  purpleDim: 'rgba(168,85,247,0.1)',
  cyan: '#22d3ee',
  green: '#10b981',
  white: '#f1f5f9',
  muted: '#94a3b8',
  dim: '#475569',
};

function StatCard({ label, value, sub, color = C.purple }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: '12px',
      padding: '20px 24px',
      flex: 1,
      minWidth: '140px',
    }}>
      <div style={{ color: C.muted, fontSize: '13px', marginBottom: '6px' }}>{label}</div>
      <div style={{ color, fontSize: '28px', fontWeight: '700', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: C.dim, fontSize: '12px', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

function TipRow({ tip, isNew }) {
  const [highlight, setHighlight] = useState(isNew);

  useEffect(() => {
    if (isNew) {
      const t = setTimeout(() => setHighlight(false), 2000);
      return () => clearTimeout(t);
    }
  }, [isNew]);

  const ts = new Date(tip.received_at);
  const time = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '12px 16px',
      borderRadius: '8px',
      background: highlight ? 'rgba(168,85,247,0.15)' : 'transparent',
      borderLeft: `3px solid ${highlight ? C.purple : 'transparent'}`,
      transition: 'all 0.5s ease',
    }}>
      <span style={{ color: C.dim, fontSize: '12px', minWidth: '70px' }}>{time}</span>
      <span style={{ color: C.white, fontWeight: '600', flex: 1 }}>{tip.username}</span>
      <span style={{ color: C.cyan, fontWeight: '700', minWidth: '70px', textAlign: 'right' }}>
        {tip.tokens} tk
      </span>
      <span style={{ color: C.green, fontWeight: '700', minWidth: '60px', textAlign: 'right' }}>
        ${parseFloat(tip.usd || 0).toFixed(2)}
      </span>
      <span style={{ color: C.dim, fontSize: '12px', minWidth: '80px', textAlign: 'right' }}>
        {tip.source || 'extension'}
      </span>
    </div>
  );
}

export default function LiveMode() {
  const [user, setUser] = useState(null);
  const [tips, setTips] = useState([]);
  const [newTipIds, setNewTipIds] = useState(new Set());
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const lastFetchRef = useRef(null);
  const pollRef = useRef(null);

  const fetchTips = useCallback(async (userId, since = null) => {
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const token = sess?.access_token;
      if (!token) return null;
      const params = new URLSearchParams({ userId });
      if (since) params.set('since', since);
      const res = await fetch(`/api/live/tips?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch tips');
      return json.tips || [];
    } catch (err) {
      console.error('Poll error:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setStatus('unauthenticated');
        return;
      }
      setUser(user);
      setStatus('live');

      fetchTips(user.id).then((initial) => {
        if (initial) {
          setTips(initial);
          if (initial.length > 0) {
            lastFetchRef.current = initial[0].received_at;
          }
        }
      });

      pollRef.current = setInterval(async () => {
        const fresh = await fetchTips(user.id, lastFetchRef.current);
        if (fresh && fresh.length > 0) {
          lastFetchRef.current = fresh[0].received_at;
          setNewTipIds(new Set(fresh.map((t) => t.id)));
          setTips((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const added = fresh.filter((t) => !existingIds.has(t.id));
            return [...added, ...prev].slice(0, 200);
          });
          setTimeout(() => setNewTipIds(new Set()), 2500);
        }
      }, 4000);
    });

    return () => clearInterval(pollRef.current);
  }, [fetchTips]);

  const totalTokens = tips.reduce((s, t) => s + (t.tokens || 0), 0);
  const totalUsd = tips.reduce((s, t) => s + parseFloat(t.usd || 0), 0);
  const uniqueFans = new Set(tips.map((t) => t.username)).size;
  const topTipper = tips.reduce((top, t) => {
    if (!top || parseFloat(t.usd) > parseFloat(top.usd)) return t;
    return top;
  }, null);

  if (status === 'unauthenticated') {
    return (
      <div style={{ padding: '60px 40px', color: C.white, textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ color: C.white }}>Sign in to use Live Mode</h2>
        <p style={{ color: C.muted }}>You need to be logged in to track live tips.</p>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'system-ui' }}>
      {/* Early adopter banner */}
      <div style={{
        background: 'rgba(236,72,153,0.1)',
        borderBottom: '1px solid rgba(236,72,153,0.22)',
        padding: '11px 24px',
        textAlign: 'center',
      }}>
        <span style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 600 }}>
          ⏰ Early Adopter Offer — Lock in{' '}
          <span style={{ color: '#ec4899', fontWeight: 700 }}>$9.99/month forever</span>
          {' '}(regular $19.99/mo) ·{' '}
          <a href="/pricing" style={{ color: '#ec4899', textDecoration: 'underline', fontWeight: 600 }}>
            View pricing →
          </a>
        </span>
      </div>

      <div style={{ padding: '32px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <div>
          <h1 style={{ color: C.white, fontSize: '24px', fontWeight: '700', margin: 0 }}>
            Live Mode
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: status === 'live' ? C.green : C.dim,
              boxShadow: status === 'live' ? `0 0 6px ${C.green}` : 'none',
              animation: status === 'live' ? 'pulse 2s infinite' : 'none',
            }} />
            <span style={{ color: status === 'live' ? C.green : C.muted, fontSize: '13px' }}>
              {status === 'live' ? 'Polling every 4s' : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
        <StatCard label="Total Earned" value={`$${totalUsd.toFixed(2)}`} sub="this session" color={C.green} />
        <StatCard label="Total Tokens" value={totalTokens.toLocaleString()} color={C.cyan} />
        <StatCard label="Tips" value={tips.length} color={C.purple} />
        <StatCard label="Unique Fans" value={uniqueFans} color="#f59e0b" />
        {topTipper && (
          <StatCard
            label="Top Tipper"
            value={topTipper.username}
            sub={`$${parseFloat(topTipper.usd).toFixed(2)}`}
            color="#ec4899"
          />
        )}
      </div>

      {/* Tip feed */}
      <div style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'flex',
          gap: '16px',
          padding: '12px 16px',
          borderBottom: `1px solid ${C.border}`,
          background: 'rgba(168,85,247,0.05)',
        }}>
          <span style={{ color: C.dim, fontSize: '12px', minWidth: '70px' }}>TIME</span>
          <span style={{ color: C.dim, fontSize: '12px', flex: 1 }}>TIPPER</span>
          <span style={{ color: C.dim, fontSize: '12px', minWidth: '70px', textAlign: 'right' }}>TOKENS</span>
          <span style={{ color: C.dim, fontSize: '12px', minWidth: '60px', textAlign: 'right' }}>USD</span>
          <span style={{ color: C.dim, fontSize: '12px', minWidth: '80px', textAlign: 'right' }}>SOURCE</span>
        </div>

        {tips.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>💤</div>
            <div style={{ color: C.muted, fontSize: '15px' }}>No tips yet this session</div>
            <div style={{ color: C.dim, fontSize: '13px', marginTop: '8px' }}>
              Make sure the CamCash extension is active in your browser
            </div>
          </div>
        ) : (
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {tips.map((tip) => (
              <TipRow key={tip.id} tip={tip} isNew={newTipIds.has(tip.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Extension setup card */}
      <div style={{
        marginTop: '24px',
        padding: '20px 24px',
        background: C.purpleDim,
        border: `1px solid ${C.border}`,
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <div style={{ color: C.purple, fontWeight: '600', fontSize: '15px' }}>
            CamCash Extension
          </div>
          <div style={{ color: C.muted, fontSize: '13px', marginTop: '4px' }}>
            Load <strong>CamCashWorking-WithCoaching.zip</strong> in Chrome → Extensions → Developer mode → Load unpacked
          </div>
        </div>
        <div style={{ color: C.dim, fontSize: '12px' }}>
          Works on Chaturbate · BongaCams · MyFreeCams · Stripchat
        </div>
      </div>

      {/* Free tools strip */}
      <div style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <a href="/guides/chaturbate-room-title-generator" style={{ flex: 1, minWidth: '200px', padding: '16px 20px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '10px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '22px' }}>✏️</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9' }}>Room Title Generator</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Free tool — no login</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#a855f7' }}>Try →</span>
        </a>
        <a href="/guides/chaturbate-token-calculator" style={{ flex: 1, minWidth: '200px', padding: '16px 20px', background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.18)', borderRadius: '10px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '22px' }}>💰</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9' }}>Token Calculator</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Tokens → USD instantly</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#22d3ee' }}>Try →</span>
        </a>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      <SiteFooter />
      </div>
    </div>
  );
}

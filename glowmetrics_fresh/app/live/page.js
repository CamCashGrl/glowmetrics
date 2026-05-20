'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const C = {
  bg: '#0a0814', card: 'rgba(15,20,32,0.9)', border: 'rgba(168,85,247,0.2)',
  purple: '#a855f7', cyan: '#22d3ee', green: '#10b981',
  white: '#f1f5f9', muted: '#94a3b8', dim: '#475569',
};

export default function LiveMode() {
  const [user, setUser]         = useState(null);
  const [tips, setTips]         = useState([]);
  const [newTipIds, setNewTipIds] = useState(new Set());
  const [status, setStatus]     = useState('connecting');
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalUsd, setTotalUsd]   = useState(0);
  const lastFetchRef = useRef(null);
  const channelRef   = useRef(null);

  const loadTips = useCallback(async (uid) => {
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('live_tips')
      .select('*')
      .eq('user_id', uid)
      .gte('received_at', since)
      .order('received_at', { ascending: false });

    if (!data) return;
    setTips(data);
    setTotalTokens(data.reduce((s, t) => s + (t.tokens || 0), 0));
    setTotalUsd(data.reduce((s, t) => s + parseFloat(t.usd || 0), 0));
    if (data.length > 0) lastFetchRef.current = data[0].received_at;
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { setStatus('unauthenticated'); return; }
      setUser(u);
      setStatus('live');
      loadTips(u.id);

      // Realtime subscription for new tips
      const channel = supabase
        .channel(`live_tips_page_${u.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'live_tips',
          filter: `user_id=eq.${u.id}`,
        }, (payload) => {
          const tip = payload.new;
          setNewTipIds(new Set([tip.id]));
          setTips(prev => [tip, ...prev].slice(0, 200));
          setTotalTokens(prev => prev + (tip.tokens || 0));
          setTotalUsd(prev => prev + parseFloat(tip.usd || 0));
          setTimeout(() => setNewTipIds(new Set()), 3000);
        })
        .subscribe();
      channelRef.current = channel;
    });

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [loadTips]);

  if (status === 'unauthenticated') return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', gap: 16 }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <h2 style={{ color: C.white, margin: 0 }}>Sign in to use Live Mode</h2>
      <p style={{ color: C.muted, margin: 0 }}>You need to be logged in to track live tips.</p>
      <a href="/login" style={{ marginTop: 8, padding: '10px 24px', background: `linear-gradient(135deg, ${C.purple}, #ec4899)`, color: '#fff', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}>
        Sign in →
      </a>
    </div>
  );

  if (status === 'connecting') return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontFamily: 'system-ui' }}>
      Connecting…
    </div>
  );

  const uniqueFans = new Set(tips.map(t => t.username)).size;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui', color: C.white }}>
      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', borderBottom: `1px solid ${C.border}`, background: 'rgba(10,8,20,0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <a href="/" style={{ fontWeight: 800, fontSize: 18, background: `linear-gradient(90deg, ${C.purple}, #ec4899)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textDecoration: 'none' }}>
          CamCash
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: C.muted }}>{user?.email}</span>
          <a href="/dashboard" style={{ padding: '7px 16px', background: `rgba(168,85,247,0.15)`, border: `1px solid ${C.border}`, borderRadius: 8, color: C.purple, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
            Full Dashboard →
          </a>
          <a href="/extension" style={{ padding: '7px 14px', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
            📥 Extension
          </a>
        </div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.green, boxShadow: `0 0 8px ${C.green}`, animation: 'pulse 2s infinite' }} />
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Live Mode</h1>
          <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>Last 12 hours · updates in real time</span>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
          {[
            { label: 'Earned', value: `$${totalUsd.toFixed(2)}`, color: C.green },
            { label: 'Tokens', value: totalTokens.toLocaleString(), color: C.cyan },
            { label: 'Tips', value: tips.length, color: C.purple },
            { label: 'Fans', value: uniqueFans, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, minWidth: 120, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 22px' }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tip feed */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 16, padding: '11px 18px', borderBottom: `1px solid ${C.border}`, background: `rgba(168,85,247,0.05)` }}>
            <span style={{ color: C.dim, fontSize: 11, minWidth: 72 }}>TIME</span>
            <span style={{ color: C.dim, fontSize: 11, flex: 1 }}>TIPPER</span>
            <span style={{ color: C.dim, fontSize: 11, minWidth: 72, textAlign: 'right' }}>TOKENS</span>
            <span style={{ color: C.dim, fontSize: 11, minWidth: 60, textAlign: 'right' }}>USD</span>
            <span style={{ color: C.dim, fontSize: 11, minWidth: 80, textAlign: 'right' }}>PLATFORM</span>
          </div>

          {tips.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>💤</div>
              <div style={{ color: C.muted }}>No tips in the last 12 hours</div>
              <div style={{ color: C.dim, fontSize: 13, marginTop: 6 }}>Install the CamCash extension and start streaming</div>
            </div>
          ) : (
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {tips.map(tip => {
                const isNew = newTipIds.has(tip.id);
                const ts = new Date(tip.received_at);
                const time = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return (
                  <div key={tip.id} style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '11px 18px',
                    borderLeft: `3px solid ${isNew ? C.purple : 'transparent'}`,
                    background: isNew ? 'rgba(168,85,247,0.1)' : 'transparent',
                    borderBottom: `1px solid rgba(255,255,255,0.04)`,
                    transition: 'all 0.4s ease',
                  }}>
                    <span style={{ color: C.dim, fontSize: 12, minWidth: 72 }}>{time}</span>
                    <span style={{ color: C.white, fontWeight: 600, flex: 1 }}>{tip.username}</span>
                    <span style={{ color: C.cyan, fontWeight: 700, minWidth: 72, textAlign: 'right' }}>{tip.tokens} tk</span>
                    <span style={{ color: C.green, fontWeight: 700, minWidth: 60, textAlign: 'right' }}>${parseFloat(tip.usd || 0).toFixed(2)}</span>
                    <span style={{ color: C.dim, fontSize: 12, minWidth: 80, textAlign: 'right' }}>{tip.platform || 'extension'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 20, padding: '18px 22px', background: 'rgba(168,85,247,0.07)', border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, color: C.purple }}>Want full coaching & analytics?</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>The dashboard has pace tracking, whale alerts, AI coaching, and more.</div>
          </div>
          <a href="/dashboard" style={{ padding: '9px 20px', background: `linear-gradient(135deg, ${C.purple}, #ec4899)`, color: '#fff', borderRadius: 8, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Open Dashboard →
          </a>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}

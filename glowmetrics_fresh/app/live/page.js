'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const C = {
  bg: '#0a0814', card: 'rgba(15,20,32,0.9)', border: 'rgba(168,85,247,0.2)',
  purple: '#a855f7', cyan: '#22d3ee', green: '#10b981',
  white: '#f1f5f9', muted: '#94a3b8', dim: '#475569',
  pink: '#ec4899', gold: '#f59e0b',
};

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function getRoomHeat(tips) {
  const cutoff = Date.now() - 10 * 60 * 1000;
  const recent = tips.filter(t => new Date(t.received_at).getTime() > cutoff).length;
  if (recent === 0) return { label: 'COLD', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)', emoji: '🧊' };
  if (recent <= 2) return { label: 'WARMING', color: C.cyan, bg: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.25)', emoji: '🌊' };
  if (recent <= 5) return { label: 'ACTIVE', color: C.purple, bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.3)', emoji: '⚡' };
  return { label: 'HOT', color: C.gold, bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', emoji: '🔥' };
}

export default function LiveMode() {
  const [user, setUser]         = useState(null);
  const [tips, setTips]         = useState([]);
  const [newTipIds, setNewTipIds] = useState(new Set());
  const [status, setStatus]     = useState('connecting');
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalUsd, setTotalUsd]   = useState(0);
  const [, setTick] = useState(0);
  const lastFetchRef = useRef(null);
  const channelRef   = useRef(null);

  // Re-render every 30s to keep relative timestamps fresh
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

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
      <style>{`
        @keyframes lp-pulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
        @keyframes lp-slide-in { from{opacity:0;transform:translateY(-8px);} to{opacity:1;transform:translateY(0);} }
        @keyframes lp-glow { 0%,100%{box-shadow:0 0 8px currentColor;} 50%{box-shadow:0 0 20px currentColor;} }
        @keyframes lp-gradient { 0%{background-position:0% 50%;} 100%{background-position:100% 50%;} }
      `}</style>
      <div style={{ fontSize: 56, animation: 'lp-pulse 2s ease-in-out infinite' }}>🔒</div>
      <h2 style={{ color: C.white, margin: 0, fontSize: 24 }}>Sign in to use Live Mode</h2>
      <p style={{ color: C.muted, margin: 0 }}>You need to be logged in to track live tips.</p>
      <a href="/login" style={{ marginTop: 8, padding: '12px 28px', background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`, color: '#fff', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>
        Sign in →
      </a>
    </div>
  );

  if (status === 'connecting') return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontFamily: 'system-ui', gap: 10 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.purple, animation: 'lp-pulse 1s ease-in-out infinite' }} />
      Connecting…
      <style>{`@keyframes lp-pulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }`}</style>
    </div>
  );

  const uniqueFans = new Set(tips.map(t => t.username)).size;
  const heat = getRoomHeat(tips);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui', color: C.white }}>
      <style>{`
        @keyframes lp-pulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
        @keyframes lp-slide-in { from{opacity:0;transform:translateY(-8px);} to{opacity:1;transform:translateY(0);} }
        @keyframes lp-glow { 0%,100%{box-shadow:0 0 8px currentColor;} 50%{box-shadow:0 0 20px currentColor;} }
        @keyframes lp-bar { from{opacity:0.5;} to{opacity:1;} }
        .lp-stat-card:hover { box-shadow: 0 0 20px rgba(168,85,247,0.18) !important; transform: translateY(-1px); }
        .lp-tip-row { transition: background 0.3s ease, border-color 0.3s ease; }
        .lp-tip-row:hover { background: rgba(168,85,247,0.06) !important; }
      `}</style>

      {/* Sticky Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', borderBottom: '1px solid rgba(168,85,247,0.18)', background: 'rgba(10,8,20,0.92)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/" style={{ fontWeight: 800, fontSize: 18, background: `linear-gradient(90deg, ${C.purple}, ${C.pink})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textDecoration: 'none' }}>
            CamCash
          </a>
          {/* Animated LIVE indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: `0 0 8px ${C.green}`, animation: 'lp-pulse 1.2s ease-in-out infinite', color: C.green }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: C.green, letterSpacing: 1 }}>LIVE</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: C.muted }}>{user?.email}</span>
          <a href="/dashboard" style={{ padding: '7px 16px', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 8, color: C.purple, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
            Full Dashboard →
          </a>
          <a href="/extension" style={{ padding: '7px 14px', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
            📥 Extension
          </a>
        </div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: C.green, boxShadow: `0 0 10px ${C.green}`, animation: 'lp-pulse 1.2s ease-in-out infinite', color: C.green }} />
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Live Mode</h1>
            <span style={{ fontSize: 12, color: C.muted }}>Last 12 hours · updates in real time</span>
          </div>
          {/* Room Heat badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 20, background: heat.bg, border: `1px solid ${heat.border}` }}>
            <span style={{ fontSize: 14 }}>{heat.emoji}</span>
            <div>
              <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Room Heat</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: heat.color }}>{heat.label}</div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
          {[
            { label: 'Earned', value: `$${totalUsd.toFixed(2)}`, color: C.green, glow: 'rgba(16,185,129,0.25)' },
            { label: 'Tokens', value: totalTokens.toLocaleString(), color: C.cyan, glow: 'rgba(34,211,238,0.25)' },
            { label: 'Tips', value: tips.length, color: C.purple, glow: 'rgba(168,85,247,0.25)' },
            { label: 'Fans', value: uniqueFans, color: C.gold, glow: 'rgba(245,158,11,0.25)' },
          ].map(s => (
            <div key={s.label} className="lp-stat-card" style={{ flex: 1, minWidth: 130, background: 'rgba(15,20,32,0.95)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 14, padding: '20px 24px', transition: 'box-shadow 0.2s ease, transform 0.2s ease', cursor: 'default' }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>{s.label}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: s.color, textShadow: `0 0 16px ${s.glow}` }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tip feed */}
        <div style={{ background: 'rgba(15,20,32,0.95)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
          {/* Animated gradient line */}
          <div style={{ height: 2, background: `linear-gradient(90deg, ${C.pink}, ${C.purple}, ${C.cyan})`, backgroundSize: '200% 100%', animation: 'lp-bar 2s ease infinite alternate' }} />
          <div style={{ display: 'flex', gap: 16, padding: '12px 18px', borderBottom: '1px solid rgba(168,85,247,0.1)', background: 'rgba(168,85,247,0.04)' }}>
            <span style={{ color: C.dim, fontSize: 11, minWidth: 80, textTransform: 'uppercase', letterSpacing: 0.5 }}>When</span>
            <span style={{ color: C.dim, fontSize: 11, flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tipper</span>
            <span style={{ color: C.dim, fontSize: 11, minWidth: 72, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tokens</span>
            <span style={{ color: C.dim, fontSize: 11, minWidth: 60, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.5 }}>USD</span>
            <span style={{ color: C.dim, fontSize: 11, minWidth: 80, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.5 }}>Platform</span>
          </div>

          {tips.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16, animation: 'lp-pulse 2s ease-in-out infinite' }}>🎙️</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 8 }}>No tips yet — your stage is set</div>
              <div style={{ color: C.muted, marginBottom: 6 }}>Tips will appear here the moment they come in</div>
              <div style={{ fontSize: 13, color: C.dim, marginBottom: 20 }}>Make sure the CamCash extension is installed and you&apos;re streaming</div>
              <a href="/extension" style={{ display: 'inline-block', padding: '10px 24px', background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
                📥 Get Extension →
              </a>
            </div>
          ) : (
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {tips.map((tip, idx) => {
                const isNew = newTipIds.has(tip.id);
                const usd = parseFloat(tip.usd || 0);
                const isBig = usd >= 5;
                return (
                  <div key={tip.id} className="lp-tip-row" style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '12px 18px',
                    borderLeft: `3px solid ${isNew ? C.purple : isBig ? C.gold : 'transparent'}`,
                    background: isNew ? 'rgba(168,85,247,0.1)' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    animation: isNew ? 'lp-slide-in 0.35s ease' : idx === 0 ? 'lp-slide-in 0.35s ease' : 'none',
                  }}>
                    <span style={{ fontSize: 16, minWidth: 20 }}>{isBig ? '🐋' : '💰'}</span>
                    <span style={{ color: C.dim, fontSize: 12, minWidth: 80 }}>{relativeTime(tip.received_at)}</span>
                    <span style={{ color: C.white, fontWeight: 600, flex: 1 }}>
                      {tip.username}
                      {isNew && <span style={{ marginLeft: 8, fontSize: 10, color: C.purple, fontWeight: 800, verticalAlign: 'middle' }}>NEW ✨</span>}
                    </span>
                    <span style={{ color: C.cyan, fontWeight: 700, minWidth: 72, textAlign: 'right' }}>{tip.tokens} tk</span>
                    <span style={{ color: isBig ? C.gold : C.green, fontWeight: 700, minWidth: 60, textAlign: 'right' }}>${usd.toFixed(2)}</span>
                    <span style={{ color: C.dim, fontSize: 12, minWidth: 80, textAlign: 'right' }}>{tip.platform || 'extension'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CTA */}
        <div style={{ padding: '22px 28px', background: 'rgba(10,8,20,0.8)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, boxShadow: '0 0 32px rgba(168,85,247,0.08)', position: 'relative', overflow: 'hidden' }}>
          {/* Gradient border top */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${C.purple}, ${C.pink}, ${C.cyan})` }} />
          <div>
            <div style={{ fontWeight: 800, color: C.white, fontSize: 16, marginBottom: 4 }}>Want full coaching &amp; analytics?</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>The dashboard has pace tracking, whale alerts, AI coaching, sparklines, and more.</div>
          </div>
          <a href="/dashboard" style={{ padding: '11px 24px', background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`, color: '#fff', borderRadius: 10, fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap', fontSize: 14, boxShadow: '0 0 20px rgba(168,85,247,0.3)' }}>
            Open Dashboard →
          </a>
        </div>
      </div>
    </div>
  );
}

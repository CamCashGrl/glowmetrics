'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabase';

const C = {
  bg: '#040812', purple: '#a855f7', pink: '#ec4899', cyan: '#22d3ee',
  green: '#10b981', muted: '#94a3b8', dim: '#475569', white: '#f1f5f9',
};

function NavItem({ icon, label, href, active, tooltip, comingSoon }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={comingSoon ? undefined : href}
      onClick={comingSoon ? (e) => e.preventDefault() : undefined}
      title={comingSoon ? `${label} — coming soon` : label}
      style={{
        position: 'relative', padding: '10px 8px', textAlign: 'center', cursor: comingSoon ? 'not-allowed' : 'pointer',
        borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        background: active ? 'rgba(168,85,247,0.18)' : hovered ? 'rgba(168,85,247,0.1)' : 'transparent',
        border: active ? '1px solid rgba(168,85,247,0.4)' : '1px solid transparent',
        color: active ? C.purple : hovered ? '#c4b5fd' : C.dim,
        transition: 'all 0.18s', textDecoration: 'none', opacity: comingSoon ? 0.5 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.4, lineHeight: 1 }}>{label}</span>
      {comingSoon && hovered && (
        <div style={{ position: 'absolute', left: 88, top: '50%', transform: 'translateY(-50%)', whiteSpace: 'nowrap', background: '#1e293b', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 6, padding: '4px 8px', fontSize: 10, color: C.muted, pointerEvents: 'none', zIndex: 100 }}>
          Coming soon
        </div>
      )}
    </a>
  );
}

export default function LiveLayout({ children }) {
  const pathname = usePathname();
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      {/* ── SIDEBAR ── */}
      <div style={{
        width: 72, background: 'rgba(6,8,18,0.97)', borderRight: '1px solid rgba(168,85,247,0.15)',
        padding: '14px 6px', display: 'flex', flexDirection: 'column', gap: 6,
        position: 'sticky', top: 0, height: '100vh', zIndex: 40,
      }}>
        {/* Logo */}
        <a href="/" style={{ textAlign: 'center', fontSize: 22, marginBottom: 8, display: 'block', textDecoration: 'none' }} title="CamCash Home">
          💎
        </a>

        {/* Main nav */}
        <NavItem icon="🔴" label="Live" href="/live" active={pathname === '/live'} />
        <NavItem icon="📊" label="Dashboard" href="/dashboard" active={pathname?.startsWith('/dashboard')} />

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 4px' }} />

        {/* Tool links */}
        <NavItem icon="✏️" label="Titles" href="/guides/cam-model-room-title-generator" />
        <NavItem icon="#️⃣" label="Hashtags" href="/guides/cam-model-hashtag-generator" comingSoon />
        <NavItem icon="🪙" label="Tokens" href="/guides/cam-model-token-calculator" />
        <NavItem icon="🎲" label="Names" href="/tools/cam-model-name-generator" />

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Auth */}
        {user ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }} title={user.email}>
              {(user.email?.[0] || '?').toUpperCase()}
            </div>
            <button onClick={handleLogout} title="Sign out" style={{ background: 'transparent', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 7, padding: '5px 6px', cursor: 'pointer', fontSize: 9, color: '#f87171', fontWeight: 700, width: '100%', letterSpacing: 0.3 }}>
              Out
            </button>
          </div>
        ) : (
          <a href="/login" style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 9, background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: C.purple, fontSize: 9, fontWeight: 800, letterSpacing: 0.4, textDecoration: 'none', display: 'block' }}>
            Sign In
          </a>
        )}
      </div>

      <main style={{ flex: 1, overflowY: 'auto' }}>{children}</main>
    </div>
  );
}

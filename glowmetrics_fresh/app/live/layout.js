'use client';
import { useState, useEffect, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';

const C = {
  bg: '#040812', purple: '#a855f7', pink: '#ec4899', cyan: '#22d3ee',
  green: '#10b981', muted: '#94a3b8', dim: '#475569', white: '#f1f5f9',
};

const TOOLS = {
  titles:   { label: 'Titles',   icon: '✏️',  url: '/guides/cam-model-room-title-generator' },
  hashtags: { label: 'Hashtags', icon: '#️⃣', url: '/guides/cam-model-hashtag-generator' },
  tokens:   { label: 'Tokens',   icon: '🪙',  url: '/guides/cam-model-token-calculator' },
  names:    { label: 'Names',    icon: '🎲',  url: '/tools/cam-model-name-generator' },
};

function NavItem({ icon, label, href, active, comingSoon, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={comingSoon ? undefined : (onClick ? undefined : href)}
      onClick={comingSoon ? (e) => e.preventDefault() : onClick}
      title={comingSoon ? `${label} — coming soon` : label}
      style={{
        position: 'relative', padding: '10px 8px', textAlign: 'center',
        cursor: comingSoon ? 'not-allowed' : 'pointer',
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

function LiveLayoutInner({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState(null);

  const activeTool = searchParams.get('tool');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const openTool = (key) => {
    router.push(`/live?tool=${key}`, { scroll: false });
  };

  const closeTool = () => {
    router.push('/live', { scroll: false });
  };

  const tool = activeTool ? TOOLS[activeTool] : null;

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
        <NavItem icon="🔴" label="Live" href="/live" active={pathname === '/live' && !activeTool} onClick={activeTool ? closeTool : undefined} />
        <NavItem icon="📊" label="Dashboard" href="/dashboard" active={pathname?.startsWith('/dashboard')} />

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 4px' }} />

        {/* Tool links — open as drawer panels */}
        {Object.entries(TOOLS).map(([key, t]) => (
          <NavItem
            key={key}
            icon={t.icon}
            label={t.label}
            active={activeTool === key}
            onClick={(e) => { e.preventDefault(); activeTool === key ? closeTool() : openTool(key); }}
          />
        ))}

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

      {/* ── MAIN CONTENT ── */}
      <main style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        {children}
      </main>

      {/* ── TOOL DRAWER ── */}
      {tool && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeTool}
            style={{ position: 'fixed', inset: 0, background: 'rgba(4,8,18,0.6)', backdropFilter: 'blur(4px)', zIndex: 50 }}
          />
          {/* Drawer panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 'min(820px, calc(100vw - 72px))',
            background: '#0a0f1e',
            borderLeft: '1px solid rgba(168,85,247,0.2)',
            zIndex: 51,
            display: 'flex', flexDirection: 'column',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.6)',
          }}>
            {/* Drawer header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid rgba(168,85,247,0.15)',
              background: 'rgba(168,85,247,0.06)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{tool.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.white }}>{tool.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <a
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 11, color: C.muted, textDecoration: 'none', padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  Open full page ↗
                </a>
                <button
                  onClick={closeTool}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: C.muted, fontSize: 16, cursor: 'pointer', padding: '4px 10px', lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* iframe */}
            <iframe
              src={tool.url}
              style={{ flex: 1, border: 'none', width: '100%' }}
              title={tool.label}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function LiveLayout({ children }) {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', minHeight: '100vh', background: '#040812' }}>
        <div style={{ width: 72, background: 'rgba(6,8,18,0.97)', borderRight: '1px solid rgba(168,85,247,0.15)' }} />
        <main style={{ flex: 1 }}>{children}</main>
      </div>
    }>
      <LiveLayoutInner>{children}</LiveLayoutInner>
    </Suspense>
  );
}

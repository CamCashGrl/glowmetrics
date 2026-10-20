'use client';
import { useRouter } from 'next/navigation';
import LiveModeAllowanceBar from './components/LiveModeAllowanceBar';

export default function LiveLayout({ children }) {
  const router = useRouter();

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#0a0814',
    }}>
      <div style={{
        width: '80px',
        background: 'rgba(10, 8, 20, 0.96)',
        borderRight: '1px solid rgba(168, 85, 247, 0.2)',
        padding: '16px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'sticky',
        top: 0,
        height: '100vh',
      }}>
        <div style={{
          fontSize: '24px',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: '8px',
        }} onClick={() => router.push('/dashboard')}>
          💎
        </div>
        <NavItem icon="📊" label="Dashboard" href="/dashboard" router={router} />
        <NavItem icon="🎬" label="Live Mode" href="/live" active router={router} />
        <NavItem icon="📈" label="Analytics" href="/dashboard" router={router} />
        <NavItem icon="⚙️" label="Settings" href="/settings" router={router} />
      </div>
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <LiveModeAllowanceBar />
        {children}
      </main>
    </div>
  );
}

function NavItem({ icon, label, href, active, router }) {
  return (
    <div
      onClick={() => router.push(href)}
      style={{
        padding: '12px 8px',
        textAlign: 'center',
        cursor: 'pointer',
        borderRadius: '8px',
        background: active ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
        border: active ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid transparent',
        color: active ? '#a855f7' : '#64748b',
        transition: 'all 0.2s',
        fontSize: '24px',
        title: label,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(168, 85, 247, 0.15)';
        e.currentTarget.style.color = '#a855f7';
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#64748b';
        }
      }}
    >
      {icon}
    </div>
  );
}

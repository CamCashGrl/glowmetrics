'use client';

export default function ExtensionDownloadPage() {
  return (
    <div style={{ padding: '40px', background: '#0a0814', color: '#e2e8f0', minHeight: '100vh' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '20px' }}>💜 CamCash Live Extension</h1>
        
        <div style={{ padding: '20px', background: 'rgba(168,85,247,0.1)', borderRadius: '8px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Real-time tip tracking while you stream</h2>
          <p style={{ color: '#94a3b8', lineHeight: '1.6', marginBottom: '16px' }}>
            Track tips instantly, get whale alerts, and receive live coaching — all automatically synced to your CamCash dashboard.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0' }}>Real-Time Tracking</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>See tips instantly</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🐋</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0' }}>Whale Alerts</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Big tipper notifications</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>💰</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0' }}>Sync to Stats</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Auto-save to dashboard</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎯</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0' }}>Live Coaching</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Real-time advice</div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <a href="#" style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
            color: 'white',
            padding: '12px 28px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 'bold',
            marginBottom: '12px'
          }}>
            📥 Download Extension
          </a>
          <p style={{ fontSize: '12px', color: '#64748b' }}>v2.1.0 • Chrome • 17 KB</p>
        </div>

        <div style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)', borderRadius: '8px', padding: '16px', fontSize: '12px', lineHeight: '1.6', color: '#cbd5e1' }}>
          <strong style={{ color: '#a855f7' }}>How to install:</strong>
          <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
            <li>Download the extension ZIP</li>
            <li>Extract the folder</li>
            <li>Go to <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px' }}>chrome://extensions</code></li>
            <li>Enable "Developer mode" (top right)</li>
            <li>Click "Load unpacked" → Select the folder</li>
            <li>Go live and tips will sync automatically!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

'use client';

export default function LiveMode() {
  const containerStyle = {
    padding: '40px',
    background: '#0a0814',
    color: '#e2e8f0',
    minHeight: '100vh',
    fontFamily: 'system-ui'
  };

  const headingStyle = {
    marginBottom: '20px'
  };

  const textStyle = {
    fontSize: '16px',
    lineHeight: '1.6',
    maxWidth: '600px',
    color: '#94a3b8'
  };

  const boxStyle = {
    marginTop: '30px',
    padding: '20px',
    background: 'rgba(168, 85, 247, 0.1)',
    border: '1px solid rgba(168, 85, 247, 0.2)',
    borderRadius: '8px'
  };

  const titleStyle = {
    color: '#a855f7',
    fontWeight: 'bold'
  };

  const subStyle = {
    fontSize: '14px',
    color: '#cbd5e1',
    marginTop: '8px'
  };

  return (
    <div style={containerStyle}>
      <h1 style={headingStyle}>🎬 Live Mode</h1>
      <p style={textStyle}>
        Live Mode dashboard is currently in beta. 
        <br /><br />
        <strong>How it works:</strong>
        <br />
        1. Install the CamCash extension on your browser
        <br />
        2. Go live on Chaturbate/BongaCams/MyFreeCams
        <br />
        3. Extension automatically syncs tips to this page
        <br />
        4. Watch earnings update in real-time
        <br /><br />
        <strong>Coming soon:</strong> Real-time earnings tracker, tip notifications, coach alerts
      </p>
      <div style={boxStyle}>
        <div style={titleStyle}>💜 Get the extension</div>
        <p style={subStyle}>Load CamCashWorking-WithCoaching.zip in Chrome extensions folder to get started.</p>
      </div>
    </div>
  );
}

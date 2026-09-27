export default function NotFound() {
  return (
    <html lang="en">
      <head>
        <title>Page Not Found</title>
      </head>
      <body style={{
        margin: 0,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050713',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: 24,
      }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Page not found
          </h1>
          <p style={{ fontSize: 14, color: '#8D93AA', marginBottom: 20, lineHeight: 1.5 }}>
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <a
              href="/"
              style={{
                display: 'inline-block',
                padding: '11px 22px',
                borderRadius: 10,
                background: 'linear-gradient(90deg, #16F4FF 0%, #55B8FF 28%, #7C5CFF 52%, #FF2BAE 100%)',
                color: '#06101A',
                fontWeight: 700,
                fontSize: 14,
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              Back to home
            </a>

            <div style={{ borderTop: '1px solid #2a2d3a', paddingTop: 16, marginTop: 8 }}>
              <p style={{ fontSize: 12, color: '#8D93AA', marginBottom: 12 }}>Having trouble?</p>
              <a
                href="mailto:daphneoncam@gmail.com?subject=Bug Report - 404 Page Not Found&body=I encountered a 404 error on glowmetrics.com%0A%0APage URL:%0A%0AError details:%0A"
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  borderRadius: 8,
                  background: '#FF2BAE',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(255, 43, 174, 0.3)',
                }}
              >
                🚨 REPORT A BUG TO GET US BACK ONLINE
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}

'use client'

export default function ExtensionDownloadButton({ style }) {
  return (
    <a
      href="/camcash-extension.zip"
      download
      style={style}
      onClick={() => {
        try {
          if (typeof gtag !== 'undefined') {
            gtag('event', 'conversion', {
              'send_to': 'AW-18107430539/EXTENSION_ID_HERE',
              'value': 0.0,
              'currency': 'USD'
            })
          }
        } catch(e) {}
      }}
    >
      📥 Download ZIP — Free
    </a>
  )
}

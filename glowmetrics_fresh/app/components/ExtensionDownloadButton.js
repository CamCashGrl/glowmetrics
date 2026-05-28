'use client'

export default function ExtensionDownloadButton({ style, label }) {
  return (
    <a
      href="/camcash-extension.zip"
      download
      style={style}
      onClick={() => {
        try {
          if (typeof window.gtag !== 'undefined') {
            window.gtag('event', 'conversion', {
              'send_to': 'AW-18107430539/cTeJCMiEoLMcEIvtpbpD',
              'value': 0.0,
              'currency': 'USD'
            })
          }
        } catch(e) {}
      }}
    >
      {label ?? '📥 Install Chrome Extension — Free'}
    </a>
  )
}

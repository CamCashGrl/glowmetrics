'use client'
import Script from 'next/script'

export default function GoogleAdsConversion() {
  return (
    <Script id="ads-conversion" strategy="afterInteractive">
      {`gtag('event', 'conversion', {'send_to': 'AW-18107430539/87KkCOSzhrMcEIvtpbpD'});`}
    </Script>
  )
}

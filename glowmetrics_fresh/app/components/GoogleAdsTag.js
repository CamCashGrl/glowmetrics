'use client'
import Script from 'next/script'

export default function GoogleAdsTag() {
  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=AW-18107430539"
        strategy="afterInteractive"
      />
      <Script id="google-ads-tag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'AW-18107430539');
        `}
      </Script>
    </>
  )
}

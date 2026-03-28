import './globals.css'
import { Analytics } from '@vercel/analytics/react'

const SITE_URL = 'https://www.camcashgrl.com'
const TITLE = 'CamCash — Cam Model Analytics That Makes You More Money'
const DESC = 'Free analytics for cam models on Chaturbate, BongaCams & more. See your top tippers, best stream times, peak earning hours, and exactly what to do to increase tips. Upload your CSV — instant insights.'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s | CamCash',
  },
  description: DESC,
  keywords: [
    'cam model analytics',
    'chaturbate earnings tracker',
    'cam model tip tracker',
    'bongacams analytics',
    'cam model income tracker',
    'how to increase cam tips',
    'chaturbate token tracker',
    'cam model dashboard',
    'top tipper analytics',
    'cam model revenue',
    'myfreecams analytics',
    'best time to stream chaturbate',
    'cam model statistics',
    'stream earnings tracker',
  ],
  authors: [{ name: 'CamCash', url: SITE_URL }],
  creator: 'CamCash',
  publisher: 'CamCash',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'CamCash',
    title: TITLE,
    description: DESC,
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: 'CamCash — Cam Model Analytics Dashboard' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESC,
    images: [`${SITE_URL}/og-image.png`],
  },
  alternates: { canonical: SITE_URL },
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'CamCash',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              url: SITE_URL,
              description: DESC,
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free during beta' },
              featureList: [
                'Chaturbate earnings tracker',
                'BongaCams analytics',
                'Top tipper identification',
                'Peak earning hour detection',
                'Platform comparison',
                'Session breakdown with timeline',
                'Revenue predictions',
                'Fan re-engagement messages',
              ],
            }),
          }}
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}

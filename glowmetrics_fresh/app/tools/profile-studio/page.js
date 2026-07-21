import ProfileStudioClient from './ProfileStudioClient'

export const metadata = {
  title: 'Creator Profile Studio — Cam Bio & Tip Menu Generator | CamCash',
  description: 'Build a personalized cam bio and a fully editable tip menu based on your persona, platforms, boundaries, and pricing goals. Free to start.',
  keywords: 'cam bio generator, tip menu generator, chaturbate bio, cam model tip menu, onlyfans bio generator, cam model profile tools',
  alternates: { canonical: 'https://www.camcashgrl.com/tools/profile-studio' },
  openGraph: {
    title: 'Creator Profile Studio — Cam Bio & Tip Menu Generator',
    description: 'Two connected tools: a platform-aware bio generator and a smart, editable tip menu generator built around your boundaries and pricing.',
    url: 'https://www.camcashgrl.com/tools/profile-studio',
    type: 'website',
    images: [{ url: 'https://www.camcashgrl.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Creator Profile Studio — Cam Bio & Tip Menu Generator',
    description: 'Personalized cam bios and editable tip menus, built around your real persona and boundaries.',
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.camcashgrl.com' },
    { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://www.camcashgrl.com/tools' },
    { '@type': 'ListItem', position: 3, name: 'Creator Profile Studio', item: 'https://www.camcashgrl.com/tools/profile-studio' },
  ],
}

const toolSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Creator Profile Studio',
  applicationCategory: 'UtilityApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  description: 'Cam bio generator and tip menu generator for webcam models and content creators, personalized to persona, platform, boundaries, and pricing.',
  url: 'https://www.camcashgrl.com/tools/profile-studio',
  featureList: ['Multi-step bio generator', 'Platform-specific bio formats', 'Existing bio improvement', 'Smart tip menu pricing', 'Visual tip menu editor', 'Tip menu export'],
}

export default function ProfileStudioPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      <ProfileStudioClient />
    </>
  )
}

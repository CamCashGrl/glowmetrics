import ProfileStudioClient from './ProfileStudioClient'
import { FAQ_SCHEMA } from './components/faqData'

export const metadata = {
  title: 'Free Cam Bio Generator & Tip Menu Generator | Creator Profile Studio',
  description: 'Free AI cam bio generator for Chaturbate, MyFreeCams, Stripchat, OnlyFans & more, plus a tip menu generator with smart pricing. No account required.',
  keywords: 'cam bio generator, chaturbate bio generator, onlyfans bio generator, myfreecams bio generator, stripchat bio generator, camsoda bio generator, fansly bio generator, tip menu generator, cam model tip menu ideas, cam model tip menu templates, ai cam bio generator, free cam model tools, cam model profile generator, webcam model bio generator, cam girl bio generator',
  alternates: { canonical: 'https://www.camcashgrl.com/tools/profile-studio' },
  openGraph: {
    title: 'Free Cam Bio Generator & Tip Menu Generator — Creator Profile Studio',
    description: 'Platform-aware cam bio generator (Chaturbate, MyFreeCams, Stripchat, OnlyFans, Fansly, and more) plus a smart, editable tip menu generator built around your boundaries and pricing. 100% free.',
    url: 'https://www.camcashgrl.com/tools/profile-studio',
    type: 'website',
    images: [{ url: 'https://www.camcashgrl.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Cam Bio Generator & Tip Menu Generator',
    description: 'Personalized, platform-ready cam bios and editable tip menus, built around your real persona, boundaries, and pricing. Free, no account required.',
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
  description: 'Free cam bio generator and tip menu generator for webcam models and content creators on Chaturbate, MyFreeCams, Stripchat, CamSoda, OnlyFans, and Fansly, personalized to persona, platform, boundaries, and pricing.',
  url: 'https://www.camcashgrl.com/tools/profile-studio',
  featureList: [
    '15 platform-specific cam bio formats (Chaturbate, MyFreeCams, BongaCams, Stripchat, CamSoda, OnlyFans, Fansly, X, Instagram, and more)',
    'Existing bio audit with a quality score and rewrite',
    '14 tip menu types with platform-aware, boundary-respecting pricing',
    'Visual tip menu editor with export',
    'No account required to generate',
  ],
}

export default function ProfileStudioPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }} />
      <ProfileStudioClient />
    </>
  )
}

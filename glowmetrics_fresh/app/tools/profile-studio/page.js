import ProfileStudioClient from './ProfileStudioClient'
import { FAQ_SCHEMA } from './components/faqData'

export const metadata = {
  title: 'Cam Model Profile Builder & Tip Menu Generator — Free | CamCash',
  description: 'Free cam model profile builder and tip menu generator for Chaturbate, MyFreeCams, BongaCams, Stripchat, OnlyFans & more. AI-powered, platform-aware, fully editable. No account required.',
  keywords: 'cam model profile builder, cam bio generator, chaturbate bio generator, onlyfans bio generator, myfreecams bio generator, stripchat bio generator, camsoda bio generator, fansly bio generator, tip menu generator, cam model tip menu ideas, cam model tip menu templates, ai cam bio generator, free cam model tools, cam model profile generator, webcam model bio generator, cam girl profile',
  alternates: { canonical: 'https://www.camcashgrl.com/tools/profile-studio' },
  openGraph: {
    title: 'Cam Model Profile Builder & Tip Menu Generator — Free Tool',
    description: 'Build a professional cam model profile and smart, editable tip menu personalized to your persona, boundaries, and pricing. Works with Chaturbate, MyFreeCams, BongaCams, Stripchat, OnlyFans, Fansly & more. 100% free.',
    url: 'https://www.camcashgrl.com/tools/profile-studio',
    type: 'website',
    images: [{ url: 'https://www.camcashgrl.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cam Model Profile Builder & Tip Menu Generator',
    description: 'Free profile builder for cam models: personalized bios and editable tip menus for Chaturbate, MyFreeCams, BongaCams, Stripchat, OnlyFans & more.',
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.camcashgrl.com' },
    { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://www.camcashgrl.com/tools' },
    { '@type': 'ListItem', position: 3, name: 'Cam Model Profile Builder', item: 'https://www.camcashgrl.com/tools/profile-studio' },
  ],
}

const toolSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Cam Model Profile Builder',
  applicationCategory: 'UtilityApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  description: 'Free cam model profile builder and tip menu generator for Chaturbate, MyFreeCams, BongaCams, Stripchat, CamSoda, OnlyFans, and Fansly, personalized to your persona, platform, boundaries, and pricing.',
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

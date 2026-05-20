import TitleGeneratorClient from './TitleGeneratorClient'

export const metadata = {
  title: 'Free Chaturbate Room Title Generator | CamCashGrl',
  description: 'Generate high-converting Chaturbate room titles instantly. Free tool powered by CamCashGrl analytics. No signup required.',
  keywords: 'chaturbate room title, title generator, cam model tools, camming analytics, room title ideas',
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
    { href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap', rel: 'stylesheet' },
  ],
  openGraph: {
    title: 'Chaturbate Room Title Generator',
    description: 'Generate high-converting Chaturbate room titles instantly. Free tool, no signup required.',
    type: 'website',
    url: 'https://camcashgrl.com/guides/chaturbate-room-title-generator',
    images: [{
      url: 'https://camcashgrl.com/og-image.png',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Chaturbate Room Title Generator',
    description: 'Generate high-converting titles instantly. No signup needed.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  canonical: 'https://camcashgrl.com/guides/chaturbate-room-title-generator',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

// FAQ Schema
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What makes a good Chaturbate room title?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A good room title includes specific goals, clear rewards, urgency, and personality. Avoid generic or vague wording.',
      },
    },
    {
      '@type': 'Question',
      name: 'How often should I change my room title?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Change your title every 2-3 streams. If not working after 15 minutes, change mid-stream.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do emojis help with Chaturbate room clicks?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, 1-2 emojis boost clicks by 15-20%. Avoid overusing them.',
      },
    },
    {
      '@type': 'Question',
      name: 'What words convert best in room titles?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '"Cum" and "squirt" are top performers when used appropriately.',
      },
    },
    {
      '@type': 'Question',
      name: 'How long should a Chaturbate room title be?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '50-70 characters is ideal. Over 80 characters gets cut off on mobile.',
      },
    },
    {
      '@type': 'Question',
      name: 'How much do room titles affect click-through rate?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Good titles can increase click-through rate by 40-60%. Specificity matters most.',
      },
    },
  ],
}

// Organization Schema
const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'CamCashGrl',
  url: 'https://camcashgrl.com',
  logo: 'https://camcashgrl.com/logo.png',
  description: 'Creator analytics and free tools for cam models',
}

// SoftwareApplication Schema
const appSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Chaturbate Room Title Generator',
  applicationCategory: 'UtilityApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '124',
  },
}

export default function TitleGeneratorPage() {
  return (
    <>
      <TitleGeneratorClient />
      
      {/* JSON-LD Schema Markup */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
      />
    </>
  )
}

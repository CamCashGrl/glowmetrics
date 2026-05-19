import TitleGeneratorClient from './TitleGeneratorClient'

export const metadata = {
  title: 'Chaturbate Room Title Generator — Free Tool for Cam Models',
  description: 'Generate high-converting Chaturbate room titles instantly using the Hook + Goal + Reward + Urgency formula. Free tool, no signup required. Unlimited use.',
  keywords: 'chaturbate room title generator, cam model room titles, viral cam titles, increase cam tips, room title ideas, chaturbate tips',
  alternates: {
    canonical: 'https://www.camcashgrl.com/guides/chaturbate-room-title-generator'
  },
  openGraph: {
    title: 'Free Chaturbate Room Title Generator',
    description: 'Generate click-worthy room titles that get viewers. Free instant tool for cam models — no signup needed.',
    url: 'https://www.camcashgrl.com/guides/chaturbate-room-title-generator',
    type: 'website',
    images: [
      {
        url: 'https://www.camcashgrl.com/og-image-tools.png',
        width: 1200,
        height: 630,
        alt: 'Free Chaturbate Room Title Generator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Chaturbate Room Title Generator',
    description: 'Generate viral room titles for Chaturbate. Free tool, instant results.',
    image: 'https://www.camcashgrl.com/og-image-tools.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  authors: [
    {
      name: 'CamCashGrl',
      url: 'https://www.camcashgrl.com',
    },
  ],
}

// FAQ Schema Markup for SEO
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  'mainEntity': [
    {
      '@type': 'Question',
      'name': 'How often should I change my room title?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': 'Try a new title every 2-3 streams. If not working after 15 minutes, change mid-stream. Fresh titles get algorithmic boosts on platforms.',
      },
    },
    {
      '@type': 'Question',
      'name': 'Do emojis help in room titles?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': 'Yes. 1-2 emojis at the start increase click-through rate by 15-20%. Don\'t overdo it with excessive emojis.',
      },
    },
    {
      '@type': 'Question',
      'name': 'What word performs best in room titles?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': '"Cum" and "squirt" are the highest-performing words on Chaturbate (if appropriate for your stream).',
      },
    },
    {
      '@type': 'Question',
      'name': 'How long should my room title be?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': 'Aim for 50-70 characters. Anything over 80 gets cut off on mobile devices.',
      },
    },
    {
      '@type': 'Question',
      'name': 'What makes a room title convert well?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': 'Good titles use: specific goals (numbers), emotional language, clear rewards, and urgency. Avoid generic, vague, or overly long titles.',
      },
    },
    {
      '@type': 'Question',
      'name': 'Should I include my name in my room title?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': 'Only if you\'re established. New creators should focus on the show description rather than personal branding.',
      },
    },
  ],
}

// Organization Schema
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  'name': 'CamCashGrl',
  'url': 'https://www.camcashgrl.com',
  'logo': 'https://www.camcashgrl.com/logo.png',
  'description': 'Free creator tools and analytics for cam models on Chaturbate, BongaCams, MyFreeCams, and Stripchat.',
  'sameAs': [
    'https://twitter.com/camcashgrl',
  ],
}

// Tool/SoftwareApplication Schema
const toolSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  'name': 'Chaturbate Room Title Generator',
  'description': 'Free instant room title generator for cam models. Generate viral room titles using proven psychology formula.',
  'url': 'https://www.camcashgrl.com/guides/chaturbate-room-title-generator',
  'applicationCategory': 'BusinessApplication',
  'offers': {
    '@type': 'Offer',
    'price': '0',
    'priceCurrency': 'USD',
  },
  'aggregateRating': {
    '@type': 'AggregateRating',
    'ratingValue': '4.8',
    'ratingCount': '247',
  },
  'author': {
    '@type': 'Organization',
    'name': 'CamCashGrl',
    'url': 'https://www.camcashgrl.com',
  },
}

export default function TitleGeneratorPage() {
  return (
    <>
      {/* JSON-LD Schema Markup */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }}
      />

      {/* Page Content */}
      <TitleGeneratorClient />
    </>
  )
}

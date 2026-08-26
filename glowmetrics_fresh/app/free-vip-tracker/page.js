import FreeVipTrackerClient from './FreeVipTrackerClient'
import ShopCrossLinks from '../components/ShopCrossLinks'

export const metadata = {
  title: 'Free VIP Client Tracker | Printable PDF + Canva Template | CamCashGrl',
  description:
    'Download a free printable VIP Client Tracker designed for creators. Includes a VIP master list, session log, tip tracker, and editable Canva template.',
  keywords: [
    'free vip client tracker',
    'cam model client tracker',
    'vip client tracker printable',
    'cam model crm free',
    'creator client tracker pdf',
    'vip client mini tracker',
    'camcash',
    'cam model analytics',
    'chaturbate tip tracker',
    'cam model crm software',
  ],
  alternates: { canonical: 'https://www.camcashgrl.com/free-vip-tracker' },
  openGraph: {
    title: 'Free VIP Client Tracker | Printable PDF + Canva Template',
    description:
      'A free printable VIP Client Tracker for creators — VIP master list, session log, and tip tracker. No signup required.',
    url: 'https://www.camcashgrl.com/free-vip-tracker',
    type: 'website',
    images: [
      {
        url: 'https://www.camcashgrl.com/blog-images/vip-tracker/cover-web.jpg',
        width: 1200,
        height: 1553,
        alt: 'Pretty Profitz VIP Client Mini Tracker cover',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free VIP Client Tracker | Printable PDF + Canva Template',
    description:
      'Download a free printable VIP Client Tracker for creators — no signup required.',
    images: ['https://www.camcashgrl.com/blog-images/vip-tracker/cover-web.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.camcashgrl.com' },
    { '@type': 'ListItem', position: 2, name: 'Free VIP Client Tracker', item: 'https://www.camcashgrl.com/free-vip-tracker' },
  ],
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is it free?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes. The VIP Client Mini Tracker is completely free to download, with no signup or email required.' },
    },
    {
      '@type': 'Question',
      name: 'Can I edit it in Canva?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes. The tracker is designed to work as an editable Canva template as well as a printable PDF, so you can customize colors, fonts, and layout.' },
    },
    {
      '@type': 'Question',
      name: 'Does it work on mobile?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes. You can fill it out digitally on your phone or tablet, or print it out and fill it in by hand.' },
    },
    {
      '@type': 'Question',
      name: 'Can I print it?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes. It is formatted as a print-ready PDF that works on standard letter-size paper.' },
    },
    {
      '@type': 'Question',
      name: 'What information should I record?',
      acceptedAnswer: { '@type': 'Answer', text: 'Track usernames, platforms, preferences, boundaries, session notes, tips, and spending patterns — keep it creator-safe and only record what helps you serve your VIPs better.' },
    },
    {
      '@type': 'Question',
      name: 'What is CamCash?',
      acceptedAnswer: { '@type': 'Answer', text: 'CamCash is a free analytics dashboard for cam models and content creators. Upload a tip history CSV from Chaturbate, BongaCams, MyFreeCams, Stripchat, or CamSoda and CamCash automatically shows your top tippers, peak earning hours, best-performing sessions, and platform comparisons.' },
    },
    {
      '@type': 'Question',
      name: 'Is CamCash free to use?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes. CamCash has a free tier forever — track one platform, upload CSVs, and see a basic earnings dashboard with no credit card required. The Pro tier ($19.99/mo or $99/yr) unlocks all platforms, full tip history, advanced fan CRM tools, and more.' },
    },
  ],
}

const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'CamCash',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://www.camcashgrl.com',
  description:
    'Free analytics dashboard for cam models on Chaturbate, BongaCams, MyFreeCams, Stripchat, and CamSoda. See top tippers, peak earning hours, and platform comparisons.',
  offers: [
    { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Pro (monthly)', price: '19.99', priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Pro (annual)', price: '99', priceCurrency: 'USD' },
  ],
  featureList: [
    'Chaturbate, BongaCams, MyFreeCams, Stripchat & CamSoda tip tracking',
    'Top tipper identification and churn risk alerts',
    'Peak earning hour detection',
    'Cross-platform earnings comparison',
    'Session breakdown with revenue timeline',
    'Fan re-engagement messages',
    'Live Mode coaching',
  ],
}

const productSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'VIP Client Mini Tracker',
  brand: { '@type': 'Brand', name: 'Pretty Profitz' },
  description:
    'A free printable VIP Client Mini Tracker workbook for cam models and content creators — VIP master list, streaming session log, and tip & spending history.',
  image: 'https://www.camcashgrl.com/blog-images/vip-tracker/cover-web.jpg',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    url: 'https://www.camcashgrl.com/free-vip-tracker',
  },
}

export default function FreeVipTrackerPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <FreeVipTrackerClient />
      <div style={{ padding: "0 24px 72px" }}>
        <ShopCrossLinks
          path="/free-vip-tracker"
          heading="Printable VIP trackers from the Pretty Profitz shop"
        />
      </div>
    </>
  )
}

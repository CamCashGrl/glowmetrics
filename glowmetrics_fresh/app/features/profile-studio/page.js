import FeatureLayout, { T, s, faqSchemaFrom, Checklist } from '../../../components/FeatureLayout'

export const metadata = {
  title: 'Cam Model Bio & Tip Menu Builder | Creator Profile Studio | CamCash',
  description: 'Build stronger creator positioning with CamCash Profile Studio — bio copy and tip-menu wording shaped around your persona, boundaries, and room style. Free, no account required.',
  keywords: ['cam model bio generator', 'camgirl profile bio', 'cam tip menu', 'cam room profile'],
  alternates: { canonical: 'https://www.camcashgrl.com/features/profile-studio' },
  openGraph: {
    title: 'Creator Profile Studio | CamCash',
    description: 'Create stronger creator positioning, bio copy, and tip-menu wording — free, no account required.',
    url: 'https://www.camcashgrl.com/features/profile-studio',
    type: 'website',
    images: [{ url: 'https://www.camcashgrl.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Creator Profile Studio | CamCash',
    description: 'Create stronger creator positioning, bio copy, and tip-menu wording — free, no account required.',
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Creator Profile Studio',
  description: 'Create stronger creator positioning, bio copy, and tip-menu wording with CamCash Profile Studio.',
  url: 'https://www.camcashgrl.com/features/profile-studio',
  isPartOf: { '@type': 'WebSite', name: 'CamCash', url: 'https://www.camcashgrl.com' },
}

const faq = [
  { q: 'What does Profile Studio create?', a: 'A drafted creator bio and tip-menu wording, shaped around your positioning, boundaries, niche, and room style — for Chaturbate, BongaCams, MyFreeCams, and other platforms you list your profile on.' },
  { q: 'Is Profile Studio a Pro-only tool?', a: "No. Profile Studio is a free, public tool — it doesn't require a CamCash account or a paid plan." },
  { q: 'Can I use it without analytics data?', a: 'Yes. Profile Studio is a standalone creation tool and works with or without an active CamCash dashboard.' },
  { q: 'Does Profile Studio replace writing my own bio?', a: 'No — treat the output as a first draft to adapt to your actual voice and boundaries. The tool supports your identity, it doesn\'t replace it.' },
]

export default function ProfileStudioFeaturePage() {
  return (
    <FeatureLayout
      schema={[webPageSchema, faqSchemaFrom(faq)]}
      breadcrumb={[{ label: 'Profile Studio' }]}
      eyebrow="CamCash Feature · Free Tool"
      h1="Build a profile that gives viewers a reason to stay."
      subhead="Your analytics tell you what's happening in the room. Your profile sets the expectation before a viewer ever tips."
      heroNote="100% free — no account required"
      primaryCta={{ label: 'Create My Profile Free', href: '/tools/profile-studio' }}
      faq={faq}
      finalCta={{
        headline: 'Give viewers a reason to stay before they even tip.',
        sub: 'Draft a bio and tip menu shaped around your persona and boundaries — free, no account required.',
        label: 'Create My Profile Free',
        href: '/tools/profile-studio',
      }}
      related={[
        { href: '/tools/profile-studio', label: 'Open Profile Studio' },
        { href: '/tools/cam-model-name-generator', label: 'Cam model name generator' },
        { href: '/blog/how-to-find-your-cam-model-niche', label: 'How to find your cam model niche' },
        { href: '/blog/viral-cam-room-titles', label: 'Viral cam room titles' },
      ]}
    >
      <Checklist items={[
        'A bio draft shaped around your persona',
        'Tip menu wording that\'s easy for viewers to scan',
        'Platform-ready formatting',
        'A usable first draft in under 2 minutes',
      ]} />

      <section style={s.section}>
        <h2 style={s.h2}>A profile is part of your conversion funnel</h2>
        <p style={s.p}>
          Your bio, room positioning, and tip menu are often the first context a viewer sees. Strong positioning makes it easier to understand your vibe, what you offer, and what makes your room different — before a single tip is sent.
        </p>
        <img
          src="/feature-images/profile-studio-live.png"
          alt="CamCash Creator Profile Studio showing the bio generator and tip menu builder, with an example result and a 3-step brand, personalize, and generate flow"
          style={{ width: '100%', borderRadius: 16, border: `1px solid ${T.border}`, display: 'block' }}
        />
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Write around your actual persona</h2>
        <p style={s.p}>
          Profile Studio shapes copy around your chosen style, boundaries, niche, and room tone instead of producing the same generic bio for every creator who uses it.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>Pair profile decisions with performance data</h2>
        <p style={s.p}>
          Profile copy isn't isolated from analytics. Once <a href="/features/best-hours" style={{ color: T.cyan, textDecoration: 'none' }}>Best Hours</a> and <a href="/features/top-fans" style={{ color: T.cyan, textDecoration: 'none' }}>Top Fans</a> show you what's actually working in the room, your positioning can get more deliberate — instead of guessing what to say next.
        </p>
      </section>
    </FeatureLayout>
  )
}

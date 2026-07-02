export const metadata = {
  title: "Cam Model Analytics Dashboard for Chaturbate, BongaCams and MFC",
  description:
    "Upload your cam site CSV and see your best hours, top fans, session breakdowns, and platform earnings in one dashboard. Free during beta.",
  alternates: {
    // /landing renders the same signup/auth experience as the homepage and is
    // used site-wide as the CTA/checkout-resume destination (pricing, demo,
    // footer, etc). It should not compete with "/" in organic search.
    canonical: "https://www.camcashgrl.com",
  },
  robots: {
    index: false,
    follow: true,
    googleBot: {
      index: false,
      follow: true,
    },
  },
  openGraph: {
    title: "Cam Model Analytics Dashboard for Chaturbate, BongaCams and MFC",
    description:
      "Upload your cam site CSV and see your best hours, top fans, session breakdowns, and platform earnings in one dashboard. Free during beta.",
    url: "https://www.camcashgrl.com/landing",
    siteName: "CamCash",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cam Model Analytics Dashboard for Chaturbate, BongaCams and MFC",
    description:
      "Upload your cam site CSV and see your best hours, top fans, session breakdowns, and platform earnings in one dashboard. Free during beta.",
  },
}

export default function LandingLayout({ children }) {
  return children
}

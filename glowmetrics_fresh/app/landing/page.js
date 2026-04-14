// app/landing/page.js
// Server component — Google reads this fully. LandingClient is the interactive UI.
// IMPORTANT: rename the current landing/page.js to landing/LandingClient.js
// and add "use client" at the top of it before deploying.

import LandingClient from './LandingClient'

export const metadata = {
  title: 'CamCash — Cam Model Analytics That Makes You More Money',
  description: 'Upload your Chaturbate or BongaCams CSV and instantly see your top tippers, best stream times, peak earning hours, and what to do to earn more. Free cam model analytics.',
  alternates: { canonical: 'https://www.camcashgrl.com' },
  openGraph: {
    title: 'CamCash — Cam Model Analytics That Makes You More Money',
    description: 'Know exactly when to go live, who your most valuable fans are, and how much more you could be earning. Free for cam models.',
    url: 'https://www.camcashgrl.com',
    type: 'website',
  },
}

export default function LandingPage() {
  return (
    <>
      {/* Crawlable SEO content — server rendered, visible to Google */}
      <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
        <h1>CamCash — Free Cam Model Analytics Dashboard</h1>
        <p>CamCash is a free analytics tool for cam models on Chaturbate, BongaCams, MyFreeCams, CamSoda, and Stripchat. Upload your CSV to see your top tippers, peak earning hours, best streaming days, and get personalized recommendations to increase your income.</p>
        <h2>Features</h2>
        <ul>
          <li>Top tipper tracking — see who your highest-value fans are across all platforms</li>
          <li>Peak earning hour detection — know exactly when to go live</li>
          <li>Platform comparison — Chaturbate vs BongaCams earnings per hour</li>
          <li>Session breakdown — timeline of when tips came in and what drove them</li>
          <li>Fan re-engagement — personalized messages when a whale goes quiet</li>
          <li>Revenue predictions based on your historical data</li>
          <li>Room title generator for Lovense Lush, Domi, and interactive shows</li>
        </ul>
        <p>Free during beta. No credit card required. Upload your first CSV in under 2 minutes.</p>
      </div>
      <LandingClient />
    </>
  )
}

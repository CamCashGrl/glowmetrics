import StoreClient from './StoreClient'

export const metadata = {
  title: 'CamCash Store — Tools Made for Creators',
  description:
    'Ready-to-use workbooks, scripts, trackers and cam-room tools built to help cam models stay organized, look professional and earn more. Instant digital downloads.',
  keywords: [
    'cam model tools',
    'cam model tip menu',
    'cam model client tracker',
    'cam room scripts',
    'cam model branding kit',
    'cam model games',
  ],
  alternates: {
    canonical: 'https://www.camcashgrl.com/store',
  },
}

export default function StorePage() {
  return <StoreClient />
}

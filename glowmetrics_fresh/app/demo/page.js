import DemoClient from './DemoClient'

export const metadata = {
  title: 'CamCash Live Demo — See Your Stream Analytics in Real Time',
  description:
    'Try CamCash free — no signup needed. See live viewer tracking, AI coaching, tip analytics, and engagement insights for cam models on Chaturbate, BongaCams, and MyFreeCams.',
  keywords: [
    'cam model analytics',
    'live stream analytics',
    'chaturbate analytics',
    'creator coaching',
    'stream optimization',
    'cam model tools',
    'webcam creator tools',
    'creator engagement tools',
    'livestream analytics',
  ],
  openGraph: {
    title: 'CamCash Live Demo — See Your Stream Analytics in Real Time',
    description: 'Try the CamCash live demo free. Real-time viewer tracking, AI coaching, and tip analytics for cam models.',
    url: 'https://www.camcashgrl.com/demo',
  },
}

export default function DemoPage() {
  return <DemoClient />
}

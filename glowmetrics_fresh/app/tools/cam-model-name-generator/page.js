import NameGeneratorClient from './NameGeneratorClient'

export const metadata = {
  title: 'Cam Model Name Generator — Find Your Perfect Stage Name | CamCash',
  description: 'Free cam model name generator. Generate brandable stage names and check availability across Chaturbate, OnlyFans, Instagram, TikTok, and more. Includes brand strength scoring.',
  alternates: { canonical: 'https://www.camcashgrl.com/tools/cam-model-name-generator' },
  openGraph: {
    title: 'Cam Model Name Generator — Find Your Perfect Stage Name',
    description: 'Free cam model name generator with brand strength scoring and availability checking.',
    url: 'https://www.camcashgrl.com/tools/cam-model-name-generator',
    type: 'website',
  },
}

export default function CamModelNameGeneratorPage() {
  return <NameGeneratorClient />
}

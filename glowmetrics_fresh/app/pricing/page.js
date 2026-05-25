import PricingClient from './PricingClient'
import GoogleAdsConversion from '../components/GoogleAdsConversion'

export const metadata = {
  title: 'Transparent Pricing — CamCash Cam Model Analytics',
  description:
    'CamCash pricing: Free tier forever + optional premium at $19.99/month. Early adopters lock in $9.99/month lifetime. Transparent, no surprises.',
  keywords: [
    'free analytics',
    'affordable creator tools',
    'lifetime pricing',
    'early adopter discount',
    'cam model tools pricing',
  ],
}

export default function PricingPage() {
  return (
    <>
      <GoogleAdsConversion />
      <PricingClient />
    </>
  )
}

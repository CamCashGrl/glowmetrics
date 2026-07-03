'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'

const FeedbackWidget = dynamic(() => import('./FeedbackWidget'), { ssr: false })

const FEEDBACK_WIDGET_PATHS = ['/dashboard', '/onboarding', '/upload']

export default function FeedbackWidgetGate() {
  const pathname = usePathname()
  const isEligiblePage = FEEDBACK_WIDGET_PATHS.some(p => pathname?.startsWith(p))
  if (!isEligiblePage) return null
  return <FeedbackWidget />
}

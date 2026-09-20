'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'

const FeedbackWidget = dynamic(() => import('./FeedbackWidget'), { ssr: false })

// '/dashboard' removed — superseded there by the new FeedbackButton/FeedbackModal
// system (components/FeedbackButton.jsx), which persists to public.feedback with
// server-derived auth instead of this widget's client-side insert.
const FEEDBACK_WIDGET_PATHS = ['/onboarding', '/upload']

export default function FeedbackWidgetGate() {
  const pathname = usePathname()
  const isEligiblePage = FEEDBACK_WIDGET_PATHS.some(p => pathname?.startsWith(p))
  if (!isEligiblePage) return null
  return <FeedbackWidget />
}

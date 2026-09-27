'use client'

import { useCallback } from 'react'

export default function CamGirl101CTA({ href, text, style, isEtsy = false }) {
  const handleClick = useCallback(async () => {
    try {
      const eventType = isEtsy ? 'etsy_product_click' : 'free_tracker_download'
      const response = await fetch('/api/analytics/track-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          source: 'cam-girl-101-blog',
          referral: isEtsy ? 'https://www.etsy.com/listing/4583534851' : '/cam-girl-101-free.pdf',
          timestamp: new Date().toISOString(),
        }),
      })

      if (!response.ok) console.warn('Failed to track event')
    } catch (e) {
      console.warn('Tracking error:', e.message)
    }

    if (isEtsy) {
      window.open(href, '_blank', 'noopener,noreferrer')
    } else {
      window.location.href = href
    }
  }, [href, isEtsy])

  return (
    <a onClick={handleClick} style={{ ...style, cursor: 'pointer' }}>
      {text}
    </a>
  )
}

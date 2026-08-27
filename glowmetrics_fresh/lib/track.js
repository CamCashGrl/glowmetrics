export function track(eventName, properties = {}) {
  if (typeof window === 'undefined') return

  // GTM / GA4
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event: eventName, ...properties })

  // Supabase server-side log (fire and forget)
  const body = JSON.stringify({
    event_name: eventName,
    properties,
    session_id: getSessionId(),
    url: window.location.href,
  })

  // A plain fetch() is cancelled when the page navigates away, which is
  // exactly when the most valuable events fire: CTA clicks that leave for
  // Stripe, signup, or another route. sendBeacon is queued by the browser
  // and delivered after unload, so those stop being silently dropped.
  // Same-origin, so it still carries the auth cookie /api/track reads.
  try {
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(
        '/api/track',
        new Blob([body], { type: 'application/json' })
      )
      if (ok) return
    }
  } catch {}

  // keepalive gives the fetch fallback the same survive-navigation property.
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}

function getSessionId() {
  try {
    let sid = sessionStorage.getItem('cc_sid')
    if (!sid) {
      sid = crypto.randomUUID()
      sessionStorage.setItem('cc_sid', sid)
    }
    return sid
  } catch { return null }
}

export function track(eventName, properties = {}) {
  if (typeof window === 'undefined') return

  // Supabase server-side log (fire and forget)
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: eventName,
      properties,
      session_id: getSessionId(),
      url: window.location.href,
    }),
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

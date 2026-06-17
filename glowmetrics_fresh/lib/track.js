export function track(eventName, properties = {}) {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({
    event: eventName,
    ...properties,
  })
}

// Shared dashboard glyphs.
//
// EnvelopeHeartIcon is the one "message a fan" mark — an envelope outline with
// a heart in it. It lived inline in page.js and was used on six surfaces; the
// conversion redesign replaced five of them with plain text buttons, so the
// fan list lost the glyph it had always carried. Defining it once here means
// every Message action reads the same, wherever it appears.

export function EnvelopeHeartIcon({ size = 16, heartColor = "#FF2BAE" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: "block" }}>
      <rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 6.5L12 13L21 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M12 11.3c-.85-1.3-2.75-1.2-3.2.2-.4 1.1.6 2 3.2 3.7 2.6-1.7 3.6-2.6 3.2-3.7-.45-1.4-2.35-1.5-3.2-.2z" fill={heartColor} />
    </svg>
  )
}

export default EnvelopeHeartIcon

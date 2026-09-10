// Shared CORS handling for the /api/live/session/* routes, callable by both
// the website (same-origin, doesn't need this) and the Chrome extension
// (chrome-extension:// origin, blocked by the browser without it). Mirrors
// the existing pattern already used by app/api/live/tips/route.js — kept as
// one shared helper here instead of duplicating it across 8 route files.
export function corsHeaders(req) {
  const origin = req.headers.get('origin') || ''
  const allowed = origin.startsWith('chrome-extension://') ? origin : 'https://www.camcashgrl.com'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export function withCors(req, response) {
  const cors = corsHeaders(req)
  for (const [key, value] of Object.entries(cors)) {
    response.headers.set(key, value)
  }
  return response
}

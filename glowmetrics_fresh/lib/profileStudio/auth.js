import { createSupabaseRouteClient } from '../supabase-server'

// Shared auth resolver for Creator Profile Studio API routes. Cookie-based
// only (first-party website calls) — unlike Live Mode, these routes have no
// browser-extension caller, so there's no Bearer-token path to support.
//
// A null user is a normal, expected result here — the Bio and Tip Menu
// generators are usable signed-out (this tool is meant to pull visitors
// into signing up, not gate them out first). Callers persist to the
// database only when user is non-null.
export async function getProfileStudioCaller() {
  const supabase = createSupabaseRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user: user ?? null }
}

// Best-effort caller identity for rate limiting anonymous requests. Proxies
// (including Vercel's) set x-forwarded-for as a comma-separated list with
// the original client first; fall back to a shared bucket if neither header
// is present rather than throwing.
export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

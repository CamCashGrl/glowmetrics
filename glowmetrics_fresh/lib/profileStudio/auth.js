import { createSupabaseRouteClient } from '../supabase-server'

// Shared auth resolver for Creator Profile Studio API routes. Cookie-based
// only (first-party website calls) — unlike Live Mode, these routes have no
// browser-extension caller, so there's no Bearer-token path to support.
export async function getProfileStudioCaller() {
  const supabase = createSupabaseRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user: user ?? null }
}

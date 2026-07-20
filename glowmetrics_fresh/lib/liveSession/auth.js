import { createClient } from '@supabase/supabase-js'
import { createSupabaseRouteClient } from '../supabase-server'

// Shared authenticated-caller resolver for the Live Mode session routes.
// Checks a Bearer token first (the extension's existing auth pattern, same
// as app/api/live/tips/route.js) and falls back to the cookie-based session
// (first-party website calls, same as other route handlers). Returns the
// Supabase client to use for the RPC/query call and the resolved user, or a
// null user if neither auth path produced one — callers return 401 in that
// case rather than falling through to a service-role client, since these
// routes must never use one.
export async function getLiveSessionCaller(request) {
  const authHeader = request.headers.get('authorization')

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return { supabase, user: null }
    // Re-issue the client with the caller's token attached so subsequent
    // .rpc()/.from() calls carry the same auth context auth.uid() reads.
    const authedSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    return { supabase: authedSupabase, user }
  }

  const supabase = createSupabaseRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user: user ?? null }
}

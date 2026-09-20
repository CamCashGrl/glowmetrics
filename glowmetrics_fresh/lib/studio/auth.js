import { createClient } from '@supabase/supabase-js'
import { createSupabaseRouteClient } from '../supabase-server'

// Shared auth resolver for Studio API routes — cookie-based, mirrors
// lib/profileStudio/auth.js. Unlike that tool, Studio routes always require
// a signed-in user (there is no signed-out use case for agency management).
export async function getStudioCaller() {
  const supabase = createSupabaseRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user: user ?? null }
}

// Service-role client — used ONLY for the two things regular RLS-scoped
// queries cannot do for Studio: resolving an invited model's email to her
// auth.users id, and reading a linked model's profiles.display_name for
// display (profiles RLS is strictly auth.uid() = id; studio_models' RLS
// grants no access to profiles at all, only to tips/live_sessions/
// live_tips/paid_sessions — see supabase/migrations/20260909021417_studios_phase1.sql).
// Never used to write studio_models rows — those inserts/updates always go
// through the caller's own RLS-scoped client so Postgres enforces
// ownership, not application code.
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Same non-paginated listUsers+filter approach already used in
// app/api/admin/stats/route.js — consistent with existing precedent rather
// than introducing a new lookup pattern.
export async function findUserIdByEmail(email) {
  const client = serviceClient()
  const target = email.trim().toLowerCase()
  const { data, error } = await client.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  const match = data.users.find((u) => (u.email || '').toLowerCase() === target)
  return match ? match.id : null
}

export async function getDisplayNamesByUserId(userIds) {
  if (!userIds.length) return {}
  const client = serviceClient()
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds)
  if (error) throw error
  return Object.fromEntries(data.map((row) => [row.id, row.display_name]))
}

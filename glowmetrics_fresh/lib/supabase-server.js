import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Shared route-handler client — every API route needs the same getAll/setAll
// cookie adapter, so it lives here once instead of being copied per-route.
export function createSupabaseRouteClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )
}

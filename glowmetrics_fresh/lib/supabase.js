import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// createClientComponentClient (not the plain supabase-js createClient) so the
// session is persisted in a cookie the server route handlers can read via
// createRouteHandlerClient — localStorage-only sessions are invisible to
// /api/stripe/checkout, /api/stripe/portal, and /api/track, which all read
// auth from cookies.
export const supabase = createClientComponentClient()

// Global handler — catches the refresh_token_not_found 400 loop
// that was hammering auth logs and locking out returning users
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') return
    if (!session && event !== 'INITIAL_SESSION') {
      // Session gone but not by choice — clear stale tokens
      supabase.auth.signOut().then(() => {
        if (window.location.pathname.startsWith('/dashboard') ||
            window.location.pathname.startsWith('/live')) {
          window.location.href = '/landing'
        }
      })
    }
  })
}

import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://hlsdlaibnayzbfflxclj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc2RsYWlibmF5emJmZmx4Y2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjQwODUsImV4cCI6MjA4OTIwMDA4NX0.5FwPe35UL-o46FvBJX526La5o7jcbFaP1KVoLtI4U_M',
  {
    auth: {
      onAuthStateChange: (event, session) => {
        if (event === 'TOKEN_REFRESHED' && !session) {
          // Refresh failed — clear everything and send to login
          supabase.auth.signOut()
          if (typeof window !== 'undefined') {
            window.location.href = '/landing'
          }
        }
      },
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
)

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

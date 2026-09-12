import { createBrowserClient } from '@supabase/ssr'

// createBrowserClient (not the plain supabase-js createClient) so the
// session is persisted in a cookie the server route handlers can read via
// createServerClient (lib/supabase-server.js) — localStorage-only sessions
// are invisible to /api/stripe/checkout, /api/stripe/portal, and /api/track,
// which all read auth from cookies.

let supabaseInstance = null

const initSupabase = () => {
  if (typeof window === 'undefined') {
    return null
  }

  if (supabaseInstance) return supabaseInstance

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('Supabase env vars not available')
    return null
  }

  try {
    supabaseInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  } catch (err) {
    console.error('Supabase initialization failed:', err.message)
  }

  return supabaseInstance
}

const createStubClient = () => ({
  auth: { onAuthStateChange: () => {}, signOut: async () => {} },
  from: () => ({ select: () => ({ eq: () => ({}) }) }),
  rpc: () => ({})
})

export const supabase = new Proxy(createStubClient(), {
  get(target, prop) {
    const instance = initSupabase() || createStubClient()
    const value = instance[prop]
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  }
})

// Global handler — catches the refresh_token_not_found 400 loop
// that was hammering auth logs and locking out returning users
if (typeof window !== 'undefined') {
  const instance = initSupabase()
  instance?.auth?.onAuthStateChange?.((event, session) => {
    if (event === 'SIGNED_OUT') return
    if (!session && event !== 'INITIAL_SESSION') {
      // Session gone but not by choice — clear stale tokens
      instance.auth.signOut().then(() => {
        if (window.location.pathname.startsWith('/dashboard') ||
            window.location.pathname.startsWith('/live')) {
          window.location.href = '/landing'
        }
      })
    }
  })
}

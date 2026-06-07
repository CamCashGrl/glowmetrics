'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Only works in Vercel preview environments.
// Set NEXT_PUBLIC_PREVIEW_EMAIL and NEXT_PUBLIC_PREVIEW_PASSWORD
// in Vercel → Settings → Environment Variables → Preview only.
export default function PreviewLogin() {
  const params    = useSearchParams()
  const redirectTo = params.get('to') || '/dashboard'
  const [status, setStatus] = useState('Signing in…')

  useEffect(() => {
    const env   = process.env.NEXT_PUBLIC_VERCEL_ENV
    const email = process.env.NEXT_PUBLIC_PREVIEW_EMAIL
    const pass  = process.env.NEXT_PUBLIC_PREVIEW_PASSWORD

    if (env !== 'preview') {
      setStatus('Not available in this environment.')
      return
    }
    if (!email || !pass) {
      setStatus('Preview credentials not configured. Add NEXT_PUBLIC_PREVIEW_EMAIL and NEXT_PUBLIC_PREVIEW_PASSWORD in Vercel → Environment Variables → Preview.')
      return
    }

    supabase.auth.signInWithPassword({ email, password: pass }).then(({ error }) => {
      if (error) {
        setStatus(`Login failed: ${error.message}`)
      } else {
        window.location.href = redirectTo
      }
    })
  }, [redirectTo])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0F1117', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center', color: '#8B92A0', fontSize: 14 }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>🔐</div>
        <div>{status}</div>
      </div>
    </div>
  )
}

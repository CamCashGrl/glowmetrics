'use client'

// The gate. CamCash is no longer freemium: after onboarding, every account
// without access (see lib/plan.js) lands here instead of on a dashboard full
// of locked cards. The only way through is Stripe Checkout, which collects a
// card and opens a TRIAL_DAYS free trial.
//
// This page never grants access itself — it just sends the user to Stripe.
// Access flips only when the Stripe webhook writes profiles.plan, so nothing
// here (and no query param on the way back) can unlock the product.

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { track } from '../../lib/track'
import { hasAppAccess, TRIAL_DAYS } from '../../lib/plan'

const C = {
  bg: '#05070f', card: '#121826', border: '#1e2d45',
  cyan: '#22D3EE', pink: '#EC4899', white: '#F1F5F9', text: '#94A3B8', muted: '#475569',
}

const INCLUDED = [
  ['📈', 'Best stream windows', 'Which days and hours actually earn the most per hour streamed.'],
  ['🐋', 'Fan & whale intelligence', 'Your highest-value tippers, ranked, with re-engagement cues.'],
  ['🔀', 'Platform comparison', 'See which cam site pays you best, by hour, day, and fan type.'],
  ['📡', 'Live Mode', 'Real-time tip tracking and coaching while you stream.'],
  ['🧾', 'Session breakdowns', 'What worked in each stream — and what to repeat next time.'],
]

function StartTrialInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(true)
  const canceled = searchParams.get('canceled') === 'true'

  // Anyone who already has access (subscriber, active trial, grandfathered
  // account) has no business on the gate — send them to the product.
  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!active) return
      if (!user) { router.replace('/login'); return }
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan, plan_expires_at, trial_ends_at')
        .eq('id', user.id)
        .maybeSingle()
      if (!active) return
      if (hasAppAccess(profile)) { router.replace('/dashboard'); return }
      setChecking(false)
    })
    return () => { active = false }
  }, [router])

  const startTrial = async (planType) => {
    setLoading(planType)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Your login session expired. Please sign in again.')
        return
      }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ plan_type: planType }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        setError(data.error || 'Could not open secure checkout. Please try again.')
        return
      }
      track('trial_checkout_started', { plan_type: planType })
      window.location.assign(data.url)
    } catch (e) {
      setError('Something went wrong opening checkout. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text, fontSize: 14 }}>
        Loading your account…
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, padding: '48px 20px 80px',
      backgroundImage: `radial-gradient(circle at 12% 0%, rgba(34,211,238,0.10), transparent 42%), radial-gradient(circle at 88% 100%, rgba(236,72,153,0.10), transparent 44%)`,
    }}>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: C.cyan, marginBottom: 12 }}>
            {TRIAL_DAYS}-day free trial
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: C.white, lineHeight: 1.2, margin: '0 0 12px' }}>
            Your data is in. Unlock what CamCash found.
          </h1>
          <p style={{ fontSize: 15, color: C.text, lineHeight: 1.6, margin: 0 }}>
            Start your free trial to open your full dashboard. You won&apos;t be charged
            for {TRIAL_DAYS} days, and you can cancel any time before then.
          </p>
        </div>

        {canceled && (
          <div style={{ padding: '13px 16px', borderRadius: 14, marginBottom: 20, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#FCD34D', fontSize: 13.5, lineHeight: 1.5 }}>
            Checkout was closed before it finished, so your trial hasn&apos;t started yet.
            Your imported history is saved and waiting.
          </div>
        )}

        {error && (
          <div style={{ padding: '13px 16px', borderRadius: 14, marginBottom: 20, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.28)', color: '#FCA5A5', fontSize: 13.5, lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        <div style={{
          borderRadius: 22, padding: '26px 24px', marginBottom: 18,
          background: `radial-gradient(circle at 0% 0%, rgba(34,211,238,0.10), transparent 40%), radial-gradient(circle at 100% 100%, rgba(236,72,153,0.10), transparent 42%), ${C.card}`,
          border: `1px solid ${C.border}`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 42px rgba(0,0,0,0.35)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 16 }}>
            Everything unlocks the moment your trial starts
          </div>
          {INCLUDED.map(([icon, title, sub]) => (
            <div key={title} style={{ display: 'flex', gap: 13, alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 11, background: 'rgba(34,211,238,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{icon}</div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.white, marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>{sub}</div>
              </div>
            </div>
          ))}

          <button
            onClick={() => startTrial('standard_monthly')}
            disabled={!!loading}
            style={{
              width: '100%', marginTop: 8, padding: '15px 20px', borderRadius: 15, border: 'none',
              background: `linear-gradient(90deg, ${C.cyan}, ${C.pink})`,
              color: '#05070f', fontSize: 15, fontWeight: 800, cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading === 'standard_monthly' ? 'Opening secure checkout…' : `Start my ${TRIAL_DAYS}-day free trial`}
          </button>

          <button
            onClick={() => startTrial('standard_annual')}
            disabled={!!loading}
            style={{
              width: '100%', marginTop: 10, padding: '13px 20px', borderRadius: 15,
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.white, fontSize: 13.5, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading === 'standard_annual' ? 'Opening secure checkout…' : 'Start the trial on annual billing'}
          </button>

          <div style={{ marginTop: 14, fontSize: 11.5, color: C.muted, textAlign: 'center', lineHeight: 1.6 }}>
            Secure checkout powered by Stripe. Card required to start the trial —
            billing begins after {TRIAL_DAYS} days unless you cancel.
            <br />Your imported data stays private and is never sold.
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }}
            style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

// useSearchParams() needs a Suspense boundary or Next refuses to prerender
// this route at build time.
export default function StartTrialPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text, fontSize: 14 }}>
        Loading your account…
      </div>
    }>
      <StartTrialInner />
    </Suspense>
  )
}

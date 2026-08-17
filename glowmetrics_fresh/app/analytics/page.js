'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// SECURITY: this page is internal (cross-user signup/onboarding data,
// including other creators' display names and Chaturbate usernames). It
// previously queried Supabase straight from the browser with the anon key
// and NO authentication -- anyone who typed the URL got the page, and what
// it returned depended purely on whichever RLS policy each table happened
// to carry.
//
// It now follows the same pattern as the rest of /admin: the cookie check
// below is a redirect for UX only, and the real gate is server side in
// /api/admin/funnel, which verifies the HMAC gm_admin token before running
// any query. The browser no longer issues a single cross-user query itself.

const STEP_LABELS = {
  platform: 'Chose platform',
  username: 'Entered CB username',
  paste: 'Pasted tip history',
  csv: 'Chose CSV upload',
  preview: 'Reviewed preview',
  loading: 'Import processing',
  live: 'Live mode screen',
  step4: 'Post-import choice',
  done: 'Saw completion screen',
}

function timeAgo(iso) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

export default function FunnelPage() {
  const router = useRouter()
  const [d, setD] = useState(null)
  const [stepFunnel, setStepFunnel] = useState([])
  const [dropoffs, setDropoffs] = useState([])
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    // UX redirect only. Deleting or forging this cookie does not grant
    // access -- /api/admin/funnel verifies the signed token server side.
    if (!document.cookie.includes('gm_admin=')) { router.replace('/admin/login'); return }
    let cancelled = false
    async function load() {
      const res = await fetch('/api/admin/funnel', { credentials: 'include' })
      if (!res.ok) { if (!cancelled) setDenied(true); return }
      const json = await res.json()
      if (cancelled) return
      setD(json.totals)
      setStepFunnel(json.stepFunnel || [])
      setDropoffs(json.dropoffs || [])
    }
    load()
    return () => { cancelled = true }
  }, [router])

  const C = { bg:'#05070f', card:'#121826', border:'#1e2d45', white:'#F1F5F9', muted:'#475569' }

  if (denied) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex',
      alignItems:'center', justifyContent:'center', color:'#94A3B8',
      fontFamily:'Inter,sans-serif' }}>Not authorised.</div>
  )

  if (!d) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex',
      alignItems:'center', justifyContent:'center', color:'#94A3B8',
      fontFamily:'Inter,sans-serif' }}>Loading...</div>
  )

  const steps = [
    { label: 'Total Signups',              value: d.signups,   prev: null,        color: '#22D3EE' },
    { label: 'Completed Onboarding',       value: d.onboarded, prev: d.signups,   color: '#7C5CFF' },
    { label: 'Activated (data uploaded)', value: d.activated, prev: d.onboarded, color: '#10B981' },
  ]

  return (
    <div style={{ minHeight:'100vh', background:C.bg, padding:'40px 20px',
      fontFamily:'Inter,sans-serif', color:'#94A3B8' }}>
      <div style={{ maxWidth:700, margin:'0 auto' }}>
        <h1 style={{ fontSize:26, fontWeight:800, color:C.white, marginBottom:6 }}>
          Activation Funnel
        </h1>
        <p style={{ color:C.muted, marginBottom:36, fontSize:14 }}>
          camcashgrl.com — internal only
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {steps.map((s, i) => {
            const pct = s.prev ? Math.round((s.value / Math.max(s.prev, 1)) * 100) : 100
            return (
              <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`,
                borderRadius:12, padding:'18px 22px' }}>
                <div style={{ display:'flex', justifyContent:'space-between',
                  alignItems:'center', marginBottom:10 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:C.white }}>{s.label}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                    {s.prev !== null && (
                      <span style={{ fontSize:12, color:C.muted }}>{pct}% conversion</span>
                    )}
                    <span style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</span>
                  </div>
                </div>
                <div style={{ height:5, background:C.border, borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:s.color,
                    borderRadius:3, transition:'width 0.4s ease' }} />
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ marginTop:32, padding:'18px 22px', background:C.card,
          border:`1px solid ${C.border}`, borderRadius:12 }}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>Overall activation rate</div>
          <div style={{ fontSize:32, fontWeight:900, color:'#10B981' }}>
            {d.signups > 0 ? Math.round((d.activated / d.signups) * 100) : 0}%
          </div>
          <div style={{ fontSize:12, color:C.muted }}>of signups have uploaded data</div>
        </div>

        <h2 style={{ fontSize:18, fontWeight:800, color:C.white, marginTop:44, marginBottom:6 }}>
          Onboarding Step Funnel
        </h2>
        <p style={{ color:C.muted, marginBottom:18, fontSize:13 }}>
          Distinct users who reached each step of the onboarding wizard
        </p>
        {stepFunnel.length === 0 ? (
          <div style={{ color:C.muted, fontSize:13 }}>No onboarding step events recorded yet.</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {stepFunnel.map((s, i) => {
              const max = stepFunnel[0]?.value || 1
              const pct = Math.round((s.value / max) * 100)
              return (
                <div key={s.step} style={{ background:C.card, border:`1px solid ${C.border}`,
                  borderRadius:12, padding:'14px 18px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between',
                    alignItems:'center', marginBottom:8 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:C.white }}>{s.label}</span>
                    <span style={{ fontSize:18, fontWeight:800, color:'#22D3EE' }}>{s.value}</span>
                  </div>
                  <div style={{ height:5, background:C.border, borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:'#22D3EE',
                      borderRadius:3, transition:'width 0.4s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <h2 style={{ fontSize:18, fontWeight:800, color:C.white, marginTop:44, marginBottom:6 }}>
          Recent Drop-offs
        </h2>
        <p style={{ color:C.muted, marginBottom:18, fontSize:13 }}>
          Users who started onboarding but haven't completed it, with the last step they viewed
        </p>
        {dropoffs.length === 0 ? (
          <div style={{ color:C.muted, fontSize:13 }}>No in-progress drop-offs right now.</div>
        ) : (
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' }}>
            {dropoffs.map((u, i) => (
              <div key={u.userId} style={{ display:'flex', justifyContent:'space-between',
                alignItems:'center', padding:'12px 18px',
                borderBottom: i < dropoffs.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{u.label}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{u.platform || '—'}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#F59E0B' }}>
                    stuck at: {STEP_LABELS[u.step] || u.step}
                  </div>
                  <div style={{ fontSize:11, color:C.muted }}>{timeAgo(u.at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

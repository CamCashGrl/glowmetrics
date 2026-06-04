'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function FunnelPage() {
  const [d, setD] = useState(null)

  useEffect(() => {
    async function load() {
      const { count: signups } = await supabase
        .from('beta_users')
        .select('*', { count: 'exact', head: true })

      const { count: onboarded } = await supabase
        .from('beta_users')
        .select('*', { count: 'exact', head: true })
        .eq('onboarding_complete', true)

      const { data: tipsData } = await supabase
        .from('tips')
        .select('user_id')
        .limit(1000)

      const activated = new Set(tipsData?.map(t => t.user_id) || []).size
      setD({ signups: signups || 0, onboarded: onboarded || 0, activated })
    }
    load()
  }, [])

  const C = { bg:'#05070f', card:'#121826', border:'#1e2d45', white:'#F1F5F9', muted:'#475569' }

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
      </div>
    </div>
  )
}

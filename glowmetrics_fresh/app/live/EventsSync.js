'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function EventsSync({ onNewTip }) {
  const [status, setStatus] = useState('connecting')
  // 'connecting' | 'live' | 'error' | 'no_token'
  const [tipCount, setTipCount] = useState(0)
  const pollRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    startPolling()
    return () => {
      mountedRef.current = false
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function startPolling() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setStatus('error'); return }

    async function poll() {
      if (!mountedRef.current) return
      try {
        const res = await fetch('/api/chaturbate/events', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        })

        if (res.status === 400) { setStatus('no_token'); return }
        if (!res.ok) {
          setStatus('error')
          if (mountedRef.current) pollRef.current = setTimeout(poll, 5000)
          return
        }

        const data = await res.json()
        setStatus('live')

        if (data.tip_count > 0) {
          setTipCount(prev => prev + data.tip_count)
          if (onNewTip) onNewTip(data.events)
        }

        // Continue polling — CB longpoll returns after ~20s or when events fire
        if (mountedRef.current) {
          pollRef.current = setTimeout(poll, 1000)
        }
      } catch (err) {
        if (mountedRef.current) {
          pollRef.current = setTimeout(poll, 5000)
        }
      }
    }
    poll()
  }

  if (status === 'no_token') return (
    <div style={{
      padding: '10px 14px',
      borderRadius: '10px',
      background: 'rgba(245,158,11,0.1)',
      border: '1px solid rgba(245,158,11,0.3)',
      fontSize: '13px',
      color: '#f59e0b',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '16px',
    }}>
      ⚡ <span>Connect your <a href="/onboarding" style={{ color: '#22d3ee', textDecoration: 'underline' }}>Chaturbate Events API token</a> for live tip capture</span>
    </div>
  )

  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: '10px',
      background: status === 'live'
        ? 'rgba(34,211,238,0.08)'
        : 'rgba(255,255,255,0.03)',
      border: `1px solid ${status === 'live'
        ? 'rgba(34,211,238,0.3)'
        : 'rgba(255,255,255,0.08)'}`,
      fontSize: '13px',
      color: status === 'live' ? '#22d3ee' : '#64748b',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '16px',
    }}>
      <span style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: status === 'live' ? '#22d3ee' : '#475569',
        display: 'inline-block',
        animation: status === 'live' ? 'cc-pulse 2s infinite' : 'none',
        flexShrink: 0,
      }} />
      {status === 'live'
        ? `Live sync active — ${tipCount} tip${tipCount !== 1 ? 's' : ''} captured this session`
        : status === 'connecting' ? 'Connecting to Chaturbate...'
        : 'Live sync unavailable'
      }
    </div>
  )
}

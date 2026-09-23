'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * LiveTipsStream: Real-time platform-aware tip polling
 *
 * Polls /api/live/tips/stream every 2 seconds to deliver:
 * - Individual tips with platform attribution
 * - Per-platform earnings breakdown
 * - Currently streaming platform detection
 * - Session attribution (live_session_id)
 *
 * Callbacks:
 * - onNewTips(tips): when new tips arrive
 * - onPlatformUpdate({ platform, totalUSD, tipCount, tips }): platform data changed
 * - onStatusChange(status): connection status ('connecting' | 'live' | 'error')
 */
export default function LiveTipsStream({ onNewTips, onPlatformUpdate, onStatusChange }) {
  const [status, setStatus] = useState('connecting')
  const [totalTips, setTotalTips] = useState(0)
  const [totalUSD, setTotalUSD] = useState(0)
  const [currentlyStreaming, setCurrentlyStreaming] = useState(null)

  const pollRef = useRef(null)
  const mountedRef = useRef(true)
  const lastSeenTimestampRef = useRef(null)
  const lastPlatformStatsRef = useRef({})

  useEffect(() => {
    mountedRef.current = true
    startPolling()

    return () => {
      mountedRef.current = false
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [])

  useEffect(() => {
    if (onStatusChange) onStatusChange(status)
  }, [status, onStatusChange])

  async function startPolling() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setStatus('error')
      return
    }

    async function poll() {
      if (!mountedRef.current) return

      try {
        const since = lastSeenTimestampRef.current
        const url = new URL('/api/live/tips/stream', window.location.origin)
        if (since) url.searchParams.set('since', since)
        url.searchParams.set('limit', '100')

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (!res.ok) {
          setStatus('error')
          if (mountedRef.current) {
            pollRef.current = setTimeout(poll, 5000)
          }
          return
        }

        const data = await res.json()
        setStatus('live')

        if (!data.tips || data.tips.length === 0) {
          // No new tips this poll, but connection is healthy
          if (mountedRef.current) {
            pollRef.current = setTimeout(poll, 2000)
          }
          return
        }

        // Update global stats
        setTotalTips(data.totalTips || 0)
        setTotalUSD(data.totalUSD || 0)
        setCurrentlyStreaming(data.currentlyStreaming)

        // Detect new tips (those after lastSeenTimestamp)
        const newTips = since
          ? data.tips.filter((t) => new Date(t.received_at).getTime() > new Date(since).getTime())
          : data.tips

        if (newTips.length > 0) {
          // Update lastSeenTimestamp to most recent tip
          const mostRecentTip = data.tips[0] // tips are in reverse chronological order from API
          if (mostRecentTip) {
            lastSeenTimestampRef.current = mostRecentTip.received_at
          }

          // Notify about new tips
          if (onNewTips) {
            onNewTips(newTips)
          }
        }

        // Detect platform changes and notify with full stats array
        if (data.platformStats && Array.isArray(data.platformStats)) {
          let statsChanged = false

          data.platformStats.forEach((stat) => {
            const lastStat = lastPlatformStatsRef.current[stat.platform]
            if (!lastStat ||
                lastStat.totalUSD !== stat.totalUSD ||
                lastStat.tipCount !== stat.tipCount) {
              statsChanged = true
            }
            lastPlatformStatsRef.current[stat.platform] = stat
          })

          // Only call onPlatformUpdate if any platform stats changed
          if (statsChanged && onPlatformUpdate) {
            onPlatformUpdate(data.platformStats)
          }
        }

        // Continue polling
        if (mountedRef.current) {
          pollRef.current = setTimeout(poll, 2000)
        }
      } catch (err) {
        console.error('[LiveTipsStream] Poll error:', err)
        if (mountedRef.current) {
          pollRef.current = setTimeout(poll, 5000)
        }
      }
    }

    poll()
  }

  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: '10px',
        background:
          status === 'live'
            ? 'rgba(16,185,129,0.08)'
            : status === 'connecting'
              ? 'rgba(59,130,246,0.08)'
              : 'rgba(255,255,255,0.03)',
        border: `1px solid ${
          status === 'live'
            ? 'rgba(16,185,129,0.3)'
            : status === 'connecting'
              ? 'rgba(59,130,246,0.3)'
              : 'rgba(255,255,255,0.08)'
        }`,
        fontSize: '13px',
        color:
          status === 'live'
            ? '#10b981'
            : status === 'connecting'
              ? '#3b82f6'
              : '#64748b',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background:
            status === 'live'
              ? '#10b981'
              : status === 'connecting'
                ? '#3b82f6'
                : '#ef4444',
          display: 'inline-block',
          animation: status === 'live' || status === 'connecting' ? 'cc-pulse 2s infinite' : 'none',
          flexShrink: 0,
        }}
      />
      {status === 'live'
        ? `Live platform tracking active — ${totalTips} tip${totalTips !== 1 ? 's' : ''} ($${totalUSD.toFixed(2)}) ${
            currentlyStreaming ? `[${currentlyStreaming}]` : ''
          }`
        : status === 'connecting'
          ? 'Connecting to tip stream...'
          : 'Live tip sync unavailable'}
    </div>
  )
}

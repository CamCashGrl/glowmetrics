'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { shapeLiveSession } from '../../lib/liveSession/shape'

const HEARTBEAT_INTERVAL_MS = 20000
const STOP_SUMMARY_DISPLAY_MS = 5000
// A session can be started/paused/resumed/stopped from a different surface
// entirely (the extension popup, or another open tab) — this page has no
// other way to find out. Polling is the simplest fix; 15s keeps any given
// page's view close enough to real without hammering the route.
const POLL_INTERVAL_MS = 15000

// Encapsulates the entire V2 Live Mode session lifecycle: Restore, Go Live,
// Pause, Resume, Stop, Resolve, and the website heartbeat. The engine
// choice (V2 vs legacy) is decided once, during the initial restore(), and
// never re-evaluated for the lifetime of this hook instance — matching the
// mid-session engine-locking requirement. Callers read `engineMode` to
// decide which UI tree and which click handlers to use; this hook never
// touches stream_sessions and never calls the legacy handlers itself.
export function useLiveSessionEngine() {
  const [phase, setPhase] = useState('loading') // 'loading' | 'idle' | 'active' | 'needs_resolution' | 'justEnded' | 'legacy'
  const [serverSession, setServerSession] = useState(null)
  const [engineEnabledForNewSession, setEngineEnabledForNewSession] = useState(false)
  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [, setTick] = useState(0) // drives re-render only; the live timer is recomputed from serverSession each tick, never written to the DB

  // Locked once by restore(); never reassigned afterward.
  const engineModeRef = useRef(null) // 'v2' | 'legacy'

  const heartbeatIntervalRef = useRef(null)
  const heartbeatInFlightRef = useRef(false)
  const stopSummaryTimeoutRef = useRef(null)
  const tickerRef = useRef(null)

  // Mirrored into refs so the poll interval (set up once, see below) always
  // reads the latest value without needing to be torn down and recreated
  // every time phase/actionPending change.
  const phaseRef = useRef(phase)
  useEffect(() => { phaseRef.current = phase }, [phase])
  const actionPendingRef = useRef(actionPending)
  useEffect(() => { actionPendingRef.current = actionPending }, [actionPending])

  useEffect(() => {
    tickerRef.current = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(tickerRef.current)
  }, [])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
    heartbeatInFlightRef.current = false
  }, [])

  const sendHeartbeatOnce = useCallback(() => {
    if (heartbeatInFlightRef.current) return // overlap guard — skip this tick if the previous call hasn't resolved
    heartbeatInFlightRef.current = true
    fetch('/api/live/session/heartbeat', { method: 'POST' })
      .catch(() => {}) // one failed heartbeat is never surfaced as an error — the next tick retries
      .finally(() => { heartbeatInFlightRef.current = false })
  }, [])

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) return // duplicate-loop guard
    sendHeartbeatOnce() // send immediately — do not wait for the first 20s tick
    heartbeatIntervalRef.current = setInterval(sendHeartbeatOnce, HEARTBEAT_INTERVAL_MS)
  }, [sendHeartbeatOnce])

  const restore = useCallback(async () => {
    setPhase('loading')
    try {
      const res = await fetch('/api/live/session', { cache: 'no-store' })
      const data = await res.json()

      if (!res.ok) {
        engineModeRef.current = 'legacy'
        setPhase('legacy')
        return
      }

      setEngineEnabledForNewSession(!!data.engineEnabledForNewSession)

      if (data.session) {
        // An unresolved V2 session already exists — always finish it with V2,
        // regardless of engineEnabledForNewSession's current value.
        engineModeRef.current = 'v2'
        setServerSession(data.session)
        if (data.session.status === 'needs_resolution') {
          setPhase('needs_resolution')
        } else {
          setPhase('active') // covers both 'active' and 'paused'; UI branches further on session.status
          startHeartbeat()
        }
      } else if (data.engineEnabledForNewSession) {
        engineModeRef.current = 'v2'
        setPhase('idle')
      } else {
        engineModeRef.current = 'legacy'
        setPhase('legacy')
      }
    } catch (_) {
      engineModeRef.current = 'legacy'
      setPhase('legacy')
    }
  }, [startHeartbeat])

  useEffect(() => {
    restore()
    return () => {
      stopHeartbeat()
      clearTimeout(stopSummaryTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Notices a session started/paused/resumed/stopped from a different
  // surface (the extension, or another open tab) — restore() only ever runs
  // once, on mount, so without this a page open before that action happened
  // would show nothing until manually reloaded. Skipped while an action
  // initiated from *this* instance is in flight (its own response already
  // drives state) and while a stop's justEnded summary is being displayed
  // (a poll landing mid-summary would otherwise cut it short by clearing
  // serverSession/phase early).
  const poll = useCallback(async () => {
    if (engineModeRef.current !== 'v2') return
    if (actionPendingRef.current) return
    if (phaseRef.current === 'loading' || phaseRef.current === 'justEnded') return
    try {
      const res = await fetch('/api/live/session', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setEngineEnabledForNewSession(!!data.engineEnabledForNewSession)
      if (data.session) {
        setServerSession(data.session)
        setPhase(data.session.status === 'needs_resolution' ? 'needs_resolution' : 'active')
        startHeartbeat()
      } else {
        setServerSession(null)
        setPhase('idle')
        stopHeartbeat()
      }
    } catch (_) {
      // a failed poll is never surfaced — the next tick retries
    }
  }, [startHeartbeat, stopHeartbeat])

  useEffect(() => {
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [poll])

  const goLive = useCallback(async (platform) => {
    if (actionPending || engineModeRef.current !== 'v2') return
    setActionPending(true)
    setActionError(null)
    try {
      const res = await fetch('/api/live/session/start', {
        method: 'POST',
        body: JSON.stringify({ platform }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.engineDisabled) {
          // Flag was disabled between page load and this click — fall back
          // to legacy for the rest of this mount rather than erroring.
          engineModeRef.current = 'legacy'
          setPhase('legacy')
        } else {
          setActionError(data.error)
        }
        return
      }
      setServerSession(data.session)
      if (data.session.status === 'needs_resolution') {
        setPhase('needs_resolution')
      } else {
        setPhase('active')
        startHeartbeat()
      }
    } finally {
      setActionPending(false)
    }
  }, [actionPending, startHeartbeat])

  const pause = useCallback(async () => {
    if (actionPending || engineModeRef.current !== 'v2' || serverSession?.status !== 'active') return
    setActionPending(true)
    setActionError(null)
    try {
      const res = await fetch('/api/live/session/pause', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setActionError(data.error); return }
      if (data.session) setServerSession(data.session)
      // heartbeat interval is intentionally left running through the pause
    } finally {
      setActionPending(false)
    }
  }, [actionPending, serverSession])

  const resume = useCallback(async () => {
    if (actionPending || engineModeRef.current !== 'v2' || serverSession?.status !== 'paused') return
    setActionPending(true)
    setActionError(null)
    try {
      const res = await fetch('/api/live/session/resume', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setActionError(data.error); return }
      if (data.session) setServerSession(data.session)
    } finally {
      setActionPending(false)
    }
  }, [actionPending, serverSession])

  const stop = useCallback(async () => {
    if (actionPending || engineModeRef.current !== 'v2') return
    setActionPending(true)
    setActionError(null)
    try {
      const res = await fetch('/api/live/session/stop', { method: 'POST' })
      const data = await res.json()
      stopHeartbeat()
      if (!res.ok) { setActionError(data.error); return }

      if (data.alreadyStopped) {
        setServerSession(null)
        setPhase('idle')
        return
      }

      setServerSession(data.session)
      setPhase('justEnded')
      stopSummaryTimeoutRef.current = setTimeout(() => {
        setPhase('idle')
        setServerSession(null)
      }, STOP_SUMMARY_DISPLAY_MS)
    } finally {
      setActionPending(false)
    }
  }, [actionPending, stopHeartbeat])

  const resolve = useCallback(async (choice, endTime) => {
    if (actionPending || engineModeRef.current !== 'v2') return
    setActionPending(true)
    setActionError(null)
    try {
      const res = await fetch('/api/live/session/resolve', {
        method: 'POST',
        body: JSON.stringify({ choice, endTime: endTime ?? null }),
      })
      const data = await res.json()
      if (!res.ok) { setActionError(data.error); return }

      if (choice === 'ended') {
        setServerSession(null)
        setPhase('idle')
        return
      }

      setServerSession(data.session)
      setPhase('active')
      startHeartbeat()
    } finally {
      setActionPending(false)
    }
  }, [actionPending, startHeartbeat])

  // Never deletes a live_tips row — sets tips_cleared_at on the current
  // session (see app/api/live/session/clear-tips/route.js). Allowed in any
  // unresolved phase, not just 'active', since a paused or needs_resolution
  // session can still have a tip feed worth resetting.
  const clearTips = useCallback(async () => {
    if (actionPending || engineModeRef.current !== 'v2' || !serverSession) return
    setActionPending(true)
    setActionError(null)
    try {
      const res = await fetch('/api/live/session/clear-tips', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setActionError(data.error); return }
      if (data.session) setServerSession(data.session)
    } finally {
      setActionPending(false)
    }
  }, [actionPending, serverSession])

  const logout = useCallback(() => {
    stopHeartbeat()
    clearTimeout(stopSummaryTimeoutRef.current)
  }, [stopHeartbeat])

  const duration = serverSession ? shapeLiveSession(serverSession) : null

  return {
    phase,
    serverSession,
    engineEnabledForNewSession,
    actionPending,
    actionError,
    engineMode: engineModeRef.current,
    duration,
    goLive,
    pause,
    resume,
    stop,
    resolve,
    clearTips,
    logout,
  }
}

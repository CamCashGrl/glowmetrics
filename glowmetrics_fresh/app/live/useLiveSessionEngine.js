'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { shapeLiveSession } from '../../lib/liveSession/shape'

const HEARTBEAT_INTERVAL_MS = 20000
const STOP_SUMMARY_DISPLAY_MS = 5000
const TERMINAL_RESOLUTION_CHOICES = new Set([
  'ended', 'end_at_last_heartbeat', 'choose_end_time', 'mark_invalid',
])
const POLL_INTERVAL_MS = 15000

export function useLiveSessionEngine() {
  const [phase, setPhase] = useState('loading')
  const [serverSession, setServerSession] = useState(null)
  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [lastResolution, setLastResolution] = useState(null)
  const [privateInterval, setPrivateInterval] = useState(null)
  const [lastCompletedShow, setLastCompletedShow] = useState(null)
  const [completedShowsVersion, setCompletedShowsVersion] = useState(0)
  const markShowCompleted = useCallback(() => setCompletedShowsVersion((v) => v + 1), [])
  const [, setTick] = useState(0)

  const heartbeatIntervalRef = useRef(null)
  const heartbeatInFlightRef = useRef(false)
  const stopSummaryTimeoutRef = useRef(null)
  const tickerRef = useRef(null)

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
    if (heartbeatInFlightRef.current) return
    heartbeatInFlightRef.current = true
    fetch('/api/live/session/heartbeat', { method: 'POST' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (data?.endedByFreeLimit) {
          stopHeartbeat()
          setPrivateInterval(null)
          setServerSession(data.session || null)
          markShowCompleted()
          setActionError('Your 30-minute Free Live Mode session is complete. Upgrade to Pro for unlimited Live Mode.')
          setPhase('justEnded')
          stopSummaryTimeoutRef.current = setTimeout(() => {
            setPhase('idle')
            setServerSession(null)
          }, STOP_SUMMARY_DISPLAY_MS)
        }
      })
      .catch(() => {})
      .finally(() => { heartbeatInFlightRef.current = false })
  }, [markShowCompleted, stopHeartbeat])

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) return
    sendHeartbeatOnce()
    heartbeatIntervalRef.current = setInterval(sendHeartbeatOnce, HEARTBEAT_INTERVAL_MS)
  }, [sendHeartbeatOnce])

  const phaseForStatus = (status) => {
    if (status === 'inactive_warning') return 'inactive_warning'
    if (status === 'starting') return 'starting'
    return 'active'
  }

  const restore = useCallback(async () => {
    setPhase('loading')
    try {
      const res = await fetch('/api/live/session', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setPhase('idle')
        return
      }
      if (data.session) {
        setServerSession(data.session)
        setPrivateInterval(data.privateInterval || null)
        setPhase(phaseForStatus(data.session.status))
        startHeartbeat()
      } else {
        setPhase('idle')
      }
    } catch (_) {
      setPhase('idle')
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

  const poll = useCallback(async () => {
    if (actionPendingRef.current) return
    if (phaseRef.current === 'loading' || phaseRef.current === 'justEnded' || phaseRef.current === 'resolved') return
    try {
      const res = await fetch('/api/live/session', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (data.session) {
        setServerSession(data.session)
        setPrivateInterval(data.privateInterval || null)
        setPhase(phaseForStatus(data.session.status))
        startHeartbeat()
      } else {
        if (phaseRef.current !== 'idle') markShowCompleted()
        setServerSession(null)
        setPrivateInterval(null)
        setPhase('idle')
        stopHeartbeat()
      }
    } catch (_) {}
  }, [startHeartbeat, stopHeartbeat, markShowCompleted])

  useEffect(() => {
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [poll])

  const goLive = useCallback(async (platform) => {
    if (actionPending) return
    setActionPending(true)
    setActionError(null)
    try {
      const res = await fetch('/api/live/session/start', {
        method: 'POST',
        body: JSON.stringify({ platform }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error)
        return
      }
      setServerSession(data.session)
      setPhase(phaseForStatus(data.session.status))
      startHeartbeat()
      return data.session
    } finally {
      setActionPending(false)
    }
  }, [actionPending, startHeartbeat])

  const pause = useCallback(async () => {
    if (actionPending || serverSession?.status !== 'live' || serverSession?.live_substate !== 'active') return
    setActionPending(true)
    setActionError(null)
    try {
      const res = await fetch('/api/live/session/pause', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setActionError(data.error); return }
      if (data.session) setServerSession(data.session)
    } finally {
      setActionPending(false)
    }
  }, [actionPending, serverSession])

  const resume = useCallback(async () => {
    if (actionPending || serverSession?.status !== 'live' || serverSession?.live_substate !== 'paused') return
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
    if (actionPending) return
    setActionPending(true)
    setActionError(null)
    try {
      const res = await fetch('/api/live/session/stop', { method: 'POST' })
      const data = await res.json()
      stopHeartbeat()
      if (!res.ok) { setActionError(data.error); return }
      setPrivateInterval(null)
      if (data.alreadyStopped) {
        setServerSession(null)
        setPhase('idle')
        return
      }
      setServerSession(data.session)
      setLastCompletedShow(data.summary || null)
      markShowCompleted()
      setPhase('justEnded')
      stopSummaryTimeoutRef.current = setTimeout(() => {
        setPhase('idle')
        setServerSession(null)
      }, STOP_SUMMARY_DISPLAY_MS)
    } finally {
      setActionPending(false)
    }
  }, [actionPending, stopHeartbeat, markShowCompleted])

  const resolve = useCallback(async (choice, endTime) => {
    if (actionPending) return
    setActionPending(true)
    setActionError(null)
    try {
      const res = await fetch('/api/live/session/resolve', {
        method: 'POST',
        body: JSON.stringify({ choice, endTime: endTime ?? null }),
      })
      const data = await res.json()
      if (!res.ok) { setActionError(data.error); return }
      if (!data.resolved || !data.session) {
        stopHeartbeat()
        setServerSession(null)
        setLastResolution(null)
        setPhase('idle')
        return
      }
      if (TERMINAL_RESOLUTION_CHOICES.has(choice)) {
        stopHeartbeat()
        setServerSession(data.session)
        setLastResolution({ choice, session: data.session })
        setPrivateInterval(null)
        markShowCompleted()
        setPhase('resolved')
        stopSummaryTimeoutRef.current = setTimeout(() => {
          setPhase('idle')
          setServerSession(null)
          setLastResolution(null)
        }, STOP_SUMMARY_DISPLAY_MS)
        return
      }
      setServerSession(data.session)
      setPhase('active')
      startHeartbeat()
    } finally {
      setActionPending(false)
    }
  }, [actionPending, startHeartbeat, stopHeartbeat, markShowCompleted])

  const clearTips = useCallback(async () => {
    if (actionPending || !serverSession) return
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

  const startPrivate = useCallback(async (ratePerMinute, platform, username) => {
    if (actionPending) return
    setActionPending(true)
    setActionError(null)
    try {
      const res = await fetch('/api/live/session/private/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratePerMinute, platform, username }),
      })
      const data = await res.json()
      if (!res.ok) { setActionError(data.error); return }
      setPrivateInterval(data.privateInterval || null)
    } finally {
      setActionPending(false)
    }
  }, [actionPending])

  const endPrivate = useCallback(async () => {
    if (actionPending) return
    setActionPending(true)
    setActionError(null)
    try {
      const res = await fetch('/api/live/session/private/end', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setActionError(data.error); return }
      setPrivateInterval(null)
    } finally {
      setActionPending(false)
    }
  }, [actionPending])

  const duration = serverSession ? shapeLiveSession(serverSession) : null

  return {
    phase,
    serverSession,
    actionPending,
    actionError,
    lastResolution,
    duration,
    goLive,
    pause,
    resume,
    stop,
    resolve,
    clearTips,
    logout,
    privateInterval,
    startPrivate,
    endPrivate,
    lastCompletedShow,
    completedShowsVersion,
  }
}

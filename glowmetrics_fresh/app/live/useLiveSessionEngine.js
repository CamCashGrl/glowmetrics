'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { shapeLiveSession } from '../../lib/liveSession/shape'

const HEARTBEAT_INTERVAL_MS = 20000
const STOP_SUMMARY_DISPLAY_MS = 5000
// Resolution choices that end the session. 'still_live' is the only
// non-terminal choice — it returns the session to LIVE, preserving
// whatever live_substate (active/paused) it actually had before the outage.
const TERMINAL_RESOLUTION_CHOICES = new Set([
  'ended', 'end_at_last_heartbeat', 'choose_end_time', 'mark_invalid',
])
// A session can be started/paused/resumed/stopped from a different surface
// entirely (the extension popup, or another open tab) — this page has no
// other way to find out. Polling is the simplest fix; 15s keeps any given
// page's view close enough to real without hammering the route.
const POLL_INTERVAL_MS = 15000

// The single, canonical Live Mode session lifecycle: Go Live, Pause, Resume,
// Stop, Resolve, and the website heartbeat. There is no other engine, no
// flag, and no legacy fallback — every account uses exactly this path.
export function useLiveSessionEngine() {
  // 'loading' | 'idle' | 'starting' | 'active' | 'inactive_warning' | 'resolved' | 'justEnded'
  const [phase, setPhase] = useState('loading')
  const [serverSession, setServerSession] = useState(null)
  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState(null)
  // Machine-readable reason for the last refused action (e.g. TIMEZONE_REQUIRED,
  // FREE_LIVE_WEEKLY_LIMIT, PLATFORM_REQUIRED), straight from the server.
  const [actionErrorCode, setActionErrorCode] = useState(null)
  // The DATABASE's Free-allowance state (get_live_mode_allowance), relayed by
  // GET /api/live/session. Display only: nothing here decides entitlement.
  const [allowance, setAllowance] = useState(null)
  const [allowanceReceivedAt, setAllowanceReceivedAt] = useState(null)
  const applyAllowance = useCallback((a) => {
    if (a === undefined) return
    setAllowance(a)
    setAllowanceReceivedAt(Date.now())
  }, [])
  const failAction = useCallback((data) => {
    setActionError(data?.error || 'Something went wrong. Please try again.')
    setActionErrorCode(data?.code || null)
    if (data?.allowance) applyAllowance(data.allowance)
  }, [applyAllowance])
  // Set only for a terminal resolve() outcome, so the UI can show which of
  // the 4 terminal choices just happened; cleared once the transient
  // 'resolved' display window ends. Never touched by 'still_live'.
  const [lastResolution, setLastResolution] = useState(null)
  // Open private interval of the running session, if any.
  const [privateInterval, setPrivateInterval] = useState(null)
  // Summary of the show this page just stopped (rebuilt server-side from
  // persisted data), and a counter bumped whenever any show finishes —
  // stopped here, resolved, or ended elsewhere — so dashboards refetch.
  const [lastCompletedShow, setLastCompletedShow] = useState(null)
  const [completedShowsVersion, setCompletedShowsVersion] = useState(0)
  const markShowCompleted = useCallback(() => setCompletedShowsVersion((v) => v + 1), [])
  const [, setTick] = useState(0) // drives re-render only; the live timer is recomputed from serverSession each tick, never written to the DB

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

  // Maps a server status to the UI phase. 'live' + 'starting' both keep the
  // website heartbeat running — the website's own heartbeat is independent
  // of whether the extension has connected yet, since a stalled extension
  // shouldn't also stall the dashboard's own proof-of-life.
  const phaseForStatus = (status) => {
    if (status === 'inactive_warning') return 'inactive_warning'
    if (status === 'starting') return 'starting'
    return 'active' // 'live' — UI branches further on session.live_substate for active/paused
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

      applyAllowance(data.allowance)
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
  }, [startHeartbeat, applyAllowance])

  useEffect(() => {
    restore()
    return () => {
      stopHeartbeat()
      clearTimeout(stopSummaryTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Notices a session started/paused/resumed/stopped/ended from a different
  // surface (the extension, or another open tab, or the backend cron sweep)
  // — restore() only ever runs once, on mount, so without this a page open
  // before that action happened would show nothing until manually reloaded.
  // Skipped while an action initiated from *this* instance is in flight (its
  // own response already drives state) and while a stop's justEnded summary,
  // or a resolve()'s terminal-outcome summary, is being displayed (a poll
  // landing mid-summary would otherwise cut it short by clearing
  // serverSession/phase early).
  // `force` is for callers that must re-read the server now (the allowance bar
  // at the limit, the timezone prompt after saving): it skips the guards that
  // only exist to keep a background poll from cutting an action's own
  // response short. Returns the database's allowance state.
  const syncFromServer = useCallback(async ({ force = false } = {}) => {
    if (!force) {
      if (actionPendingRef.current) return null
      if (phaseRef.current === 'loading' || phaseRef.current === 'justEnded' || phaseRef.current === 'resolved') return null
    }
    try {
      const res = await fetch('/api/live/session', { cache: 'no-store' })
      if (!res.ok) return null
      const data = await res.json()
      applyAllowance(data.allowance)
      if (data.session) {
        setServerSession(data.session)
        setPrivateInterval(data.privateInterval || null)
        setPhase(phaseForStatus(data.session.status))
        startHeartbeat()
      } else if (!(force && (phaseRef.current === 'justEnded' || phaseRef.current === 'resolved'))) {
        // A session this page knew about ended elsewhere (extension, other
        // tab, inactivity sweep, or the Free 35-minute cap): its finalized
        // show is new data.
        if (phaseRef.current !== 'idle') markShowCompleted()
        setServerSession(null)
        setPrivateInterval(null)
        setPhase('idle')
        stopHeartbeat()
      }
      return data.allowance ?? null
    } catch (_) {
      // a failed poll is never surfaced — the next tick retries
      return null
    }
  }, [startHeartbeat, stopHeartbeat, markShowCompleted, applyAllowance])
  // Allowance only — for moments when session/phase state is being managed by
  // the caller (the post-stop summary) and must not be touched.
  const refreshAllowanceOnly = useCallback(async () => {
    try {
      const res = await fetch('/api/live/session', { cache: 'no-store' })
      if (!res.ok) return null
      const data = await res.json()
      applyAllowance(data.allowance)
      return data.allowance ?? null
    } catch (_) {
      return null
    }
  }, [applyAllowance])
  const poll = useCallback(() => syncFromServer(), [syncFromServer])
  const refresh = useCallback(() => syncFromServer({ force: true }), [syncFromServer])

  useEffect(() => {
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [poll])

  // 1. Create record. 2. Mark session STARTING. 3. Notify extension (the
  // API route itself flips status starting->live once the extension's first
  // heartbeat actually lands — see send_extension_heartbeat). No other path.
  const goLive = useCallback(async (platform) => {
    if (actionPending) return
    setActionPending(true)
    setActionError(null)
    setActionErrorCode(null)
    try {
      // No default platform, ever: an unsupported or missing platform is
      // refused by the server too, but fail fast with the same wording.
      if (!['Chaturbate', 'BongaCams', 'MyFreeCams'].includes(platform)) {
        failAction({ code: 'PLATFORM_REQUIRED', error: 'Choose Chaturbate, BongaCams or MyFreeCams. CamCash never guesses your platform.' })
        return
      }
      const res = await fetch('/api/live/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      const data = await res.json()
      if (!res.ok) {
        failAction(data)
        return
      }
      setServerSession(data.session)
      setPhase(phaseForStatus(data.session.status))
      startHeartbeat()
      syncFromServer({ force: true })
      return data.session
    } finally {
      setActionPending(false)
    }
  }, [actionPending, startHeartbeat, failAction, syncFromServer])

  const pause = useCallback(async () => {
    if (actionPending || serverSession?.status !== 'live' || serverSession?.live_substate !== 'active') return
    setActionPending(true)
    setActionError(null)
    setActionErrorCode(null)
    try {
      const res = await fetch('/api/live/session/pause', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { failAction(data); return }
      if (data.session) setServerSession(data.session)
      // heartbeat interval is intentionally left running through the pause
    } finally {
      setActionPending(false)
      // The database may have changed state (e.g. the Free cap ended the
      // stream first): re-read it rather than trust local state.
      syncFromServer({ force: true })
    }
  }, [actionPending, serverSession, failAction, syncFromServer])

  const resume = useCallback(async () => {
    if (actionPending || serverSession?.status !== 'live' || serverSession?.live_substate !== 'paused') return
    setActionPending(true)
    setActionError(null)
    setActionErrorCode(null)
    try {
      const res = await fetch('/api/live/session/resume', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { failAction(data); return }
      if (data.session) setServerSession(data.session)
    } finally {
      setActionPending(false)
      // The database may have changed state (e.g. the Free cap ended the
      // stream first): re-read it rather than trust local state.
      syncFromServer({ force: true })
    }
  }, [actionPending, serverSession, failAction, syncFromServer])

  const stop = useCallback(async () => {
    if (actionPending) return
    setActionPending(true)
    setActionError(null)
    setActionErrorCode(null)
    try {
      const res = await fetch('/api/live/session/stop', { method: 'POST' })
      const data = await res.json()
      stopHeartbeat()
      if (!res.ok) { failAction(data); return }

      setPrivateInterval(null)
      if (data.alreadyStopped) {
        setServerSession(null)
        setPhase('idle')
        refreshAllowanceOnly()
        return
      }

      setServerSession(data.session)
      setLastCompletedShow(data.summary || null)
      markShowCompleted()
      setPhase('justEnded')
      refreshAllowanceOnly()
      stopSummaryTimeoutRef.current = setTimeout(() => {
        setPhase('idle')
        setServerSession(null)
      }, STOP_SUMMARY_DISPLAY_MS)
    } finally {
      setActionPending(false)
    }
  }, [actionPending, stopHeartbeat, markShowCompleted, failAction, refreshAllowanceOnly])

  const resolve = useCallback(async (choice, endTime) => {
    // actionPending is also the duplicate-submission guard: a second click
    // (or a second tab) while the first request is still in flight is a
    // no-op here, and the RPC itself is safe against a genuine race — once
    // one caller resolves the session out of 'inactive_warning', any other
    // caller's resolve_live_session() finds nothing to act on and returns
    // null, handled below as the "nothing left to resolve" branch.
    if (actionPending) return
    setActionPending(true)
    setActionError(null)
    setActionErrorCode(null)
    try {
      const res = await fetch('/api/live/session/resolve', {
        method: 'POST',
        body: JSON.stringify({ choice, endTime: endTime ?? null }),
      })
      const data = await res.json()
      if (!res.ok) { failAction(data); return }

      if (!data.resolved || !data.session) {
        // Nothing was actually resolved — e.g. a duplicate submission that
        // lost the race to another tab/device, or the backend sweep already
        // auto-ended it. Resync to idle rather than guess at a phase.
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

      // 'still_live' — back to LIVE, preserving whatever live_substate
      // (active/paused) it actually had before the outage.
      setServerSession(data.session)
      setPhase('active')
      startHeartbeat()
    } finally {
      setActionPending(false)
    }
  }, [actionPending, startHeartbeat, stopHeartbeat, markShowCompleted, failAction])

  // Never deletes a live_tips row — sets tips_cleared_at on the current
  // session (see app/api/live/session/clear-tips/route.js). Allowed in any
  // unresolved phase, not just 'active', since a paused or inactive_warning
  // session can still have a tip feed worth resetting.
  const clearTips = useCallback(async () => {
    if (actionPending || !serverSession) return
    setActionPending(true)
    setActionError(null)
    setActionErrorCode(null)
    try {
      const res = await fetch('/api/live/session/clear-tips', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { failAction(data); return }
      if (data.session) setServerSession(data.session)
    } finally {
      setActionPending(false)
      // The database may have changed state (e.g. the Free cap ended the
      // stream first): re-read it rather than trust local state.
      syncFromServer({ force: true })
    }
  }, [actionPending, serverSession, failAction, syncFromServer])

  const logout = useCallback(() => {
    stopHeartbeat()
    clearTimeout(stopSummaryTimeoutRef.current)
  }, [stopHeartbeat])

  // Platform and username are required and are sent exactly as chosen: the
  // server refuses anything it can't canonicalize and never guesses.
  const startPrivate = useCallback(async (ratePerMinute, platform, username) => {
    if (actionPending) return
    setActionPending(true)
    setActionError(null)
    setActionErrorCode(null)
    try {
      const res = await fetch('/api/live/session/private/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratePerMinute, platform, username }),
      })
      const data = await res.json()
      if (!res.ok) { failAction(data); return }
      setPrivateInterval(data.privateInterval || null)
    } finally {
      setActionPending(false)
      syncFromServer({ force: true })
    }
  }, [actionPending, failAction, syncFromServer])

  const endPrivate = useCallback(async () => {
    if (actionPending) return
    setActionPending(true)
    setActionError(null)
    setActionErrorCode(null)
    try {
      const res = await fetch('/api/live/session/private/end', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { failAction(data); return }
      setPrivateInterval(null)
    } finally {
      setActionPending(false)
      // The database may have changed state (e.g. the Free cap ended the
      // stream first): re-read it rather than trust local state.
      syncFromServer({ force: true })
    }
  }, [actionPending, failAction, syncFromServer])

  const duration = serverSession ? shapeLiveSession(serverSession) : null

  return {
    phase,
    serverSession,
    actionPending,
    actionError,
    actionErrorCode,
    allowance,
    allowanceReceivedAt,
    refresh,
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

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { latestShowDelta, mergeShows, unacknowledgedIds } from "../../lib/liveSession/postShow"

// Finalized live shows for the dashboard. Every load replaces the list with
// the server's persisted view (never appends), so refreshes, reconnects and
// repeated Stops can't duplicate a show or its earnings. `version` changes
// whenever a show finishes (useLiveSessionEngine.completedShowsVersion).
export function useRecentShows(version, { enabled = true, limit = 10, fetchImpl } = {}) {
  const doFetch = fetchImpl || ((...a) => fetch(...a))
  const [shows, setShows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const requestIdRef = useRef(0)

  const refresh = useCallback(async () => {
    if (!enabled) return
    const requestId = ++requestIdRef.current
    setLoading(true)
    try {
      const res = await doFetch(`/api/live/sessions/recent?limit=${limit}`, { cache: "no-store" })
      const data = await res.json()
      if (requestId !== requestIdRef.current) return // a newer load superseded this one
      if (!res.ok) { setError(data?.error || "load_failed"); return }
      setError(null)
      setShows(mergeShows(data.shows || []))
    } catch (e) {
      if (requestId === requestIdRef.current) setError(e.message)
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, limit])

  useEffect(() => { refresh() }, [refresh, version])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return
    const onFocus = () => refresh()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [enabled, refresh])

  const acknowledge = useCallback(async (ids) => {
    const pending = (ids || []).filter(Boolean)
    if (!pending.length) return
    const res = await doFetch("/api/live/sessions/acknowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionIds: pending }),
    })
    if (!res.ok) return
    const { acknowledged = [] } = await res.json()
    const seen = new Map(acknowledged.map((a) => [a.id, a.seenAt]))
    setShows((prev) => prev.map((s) => (seen.has(s.id) ? { ...s, isNew: false, seenAt: seen.get(s.id) } : s)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    shows,
    loading,
    error,
    refresh,
    acknowledge,
    delta: latestShowDelta(shows),
    newIds: unacknowledgedIds(shows),
  }
}

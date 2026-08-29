import { useRef, useEffect, useCallback } from 'react'
import { aggregateRows } from './analytics'

// Bug #2 fix — runEngine()/aggregateRows() used to run synchronously on the
// main thread over the entire tips array on every trigger (initial load,
// CSV import, live-tip flush, 30s refresh). None of the existing mitigations
// (debounced batch inserts, the 30s fingerprint skip) change the cost of a
// single run — for a high-volume account that one pass can block the tab
// for seconds, which reads as a freeze/crash.
//
// This hook moves that single pass into a Web Worker so it no longer blocks
// the main thread, and exposes it as `runEngineAsync(tips, tz) -> Promise`
// so call sites don't need to know whether the result came from a worker or
// a same-thread fallback.
//
// Falls back to calling aggregateRows() synchronously (still wrapped in a
// resolved/rejected Promise, so callers use one code path) when Web Workers
// aren't available — SSR, a browser without Worker support, or the worker
// failing to construct/load. That's the pre-fix behavior, so nothing that
// worked before regresses to "broken", only (in that rare fallback case)
// back to "blocking".
export function useAnalyticsEngine() {
  const workerRef = useRef(null)
  const pendingRef = useRef(new Map()) // requestId -> { resolve, reject }
  const nextIdRef = useRef(0)
  const supportedRef = useRef(
    typeof window !== 'undefined' && typeof window.Worker !== 'undefined'
  )

  useEffect(() => {
    if (!supportedRef.current) return

    let worker
    try {
      worker = new Worker(new URL('./analyticsWorker.js', import.meta.url))
    } catch (e) {
      // Construction can throw in environments where module workers or the
      // bundler's worker asset handling isn't available — fall back rather
      // than leaving every call site hanging on an unresolved promise.
      supportedRef.current = false
      return
    }

    worker.onmessage = (event) => {
      const { requestId, result, error } = event.data || {}
      const pending = pendingRef.current.get(requestId)
      if (!pending) return
      pendingRef.current.delete(requestId)
      if (error) pending.reject(new Error(error))
      else pending.resolve(result)
    }

    worker.onerror = (err) => {
      // The worker crashed (e.g. a bundling/runtime issue) rather than the
      // engine itself throwing — fail any in-flight requests so callers
      // don't hang, and stop routing future calls through this worker.
      pendingRef.current.forEach((p) => p.reject(err))
      pendingRef.current.clear()
      supportedRef.current = false
    }

    workerRef.current = worker

    return () => {
      worker.terminate()
      workerRef.current = null
      pendingRef.current.forEach((p) => p.reject(new Error('Analytics worker unmounted')))
      pendingRef.current.clear()
    }
  }, [])

  const runEngineAsync = useCallback((tips, tz) => {
    if (!workerRef.current || !supportedRef.current) {
      try {
        return Promise.resolve(aggregateRows(tips, tz))
      } catch (e) {
        return Promise.reject(e)
      }
    }
    const requestId = ++nextIdRef.current
    return new Promise((resolve, reject) => {
      pendingRef.current.set(requestId, { resolve, reject })
      workerRef.current.postMessage({ requestId, tips, tz })
    })
  }, [])

  return runEngineAsync
}

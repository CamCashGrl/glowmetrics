// ============================================================
// ANALYTICS ENGINE — WEB WORKER
// ============================================================
// aggregateRows() does a single synchronous pass over the entire tips
// array (whale detection, session detection, per-day/per-hour/per-platform
// aggregation, insights, predictions...). For a high-volume account
// (tens of thousands of tips) that pass can take seconds. Running it here,
// off the main thread, means that time no longer blocks the tab — the UI
// stays responsive while the worker crunches the numbers.
//
// This file must stay a pure "receive tips, return the aggregateRows()
// result" boundary — it intentionally does not import React, Supabase, or
// anything with browser-main-thread-only APIs. See lib/useAnalyticsEngine.js
// for the hook that talks to this worker (and the synchronous fallback for
// environments where Workers aren't available).

import { aggregateRows } from './analytics'

self.onmessage = (event) => {
  const { requestId, tips, tz } = event.data || {}
  try {
    const result = aggregateRows(tips, tz)
    self.postMessage({ requestId, result })
  } catch (err) {
    self.postMessage({ requestId, error: (err && err.message) || String(err) })
  }
}

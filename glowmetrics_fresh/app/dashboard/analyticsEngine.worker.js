// Runs aggregateRows() off the main thread. At small tip counts this analytics
// pass is imperceptible; at tens of thousands of rows it's long enough to block
// the main thread and freeze clicks if run inline (see dashboard/page.js's
// runEngineAsync). Pure computation only — no DOM/window APIs, safe to run here.
import { aggregateRows } from '../../lib/analytics'

self.onmessage = (event) => {
  const { requestId, tips, tz } = event.data || {}
  try {
    const result = aggregateRows(tips, tz)
    self.postMessage({ requestId, result })
  } catch (err) {
    self.postMessage({ requestId, error: err?.message || String(err) })
  }
}

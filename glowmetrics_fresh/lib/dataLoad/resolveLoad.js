// What the dashboard should DO with a table load result. Pure; no React.
//
//   complete                          -> apply the new rows                     (state 'current')
//   incomplete, last load complete    -> KEEP what is on screen (never replace
//                                        complete data with partial data);
//                                        the screen is stale, not partial      (state 'stale')
//   incomplete, no complete load yet  -> show what arrived, flagged incomplete
//                                        (a persistent warning + Retry)        (state 'partial' / 'failed')
//
// Each decision also carries `loadState` = { complete, state, coverage, asOf }
// for that table. S1 only records it; nothing on screen reads it yet (later,
// separately approved batches will). `coverage` semantics: lib/dataLoad/fetchAllRows.js.
//   current: coverage { kind: 'all' }, asOf = when this load finished
//   stale:   the PREVIOUS complete load's coverage and asOf, unchanged
//   partial: the coverage this load could prove ('since' or 'none')
//   failed:  nothing arrived; coverage 'none'
import { fetchAllRows } from './fetchAllRows'

// `previous` per table may be the S1 loadState object or a plain boolean
// (the #750 shape): both mean "was the data on screen from a complete load?".
const prevComplete = (p) => (p && typeof p === 'object' ? !!p.complete : !!p)

export function resolveTableLoad({ table, result, previous, previousComplete }) {
  if (previous === undefined) previous = previousComplete // #750 parameter name, still accepted
  if (result.complete) {
    return {
      table, apply: true, rows: result.rows, complete: true, stale: false, issue: null,
      loadState: { complete: true, state: 'current', coverage: { kind: 'all' }, asOf: result.finishedAt ?? null },
    }
  }
  const issue = { table, reason: result.reason, error: result.error, expected: result.expected, received: result.received }
  if (prevComplete(previous)) {
    const prior = previous && typeof previous === 'object' ? previous : {}
    return {
      table, apply: false, rows: null, complete: true, stale: true, issue: { ...issue, stale: true },
      loadState: { complete: true, state: 'stale', coverage: prior.coverage || { kind: 'all' }, asOf: prior.asOf ?? null },
    }
  }
  const rows = result.rows || []
  return {
    table, apply: true, rows, complete: false, stale: false, issue: { ...issue, stale: false },
    loadState: { complete: false, state: rows.length ? 'partial' : 'failed', coverage: result.coverage || { kind: 'none' }, asOf: null },
  }
}

// Loads tips and private sessions and decides what to apply, in one place.
//   tips / paid = sources from lib/dataLoad/queries.js
//   previous = { tips, paid } (loadState objects or booleans) OR a function
//              returning it. A function is read AFTER the fetches finish, so a
//              load that started earlier cannot overwrite complete data that a
//              concurrent load applied in the meantime.
export async function loadUserHistory({ tips: tipsSource, paid: paidSource, previous = {}, fetchOpts = {} }) {
  const tipsResult = await fetchAllRows(tipsSource, fetchOpts)
  const paidResult = await fetchAllRows(paidSource, fetchOpts)
  const prev = (typeof previous === 'function' ? previous() : previous) || {}
  const tips = resolveTableLoad({ table: 'tips', result: tipsResult, previous: prev.tips })
  const paid = resolveTableLoad({ table: 'paid_sessions', result: paidResult, previous: prev.paid })
  return {
    tips, paid,
    complete: tips.complete && paid.complete,
    fullyFresh: tips.apply && tips.complete && paid.apply && paid.complete,
    issues: [tips.issue, paid.issue].filter(Boolean),
    loadState: { tips: tips.loadState, paid: paid.loadState },
  }
}

// A failure outside the paged fetches (thrown error): never claims completeness
// it cannot prove. Data already on screen from a complete load stays as it is,
// with its previous coverage and asOf.
export function failureState(previous = {}) {
  const next = (p) => (prevComplete(p)
    ? { complete: true, state: 'stale', coverage: (p && p.coverage) || { kind: 'all' }, asOf: (p && p.asOf) ?? null }
    : { complete: false, state: 'failed', coverage: { kind: 'none' }, asOf: null })
  const mk = (table, p) => ({ table, reason: 'exception', error: null, stale: prevComplete(p) })
  return {
    tipsComplete: prevComplete(previous.tips),
    paidComplete: prevComplete(previous.paid),
    issues: [mk('tips', previous.tips), mk('paid_sessions', previous.paid)],
    loadState: { tips: next(previous.tips), paid: next(previous.paid) },
  }
}

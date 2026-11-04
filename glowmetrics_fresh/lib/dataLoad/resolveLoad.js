// What the dashboard should DO with a table load result. Pure; no React.
//
//   complete                          -> apply the new rows
//   incomplete, last load complete    -> KEEP what is on screen (never replace
//                                        complete data with partial data);
//                                        the screen is stale, not partial
//   incomplete, no complete load yet  -> show what arrived, flagged incomplete
//                                        (a persistent warning + Retry)
//
import { fetchAllRows } from './fetchAllRows'

// `complete` on the decision means "the dataset on screen came from a complete
// load" (a stale-but-complete snapshot still counts).

export function resolveTableLoad({ table, result, previousComplete }) {
  if (result.complete) {
    return { table, apply: true, rows: result.rows, complete: true, stale: false, issue: null }
  }
  const issue = { table, reason: result.reason, error: result.error, expected: result.expected, received: result.received }
  if (previousComplete) {
    return { table, apply: false, rows: null, complete: true, stale: true, issue: { ...issue, stale: true } }
  }
  return { table, apply: true, rows: result.rows, complete: false, stale: false, issue: { ...issue, stale: false } }
}

// Loads tips and private sessions and decides what to apply, in one place.
//   previous = { tips: boolean, paid: boolean } OR a function returning it
//              (was the data on screen complete?). A function is read AFTER the
//              fetches finish, so a load that started earlier cannot overwrite
//              complete data that a concurrent load applied in the meantime.
export async function loadUserHistory({ fetchTips, fetchPaid, previous = {}, fetchOpts = {} }) {
  const tipsResult = await fetchAllRows(fetchTips, fetchOpts)
  const paidResult = await fetchAllRows(fetchPaid, fetchOpts)
  const prev = (typeof previous === 'function' ? previous() : previous) || {}
  const tips = resolveTableLoad({ table: 'tips', result: tipsResult, previousComplete: !!prev.tips })
  const paid = resolveTableLoad({ table: 'paid_sessions', result: paidResult, previousComplete: !!prev.paid })
  return {
    tips, paid,
    complete: tips.complete && paid.complete,
    fullyFresh: tips.apply && tips.complete && paid.apply && paid.complete,
    issues: [tips.issue, paid.issue].filter(Boolean),
  }
}

// A failure outside the paged fetches (thrown error): never claims completeness
// it cannot prove. Data already on screen from a complete load stays as it is.
export function failureState(previous = {}) {
  const mk = (table, prevComplete) => ({ table, reason: 'exception', error: null, stale: !!prevComplete })
  return {
    tipsComplete: !!previous.tips,
    paidComplete: !!previous.paid,
    issues: [mk('tips', previous.tips), mk('paid_sessions', previous.paid)],
  }
}

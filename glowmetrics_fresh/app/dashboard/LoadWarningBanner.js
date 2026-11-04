"use client"

// Persistent, non-dismissible warning shown whenever the dashboard could not
// load everything. It never goes away on its own: only a successful, complete
// reload clears it. `issues` come from lib/dataLoad/resolveLoad.js.
//   stale   = the refresh failed but the data on screen is the last COMPLETE
//             load (older, not partial)
//   partial = some rows never arrived: totals can be understated

const LABEL = { tips: 'tips', paid_sessions: 'private sessions' }

export default function LoadWarningBanner({ issues = [], onRetry, retrying = false }) {
  if (!issues.length) return null
  const partial = issues.filter((i) => !i.stale)
  const what = (list) => [...new Set(list.map((i) => LABEL[i.table] || 'data'))].join(' and ')
  const message = partial.length
    ? `Some of your ${what(partial)} couldn't be loaded, so totals, fan rankings and session results may be understated or missing.`
    : `We couldn't refresh your ${what(issues)} just now. You're seeing your last complete update.`
  return (
    <div role="alert" data-testid="load-warning-banner" data-kind={partial.length ? 'partial' : 'stale'} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      margin: '0 0 16px', padding: '12px 16px', borderRadius: 12,
      background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.45)', color: '#FDE68A', fontSize: 13.5,
    }}>
      <span data-testid="load-warning-message"><strong style={{ color: '#FBBF24' }}>⚠ Data may be incomplete.</strong> {message}</span>
      <button data-testid="load-warning-retry" onClick={onRetry} disabled={retrying} style={{
        background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.6)', color: '#FDE68A', fontWeight: 800,
        fontSize: 12.5, padding: '6px 14px', borderRadius: 8, cursor: retrying ? 'default' : 'pointer', opacity: retrying ? 0.6 : 1,
      }}>{retrying ? 'Retrying…' : 'Retry'}</button>
    </div>
  )
}

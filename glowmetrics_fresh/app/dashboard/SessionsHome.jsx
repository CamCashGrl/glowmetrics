'use client'
// ═══════════════════════════════════════════════════════════════════════════
// SESSIONS — one destination, four views
//
// Free-chat history, private/paid sessions and Live Mode session history used
// to be three separate sidebar entries. A creator looking for "my sessions"
// had to guess which one she meant, and "Live Mode Sessions" opened an empty
// screen for anyone who had never used Live Mode.
//
// This file owns the sub-tab bar and the Overview view only. The three
// existing views are unchanged and still render from their own blocks — no
// session logic was moved, rewritten or recomputed. Every figure below is read
// from the canonical analytics object; this component detects nothing.
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  white: '#F1F5F9', text: '#94A3B8', muted: '#64748B',
  cyan: '#22D3EE', indigo: '#7C5CFF', gold: '#F59E0B',
  border: 'rgba(255,255,255,0.09)', card: 'rgba(255,255,255,0.03)',
}
const GRADIENT = 'linear-gradient(90deg,#16F4FF,#7C5CFF,#FF2BAE)'

export const SESSION_VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'history',  label: 'Session History' },
  { id: 'private',  label: 'Private Sessions' },
  { id: 'live',     label: 'Live Sessions' },
]

const fmtUsd = (v) => `$${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtNum = (v) => (Number(v) || 0).toLocaleString('en-US')
const fmtHours = (h) => `${Number(h) >= 10 ? Math.round(h) : (Number(h) || 0).toFixed(1)}h`

/** The sub-tab bar. Horizontally scrollable on a phone rather than wrapping. */
export function SessionsNav({ active, onChange, counts = {} }) {
  return (
    <div style={{
      display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto',
      paddingBottom: 4, WebkitOverflowScrolling: 'touch',
    }}>
      {SESSION_VIEWS.map(v => {
        const on = active === v.id
        const count = counts[v.id]
        return (
          <button
            key={v.id}
            onClick={() => onChange(v.id)}
            aria-current={on ? 'page' : undefined}
            style={{
              flexShrink: 0, padding: '9px 15px', borderRadius: 100, cursor: 'pointer',
              fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
              background: on ? 'rgba(34,211,238,0.10)' : 'transparent',
              border: `1px solid ${on ? 'rgba(34,211,238,0.45)' : C.border}`,
              color: on ? C.cyan : C.text,
            }}
          >
            {v.label}
            {typeof count === 'number' && count > 0 && (
              <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 700, color: on ? C.cyan : C.muted }}>{count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div style={{ borderRadius: 14, border: `1px solid ${C.border}`, background: C.card, padding: '16px 18px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: C.white, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 5, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  )
}

/**
 * Overview — totals only, all read from the canonical analytics object.
 * @param {Object} props.analytics
 * @param {number} [props.privateCount]
 * @param {number} [props.liveCount]
 */
export function SessionsOverview({ analytics, privateCount = 0, liveCount = 0, onChange }) {
  const a = analytics || {}
  const meaningful = a.meaningfulSessionCount ?? 0
  const lowSignal = a.lowSignalSessionCount ?? 0
  const hours = (a.totalStreamMinutes || 0) / 60
  const perf = a.sessionPerformance || null
  // analytics.estimatedHourlyRate is the ONE hourly figure the dashboard uses;
  // averages below are read from sessionPerformance, never recomputed here.
  const avgSessionUsd = perf?.avgUsdPerSession ?? (meaningful > 0 ? (a.totalUSD || 0) / meaningful : 0)

  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
        gap: 12, marginBottom: 16,
      }}>
        <Stat label="Meaningful sessions" value={fmtNum(meaningful)}
              sub={lowSignal > 0 ? `${fmtNum(lowSignal)} low-signal not counted` : undefined} />
        <Stat label="Hours streamed" value={fmtHours(hours)} sub="across recorded sessions" />
        <Stat label="Earnings" value={fmtUsd(a.totalUSD || 0)} sub={`${fmtNum(a.totalTips || 0)} tips recorded`} />
        <Stat label="Average session" value={fmtUsd(avgSessionUsd)} sub="per meaningful session" />
        <Stat label="Private sessions" value={fmtNum(privateCount)} sub={privateCount ? 'recorded separately' : 'none recorded'} />
        <Stat label="Live Mode sessions" value={fmtNum(liveCount)} sub={liveCount ? 'completed' : 'not used yet'} />
      </div>

      <div style={{ borderRadius: 14, border: `1px solid ${C.border}`, background: C.card, padding: '16px 18px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 6 }}>What counts as a session</div>
        <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.65 }}>
          Sessions are grouped from the timestamps in your imported tips — a new one starts after a
          three-hour gap or a change of platform. A session is <strong style={{ color: C.white }}>meaningful</strong> once
          it runs long enough and earns enough to be worth measuring; shorter ones are kept but left
          out of rate calculations. Nothing here is estimated on your behalf.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 13 }}>
          <button onClick={() => onChange('history')} style={ghostBtn}>Browse session history →</button>
        </div>
      </div>
    </div>
  )
}

/**
 * The Live view's empty state. Shown only when the creator has genuinely never
 * completed a Live Mode session — it says so plainly and offers the one useful
 * action, rather than looking like a page that failed to load. No session is
 * ever fabricated to fill it.
 */
export function LiveSessionsEmpty({ onTryLiveMode }) {
  return (
    <div style={{
      borderRadius: 16, border: `1px solid ${C.border}`, background: C.card,
      padding: '28px 24px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: GRADIENT }} />
      <div style={{ fontSize: 15.5, fontWeight: 800, color: C.white, marginBottom: 8 }}>Live Mode sessions</div>
      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7, maxWidth: 560 }}>
        Live session history will appear here when you use Live Mode. Live Mode records a stream as
        it happens — tips as they land, and how long you were actually live — so the session is
        measured from the stream itself rather than inferred from the gaps between imported tips.
      </div>
      {onTryLiveMode && (
        <button onClick={onTryLiveMode} style={{
          marginTop: 16, padding: '10px 18px', borderRadius: 100, border: 'none', cursor: 'pointer',
          background: GRADIENT, color: '#06101A', fontSize: 12.5, fontWeight: 800,
        }}>Try Live Mode →</button>
      )}
    </div>
  )
}

const ghostBtn = {
  padding: '9px 15px', borderRadius: 10, cursor: 'pointer',
  background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
  color: C.white, fontSize: 12.5, fontWeight: 700,
}

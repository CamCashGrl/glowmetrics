"use client"
import { LM, cardBase, labelStyle } from './theme'

const fmtUsd = (n) => `$${(n || 0).toFixed(2)}`

function BigCard({ label, value, sub, subColor, children }) {
  return (
    <div style={{ ...cardBase, flex: 1, minWidth: 0 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: LM.text, marginTop: 8, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, fontWeight: 600, color: subColor || LM.textSecondary, marginTop: 4 }}>{sub}</div>}
      {children}
    </div>
  )
}

function SmallCard({ label, value, sub }) {
  return (
    <div style={{ ...cardBase, padding: 14, flex: 1, minWidth: 0 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: LM.text, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: LM.textMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
    </div>
  )
}

// Session summary: two rows of cards sourced entirely from the current
// session's real state (computeState()/roomHealth) — no metric here repeats
// anywhere else on the page (Room Status's score is the single Opportunity/
// Room-health number used across the whole redesign).
export default function SessionSummary({ state, roomHealth, comparison, tokensDeltaLabel, uniqueTippers = 0, newTippers = 0 }) {
  const hasSession = !!state;
  const revenue = state?.totalRevenue ?? 0;
  const tokens = state?.totalTokens ?? 0;
  const showVsAvg = comparison && comparison.vsAvgPct !== null && Number.isFinite(comparison.vsAvgPct);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <BigCard
          label="Current Session Earned"
          value={fmtUsd(revenue)}
          sub={showVsAvg ? `${comparison.vsAvgPct > 0 ? '▲' : '▼'} ${Math.abs(comparison.vsAvgPct)}% vs your average` : null}
          subColor={showVsAvg ? (comparison.vsAvgPct > 0 ? LM.green : LM.red) : null}
        />
        <BigCard
          label="Tokens"
          value={tokens.toLocaleString()}
          sub={tokensDeltaLabel || null}
          subColor={LM.green}
        />
        <div style={{ ...cardBase, flex: 1, minWidth: 0 }}>
          <div style={labelStyle}>Room Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 20 }}>{hasSession ? roomHealth.emoji : '⏳'}</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: hasSession ? roomHealth.color : LM.textMuted }}>
              {hasSession ? roomHealth.label : 'Waiting'}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: LM.textSecondary }}>
              {hasSession ? roomHealth.score : 0}<span style={{ color: LM.textMuted }}>/100</span>
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginTop: 10, overflow: 'hidden' }}
            role="progressbar" aria-valuenow={hasSession ? roomHealth.score : 0} aria-valuemin={0} aria-valuemax={100} aria-label="Room opportunity score">
            <div style={{ height: '100%', width: `${hasSession ? roomHealth.score : 0}%`, background: `linear-gradient(90deg, ${LM.magenta}, ${LM.orange})`, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <SmallCard label="Unique Tippers" value={hasSession ? uniqueTippers : '—'} />
        <SmallCard label="New Tippers" value={hasSession ? newTippers : '—'} />
        <SmallCard
          label="Top Tip"
          value={state?.topTipper ? fmtUsd(state.topTipper.revenue) : '—'}
          sub={state?.topTipper ? state.topTipper.username : null}
        />
        <SmallCard label="Avg Tip" value={hasSession ? fmtUsd(state.avgTipValue) : '—'} />
        <SmallCard
          label="Avg Tip / Tipper"
          value={hasSession && uniqueTippers > 0 ? fmtUsd(revenue / uniqueTippers) : '—'}
        />
      </div>
    </div>
  )
}

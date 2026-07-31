"use client"
import { LM, cardBase, labelStyle } from './theme'

// Time-on-the-x-axis sparkline (no chart-library dependency added). Unlike
// a plain "connect the tip points" line, this advances the line all the
// way to `nowMs` even when no tips have landed — the room going quiet is
// itself real information, so the line goes flat rather than disappearing.
// It never fabricates a value: every point's y is a real cumulative-revenue
// number, the only invented part is the flat continuation to "now".
function MomentumChart({ series, startMs, nowMs, goalValue }) {
  const w = 560, h = 180, pad = 24;
  if (!series || series.length === 0 || !startMs) {
    return (
      <div style={{ width: '100%', height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: LM.textMuted, fontSize: 13, textAlign: 'center', border: `1px dashed ${LM.border}`, borderRadius: 10 }}>
        Chart will populate as tips come in this session.
      </div>
    );
  }

  const lastVal = series[series.length - 1].v;
  // Always extend to "now" so idle time visibly advances the line.
  const points = nowMs > series[series.length - 1].t
    ? [...series, { t: nowMs, v: lastVal, isNow: true }]
    : series;

  const totalSpan = Math.max(points[points.length - 1].t - startMs, 60000);
  const max = Math.max(...points.map(p => p.v), goalValue || 0, 1);
  const toX = (t) => pad + ((t - startMs) / totalSpan) * (w - pad * 2);
  const toY = (v) => h - pad - (v / max) * (h - pad * 2);
  const coords = points.map(p => [toX(p.t), toY(p.v)]);
  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1][0]},${h - pad} L${coords[0][0]},${h - pad} Z`;
  const goalY = goalValue ? toY(goalValue) : null;
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={`Earnings momentum over the session, current ${lastVal.toFixed(2)} dollars`}>
      <defs>
        <linearGradient id="lm-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={LM.purple} />
          <stop offset="100%" stopColor={LM.magenta} />
        </linearGradient>
        <linearGradient id="lm-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={LM.magenta} stopOpacity="0.25" />
          <stop offset="100%" stopColor={LM.magenta} stopOpacity="0" />
        </linearGradient>
      </defs>
      {goalY !== null && (
        <line x1={pad} y1={goalY} x2={w - pad} y2={goalY} stroke={LM.textMuted} strokeWidth="1" strokeDasharray="4 4" />
      )}
      <path d={areaPath} fill="url(#lm-fill)" stroke="none" />
      <path d={linePath} fill="none" stroke="url(#lm-line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'd 0.3s ease' }} />
      {points.filter(p => !p.isNow).map((p, i) => (
        <circle key={i} cx={toX(p.t)} cy={toY(p.v)} r={3} fill={LM.magenta} opacity={0.85}>
          <title>{`+$${(p.delta ?? 0).toFixed(2)} · ${new Date(p.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })} · running total $${p.v.toFixed(2)}`}</title>
        </circle>
      ))}
      {/* Newest point breathes so the chart reads as "still watching", not a static snapshot. */}
      <circle cx={lastX} cy={lastY} r={4.5} fill={LM.text} stroke={LM.magenta} strokeWidth={2} style={{ animation: 'lm-point-pulse 1.6s ease-in-out infinite' }}>
        <title>{`Now · running total $${lastVal.toFixed(2)}`}</title>
      </circle>
    </svg>
  );
}

export default function EarningsMomentumPanel({ pace, currentPaceLabel, goalLabel, goalValue, goalCurrent, goalProgressPct, series, startMs, nowMs }) {
  return (
    <div style={{ ...cardBase, marginBottom: 12, display: 'grid', gridTemplateColumns: 'minmax(160px, 220px) 1fr', gap: 24, alignItems: 'start' }}>
      <div>
        <div style={labelStyle}>Earnings Momentum</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: LM.text, marginTop: 8 }}>{currentPaceLabel}</div>
        <div style={{ fontSize: 12, color: LM.textMuted, marginTop: 2 }}>Current Pace</div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, padding: '4px 10px', borderRadius: 999,
          background: pace.bg, border: `1px solid ${pace.border}`, color: pace.color, fontSize: 12, fontWeight: 700,
        }}>
          {pace.label}
        </div>
        {goalLabel && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12, color: LM.textMuted, marginBottom: 6 }}>{goalLabel}</div>
            <div style={{ height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}
              role="progressbar" aria-valuenow={goalProgressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Goal progress">
              <div style={{ height: '100%', width: `${Math.min(100, goalProgressPct || 0)}%`, background: `linear-gradient(90deg, ${LM.magenta}, ${LM.orange})`, transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: LM.textSecondary, marginTop: 6 }}>
              {goalProgressPct != null ? `${Math.min(100, goalProgressPct)}%` : '—'} · {goalCurrent} / {goalValue}
            </div>
          </div>
        )}
      </div>
      <MomentumChart series={series} startMs={startMs} nowMs={nowMs} goalValue={null} />
    </div>
  )
}

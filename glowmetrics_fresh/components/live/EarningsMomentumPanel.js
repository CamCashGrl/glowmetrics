"use client"
import { LM, cardBase, labelStyle } from './theme'

// Hand-rolled SVG sparkline (no chart-library dependency added) — purple to
// magenta stroke, subtle fill, dashed goal line. Renders only real session
// revenue points; a brand-new session shows the empty state instead of a
// fabricated trend.
function MomentumChart({ points, goalValue }) {
  const w = 560, h = 180, pad = 24;
  if (!points || points.length < 2) {
    return (
      <div style={{ width: '100%', height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: LM.textMuted, fontSize: 13, textAlign: 'center', border: `1px dashed ${LM.border}`, borderRadius: 10 }}>
        Chart will populate as tips come in this session.
      </div>
    );
  }
  const max = Math.max(...points, goalValue || 0, 1);
  const stepX = (w - pad * 2) / (points.length - 1);
  const toY = (v) => h - pad - (v / max) * (h - pad * 2);
  const coords = points.map((v, i) => [pad + i * stepX, toY(v)]);
  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1][0]},${h - pad} L${coords[0][0]},${h - pad} Z`;
  const goalY = goalValue ? toY(goalValue) : null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={`Earnings momentum over the session, current ${points[points.length - 1].toFixed(2)} dollars`}>
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
      <path d={linePath} fill="none" stroke="url(#lm-line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function EarningsMomentumPanel({ pace, currentPaceLabel, goalLabel, goalValue, goalCurrent, goalProgressPct, chartPoints }) {
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
              <div style={{ height: '100%', width: `${Math.min(100, goalProgressPct || 0)}%`, background: `linear-gradient(90deg, ${LM.magenta}, ${LM.orange})` }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: LM.textSecondary, marginTop: 6 }}>
              {goalProgressPct != null ? `${Math.min(100, goalProgressPct)}%` : '—'} · {goalCurrent} / {goalValue}
            </div>
          </div>
        )}
      </div>
      <MomentumChart points={chartPoints} goalValue={null} />
    </div>
  )
}
